"""Forge email preferences: proxied to the Nest internal route, never a 500."""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache
from app.routers import settings as settings_router
from app.services import email_preferences

ALL_ON = {
    "forgeBilling": True,
    "forgeCredits": True,
    "forgeTeam": True,
    "forgeProduct": True,
    "forgeProjects": True,
}


@pytest.fixture(autouse=True)
def nest_env(monkeypatch):
    monkeypatch.setenv("RODIUM_PROVISION_TOKEN", "internal-token-at-least-24-chars")
    monkeypatch.setenv("RODIUM_OIDC_ISSUER", "https://nest.example.test")
    monkeypatch.setenv("RODIUM_OIDC_INTERNAL_ISSUER", "http://nest.internal:3000")
    clear_settings_cache()
    yield
    clear_settings_cache()


def _client(user) -> TestClient:
    app = FastAPI()
    app.include_router(settings_router.router)
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def _response(status: int, body: object = None) -> httpx.Response:
    request = httpx.Request("GET", "http://nest.internal:3000/")
    return httpx.Response(status, json=body, request=request)


LINKED = SimpleNamespace(id="u1", rodium_sub="rodium-user-1")


class TestRead:
    def test_proxies_with_internal_token_and_user_id(self, monkeypatch):
        calls = []

        def fake_get(url, params=None, headers=None, timeout=None):
            calls.append((url, params, headers))
            return _response(200, {**ALL_ON, "forgeProduct": False})

        monkeypatch.setattr(email_preferences.httpx, "get", fake_get)
        res = _client(LINKED).get("/settings/email-preferences")
        assert res.status_code == 200
        body = res.json()
        assert body["available"] is True
        assert body["preferences"] == {
            "forge_billing": True,
            "forge_credits": True,
            "forge_team": True,
            "forge_product": False,
            "forge_projects": True,
        }
        url, params, headers = calls[0]
        assert url == "http://nest.internal:3000/api/v1/internal/forge/email-preferences"
        assert params == {"userId": "rodium-user-1"}
        assert headers == {"X-Internal-Token": "internal-token-at-least-24-chars"}

    def test_unlinked_account_is_not_available(self, monkeypatch):
        def boom(*_a, **_k):
            raise AssertionError("no call for an unlinked account")

        monkeypatch.setattr(email_preferences.httpx, "get", boom)
        res = _client(SimpleNamespace(id="u2", rodium_sub=None)).get(
            "/settings/email-preferences", headers={"Accept-Language": "en"}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["available"] is False
        assert body["reason"] == "not_linked"
        assert body["preferences"] is None
        assert "not available for this account yet" in body["message"]

    def test_nest_404_is_not_available(self, monkeypatch):
        monkeypatch.setattr(
            email_preferences.httpx, "get", lambda *a, **k: _response(404, {"message": "Not Found"})
        )
        res = _client(LINKED).get("/settings/email-preferences", headers={"Accept-Language": "en"})
        assert res.status_code == 200
        body = res.json()
        assert body == {
            "available": False,
            "reason": "not_available",
            "message": "Email preferences are not available for this account yet.",
            "preferences": None,
        }

    def test_network_error_is_not_a_500(self, monkeypatch):
        def fail(*_a, **_k):
            raise httpx.ConnectError("down")

        monkeypatch.setattr(email_preferences.httpx, "get", fail)
        res = _client(LINKED).get("/settings/email-preferences")
        assert res.status_code == 200
        assert res.json()["reason"] == "unreachable"

    def test_missing_token_is_not_available(self, monkeypatch):
        monkeypatch.setenv("RODIUM_PROVISION_TOKEN", "")
        clear_settings_cache()
        res = _client(LINKED).get("/settings/email-preferences")
        assert res.status_code == 200
        assert res.json()["reason"] == "not_available"


class TestWrite:
    def test_sends_only_changed_fields(self, monkeypatch):
        sent = []

        def fake_patch(url, json=None, headers=None, timeout=None):
            sent.append((url, json, headers))
            return _response(200, {**ALL_ON, "forgeTeam": False})

        monkeypatch.setattr(email_preferences.httpx, "patch", fake_patch)
        res = _client(LINKED).patch("/settings/email-preferences", json={"forge_team": False})
        assert res.status_code == 200
        assert res.json()["preferences"]["forge_team"] is False
        url, payload, headers = sent[0]
        assert url.endswith("/api/v1/internal/forge/email-preferences")
        assert payload == {"userId": "rodium-user-1", "forgeTeam": False}
        assert headers["X-Internal-Token"] == "internal-token-at-least-24-chars"

    def test_empty_body_is_rejected(self):
        res = _client(LINKED).patch("/settings/email-preferences", json={})
        assert res.status_code == 422

    def test_unknown_field_is_rejected(self):
        res = _client(LINKED).patch("/settings/email-preferences", json={"forge_spam": True})
        assert res.status_code == 422

    def test_unlinked_account_gets_409(self):
        res = _client(SimpleNamespace(id="u2", rodium_sub="")).patch(
            "/settings/email-preferences", json={"forge_billing": False}
        )
        assert res.status_code == 409

    def test_nest_404_gets_409(self, monkeypatch):
        monkeypatch.setattr(email_preferences.httpx, "patch", lambda *a, **k: _response(404))
        res = _client(LINKED).patch(
            "/settings/email-preferences",
            json={"forge_billing": False},
            headers={"Accept-Language": "en"},
        )
        assert res.status_code == 409
        assert res.json()["detail"] == "Email preferences are not available for this account yet."

    def test_nest_error_gets_503(self, monkeypatch):
        monkeypatch.setattr(email_preferences.httpx, "patch", lambda *a, **k: _response(500, {}))
        res = _client(LINKED).patch("/settings/email-preferences", json={"forge_billing": False})
        assert res.status_code == 503
