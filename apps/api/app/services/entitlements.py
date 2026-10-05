"""Cached Forge entitlements. RodiumAi remains the source of truth."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import SitesError
from app.models import ForgeEntitlementCache, User

# Free and other "limited" plans keep this many newest checkpoints.
LIMITED_HISTORY_SNAPSHOTS = 5


def entitlements_apply(user: User) -> bool:
    """True when this account is a hosted Forge Cloud user.

    The plan and the weekly FRODI balance are read from FastAPI with the
    shared internal token and the platform uid, then stored on this row.
    Open-source clones leave the token and the gateway URL empty.
    """
    settings = get_settings()
    return bool(
        user.rodium_sub and settings.provisioning_enabled and settings.rodium_gateway_internal_url.strip()
    )


def get_entitlements(db: Session, user: User) -> ForgeEntitlementCache | None:
    if not entitlements_apply(user):
        return None
    return db.get(ForgeEntitlementCache, user.id)


def upsert_entitlements(db: Session, user: User, payload: dict) -> ForgeEntitlementCache:
    ents = payload.get("entitlements") if isinstance(payload.get("entitlements"), dict) else {}
    row = db.get(ForgeEntitlementCache, user.id)
    if row is None:
        row = ForgeEntitlementCache(user_id=user.id)
        db.add(row)
    row.plan_slug = str(payload.get("plan") or "free")
    row.status = str(payload.get("status") or "active")
    max_projects = payload.get("maxProjects", ents.get("max_projects"))
    row.max_projects = int(max_projects) if isinstance(max_projects, int) else None
    row.model_selection = bool(ents.get("model_selection"))
    row.custom_domain = bool(ents.get("custom_domain"))
    row.export_enabled = bool(ents.get("export"))
    history = ents.get("history")
    if history is True:
        row.history_enabled = True
        row.history_limit = None
    elif history == "limited":
        row.history_enabled = True
        row.history_limit = LIMITED_HISTORY_SNAPSHOTS
    else:
        row.history_enabled = False
        row.history_limit = 0
    row.priority_generation = bool(ents.get("priority_generation"))
    tiers = ents.get("allowed_model_tiers")
    row.allowed_model_tiers = json.dumps(tiers) if isinstance(tiers, list) else None
    try:
        row.frodi_balance = int(float(payload.get("frodi") or 0))
    except (TypeError, ValueError):
        row.frodi_balance = 0
    row.refreshed_at = datetime.now(UTC)
    db.flush()
    return row


def history_snapshot_cap(db: Session, user: User) -> int | None:
    """How many checkpoints this account may list or restore.

    ``None`` means unlimited. Open-source and BYOK installs stay unlimited.
    A Cloud account with no synced plan, or a plan whose history is off, is refused.
    """
    if not entitlements_apply(user):
        return None
    row = get_entitlements(db, user)
    if row is None or not row.history_enabled:
        raise SitesError(
            403,
            "FEATURE_NOT_IN_PLAN",
            "Project history is not included in the current Forge plan.",
        )
    limit = row.history_limit
    if isinstance(limit, int) and limit > 0:
        return limit
    return None


def max_projects_for(db: Session, user: User, fallback: int) -> int | None:
    """None means unlimited."""
    row = get_entitlements(db, user)
    if row is None:
        return fallback
    return row.max_projects


def require_feature(db: Session, user: User, flag: str) -> None:
    """Refuse a paid capability when Forge Cloud applies.

    Open-source / BYOK installs have no entitlement cache and stay unrestricted.
    A Cloud account with no synced plan is treated as Free: export and custom
    domains stay closed until a plan that includes them is pushed.

    Free and Starter never export, even if a stale cache row still says yes.
    The acting user's plan is what counts, including on a shared project.
    """
    if not entitlements_apply(user):
        return
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    if flag == "export_enabled" and slug in {"free", "starter"}:
        raise SitesError(
            403,
            "FEATURE_NOT_IN_PLAN",
            "This feature is not included in the current Forge plan.",
        )
    if row is None or not bool(getattr(row, flag, False)):
        raise SitesError(
            403,
            "FEATURE_NOT_IN_PLAN",
            "This feature is not included in the current Forge plan.",
        )


def pull_forge_account(db: Session, user: User) -> dict | None:
    """Read the weekly FRODI balance and the plan, and store both locally.

    FastAPI ``GET /internal/forge/balance?uid=`` is the only caller that
    should answer this. The header is the shared internal token, the same
    secret FastAPI already uses toward Nest. The plan slug lands in
    ``ForgeEntitlementCache`` so the builder does not ask again on every click.
    """
    settings = get_settings()
    if not entitlements_apply(user):
        return None
    base = settings.rodium_gateway_internal_url.strip().rstrip("/")
    token = settings.rodium_provision_token.strip()
    try:
        response = httpx.get(
            f"{base}/internal/forge/balance",
            params={"uid": user.rodium_sub},
            headers={"X-Internal-Token": token},
            timeout=8.0,
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    body = response.json()
    if not isinstance(body, dict):
        return None
    upsert_entitlements(db, user, body)
    db.commit()
    return body


def fetch_credit_balances(user: User) -> tuple[float, float] | None:
    settings = get_settings()
    if not settings.forge_cloud_enabled or not user.rodium_sub:
        return None
    url = settings.rodium_gateway_internal_url.rstrip("/") + "/internal/forge/balance"
    try:
        response = httpx.get(
            url,
            params={"uid": user.rodium_sub},
            headers={"X-Forge-Gateway-Token": settings.rodium_forge_gateway_token},
            timeout=8.0,
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    body = response.json()
    try:
        return float(body.get("frodi") or 0), float(body.get("rodi") or 0)
    except (TypeError, ValueError):
        return None


def require_forge_capacity(user: User, db: Session) -> None:
    from app.services.capabilities import require_rodi_for_paid_capability

    require_rodi_for_paid_capability(user, db)


def cache_is_fresh(row: ForgeEntitlementCache | None, ttl: timedelta = timedelta(minutes=5)) -> bool:
    if row is None or row.refreshed_at is None:
        return False
    refreshed = row.refreshed_at
    if refreshed.tzinfo is None:
        refreshed = refreshed.replace(tzinfo=UTC)
    return datetime.now(UTC) - refreshed < ttl
