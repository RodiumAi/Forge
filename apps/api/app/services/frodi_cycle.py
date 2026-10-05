"""Shared FRODI cycle-key helper.

The collaborator-cap counter (F-1) is scoped by cycle. Both the generation path
(``llm.py``) and the owner-facing usage read-back (``projects.py``) must derive
the SAME key, so it lives in one lightweight module with no heavy imports.
"""

from __future__ import annotations

from datetime import UTC, datetime


def current_frodi_cycle_key() -> str:
    """Rolling weekly window key, e.g. ``2026-W39``.

    ISO week is deterministic and self-resetting, so the cap counter starts
    fresh each week — matching the weekly cadence of paid FRODI allotments
    without reading the owner's exact cycle boundary.
    """
    now = datetime.now(UTC).isocalendar()
    return f"{now.year}-W{now.week:02d}"
