"""OAuth callback slim path + Nest timeout bounds."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks

from app.routers import auth as auth_mod
from app.schemas import OAuthCallbackRequest
from app.services.rodium_oidc import NEST_HTTP_TIMEOUT


def test_nest_http_timeout_is_bounded() -> None:
    assert NEST_HTTP_TIMEOUT.connect == 5.0
    assert float(NEST_HTTP_TIMEOUT.read) == 12.0


class _FakeQuery:
    def __init__(self, result=None):
        self._result = result

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self._result


def test_callback_critical_path_skips_keys_and_wallet(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def fake_exchange(*, code: str, code_verifier: str):
        calls.append("exchange")
        assert code == "auth-code"
        assert code_verifier == "verifier"
        return {"access_token": "access-tok", "refresh_token": "refresh-tok", "expires_in": 3600}

    async def fake_userinfo(access_token: str):
        calls.append("userinfo")
        assert access_token == "access-tok"
        return {"sub": "rodium-sub-1", "email": "forge-user@example.com", "name": "Forge User"}

    async def fake_keys(access_token: str):
        calls.append("keys")
        return [{"id": "key-1", "name": "Default", "isActive": True}]

    async def fake_wallet(access_token: str):
        calls.append("wallet")
        return {"balanceRodi": "42"}

    monkeypatch.setattr(auth_mod, "parse_oauth_state", lambda _state, _binding=None: "verifier")
    monkeypatch.setattr(auth_mod, "exchange_code", fake_exchange)
    monkeypatch.setattr(auth_mod, "fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(auth_mod, "fetch_api_keys", fake_keys)
    monkeypatch.setattr(auth_mod, "fetch_wallet", fake_wallet)
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _user: "forge-jwt")
    monkeypatch.setattr(auth_mod, "_store_oauth_tokens", lambda _row, _tokens: None)

    user_id = uuid.uuid4()
    settings_row = MagicMock()
    settings_row.rodium_api_key_hint = None
    settings_row.rodium_api_keys_json = None
    settings_row.rodium_wallet_json = None

    def fake_add(obj):
        from app.models import User

        if isinstance(obj, User) and getattr(obj, "id", None) is None:
            obj.id = user_id

    def fake_get(model, key):
        from app.models import User, UserSettings

        if model is UserSettings:
            return settings_row
        if model is User:
            return None
        return None

    db = MagicMock()
    db.query.return_value = _FakeQuery(None)
    db.add.side_effect = fake_add
    db.get.side_effect = fake_get

    def fake_refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = user_id

    db.refresh.side_effect = fake_refresh

    background = BackgroundTasks()
    request = MagicMock()
    body = OAuthCallbackRequest(code="auth-code", state="oauth-state")

    async def run_callback():
        return await auth_mod.rodium_oauth_callback(
            body=body,
            request=request,
            background_tasks=background,
            db=db,
        )

    result = asyncio.run(run_callback())

    assert result.access_token == "forge-jwt"
    assert calls == ["exchange", "userinfo"]
    assert len(background.tasks) == 1

    hydrate_db = MagicMock()
    hydrate_user = MagicMock()
    hydrate_user.id = user_id

    def hydrate_get(model, key):
        from app.models import User

        if model is User:
            return hydrate_user
        return settings_row

    hydrate_db.get.side_effect = hydrate_get

    class _Ctx:
        def __enter__(self):
            return hydrate_db

        def __exit__(self, *_exc):
            return False

    monkeypatch.setattr(auth_mod, "SessionLocal", lambda: _Ctx())
    monkeypatch.setattr(auth_mod, "_get_or_create_settings", lambda _db, _user: settings_row)
    monkeypatch.setattr(auth_mod, "_ensure_default_generation_key", AsyncMock(return_value=True))

    asyncio.run(background())

    assert "keys" in calls
    assert "wallet" in calls
    assert settings_row.rodium_api_keys_json is not None
    assert settings_row.rodium_wallet_json is not None
