from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.crypto import decrypt_secret, encrypt_secret, mask_api_key
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import User, UserSettings
from app.schemas import (
    RodiumKeyOut,
    RodiumKeyUpdate,
    RodiumTestRequest,
    RodiumTestResponse,
    SettingsOut,
    SettingsUpdate,
)
from app.services.llm import RodiumError
from app.services.rodium import verify_rodium_api_key
from app.services.rodium_generation import has_generation_key

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session, user: User) -> UserSettings:
    settings_row = db.get(UserSettings, user.id)
    if settings_row is None:
        settings_row = UserSettings(user_id=user.id, default_model=get_settings().default_model)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def _rodium_key_out(db: Session, user: User, row: UserSettings) -> RodiumKeyOut:
    """Generation-key status: OAuth-linked account or manually pasted key."""
    if user.rodium_sub:
        return RodiumKeyOut(
            configured=has_generation_key(user, row),
            managed=True,
            credentials_hint=row.rodium_api_key_hint or user.email or "RodiumAi",
        )
    return RodiumKeyOut(
        configured=bool(row.rodium_api_key_encrypted),
        managed=False,
        credentials_hint=row.rodium_api_key_hint,
    )


@router.get("", response_model=SettingsOut)
def get_user_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SettingsOut:
    row = _get_or_create_settings(db, user)
    return SettingsOut(
        has_rodium_key=bool(row.rodium_api_key_encrypted),
        rodium_key_hint=row.rodium_api_key_hint,
        default_model=row.default_model,
    )


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SettingsOut:
    locale = resolve_locale(request)
    row = _get_or_create_settings(db, user)
    if body.rodium_api_key is not None:
        key = body.rodium_api_key.strip()
        if not key:
            row.rodium_api_key_encrypted = None
            row.rodium_api_key_hint = None
        else:
            if len(key) < 10:
                raise HTTPException(status_code=400, detail=t("rodium_key_short", locale))
            row.rodium_api_key_encrypted = encrypt_secret(key)
            row.rodium_api_key_hint = mask_api_key(key)
    db.commit()
    db.refresh(row)
    return SettingsOut(
        has_rodium_key=bool(row.rodium_api_key_encrypted),
        rodium_key_hint=row.rodium_api_key_hint,
        default_model=row.default_model,
    )


@router.get("/rodium", response_model=RodiumKeyOut)
def get_rodium_key(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumKeyOut:
    row = _get_or_create_settings(db, user)
    return _rodium_key_out(db, user, row)


@router.put("/rodium", response_model=RodiumKeyOut)
def update_rodium_key(
    body: RodiumKeyUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumKeyOut:
    """Paste or clear a RodiumAi generation key (fallback to the OAuth-selected key)."""
    locale = resolve_locale(request)
    row = _get_or_create_settings(db, user)
    key = (body.api_key or "").strip()

    if not key:
        if user.rodium_sub:
            # OAuth accounts always keep a usable key; clearing the pasted one is fine
            # but must never look like "disconnect my RodiumAi account".
            row.rodium_api_key_encrypted = None
            row.rodium_api_key_hint = user.email or "RodiumAi"
        else:
            row.rodium_api_key_encrypted = None
            row.rodium_api_key_hint = None
        db.commit()
        db.refresh(row)
        return _rodium_key_out(db, user, row)

    if len(key) < 10:
        raise HTTPException(status_code=400, detail=t("rodium_key_short", locale))

    row.rodium_api_key_encrypted = encrypt_secret(key)
    row.rodium_api_key_hint = mask_api_key(key)
    db.commit()
    db.refresh(row)
    return _rodium_key_out(db, user, row)


@router.post("/rodium/test", response_model=RodiumTestResponse)
async def test_rodium_key(
    request: Request,
    body: RodiumTestRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumTestResponse:
    locale = resolve_locale(request)
    row = _get_or_create_settings(db, user)
    candidate = (body.rodium_api_key or "").strip() if body else ""

    if candidate:
        api_key = candidate
    elif user.rodium_sub and row.selected_rodium_api_key_id:
        # Key lives on the RodiumAi side; the account link is the proof it works.
        return RodiumTestResponse(ok=True, message=t("rodium_test_ok", locale))
    elif row.rodium_api_key_encrypted:
        try:
            api_key = decrypt_secret(row.rodium_api_key_encrypted)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=t("rodium_key_unreadable", locale)) from exc
    else:
        raise HTTPException(status_code=400, detail=t("rodium_key_required", locale))

    try:
        await verify_rodium_api_key(api_key, locale)
    except RodiumError as exc:
        return RodiumTestResponse(ok=False, message=str(exc))

    return RodiumTestResponse(ok=True, message=t("rodium_test_ok", locale))
