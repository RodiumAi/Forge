"""Two credential boundaries that used to leak.

1. A session token in a query string. `<img src>` and iframes cannot set an
   Authorization header, so their credential lands in access logs. It used to
   be the 7-day session JWT — a full-API key sitting in log storage. Now only a
   read-only, one-hour, media-scoped token is accepted there, and the session
   token is refused outright.

2. The OAuth `state`. It carries the PKCE verifier, so anyone holding the
   string held the verifier, and nothing marked it consumed. It is now bound to
   a secret that never leaves the browser.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app import auth as auth_mod
from app.services.rodium_oidc import (
    RodiumOidcError,
    create_oauth_state,
    hash_state_binding,
    parse_oauth_state,
)


def _request(query: dict[str, str] | None = None) -> MagicMock:
    request = MagicMock()
    request.headers = {}
    request.query_params = query or {}
    return request


def _user(token_version: int = 0):
    return SimpleNamespace(
        id=uuid.uuid4(),
        token_version=token_version,
        email="ada@example.com",
        password_hash=None,
        email_verified_at=None,
    )


def _db(user) -> MagicMock:
    db = MagicMock()
    db.get.return_value = user
    return db


class TestSessionTokensAreHeaderOnly:
    def test_a_session_token_works_in_the_authorization_header(self):
        user = _user()
        token = auth_mod.token_for_user(user)

        resolved = auth_mod.get_current_user(_request(), SimpleNamespace(credentials=token), _db(user))
        assert resolved is user

    def test_a_session_token_in_the_query_string_is_refused(self):
        # The whole point: this used to authenticate, which is how a 7-day
        # credential ended up in access logs.
        user = _user()
        token = auth_mod.token_for_user(user)

        with pytest.raises(HTTPException) as exc:
            auth_mod.get_current_user(_request({"access_token": token}), None, _db(user))
        assert exc.value.status_code == 401

    def test_even_the_media_routes_refuse_a_session_token_in_the_query(self):
        user = _user()
        token = auth_mod.token_for_user(user)

        with pytest.raises(HTTPException) as exc:
            auth_mod.get_media_user(_request({"access_token": token}), None, _db(user))
        assert exc.value.status_code == 401


class TestMediaTokens:
    def test_a_media_token_works_on_a_media_route(self):
        user = _user()
        token = auth_mod.media_token_for_user(user)

        assert auth_mod.get_media_user(_request({"access_token": token}), None, _db(user)) is user

    def test_the_legacy_token_query_key_is_still_accepted(self):
        # The runner builds `?token=` for preview assets.
        user = _user()
        token = auth_mod.media_token_for_user(user)

        assert auth_mod.get_media_user(_request({"token": token}), None, _db(user)) is user

    def test_a_media_token_cannot_stand_in_for_a_session(self):
        # Otherwise a leaked log line would grant writes, not just reads.
        user = _user()
        token = auth_mod.media_token_for_user(user)

        with pytest.raises(HTTPException) as exc:
            auth_mod.get_current_user(_request(), SimpleNamespace(credentials=token), _db(user))
        assert exc.value.status_code == 401

    def test_a_media_token_is_revoked_by_a_password_change(self):
        user = _user(token_version=1)
        token = auth_mod.media_token_for_user(user)
        user.token_version = 2

        with pytest.raises(HTTPException):
            auth_mod.get_media_user(_request({"access_token": token}), None, _db(user))

    def test_it_is_far_shorter_lived_than_a_session(self):
        assert auth_mod.MEDIA_TOKEN_TTL_MINUTES <= 60


class TestOauthStateBinding:
    def test_a_bound_state_needs_its_secret(self):
        # The browser sends hash(secret) to /start, then the raw secret at callback.
        binding_hash = hash_state_binding("browser-secret")
        state = create_oauth_state("verifier", binding_hash)

        assert parse_oauth_state(state, "browser-secret") == "verifier"

    def test_a_captured_state_is_useless_without_the_secret(self):
        binding_hash = hash_state_binding("browser-secret")
        state = create_oauth_state("verifier", binding_hash)

        with pytest.raises(RodiumOidcError):
            parse_oauth_state(state, None)
        with pytest.raises(RodiumOidcError):
            parse_oauth_state(state, "wrong-secret")

    def test_the_secret_never_appears_in_the_state(self):
        binding_hash = hash_state_binding("browser-secret")
        state = create_oauth_state("verifier", binding_hash)
        assert "browser-secret" not in state

    def test_an_unbound_state_still_parses(self):
        state = create_oauth_state("verifier")
        assert parse_oauth_state(state, None) == "verifier"
        assert parse_oauth_state(state, "anything") == "verifier"

    def test_a_tampered_state_is_refused(self):
        binding_hash = hash_state_binding("browser-secret")
        state = create_oauth_state("verifier", binding_hash)
        with pytest.raises(RodiumOidcError):
            parse_oauth_state(state[:-2] + "xx", "browser-secret")
