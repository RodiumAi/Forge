"""Sign in with RodiumAi — Authorization Code + PKCE (server-side)."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt import InvalidTokenError

from app.config import get_settings

# Bound Nest round-trips so login cannot sit open until a proxy kills the socket
# (browser then shows opaque "Network request failed").
NEST_HTTP_TIMEOUT = httpx.Timeout(12.0, connect=5.0)

logger = logging.getLogger("rodium_oidc")

_STATE_NONCE_PREFIX = "forge:oauth:state:"
_STATE_NONCE_TTL_SEC = 600  # matches JWT exp window
_local_nonces: set[str] = set()
_local_nonce_lock = Lock()


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


def _consume_state_nonce(nonce: str) -> bool:
    """Mark nonce as used. Returns True on first use, False on replay.

    Staging/production require Redis so multi-worker replay cannot slip through
    an in-process fallback. Local/test keep the memory store when Redis is down.
    """
    key = f"{_STATE_NONCE_PREFIX}{nonce}"
    settings = get_settings()
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_url)
        # SET NX EX — first caller wins for the full state lifetime.
        ok = client.set(key, "1", nx=True, ex=_STATE_NONCE_TTL_SEC)
        return bool(ok)
    except Exception:
        if not settings.is_local:
            logger.exception("oauth state nonce: redis required outside local/test")
            raise RodiumOidcError("Sign-in temporarily unavailable") from None
        logger.debug("oauth state nonce: redis unavailable, using in-process store", exc_info=True)
        with _local_nonce_lock:
            if nonce in _local_nonces:
                return False
            _local_nonces.add(nonce)
            # Bound memory: drop oldest-ish by clearing when huge (nonces are short-lived).
            if len(_local_nonces) > 20_000:
                _local_nonces.clear()
                _local_nonces.add(nonce)
            return True


def create_oauth_state(code_verifier: str, binding: str | None = None) -> str:
    """Sign the state that travels to the issuer and back.

    The state carries the PKCE verifier, which is why it is signed rather than
    random. Claim ``n`` is a one-shot nonce consumed on callback (Redis SET NX),
    so the JWT cannot be replayed within its ten-minute window.

    `binding` closes login-CSRF: the browser mints a secret, keeps it in
    `sessionStorage`, and sends only its hash here; the callback must present
    the original. A state captured in transit is then useless to anyone else.

    The binding is required. Minting an unbound state left the guard opt-in, and
    the opt-out was the attack: a caller could ask for a state with no binding,
    complete the flow with its own account, and hand the pair to a victim whose
    browser had no secret to check against — signing the victim into the
    attacker's account. Every state now carries `b`.
    """
    settings = get_settings()
    if not binding:
        raise RodiumOidcError("Sign in with RodiumAi could not be secured to this browser")
    expire = datetime.now(UTC) + timedelta(minutes=10)
    payload: dict[str, object] = {
        "v": code_verifier,
        "exp": expire,
        "n": secrets.token_urlsafe(8),
        "b": binding,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def parse_oauth_state(state: str, binding: str | None = None) -> str:
    """Verify the state and return the PKCE verifier.

    Every state carries a browser binding; one that does not is refused rather
    than waved through (that allowance was the login-CSRF hole), and the caller
    must present the matching secret. The ``n`` nonce is single-use.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    except InvalidTokenError as exc:
        raise RodiumOidcError("Invalid or expired OAuth state") from exc
    verifier = payload.get("v")
    if not isinstance(verifier, str) or not verifier:
        raise RodiumOidcError("Invalid OAuth state payload")

    expected = payload.get("b")
    if not isinstance(expected, str) or not expected:
        raise RodiumOidcError("OAuth state is not bound to a browser")
    if not binding or not secrets.compare_digest(hash_state_binding(binding), expected):
        raise RodiumOidcError("OAuth state does not match this browser")

    nonce = payload.get("n")
    if not isinstance(nonce, str) or not nonce:
        raise RodiumOidcError("Invalid OAuth state payload")
    if not _consume_state_nonce(nonce):
        raise RodiumOidcError("OAuth state has already been used")

    return verifier

def build_authorize_url(
    *,
    state: str,
    code_challenge: str,
    prompt: str | None = None,
) -> str:
    settings = get_settings()
    if not settings.rodium_oidc_client_id or not settings.rodium_oidc_redirect_uri:
        raise RodiumOidcError("RodiumAi OAuth is not configured on the Forge API")
    params = {
        "response_type": "code",
        "client_id": settings.rodium_oidc_client_id,
        "redirect_uri": settings.rodium_oidc_redirect_uri,
        "scope": settings.rodium_oidc_scopes_effective,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    # Interactive prompts disable Nest's silent first-party approve so a leftover
    # RodiumAi cookie cannot bind the wrong Forge session.
    cleaned = (prompt or "").strip().lower()
    if cleaned and cleaned != "none":
        params["prompt"] = cleaned
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


async def create_api_key(access_token: str, *, name: str | None = None) -> dict[str, Any]:
    """Ask Nest to mint (or reuse) a key for a first-party OAuth client.

    Official Forge only — Nest refuses clients without `autoGenerateApiKey`.
    Returns key metadata without a plaintext secret.
    """
    settings = get_settings()
    payload: dict[str, Any] = {}
    if name and name.strip():
        payload["name"] = name.strip()
    async with httpx.AsyncClient(timeout=NEST_HTTP_TIMEOUT) as client:
        response = await client.post(
            settings.rodium_oidc_api_keys_url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise RodiumOidcError(
            f"RodiumAi create api-key error ({response.status_code}): {response.text[:400]}",
            response.status_code,
        )
    data = response.json()
    if not isinstance(data, dict) or not data.get("id"):
        raise RodiumOidcError("RodiumAi create api-key response missing id")
    return data


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
