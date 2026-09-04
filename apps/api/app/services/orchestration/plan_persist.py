"""Persist agent plan progress and assistant messages."""

from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AgentRun, Message, User
from app.services.posthog_client import capture_event, distinct_id_for_user
from app.services.text_plain import build_run_summary, to_plain_text


def persist_plan_error(db: Session, run_pk: UUID, payload: dict, locale: str = "fr") -> None:
    if payload.get("type") != "error":
        return
    row = db.get(AgentRun, run_pk)
    if row is None:
        return
    row.status = "error"
    plan = payload.get("plan")
    if isinstance(plan, list):
        row.plan_json = json.dumps(plan)
        summary = to_plain_text(
            build_run_summary(
                tasks=plan,
                applied=None,
                locale=locale if locale in ("en", "fr") else "fr",  # type: ignore[arg-type]
            )
        )
        db.add(
            Message(
                chat_id=row.chat_id,
                role="assistant",
                content=summary or str(payload.get("message") or "Plan interrupted"),
                steps_json=None,
                file_ops_json=None,
                plan_json=json.dumps(plan, ensure_ascii=False),
                plan_meta_json=row.plan_meta_json,
                task_class=row.task_class,
                model_slug=row.model_slug,
            )
        )
    db.commit()


def checkpoint_plan(db: Session, run_pk: UUID, tasks: list, cursor: int) -> None:
    row = db.get(AgentRun, run_pk)
    if row is None:
        return
    row.plan_json = json.dumps(tasks)
    row.cursor_task_index = max(0, int(cursor))
    if row.status not in ("awaiting_clarify", "awaiting_plan_confirm"):
        row.status = "running"
    db.commit()


def persist_assistant(
    db: Session,
    run: AgentRun,
    payload: dict,
    locale: str = "fr",
) -> None:
    raw = str(payload.get("summary") or "")
    content = to_plain_text(raw)
    if not content or "<forge-write" in content.lower() or len(content) > 1200:
        content = to_plain_text(
            build_run_summary(
                tasks=payload.get("plan") if isinstance(payload.get("plan"), list) else None,
                applied=payload.get("applied") if isinstance(payload.get("applied"), list) else None,
                locale=locale if locale in ("en", "fr") else "fr",  # type: ignore[arg-type]
            )
        )
    steps = payload.get("steps") or []
    applied = payload.get("applied") or []
    plan = payload.get("plan") if isinstance(payload.get("plan"), list) else None
    db.add(
        Message(
            chat_id=run.chat_id,
            role="assistant",
            content=content,
            thinking_text=payload.get("thinking_text"),
            steps_json=json.dumps(steps, ensure_ascii=False) if steps else None,
            file_ops_json=json.dumps(applied, ensure_ascii=False) if applied else None,
            plan_json=json.dumps(plan, ensure_ascii=False) if plan else None,
            plan_meta_json=run.plan_meta_json if plan else None,
            task_class=run.task_class,
            model_slug=run.model_slug,
            effort_label=None,
        )
    )
    db.commit()


def handle_plan_stream_payload(
    db: Session,
    run_pk: UUID,
    payload: dict | None,
    *,
    plan: list,
    locale: str,
) -> None:
    if not payload:
        return
    if payload.get("type") == "done":
        row = db.get(AgentRun, run_pk)
        if row is not None:
            persist_assistant(db, row, payload, locale)
            if payload.get("paused"):
                # Step-by-step mode: task finished but the plan is not over.
                # Re-arm the run so POST /confirm-plan can launch the next step.
                row.status = "awaiting_plan_confirm"
                row.plan_json = json.dumps(payload.get("plan") or plan)
                db.commit()
                return
            row.status = "done"
            row.plan_json = json.dumps(payload.get("plan") or plan)
            db.commit()
            user = db.get(User, row.user_id)
            if user is not None:
                capture_event(
                    distinct_id_for_user(user),
                    "forge_generation_completed",
                    {
                        "run_id": str(run_pk),
                        "project_id": str(row.project_id),
                        "task_class": row.task_class,
                        "model_slug": row.model_slug,
                    },
                )
    elif payload.get("type") == "error":
        persist_plan_error(db, run_pk, payload, locale)


def make_progress_cb(db: Session, run_pk: UUID):
    async def _cb(tasks: list, cursor: int) -> None:
        checkpoint_plan(db, run_pk, tasks, cursor)

    return _cb
