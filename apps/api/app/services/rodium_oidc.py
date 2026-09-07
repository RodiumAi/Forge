"""Sign in with RodiumAi — Authorization Code + PKCE (server-side)."""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt

from app.config import get_settings

# Bound Nest round-trips so login cannot sit open until a proxy kills the socket
# (browser then shows opaque "Network request failed").
NEST_HTTP_TIMEOUT = httpx.Timeout(12.0, connect=5.0)


class RodiumOidcError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def generate_pkce() -> tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def hash_state_binding(binding: str) -> str:
    """sha256 of the browser's one-time binding secret."""
    return hashlib.sha256(binding.encode("utf-8")).hexdigest()


def create_oauth_state(code_verifier: str, binding: str | None = None) -> str:
    """Sign the state that travels to the issuer and back.

    The state carries the PKCE verifier, which is why it is signed rather than
    random. On its own that proves nothing about *who* started the flow: anyone
    holding the string holds the verifier, and nothing marked it used, so it was
    replayable for its full ten minutes.

    `binding` closes that. The browser mints a secret, keeps it in
    `sessionStorage`, and sends only its hash here; the callback must present
    the original. A state captured in transit is then useless to anyone else —
    the classic login-CSRF that `state` is supposed to prevent.

    Kept optional so a caller that predates the binding still works; the
    callback enforces it whenever the state carries one.
    """
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=10)
    payload: dict[str, object] = {
        "v": code_verifier,
        "exp": expire,
        "n": secrets.token_urlsafe(8),
    }
    if binding:
        payload["b"] = binding
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def parse_oauth_state(state: str, binding: str | None = None) -> str:
    """Verify the state and return the PKCE verifier.

    Refuses when the state was bound to a browser and the caller cannot
    produce the matching secret.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise RodiumOidcError("Invalid or expired OAuth state") from exc
    verifier = payload.get("v")
    if not isinstance(verifier, str) or not verifier:
        raise RodiumOidcError("Invalid OAuth state payload")

    expected = payload.get("b")
    bound = isinstance(expected, str) and bool(expected)
    if bound and (not binding or not secrets.compare_digest(hash_state_binding(binding), expected)):
        raise RodiumOidcError("OAuth state does not match this browser")
    return verifier


def build_authorize_url(*, state: str, code_challenge: str) -> str:
    settings = get_settings()
    if not settings.rodium_oidc_client_id or not settings.rodium_oidc_redirect_uri:
        raise RodiumOidcError("RodiumAi OAuth is not configured on the Forge API")
    params = {
        "response_type": "code",
        "client_id": settings.rodium_oidc_client_id,
        "redirect_uri": settings.rodium_oidc_redirect_uri,
        "scope": settings.rodium_oidc_scopes,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{settings.rodium_oidc_authorize_url}?{urlencode(params)}"


async def exchange_code(*, code: str, code_verifier: str) -> dict[str, Any]:
    settings = get_settings()
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.rodium_oidc_redirect_uri,
        "client_id": settings.rodium_oidc_client_id,
        "code_verifier": code_verifier,
    }
    if settings.rodium_oidc_client_secret:
        data["client_secret"] = settings.rodium_oidc_client_secret
    return await _token_request(data)


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    settings = get_settings()
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.rodium_oidc_client_id,
    }
    if settings.rodium_oidc_client_secret:
        data["client_secret"] = settings.rodium_oidc_client_secret
    return await _token_request(data)


async def _token_request(data: dict[str, str]) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=NEST_HTTP_TIMEOUT) as client:
        response = await client.post(
            settings.rodium_oidc_token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code >= 400:
        raise RodiumOidcError(
            f"RodiumAi token error ({response.status_code}): {response.text[:400]}",
            response.status_code,
        )
    payload = response.json()
    if not payload.get("access_token"):
        raise RodiumOidcError("RodiumAi token response missing access_token")
    return payload


async def fetch_userinfo(access_token: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=NEST_HTTP_TIMEOUT) as client:
        response = await client.get(
            settings.rodium_oidc_userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise RodiumOidcError(
            f"RodiumAi userinfo error ({response.status_code}): {response.text[:400]}",
            response.status_code,
        )
    data = response.json()
    if not data.get("sub"):
        raise RodiumOidcError("RodiumAi userinfo missing sub")
    return data


async def fetch_api_keys(access_token: str) -> list[dict[str, Any]]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=NEST_HTTP_TIMEOUT) as client:
        response = await client.get(
            settings.rodium_oidc_api_keys_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise RodiumOidcError(
            f"RodiumAi api-keys error ({response.status_code}): {response.text[:400]}",
            response.status_code,
        )
    data = response.json()
    items = data.get("items") if isinstance(data, dict) else data
    return items if isinstance(items, list) else []


async def fetch_wallet(access_token: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=NEST_HTTP_TIMEOUT) as client:
        response = await client.get(
            settings.rodium_oidc_wallet_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise RodiumOidcError(
            f"RodiumAi wallet error ({response.status_code}): {response.text[:400]}",
            response.status_code,
        )
    data = response.json()
    return data if isinstance(data, dict) else {}


async def revoke_token(token: str) -> None:
    """Best-effort revoke of a refresh (or access) token at the OIDC issuer."""
    settings = get_settings()
    if not settings.rodium_oidc_client_id or not token:
        return
    data = {
        "token": token,
        "client_id": settings.rodium_oidc_client_id,
    }
    if settings.rodium_oidc_client_secret:
        data["client_secret"] = settings.rodium_oidc_client_secret
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            await client.post(
                settings.rodium_oidc_revoke_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except Exception:
        # Logout must still succeed locally even if issuer is down.
        return
