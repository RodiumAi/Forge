"""Close out runs that nobody is going to finish.

A run has three ways to end badly and leave a row behind forever:

* the API restarted mid-plan, so the in-process asyncio task is gone but the
  row still says `running`;
* the user closed the tab on a clarify or plan-confirm prompt and never came
  back, so the row sits in `awaiting_*` indefinitely;
* the process died between the last checkpoint and the terminal frame.

None of these self-heal, and production accumulated exactly that: one run stuck
in `awaiting_plan_confirm` for thirty hours, one `interrupted` that nothing ever
cleared. Worse than the row itself is what the builder does with it — it offers
a Resume button for a plan whose conversation context is long stale.

Two entry points on purpose: a sweep at startup and on a timer for the whole
table, and a single-row check on the read path so a user never sees a zombie
even if the timer has not come round yet.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import AgentRun

logger = logging.getLogger(__name__)

# Statuses that mean "something is still expected to happen".
_RUNNING = ("running",)
_AWAITING = ("awaiting_clarify", "awaiting_plan_confirm")

SWEEP_INTERVAL_S = 900.0


def _age_seconds(row: AgentRun) -> float:
    stamp = row.updated_at or row.created_at
    if stamp is None:
        return 0.0
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=UTC)
    return (datetime.now(UTC) - stamp).total_seconds()


def expire_if_stale(db: Session, row: AgentRun) -> bool:
    """Close one run if it has clearly been abandoned. True if it was changed.

    A `running` row is only abandoned once nobody holds its claim — an active
    worker in another process legitimately keeps a run alive for a long time.
    """
    settings = get_settings()
    status = str(row.status or "")
    age = _age_seconds(row)

    if status in _RUNNING and age > settings.stale_run_seconds:
        from app.services.orchestration.plan_worker import _running_tasks
        from app.services.orchestration.run_queue import is_run_claimed

        local = _running_tasks.get(str(row.id))
        if local is not None and not local.done():
            return False
        if is_run_claimed(str(row.id)):
            return False
        row.status = "interrupted"
        db.commit()
        logger.info("expired stale running run_id=%s age=%.0fs", row.id, age)
        return True

    if status in _AWAITING and age > settings.abandoned_run_seconds:
        row.status = "expired"
        db.commit()
        logger.info("expired abandoned run_id=%s status=%s age=%.0fs", row.id, status, age)
        return True

    return False


def sweep_stale_runs() -> int:
    """Expire every abandoned run. Returns how many rows changed."""
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(
        seconds=min(settings.stale_run_seconds, settings.abandoned_run_seconds)
    )
    changed = 0
    with SessionLocal() as db:
        rows = (
            db.query(AgentRun)
            .filter(
                AgentRun.status.in_((*_RUNNING, *_AWAITING)),
                AgentRun.updated_at < cutoff,
            )
            .limit(500)
            .all()
        )
        for row in rows:
            try:
                if expire_if_stale(db, row):
                    changed += 1
            except Exception:
                logger.exception("failed to expire run_id=%s", row.id)
                db.rollback()
    return changed


async def stale_run_sweeper() -> None:
    """Background loop for the app lifespan. Never raises out."""
    while True:
        try:
            changed = sweep_stale_runs()
            if changed:
                logger.info("stale run sweep closed %d run(s)", changed)
        except Exception:
            logger.exception("stale run sweep failed")
        await asyncio.sleep(SWEEP_INTERVAL_S)
