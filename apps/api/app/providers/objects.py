from __future__ import annotations

import boto3
from botocore.config import Config

from app.config import get_settings
from app.errors import provider_not_configured


def _resolve_static_credentials() -> tuple[str, str]:
    return get_settings().resolved_object_store_credentials()


def _client(endpoint: str | None):
    s = get_settings()
    access, secret = _resolve_static_credentials()
    if s.is_local and (not access or not secret):
        raise provider_not_configured("Object store (S3-compatible)")
    kwargs: dict = {
        "service_name": "s3",
        "region_name": s.object_store_region or s.aws_s3_region,
        "config": Config(
            signature_version="s3v4",
            s3={"addressing_style": s.object_store_addressing},
            retries={"max_attempts": 3, "mode": "standard"},
            connect_timeout=3,
            read_timeout=10,
        ),
    }
    if access and secret:
        kwargs["aws_access_key_id"] = access
        kwargs["aws_secret_access_key"] = secret
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client(**kwargs)

class ObjectStore:
    """
    Deux clients volontairement distincts.

    - internal: opérations serveur (put, get, delete, head) — hostname Docker en local.
    - public: signature d'URL destinées au navigateur (pas d'appel réseau).
    """

    def __init__(self) -> None:
        s = get_settings()
        internal_endpoint = s.object_store_endpoint or None
        public_endpoint = s.object_store_public_endpoint or s.object_store_endpoint or None
        self.bucket_uploads = s.bucket_uploads or s.aws_s3_bucket
        self.bucket_site_assets = s.bucket_site_assets
        self.bucket_runtime = s.bucket_runtime
        self.prefix = s.object_store_prefix or s.aws_s3_prefix
        self._public_base = (s.object_store_public_endpoint or s.aws_s3_public_base_url or "").rstrip("/")
        self._endpoint = public_endpoint
        self.internal = _client(internal_endpoint)
        self.public = _client(public_endpoint)

    def public_url(self, bucket: str, key: str) -> str:
        key = key.lstrip("/")
        s = get_settings()
        base = self._public_base
        if not base:
            return f"s3://{bucket}/{key}"
        # Path-style (MinIO local): include bucket. Virtual / CDN (prod): key only.
        if s.object_store_addressing == "path":
            return f"{base}/{bucket}/{key}"
        return f"{base}/{key}"

    def put(self, bucket: str, key: str, body: bytes, content_type: str) -> str:
        self.internal.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType=content_type or "application/octet-stream",
        )
        return self.public_url(bucket, key)

    def head(self, bucket: str, key: str) -> dict:
        return self.internal.head_object(Bucket=bucket, Key=key)

    def delete(self, bucket: str, key: str) -> None:
        self.internal.delete_object(Bucket=bucket, Key=key)

    def delete_prefix(self, bucket: str, prefix: str) -> int:
        """Best-effort recursive delete of keys under prefix. Returns deleted count."""
        deleted = 0
        token: str | None = None
        while True:
            kwargs: dict = {"Bucket": bucket, "Prefix": prefix.lstrip("/")}
            if token:
                kwargs["ContinuationToken"] = token
            resp = self.internal.list_objects_v2(**kwargs)
            objects = [{"Key": obj["Key"]} for obj in resp.get("Contents") or []]
            if objects:
                self.internal.delete_objects(Bucket=bucket, Delete={"Objects": objects})
                deleted += len(objects)
            if not resp.get("IsTruncated"):
                break
            token = resp.get("NextContinuationToken")
        return deleted

    def presign_put(
        self, bucket: str, key: str, content_type: str, max_bytes: int, expires: int = 900
    ) -> dict:
        return self.public.generate_presigned_post(
            Bucket=bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes],
            ],
            ExpiresIn=expires,
        )

    def presign_get(self, bucket: str, key: str, expires: int = 3600) -> str:
        return self.public.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires
        )


_store: ObjectStore | None = None


def get_object_store() -> ObjectStore:
    global _store
    if _store is None:
        _store = ObjectStore()
    return _store


def reset_object_store() -> None:
    global _store
    _store = None
