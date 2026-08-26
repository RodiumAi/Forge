import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import get_settings
from app.crypto import decrypt_secret
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import User, UserSettings
from app.schemas import (
    FirebaseCustomTokenResponse,
    LoginRequest,
    LogoutResponse,
    OAuthCallbackRequest,
    OAuthStartResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    RegisterRequest,
    RodiumAccountOut,
    RodiumApiKeyOut,
    RodiumSelectKeyRequest,
    RodiumSelectKeyResponse,
    RodiumWalletOut,
    TokenResponse,
    UserOut,
)
from app.services.rodium_generation import (
    ensure_default_api_key_id,
    ensure_rodium_access_token,
    has_generation_key,
    pick_default_api_key_id,
    select_api_key_id,
    store_oauth_tokens,
)
from app.services.rodium_oidc import (
    RodiumOidcError,
    build_authorize_url,
    create_oauth_state,
    exchange_code,
    fetch_api_keys,
    fetch_userinfo,
    fetch_wallet,
    generate_pkce,
    parse_oauth_state,
    revoke_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _picture_from_userinfo(info: dict) -> str | None:
    raw = info.get("picture") or info.get("avatarUrl") or info.get("avatar_url")
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        return value
    if value.startswith("/"):
        origin = get_settings().rodium_user_app_url.rstrip("/")
        return f"{origin}{value}"
    return value


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        rodium_linked=bool(user.rodium_sub),
        created_at=user.created_at,
    )


def _get_or_create_settings(db: Session, user: User) -> UserSettings:
    row = db.get(UserSettings, user.id)
    if row is None:
        row = UserSettings(user_id=user.id, default_model=get_settings().default_model)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _store_oauth_tokens(row: UserSettings, tokens: dict) -> None:
    store_oauth_tokens(row, tokens)


async def _ensure_rodium_access_token(db: Session, user: User) -> str:
    row = _get_or_create_settings(db, user)
    return await ensure_rodium_access_token(db, user, row)


def _wallet_out(raw: dict | None) -> RodiumWalletOut | None:
    if not raw:
        return None
    provided_total = raw.get("providedTotalRodi") or raw.get("provided_total_rodi")
    if not provided_total:
        credits = raw.get("providedCredits") or raw.get("provided_credits")
        if isinstance(credits, list):
            try:
                total = sum(
                    float(c.get("remainingRodi") or c.get("amountRodi") or c.get("balance") or 0)
                    for c in credits
                    if isinstance(c, dict)
                )
                provided_total = str(total)
            except Exception:
                provided_total = None
    return RodiumWalletOut(
        balance_rodi=str(raw.get("balanceRodi") or raw.get("balance_rodi") or "") or None,
        reserved_rodi=str(raw.get("reservedRodi") or raw.get("reserved_rodi") or "") or None,
        provided_total_rodi=str(provided_total) if provided_total not in (None, "") else None,
        raw=raw,
    )


def _pick_default_api_key_id(keys: list, preferred: str | None = None) -> str | None:
    return pick_default_api_key_id(keys, preferred)


async def _ensure_default_generation_key(
    db: Session,
    user: User,
    row: UserSettings,
    keys: list | None = None,
) -> bool:
    return await ensure_default_api_key_id(db, user, row, keys)


def _api_keys_out(items: list) -> list[RodiumApiKeyOut]:
    out: list[RodiumApiKeyOut] = []
    for item in items:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        out.append(
            RodiumApiKeyOut(
                id=str(item["id"]),
                name=str(item.get("name") or "API key"),
                prefix=item.get("prefix"),
                last4=item.get("last4"),
                billing_source=item.get("billingSource") or item.get("billing_source"),
                is_active=bool(item.get("isActive", item.get("is_active", True))),
            )
        )
    return out


@router.get("/rodium/start", response_model=OAuthStartResponse)
def rodium_oauth_start(request: Request) -> OAuthStartResponse:
    locale = resolve_locale(request)
    settings = get_settings()
    if not settings.rodium_oidc_client_id:
        raise HTTPException(status_code=503, detail=t("rodium_oauth_not_configured", locale))
    try:
        verifier, challenge = generate_pkce()
        state = create_oauth_state(verifier)
        url = build_authorize_url(state=state, code_challenge=challenge)
    except RodiumOidcError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return OAuthStartResponse(authorize_url=url)


@router.post("/rodium/callback", response_model=TokenResponse)
async def rodium_oauth_callback(
    body: OAuthCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    try:
        verifier = parse_oauth_state(body.state)
        tokens = await exchange_code(code=body.code, code_verifier=verifier)
        access = tokens["access_token"]
        info = await fetch_userinfo(access)
        keys = await fetch_api_keys(access)
        wallet = await fetch_wallet(access)
    except RodiumOidcError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sub = str(info["sub"])
    email = str(info.get("email") or f"{sub}@rodium.local").lower()
    name = info.get("name")
    picture = _picture_from_userinfo(info)

    user = db.query(User).filter(User.rodium_sub == sub).first()
    if user is None:
        user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            password_hash=None,
            rodium_sub=sub,
            name=name,
            avatar_url=picture,
        )
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id, default_model=get_settings().default_model))
    else:
        user.rodium_sub = sub
        user.email = email
        if name:
            user.name = name
        if picture:
            user.avatar_url = picture

    db.commit()
    db.refresh(user)

    settings_row = _get_or_create_settings(db, user)
    _store_oauth_tokens(settings_row, tokens)
    settings_row.rodium_api_keys_json = json.dumps(keys)
    settings_row.rodium_wallet_json = json.dumps(wallet)
    if not settings_row.rodium_api_key_hint:
        settings_row.rodium_api_key_hint = "RodiumAi account"
    db.commit()
    await _ensure_default_generation_key(db, user, settings_row, keys if isinstance(keys, list) else [])

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/rodium/account", response_model=RodiumAccountOut)
async def rodium_account(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumAccountOut:
    if not user.rodium_sub:
        return RodiumAccountOut(linked=False)
    row = _get_or_create_settings(db, user)
    # Prefer DB cache so navbar/profile never wait on Nest latency.
    keys: list = []
    wallet: dict = {}
    if row.rodium_api_keys_json:
        try:
            parsed_keys = json.loads(row.rodium_api_keys_json)
            if isinstance(parsed_keys, list):
                keys = parsed_keys
        except Exception:
            keys = []
    if row.rodium_wallet_json:
        try:
            parsed_wallet = json.loads(row.rodium_wallet_json)
            if isinstance(parsed_wallet, dict):
                wallet = parsed_wallet
        except Exception:
            wallet = {}

    # fresh=1: longer timeout after billing events (chat/generation) so the UI
    # does not stick on the login-time balance.
    fresh = (request.query_params.get("fresh") or "").lower() in ("1", "true", "yes")
    timeout_s = 8.0 if fresh else 2.5

    try:
        async with asyncio.timeout(timeout_s):
            access = await _ensure_rodium_access_token(db, user)
            live_keys = await fetch_api_keys(access)
            live_wallet = await fetch_wallet(access)
            keys = live_keys if isinstance(live_keys, list) else keys
            wallet = live_wallet if isinstance(live_wallet, dict) else wallet
            row.rodium_api_keys_json = json.dumps(keys)
            row.rodium_wallet_json = json.dumps(wallet)
            db.commit()
    except Exception:
        # Keep cached keys/wallet for UI continuity.
        pass

    if not has_generation_key(user, row) and keys:
        await _ensure_default_generation_key(db, user, row, keys if isinstance(keys, list) else [])

    return RodiumAccountOut(
        linked=True,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        wallet=_wallet_out(wallet if isinstance(wallet, dict) else None),
        api_keys=_api_keys_out(keys if isinstance(keys, list) else []),
        selected_api_key_id=row.selected_rodium_api_key_id,
        has_generation_key=has_generation_key(user, row),
        generation_key_hint=row.rodium_api_key_hint,
    )


@router.post("/rodium/ensure-generation-key", response_model=RodiumSelectKeyResponse)
async def rodium_ensure_generation_key(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumSelectKeyResponse:
    """Pick the first active account key when none is selected yet."""
    locale = resolve_locale(request)
    if not user.rodium_sub:
        raise HTTPException(status_code=400, detail=t("rodium_oauth_required", locale))
    row = _get_or_create_settings(db, user)
    if has_generation_key(user, row):
        return RodiumSelectKeyResponse(
            ok=True,
            selected_api_key_id=row.selected_rodium_api_key_id or "",
            has_generation_key=True,
            generation_key_hint=row.rodium_api_key_hint,
        )
    keys: list = []
    try:
        access = await _ensure_rodium_access_token(db, user)
        live_keys = await fetch_api_keys(access)
        if isinstance(live_keys, list):
            keys = live_keys
            row.rodium_api_keys_json = json.dumps(keys)
            db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Failed to list API keys") from exc
    ok = await _ensure_default_generation_key(db, user, row, keys)
    if not ok:
        raise HTTPException(status_code=400, detail=t("rodium_key_required", locale))
    db.refresh(row)
    return RodiumSelectKeyResponse(
        ok=True,
        selected_api_key_id=row.selected_rodium_api_key_id or "",
        has_generation_key=True,
        generation_key_hint=row.rodium_api_key_hint,
    )


@router.post("/rodium/select-key", response_model=RodiumSelectKeyResponse)
async def rodium_select_key(
    body: RodiumSelectKeyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RodiumSelectKeyResponse:
    """Pick a RodiumAi account key by id (playground model — no plaintext secret)."""
    locale = resolve_locale(request)
    if not user.rodium_sub:
        raise HTTPException(status_code=400, detail=t("rodium_oauth_required", locale))
    row = _get_or_create_settings(db, user)
    try:
        hint = await select_api_key_id(db, user, row, body.api_key_id)
    except RodiumOidcError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Failed to select API key") from exc

    db.refresh(row)
    return RodiumSelectKeyResponse(
        ok=True,
        selected_api_key_id=row.selected_rodium_api_key_id or body.api_key_id,
        has_generation_key=True,
        generation_key_hint=hint or row.rodium_api_key_hint,
    )


@router.post("/register", response_model=TokenResponse, deprecated=True)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    locale = resolve_locale(request)
    raise HTTPException(status_code=status.HTTP_410_GONE, detail=t("rodium_oauth_required", locale))


@router.post("/login", response_model=TokenResponse, deprecated=True)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    locale = resolve_locale(request)
    # Keep local bootstrap accounts working if they already exist.
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("rodium_oauth_required", locale),
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserOut:
    user_id = user.id
    if user.rodium_sub:
        try:
            async with asyncio.timeout(1.5):
                access = await _ensure_rodium_access_token(db, user)
                info = await fetch_userinfo(access)
                name = info.get("name") if isinstance(info.get("name"), str) else None
                picture = _picture_from_userinfo(info)
                # Re-bind after token refresh commits (avoid DetachedInstanceError).
                fresh = db.get(User, user_id) or user
                dirty = False
                if name and name != fresh.name:
                    fresh.name = name
                    dirty = True
                if picture and picture != fresh.avatar_url:
                    fresh.avatar_url = picture
                    dirty = True
                if dirty:
                    db.commit()
                user = db.get(User, user_id) or fresh
        except Exception:
            user = db.get(User, user_id) or user
    return _user_out(user)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogoutResponse:
    row = db.get(UserSettings, user.id)
    if row is not None:
        refresh_plain: str | None = None
        if row.rodium_refresh_token_encrypted:
            try:
                refresh_plain = decrypt_secret(row.rodium_refresh_token_encrypted)
            except Exception:
                refresh_plain = None
        if refresh_plain:
            await revoke_token(refresh_plain)
        row.rodium_access_token_encrypted = None
        row.rodium_refresh_token_encrypted = None
        row.rodium_token_expires_at = None
        db.commit()
    return LogoutResponse()


@router.post("/firebase-custom-token", response_model=FirebaseCustomTokenResponse)
def firebase_custom_token(
    request: Request,
    user: User = Depends(get_current_user),
) -> FirebaseCustomTokenResponse:
    """Exchange Forge JWT for a Firebase Auth custom token (Firestore listeners)."""
    locale = resolve_locale(request)
    settings = get_settings()
    from app.services import firestore_live

    if not firestore_live.enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=t("firestore_disabled", locale) if False else "Firestore live is disabled",
        )
    try:
        token = firestore_live.create_custom_token(str(user.id))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc
    return FirebaseCustomTokenResponse(
        token=token,
        project_id=settings.firebase_project_id,
        database_id=settings.firestore_database,
        enabled=True,
    )


@router.post("/change-password", response_model=PasswordChangeResponse)
def change_password(
    body: PasswordChangeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PasswordChangeResponse:
    locale = resolve_locale(request)
    if not user.password_hash:
        raise HTTPException(status_code=400, detail=t("rodium_oauth_no_password", locale))
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=t("invalid_current_password", locale)
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return PasswordChangeResponse()
