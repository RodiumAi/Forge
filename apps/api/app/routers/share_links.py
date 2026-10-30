"""Share a project by link, the way Canva does.

The owner picks who the link is for: nobody ("none"), anyone in presentation
mode without an account ("view"), or Forge accounts that join as editors while
the plan has a free seat ("edit"). The token in the URL is the secret; the
owner can rotate it to cut every link already sent.

Public reads only serve presentations, without speaker notes or hidden slides.
"""

import json
import re
import secrets
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, ProjectCollaborator, User
from app.routers.projects import _occupied_emails, _owned_project, _share_seat_limit
from app.services import rate_limit
from app.services.asset_storage import sniff_raster
from app.services.document_scaffold import DECK_PATH
from app.services.filesystem import read_file, safe_resolve

router = APIRouter(prefix="/projects", tags=["share-links"])
public_router = APIRouter(prefix="/share", tags=["share-links"])

LinkAccess = Literal["none", "view", "edit"]
_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,64}$")
_THEME_RE = re.compile(r"^[A-Za-z0-9_./-]{1,120}\.(md|json)$")
_SLIDE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_VIDEO_TYPES = {".mp4": "video/mp4", ".webm": "video/webm"}


class LinkOut(BaseModel):
    access: LinkAccess
    token: str | None
    #: Seats left for people joining by an edit link; None means unlimited.
    seats_left: int | None
    #: False when the plan has no sharing: only "none" and "view" are open.
    can_edit_link: bool


class LinkIn(BaseModel):
    access: LinkAccess


def _seats_left(db: Session, owner: User, project: Project) -> tuple[int | None, bool]:
    limit = _share_seat_limit(db, owner)
    if limit is None:
        return None, True
    return max(0, limit - len(_occupied_emails(db, project))), limit > 0


def _link_out(db: Session, owner: User, project: Project) -> LinkOut:
    seats, can_edit = _seats_left(db, owner, project)
    access = project.link_access if project.link_access in ("none", "view", "edit") else "none"
    return LinkOut(access=access, token=project.link_token, seats_left=seats, can_edit_link=can_edit)


@router.get("/{project_id}/link", response_model=LinkOut)
def get_link(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LinkOut:
    project = _owned_project(db, user, project_id, resolve_locale(request))
    return _link_out(db, user, project)


@router.put("/{project_id}/link", response_model=LinkOut)
def set_link(
    project_id: UUID,
    body: LinkIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LinkOut:
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    if body.access == "edit" and not _seats_left(db, user, project)[1]:
        raise HTTPException(status_code=422, detail=t("share_not_in_plan", locale))
    project.link_access = body.access
    if body.access != "none" and not project.link_token:
        project.link_token = secrets.token_urlsafe(24)
    db.commit()
    return _link_out(db, user, project)


@router.post("/{project_id}/link/reset", response_model=LinkOut)
def reset_link(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LinkOut:
    """New token: every link sent before stops working."""
    project = _owned_project(db, user, project_id, resolve_locale(request))
    project.link_token = secrets.token_urlsafe(24)
    db.commit()
    return _link_out(db, user, project)


# ── Public side ─────────────────────────────────────────────────────────────


def _shared_project(db: Session, token: str, request: Request) -> Project:
    """The project behind a live link, or 404 for an unknown, cut or closed link."""
    rate_limit.enforce(request, "share_link", 240, 60)
    locale = resolve_locale(request)
    project = None
    if _TOKEN_RE.match(token):
        project = db.query(Project).filter(Project.link_token == token).one_or_none()
    if not isinstance(project, Project) or project.link_access not in ("view", "edit"):
        raise HTTPException(status_code=404, detail=t("share_link_not_found", locale))
    return project


def _read_json(project_id: str, relative: str) -> dict[str, Any] | None:
    try:
        data = json.loads(read_file(project_id, relative))
    except (FileNotFoundError, ValueError, OSError):
        return None
    return data if isinstance(data, dict) else None


class SharedOut(BaseModel):
    project_id: str
    name: str
    kind: str
    access: LinkAccess


@public_router.get("/{token}", response_model=SharedOut)
def shared_info(token: str, request: Request, db: Session = Depends(get_db)) -> SharedOut:
    project = _shared_project(db, token, request)
    return SharedOut(
        project_id=str(project.id), name=project.name, kind=project.platform, access=project.link_access
    )  # type: ignore[arg-type]


@public_router.get("/{token}/presentation")
def shared_presentation(token: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Deck, visible slides and theme text, in one read for the viewer."""
    project = _shared_project(db, token, request)
    locale = resolve_locale(request)
    if project.platform != "slides":
        raise HTTPException(status_code=404, detail=t("share_link_kind", locale))
    pid = str(project.id)
    deck = _read_json(pid, DECK_PATH)
    if deck is None:
        raise HTTPException(status_code=404, detail=t("share_link_not_found", locale))
    refs = [ref for ref in deck.get("slides") or [] if isinstance(ref, dict) and not ref.get("hidden")]
    slides: dict[str, Any] = {}
    for ref in refs:
        sid = str(ref.get("id") or "")
        if _SLIDE_ID_RE.match(sid):
            body = _read_json(pid, f"slides/{sid}.json")
            if body is not None:
                slides[sid] = body
    refs = [ref for ref in refs if str(ref.get("id")) in slides]
    theme_file = str(((deck.get("theme") or {}).get("tokens")) or "DESIGN.md")
    theme = ""
    if _THEME_RE.match(theme_file) and ".." not in theme_file.split("/"):
        try:
            theme = read_file(pid, theme_file)
        except (FileNotFoundError, ValueError, OSError):
            theme = ""
    return {"name": project.name, "deck": {**deck, "slides": refs}, "slides": slides, "theme": theme}


@public_router.get("/{token}/asset/{asset_path:path}", include_in_schema=False)
def shared_asset(token: str, asset_path: str, request: Request, db: Session = Depends(get_db)) -> Response:
    """Images and videos of the shared project (`public/`), nothing else."""
    project = _shared_project(db, token, request)
    locale = resolve_locale(request)
    rel = asset_path.strip().lstrip("/")
    if rel.startswith("public/"):
        rel = rel[len("public/") :]
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=404, detail=t("file_not_found", locale))
    try:
        resolved = safe_resolve(str(project.id), f"public/{rel}")
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=t("file_not_found", locale)) from exc
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail=t("file_not_found", locale))
    body = resolved.read_bytes()
    verified = sniff_raster(body)
    media_type = verified[0] if verified else _VIDEO_TYPES.get(resolved.suffix.lower())
    if media_type is None:
        raise HTTPException(status_code=404, detail=t("file_not_found", locale))
    return Response(
        content=body,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


class JoinOut(BaseModel):
    project_id: str
    #: "owner" / "editor" / "viewer": opens the editor. "view": the viewer
    #: page only (a view link, or an edit link with no seat left).
    role: Literal["owner", "editor", "viewer", "view"]
    #: Why an edit link gave read only.
    reason: Literal["no_seat"] | None = None


@public_router.post("/{token}/join", response_model=JoinOut)
def join_by_link(
    token: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JoinOut:
    """A signed-in Forge account opens the link: editor when an edit link and a seat allow it."""
    project = _shared_project(db, token, request)
    pid = str(project.id)
    if project.user_id == user.id:
        return JoinOut(project_id=pid, role="owner")
    row = db.get(ProjectCollaborator, (project.id, user.id))
    if isinstance(row, ProjectCollaborator) and row.accepted_at is not None:
        if row.role != "editor" and project.link_access == "edit":
            row.role = "editor"  # already holds a seat
            db.commit()
        return JoinOut(project_id=pid, role="editor" if row.role == "editor" else "viewer")
    if project.link_access != "edit":
        return JoinOut(project_id=pid, role="view")

    owner = db.get(User, project.user_id)
    if owner is None:
        return JoinOut(project_id=pid, role="view")
    limit = _share_seat_limit(db, owner)
    email = (user.email or "").lower()
    occupied = _occupied_emails(db, project)
    if limit is not None and email not in occupied and len(occupied) >= limit:
        return JoinOut(project_id=pid, role="view", reason="no_seat")
    if isinstance(row, ProjectCollaborator):
        row.role = "editor"
        row.accepted_at = datetime.now(UTC)
    else:
        db.add(
            ProjectCollaborator(
                project_id=project.id,
                user_id=user.id,
                role="editor",
                invited_by=None,
                accepted_at=datetime.now(UTC),
            )
        )
    db.commit()
    return JoinOut(project_id=pid, role="editor")
