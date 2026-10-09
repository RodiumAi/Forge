"""Dashboard → Forge one-click sign-in (session handoff)."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.routers import auth as auth_mod
from app.schemas import RodiumHandoffRequest
from app.services import rodium_oidc
from app.services.rodium_oidc import SESSION_HANDOFF_GRANT, RodiumOidcError

BINDING = "a" * 64
CODE = "c" * 43


class _FakeQuery:
    def __init__(self, result=None):
        self._result = result

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self._result


def _fake_db(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    user_id = uuid.uuid4()
    settings_row = MagicMock()
    settings_row.rodium_api_key_hint = None

    def fake_add(obj):
        from app.models import User

        if isinstance(obj, User) and getattr(obj, "id", None) is None:
            obj.id = user_id

    def fake_get(model, _key):
        from app.models import UserSettings

        return settings_row if model is UserSettings else None

    db = MagicMock()
    db.query.return_value = _FakeQuery(None)
    db.add.side_effect = fake_add
    db.get.side_effect = fake_get
    db.refresh.side_effect = lambda obj: setattr(obj, "id", getattr(obj, "id", None) or user_id)
    monkeypatch.setattr(auth_mod, "SessionLocal", lambda: db)
    return db


def test_handoff_signs_in_with_the_regular_path(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, str] = {}

    async def fake_exchange(code: str, binding: str):
        seen["code"], seen["binding"] = code, binding
        return {"access_token": "access-tok", "refresh_token": "refresh-tok"}

    async def fake_resolve(tokens: dict):
        assert tokens["access_token"] == "access-tok"
        return {"sub": "rodium-sub-1", "email": "ada@example.com", "email_verified": True}

    monkeypatch.setattr(auth_mod, "handoff_configured", lambda: True)
    monkeypatch.setattr(auth_mod, "exchange_handoff_code", fake_exchange)
    monkeypatch.setattr(auth_mod, "resolve_rodium_profile", fake_resolve)
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _user, **_kw: "forge-jwt")
    monkeypatch.setattr(auth_mod, "_store_oauth_tokens", lambda _row, _tokens: None)
    _fake_db(monkeypatch)

    result = asyncio.run(
        auth_mod.rodium_session_handoff(
            body=RodiumHandoffRequest(code=CODE, binding=BINDING),
            request=MagicMock(),
            background_tasks=BackgroundTasks(),
        )
    )

    assert result.access_token == "forge-jwt"
    assert seen == {"code": CODE, "binding": BINDING}


def test_rejected_code_is_a_generic_400(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_exchange(_code: str, _binding: str):
        raise RodiumOidcError("RodiumAi token error (400): invalid_grant", 400)

    monkeypatch.setattr(auth_mod, "handoff_configured", lambda: True)
    monkeypatch.setattr(auth_mod, "exchange_handoff_code", fake_exchange)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            auth_mod.rodium_session_handoff(
                body=RodiumHandoffRequest(code=CODE, binding=BINDING),
                request=MagicMock(),
                background_tasks=BackgroundTasks(),
            )
        )
    assert exc.value.status_code == 400
    # The issuer's raw error never reaches the browser.
    assert "invalid_grant" not in str(exc.value.detail)


def test_handoff_unavailable_without_client_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_mod, "handoff_configured", lambda: False)
    app = FastAPI()
    app.include_router(auth_mod.router)

    response = TestClient(app).post("/auth/rodium/handoff", json={"code": CODE, "binding": BINDING})

    assert response.status_code == 503


@pytest.mark.parametrize("binding", ["", "short", "A" * 64, "g" * 64])
def test_handoff_requires_a_well_formed_binding(binding: str) -> None:
    app = FastAPI()
    app.include_router(auth_mod.router)

    response = TestClient(app).post("/auth/rodium/handoff", json={"code": CODE, "binding": binding})

    assert response.status_code == 422


def test_exchange_sends_the_handoff_grant_with_client_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = MagicMock()
    settings.rodium_oidc_client_id = "forge-client"
    settings.rodium_oidc_client_secret = "forge-secret"
    settings.rodium_oidc_scopes = "openid profile email"
    monkeypatch.setattr(rodium_oidc, "get_settings", lambda: settings)
    sent: dict = {}

    async def fake_token_request(data: dict):
        sent.update(data)
        return {"access_token": "a"}

    monkeypatch.setattr(rodium_oidc, "_token_request", fake_token_request)

    asyncio.run(rodium_oidc.exchange_handoff_code(CODE, BINDING))

    assert sent == {
        "grant_type": SESSION_HANDOFF_GRANT,
        "code": CODE,
        "code_verifier": BINDING,
        "client_id": "forge-client",
        "client_secret": "forge-secret",
        "scope": "openid profile email",
    }


def test_exchange_refuses_without_client_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = MagicMock()
    settings.rodium_oidc_client_id = "forge-client"
    settings.rodium_oidc_client_secret = ""
    monkeypatch.setattr(rodium_oidc, "get_settings", lambda: settings)

    with pytest.raises(RodiumOidcError):
        asyncio.run(rodium_oidc.exchange_handoff_code(CODE, BINDING))
