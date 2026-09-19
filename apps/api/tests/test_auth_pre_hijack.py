"""Pre-hijacking: registration password must not survive email verification."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.routers import auth as auth_mod
from app.schemas import LoginRequest, PasswordChangeRequest, VerifyEmailRequest


def _request() -> MagicMock:
    request = MagicMock()
    request.headers = {}
    request.client = SimpleNamespace(host="203.0.113.9")
    return request


class _FakeDb:
    def __init__(self, user):
        self.user = user
        self.committed = False

    def get(self, _model, key):
        return self.user if self.user.id == key else None

    def commit(self):
        self.committed = True

    def refresh(self, _row):
        return None


def test_verify_email_wipes_registration_password(monkeypatch):
    """Attacker registers with victim email; after victim verifies, attacker login fails."""
    user_id = uuid.uuid4()
    user = SimpleNamespace(
        id=user_id,
        email="victim@example.com",
        password_hash="attacker-hash",
        email_verified_at=None,
        token_version=0,
        name="Victim",
        avatar_url=None,
        rodium_sub=None,
    )
    db = _FakeDb(user)

    monkeypatch.setattr(auth_mod.rate_limit, "enforce", lambda *a, **k: None)
    monkeypatch.setattr(auth_mod.auth_tokens, "consume", lambda *_a, **_k: user_id)
    monkeypatch.setattr(auth_mod, "_ensure_rodium_tokens_after_login", AsyncMock())
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _u, **_k: "victim-jwt")

    result = asyncio.run(
        auth_mod.verify_email(
            body=VerifyEmailRequest(token="verify-token"),
            background_tasks=BackgroundTasks(),
            request=_request(),
            db=db,
        )
    )

    assert result.access_token == "victim-jwt"
    assert result.email_verified is True
    assert user.email_verified_at is not None
    assert user.password_hash is None
    assert user.token_version == 1


def test_verify_email_idempotent_second_click_keeps_password_cleared(monkeypatch):
    user_id = uuid.uuid4()
    user = SimpleNamespace(
        id=user_id,
        email="victim@example.com",
        password_hash=None,
        email_verified_at=datetime.now(UTC),
        token_version=1,
        name="Victim",
        avatar_url=None,
        rodium_sub=None,
    )
    db = _FakeDb(user)

    monkeypatch.setattr(auth_mod.rate_limit, "enforce", lambda *a, **k: None)
    monkeypatch.setattr(auth_mod.auth_tokens, "consume", lambda *_a, **_k: user_id)
    monkeypatch.setattr(auth_mod, "_ensure_rodium_tokens_after_login", AsyncMock())
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _u, **_k: "jwt")

    asyncio.run(
        auth_mod.verify_email(
            body=VerifyEmailRequest(token="verify-token"),
            background_tasks=BackgroundTasks(),
            request=_request(),
            db=db,
        )
    )

    assert user.password_hash is None
    assert user.token_version == 1


def test_change_password_sets_first_password_without_current(monkeypatch):
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="user@example.com",
        password_hash=None,
        token_version=0,
    )
    db = MagicMock()

    monkeypatch.setattr(auth_mod, "hash_password", lambda pw: f"hashed:{pw}")
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _u, **_k: "new-jwt")

    result = auth_mod.change_password(
        body=PasswordChangeRequest(current_password="", new_password="newpass12"),
        request=_request(),
        user=user,
        db=db,
    )

    assert result.access_token == "new-jwt"
    assert user.password_hash == "hashed:newpass12"
    assert user.token_version == 1


def test_login_rejects_wiped_password_after_verify(monkeypatch):
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="victim@example.com",
        password_hash=None,
        email_verified_at=datetime.now(UTC),
        token_version=1,
        access_blocked_at=None,
    )

    class _Q:
        def filter(self, *_a, **_k):
            return self

        def first(self):
            return user

    db = MagicMock()
    db.query.return_value = _Q()

    monkeypatch.setattr(auth_mod.rate_limit, "enforce", lambda *a, **k: None)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            auth_mod.login(
                body=LoginRequest(email="victim@example.com", password="attacker_pw_ok"),
                background_tasks=BackgroundTasks(),
                request=_request(),
                db=db,
            )
        )

    assert exc.value.status_code == 401
