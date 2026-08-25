from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services.publish import publish_project

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
    return PublishResponse(
        public_url=settings.sites_url_for_slug(project.slug),
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
        result = await publish_project(str(project.id), project.slug)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:2000]) from exc

    from datetime import datetime, timezone

    project.published_at = datetime.now(timezone.utc)
    project.status = "published"
    db.commit()
    db.refresh(project)

    return PublishResponse(
        public_url=result["public_url"],
        files_uploaded=int(result.get("files_uploaded") or 0),
        slug=project.slug,
        published_at=project.published_at,
    )
