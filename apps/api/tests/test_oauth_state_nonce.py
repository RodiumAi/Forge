"""OAuth state nonce is single-use (blocks 10-minute JWT replay)."""

from __future__ import annotations

import types

import pytest

from app.services import rodium_oidc


@pytest.fixture(autouse=True)
def _clear_local_nonces():
    with rodium_oidc._local_nonce_lock:
        rodium_oidc._local_nonces.clear()
    yield
    with rodium_oidc._local_nonce_lock:
        rodium_oidc._local_nonces.clear()


def test_oauth_state_nonce_rejects_replay(monkeypatch):
    # Force in-process store so the test does not depend on a live Valkey.
    monkeypatch.setattr(
        "redis.Redis.from_url",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("no redis")),
    )

    secret = "browser-secret"
    state = rodium_oidc.create_oauth_state(
        "pkce-verifier-xyz",
        rodium_oidc.hash_state_binding(secret),
    )
    assert rodium_oidc.parse_oauth_state(state, secret) == "pkce-verifier-xyz"
    with pytest.raises(rodium_oidc.RodiumOidcError, match="already been used"):
        rodium_oidc.parse_oauth_state(state, secret)


def test_oauth_state_still_requires_binding(monkeypatch):
    monkeypatch.setattr(
        "redis.Redis.from_url",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("no redis")),
    )
    secret = "browser-secret"
    state = rodium_oidc.create_oauth_state(
        "pkce-verifier-xyz",
        rodium_oidc.hash_state_binding(secret),
    )
    with pytest.raises(rodium_oidc.RodiumOidcError, match="does not match"):
        rodium_oidc.parse_oauth_state(state, "wrong-secret")


def test_oauth_state_nonce_requires_redis_outside_local(monkeypatch):
    monkeypatch.setattr(
        "redis.Redis.from_url",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("no redis")),
    )
    monkeypatch.setattr(
        rodium_oidc,
        "get_settings",
        lambda: types.SimpleNamespace(is_local=False, redis_url="redis://x"),
    )
    with pytest.raises(rodium_oidc.RodiumOidcError, match="temporarily unavailable"):
        rodium_oidc._consume_state_nonce("nonce-prod-guard")
