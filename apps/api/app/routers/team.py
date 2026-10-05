"""Owner controls for team places, plus the invitee's accept step."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.i18n import resolve_locale
from app.models import User
from app.schemas import SimpleOkResponse
from app.services import rate_limit, team_seats

router = APIRouter(prefix="/auth/team", tags=["team"])


class TeamInviteRequest(BaseModel):
    email: EmailStr
    seats: int = Field(ge=1, le=500)


class TeamEmailRequest(BaseModel):
    email: EmailStr


@router.get("/seats")
def seats(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    view = team_seats.directory(db, user)
    return view


@router.post("/invites", response_model=SimpleOkResponse)
def invite(
    body: TeamInviteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimpleOkResponse:
    team_seats.invite(db, user, str(body.email), body.seats, resolve_locale(request))
    return SimpleOkResponse()


@router.post("/invites/cancel", response_model=SimpleOkResponse)
def cancel(
    body: TeamEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimpleOkResponse:
    team_seats.cancel(db, user, str(body.email))
    return SimpleOkResponse()


@router.post("/invites/restore", response_model=SimpleOkResponse)
def restore(
    body: TeamEmailRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimpleOkResponse:
    team_seats.restore(db, user, str(body.email), resolve_locale(request))
    return SimpleOkResponse()


@router.get("/inbox")
def inbox(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    row = team_seats.inbox_for(db, user)
    if row is None:
        return {"pending": False}
    return {"pending": True, "restore": row.status == "restore"}


@router.post("/inbox/accept", response_model=SimpleOkResponse)
def inbox_accept(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimpleOkResponse:
    team_seats.accept_inbox(db, user, resolve_locale(request))
    return SimpleOkResponse()


@router.get("/join/{token}")
def join_preview(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
    # Token is unguessable, but still throttle enumeration / token spraying.
    rate_limit.enforce(request, "team-join-preview", limit=30, window_seconds=900)
    row = team_seats.preview(db, token)
    return {"email": row.email, "restore": row.status == "restore"}


@router.post("/join/{token}", response_model=SimpleOkResponse)
def join_accept(
    token: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimpleOkResponse:
    rate_limit.enforce(
        request, "team-join-accept", limit=10, window_seconds=900, subject=str(user.id)
    )
    team_seats.accept(db, token, user, resolve_locale(request))
    return SimpleOkResponse()
