"""Plan-run queue, claim helpers and event log (Valkey/Redis).

Phase 3: background worker. Until then, claim helpers are no-ops that return False
so get_active_run can treat orphaned "running" rows as resumable.

Three properties this module has to guarantee, learned the hard way:

1. **It must never block the event loop.** The API runs a single uvicorn worker,
   and the plan job runs on that same loop. This module used to build a fresh
   synchronous `redis.Redis` on every call with no `socket_timeout` — redis-py
   defaults to blocking *indefinitely* — and `iter_run_event_sse` called it four
   times a second per open stream. A Valkey that hung rather than refused froze
   every request in the process, which is what "it spins for minutes and nothing
   happens" looked like from the browser.

2. **It must degrade, not stall.** A short socket timeout still costs that
   timeout on every call once Valkey is sick. The breaker below stops asking for
   a while and falls through to the in-process mirror instead.

3. **It must not poll when it does not have to.** The producer is in this very
   process, so it can simply say when there is something new. Redis polling is
   the fallback for the day a real out-of-process worker exists.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

CLAIM_KEY = "forge:run:claim:{run_id}"
EVENTS_KEY = "forge:run:events:{run_id}"
QUEUE_KEY = "forge:plan:queue"
CANCEL_KEY = "forge:run:cancel:{run_id}"

# In-process mirror of run events. Valkey being down used to be a SILENT
# infinite spinner: `redis.from_url` builds a client without connecting, every
# call then failed inside a suppress, published events vanished and the UI
# polled an empty list forever. The plan job runs in this very process, so a
# memory mirror always has the events; Valkey remains the durable layer when
# reachable (it survives API restarts).
_MEM_EVENTS: dict[str, list[dict[str, Any]]] = {}
_MEM_ORDER: list[str] = []
_MEM_MAX_RUNS = 50

# Wake-ups for readers of a run's event log, so `iter_run_event_sse` can wait to
# be told instead of asking Redis 4x/second. Bounded alongside _MEM_EVENTS.
_SIGNALS: dict[str, asyncio.Event] = {}

# Short enough that a sick Valkey costs a blip, not a hang.
_SOCKET_TIMEOUT_S = 0.5
# Consecutive failures before we stop asking, and for how long.
_BREAKER_THRESHOLD = 3
_BREAKER_COOLDOWN_S = 30.0

_client: Any = None
_client_url: str | None = None
_fail_count = 0
_breaker_open_until = 0.0


def _mem_track(run_id: str) -> list[dict[str, Any]]:
    events = _MEM_EVENTS.get(run_id)
    if events is None:
        events = _MEM_EVENTS.setdefault(run_id, [])
        _MEM_ORDER.append(run_id)
        while len(_MEM_ORDER) > _MEM_MAX_RUNS:
            drop = _MEM_ORDER.pop(0)
            _MEM_EVENTS.pop(drop, None)
            _SIGNALS.pop(drop, None)
    return events


# ── Client + breaker ───────────────────────────────────────────────────────


def _note_failure() -> None:
    global _fail_count, _breaker_open_until, _client
    _fail_count += 1
    if _fail_count >= _BREAKER_THRESHOLD:
        _breaker_open_until = time.monotonic() + _BREAKER_COOLDOWN_S
        _client = None  # drop the pool; a fresh one is built after the cooldown
        logger.warning(
            "redis unhealthy after %d failures — falling back to the in-process "
            "event mirror for %.0fs",
            _fail_count,
            _BREAKER_COOLDOWN_S,
        )


def _note_success() -> None:
    global _fail_count
    if _fail_count:
        _fail_count = 0


def _redis():
    """The shared client, or None when Redis is absent or the breaker is open.

    Callers treat None as "Redis is not available right now" and fall back to
    the memory mirror. They must not distinguish it from an exception.
    """
    global _client, _client_url

    if time.monotonic() < _breaker_open_until:
        return None

    url = get_settings().redis_url
    if not url:
        return None

    if _client is not None and _client_url == url:
        return _client

    try:
        import redis

        _client = redis.Redis.from_url(
            url,
            decode_responses=True,
            socket_timeout=_SOCKET_TIMEOUT_S,
            socket_connect_timeout=_SOCKET_TIMEOUT_S,
            health_check_interval=30,
        )
        _client_url = url
        return _client
    except Exception as exc:
        logger.debug("redis unavailable: %s", exc)
        _note_failure()
        return None


def reset_client_for_tests() -> None:
    """Drop the cached client and re-arm the breaker (tests only)."""
    global _client, _client_url, _fail_count, _breaker_open_until
    _client = None
    _client_url = None
    _fail_count = 0
    _breaker_open_until = 0.0


# ── Claims ─────────────────────────────────────────────────────────────────


def is_run_claimed(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        claimed = bool(client.exists(CLAIM_KEY.format(run_id=run_id)))
        _note_success()
        return claimed
    except Exception:
        _note_failure()
        return False


def claim_run(run_id: str, ttl_seconds: int = 7200) -> bool:
    client = _redis()
    if client is None:
        return True  # no redis: allow in-process execution
    try:
        claimed = bool(client.set(CLAIM_KEY.format(run_id=run_id), "1", nx=True, ex=ttl_seconds))
        _note_success()
        return claimed
    except Exception:
        _note_failure()
        return True


def release_run(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.delete(CLAIM_KEY.format(run_id=run_id))
        _note_success()
    except Exception:
        _note_failure()


def enqueue_plan_run(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        client.lpush(QUEUE_KEY, run_id)
        _note_success()
        return True
    except Exception as exc:
        logger.warning("enqueue failed: %s", exc)
        _note_failure()
        return False


# ── Event log ──────────────────────────────────────────────────────────────


def _signal(run_id: str) -> asyncio.Event:
    event = _SIGNALS.get(run_id)
    if event is None:
        event = asyncio.Event()
        _SIGNALS[run_id] = event
    return event


def notify_run(run_id: str) -> None:
    """Wake every reader waiting on this run's event log."""
    _signal(run_id).set()


async def wait_for_run_event(run_id: str, after: int, timeout: float) -> bool:
    """Wait until this run has more than `after` events, or `timeout` elapses.

    Takes the reader's cursor rather than waiting blind, because a publish
    landing between "I have nothing new" and "I am now waiting" would otherwise
    be a lost wake-up costing the reader a full timeout. Checking the mirror on
    both sides of the `clear()` closes that window for the in-process producer,
    which is the only thing that sets the event.

    Returns True if there is new work. A False means the timeout elapsed: the
    caller still re-reads, since a producer in another process publishes to
    Redis without ever touching this event.
    """
    if len(_MEM_EVENTS.get(run_id) or []) > after:
        return True

    event = _signal(run_id)
    event.clear()
    if len(_MEM_EVENTS.get(run_id) or []) > after:
        return True

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return True
    except TimeoutError:
        return False


def publish_run_event(run_id: str, payload: dict[str, Any]) -> None:
    _mem_track(run_id).append(payload)
    notify_run(run_id)
    client = _redis()
    if client is None:
        return
    try:
        raw = json.dumps(payload, ensure_ascii=False)
        key = EVENTS_KEY.format(run_id=run_id)
        client.rpush(key, raw)
        client.expire(key, 86400)
        client.publish(f"forge:run:{run_id}", raw)
        _note_success()
    except Exception as exc:
        logger.debug("publish event failed: %s", exc)
        _note_failure()


def list_run_events(run_id: str, after: int = 0) -> list[dict[str, Any]]:
    start = max(0, after)
    memory = _MEM_EVENTS.get(run_id) or []
    client = _redis()
    redis_rows: list[dict[str, Any]] = []
    if client is not None:
        try:
            rows = client.lrange(EVENTS_KEY.format(run_id=run_id), start, -1)
            _note_success()
            for raw in rows:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        redis_rows.append(parsed)
                except Exception:
                    continue
        except Exception:
            _note_failure()
            redis_rows = []
    mem_rows = memory[start:]
    # Redis is authoritative when it has at least as much (it survives
    # restarts); the memory mirror covers the Valkey-down case.
    return redis_rows if len(redis_rows) >= len(mem_rows) else mem_rows


def clear_run_events(run_id: str) -> None:
    _MEM_EVENTS.pop(run_id, None)
    _SIGNALS.pop(run_id, None)
    if run_id in _MEM_ORDER:
        _MEM_ORDER.remove(run_id)
    client = _redis()
    if client is None:
        return
    with contextlib.suppress(Exception):
        client.delete(EVENTS_KEY.format(run_id=run_id))


def event_count(run_id: str) -> int:
    client = _redis()
    if client is not None:
        try:
            count = int(client.llen(EVENTS_KEY.format(run_id=run_id)) or 0)
            _note_success()
            if count:
                return count
        except Exception:
            _note_failure()
    return len(_MEM_EVENTS.get(run_id) or [])


# ── Cancellation ───────────────────────────────────────────────────────────


def mark_cancelled(run_id: str) -> None:
    # Wake any reader immediately: cancellation is the one signal a user is
    # actively waiting to see take effect.
    notify_run(run_id)
    client = _redis()
    if client is None:
        return
    try:
        client.set(CANCEL_KEY.format(run_id=run_id), "1", ex=86400)
        _note_success()
    except Exception:
        _note_failure()


def is_cancelled_redis(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        cancelled = bool(client.exists(CANCEL_KEY.format(run_id=run_id)))
        _note_success()
        return cancelled
    except Exception:
        _note_failure()
        return False


def clear_cancelled_redis(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.delete(CANCEL_KEY.format(run_id=run_id))
        _note_success()
    except Exception:
        _note_failure()
