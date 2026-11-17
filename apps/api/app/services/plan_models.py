"""Per-plan model defaults.

An admin can give each Forge plan its own defaults for the four model roles
(main, escalation, lite, image). They arrive in the plan entitlements as::

    "default_models": {
        "default_model": "google/gemini-3.7-flash",
        "escalation_model": "anthropic/claude-sonnet-5-5",
        "lite_model": "google/gemini-3.7-flash",
        "default_image_model": "openai/gpt-image-2"
    }

Every key is optional. A missing, empty, unknown, inactive or wrong-role slug,
or a text model whose tier the plan does not allow, falls back to the global
default (admin Default models page, then .env, then code).

Precedence for the model that answers a request:

1. the user's own pick, only on a plan with ``model_selection`` and only when
   its tier is allowed (``chats._route_for_request`` / ``_apply_tier_entitlements``);
2. the plan default for that role (this module);
3. the global default (``platform_settings.effective_model``).

The resolved set is bound to the current request with ``bind_plan_models``
(a FastAPI dependency) and read by ``Settings.effective_*``, so every routing
helper picks it up without being threaded through. Work with no user in
context (sweepers, startup) keeps the global defaults.
"""

from __future__ import annotations

import json
import logging
import time
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.auth import get_current_user
from app.db import get_db
from app.models import User
from app.services.platform_settings import PLATFORM_MODEL_KEYS, PlatformModelKey

logger = logging.getLogger(__name__)

_ROLE_BY_KEY: dict[str, str] = {
    "default_model": "text",
    "escalation_model": "text",
    "lite_model": "text",
    "default_image_model": "image",
}

_MAX_SLUG_LEN = 128
_CACHE_TTL_SECONDS = 30.0


@dataclass(frozen=True)
class RoleModels:
    default_model: str
    escalation_model: str
    lite_model: str
    default_image_model: str

    def get(self, key: str) -> str:
        return str(getattr(self, key))


_active: ContextVar[RoleModels | None] = ContextVar("forge_plan_models", default=None)
_cache: dict[tuple[str, str, str], tuple[float, dict[str, str]]] = {}


def clean_default_models(raw: Any) -> dict[str, str]:
    """Keep only the four known keys with a non-empty string slug."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key in PLATFORM_MODEL_KEYS:
        value = raw.get(key)
        if isinstance(value, str):
            slug = value.strip()
            if slug and len(slug) <= _MAX_SLUG_LEN:
                out[key] = slug
    return out


def global_models() -> RoleModels:
    """The platform defaults, ignoring any plan bound to this request."""
    from app.config import get_settings
    from app.services.platform_settings import effective_model

    settings = get_settings()
    return RoleModels(
        default_model=effective_model("default_model", settings.default_model),
        escalation_model=effective_model("escalation_model", settings.escalation_model),
        lite_model=effective_model("lite_model", settings.lite_model),
        default_image_model=effective_model("default_image_model", settings.default_image_model),
    )


def _parse_tiers(raw: str | None) -> set[str] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if not isinstance(parsed, list):
        return None
    return {str(item) for item in parsed}


def _validated_overrides(db: Session, overrides: dict[str, str], tiers: set[str] | None) -> dict[str, str]:
    from app.models import ModelCatalog

    valid: dict[str, str] = {}
    for key, slug in overrides.items():
        role = _ROLE_BY_KEY[key]
        row = db.get(ModelCatalog, slug)
        if row is None or row.status != "active" or row.role != role:
            logger.warning("plan_models: ignoring %s=%r (missing, inactive or wrong role)", key, slug)
            continue
        # Images are never tier-gated (a Free plan still generates images).
        if role == "text" and tiers is not None and row.tier not in tiers:
            logger.warning("plan_models: ignoring %s=%r (tier %r not in plan)", key, slug, row.tier)
            continue
        valid[key] = slug
    return valid


def resolve_for_entitlements(db: Session, cached: Any) -> RoleModels:
    """Plan overrides (validated) over the global defaults."""
    base = global_models()
    if cached is None:
        return base
    raw = getattr(cached, "default_models", None) or ""
    if not raw:
        return base
    try:
        overrides = clean_default_models(json.loads(raw))
    except Exception:
        overrides = {}
    if not overrides:
        return base
    tiers_raw = getattr(cached, "allowed_model_tiers", None) or ""
    cache_key = (str(getattr(cached, "plan_slug", "") or ""), raw, tiers_raw)
    now = time.monotonic()
    hit = _cache.get(cache_key)
    if hit is not None and now - hit[0] < _CACHE_TTL_SECONDS:
        valid = hit[1]
    else:
        valid = _validated_overrides(db, overrides, _parse_tiers(tiers_raw))
        _cache[cache_key] = (now, valid)
    if not valid:
        return base
    merged = asdict(base)
    merged.update(valid)
    return RoleModels(**merged)


def resolve_plan_models(db: Session, user: Any) -> RoleModels:
    """The four model roles for this user's Forge plan."""
    from app.services.entitlements import get_entitlements

    try:
        cached = get_entitlements(db, user)
    except Exception:
        logger.warning("plan_models: entitlement read failed", exc_info=True)
        cached = None
    return resolve_for_entitlements(db, cached)


def plan_default_model(db: Session, user: Any) -> str:
    return resolve_plan_models(db, user).default_model


def active_plan_model(key: PlatformModelKey) -> str | None:
    """The plan default bound to the current request, if any."""
    models = _active.get()
    return models.get(key) if models is not None else None


def set_active_plan_models(models: RoleModels | None):
    """Bind a resolved set to the current context. Returns the reset token."""
    return _active.set(models)


def reset_active_plan_models(token) -> None:
    _active.reset(token)


def invalidate_plan_models_cache() -> None:
    _cache.clear()


async def bind_plan_models(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RoleModels:
    """FastAPI dependency: resolve the caller's plan defaults and bind them.

    Async on purpose: an async dependency runs in the request task, so the
    context variable it sets is seen by the endpoint, its streams and the
    tasks it starts. The DB reads run in the thread pool.
    """
    models = await run_in_threadpool(resolve_plan_models, db, user)
    _active.set(models)
    return models
