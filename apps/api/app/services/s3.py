from __future__ import annotations

from uuid import uuid4

from app.config import get_settings
from app.errors import provider_not_configured
from app.providers.objects import get_object_store


def public_url_for_key(object_key: str) -> str:
    settings = get_settings()
    store = get_object_store()
    bucket = store.bucket_uploads or settings.aws_s3_bucket
    return store.public_url(bucket, object_key)


def build_object_key(*, user_id: str, project_slug: str, filename: str) -> str:
    settings = get_settings()
    safe = filename.replace("\\", "/").split("/")[-1]
    prefix = settings.object_store_prefix or settings.aws_s3_prefix
    return f"{prefix}/{user_id}/{project_slug}/{uuid4().hex}-{safe}"


def upload_bytes(object_key: str, body: bytes, content_type: str) -> str:
    settings = get_settings()
    if not settings.object_store_enabled:
        raise provider_not_configured("Object store (S3-compatible)")
    store = get_object_store()
    bucket = store.bucket_uploads or settings.aws_s3_bucket
    return store.put(bucket, object_key, body, content_type)
