from __future__ import annotations

import json
from datetime import date

from sqlalchemy.orm import Session

from app.config import get_settings
from app.crypto import decrypt_secret
from app.models import SiteUsageDay, StoredObject, User, UserConnector, UserSettings


def connector_credentials(db: Session, user: User, connector_id: str) -> dict[str, str] | None:
    row = (
        db.query(UserConnector)
        .filter(UserConnector.user_id == user.id, UserConnector.connector_id == connector_id)
        .first()
    )
    if row is None or not row.credentials_encrypted:
        return None
    try:
        data = json.loads(decrypt_secret(row.credentials_encrypted))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return {str(k): str(v) for k, v in data.items() if str(v).strip()}


def email_provider(db: Session, user: User) -> tuple[str, dict[str, str] | None]:
    creds = connector_credentials(db, user, "resend")
    if creds and creds.get("api_key"):
        return "resend", creds
    return get_settings().mail_provider, None


def storage_provider(db: Session, user: User) -> tuple[str, dict[str, str] | None]:
    creds = connector_credentials(db, user, "cloudinary")
    if creds and creds.get("api_key") and creds.get("api_secret") and creds.get("cloud_name"):
        return "cloudinary", creds
    return "s3", None


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
    from app.errors import insufficient_rodi

    row = db.get(UserSettings, user.id)
    if row is None or not row.rodium_wallet_json:
        return
    if cached_wallet_balance(user, db) > 0:
        return
    raise insufficient_rodi(
        "Insufficient RODI credits. Recharge your RodiumAi wallet to send email, take payments or call AI."
    )


def usage_row(db: Session, user: User, project_id) -> SiteUsageDay:
    day = date.today().isoformat()
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
        row = SiteUsageDay(user_id=user.id, project_id=project_id, day=day, emails_sent=0, storage_bytes=0)
        db.add(row)
        db.flush()
    return row


def managed_storage_bytes(db: Session, user: User) -> int:
    total = 0
    for obj in db.query(StoredObject).filter(StoredObject.user_id == user.id, StoredObject.adapter == "s3"):
        total += int(obj.byte_size or 0)
    return total


def assert_managed_email_quota(db: Session, user: User, project_id) -> SiteUsageDay:
    from app.errors import quota_exceeded

    settings = get_settings()
    row = usage_row(db, user, project_id)
    if row.emails_sent >= settings.managed_email_daily_limit:
        raise quota_exceeded(
            "EMAIL_DAILY_QUOTA_EXCEEDED",
            f"Managed email limit reached ({settings.managed_email_daily_limit} emails/day). Connect Resend to continue.",
            {"limit": settings.managed_email_daily_limit, "used": row.emails_sent},
        )
    return row


def assert_managed_storage_quota(db: Session, user: User, extra_bytes: int) -> None:
    from app.errors import quota_exceeded

    settings = get_settings()
    used = managed_storage_bytes(db, user)
    if used + extra_bytes > settings.managed_storage_bytes_limit:
        raise quota_exceeded(
            "STORAGE_QUOTA_EXCEEDED",
            "Managed object storage is capped at 500 MB. Connect Cloudinary to host more files.",
            {"limit": settings.managed_storage_bytes_limit, "used": used},
        )
