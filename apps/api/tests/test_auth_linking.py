"""Account-linking policy — the rule the whole auth surface hangs on.

An account may only be adopted by an identity proving the same address when
that address is already verified on our side. Without it, registering locally
with someone else's address (which is allowed, and deliberately does not block
sign-in) would let an attacker inherit that person's account the moment they
sign in with Google or open Forge from their RodiumAi dashboard.

Both linking paths are covered here: the RodiumAi OIDC callback and the
Firebase (Google/GitHub) endpoint.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.models import OauthAccount, User, UserSettings
from app.routers import auth as auth_mod
from app.schemas import OAuthCallbackRequest, OAuthFirebaseRequest
from app.services import firebase_auth


def _make_user(email: str, *, verified: bool, rodium_sub: str | None = None) -> User:
    user = User(
        email=email,
        password_hash="hashed" if not rodium_sub else None,
        rodium_sub=rodium_sub,
        email_verified_at=datetime.now(UTC) if verified else None,
    )
    user.id = uuid.uuid4()
    user.token_version = 0
    return user


class _FakeDb:
    """Routes `query(User)` / `query(OauthAccount)` at in-memory lists."""

    def __init__(self, users: list[User] | None = None, links: list[OauthAccount] | None = None):
        self.users = users or []
        self.links = links or []
        self.added: list = []
        self.committed = False

    # -- Session surface ---------------------------------------------------
    def query(self, model):
        if model is User:
            return _UserQuery(self.users)
        if model is OauthAccount:
            return _LinkQuery(self.links)
        return _UserQuery([])

    def get(self, model, key):
        if model is User:
            return next((u for u in self.users if u.id == key), None)
        if model is UserSettings:
            row = MagicMock()
            row.rodium_api_key_hint = None
            return row
        return None

    def add(self, row):
        self.added.append(row)
        if isinstance(row, User):
            if getattr(row, "id", None) is None:
                row.id = uuid.uuid4()
            if getattr(row, "token_version", None) is None:
                row.token_version = 0
            self.users.append(row)
        elif isinstance(row, OauthAccount):
            self.links.append(row)

    def flush(self):
        for row in self.added:
            if isinstance(row, User) and getattr(row, "id", None) is None:
                row.id = uuid.uuid4()

    def commit(self):
        self.committed = True

    def refresh(self, row):
        if getattr(row, "token_version", None) is None:
            row.token_version = 0


class _UserQuery:
    def __init__(self, users: list[User]):
        self.users = users
        self._email: str | None = None
        self._sub: str | None = None

    def filter(self, *predicates):
        for predicate in predicates:
            column = predicate.left.name
            value = getattr(predicate.right, "value", None)
            if column == "email":
                self._email = value
            elif column == "rodium_sub":
                self._sub = value
        return self

    def first(self):
        for user in self.users:
            if self._email is not None and user.email == self._email:
                return user
            if self._sub is not None and user.rodium_sub == self._sub:
                return user
        return None


class _LinkQuery:
    def __init__(self, links: list[OauthAccount]):
        self.links = links
        self._provider: str | None = None
        self._account: str | None = None

    def filter(self, *predicates):
        for predicate in predicates:
            column = predicate.left.name
            value = getattr(predicate.right, "value", None)
            if column == "provider":
                self._provider = value
            elif column == "provider_account_id":
                self._account = value
        return self

    def first(self):
        return next(
            (
                link
                for link in self.links
                if link.provider == self._provider and link.provider_account_id == self._account
            ),
            None,
        )


def _request() -> MagicMock:
    request = MagicMock()
    request.headers = {}
    request.client = SimpleNamespace(host="203.0.113.9")
    return request


# ── RodiumAi OIDC callback ─────────────────────────────────────────────────


def _run_callback(db, monkeypatch, email: str = "victim@example.com", sub: str = "rodium-sub-1"):
    async def fake_exchange(*, code: str, code_verifier: str):
        return {"access_token": "access-tok", "refresh_token": "r", "expires_in": 3600}

    async def fake_userinfo(access_token: str):
        return {"sub": sub, "email": email, "name": "Real Owner"}

    monkeypatch.setattr(auth_mod, "parse_oauth_state", lambda _s, _b=None: "verifier")
    monkeypatch.setattr(auth_mod, "exchange_code", fake_exchange)
    monkeypatch.setattr(auth_mod, "fetch_userinfo", fake_userinfo)
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _u: "forge-jwt")
    monkeypatch.setattr(auth_mod, "_store_oauth_tokens", lambda _r, _t: None)
    monkeypatch.setattr(auth_mod, "_get_or_create_settings", lambda _d, _u: db.get(UserSettings, None))

    return asyncio.run(
        auth_mod.rodium_oauth_callback(
            body=OAuthCallbackRequest(code="c", state="s"),
            request=_request(),
            background_tasks=BackgroundTasks(),
            db=db,
        )
    )


class TestRodiumCallbackLinking:
    def test_it_refuses_to_adopt_an_unverified_local_account(self, monkeypatch):
        # The attack: someone registered locally with the victim's address and
        # never verified it. The victim then opens Forge from their dashboard.
        squatter = _make_user("victim@example.com", verified=False)
        db = _FakeDb(users=[squatter])

        with pytest.raises(HTTPException) as exc:
            _run_callback(db, monkeypatch)

        assert exc.value.status_code == 409
        assert squatter.rodium_sub is None  # identity NOT handed over

    def test_it_adopts_a_verified_local_account(self, monkeypatch):
        owner = _make_user("victim@example.com", verified=True)
        db = _FakeDb(users=[owner])

        result = _run_callback(db, monkeypatch)

        assert result.access_token == "forge-jwt"
        assert owner.rodium_sub == "rodium-sub-1"
        assert len(db.users) == 1  # adopted, not duplicated

    def test_it_creates_a_verified_account_when_nothing_matches(self, monkeypatch):
        db = _FakeDb()

        result = _run_callback(db, monkeypatch)

        assert result.access_token == "forge-jwt"
        created = db.users[0]
        assert created.rodium_sub == "rodium-sub-1"
        # Coming through the issuer proves the address.
        assert created.email_verified_at is not None

    def test_an_already_linked_account_matches_on_sub_not_email(self, monkeypatch):
        linked = _make_user("old@example.com", verified=True, rodium_sub="rodium-sub-1")
        db = _FakeDb(users=[linked])

        _run_callback(db, monkeypatch, email="new@example.com")

        assert len(db.users) == 1
        assert linked.email == "new@example.com"  # address change follows the issuer


# ── Firebase (Google / GitHub) ─────────────────────────────────────────────


def _identity(email: str = "victim@example.com", *, verified: bool = True, uid: str = "uid-1"):
    return firebase_auth.FederatedIdentity(
        provider="google",
        provider_account_id=uid,
        email=email,
        email_verified=verified,
        name="Real Owner",
        picture=None,
    )


def _run_firebase(db, monkeypatch, identity=None):
    monkeypatch.setattr(firebase_auth, "enabled", lambda: True)
    monkeypatch.setattr(firebase_auth, "verify_id_token", lambda _t: identity or _identity())
    monkeypatch.setattr(auth_mod, "token_for_user", lambda _u: "forge-jwt")
    # Provisioning has its own tests; here it must not reach the network.
    monkeypatch.setattr(auth_mod.rodium_provisioning, "enabled", lambda: False)

    return asyncio.run(
        auth_mod.oauth_firebase(
            body=OAuthFirebaseRequest(id_token="x" * 32),
            background_tasks=BackgroundTasks(),
            request=_request(),
            db=db,
        )
    )


class TestFirebaseLinking:
    def test_it_refuses_to_adopt_an_unverified_local_account(self, monkeypatch):
        squatter = _make_user("victim@example.com", verified=False)
        db = _FakeDb(users=[squatter])

        with pytest.raises(HTTPException) as exc:
            _run_firebase(db, monkeypatch)

        assert exc.value.status_code == 409
        assert db.links == []

    def test_it_refuses_when_the_provider_did_not_verify_the_address(self, monkeypatch):
        owner = _make_user("victim@example.com", verified=True)
        db = _FakeDb(users=[owner])

        with pytest.raises(HTTPException) as exc:
            _run_firebase(db, monkeypatch, identity=_identity(verified=False))

        assert exc.value.status_code == 409

    def test_it_adopts_a_verified_local_account_and_records_the_link(self, monkeypatch):
        owner = _make_user("victim@example.com", verified=True)
        db = _FakeDb(users=[owner])

        result = _run_firebase(db, monkeypatch)

        assert result.access_token == "forge-jwt"
        assert len(db.users) == 1
        assert db.links[0].user_id == owner.id
        assert db.links[0].provider == "google"

    def test_a_second_sign_in_matches_the_link_not_the_email(self, monkeypatch):
        owner = _make_user("victim@example.com", verified=True)
        link = OauthAccount(user_id=owner.id, provider="google", provider_account_id="uid-1")
        db = _FakeDb(users=[owner], links=[link])

        _run_firebase(db, monkeypatch, identity=_identity(email="changed@example.com"))

        # No new user, no second link — even though the address moved.
        assert len(db.users) == 1
        assert len(db.links) == 1

    def test_it_creates_a_verified_account_when_nothing_matches(self, monkeypatch):
        db = _FakeDb()

        result = _run_firebase(db, monkeypatch)

        assert result.email_verified is True
        created = db.users[0]
        assert created.password_hash is None
        assert created.email_verified_at is not None

    def test_it_reports_503_when_firebase_is_not_configured(self, monkeypatch):
        monkeypatch.setattr(firebase_auth, "enabled", lambda: False)

        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                auth_mod.oauth_firebase(
                    body=OAuthFirebaseRequest(id_token="x" * 32),
                    background_tasks=BackgroundTasks(),
                    request=_request(),
                    db=_FakeDb(),
                )
            )

        assert exc.value.status_code == 503


class TestFirebaseIdentityMapping:
    def test_only_google_and_github_are_accepted(self):
        assert firebase_auth._map_provider("google.com") == "google"
        assert firebase_auth._map_provider("github.com") == "github"
        with pytest.raises(firebase_auth.FirebaseAuthError):
            firebase_auth._map_provider("facebook.com")
        with pytest.raises(firebase_auth.FirebaseAuthError):
            firebase_auth._map_provider(None)

    def test_missing_firebase_admin_package_reports_not_configured(self, monkeypatch):
        """Prod image once shipped without the dep — must be 503, never 500."""
        firebase_auth._app = None

        class _Settings:
            firebase_enabled = True
            firebase_project_id = "rodiumai"
            firebase_client_email = "sa@rodiumai.iam.gserviceaccount.com"
            firebase_private_key_pem = "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n"

        monkeypatch.setattr(firebase_auth, "get_settings", lambda: _Settings())

        import builtins

        real_import = builtins.__import__

        def _blocked(name, globals=None, locals=None, fromlist=(), level=0):  # noqa: A002
            if name == "firebase_admin" or name.startswith("firebase_admin."):
                raise ImportError("firebase_admin missing")
            return real_import(name, globals, locals, fromlist, level)

        monkeypatch.setattr(builtins, "__import__", _blocked)

        with pytest.raises(firebase_auth.FirebaseAuthError, match="firebase_not_configured"):
            firebase_auth._get_app()


class TestVerificationGate:
    """No confirmed address, no session — on every path that issues one.

    An unconfirmed account has no RodiumAi account behind it, so no wallet and
    no generation key. Letting one into the builder shows an empty product,
    which is what this rule prevents.
    """

    def test_a_social_account_with_an_unverified_address_gets_no_session(self, monkeypatch):
        # GitHub accounts with a hidden address land here.
        db = _FakeDb()
        sent: list = []
        monkeypatch.setattr(auth_mod, "_send_verification_email", lambda *a, **k: sent.append(a))

        with pytest.raises(HTTPException) as exc:
            _run_firebase(db, monkeypatch, identity=_identity(verified=False))

        assert exc.value.status_code == 403
        # ...but a link goes out, so they are not stuck.
        assert len(sent) == 1

    def test_a_verified_social_account_still_gets_one(self, monkeypatch):
        result = _run_firebase(_FakeDb(), monkeypatch)
        assert result.access_token == "forge-jwt"
        assert result.email_verified is True
