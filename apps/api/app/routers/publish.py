from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services.domains import get_project_domain, sites_url_for_project
from app.services.export_project import build_export_zip
from app.services.publish_esm import publish_project_esm

router = APIRouter(prefix="/projects", tags=["publish"])


class PublishResponse(BaseModel):
    ok: bool = True
    public_url: str
    files_uploaded: int = 0
    slug: str
    published_at: datetime | None = None


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))  # type: ignore[arg-type]
    return project


@router.get("/{project_id}/publish", response_model=PublishResponse)
def publish_status(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublishResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    settings = get_settings()
    domain = get_project_domain(db, project.id)
    return PublishResponse(
        public_url=sites_url_for_project(settings, project, domain),
        files_uploaded=0,
        slug=project.slug,
        published_at=getattr(project, "published_at", None),
    )


@router.post("/{project_id}/publish", response_model=PublishResponse)
async def publish_now(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublishResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    try:
        result = await publish_project_esm(
            str(project.id),
            project.slug,
            owner_user_id=str(user.id),
            # Fallback title when the project index.html has no <title>.
            title=project.name or "Forge app",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:2000]) from exc

    from datetime import datetime

    project.published_at = datetime.now(UTC)
    project.status = "published"
    db.commit()
    db.refresh(project)

    domain = get_project_domain(db, project.id)
    return PublishResponse(
        public_url=sites_url_for_project(get_settings(), project, domain),
        files_uploaded=int(result.get("files_uploaded") or 0),
        slug=project.slug,
        published_at=project.published_at,
    )


@router.get("/{project_id}/export")
def export_project_zip(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    try:
        data, filename = build_export_zip(
            project_id=str(project.id),
            project_name=project.name or project.slug,
            locale=locale,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:2000]) from exc

    safe_name = "".join(c if c.isascii() and (c.isalnum() or c in "-_.") else "-" for c in filename)
    if not safe_name.endswith(".zip"):
        safe_name = (project.slug or "project") + "-export.zip"

    return StreamingResponse(
        iter([data]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Content-Length": str(len(data)),
        },
    )
