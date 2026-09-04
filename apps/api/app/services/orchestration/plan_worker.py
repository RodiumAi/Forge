"""Background plan execution — survives browser tab close."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from app.db import SessionLocal
from app.i18n import Locale
from app.models import AgentRun, User
from app.services.orchestration import run_queue
from app.services.orchestration.cancel import clear_cancelled
from app.services.orchestration.dispatcher import run_plan_tasks
from app.services.rodium_generation import resolve_generation_auth

logger = logging.getLogger(__name__)

_running_tasks: dict[str, asyncio.Task] = {}


def _parse_sse_chunk(chunk: str) -> dict | None:
    if not chunk.startswith("data: "):
        return None
    try:
        data = json.loads(chunk[6:].strip())
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _execute_plan_job(
    *,
    run_id: UUID,
    user_id: UUID,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    answers_block: str,
    tasks: list[dict[str, Any]],
    model: str,
    locale: Locale,
    step_mode: bool = False,
) -> None:
    rid = str(run_id)
    run_queue.clear_run_events(rid)
    clear_cancelled(rid)
    run_queue.claim_run(rid)

    # Never hold one Session across LLM awaits — that exhausted QueuePool in prod
    # (ALB 502 without CORS headers → browser "Network / CORS" errors on login).
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None:
            run_queue.publish_run_event(
                rid, {"type": "error", "message": "User not found", "plan": tasks}
            )
            run_queue.release_run(rid)
            _running_tasks.pop(rid, None)
            return

    from app.services.orchestration.plan_persist import (
        handle_plan_stream_payload,
        make_progress_cb,
    )

    async def resolve_auth():
        with SessionLocal() as db:
            fresh = db.get(User, user_id)
            if fresh is None:
                raise RuntimeError("User not found")
            return await resolve_generation_auth(db, fresh)

    try:
        initial_auth = await resolve_auth()
        async for chunk in run_plan_tasks(
            project_id=project_id,
            history=history,
            user_prompt=user_prompt,
            answers_block=answers_block,
            tasks=tasks,
            model=model,
            auth=initial_auth,
            resolve_auth=resolve_auth,
            on_progress=make_progress_cb(run_id),
            locale=locale,
            run_id=rid,
            user_id=user_id,
            db=None,
            step_mode=step_mode,
        ):
            payload = _parse_sse_chunk(chunk)
            if payload:
                run_queue.publish_run_event(rid, payload)
                with SessionLocal() as db:
                    handle_plan_stream_payload(
                        db,
                        run_id,
                        payload,
                        plan=tasks,
                        locale=locale,
                    )
    except Exception as exc:
        logger.exception("plan job failed run_id=%s", rid)
        try:
            with SessionLocal() as db:
                row = db.get(AgentRun, run_id)
                if row is not None:
                    row.status = "error"
                    row.plan_json = json.dumps(tasks)
                    db.commit()
        except Exception:
            pass
        run_queue.publish_run_event(
            rid,
            {"type": "error", "message": str(exc)[:500], "plan": tasks},
        )
    finally:
        run_queue.release_run(rid)
        _running_tasks.pop(rid, None)


def spawn_plan_job(
    *,
    run_id: UUID,
    user_id: UUID,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    answers_block: str,
    tasks: list[dict[str, Any]],
    model: str,
    locale: Locale,
    step_mode: bool = False,
) -> None:
    rid = str(run_id)
    existing = _running_tasks.get(rid)
    if existing and not existing.done():
        return

    async def _runner() -> None:
        await _execute_plan_job(
            run_id=run_id,
            user_id=user_id,
            project_id=project_id,
            history=history,
            user_prompt=user_prompt,
            answers_block=answers_block,
            tasks=tasks,
            model=model,
            locale=locale,
            step_mode=step_mode,
        )

    task = asyncio.create_task(_runner(), name=f"forge-plan-{rid}")
    _running_tasks[rid] = task
    run_queue.enqueue_plan_run(rid)


async def iter_run_event_sse(run_id: str, *, start_after: int = 0):
    """Replay buffered events then poll until done/error or claim released."""
    seen = max(0, start_after)
    idle_rounds = 0
    while True:
        events = run_queue.list_run_events(run_id, after=seen)
        if events:
            idle_rounds = 0
            for ev in events:
                seen += 1
                yield _sse(ev)
                if ev.get("type") in ("done", "error"):
                    return
        else:
            idle_rounds += 1
            claimed = run_queue.is_run_claimed(run_id)
            local = _running_tasks.get(run_id)
            alive = claimed or (local is not None and not local.done())
            if not alive and idle_rounds >= 8:
                # Orphaned stream — emit a soft stop so the client can restore from DB.
                yield _sse({"type": "error", "message": "run_detached"})
                return
        await asyncio.sleep(0.25)
