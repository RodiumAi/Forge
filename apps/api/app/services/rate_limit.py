"""Fixed-window rate limiting for the anonymous auth routes.

Forge had no throttling at all, which was defensible while every entry point
required an OIDC round-trip. Local sign-up, login, password reset and "resend"
are reachable by anyone with the URL, so they need a ceiling — otherwise the
reset endpoint becomes a free mail cannon pointed at arbitrary addresses.

Redis-backed (already a dependency, already running in the stack) with an
in-process fallback so a single-container clone without Redis still gets the
protection rather than silently getting none. The fallback is per-process and
therefore weaker behind multiple workers; that is the honest trade for not
making Redis mandatory.

Fails **open** on a Redis error: a broken cache should not lock everyone out
of signing in. That is the opposite choice from the pay-session guard, and for
the opposite reason — there the failure mode is "someone keeps a revoked
session", here it is "nobody can log in".
"""

from __future__ import annotations

import logging
import time
from threading import Lock

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.i18n import resolve_locale, t

logger = logging.getLogger("rate_limit")

_PREFIX = "forge:rl:"

_local_hits: dict[str, tuple[int, float]] = {}
_local_lock = Lock()


def _client_ip(request: Request) -> str:
    # The stack runs behind Caddy/ALB, so the socket address is the proxy.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _incr_local(key: str, window: int) -> int:
    now = time.monotonic()
    with _local_lock:
        hits, expires_at = _local_hits.get(key, (0, 0.0))
        if expires_at <= now:
            hits, expires_at = 0, now + window
        hits += 1
        _local_hits[key] = (hits, expires_at)
        if len(_local_hits) > 10_000:  # crude bound; keys are tiny and short-lived
            for stale_key, (_, stale_expiry) in list(_local_hits.items()):
                if stale_expiry <= now:
                    _local_hits.pop(stale_key, None)
        return hits


def _incr_redis(key: str, window: int) -> int | None:
    try:
        import redis  # lazy: the fallback must work without the server

        client = redis.Redis.from_url(get_settings().redis_url)
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window, nx=True)
        hits, _ = pipe.execute()
        return int(hits)
    except Exception as exc:
        logger.debug("rate-limit redis unavailable (%s); using in-process counter", exc)
        return None


def enforce(request: Request, bucket: str, limit: int, window_seconds: int, subject: str = "") -> None:
    """Raise 429 once `limit` hits are seen in `window_seconds`.

    `subject` narrows the bucket beyond the caller's IP — pass the target
    email on reset/resend so one address cannot be mailed repeatedly from a
    rotating set of addresses.
    """
    identity = subject.strip().lower() or _client_ip(request)
    key = f"{_PREFIX}{bucket}:{identity}"

    hits = _incr_redis(key, window_seconds)
    if hits is None:
        hits = _incr_local(key, window_seconds)

    if hits > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=t("too_many_requests", resolve_locale(request)),
            headers={"Retry-After": str(window_seconds)},
        )
