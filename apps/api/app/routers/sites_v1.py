"""Public host resolution for the sites gateway (Caddy).

The gateway receives `Host: www.client.com`, asks this endpoint which Forge
slug serves it, then fetches `{slug}/index.html` from the assets bucket.

- `GET /v1/resolve-host` — JSON (debug / tooling)
- `GET /v1/authorize-host` — forward_auth target; 200 + `X-Site-Slug` header

Unauthenticated by design: only maps *validated* hostnames to slugs.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel

from app.db import SessionLocal
from app.models import Project, ProjectDomain
from app.services.domains import STATUS_VALIDATED

router = APIRouter(prefix="/v1", tags=["sites"])

_CACHE_TTL_SECONDS = 60.0
# hostname → (expires_at_monotonic, slug | None). Per-instance cache is fine in
# v1 (single API service); swap for Redis if the API scales horizontally.
_cache: dict[str, tuple[float, str | None]] = {}


class ResolveHostOut(BaseModel):
    slug: str
    bucket_prefix: str


def _parse_hostname(raw: str) -> str:
    return (raw or "").strip().strip(".").lower().split(":")[0]


def _lookup_slug(hostname: str) -> str | None:
    with SessionLocal() as db:
        row = (
            db.query(ProjectDomain, Project)
            .join(Project, Project.id == ProjectDomain.project_id)
            .filter(
                ProjectDomain.hostname == hostname,
                ProjectDomain.status == STATUS_VALIDATED,
            )
            .first()
        )
        return row[1].slug if row else None


def _resolve_slug(hostname: str) -> str | None:
    if not hostname:
        return None
    now = time.monotonic()
    cached = _cache.get(hostname)
    if cached and cached[0] > now:
        return cached[1]
    try:
        slug = _lookup_slug(hostname)
        _cache[hostname] = (now + _CACHE_TTL_SECONDS, slug)
        return slug
    except Exception:
        return cached[1] if cached else None


def clear_resolve_cache(hostname: str | None = None) -> None:
    if hostname:
        _cache.pop(hostname.lower(), None)
    else:
        _cache.clear()


@router.get("/resolve-host", response_model=ResolveHostOut)
def resolve_host(
    x_rodium_forwarded_host: str = Header(default=""),
) -> ResolveHostOut:
    hostname = _parse_hostname(x_rodium_forwarded_host)
    if not hostname:
        raise HTTPException(status_code=400, detail="missing_host")

    slug = _resolve_slug(hostname)
    if not slug:
        raise HTTPException(status_code=404, detail="unknown_host")
    return ResolveHostOut(slug=slug, bucket_prefix=f"{slug}/")


@router.get("/authorize-host", include_in_schema=False)
def authorize_host(
    x_rodium_forwarded_host: str = Header(default=""),
) -> Response:
    """Caddy forward_auth: 200 + X-Site-Slug when the host is validated."""
    hostname = _parse_hostname(x_rodium_forwarded_host)
    if not hostname:
        raise HTTPException(status_code=400, detail="missing_host")

    slug = _resolve_slug(hostname)
    if not slug:
        raise HTTPException(status_code=404, detail="unknown_host")
    return Response(status_code=200, headers={"X-Site-Slug": slug})
