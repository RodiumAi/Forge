import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.connectors_catalog import CONNECTOR_BY_ID, CONNECTORS, ConnectorDefinition
from app.crypto import decrypt_secret, encrypt_secret, mask_api_key
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import User, UserConnector, UserSettings
from app.schemas import (
    ConnectorFieldOut,
    ConnectorOut,
    ConnectorTestRequest,
    ConnectorTestResponse,
    ConnectorUpdate,
)
from app.services.capabilities import (
    cached_wallet_balance,
    email_provider,
    managed_storage_bytes,
)
from app.services.llm import RodiumError
from app.services.rodium import verify_rodium_api_key
from app.services.rodium_generation import has_generation_key

router = APIRouter(prefix="/connectors", tags=["connectors"])


def _get_or_create_settings(db: Session, user: User) -> UserSettings:
    settings_row = db.get(UserSettings, user.id)
    if settings_row is None:
        settings_row = UserSettings(user_id=user.id, default_model=get_settings().default_model)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def _connector_out(
    defn: ConnectorDefinition,
    *,
    configured: bool,
    hint: str | None,
    locale: str,
    managed: bool = False,
    removable: bool = True,
    fallback_provider: str | None = None,
    warning: str | None = None,
    quota_used: int | None = None,
    quota_limit: int | None = None,
    quota_unit: str | None = None,
) -> ConnectorOut:
    description = defn.description_en if locale == "en" else defn.description_fr
    use_case = defn.use_case_en if locale == "en" else defn.use_case_fr
    fields = [
        ConnectorFieldOut(
            id=field.id,
            label=field.label_en if locale == "en" else field.label_fr,
            secret=field.secret,
            placeholder=field.placeholder,
            required=field.required,
        )
        for field in defn.fields
    ]
    return ConnectorOut(
        id=defn.id,
        name=defn.name,
        category=defn.category,
        description=description,
        use_case=use_case,
        auth_type=defn.auth_type,
        configured=configured,
        supports_test=defn.supports_test,
        managed=managed,
        removable=removable,
        credentials_hint=hint,
        fields=fields,
        fallback_provider=fallback_provider,
        warning=warning,
        quota_used=quota_used,
        quota_limit=quota_limit,
        quota_unit=quota_unit,
    )


def _enrich_connector(db: Session, user: User, defn: ConnectorDefinition, locale: str) -> ConnectorOut:
    configured, hint, managed = _connector_status(db, user, defn.id)
    fallback = None
    warning = None
    quota_used = None
    quota_limit = None
    quota_unit = None
    settings = get_settings()

    if defn.id == "resend" and not configured:
        fallback = "ses"
        warning = t("connector_resend_fallback", locale)
        quota_used = 0
        quota_limit = settings.managed_email_daily_limit
        quota_unit = "emails/day"
        adapter, _ = email_provider(db, user)
        fallback = adapter
    if defn.id == "cloudinary" and not configured:
        fallback = "s3"
        warning = t("connector_cloudinary_fallback", locale)
        quota_used = managed_storage_bytes(db, user)
        quota_limit = settings.managed_storage_bytes_limit
        quota_unit = "bytes"
    if defn.id in {"resend", "fedapay", "rodiumai"}:
        settings_row = db.get(UserSettings, user.id)
        if settings_row and settings_row.rodium_wallet_json and cached_wallet_balance(user, db) <= 0:
            extra = t("connector_insufficient_rodi", locale)
            warning = f"{warning} {extra}".strip() if warning else extra

    return _connector_out(
        defn,
        configured=configured,
        hint=hint,
        locale=locale,
        managed=managed,
        removable=not managed,
        fallback_provider=fallback,
        warning=warning,
        quota_used=quota_used,
        quota_limit=quota_limit,
        quota_unit=quota_unit,
    )


def _rodium_status(db: Session, user: User) -> tuple[bool, str | None, bool]:
    """Returns configured (ready to generate), hint, managed_via_oauth."""
    row = db.get(UserSettings, user.id)
    if user.rodium_sub:
        hint = (row.rodium_api_key_hint if row else None) or (user.email or "RodiumAi")
        configured = bool(row and has_generation_key(user, row))
        return configured, hint, True
    if row is None or not row.rodium_api_key_encrypted:
        return False, None, False
    return True, row.rodium_api_key_hint, False


def _connector_status(db: Session, user: User, connector_id: str) -> tuple[bool, str | None, bool]:
    if connector_id == "rodiumai":
        return _rodium_status(db, user)
    row = (
        db.query(UserConnector)
        .filter(UserConnector.user_id == user.id, UserConnector.connector_id == connector_id)
        .first()
    )
    if row is None:
        return False, None, False
    return True, row.credentials_hint, False


def _build_hint(defn: ConnectorDefinition, credentials: dict[str, str]) -> str | None:
    for field in defn.fields:
        value = credentials.get(field.id, "").strip()
        if not value:
            continue
        if field.secret:
            return mask_api_key(value)
        return value[:24] + ("…" if len(value) > 24 else "")
    return None


def _save_rodium_key(db: Session, user: User, credentials: dict[str, str], locale: str) -> tuple[bool, str | None]:
    if user.rodium_sub and not credentials:
        raise HTTPException(status_code=400, detail=t("connector_managed_oauth", locale))

    row = _get_or_create_settings(db, user)
    if not credentials:
        row.rodium_api_key_encrypted = None
        row.rodium_api_key_hint = "RodiumAi account" if user.rodium_sub else None
        db.commit()
        return bool(user.rodium_sub), row.rodium_api_key_hint

    key = credentials.get("api_key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail=t("connector_field_required", locale, field="api_key"))
    if len(key) < 10:
        raise HTTPException(status_code=400, detail=t("rodium_key_short", locale))

    row.rodium_api_key_encrypted = encrypt_secret(key)
    row.rodium_api_key_hint = mask_api_key(key)
    db.commit()
    return True, row.rodium_api_key_hint


@router.get("", response_model=list[ConnectorOut])
@router.get("/", response_model=list[ConnectorOut], include_in_schema=False)
def list_connectors(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConnectorOut]:
    locale = resolve_locale(request)
    return [_enrich_connector(db, user, defn, locale) for defn in CONNECTORS]


@router.get("/{connector_id}", response_model=ConnectorOut)
def get_connector(
    connector_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectorOut:
    locale = resolve_locale(request)
    defn = CONNECTOR_BY_ID.get(connector_id)
    if defn is None:
        raise HTTPException(status_code=404, detail=t("connector_not_found", locale))
    return _enrich_connector(db, user, defn, locale)


@router.put("/{connector_id}", response_model=ConnectorOut)
def update_connector(
    connector_id: str,
    body: ConnectorUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectorOut:
    locale = resolve_locale(request)
    defn = CONNECTOR_BY_ID.get(connector_id)
    if defn is None:
        raise HTTPException(status_code=404, detail=t("connector_not_found", locale))

    if connector_id == "rodiumai" and user.rodium_sub and not body.credentials:
        raise HTTPException(status_code=400, detail=t("connector_managed_oauth", locale))

    if connector_id == "rodiumai" and user.rodium_sub:
        # OAuth-linked: allow linking a generation key, never disconnect account.
        configured, hint = _save_rodium_key(db, user, body.credentials, locale)
        return _connector_out(defn, configured=True, hint=hint, locale=locale, managed=True, removable=False)

    if not defn.fields and connector_id != "rodiumai":
        raise HTTPException(status_code=400, detail=t("connector_not_configurable", locale))

    cleaned = {key: value.strip() for key, value in body.credentials.items() if value.strip()}

    if connector_id == "rodiumai":
        configured, hint = _save_rodium_key(db, user, cleaned, locale)
        return _connector_out(defn, configured=configured, hint=hint, locale=locale)

    if not cleaned:
        row = (
            db.query(UserConnector)
            .filter(UserConnector.user_id == user.id, UserConnector.connector_id == connector_id)
            .first()
        )
        if row is not None:
            db.delete(row)
            db.commit()
        return _connector_out(defn, configured=False, hint=None, locale=locale)

    for field in defn.fields:
        if field.required and field.id not in cleaned:
            raise HTTPException(status_code=400, detail=t("connector_field_required", locale, field=field.id))

    row = (
        db.query(UserConnector)
        .filter(UserConnector.user_id == user.id, UserConnector.connector_id == connector_id)
        .first()
    )
    if row is None:
        row = UserConnector(user_id=user.id, connector_id=connector_id, credentials_encrypted="")
        db.add(row)

    row.credentials_encrypted = encrypt_secret(json.dumps(cleaned))
    row.credentials_hint = _build_hint(defn, cleaned)
    db.commit()
    return _connector_out(defn, configured=True, hint=row.credentials_hint, locale=locale)


@router.post("/{connector_id}/test", response_model=ConnectorTestResponse)
async def test_connector(
    connector_id: str,
    request: Request,
    body: ConnectorTestRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectorTestResponse:
    locale = resolve_locale(request)
    defn = CONNECTOR_BY_ID.get(connector_id)
    if defn is None:
        raise HTTPException(status_code=404, detail=t("connector_not_found", locale))
    if not defn.supports_test:
        raise HTTPException(status_code=400, detail=t("connector_test_unavailable", locale))

    candidate = (body.credentials.get("api_key") if body else "") or ""
    candidate = candidate.strip()

    if candidate:
        api_key = candidate
    else:
        row = _get_or_create_settings(db, user)
        if user.rodium_sub and row.selected_rodium_api_key_id:
            return ConnectorTestResponse(ok=True, message=t("rodium_test_ok", locale))
        if row.rodium_api_key_encrypted is None:
            raise HTTPException(status_code=400, detail=t("rodium_key_required", locale))
        try:
            api_key = decrypt_secret(row.rodium_api_key_encrypted)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=t("rodium_key_unreadable", locale)) from exc

    try:
        await verify_rodium_api_key(api_key, locale)
    except RodiumError as exc:
        return ConnectorTestResponse(ok=False, message=str(exc))

    return ConnectorTestResponse(ok=True, message=t("rodium_test_ok", locale))
