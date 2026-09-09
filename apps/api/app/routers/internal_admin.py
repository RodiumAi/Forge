"""Internal routes for RodiumAi admin (Nest) — not exposed to Forge end users."""

from __future__ import annotations

import hmac
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services.project_delete import delete_project_by_id

router = APIRouter(prefix="/internal/admin", tags=["internal-admin"])


def _require_admin_secret(x_forge_admin_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = (settings.admin_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "forge_admin_unconfigured", "message": "ADMIN_SECRET is not set."},
        )
    if not x_forge_admin_secret or not hmac.compare_digest(x_forge_admin_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "forge_admin_unauthorized", "message": "Invalid admin secret."},
        )


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def admin_delete_project(
    project_id: UUID,
    _: None = Depends(_require_admin_secret),
    db: Session = Depends(get_db),
) -> Response:
    """Full project delete: preview stop, workspace, S3 prefix, DB cascade."""
    if not delete_project_by_id(db, project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "forge_project_not_found", "message": "Project not found."},
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/platform-settings/env-defaults")
def admin_platform_env_defaults(_: None = Depends(_require_admin_secret)) -> dict[str, str]:
    """Env bootstrap defaults for RodiumAi admin (compare with DB overrides)."""
    s = get_settings()
    return {
        "defaultModel": s.default_model,
        "defaultImageModel": s.default_image_model,
        "liteModel": s.lite_model,
        "escalationModel": s.escalation_model,
    }
