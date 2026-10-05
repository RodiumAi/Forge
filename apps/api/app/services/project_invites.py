"""Hashed links for project invitations.

The raw token exists only in the email. ``consume`` is not used: mail scanners
prefetch links, so opening the page must not burn the invitation. Accept and
decline are explicit.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import ProjectInvite

INVITE_TTL = timedelta(days=14)
_TOKEN_BYTES = 32


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def mint_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(_TOKEN_BYTES)
    return raw, hash_token(raw)


def find_by_token(db: Session, raw: str) -> ProjectInvite | None:
    if not raw or len(raw) < 20:
        return None
    return db.query(ProjectInvite).filter(ProjectInvite.token_hash == hash_token(raw)).one_or_none()


def invite_status(invite: ProjectInvite, now: datetime | None = None) -> str:
    moment = now or datetime.now(UTC)
    if invite.declined_at is not None:
        return "declined"
    if invite.accepted_at is not None:
        return "accepted"
    expires = invite.expires_at
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < moment:
            return "expired"
    return "pending"
