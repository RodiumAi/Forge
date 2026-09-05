"""Persist agent plan progress and assistant messages."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AgentRun, Message, User
from app.services.posthog_client import capture_event, distinct_id_for_user
from app.services.text_plain import build_run_summary, to_plain_text


def _merge_run_meta(row: AgentRun, extra: dict) -> str:
    """Merge into `plan_meta_json` without losing what the planner put there."""
    current: dict = {}
    if row.plan_meta_json:
        try:
            parsed = json.loads(row.plan_meta_json)
            if isinstance(parsed, dict):
                current = parsed
        except Exception:
            current = {}
    current.update(extra)
    return json.dumps(current, ensure_ascii=False)


def record_run_outcome(
    row: AgentRun,
    *,
    failures: list | None = None,
    code: str | None = None,
    message: str | None = None,
) -> None:
    """Write down why a run ended the way it did.

    `plan_meta_json` was NULL on every failed run in production, so an incident
    left nothing behind but a status column — no cause, no failing step, no
    model. This is the only place that gap gets closed, so it runs on every
    terminal transition, not just the interesting ones.
    """
    outcome: dict = {
        "model": row.model_slug,
        "cursor": int(row.cursor_task_index or 0),
        "finished_at": datetime.now(UTC).isoformat(),
    }
    if failures:
        outcome["failures"] = failures
    if code:
        outcome["code"] = code
    if message:
        outcome["message"] = str(message)[:500]
    row.plan_meta_json = _merge_run_meta(row, outcome)


def persist_plan_error(db: Session, run_pk: UUID, payload: dict, locale: str = "fr") -> None:
    if payload.get("type") != "error":
        return
    row = db.get(AgentRun, run_pk)
    if row is None:
        return

    code = str(payload.get("code") or "")
    message = str(payload.get("message") or "")
    cancelled = code == "cancelled" or message == "cancelled"

    # Cancellation is not a failure. The dispatcher signals it through the same
    # `error` frame, and this function used to overwrite the `cancelled` status
    # the cancel endpoint had just written — so a run the user stopped on
    # purpose was reported back to them as broken.
    row.status = "cancelled" if cancelled else "error"
    record_run_outcome(row, code=code or ("cancelled" if cancelled else "internal"), message=message)

    plan = payload.get("plan")
    if isinstance(plan, list):
        row.plan_json = json.dumps(plan)
    if isinstance(plan, list) and not cancelled:
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
                content=summary or message or "Plan interrupted",
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
            failed = payload.get("failed") if isinstance(payload.get("failed"), list) else []
            if failed:
                record_run_outcome(row, failures=failed, code="partial_failure")
            persist_assistant(db, row, payload, locale)
            # Self-heal: if the model hardcoded a private uploads-bucket URL in
            # generated files, rewrite it to a local public/images/ copy now,
            # so the very first preview/publish isn't shipped broken.
            try:
                from app.services.asset_storage import repair_private_upload_urls_in_project

                repair_private_upload_urls_in_project(db, row.project_id)
            except Exception:
                pass
            if payload.get("paused"):
                # Step-by-step mode: task finished but the plan is not over.
                # Re-arm the run so POST /confirm-plan can launch the next step.
                row.status = "awaiting_plan_confirm"
                row.plan_json = json.dumps(payload.get("plan") or plan)
                db.commit()
                return
            # "partial" is the honest outcome when the plan ran to the end but
            # skipped steps: "done" would hide it, "error" would deny the work
            # that did land. It is also what re-arms the resume button.
            row.status = "partial" if failed else "done"
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
                        "failed_steps": len(failed),
                        "outcome": row.status,
                    },
                )
    elif payload.get("type") == "error":
        persist_plan_error(db, run_pk, payload, locale)


def make_progress_cb(run_pk: UUID):
    """Checkpoint with a short-lived session — never pin the pool across LLM awaits."""

    async def _cb(tasks: list, cursor: int) -> None:
        from app.db import SessionLocal

        with SessionLocal() as db:
            checkpoint_plan(db, run_pk, tasks, cursor)

    return _cb
