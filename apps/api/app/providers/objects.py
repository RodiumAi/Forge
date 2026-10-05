from __future__ import annotations

import re

import boto3
from botocore.config import Config

from app.config import get_settings
from app.errors import provider_not_configured

_GENERIC_AWS_S3_ENDPOINT = re.compile(
    r"^https?://s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com/?$",
    re.IGNORECASE,
)

# Published site keys live under ``{slug}/…``. Refuse empty / root / traversal
# prefixes so a bug cannot list or wipe the whole shared assets bucket.
_SITE_PREFIX_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?/$")
_SITE_OBJECT_KEY_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?/.+")


def _require_site_prefix(prefix: str) -> str:
    """Normalize and validate a site assets prefix (must be ``{slug}/``)."""
    raw = (prefix or "").strip()
    if not raw or ".." in raw or "\\" in raw or raw.startswith("/"):
        raise ValueError(f"Refusing unsafe site object prefix: {prefix!r}")
    normalized = raw.lstrip("/")
    if not normalized.endswith("/"):
        normalized = f"{normalized}/"
    if not _SITE_PREFIX_RE.fullmatch(normalized):
        raise ValueError(f"Refusing unsafe site object prefix: {prefix!r}")
    return normalized


def _is_safe_site_object_key(key: str, *, under_prefix: str | None = None) -> bool:
    if not key or ".." in key or "\\" in key or key.startswith("/"):
        return False
    if not _SITE_OBJECT_KEY_RE.fullmatch(key):
        return False
    return under_prefix is None or key.startswith(under_prefix)


def _resolve_static_credentials() -> tuple[str, str]:
    return get_settings().resolved_object_store_credentials()


def _normalize_endpoint(endpoint: str | None) -> str | None:
    """Drop generic regional S3 endpoints when using virtual-hosted buckets.

    With ``addressing_style=virtual``, boto3 must resolve ``{bucket}.s3.{region}.amazonaws.com``
    per bucket. Pinning ``endpoint_url`` to ``https://s3.eu-west-1.amazonaws.com`` triggers
    ``PermanentRedirect`` on PutObject — the exact prod upload failure we saw in CloudWatch.
    """
    if not endpoint:
        return None
    s = get_settings()
    if s.object_store_addressing == "virtual" and _GENERIC_AWS_S3_ENDPOINT.match(endpoint.rstrip("/")):
        return None
    return endpoint


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
    endpoint = _normalize_endpoint(endpoint)
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

    def list_prefix(self, bucket: str, prefix: str) -> list[str]:
        """Return object keys under a strict ``{slug}/`` prefix (paginated)."""
        safe_prefix = _require_site_prefix(prefix)
        keys: list[str] = []
        token: str | None = None
        while True:
            kwargs: dict = {"Bucket": bucket, "Prefix": safe_prefix}
            if token:
                kwargs["ContinuationToken"] = token
            resp = self.internal.list_objects_v2(**kwargs)
            for obj in resp.get("Contents") or []:
                key = obj.get("Key")
                if isinstance(key, str) and _is_safe_site_object_key(key, under_prefix=safe_prefix):
                    keys.append(key)
            if resp.get("IsTruncated") is not True:
                break
            token = resp.get("NextContinuationToken")
            if not isinstance(token, str) or not token:
                break
        return keys

    def delete_keys(self, bucket: str, keys: list[str], *, under_prefix: str | None = None) -> int:
        """Delete specific keys in batches of 1000. Returns deleted count.

        Only keys that look like site objects under ``{slug}/…`` are deleted.
        When ``under_prefix`` is set it must already be a validated site prefix.
        """
        scope = _require_site_prefix(under_prefix) if under_prefix is not None else None
        deleted = 0
        batch: list[dict] = []
        for key in keys:
            if not _is_safe_site_object_key(key, under_prefix=scope):
                raise ValueError(f"Refusing to delete unsafe site object key: {key!r}")
            batch.append({"Key": key})
            if len(batch) >= 1000:
                self.internal.delete_objects(Bucket=bucket, Delete={"Objects": batch})
                deleted += len(batch)
                batch = []
        if batch:
            self.internal.delete_objects(Bucket=bucket, Delete={"Objects": batch})
            deleted += len(batch)
        return deleted

    def delete_prefix(self, bucket: str, prefix: str) -> int:
        """Delete keys under a strict site prefix (list snapshot, then batch delete).

        Only keys present at list time are removed — never re-list after deletes.
        Callers must hold the slug uniqueness lock in Postgres until this returns
        (see ``purge_site_prefix``), otherwise a concurrent publish under the same
        prefix can be wiped mid-flight.
        """
        safe_prefix = _require_site_prefix(prefix)
        keys = self.list_prefix(bucket, safe_prefix)
        if not keys:
            return 0
        return self.delete_keys(bucket, keys, under_prefix=safe_prefix)

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

    def presign_get(
        self,
        bucket: str,
        key: str,
        expires: int = 3600,
        *,
        download_name: str | None = None,
    ) -> str:
        params = {"Bucket": bucket, "Key": key}
        if download_name is not None:
            safe_name = download_name.replace('"', "").replace("\n", "").replace("\r", "")
            params.update(
                {
                    "ResponseContentDisposition": f'attachment; filename="{safe_name or "download"}"',
                    "ResponseContentType": "application/octet-stream",
                }
            )
        return self.public.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires,
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
