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

router = APIRouter(prefix="/projects", tags=["history"])


class SnapshotOut(BaseModel):
    id: str
    label: str
    created_at: str
    files_changed: int = 0


class SnapshotDetailOut(SnapshotOut):
    files: list[str] = []
    diff: str = ""


class RestoreResponse(BaseModel):
    ok: bool = True
    snapshot_id: str | None = None
    restored_from: str


class HistoryStatusOut(BaseModel):
    available: bool
    snapshots: list[SnapshotOut] = []


def _owned(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


@router.get("/{project_id}/history", response_model=HistoryStatusOut)
def list_history(
    project_id: UUID,
    request: Request,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HistoryStatusOut:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    if not history.is_available():
        return HistoryStatusOut(available=False, snapshots=[])
    limit = max(1, min(limit, 200))
    snaps = history.list_snapshots(str(project_id), limit=limit)
    return HistoryStatusOut(
        available=True,
        snapshots=[SnapshotOut(**s.as_dict()) for s in snaps],
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
    _owned(db, user, project_id, locale)
    pid = str(project_id)

    match = next((s for s in history.list_snapshots(pid, limit=200) if s.id == snapshot_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    files = history.snapshot_files(pid, snapshot_id)
    return SnapshotDetailOut(
        **match.as_dict() | {"files_changed": len(files)},
        files=files,
        diff=history.diff(pid, snapshot_id),
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
    _owned(db, user, project_id, locale)
    if not history.is_available():
        raise HTTPException(status_code=503, detail="History is unavailable on this server")

    try:
        new_id = history.restore(str(project_id), snapshot_id)
    except history.HistoryUnavailable as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RestoreResponse(snapshot_id=new_id, restored_from=snapshot_id)
