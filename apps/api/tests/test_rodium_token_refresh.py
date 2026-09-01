"""Refreshing the RodiumAI OAuth token must never strand a signed-in user.

Two failure modes used to end in "RodiumAi account is not linked" while the
Forge JWT was still valid:
- a TRANSIENT refresh failure (gateway 5xx / network) wiped all tokens;
- two concurrent requests raced the token endpoint; with refresh-token
  rotation the loser got invalid_grant, and the handler wiped everything.
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.crypto import decrypt_secret, encrypt_secret
from app.models import User, UserSettings
from app.services import rodium_generation as rg
from app.services.rodium_oidc import RodiumOidcError


class _Db:
    def commit(self):
        pass

    def refresh(self, row):
        pass


def _row(*, expired: bool = True, refresh: bool = True) -> UserSettings:
    row = UserSettings()
    row.rodium_access_token_encrypted = encrypt_secret("old-access")
    row.rodium_refresh_token_encrypted = encrypt_secret("the-refresh") if refresh else None
    delta = timedelta(hours=-1 if expired else 1)
    row.rodium_token_expires_at = datetime.now(UTC) + delta
    return row


def _user() -> User:
    user = User()
    user.id = uuid.uuid4()
    return user


def _ensure(row, monkeypatch=None, refresh_impl=None):
    if refresh_impl is not None:
        monkeypatch.setattr(rg, "refresh_access_token", refresh_impl)
    return asyncio.run(rg.ensure_rodium_access_token(_Db(), _user(), row))


class TestHappyPaths:
    def test_valid_token_is_returned_without_refreshing(self, monkeypatch):
        async def boom(_):
            raise AssertionError("must not refresh a valid token")

        row = _row(expired=False)
        assert _ensure(row, monkeypatch, boom) == "old-access"

    def test_expired_token_is_refreshed_and_stored(self, monkeypatch):
        async def ok(_):
            return {"access_token": "new-access", "refresh_token": "new-refresh", "expires_in": 3600}

        row = _row(expired=True)
        assert _ensure(row, monkeypatch, ok) == "new-access"
        assert decrypt_secret(row.rodium_refresh_token_encrypted) == "new-refresh"
        assert row.rodium_token_expires_at > datetime.now(UTC)


class TestFailureModes:
    def test_transient_gateway_error_keeps_the_tokens(self, monkeypatch):
        async def down(_):
            raise RodiumOidcError("gateway down", 503)

        row = _row(expired=True)
        with pytest.raises(HTTPException) as exc:
            _ensure(row, monkeypatch, down)
        assert exc.value.status_code == 503
        # The whole bug: a blip must not force a re-login.
        assert row.rodium_access_token_encrypted is not None
        assert row.rodium_refresh_token_encrypted is not None

    def test_rejected_refresh_clears_the_tokens(self, monkeypatch):
        async def rejected(_):
            raise RodiumOidcError("invalid_grant", 400)

        row = _row(expired=True)
        with pytest.raises(HTTPException) as exc:
            _ensure(row, monkeypatch, rejected)
        assert exc.value.status_code == 403
        assert row.rodium_access_token_encrypted is None
        assert row.rodium_refresh_token_encrypted is None

    def test_missing_link_is_a_403(self):
        row = UserSettings()
        row.rodium_access_token_encrypted = None
        with pytest.raises(HTTPException) as exc:
            asyncio.run(rg.ensure_rodium_access_token(_Db(), _user(), row))
        assert exc.value.status_code == 403
        assert "not linked" in exc.value.detail


class TestSingleFlight:
    def test_concurrent_requests_refresh_once(self, monkeypatch):
        calls = 0

        async def counted(_):
            nonlocal calls
            calls += 1
            await asyncio.sleep(0.01)
            return {"access_token": f"access-{calls}", "expires_in": 3600}

        monkeypatch.setattr(rg, "refresh_access_token", counted)
        row = _row(expired=True)
        user = _user()

        # db.refresh is a no-op stub, so the second waiter re-reads the row the
        # first one already updated — expiry is now in the future and it must
        # NOT hit the token endpoint again (rotation would invalid_grant it).
        async def race():
            return await asyncio.gather(
                rg.ensure_rodium_access_token(_Db(), user, row),
                rg.ensure_rodium_access_token(_Db(), user, row),
            )

        a, b = asyncio.run(race())
        assert calls == 1
        assert a == b == "access-1"
