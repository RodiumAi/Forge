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


def get_project_asset_by_public_url(db: Session, project_id: UUID, public_url: str) -> StoredObject | None:
    """Resolve a StoredObject from the URL returned by upload (private bucket)."""
    url = (public_url or "").strip()
    if not url:
        return None
    return (
        db.query(StoredObject)
        .filter(StoredObject.project_id == project_id, StoredObject.public_url == url)
        .order_by(StoredObject.created_at.desc())
        .first()
    )


def is_private_upload_url(url: str) -> bool:
    """True when `url` points at our private uploads bucket (never usable as img src)."""
    value = (url or "").strip()
    if not value.startswith(("http://", "https://")):
        return False
    settings = get_settings()
    bucket = (settings.bucket_uploads or settings.aws_s3_bucket or "").strip()
    if not bucket:
        return False
    # Path-style: http://host:9000/forge-uploads/key
    # Virtual-style: http://forge-uploads.host/key
    return f"/{bucket}/" in value or value.startswith((f"http://{bucket}.", f"https://{bucket}."))


def materialize_asset_to_public(db: Session, project_id: UUID, object_id: UUID) -> str:
    """Copy a stored upload into the project's `public/images/`; return its web path.

    An image placed in the site must live in the project files: the uploads
    bucket is private, so writing its URL into the JSX gave a 403 in the
    preview iframe — and a hardcoded object-store host would break the same
    image at publish and export time. `public/` is copied verbatim by publish
    and export, so a `/images/...` path works everywhere.
    """
    from app.providers.objects import get_object_store
    from app.services.filesystem import write_bytes

    row = get_project_asset(db, project_id, object_id)
    if row is None:
        raise FileNotFoundError("asset_not_found")

    store = get_object_store()
    bucket = store.bucket_uploads or get_settings().aws_s3_bucket
    if not bucket:
        raise provider_not_configured("Object store (S3/MinIO)")
    obj = store.internal.get_object(Bucket=bucket, Key=row.object_key)
    body = obj["Body"].read()

    name = asset_display_name(row.object_key)
    safe = "".join(c if c.isalnum() or c in ".-_" else "-" for c in name).strip("-.") or "image.png"
    # Object-id prefix: stable (re-picking the same asset overwrites, no
    # duplicate files) and collision-free across same-named uploads.
    rel = f"public/images/{str(object_id)[:8]}-{safe}"
    write_bytes(str(project_id), rel, body)
    return "/" + rel[len("public/") :]
