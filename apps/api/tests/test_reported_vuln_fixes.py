"""Regressions for two reported issues.

1. Login CSRF / session fixation — the OAuth `state` binding was opt-in, so a
   caller could ask for an unbound state and use it to sign a victim into the
   attacker's account. `/auth/rodium/start` now refuses to mint one.

2. RODI gate bypass — the paid-capability gate returned silently when the
   cached wallet was empty, and logout deliberately emptied it while leaving
   the caller's JWT valid. The gate now fails closed, and logout revokes the
   session.
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.auth import token_for_user
from app.db import get_db
from app.errors import SitesError
from app.models import User, UserSettings
from app.routers import auth as auth_mod
from app.services import capabilities
from app.services.rodium_oidc import create_oauth_state, hash_state_binding


def _request(binding: object = "__absent__") -> MagicMock:
    request = MagicMock()
    request.headers = {}
    query: dict[str, str] = {}
    if binding != "__absent__":
        query["state_binding"] = binding  # type: ignore[assignment]
    request.query_params = query
    return request


# ── Login CSRF: /auth/rodium/start requires a browser binding ──────────────


class TestRodiumStartBinding:
    def test_it_refuses_a_request_without_a_binding(self, monkeypatch):
        monkeypatch.setattr(
            auth_mod, "get_settings", lambda: SimpleNamespace(rodium_oidc_client_id="client-123")
        )
        with pytest.raises(HTTPException) as exc:
            auth_mod.rodium_oauth_start(_request())
        assert exc.value.status_code == 400

    def test_it_refuses_an_empty_binding(self, monkeypatch):
        monkeypatch.setattr(
            auth_mod, "get_settings", lambda: SimpleNamespace(rodium_oidc_client_id="client-123")
        )
        with pytest.raises(HTTPException) as exc:
            auth_mod.rodium_oauth_start(_request(binding="   "))
        assert exc.value.status_code == 400

    def test_it_forwards_the_binding_when_present(self, monkeypatch):
        monkeypatch.setattr(
            auth_mod, "get_settings", lambda: SimpleNamespace(rodium_oidc_client_id="client-123")
        )
        monkeypatch.setattr(auth_mod, "generate_pkce", lambda: ("verifier", "challenge"))
        seen: dict[str, object] = {}

        def fake_create(verifier, binding):
            seen["binding"] = binding
            return "signed-state"

        monkeypatch.setattr(auth_mod, "create_oauth_state", fake_create)
        monkeypatch.setattr(auth_mod, "build_authorize_url", lambda **_kw: "https://issuer/authorize?x=1")

        resp = auth_mod.rodium_oauth_start(_request(binding="hash-abc"))

        assert resp.authorize_url.startswith("https://issuer/authorize")
        assert seen["binding"] == "hash-abc"

    def test_http_start_refuses_a_missing_binding(self, monkeypatch):
        monkeypatch.setattr(
            auth_mod, "get_settings", lambda: SimpleNamespace(rodium_oidc_client_id="client-123")
        )
        app = FastAPI()
        app.include_router(auth_mod.router)

        response = TestClient(app).get("/auth/rodium/start")

        assert response.status_code == 400


class TestRodiumCallbackBinding:
    @pytest.mark.parametrize("binding", [None, "wrong-browser-secret"])
    def test_http_callback_refuses_missing_or_wrong_binding(self, binding):
        state = create_oauth_state(
            "pkce-verifier",
            hash_state_binding("correct-browser-secret"),
        )
        payload = {"code": "authorization-code", "state": state}
        if binding is not None:
            payload["state_binding"] = binding
        app = FastAPI()
        app.include_router(auth_mod.router)

        response = TestClient(app).post("/auth/rodium/callback", json=payload)

        assert response.status_code == 400


# ── RODI gate fails closed ─────────────────────────────────────────────────


def _user():
    return SimpleNamespace(id=uuid.uuid4(), token_version=0)


def _db_returning(row):
    db = MagicMock()
    db.get.return_value = row
    return db


class TestPaidCapabilityGate:
    def test_it_denies_when_no_settings_row(self):
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(None))
        assert exc.value.status_code == 402
        assert exc.value.code == "INSUFFICIENT_RODI"

    def test_it_denies_when_the_wallet_cache_is_empty_after_logout(self):
        # Logout clears tokens + wallet; unknown without OAuth must stay fail-closed.
        row = SimpleNamespace(
            rodium_wallet_json=None,
            rodium_access_token_encrypted=None,
            rodium_refresh_token_encrypted=None,
        )
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))
        assert exc.value.status_code == 402
        assert exc.value.code == "INSUFFICIENT_RODI"

    def test_it_reports_syncing_when_oauth_tokens_exist_but_wallet_is_empty(self):
        row = SimpleNamespace(
            rodium_wallet_json=None,
            rodium_access_token_encrypted="enc-access",
            rodium_refresh_token_encrypted=None,
        )
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))
        assert exc.value.status_code == 503
        assert exc.value.code == "WALLET_SYNCING"

    def test_it_denies_on_a_zero_balance(self):
        row = SimpleNamespace(
            rodium_wallet_json='{"balanceRodi": "0"}',
            rodium_access_token_encrypted="enc",
            rodium_refresh_token_encrypted=None,
        )
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))
        assert exc.value.code == "INSUFFICIENT_RODI"

    def test_it_denies_on_an_unreadable_cache_without_tokens(self):
        row = SimpleNamespace(
            rodium_wallet_json="not-json",
            rodium_access_token_encrypted=None,
            rodium_refresh_token_encrypted=None,
        )
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))
        assert exc.value.code == "INSUFFICIENT_RODI"

    def test_it_reports_syncing_on_unreadable_cache_with_tokens(self):
        row = SimpleNamespace(
            rodium_wallet_json="not-json",
            rodium_access_token_encrypted="enc",
            rodium_refresh_token_encrypted=None,
        )
        with pytest.raises(SitesError) as exc:
            capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))
        assert exc.value.code == "WALLET_SYNCING"

    def test_it_allows_a_positive_balance(self):
        row = SimpleNamespace(
            rodium_wallet_json='{"balanceRodi": "12.5"}',
            rodium_access_token_encrypted=None,
            rodium_refresh_token_encrypted=None,
        )
        # No exception is the contract.
        capabilities.require_rodi_for_paid_capability(_user(), _db_returning(row))


# ── Logout revokes the session ─────────────────────────────────────────────


class TestLogoutRevokesSession:
    def test_it_bumps_token_version_and_clears_the_wallet(self):
        user = _user()
        row = SimpleNamespace(
            rodium_access_token_encrypted="a",
            rodium_refresh_token_encrypted=None,
            rodium_token_expires_at=1,
            rodium_wallet_json='{"balanceRodi": "5"}',
        )
        db = _db_returning(row)

        asyncio.run(auth_mod.logout(user=user, db=db))

        assert user.token_version == 1  # old JWT no longer matches -> rejected
        assert row.rodium_wallet_json is None
        assert row.rodium_access_token_encrypted is None
        assert db.commit.called

    def test_it_still_revokes_when_there_is_no_settings_row(self):
        user = _user()
        db = _db_returning(None)

        asyncio.run(auth_mod.logout(user=user, db=db))

        assert user.token_version == 1
        assert db.commit.called

    def test_http_jwt_issued_before_logout_is_rejected_after_commit(self):
        user = _user()
        user.access_blocked_at = None
        token = token_for_user(user)
        settings_row = SimpleNamespace(
            rodium_access_token_encrypted=None,
            rodium_refresh_token_encrypted=None,
            rodium_token_expires_at=None,
            rodium_wallet_json='{"balanceRodi": "5"}',
        )
        db = MagicMock()

        def get(model, key):
            if model is User and key == user.id:
                return user
            if model is UserSettings and key == user.id:
                return settings_row
            return None

        db.get.side_effect = get
        app = FastAPI()
        app.include_router(auth_mod.router)
        app.dependency_overrides[get_db] = lambda: db
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {token}"}

        logout_response = client.post("/auth/logout", headers=headers)
        replay_response = client.get("/auth/me", headers=headers)

        assert logout_response.status_code == 200
        assert db.commit.called
        assert user.token_version == 1
        assert replay_response.status_code == 401
