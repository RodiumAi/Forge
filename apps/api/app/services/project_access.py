"""Who may open a Forge project: the owner, or an accepted collaborator."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.i18n import t
from app.models import Project, ProjectCollaborator, User


def accessible_project(
    db: Session,
    user: User,
    project_id: UUID,
    locale: str = "fr",
    *,
    require_edit: bool = False,
) -> Project:
    """Owner, or an invited collaborator who already accepted.

    ``require_edit`` keeps viewers on read paths (preview, files, thumbnails)
    and reserves mutations for the owner and editors.
    """
    project = db.get(Project, project_id)
    if project is not None and project.user_id == user.id:
        return project
    if project is not None:
        row = db.get(ProjectCollaborator, (project.id, user.id))
        if (
            row is not None
            and row.accepted_at is not None
            and (not require_edit or row.role == "editor")
        ):
            return project
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=t("project_not_found", locale),  # type: ignore[arg-type]
    )
