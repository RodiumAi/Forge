"""Forge email preferences, stored by Nest on the RodiumAi user.

Forge has no copy of these switches. Every read and write goes to the Nest
internal route with the shared internal token, keyed by the RodiumAi user id
(``User.rodium_sub``), the same way team seats are synced.

The route may not be deployed yet, and some Forge accounts are not linked to a
RodiumAi account. Both cases come back as "not available" so the settings page
can say so instead of failing.
"""

from __future__ import annotations

import logging
from typing import Literal

import httpx

from app.config import get_settings
from app.models import User

logger = logging.getLogger(__name__)

PREFERENCE_KEYS: tuple[str, ...] = (
    "forgeBilling",
    "forgeCredits",
    "forgeTeam",
    "forgeProduct",
    "forgeProjects",
)

UnavailableReason = Literal["not_linked", "not_available", "unreachable"]

_PATH = "/api/v1/internal/forge/email-preferences"


class EmailPreferencesUnavailable(Exception):
    def __init__(self, reason: UnavailableReason) -> None:
        super().__init__(reason)
        self.reason = reason


def _endpoint() -> tuple[str, str]:
    settings = get_settings()
    base = settings._rodium_oidc_server_base.rstrip("/")
    token = settings.rodium_provision_token.strip()
    if not base or not token:
        raise EmailPreferencesUnavailable("not_available")
    return f"{base}{_PATH}", token


def _parse(response: httpx.Response) -> dict[str, bool]:
    if response.status_code == 404:
        # Unknown user on Nest, or the route is not deployed there yet.
        raise EmailPreferencesUnavailable("not_available")
    if response.status_code >= 400:
        logger.warning("email preferences call status=%s", response.status_code)
        raise EmailPreferencesUnavailable("unreachable")
    try:
        body = response.json()
    except ValueError:
        raise EmailPreferencesUnavailable("unreachable") from None
    if not isinstance(body, dict):
        raise EmailPreferencesUnavailable("unreachable")
    # A missing key means the default, which is on.
    return {key: body.get(key) is not False for key in PREFERENCE_KEYS}


def _rodium_user_id(user: User) -> str:
    user_id = (getattr(user, "rodium_sub", None) or "").strip()
    if not user_id:
        raise EmailPreferencesUnavailable("not_linked")
    return user_id


def read_preferences(user: User) -> dict[str, bool]:
    user_id = _rodium_user_id(user)
    url, token = _endpoint()
    try:
        response = httpx.get(
            url,
            params={"userId": user_id},
            headers={"X-Internal-Token": token},
            timeout=8.0,
        )
    except httpx.HTTPError:
        logger.warning("email preferences read failed")
        raise EmailPreferencesUnavailable("unreachable") from None
    return _parse(response)


def write_preferences(user: User, changes: dict[str, bool]) -> dict[str, bool]:
    user_id = _rodium_user_id(user)
    url, token = _endpoint()
    payload: dict[str, object] = {"userId": user_id}
    for key in PREFERENCE_KEYS:
        if key in changes:
            payload[key] = bool(changes[key])
    try:
        response = httpx.patch(
            url,
            json=payload,
            headers={"X-Internal-Token": token},
            timeout=8.0,
        )
    except httpx.HTTPError:
        logger.warning("email preferences write failed")
        raise EmailPreferencesUnavailable("unreachable") from None
    return _parse(response)
