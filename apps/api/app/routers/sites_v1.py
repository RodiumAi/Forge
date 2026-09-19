"""Public host resolution for the sites gateway (Caddy).

The gateway receives `Host: www.client.com`, asks this endpoint which Forge
slug serves it, then fetches `{slug}/index.html` from the assets bucket.

- `GET /v1/resolve-host` — JSON (debug / tooling)
- `GET /v1/authorize-host` — forward_auth target; 200 + `X-Site-Slug` header

Unauthenticated by design: only maps *validated* hostnames to slugs. Because
anyone can call it, the hostname is checked before it is used as a cache key or
a query parameter, and the cache is bounded.
"""

from __future__ import annotations

import re
import time
from collections import OrderedDict
from threading import Lock

from fastapi import APIRouter, Header, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import SessionLocal
from app.models import Project, ProjectDomain
from app.services import rate_limit
from app.services.domains import STATUS_VALIDATED

router = APIRouter(prefix="/v1", tags=["sites"])

_CACHE_TTL_SECONDS = 60.0
# hostname → (expires_at_monotonic, slug | None), least recently used first.
# Bounded because the key comes from a request header: an unbounded dict grows
# with every distinct name a caller cares to send. Per-instance cache is fine in
# v1 (single API service); swap for Redis if the API scales horizontally.
_CACHE_MAX_ENTRIES = 2048
_cache: OrderedDict[str, tuple[float, str | None]] = OrderedDict()
# Requests run in the threadpool and the LRU bookkeeping is not atomic.
_cache_lock = Lock()

# DNS limits: 253 characters overall, 1-63 per label, letters/digits/hyphen,
# no hyphen at either end of a label.
_MAX_HOSTNAME_LENGTH = 253
_LABEL_RE = re.compile(r"(?!-)[a-z0-9-]{1,63}(?<!-)")

# resolve-host is a debug / tooling route: nothing legitimate calls it in volume.
RESOLVE_HOST_LIMIT_PER_MINUTE = 60


class ResolveHostOut(BaseModel):
    slug: str
    bucket_prefix: str


def _parse_hostname(raw: str) -> str:
    """Normalise the forwarded host: "" when absent, 404 when it cannot be a hostname.

    Runs before the cache or the database are touched, so a malformed or
    oversized value costs nothing. The 404 is the same answer an unknown host
    gets, so it tells a caller nothing extra.
    """
    host = (raw or "").strip().strip(".").lower().split(":")[0]
    if not host:
        return ""
    if len(host) > _MAX_HOSTNAME_LENGTH or not all(_LABEL_RE.fullmatch(label) for label in host.split(".")):
        raise HTTPException(status_code=404, detail="unknown_host")
    return host


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


def _cache_get(hostname: str) -> tuple[float, str | None] | None:
    with _cache_lock:
        entry = _cache.get(hostname)
        if entry is not None:
            _cache.move_to_end(hostname)
        return entry


def _cache_put(hostname: str, entry: tuple[float, str | None]) -> None:
    with _cache_lock:
        _cache[hostname] = entry
        _cache.move_to_end(hostname)
        while len(_cache) > _CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)


def _resolve_slug(hostname: str) -> str | None:
    if not hostname:
        return None
    now = time.monotonic()
    cached = _cache_get(hostname)
    if cached and cached[0] > now:
        return cached[1]
    try:
        slug = _lookup_slug(hostname)
        _cache_put(hostname, (now + _CACHE_TTL_SECONDS, slug))
        return slug
    except Exception:
        return cached[1] if cached else None


def clear_resolve_cache(hostname: str | None = None) -> None:
    with _cache_lock:
        if hostname:
            _cache.pop(hostname.lower(), None)
        else:
            _cache.clear()


@router.get("/resolve-host", response_model=ResolveHostOut)
def resolve_host(
    request: Request,
    x_rodium_forwarded_host: str = Header(default=""),
) -> ResolveHostOut:
    rate_limit.enforce(request, "sites-resolve-host", limit=RESOLVE_HOST_LIMIT_PER_MINUTE, window_seconds=60)
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
    """Caddy forward_auth: 200 + X-Site-Slug when the host is validated.

    Deliberately not rate-limited per IP: the gateway calls this for every
    request to a custom domain, and everything it forwards reaches the API from
    the gateway's own address, so an IP bucket would throttle all custom-domain
    traffic together. The hostname check and the bounded cache limit what a
    caller can make this route do instead.
    """
    hostname = _parse_hostname(x_rodium_forwarded_host)
    if not hostname:
        raise HTTPException(status_code=400, detail="missing_host")

    slug = _resolve_slug(hostname)
    if not slug:
        raise HTTPException(status_code=404, detail="unknown_host")
    return Response(status_code=200, headers={"X-Site-Slug": slug})
