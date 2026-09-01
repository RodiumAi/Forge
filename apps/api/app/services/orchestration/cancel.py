"""In-memory + Redis cancel flags for in-flight agent runs."""

from __future__ import annotations

from app.services.orchestration import run_queue

_cancelled: set[str] = set()


def mark_cancelled(run_id: str) -> None:
    rid = str(run_id)
    _cancelled.add(rid)
    run_queue.mark_cancelled(rid)


def is_cancelled(run_id: str) -> bool:
    rid = str(run_id)
    return rid in _cancelled or run_queue.is_cancelled_redis(rid)


def clear_cancelled(run_id: str) -> None:
    rid = str(run_id)
    _cancelled.discard(rid)
    run_queue.clear_cancelled_redis(rid)
