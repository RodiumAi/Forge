"""Internal routes for RodiumAi admin (Nest) — not exposed to Forge end users."""

from __future__ import annotations

import hmac
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User, UserSettings
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


class RevokeByRodiumSubBody(BaseModel):
    rodium_sub: str = Field(min_length=1, max_length=64)


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


@router.post("/users/revoke-by-rodium-sub")
def admin_revoke_by_rodium_sub(
    body: RevokeByRodiumSubBody,
    _: None = Depends(_require_admin_secret),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    """Kill Forge sessions + wipe Rodium tokens for a suspended RodiumAi user."""
    users = db.query(User).filter(User.rodium_sub == body.rodium_sub).all()
    if not users:
        return {"revoked": 0, "rodium_sub": body.rodium_sub}

    now = datetime.now(UTC)
    for user in users:
        user.token_version = (user.token_version or 0) + 1
        user.access_blocked_at = now
        row = db.get(UserSettings, user.id)
        if row is not None:
            row.rodium_access_token_encrypted = None
            row.rodium_refresh_token_encrypted = None
            row.rodium_token_expires_at = None
            row.rodium_wallet_json = None
            row.rodium_api_key_encrypted = None
            row.rodium_api_key_hint = None
            row.rodium_api_keys_json = None
            row.selected_rodium_api_key_id = None
    db.commit()
    return {"revoked": len(users), "rodium_sub": body.rodium_sub}


@router.post("/users/restore-by-rodium-sub")
def admin_restore_by_rodium_sub(
    body: RevokeByRodiumSubBody,
    _: None = Depends(_require_admin_secret),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    """Clear Forge access block after RodiumAi reactivation."""
    users = (
        db.query(User)
        .filter(User.rodium_sub == body.rodium_sub, User.access_blocked_at.is_not(None))
        .all()
    )
    for user in users:
        user.access_blocked_at = None
    db.commit()
    return {"restored": len(users), "rodium_sub": body.rodium_sub}
