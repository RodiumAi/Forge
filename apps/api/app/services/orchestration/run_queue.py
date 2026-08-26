"""Plan-run queue + claim helpers (Valkey/Redis).

Phase 3: background worker. Until then, claim helpers are no-ops that return False
so get_active_run can treat orphaned "running" rows as resumable.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

CLAIM_KEY = "forge:run:claim:{run_id}"
EVENTS_KEY = "forge:run:events:{run_id}"
QUEUE_KEY = "forge:plan:queue"
CANCEL_KEY = "forge:run:cancel:{run_id}"


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
        return bool(
            client.set(CLAIM_KEY.format(run_id=run_id), "1", nx=True, ex=ttl_seconds)
        )
    except Exception:
        return True


def release_run(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.delete(CLAIM_KEY.format(run_id=run_id))
    except Exception:
        pass


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
    client = _redis()
    if client is None:
        return []
    try:
        key = EVENTS_KEY.format(run_id=run_id)
        rows = client.lrange(key, max(0, after), -1)
        out: list[dict[str, Any]] = []
        for raw in rows:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    out.append(parsed)
            except Exception:
                continue
        return out
    except Exception:
        return []


def clear_run_events(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.delete(EVENTS_KEY.format(run_id=run_id))
    except Exception:
        pass


def event_count(run_id: str) -> int:
    client = _redis()
    if client is None:
        return 0
    try:
        return int(client.llen(EVENTS_KEY.format(run_id=run_id)) or 0)
    except Exception:
        return 0


def mark_cancelled(run_id: str) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.set(CANCEL_KEY.format(run_id=run_id), "1", ex=86400)
    except Exception:
        pass


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
    try:
        client.delete(CANCEL_KEY.format(run_id=run_id))
    except Exception:
        pass
