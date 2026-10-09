from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import SiteUsageDay, StoredObject, User, UserSettings


def _parse_wallet_balance(raw_json: str | None) -> float | None:
    """Return balance when the cache is readable, else None (unknown)."""
    if not raw_json:
        return None
    try:
        raw = json.loads(raw_json)
    except Exception:
        return None
    if not isinstance(raw, dict):
        return None
    value = raw.get("balanceRodi") or raw.get("balance_rodi")
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def cached_wallet_balance(user: User, db: Session) -> float:
    row = db.get(UserSettings, user.id)
    if row is None:
        return 0.0
    parsed = _parse_wallet_balance(row.rodium_wallet_json)
    return 0.0 if parsed is None else parsed


def _has_rodium_oauth_tokens(row: UserSettings | None) -> bool:
    if row is None:
        return False
    return bool(row.rodium_access_token_encrypted or row.rodium_refresh_token_encrypted)


def require_rodi_for_paid_capability(user: User, db: Session) -> None:
    """Gate AI generation.

    Forge Cloud (secrets present): FRODI or RODI must be readable and positive.
    Open-source / non-cloud: positive cached RODI, with WALLET_SYNCING while the
    OAuth wallet cache is still hydrating after login.
    """
    from app.config import get_settings
    from app.errors import SitesError, insufficient_rodi, wallet_syncing

    settings = get_settings()
    if settings.forge_cloud_enabled and user.rodium_sub:
        from app.services.entitlements import fetch_credit_balances

        balances = fetch_credit_balances(user)
        if balances is None:
            raise insufficient_rodi("Credit balance could not be verified.")
        frodi, rodi = balances
        if frodi > 0 or rodi > 0:
            return
        raise SitesError(
            402,
            "INSUFFICIENT_CREDITS",
            "FRODI and RODI balances are empty.",
            {
                "reservoir": "both",
                "frodi": frodi,
                "rodi": rodi,
                "actions": ["upgrade", "recharge"],
            },
        )

    row = db.get(UserSettings, user.id)
    parsed = _parse_wallet_balance(row.rodium_wallet_json if row else None)
    if parsed is not None and parsed > 0:
        return
    if parsed is None and _has_rodium_oauth_tokens(row):
        raise wallet_syncing()
    raise insufficient_rodi("Insufficient RODI credits. Recharge your RodiumAi wallet to keep generating.")


def usage_row(db: Session, user: User, project_id) -> SiteUsageDay:
    # UTC-anchored so the daily bucket does not shift with server timezone.
    day = datetime.now(UTC).date().isoformat()
    row = (
        db.query(SiteUsageDay)
        .filter(
            SiteUsageDay.user_id == user.id,
            SiteUsageDay.project_id == project_id,
            SiteUsageDay.day == day,
        )
        .first()
    )
    if row is None:
        row = SiteUsageDay(user_id=user.id, project_id=project_id, day=day, storage_bytes=0)
        db.add(row)
        db.flush()
    return row


def managed_storage_bytes(db: Session, user: User) -> int:
    total = 0
    for obj in db.query(StoredObject).filter(StoredObject.user_id == user.id):
        total += int(obj.byte_size or 0)
    return total


def assert_managed_storage_quota(db: Session, user: User, extra_bytes: int) -> None:
    """Cap the design-assets bucket (uploaded images used by prototypes)."""
    from app.errors import quota_exceeded

    settings = get_settings()
    used = managed_storage_bytes(db, user)
    if used + extra_bytes > settings.managed_storage_bytes_limit:
        raise quota_exceeded(
            "STORAGE_QUOTA_EXCEEDED",
            "Project asset storage is capped at 500 MB. Delete unused images to free space.",
            {"limit": settings.managed_storage_bytes_limit, "used": used},
        )
