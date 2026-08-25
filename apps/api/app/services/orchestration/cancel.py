"""In-memory cancel flags for in-flight agent runs."""

from __future__ import annotations

_cancelled: set[str] = set()


def mark_cancelled(run_id: str) -> None:
    _cancelled.add(str(run_id))


def is_cancelled(run_id: str) -> bool:
    return str(run_id) in _cancelled


def clear_cancelled(run_id: str) -> None:
    _cancelled.discard(str(run_id))
