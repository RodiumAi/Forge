"""Create the RodiumAi account behind a native Forge account.

Someone who signs up here should not have to sign up a second time before they
can generate anything. So once their address is proven, we ask the platform to
create the matching account and hand back OAuth tokens for it.

Tokens, not an API key: they make the provisioned account indistinguishable
from one linked through the consent screen. The key picker, the wallet balance
and the refresh button in Settings all run on `_ensure_rodium_access_token`,
which needs exactly this. It also means no long-lived plaintext secret ends up
in our database — the generation key is minted on the platform side at the
first `GET /oauth/api-keys` and never leaves it.

**Disabled by default.** With `RODIUM_PROVISION_TOKEN` empty — the state of any
clone — every call here is a no-op and Forge only ever creates local accounts.
Failures are swallowed for the same reason mail failures are: the account the
caller just created is real and usable, and taking the request down because a
sibling service was briefly unreachable would be a worse outcome than the
account simply not being linked yet.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger("rodium_provisioning")

#: Generous: this runs inside the verify-email request, and a failure here
#: costs the user their auto-linked account, so it is worth waiting for.
PROVISION_TIMEOUT = httpx.Timeout(12.0, connect=5.0)


@dataclass(frozen=True)
class ProvisionResult:
    user_id: str
    tokens: dict


class ProvisionConflict(Exception):
    """The address already has a RodiumAi account.

    Not an error state — it means the user should link the existing account
    through "Continue with RodiumAi" instead, which is the only flow that
    proves they own it.
    """


def enabled() -> bool:
    return get_settings().provisioning_enabled


async def provision(
    *,
    email: str,
    full_name: str | None,
    avatar_url: str | None = None,
) -> ProvisionResult | None:
    """Provision an account, or return None when it is not possible.

    `None` covers both "provisioning is switched off" and "the platform did not
    answer" — the caller treats them the same way, because in both cases the
    Forge account exists and is simply not linked yet.

    Raises `ProvisionConflict` only for a `409`, which the caller surfaces so
    the user can link their existing account instead.
    """
    settings = get_settings()
    if not settings.provisioning_enabled:
        return None

    payload = {
        "email": email,
        "fullName": full_name,
        # The caller is responsible for only reaching here once the address is
        # proven; the platform refuses anything else.
        "emailVerified": True,
        "avatarUrl": avatar_url,
        "clientId": settings.rodium_oidc_client_id,
        "source": "forge",
    }

    try:
        async with httpx.AsyncClient(timeout=PROVISION_TIMEOUT) as client:
            response = await client.post(
                settings.rodium_provisioning_url,
                json={k: v for k, v in payload.items() if v is not None},
                headers={"X-Internal-Token": settings.rodium_provision_token},
            )
    except httpx.HTTPError:
        logger.warning("rodium.provision.unreachable", exc_info=True)
        return None

    if response.status_code == 409:
        raise ProvisionConflict()

    if response.status_code >= 400:
        logger.warning(
            "rodium.provision.rejected status=%s body=%s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        data = response.json()
        user_id = str(data["userId"])
        tokens = {
            "access_token": data["accessToken"],
            "refresh_token": data["refreshToken"],
            "expires_in": data.get("expiresIn"),
        }
    except (ValueError, KeyError):
        logger.warning("rodium.provision.malformed_response", exc_info=True)
        return None

    return ProvisionResult(user_id=user_id, tokens=tokens)


async def reissue_tokens(
    *,
    email: str,
    user_id: str,
) -> ProvisionResult | None:
    """Re-mint OAuth tokens for an account Forge already linked.

    Used after logout cleared refresh tokens: Google/email sign-in proves the
    address again, and we pass the stored `rodium_sub` so Nest refuses a
    mismatch.
    """
    settings = get_settings()
    if not settings.provisioning_enabled or not settings.rodium_oidc_client_id:
        return None

    url = settings.rodium_provisioning_url.rstrip("/")
    url = (
        f"{url}/reissue-tokens"
        if url.endswith("/users")
        else f"{url}/users/reissue-tokens"
    )

    payload = {
        "email": email,
        "emailVerified": True,
        "userId": user_id,
        "clientId": settings.rodium_oidc_client_id,
        "source": "forge",
    }

    try:
        async with httpx.AsyncClient(timeout=PROVISION_TIMEOUT) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"X-Internal-Token": settings.rodium_provision_token},
            )
    except httpx.HTTPError:
        logger.warning("rodium.reissue.unreachable", exc_info=True)
        return None

    if response.status_code >= 400:
        logger.warning(
            "rodium.reissue.rejected status=%s body=%s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        data = response.json()
        uid = str(data["userId"])
        tokens = {
            "access_token": data["accessToken"],
            "refresh_token": data["refreshToken"],
            "expires_in": data.get("expiresIn"),
        }
    except (ValueError, KeyError):
        logger.warning("rodium.reissue.malformed_response", exc_info=True)
        return None

    return ProvisionResult(user_id=uid, tokens=tokens)
