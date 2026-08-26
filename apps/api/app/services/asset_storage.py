"""Upload user assets to S3-compatible object store (forge-uploads bucket)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import provider_not_configured
from app.models import Project, StoredObject, User
from app.services import s3 as s3_service
from app.services.capabilities import assert_managed_storage_quota


def asset_display_name(object_key: str) -> str:
    """Extract original filename from `{prefix}/.../{uuid}-{filename}`."""
    base = object_key.replace("\\", "/").split("/")[-1]
    if "-" in base:
        return base.split("-", 1)[1] or base
    return base


def upload_project_asset(
    db: Session,
    *,
    user: User,
    project: Project,
    body: bytes,
    filename: str,
    content_type: str,
) -> StoredObject:
    settings = get_settings()
    if not settings.object_store_enabled:
        raise provider_not_configured(
            "Object store (S3/MinIO). Start MinIO or configure OBJECT_STORE_* / AWS_* env vars."
        )

    assert_managed_storage_quota(db, user, len(body))

    safe_name = (filename or "image.png").replace("\\", "/").split("/")[-1]
    object_key = s3_service.build_object_key(
        user_id=str(user.id),
        project_slug=project.slug,
        filename=safe_name,
    )
    public_url = s3_service.upload_bytes(object_key, body, content_type)
    row = StoredObject(
        user_id=user.id,
        project_id=project.id,
        object_key=object_key,
        content_type=content_type,
        byte_size=len(body),
        public_url=public_url,
        adapter="s3",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_project_assets(db: Session, project_id: UUID) -> list[StoredObject]:
    return (
        db.query(StoredObject)
        .filter(StoredObject.project_id == project_id)
        .order_by(StoredObject.created_at.desc())
        .all()
    )


def get_project_asset(db: Session, project_id: UUID, object_id: UUID) -> StoredObject | None:
    return (
        db.query(StoredObject)
        .filter(StoredObject.project_id == project_id, StoredObject.id == object_id)
        .first()
    )
