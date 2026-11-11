"""Seed + constants for the model catalog (Gemini-first, gpt-image-2 for image tests)."""

from __future__ import annotations

import logging
import time
from threading import Lock

from sqlalchemy.orm import Session

from app.models import ModelCatalog

logger = logging.getLogger(__name__)

# Stable seed — no timestamps. Order is deterministic.
CATALOG_SEED: list[dict] = [
    {
        "slug": "google/gemini-3.1-flash-lite",
        "provider": "google",
        "tier": "lite",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 0.25,
        "price_out_per_m": 1.50,
        "supports_reasoning": False,
    },
    {
        "slug": "google/gemini-3.7-flash",
        "provider": "google",
        "tier": "primary",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 0.75,
        "price_out_per_m": 3.75,
        "supports_reasoning": True,
    },
    {
        "slug": "google/gemini-3.1-pro",
        "provider": "google",
        "tier": "escalation",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 2.0,
        "price_out_per_m": 12.0,
        "supports_reasoning": True,
    },
    {
        "slug": "anthropic/claude-sonnet-5-5",
        "provider": "anthropic",
        "tier": "escalation",
        "role": "text",
        "status": "active",
        "context_tokens": 1_000_000,
        "max_output_tokens": 128_000,
        "price_in_per_m": 2.0,
        "price_out_per_m": 10.0,
        "supports_reasoning": True,
    },
    {
        "slug": "anthropic/claude-sonnet-4-6",
        "provider": "anthropic",
        "tier": "escalation",
        "role": "text",
        "status": "active",
        "context_tokens": 200_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 3.0,
        "price_out_per_m": 15.0,
        "supports_reasoning": True,
    },
    {
        "slug": "openai/gpt-image-2",
        "provider": "openai",
        "tier": "primary",
        "role": "image",
        "status": "active",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
        "supports_reasoning": False,
    },
    {
        "slug": "google/gemini-3.1-flash-image",
        "provider": "google",
        "tier": "primary",
        "role": "image",
        "status": "standby",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
        "supports_reasoning": False,
    },
    {
        "slug": "google/gemini-3-pro-image",
        "provider": "google",
        "tier": "quality",
        "role": "image",
        "status": "standby",
        "context_tokens": 0,
        "max_output_tokens": 0,
        "price_in_per_m": None,
        "price_out_per_m": None,
        "supports_reasoning": False,
    },
    {
        "slug": "openai/gpt-5.6-terra",
        "provider": "openai",
        "tier": "standby",
        "role": "text",
        "status": "standby",
        "context_tokens": 1_000_000,
        "max_output_tokens": 64_000,
        "price_in_per_m": 2.0,
        "price_out_per_m": 12.0,
        "supports_reasoning": True,
    },
]

# Fallback only: the database catalogue (`model_catalog.role`) is the source of
# truth, so an image model an admin adds there is recognised without a deploy.
IMAGE_MODEL_SLUGS = frozenset(row["slug"] for row in CATALOG_SEED if row["role"] == "image")

_IMAGE_SLUGS_TTL_SECONDS = 60.0
_image_slugs_lock = Lock()
_image_slugs_at: float = 0.0
_image_slugs: frozenset[str] | None = None


def _load_image_slugs_from_db() -> frozenset[str]:
    """Every catalogue slug with the image role, whatever its status."""
    from app.db import SessionLocal

    with SessionLocal() as db:
        rows = db.query(ModelCatalog.slug).filter(ModelCatalog.role == "image").all()
    return frozenset(row[0] for row in rows)


def image_model_slugs() -> frozenset[str]:
    """Image slugs of the catalogue, cached for a minute.

    Falls back to the seed list when the database cannot be read (keeping the
    last good answer if there is one), or when the catalogue holds no image row
    yet (a fresh clone before the seed ran).
    """
    global _image_slugs_at, _image_slugs
    now = time.monotonic()
    with _image_slugs_lock:
        if _image_slugs is not None and now - _image_slugs_at < _IMAGE_SLUGS_TTL_SECONDS:
            return _image_slugs
        previous = _image_slugs
    try:
        slugs = _load_image_slugs_from_db() or IMAGE_MODEL_SLUGS
    except Exception:
        logger.warning("catalog: failed to load image models, using the seed list", exc_info=True)
        slugs = previous or IMAGE_MODEL_SLUGS
    with _image_slugs_lock:
        _image_slugs = slugs
        _image_slugs_at = now
    return slugs


def invalidate_image_model_cache() -> None:
    global _image_slugs_at, _image_slugs
    with _image_slugs_lock:
        _image_slugs_at = 0.0
        _image_slugs = None


# Same pattern for the `supports_reasoning` flag: the catalogue says which models
# take `reasoning_effort`, cached a minute. None means "unknown" (the database
# could not be read and nothing was cached yet): the caller then falls back to
# its built-in rule. An empty set is a real answer (no model is flagged).
_reasoning_slugs_lock = Lock()
_reasoning_slugs_at: float = 0.0
_reasoning_slugs: frozenset[str] | None = None


def _load_reasoning_slugs_from_db() -> frozenset[str]:
    """Every catalogue slug flagged `supports_reasoning`, whatever its status."""
    from app.db import SessionLocal

    with SessionLocal() as db:
        rows = db.query(ModelCatalog.slug).filter(ModelCatalog.supports_reasoning.is_(True)).all()
    return frozenset(row[0] for row in rows)


def reasoning_model_slugs() -> frozenset[str] | None:
    """Slugs flagged as taking a reasoning effort, cached for a minute.

    Returns the last good answer when a refresh fails, and None when the
    database has never been read successfully.
    """
    global _reasoning_slugs_at, _reasoning_slugs
    now = time.monotonic()
    with _reasoning_slugs_lock:
        if _reasoning_slugs is not None and now - _reasoning_slugs_at < _IMAGE_SLUGS_TTL_SECONDS:
            return _reasoning_slugs
        previous = _reasoning_slugs
    try:
        slugs: frozenset[str] | None = _load_reasoning_slugs_from_db()
    except Exception:
        logger.warning("catalog: failed to load reasoning models, using the built-in rule", exc_info=True)
        slugs = previous
    with _reasoning_slugs_lock:
        _reasoning_slugs = slugs
        _reasoning_slugs_at = now
    return slugs


def invalidate_reasoning_model_cache() -> None:
    global _reasoning_slugs_at, _reasoning_slugs
    with _reasoning_slugs_lock:
        _reasoning_slugs_at = 0.0
        _reasoning_slugs = None


def is_image_model(slug: str | None) -> bool:
    """An image-generation model: the chat endpoint cannot serve it."""
    from app.config import get_settings

    value = (slug or "").strip()
    if not value:
        return False
    return value in image_model_slugs() or value == get_settings().effective_default_image_model.strip()


def seed_model_catalog(db: Session) -> None:
    for row in CATALOG_SEED:
        existing = db.get(ModelCatalog, row["slug"])
        if existing is None:
            db.add(ModelCatalog(**row))
        else:
            for key, value in row.items():
                if key == "slug":
                    continue
                setattr(existing, key, value)
    db.commit()
    invalidate_image_model_cache()
    invalidate_reasoning_model_cache()
