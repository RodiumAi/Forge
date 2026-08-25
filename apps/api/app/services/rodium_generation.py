"""RodiumAi generation auth — playground model (OAuth + api key id), legacy secret fallback."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret, encrypt_secret
from app.models import User, UserSettings
from app.services.rodium_oidc import (
    RodiumOidcError,
    fetch_api_keys,
    refresh_access_token,
)


@dataclass
class RodiumGenerationAuth:
    mode: Literal["playground", "secret"]
    access_token: str | None = None
    api_key_id: str | None = None
    api_key_secret: str | None = None


def pick_default_api_key_id(keys: list, preferred: str | None = None) -> str | None:
    parsed = [k for k in keys if isinstance(k, dict) and k.get("id")]
    if not parsed:
        return None
    if preferred:
        for item in parsed:
            if str(item["id"]) == preferred and bool(item.get("isActive", item.get("is_active", True))):
                return str(item["id"])
    for item in parsed:
        if bool(item.get("isActive", item.get("is_active", True))):
            return str(item["id"])
    return str(parsed[0]["id"])


def key_hint_from_list(keys: list, key_id: str) -> str | None:
    for item in keys:
        if not isinstance(item, dict) or str(item.get("id")) != key_id:
            continue
        name = str(item.get("name") or "API key")
        last4 = item.get("last4")
        return f"{name} · …{last4}" if last4 else name
    return None


def has_generation_key(user: User, row: UserSettings) -> bool:
    if user.rodium_sub and row.selected_rodium_api_key_id:
        return True
    return bool(row.rodium_api_key_encrypted)


def store_oauth_tokens(row: UserSettings, tokens: dict) -> None:
    access = tokens.get("access_token")
    refresh = tokens.get("refresh_token")
    expires_in = int(tokens.get("expires_in") or 3600)
    if access:
        row.rodium_access_token_encrypted = encrypt_secret(access)
    if refresh:
        row.rodium_refresh_token_encrypted = encrypt_secret(refresh)
    row.rodium_token_expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=max(expires_in - 60, 60)
    )


async def ensure_rodium_access_token(db: Session, user: User, row: UserSettings) -> str:
    if not row.rodium_access_token_encrypted:
        raise HTTPException(status_code=400, detail="RodiumAi account is not linked")
    access = decrypt_secret(row.rodium_access_token_encrypted)
    expires = row.rodium_token_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires > datetime.now(timezone.utc):
        return access
    if not row.rodium_refresh_token_encrypted:
        return access
    refresh = decrypt_secret(row.rodium_refresh_token_encrypted)
    tokens = await refresh_access_token(refresh)
    store_oauth_tokens(row, tokens)
    db.commit()
    return decrypt_secret(row.rodium_access_token_encrypted or "")


def _keys_from_row(row: UserSettings) -> list:
    if not row.rodium_api_keys_json:
        return []
    try:
        parsed = json.loads(row.rodium_api_keys_json)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


async def ensure_default_api_key_id(
    db: Session,
    user: User,
    row: UserSettings,
    keys: list | None = None,
) -> bool:
    if row.selected_rodium_api_key_id:
        return True
    if keys is None:
        keys = _keys_from_row(row)
    key_id = pick_default_api_key_id(keys, None)
    if not key_id:
        return False
    row.selected_rodium_api_key_id = key_id
    row.rodium_api_key_hint = key_hint_from_list(keys, key_id) or row.rodium_api_key_hint
    db.commit()
    return True


async def select_api_key_id(
    db: Session,
    user: User,
    row: UserSettings,
    api_key_id: str,
) -> str:
    key_id = (api_key_id or "").strip()
    if not key_id:
        raise RodiumOidcError("api_key_id is required")
    access = await ensure_rodium_access_token(db, user, row)
    keys = await fetch_api_keys(access)
    if not any(
        isinstance(k, dict) and str(k.get("id")) == key_id and bool(k.get("isActive", k.get("is_active", True)))
        for k in keys
    ):
        raise RodiumOidcError("API key not found or inactive")
    row.selected_rodium_api_key_id = key_id
    row.rodium_api_keys_json = json.dumps(keys)
    hint = key_hint_from_list(keys, key_id)
    if hint:
        row.rodium_api_key_hint = hint
    db.commit()
    return row.rodium_api_key_hint or hint or "API key"


async def resolve_generation_auth(db: Session, user: User) -> RodiumGenerationAuth:
    row = db.get(UserSettings, user.id)
    if row is None:
        raise HTTPException(status_code=400, detail="RodiumAi API key is required")
    if user.rodium_sub and row.selected_rodium_api_key_id:
        access = await ensure_rodium_access_token(db, user, row)
        return RodiumGenerationAuth(
            mode="playground",
            access_token=access,
            api_key_id=row.selected_rodium_api_key_id,
        )
    if row.rodium_api_key_encrypted:
        try:
            secret = decrypt_secret(row.rodium_api_key_encrypted)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Stored RodiumAi key is unreadable") from exc
        return RodiumGenerationAuth(mode="secret", api_key_secret=secret)
    raise HTTPException(status_code=400, detail="RodiumAi API key is required")
