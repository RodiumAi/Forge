"""Platform-wide default LLM slugs (admin override over .env)."""

from __future__ import annotations

import logging
import time
from typing import Literal

from app.db import SessionLocal
from app.models import ForgePlatformSettings, ModelCatalog

logger = logging.getLogger(__name__)

PlatformModelKey = Literal["default_model", "default_image_model", "lite_model", "escalation_model"]

PLATFORM_MODEL_KEYS: tuple[PlatformModelKey, ...] = (
    "default_model",
    "default_image_model",
    "lite_model",
    "escalation_model",
)

_HARDCODED_FALLBACKS: dict[PlatformModelKey, str] = {
    "default_model": "google/gemini-3.7-flash",
    "default_image_model": "openai/gpt-image-2",
    "lite_model": "google/gemini-3.7-flash",
    "escalation_model": "anthropic/claude-sonnet-4-6",
}

_ROLE_BY_KEY: dict[PlatformModelKey, str] = {
    "default_model": "text",
    "lite_model": "text",
    "escalation_model": "text",
    "default_image_model": "image",
}

_CACHE_TTL_SECONDS = 30.0
_cache_at: float = 0.0
_cache_overrides: dict[PlatformModelKey, str | None] | None = None


def _catalog_allows(db, slug: str, *, role: str) -> bool:
    row = db.get(ModelCatalog, slug)
    return bool(row and row.status == "active" and row.role == role)


def _load_overrides_from_db() -> dict[PlatformModelKey, str | None]:
    result: dict[PlatformModelKey, str | None] = {key: None for key in PLATFORM_MODEL_KEYS}
    try:
        with SessionLocal() as db:
            row = db.get(ForgePlatformSettings, 1)
            if row is None:
                return result
            for key in PLATFORM_MODEL_KEYS:
                raw = (getattr(row, key) or "").strip()
                if not raw:
                    continue
                role = _ROLE_BY_KEY[key]
                if _catalog_allows(db, raw, role=role):
                    result[key] = raw
                else:
                    logger.warning(
                        "platform_settings: ignoring %s=%r (missing or inactive in model_catalog)",
                        key,
                        raw,
                    )
    except Exception:
        logger.warning("platform_settings: failed to load DB overrides", exc_info=True)
    return result


def get_platform_overrides() -> dict[PlatformModelKey, str | None]:
    """Cached DB overrides validated against model_catalog."""
    global _cache_at, _cache_overrides
    now = time.monotonic()
    if _cache_overrides is not None and now - _cache_at < _CACHE_TTL_SECONDS:
        return dict(_cache_overrides)
    _cache_overrides = _load_overrides_from_db()
    _cache_at = now
    return dict(_cache_overrides)


def invalidate_platform_settings_cache() -> None:
    global _cache_at, _cache_overrides
    _cache_at = 0.0
    _cache_overrides = None


def effective_model(key: PlatformModelKey, env_fallback: str) -> str:
    """DB override when set and valid, else env/code fallback."""
    override = get_platform_overrides().get(key)
    if override:
        return override
    cleaned = (env_fallback or "").strip()
    if cleaned:
        return cleaned
    return _HARDCODED_FALLBACKS[key]
