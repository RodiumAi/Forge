"""Provisioning the RodiumAi account behind a native Forge account.

The behaviour that matters most is the disabled case: a clone has no
`RODIUM_PROVISION_TOKEN`, and nothing here may reach the network or fail a
request because of it.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest

from app.config import clear_settings_cache
from app.models import User, UserSettings
from app.routers import auth as auth_mod
from app.services import rodium_provisioning


@pytest.fixture
def provisioning_enabled(monkeypatch):
    monkeypatch.setenv("RODIUM_PROVISION_TOKEN", "internal-token-at-least-24-chars")
    monkeypatch.setenv("RODIUM_OIDC_ISSUER", "http://nest.test")
    monkeypatch.setenv("RODIUM_OIDC_CLIENT_ID", "forge")
    clear_settings_cache()
    yield
    clear_settings_cache()


def _response(status: int, payload: dict | None = None) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=payload if payload is not None else {},
        request=httpx.Request("POST", "http://nest.test/x"),
    )


def _patch_post(monkeypatch, result):
    """Stand in for the single outbound POST, or assert none happens."""
    calls: list[dict] = []

    async def fake_post(self, url, **kwargs):
        calls.append({"url": url, **kwargs})
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return calls


class TestProvisionService:
    def test_it_is_a_no_op_without_a_token(self, monkeypatch):
        # The state of every clone: no outbound call, no error.
        clear_settings_cache()
        calls = _patch_post(monkeypatch, _response(201))
        try:
            result = asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="A"))
        finally:
            clear_settings_cache()

        assert result is None
        assert calls == []
        assert rodium_provisioning.enabled() is False

    def test_it_returns_the_user_id_and_tokens(self, monkeypatch, provisioning_enabled):
        calls = _patch_post(
            monkeypatch,
            _response(
                201,
                {
                    "userId": "p6jerdk3zhm3z788ab9t6vj8",
                    "created": True,
                    "accessToken": "access-tok",
                    "refreshToken": "refresh-tok",
                    "expiresIn": 3600,
                },
            ),
        )

        result = asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="Ada"))

        assert result is not None
        assert result.user_id == "p6jerdk3zhm3z788ab9t6vj8"
        assert result.tokens["access_token"] == "access-tok"
        assert result.tokens["refresh_token"] == "refresh-tok"

        sent = calls[0]
        assert sent["headers"]["X-Internal-Token"] == "internal-token-at-least-24-chars"
        # The platform refuses anything else, and we must never claim it falsely.
        assert sent["json"]["emailVerified"] is True
        assert sent["json"]["clientId"] == "forge"

    def test_a_409_becomes_a_typed_conflict(self, monkeypatch, provisioning_enabled):
        _patch_post(monkeypatch, _response(409, {"code": "provisioning_email_exists"}))

        with pytest.raises(rodium_provisioning.ProvisionConflict):
            asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="A"))

    def test_an_unreachable_platform_returns_none(self, monkeypatch, provisioning_enabled):
        # The Forge account is already created and usable; a sibling service
        # being down must not fail the request.
        _patch_post(monkeypatch, httpx.ConnectError("refused"))

        assert asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="A")) is None

    def test_a_server_error_returns_none(self, monkeypatch, provisioning_enabled):
        _patch_post(monkeypatch, _response(500, {"message": "boom"}))

        assert asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="A")) is None

    def test_a_malformed_response_returns_none(self, monkeypatch, provisioning_enabled):
        _patch_post(monkeypatch, _response(201, {"unexpected": "shape"}))

        assert asyncio.run(rodium_provisioning.provision(email="a@b.co", full_name="A")) is None


class TestLinkRodiumAccount:
    def _user(self, **overrides) -> User:
        user = User(email="ada@example.com", password_hash="x")
        user.id = uuid.uuid4()
        user.name = "Ada"
        user.avatar_url = None
        user.rodium_sub = None
        user.rodium_provisioned_at = None
        user.email_verified_at = datetime.now(UTC)
        for key, value in overrides.items():
            setattr(user, key, value)
        return user

    def _db(self) -> MagicMock:
        settings_row = SimpleNamespace(
            rodium_api_key_hint=None,
            rodium_access_token_encrypted=None,
            rodium_refresh_token_encrypted=None,
            rodium_token_expires_at=None,
        )
        db = MagicMock()
        db.get.side_effect = lambda model, _key: settings_row if model is UserSettings else None
        return db

    def test_it_stores_the_link_and_returns_the_access_token(self, monkeypatch):
        user = self._user()
        db = self._db()
        monkeypatch.setattr(auth_mod.rodium_provisioning, "enabled", lambda: True)

        async def fake_provision(**_kwargs):
            return rodium_provisioning.ProvisionResult(
                user_id="rodium-user-1",
                tokens={"access_token": "access-tok", "refresh_token": "r"},
            )

        monkeypatch.setattr(auth_mod.rodium_provisioning, "provision", fake_provision)
        monkeypatch.setattr(auth_mod, "_store_oauth_tokens", lambda _r, _t: None)

        access = asyncio.run(auth_mod._link_rodium_account(db, user))

        assert access == "access-tok"
        # `rodium_sub` is what makes the wallet badge, the key picker and the
        # /pay link light up for this account.
        assert user.rodium_sub == "rodium-user-1"
        assert user.rodium_provisioned_at is not None

    def test_it_does_nothing_for_an_already_linked_account(self, monkeypatch):
        user = self._user(rodium_sub="already-linked")
        called = MagicMock()
        monkeypatch.setattr(auth_mod.rodium_provisioning, "enabled", called)

        assert asyncio.run(auth_mod._link_rodium_account(self._db(), user)) is None
        called.assert_not_called()

    def test_an_existing_rodium_account_leaves_forge_unlinked(self, monkeypatch):
        # The user must go through the consent flow to prove ownership.
        user = self._user()
        monkeypatch.setattr(auth_mod.rodium_provisioning, "enabled", lambda: True)

        async def conflict(**_kwargs):
            raise rodium_provisioning.ProvisionConflict()

        monkeypatch.setattr(auth_mod.rodium_provisioning, "provision", conflict)

        assert asyncio.run(auth_mod._link_rodium_account(self._db(), user)) is None
        assert user.rodium_sub is None

    def test_it_is_skipped_entirely_when_provisioning_is_off(self, monkeypatch):
        user = self._user()
        monkeypatch.setattr(auth_mod.rodium_provisioning, "enabled", lambda: False)

        assert asyncio.run(auth_mod._link_rodium_account(self._db(), user)) is None
        assert user.rodium_sub is None
