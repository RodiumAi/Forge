"""Project file history — checkpoints, diff and restore.

Frontend-only prototyping is iterative and destructive: one bad agent turn used
to be final. Every batch of writes now snapshots the workspace first, and these
endpoints let the UI list those checkpoints and roll back to any of them.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services import history
from app.services.entitlements import history_snapshot_cap
from app.services.project_access import accessible_project

router = APIRouter(prefix="/projects", tags=["history"])


class HistoryActorOut(BaseModel):
    name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


class SnapshotOut(BaseModel):
    id: str
    label: str
    created_at: str
    files_changed: int = 0
    actor: HistoryActorOut | None = None


class HistoryStatusOut(BaseModel):
    available: bool
    limited: bool = False
    total: int = 0
    snapshots: list[SnapshotOut] = []


class SnapshotDetailOut(SnapshotOut):
    files: list[str] = []
    diff: str = ""


class RestoreResponse(BaseModel):
    ok: bool = True
    snapshot_id: str | None = None
    restored_from: str


def _opened(
    db: Session,
    user: User,
    project_id: UUID,
    locale: str = "fr",
    *,
    require_edit: bool = False,
) -> Project:
    return accessible_project(db, user, project_id, locale, require_edit=require_edit)


def _allowed_snapshots(db: Session, user: User, project_id: UUID) -> tuple[int | None, list, int]:
    """Return (cap, visible snapshots, total known). cap None means the full list."""
    from app.errors import SitesError

    try:
        cap = history_snapshot_cap(db, user)
    except SitesError:
        return 0, [], 0
    if not history.is_available():
        return cap, [], 0
    snaps = history.list_snapshots(str(project_id), limit=200)
    total = len(snaps)
    visible = snaps if cap is None else snaps[:cap]
    return cap, visible, total


def _actors(db: Session, snaps: list) -> dict[str, HistoryActorOut]:
    emails = {snap.actor_email.strip().lower() for snap in snaps if getattr(snap, "actor_email", "")}
    if not emails:
        return {}
    rows = db.query(User).filter(User.email.in_(emails)).all()
    return {
        row.email.strip().lower(): HistoryActorOut(
            name=(row.name or "").strip() or None,
            email=row.email,
            avatar_url=getattr(row, "avatar_url", None),
        )
        for row in rows
        if getattr(row, "email", None)
    }


def _snapshot_out(snap, actors: dict[str, HistoryActorOut]) -> SnapshotOut:
    email = (getattr(snap, "actor_email", "") or "").strip().lower()
    actor = actors.get(email)
    if actor is None and (getattr(snap, "actor_name", "") or email):
        actor = HistoryActorOut(
            name=getattr(snap, "actor_name", "") or None,
            email=email or None,
        )
    return SnapshotOut(
        id=snap.id,
        label=snap.label,
        created_at=snap.created_at,
        files_changed=snap.files_changed,
        actor=actor,
    )


@router.get("/{project_id}/history", response_model=HistoryStatusOut)
def list_history(
    project_id: UUID,
    request: Request,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HistoryStatusOut:
    locale = resolve_locale(request)
    _opened(db, user, project_id, locale)
    cap, snaps, total = _allowed_snapshots(db, user, project_id)
    if not history.is_available():
        return HistoryStatusOut(available=False, snapshots=[])
    actors = _actors(db, snaps)
    return HistoryStatusOut(
        available=True,
        limited=cap is not None and total > len(snaps),
        total=total,
        snapshots=[_snapshot_out(snap, actors) for snap in snaps],
    )


@router.get("/{project_id}/history/{snapshot_id}", response_model=SnapshotDetailOut)
def get_snapshot(
    project_id: UUID,
    snapshot_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SnapshotDetailOut:
    locale = resolve_locale(request)
    _opened(db, user, project_id, locale)
    _cap, snaps, _total = _allowed_snapshots(db, user, project_id)
    pid = str(project_id)

    match = next((s for s in snaps if s.id == snapshot_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    files = history.snapshot_files(pid, snapshot_id)
    actors = _actors(db, [match])
    base = _snapshot_out(match, actors)
    return SnapshotDetailOut(
        **base.model_dump(),
        files=files,
        diff=history.diff(pid, snapshot_id),
        files_changed=len(files),
    )


@router.post("/{project_id}/history/{snapshot_id}/restore", response_model=RestoreResponse)
def restore_snapshot(
    project_id: UUID,
    snapshot_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestoreResponse:
    locale = resolve_locale(request)
    _opened(db, user, project_id, locale, require_edit=True)
    history.bind_history_actor(getattr(user, "name", None), user.email)
    _cap, snaps, _total = _allowed_snapshots(db, user, project_id)
    if not any(s.id == snapshot_id for s in snaps):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    if not history.is_available():
        raise HTTPException(status_code=503, detail="History is unavailable on this server")

    try:
        new_id = history.restore(str(project_id), snapshot_id)
    except history.HistoryUnavailable as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RestoreResponse(snapshot_id=new_id, restored_from=snapshot_id)
