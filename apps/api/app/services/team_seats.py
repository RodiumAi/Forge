"""Team places the owner has offered to other people.

Pending invitations can be cancelled; the paid place stays. Once someone has
accepted, removing them keeps their email, tagged removed, and that place is
not handed to someone else. Restoring them sends a new mail; the time they
keep is whatever is left on the team's current period.
"""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.i18n import Locale, t
from app.models import TeamSeat, User, UserSettings
from app.services import mail
from app.services.auth_tokens import hash_token

logger = logging.getLogger("team_seats")

HOLDING = ("pending", "accepted", "removed", "restore")


def list_seats(db: Session, owner: User) -> list[dict]:
    rows = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == owner.id, TeamSeat.status.in_(HOLDING))
        .order_by(TeamSeat.created_at.asc())
    )
    return [{"email": row.email, "status": row.status} for row in rows.all()]


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    tld = domain[domain.rfind(".") :] if "." in domain else ""
    return f"{local[:2]}****@**{tld}"


def directory(db: Session, user: User) -> dict:
    """Owners manage seats. An accepted member only sees who is on the team, with emails hidden."""
    mine = user.email.strip().lower()
    owned = list_seats(db, user)
    if owned:
        return {"role": "owner", "members": owned}
    seat = (
        db.query(TeamSeat)
        .filter(TeamSeat.email == mine, TeamSeat.status == "accepted")
        .order_by(TeamSeat.created_at.desc())
        .first()
    )
    if seat is None:
        return {"role": "owner", "members": []}
    owner = db.get(User, seat.owner_user_id)
    people: list[dict] = []
    if owner is not None:
        people.append({"email": mask_email(owner.email), "status": "owner"})
    rows = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == seat.owner_user_id, TeamSeat.status == "accepted")
        .order_by(TeamSeat.created_at.asc())
        .all()
    )
    people.extend({"email": mask_email(row.email), "status": "member"} for row in rows)
    return {"role": "member", "members": people}


def occupied(db: Session, owner: User) -> int:
    return (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == owner.id, TeamSeat.status.in_(HOLDING))
        .count()
    )


def _send_link(row: TeamSeat, raw: str, locale: Locale, *, restore: bool) -> bool:
    url = get_settings().web_url(f"/team/join/{raw}")
    message = mail.build_team_restore(row.email, url, locale) if restore else mail.build_team_invite(row.email, url, locale)
    return mail.send(message)


def invite(db: Session, owner: User, email: str, seats: int, locale: Locale) -> TeamSeat:
    email = email.strip().lower()
    if not email or email == owner.email.strip().lower():
        raise HTTPException(status_code=422, detail=t("team_invite_self", locale))
    others = occupied(db, owner)
    # The owner always holds the first place.
    if 1 + others >= seats:
        raise HTTPException(status_code=422, detail=t("team_invite_full", locale))
    row = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == owner.id, TeamSeat.email == email)
        .one_or_none()
    )
    if row is not None and row.status in ("pending", "accepted", "restore"):
        raise HTTPException(status_code=409, detail=t("team_invite_exists", locale))
    if row is not None and row.status == "removed":
        raise HTTPException(status_code=409, detail=t("team_invite_removed", locale))
    raw = secrets.token_urlsafe(24)
    now = datetime.now(UTC)
    _ensure_invited_account(db, email)
    if row is None:
        row = TeamSeat(
            id=uuid4(),
            owner_user_id=owner.id,
            email=email,
            status="pending",
            token_hash=hash_token(raw),
            reason=None,
        )
        db.add(row)
    else:
        row.status = "pending"
        row.token_hash = hash_token(raw)
        row.reason = None
        row.updated_at = now
    db.commit()
    if not _send_link(row, raw, locale, restore=False):
        raise HTTPException(status_code=503, detail=t("team_invite_mail_failed", locale))
    return row


def inbox_for(db: Session, user: User) -> TeamSeat | None:
    return (
        db.query(TeamSeat)
        .filter(
            TeamSeat.email == user.email.strip().lower(),
            TeamSeat.status.in_(("pending", "restore")),
        )
        .order_by(TeamSeat.created_at.desc())
        .first()
    )


def accept_inbox(db: Session, user: User, locale: Locale) -> TeamSeat:
    row = inbox_for(db, user)
    if row is None:
        raise HTTPException(status_code=404, detail=t("team_join_invalid", locale))
    owner = db.get(User, row.owner_user_id)
    if owner is None:
        raise HTTPException(status_code=400, detail=t("team_join_invalid", locale))
    seated = _nest_seat(owner, row.email, "grant")
    if not seated:
        raise HTTPException(status_code=409, detail=t("team_join_account", locale))
    row.status = "accepted"
    row.token_hash = None
    row.updated_at = datetime.now(UTC)
    db.commit()
    return row


def _ensure_invited_account(db: Session, email: str) -> None:
    """An invited address gets an unverified account immediately. They choose the password later."""
    existing = db.query(User).filter(User.email == email).one_or_none()
    if existing is not None:
        return
    local = (email.split("@", 1)[0] or email)[:200]
    user = User(email=email, password_hash=None, name=local)
    db.add(user)
    db.flush()
    db.add(UserSettings(user_id=user.id, default_model=get_settings().effective_default_model))


def cancel(db: Session, owner: User, email: str) -> None:
    row = _owned(db, owner, email)
    if row.status not in ("pending", "restore"):
        raise HTTPException(status_code=422, detail="Only a pending invitation can be cancelled.")
    row.status = "removed" if row.status == "restore" else "cancelled"
    row.token_hash = None
    row.updated_at = datetime.now(UTC)
    db.commit()


def mark_removed(db: Session, owner: User, email: str, reason: str) -> None:
    email = email.strip().lower()
    row = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == owner.id, TeamSeat.email == email)
        .one_or_none()
    )
    if row is None:
        _nest_seat(owner, email, "revoke")
        return
    if row.status != "accepted":
        raise HTTPException(status_code=422, detail="Only an accepted member can be removed.")
    row.status = "removed"
    row.reason = reason.strip()
    row.token_hash = None
    row.updated_at = datetime.now(UTC)
    db.commit()
    _nest_seat(owner, email, "revoke")


def restore(db: Session, owner: User, email: str, locale: Locale) -> None:
    row = _owned(db, owner, email)
    if row.status != "removed":
        raise HTTPException(status_code=422, detail="Only a removed member can be restored.")
    raw = secrets.token_urlsafe(24)
    row.status = "restore"
    row.token_hash = hash_token(raw)
    row.updated_at = datetime.now(UTC)
    db.commit()
    if not _send_link(row, raw, locale, restore=True):
        raise HTTPException(status_code=503, detail=t("team_invite_mail_failed", locale))


def preview(db: Session, raw: str) -> TeamSeat:
    row = db.query(TeamSeat).filter(TeamSeat.token_hash == hash_token(raw)).one_or_none()
    if row is None or row.status not in ("pending", "restore"):
        raise HTTPException(status_code=400, detail=t("team_join_invalid", "en"))
    return row


def accept(db: Session, raw: str, user: User, locale: Locale) -> TeamSeat:
    row = preview(db, raw)
    if user.email.strip().lower() != row.email.strip().lower():
        raise HTTPException(status_code=403, detail=t("team_join_email", locale, email=row.email))
    owner = db.get(User, row.owner_user_id)
    if owner is None:
        raise HTTPException(status_code=400, detail=t("team_join_invalid", locale))
    seated = _nest_seat(owner, row.email, "grant")
    if not seated:
        raise HTTPException(status_code=409, detail=t("team_join_account", locale))
    row.status = "accepted"
    row.token_hash = None
    row.updated_at = datetime.now(UTC)
    db.commit()
    return row


def _owned(db: Session, owner: User, email: str) -> TeamSeat:
    row = (
        db.query(TeamSeat)
        .filter(TeamSeat.owner_user_id == owner.id, TeamSeat.email == email.strip().lower())
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="That person is not on this team.")
    return row


def _nest_seat(owner: User, email: str, action: str) -> bool:
    """Seat or unseat the person on the owner's team so Forge shows Team or Free."""
    if not owner.rodium_sub:
        logger.warning("team seat skipped, owner has no platform account email=%s", email)
        return False
    settings = get_settings()
    base = settings._rodium_oidc_server_base.rstrip("/")
    token = settings.rodium_provision_token.strip()
    if not base or not token:
        return False
    try:
        response = httpx.post(
            f"{base}/api/v1/internal/frodi/team/seat",
            json={"ownerUserId": owner.rodium_sub, "email": email, "action": action},
            headers={"X-Internal-Token": token},
            timeout=8.0,
        )
    except httpx.HTTPError:
        logger.exception("team seat call failed action=%s", action)
        return action == "revoke"
    if response.status_code == 404:
        return False
    if response.status_code >= 400:
        logger.warning("team seat call status=%s action=%s", response.status_code, action)
        return False
    body = response.json()
    return bool(body.get("ok"))
