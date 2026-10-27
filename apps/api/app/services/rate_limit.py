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

import ipaddress
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


def _peer_is_trusted(peer: str, cidrs: list[str]) -> bool:
    try:
        addr = ipaddress.ip_address(peer)
    except ValueError:
        return False
    for cidr in cidrs:
        try:
            if addr in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            continue
    return False


def _client_ip(request: Request) -> str:
    """Resolve the caller IP for rate-limit buckets.

    Never take ``X-Forwarded-For``'s leftmost entry blindly — that header is
    client-controllable. Only trust XFF when the TCP peer is a known proxy
    (private/loopback by default), then pick the entry inserted by that hop:
    ``parts[len(parts) - hops]``. Direct hits to the API ignore XFF entirely.
    """
    settings = get_settings()
    peer = request.client.host if request.client else "unknown"
    hops = settings.trusted_proxy_hops
    if hops <= 0 or peer == "unknown" or not _peer_is_trusted(peer, settings.trusted_proxy_cidr_list):
        return peer

    forwarded = request.headers.get("x-forwarded-for")
    if not forwarded:
        return peer

    parts = [p.strip() for p in forwarded.split(",") if p.strip()]
    if not parts:
        return peer

    # hops=1 + "fake, real" → real; hops=2 + "fake, client, edge" → client.
    return parts[max(0, len(parts) - hops)]


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


def _key(request: Request, bucket: str, subject: str, per_ip: bool) -> str:
    """Bucket key: the caller IP, the subject, or both.

    A bucket keyed on a subject alone (an email) can be filled by anyone who
    knows the address, which locks its owner out. `per_ip` keeps the subject
    but adds the caller IP, so only the caller's own budget runs out.
    """
    subject = subject.strip().lower()
    if not subject:
        return f"{_PREFIX}{bucket}:{_client_ip(request)}"
    if per_ip:
        return f"{_PREFIX}{bucket}:{subject}|{_client_ip(request)}"
    return f"{_PREFIX}{bucket}:{subject}"


def _hit(key: str, window: int) -> int:
    hits = _incr_redis(key, window)
    return _incr_local(key, window) if hits is None else hits


def _decr_local(key: str) -> None:
    now = time.monotonic()
    with _local_lock:
        hits, expires_at = _local_hits.get(key, (0, 0.0))
        if hits > 0 and expires_at > now:
            _local_hits[key] = (hits - 1, expires_at)


def _decr_redis(key: str) -> bool:
    try:
        import redis

        client = redis.Redis.from_url(get_settings().redis_url)
        # Never below zero, never on an expired key (DECR would recreate it).
        client.eval(
            "local v = tonumber(redis.call('GET', KEYS[1]) or '0') "
            "if v > 0 then redis.call('DECR', KEYS[1]) end return 0",
            1,
            key,
        )
        return True
    except Exception as exc:
        logger.debug("rate-limit redis unavailable (%s); using in-process counter", exc)
        return False


def _too_many(request: Request, window_seconds: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=t("too_many_requests", resolve_locale(request)),
        headers={"Retry-After": str(window_seconds)},
    )


def enforce(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
    subject: str = "",
    *,
    per_ip: bool = False,
) -> None:
    """Count one hit and raise 429 once `limit` hits are seen in `window_seconds`.

    `subject` keys the bucket on something other than the caller's IP (a user
    id). Pass `per_ip=True` when the subject is something a stranger can name,
    such as an email: see `_key`.
    """
    if _hit(_key(request, bucket, subject, per_ip), window_seconds) > limit:
        raise _too_many(request, window_seconds)


def allow(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
    subject: str = "",
    *,
    per_ip: bool = False,
) -> bool:
    """Count one hit; False past `limit`. For caps the caller enforces silently."""
    return _hit(_key(request, bucket, subject, per_ip), window_seconds) <= limit


def refund(request: Request, bucket: str, subject: str = "", *, per_ip: bool = False) -> None:
    """Give back one hit counted by `enforce`.

    To count failures only: `enforce` before the attempt (atomic, so parallel
    attempts cannot all slip under the limit), `refund` once it succeeds.
    """
    key = _key(request, bucket, subject, per_ip)
    if not _decr_redis(key):
        _decr_local(key)
