"""Fail-safe PostHog client for Forge API (Cloud EU)."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.models import User

logger = logging.getLogger(__name__)

FORGE_POSTHOG_APP = "forge"

_client: Any | None = None
_client_checked = False


def distinct_id_for_user(user: User) -> str:
    return user.rodium_sub or str(user.id)


def _get_client() -> Any | None:
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    settings = get_settings()
    if not settings.posthog_enabled or not settings.posthog_api_key:
        return None
    try:
        from posthog import Posthog

        _client = Posthog(
            settings.posthog_api_key,
            host=settings.posthog_host,
        )
    except Exception as exc:
        logger.warning("PostHog init failed: %s", exc)
        _client = None
    return _client


def capture_event(
    distinct_id: str,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    client = _get_client()
    if not client or not distinct_id:
        return
    settings = get_settings()
    payload = {
        "app": FORGE_POSTHOG_APP,
        "environment": settings.environment,
        **(properties or {}),
    }
    try:
        client.capture(distinct_id, event, payload)
    except Exception as exc:
        logger.warning("PostHog capture failed event=%s: %s", event, exc)


def capture_for_user(
    user: User,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    capture_event(distinct_id_for_user(user), event, properties)


@lru_cache
def shutdown_posthog() -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.shutdown()
    except Exception as exc:
        logger.warning("PostHog shutdown failed: %s", exc)
