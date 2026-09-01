from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import SiteUsageDay, StoredObject, User, UserSettings


def cached_wallet_balance(user: User, db: Session) -> float:
    row = db.get(UserSettings, user.id)
    if row is None or not row.rodium_wallet_json:
        return 0.0
    try:
        raw = json.loads(row.rodium_wallet_json)
    except Exception:
        return 0.0
    if not isinstance(raw, dict):
        return 0.0
    value = raw.get("balanceRodi") or raw.get("balance_rodi") or 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def require_rodi_for_paid_capability(user: User, db: Session) -> None:
    """Gate AI generation on a positive RODI wallet balance."""
    from app.errors import insufficient_rodi

    row = db.get(UserSettings, user.id)
    if row is None or not row.rodium_wallet_json:
        return
    if cached_wallet_balance(user, db) > 0:
        return
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
