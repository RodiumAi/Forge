from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import PreviewComment, Project, User

router = APIRouter(prefix="/projects", tags=["comments"])


class CommentCreate(BaseModel):
    selector: str = Field(default="", max_length=500)
    anchor_label: str = Field(default="", max_length=200)
    body: str = Field(min_length=1, max_length=4000)


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CommentOut(BaseModel):
    id: UUID
    project_id: UUID
    selector: str
    anchor_label: str
    body: str
    created_at: object
    updated_at: object

    model_config = {"from_attributes": True}


def _owned(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


@router.get("/{project_id}/comments", response_model=list[CommentOut])
def list_comments(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PreviewComment]:
    _owned(db, user, project_id, resolve_locale(request))
    return (
        db.query(PreviewComment)
        .filter(PreviewComment.project_id == project_id)
        .order_by(PreviewComment.created_at.desc())
        .all()
    )


@router.post("/{project_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(
    project_id: UUID,
    body: CommentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewComment:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    row = PreviewComment(
        project_id=project_id,
        user_id=user.id,
        selector=(body.selector or "").strip()[:500],
        anchor_label=(body.anchor_label or "").strip()[:200],
        body=body.body.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{project_id}/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    project_id: UUID,
    comment_id: UUID,
    body: CommentUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewComment:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    row = db.get(PreviewComment, comment_id)
    if row is None or row.project_id != project_id:
        raise HTTPException(status_code=404, detail=t("comment_not_found", locale))  # type: ignore[arg-type]
    row.body = body.body.strip()
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{project_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    project_id: UUID,
    comment_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    row = db.get(PreviewComment, comment_id)
    if row is None or row.project_id != project_id:
        raise HTTPException(status_code=404, detail=t("comment_not_found", locale))  # type: ignore[arg-type]
    db.delete(row)
    db.commit()
