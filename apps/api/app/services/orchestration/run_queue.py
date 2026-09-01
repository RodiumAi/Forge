"""Plan-run queue + claim helpers (Valkey/Redis).

Phase 3: background worker. Until then, claim helpers are no-ops that return False
so get_active_run can treat orphaned "running" rows as resumable.
"""

from __future__ import annotations

import contextlib
import json
import logging
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


def _mem_track(run_id: str) -> list[dict[str, Any]]:
    events = _MEM_EVENTS.get(run_id)
    if events is None:
        events = _MEM_EVENTS.setdefault(run_id, [])
        _MEM_ORDER.append(run_id)
        while len(_MEM_ORDER) > _MEM_MAX_RUNS:
            drop = _MEM_ORDER.pop(0)
            _MEM_EVENTS.pop(drop, None)
    return events


def _redis():
    try:
        import redis

        url = get_settings().redis_url
        if not url:
            return None
        return redis.Redis.from_url(url, decode_responses=True)
    except Exception as exc:
        logger.debug("redis unavailable: %s", exc)
        return None


def is_run_claimed(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        return bool(client.exists(CLAIM_KEY.format(run_id=run_id)))
    except Exception:
        return False


def claim_run(run_id: str, ttl_seconds: int = 7200) -> bool:
    client = _redis()
    if client is None:
        return True  # no redis: allow in-process execution
    try:
        return bool(client.set(CLAIM_KEY.format(run_id=run_id), "1", nx=True, ex=ttl_seconds))
    except Exception:
        return True


def release_run(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    with contextlib.suppress(Exception):
        client.delete(CLAIM_KEY.format(run_id=run_id))


def enqueue_plan_run(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        client.lpush(QUEUE_KEY, run_id)
        return True
    except Exception as exc:
        logger.warning("enqueue failed: %s", exc)
        return False


def publish_run_event(run_id: str, payload: dict[str, Any]) -> None:
    _mem_track(run_id).append(payload)
    client = _redis()
    if client is None:
        return
    try:
        raw = json.dumps(payload, ensure_ascii=False)
        key = EVENTS_KEY.format(run_id=run_id)
        client.rpush(key, raw)
        client.expire(key, 86400)
        client.publish(f"forge:run:{run_id}", raw)
    except Exception as exc:
        logger.debug("publish event failed: %s", exc)


def list_run_events(run_id: str, after: int = 0) -> list[dict[str, Any]]:
    start = max(0, after)
    memory = _MEM_EVENTS.get(run_id) or []
    client = _redis()
    redis_rows: list[dict[str, Any]] = []
    if client is not None:
        try:
            rows = client.lrange(EVENTS_KEY.format(run_id=run_id), start, -1)
            for raw in rows:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        redis_rows.append(parsed)
                except Exception:
                    continue
        except Exception:
            redis_rows = []
    mem_rows = memory[start:]
    # Redis is authoritative when it has at least as much (it survives
    # restarts); the memory mirror covers the Valkey-down case.
    return redis_rows if len(redis_rows) >= len(mem_rows) else mem_rows


def clear_run_events(run_id: str) -> None:
    _MEM_EVENTS.pop(run_id, None)
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
            if count:
                return count
        except Exception:
            pass
    return len(_MEM_EVENTS.get(run_id) or [])


def mark_cancelled(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    with contextlib.suppress(Exception):
        client.set(CANCEL_KEY.format(run_id=run_id), "1", ex=86400)


def is_cancelled_redis(run_id: str) -> bool:
    client = _redis()
    if client is None:
        return False
    try:
        return bool(client.exists(CANCEL_KEY.format(run_id=run_id)))
    except Exception:
        return False


def clear_cancelled_redis(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    with contextlib.suppress(Exception):
        client.delete(CANCEL_KEY.format(run_id=run_id))
