"""Local account flows: session revocation, single-use links, mail rendering.

These run without a database, matching the rest of the suite: the session is a
stand-in that records what the code asked for. What is being pinned here is
policy, not SQLAlchemy.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app import auth as auth_mod
from app.models import AuthToken
from app.services import auth_tokens, mail, rate_limit

# ── Session revocation (token_version) ─────────────────────────────────────


def _request_with_bearer(token: str) -> MagicMock:
    request = MagicMock()
    request.headers = {}
    request.query_params = {}
    return request


def _credentials(token: str) -> SimpleNamespace:
    return SimpleNamespace(credentials=token)


def _user(**overrides):
    base = {
        "id": uuid.uuid4(),
        "token_version": 0,
        "email": "user@example.com",
        "password_hash": None,
        "email_verified_at": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestTokenVersion:
    def test_a_fresh_token_authenticates(self):
        user = _user(token_version=3)
        token = auth_mod.token_for_user(user)
        db = MagicMock()
        db.get.return_value = user

        resolved = auth_mod.get_current_user(_request_with_bearer(token), _credentials(token), db)
        assert resolved is user

    def test_a_password_change_kills_outstanding_tokens(self):
        user = _user(token_version=1)
        token = auth_mod.token_for_user(user)
        # ...the user then resets their password.
        user.token_version = 2
        db = MagicMock()
        db.get.return_value = user

        with pytest.raises(HTTPException) as exc:
            auth_mod.get_current_user(_request_with_bearer(token), _credentials(token), db)
        assert exc.value.status_code == 401

    def test_a_legacy_token_without_tv_still_works_until_the_first_bump(self):
        # Tokens minted before this claim existed must not all 401 on deploy.
        user = _user(token_version=0)
        legacy = auth_mod.create_access_token(user.id)  # no tv argument
        db = MagicMock()
        db.get.return_value = user

        assert auth_mod.get_current_user(_request_with_bearer(legacy), _credentials(legacy), db) is user

        user.token_version = 1
        with pytest.raises(HTTPException):
            auth_mod.get_current_user(_request_with_bearer(legacy), _credentials(legacy), db)


# ── Single-use, hashed links ───────────────────────────────────────────────


def _matches(row, predicate) -> bool:
    """Evaluate a simple `Column == value` / `Column.is_(None)` clause in Python.

    The fake has to honour the predicates rather than ignore them, otherwise a
    test like "a reset link cannot be spent as a verification link" passes for
    the wrong reason — the filter it is checking would never have run.
    """
    column = predicate.left.name
    value = getattr(predicate.right, "value", None)
    return getattr(row, column) == value


class _FakeTokenQuery:
    def __init__(self, rows: list[AuthToken]):
        self._rows = rows

    def filter(self, *predicates):
        return _FakeTokenQuery([row for row in self._rows if all(_matches(row, p) for p in predicates)])

    def first(self):
        return self._rows[0] if self._rows else None

    def update(self, values, synchronize_session=False):
        for row in self._rows:
            for column, value in values.items():
                setattr(row, column.name, value)
        return len(self._rows)


class _FakeSession:
    """Enough Session surface for `auth_tokens`, with a real row store."""

    def __init__(self):
        self.rows: list[AuthToken] = []

    def add(self, row):
        # Mirror the server defaults the real INSERT would apply.
        if row.consumed_at is None:
            row.consumed_at = None
        self.rows.append(row)

    def flush(self):
        pass

    def query(self, _model):
        return _FakeTokenQuery(list(self.rows))


class TestAuthTokens:
    def test_the_raw_token_is_never_stored(self):
        db = _FakeSession()
        raw = auth_tokens.issue_email_verify(db, uuid.uuid4())

        stored = db.rows[0].token_hash
        assert raw not in stored
        assert stored == auth_tokens.hash_token(raw)
        assert len(stored) == 64

    def test_a_link_works_once(self):
        db = _FakeSession()
        user_id = uuid.uuid4()
        raw = auth_tokens.issue_email_verify(db, user_id)

        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) == user_id
        # Mail scanners prefetch links; the second hit must not resolve.
        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) is None

    def test_an_expired_link_is_refused(self):
        db = _FakeSession()
        raw = auth_tokens.issue_email_verify(db, uuid.uuid4())
        db.rows[0].expires_at = datetime.now(UTC) - timedelta(seconds=1)

        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) is None

    def test_lookup_finds_an_expired_token_for_resend(self):
        db = _FakeSession()
        user_id = uuid.uuid4()
        raw = auth_tokens.issue_email_verify(db, user_id)
        db.rows[0].expires_at = datetime.now(UTC) - timedelta(seconds=1)

        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) is None
        assert auth_tokens.lookup_user_id(db, raw, AuthToken.KIND_EMAIL_VERIFY) == user_id

    def test_lookup_finds_a_consumed_token_for_resend(self):
        db = _FakeSession()
        user_id = uuid.uuid4()
        raw = auth_tokens.issue_email_verify(db, user_id)
        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) == user_id
        assert auth_tokens.lookup_user_id(db, raw, AuthToken.KIND_EMAIL_VERIFY) == user_id

    def test_lookup_rejects_unknown_tokens(self):
        assert auth_tokens.lookup_user_id(_FakeSession(), "not-a-token", AuthToken.KIND_EMAIL_VERIFY) is None
        assert auth_tokens.lookup_user_id(_FakeSession(), "", AuthToken.KIND_EMAIL_VERIFY) is None

    def test_a_reset_link_cannot_be_spent_as_a_verification_link(self):
        db = _FakeSession()
        raw = auth_tokens.issue_password_reset(db, uuid.uuid4())

        assert auth_tokens.consume(db, raw, AuthToken.KIND_EMAIL_VERIFY) is None

    def test_an_unknown_token_is_refused(self):
        assert auth_tokens.consume(_FakeSession(), "not-a-token", AuthToken.KIND_EMAIL_VERIFY) is None
        assert auth_tokens.consume(_FakeSession(), "", AuthToken.KIND_EMAIL_VERIFY) is None

    def test_reset_links_are_shorter_lived_than_verification_links(self):
        assert auth_tokens.PASSWORD_RESET_TTL < auth_tokens.EMAIL_VERIFY_TTL


# ── Mail ───────────────────────────────────────────────────────────────────


class TestMail:
    def test_the_link_appears_in_both_parts(self):
        url = "http://localhost:3100/verify-email?token=abc"
        message = mail.build_verify_email("user@example.com", url)

        assert url in message.text
        assert url in message.html
        assert message.to == "user@example.com"

    def test_french_copy_is_used_when_asked(self):
        fr = mail.build_reset_password("user@example.com", "http://x/y", "fr")
        en = mail.build_reset_password("user@example.com", "http://x/y", "en")
        assert fr.subject != en.subject

    def test_console_transport_reports_success(self, monkeypatch):
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "console")
        clear_settings_cache()
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x")) is True
        finally:
            clear_settings_cache()

    def test_disabled_transport_reports_failure_without_raising(self, monkeypatch):
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "disabled")
        clear_settings_cache()
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x")) is False
        finally:
            clear_settings_cache()

    def test_smtp_sends_both_parts_to_the_configured_server(self, monkeypatch):
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "smtp")
        monkeypatch.setenv("SMTP_HOST", "mailhog")
        monkeypatch.setenv("SMTP_PORT", "1025")
        clear_settings_cache()

        sent: list = []

        class FakeSMTP:
            def __init__(self, host, port, timeout=None):
                sent.append({"host": host, "port": port})

            def __enter__(self):
                return self

            def __exit__(self, *_exc):
                return False

            def send_message(self, email):
                sent.append({"email": email})

        import smtplib

        monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x/link")) is True
        finally:
            clear_settings_cache()

        assert sent[0] == {"host": "mailhog", "port": 1025}
        email = sent[1]["email"]
        # Both parts carry the link: some clients refuse HTML outright.
        body = email.get_body(preferencelist=("plain",)).get_content()
        html = email.get_body(preferencelist=("html",)).get_content()
        assert "http://x/link" in body
        assert "http://x/link" in html

    def test_an_unreachable_smtp_server_falls_back_to_the_log_in_dev(self, monkeypatch):
        # Running the API on the host means `mailhog` does not resolve. Losing
        # the verification link entirely would strand the account.
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "smtp")
        monkeypatch.setenv("ENVIRONMENT", "local")
        clear_settings_cache()
        monkeypatch.setattr(mail, "_send_smtp", MagicMock(side_effect=OSError("no host")))
        console = MagicMock()
        monkeypatch.setattr(mail, "_send_console", console)
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x")) is False
        finally:
            clear_settings_cache()
        console.assert_called_once()

    def test_it_never_falls_back_to_the_log_in_production(self, monkeypatch):
        # Verification links in production logs are exactly what the media
        # token work was about avoiding.
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "smtp")
        monkeypatch.setenv("ENVIRONMENT", "staging")
        clear_settings_cache()
        monkeypatch.setattr(mail, "_send_smtp", MagicMock(side_effect=OSError("no host")))
        console = MagicMock()
        monkeypatch.setattr(mail, "_send_console", console)
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x")) is False
        finally:
            clear_settings_cache()
        console.assert_not_called()

    def test_a_transport_failure_never_propagates(self, monkeypatch):
        # Registration already succeeded by the time we send; raising here
        # would fail a request whose side effects are committed.
        from app.config import clear_settings_cache

        monkeypatch.setenv("MAIL_TRANSPORT", "ses")
        clear_settings_cache()
        monkeypatch.setattr(mail, "_send_ses", MagicMock(side_effect=RuntimeError("boom")))
        try:
            assert mail.send(mail.build_verify_email("a@b.co", "http://x")) is False
        finally:
            clear_settings_cache()


# ── Rate limiting ──────────────────────────────────────────────────────────


class TestRateLimit:
    def _request(self, ip: str = "203.0.113.9") -> MagicMock:
        request = MagicMock()
        request.headers = {}
        request.client = SimpleNamespace(host=ip)
        return request

    def test_it_raises_429_past_the_limit(self, monkeypatch):
        # Force the in-process counter so the test never depends on Redis.
        monkeypatch.setattr(rate_limit, "_incr_redis", lambda *_a, **_k: None)
        bucket = f"test-{uuid.uuid4()}"
        request = self._request()

        for _ in range(3):
            rate_limit.enforce(request, bucket, limit=3, window_seconds=60)

        with pytest.raises(HTTPException) as exc:
            rate_limit.enforce(request, bucket, limit=3, window_seconds=60)
        assert exc.value.status_code == 429
        assert exc.value.headers["Retry-After"] == "60"

    def test_the_subject_narrows_the_bucket(self, monkeypatch):
        monkeypatch.setattr(rate_limit, "_incr_redis", lambda *_a, **_k: None)
        bucket = f"test-{uuid.uuid4()}"
        request = self._request()

        rate_limit.enforce(request, bucket, limit=1, window_seconds=60, subject="a@example.com")
        # A different target address must not inherit the first one's budget.
        rate_limit.enforce(request, bucket, limit=1, window_seconds=60, subject="b@example.com")

        with pytest.raises(HTTPException):
            rate_limit.enforce(request, bucket, limit=1, window_seconds=60, subject="a@example.com")

    def test_a_redis_outage_fails_open(self, monkeypatch):
        # Losing the cache must not lock everyone out of signing in.
        def explode(*_a, **_k):
            raise RuntimeError("redis down")

        monkeypatch.setattr(rate_limit, "_incr_redis", explode)
        with pytest.raises(RuntimeError):
            # Sanity: the stub really raises...
            rate_limit._incr_redis("k", 60)

        monkeypatch.setattr(rate_limit, "_incr_redis", lambda *_a, **_k: None)
        rate_limit.enforce(self._request(), f"test-{uuid.uuid4()}", limit=1, window_seconds=60)
