"""id_token claims must be JWKS-verified — never accept an unsigned JWT."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.services import rodium_oidc as oidc


def _rsa_pair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key()
    return private, public


def _mint_id_token(*, private_key, issuer: str, audience: str, **extra) -> str:
    payload = {
        "sub": "user_1",
        "email": "a@b.c",
        "email_verified": True,
        "name": "Ada",
        "iss": issuer,
        "aud": audience,
        "exp": int(time.time()) + 120,
        "iat": int(time.time()),
        **extra,
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "test-kid"})


@pytest.fixture(autouse=True)
def _reset_jwks(monkeypatch):
    oidc._reset_jwks_client_for_tests()
    yield
    oidc._reset_jwks_client_for_tests()


def test_claims_from_id_token_accepts_jwks_verified_token(monkeypatch):
    private, public = _rsa_pair()
    settings = MagicMock()
    settings.rodium_oidc_client_id = "rd_oidc_forge"
    settings.rodium_oidc_issuer = "https://rsb.rodiumai.io"
    settings.rodium_oidc_internal_issuer = ""
    settings._rodium_oidc_server_base = "https://rsb.rodiumai.io"
    settings.rodium_oidc_jwks_url = "https://rsb.rodiumai.io/api/v1/oauth/jwks"
    monkeypatch.setattr(oidc, "get_settings", lambda: settings)

    signing_key = MagicMock()
    signing_key.key = public
    client = MagicMock()
    client.get_signing_key_from_jwt.return_value = signing_key
    monkeypatch.setattr(oidc, "_jwks_client_for_settings", lambda: client)

    token = _mint_id_token(
        private_key=private,
        issuer="https://rsb.rodiumai.io",
        audience="rd_oidc_forge",
    )
    claims = oidc.claims_from_id_token(token)
    assert claims == {
        "sub": "user_1",
        "email_verified": True,
        "email": "a@b.c",
        "name": "Ada",
    }


def test_claims_from_id_token_rejects_forged_unsigned_payload(monkeypatch):
    settings = MagicMock()
    settings.rodium_oidc_client_id = "rd_oidc_forge"
    settings.rodium_oidc_issuer = "https://rsb.rodiumai.io"
    settings.rodium_oidc_internal_issuer = ""
    settings._rodium_oidc_server_base = "https://rsb.rodiumai.io"
    settings.rodium_oidc_jwks_url = "https://rsb.rodiumai.io/api/v1/oauth/jwks"
    monkeypatch.setattr(oidc, "get_settings", lambda: settings)

    # Attacker-crafted HS256 token — JWKS lookup / RS256 verify must fail closed.
    forged = jwt.encode(
        {
            "sub": "attacker",
            "email": "evil@x.com",
            "email_verified": True,
            "iss": "https://rsb.rodiumai.io",
            "aud": "rd_oidc_forge",
            "exp": int(time.time()) + 120,
        },
        "not-a-nest-key",
        algorithm="HS256",
    )
    client = MagicMock()
    client.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("no matching key")
    monkeypatch.setattr(oidc, "_jwks_client_for_settings", lambda: client)

    assert oidc.claims_from_id_token(forged) is None


def test_claims_from_id_token_rejects_wrong_audience(monkeypatch):
    private, public = _rsa_pair()
    settings = MagicMock()
    settings.rodium_oidc_client_id = "rd_oidc_forge"
    settings.rodium_oidc_issuer = "https://rsb.rodiumai.io"
    settings.rodium_oidc_internal_issuer = ""
    settings._rodium_oidc_server_base = "https://rsb.rodiumai.io"
    monkeypatch.setattr(oidc, "get_settings", lambda: settings)

    signing_key = MagicMock()
    signing_key.key = public
    client = MagicMock()
    client.get_signing_key_from_jwt.return_value = signing_key
    monkeypatch.setattr(oidc, "_jwks_client_for_settings", lambda: client)

    token = _mint_id_token(
        private_key=private,
        issuer="https://rsb.rodiumai.io",
        audience="some-other-client",
    )
    assert oidc.claims_from_id_token(token) is None


def test_resolve_falls_back_to_userinfo_when_id_token_invalid(monkeypatch):
    async def fake_userinfo(access: str):
        assert access == "access-tok"
        return {"sub": "u", "email": "a@b.c", "email_verified": True}

    monkeypatch.setattr(oidc, "claims_from_id_token", lambda _t: None)
    monkeypatch.setattr(oidc, "fetch_userinfo", fake_userinfo)

    import asyncio

    info = asyncio.run(
        oidc.resolve_rodium_profile({"access_token": "access-tok", "id_token": "bad"})
    )
    assert info["sub"] == "u"
