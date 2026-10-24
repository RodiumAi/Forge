"""Chat entry points of a codelab project.

``deck_ai.chat_entry.start_document_message`` hands codelab messages here
(same arguments), and ``routers/chats.py`` confirms a codelab outline through
``confirm_codelab_outline``. Router helpers are passed in, as for the deck,
to keep this module free of an import cycle with the router.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.i18n import t
from app.kinds import kind_enabled
from app.models import AgentRun, Chat, Message, Project, User
from app.services.codelab import store
from app.services.codelab.flow import (
    CODELAB_ACTIONS,
    STEP_ACTIONS,
    CodelabContext,
    codelab_stream,
    spawn_codelab_write_job,
    task_class,
    unavailable_stream,
)
from app.services.codelab.outline import outline_from_plan, plan_tasks
from app.services.deck_ai.routing import deck_routes
from app.services.orchestration.plan_worker import iter_run_event_sse

CODELAB_OUTLINE_TASK = "codelab.outline"


def _history(db: Session, chat_id) -> list[tuple[str, str]]:
    rows = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [(m.role, m.content) for m in rows]


def start_codelab_message(
    *,
    db: Session,
    user: User,
    project: Project,
    chat: Chat,
    body: Any,
    content: str,
    mode: str,
    locale: str,
    route_for_request: Callable[..., Any],
    effort_label: Callable[[str, str], str],
    resolve_gen_auth: Callable[[], Any],
    event_stream: Callable[[Any], Any],
    anchor: Message | None = None,
):
    """The SSE response for a chat message on a codelab project."""
    if not kind_enabled("codelab"):
        return event_stream(unavailable_stream(locale))

    target = getattr(body, "target", None)
    target_step = getattr(target, "stepId", None) if target else None
    action = getattr(body, "action", None)
    if action not in CODELAB_ACTIONS and action not in STEP_ACTIONS:
        action = None
    pid = str(project.id)

    writing, editing = deck_routes()
    writing = route_for_request(writing, db, user, getattr(body, "model", None))
    editing = route_for_request(editing, db, user, getattr(body, "model", None))
    targeted = bool(target_step or action)
    fresh = not targeted and store.is_blank_codelab(pid)
    route = editing if target_step or action in STEP_ACTIONS else writing

    from app.services.history import bind_history_actor

    bind_history_actor(getattr(user, "name", None), user.email)
    history = _history(db, chat.id)
    if anchor is None:
        user_msg = Message(chat_id=chat.id, role="user", content=content)
        db.add(user_msg)
        db.flush()
    else:
        user_msg = anchor
    ctx = CodelabContext(
        project_id=pid,
        run_pk=None,  # type: ignore[arg-type]  set below, once the run exists
        user_id=user.id,
        user_msg_id="",
        prompt=content,
        locale=locale,
        gen_model=writing.model,
        edit_model=editing.model,
        route_effort=effort_label(route.tier, locale),
        tier=route.tier,
        resolve_auth=resolve_gen_auth,
        history=history,
        target_step=target_step,
        action=action,
        action_input=getattr(body, "action_input", None),
        fresh=fresh,
    )
    run = AgentRun(
        chat_id=chat.id,
        project_id=project.id,
        user_id=user.id,
        mode=mode,
        status="running",
        prompt=content,
        task_class=task_class(ctx),
        model_slug=route.model,
    )
    db.add(run)
    db.commit()
    db.refresh(user_msg)
    db.refresh(run)
    ctx.run_pk = run.id
    ctx.user_msg_id = str(user_msg.id)
    # The stream runs for minutes: release the request's DB connection now.
    db.close()
    return event_stream(codelab_stream(ctx))


def is_codelab_outline_run(run: AgentRun) -> bool:
    return (run.task_class or "") == CODELAB_OUTLINE_TASK


def confirm_codelab_outline(
    *,
    db: Session,
    run: AgentRun,
    project: Project,
    plan: list[dict] | None,
    locale: str,
    resolve_gen_auth: Callable[[], Any],
    event_stream: Callable[[Any], Any],
):
    """Write the confirmed outline in the background and relay its events."""
    if run.status not in ("awaiting_plan_confirm", "error", "partial"):
        raise HTTPException(status_code=400, detail=t("run_invalid_state", locale))  # type: ignore[arg-type]
    if not kind_enabled("codelab"):
        raise HTTPException(status_code=404, detail="This project type is not available yet.")
    try:
        meta = json.loads(run.plan_meta_json) if run.plan_meta_json else {}
    except ValueError:
        meta = {}
    stored = meta.get("codelab") if isinstance(meta, dict) else None
    try:
        outline = outline_from_plan(stored, plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=t("plan_empty", locale)) from exc  # type: ignore[arg-type]

    run_pk = run.id
    run.plan_json = json.dumps(plan_tasks(outline), ensure_ascii=False)
    meta = {**(meta if isinstance(meta, dict) else {}), "codelab": outline.model_dump()}
    run.plan_meta_json = json.dumps(meta, ensure_ascii=False)
    run.status = "running"
    prompt = run.prompt or ""
    model = run.model_slug or deck_routes()[0].model
    project_id = str(project.id)
    db.commit()
    db.close()

    spawn_codelab_write_job(
        project_id=project_id,
        run_pk=run_pk,
        prompt=prompt,
        outline=outline,
        model=model,
        locale=locale,
        resolve_auth=resolve_gen_auth,
    )

    async def stream():
        async for chunk in iter_run_event_sse(str(run_pk)):
            yield chunk

    return event_stream(stream())
