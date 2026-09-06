"""Single-use, hashed tokens for email verification and password reset.

The raw token exists only in the link we mail out; the database keeps its
sha256. A read-only leak of `auth_tokens` therefore yields nothing usable —
the same reasoning as `keyHash` on API keys and `codeHash` on OAuth codes.

`consume()` is the only way back to a user, and it is atomic-by-construction:
a token is marked consumed in the same transaction that returns it, so a link
clicked twice (mail scanners routinely prefetch) resolves once.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AuthToken

#: Long enough to be unguessable, short enough to survive mail clients that
#: wrap long URLs.
_TOKEN_BYTES = 32

EMAIL_VERIFY_TTL = timedelta(hours=24)
#: Deliberately shorter than verification: a reset link is a live credential.
PASSWORD_RESET_TTL = timedelta(hours=1)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue(db: Session, user_id: UUID, kind: str, ttl: timedelta) -> str:
    """Mint a token and return the RAW value — the only time it exists."""
    raw = secrets.token_urlsafe(_TOKEN_BYTES)
    db.add(
        AuthToken(
            user_id=user_id,
            kind=kind,
            token_hash=hash_token(raw),
            expires_at=datetime.now(UTC) + ttl,
        )
    )
    db.flush()
    return raw


def issue_email_verify(db: Session, user_id: UUID) -> str:
    return issue(db, user_id, AuthToken.KIND_EMAIL_VERIFY, EMAIL_VERIFY_TTL)


def issue_password_reset(db: Session, user_id: UUID) -> str:
    return issue(db, user_id, AuthToken.KIND_PASSWORD_RESET, PASSWORD_RESET_TTL)


def lookup_user_id(db: Session, raw: str, kind: str) -> UUID | None:
    """Return the user id for a token even if it is expired or already used.

    Used by "resend from this link" so an expired verification mail can mint a
    fresh one without asking the visitor to re-type their address. Unknown
    tokens still return None — same silence as ``consume``.
    """
    if not raw:
        return None
    row = (
        db.query(AuthToken)
        .filter(AuthToken.token_hash == hash_token(raw), AuthToken.kind == kind)
        .first()
    )
    return row.user_id if row is not None else None


def consume(db: Session, raw: str, kind: str) -> UUID | None:
    """Validate and burn a token. Returns the user id, or None if unusable.

    One `None` for every failure mode (unknown, wrong kind, already used,
    expired): the caller shows a single "this link is no longer valid"
    message, which is also all an attacker learns.
    """
    if not raw:
        return None
    row = (
        db.query(AuthToken)
        .filter(AuthToken.token_hash == hash_token(raw), AuthToken.kind == kind)
        .first()
    )
    if row is None or row.consumed_at is not None:
        return None

    expires_at = row.expires_at
    if expires_at.tzinfo is None:  # naive timestamps come back from some drivers
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        return None

    row.consumed_at = datetime.now(UTC)
    db.flush()
    return row.user_id


def invalidate_outstanding(db: Session, user_id: UUID, kind: str) -> None:
    """Burn every unused token of a kind.

    Called before issuing a fresh one, so "resend" does not leave a trail of
    working links, and after a successful reset so a second reset mail that
    arrived late cannot be replayed.
    """
    now = datetime.now(UTC)
    (
        db.query(AuthToken)
        .filter(
            AuthToken.user_id == user_id,
            AuthToken.kind == kind,
            AuthToken.consumed_at.is_(None),
        )
        .update({AuthToken.consumed_at: now}, synchronize_session=False)
    )
