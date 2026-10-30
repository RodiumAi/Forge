"""Chat entry points for document projects, called from ``routers/chats.py``.

``routers/chats.py`` hands a message to ``start_document_message`` as soon as
it knows the project is a document kind, so the React site pipeline below it
stays untouched. Router helpers that need the request (model choice, tier
entitlements, generation auth, the SSE response) are passed in rather than
imported, which keeps this module free of an import cycle with the router.
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
from app.services.deck_ai import attachments, store
from app.services.deck_ai.flow import DeckContext, document_stream, spawn_deck_write_job, unavailable_stream
from app.services.deck_ai.outline import outline_from_plan, plan_tasks
from app.services.deck_ai.routing import ai_available, deck_routes, document_kind
from app.services.orchestration.plan_worker import iter_run_event_sse

DECK_OUTLINE_TASK = "deck.outline"


def _history(db: Session, chat_id) -> list[tuple[str, str]]:
    rows = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [(m.role, m.content) for m in rows]


def is_document_project(project: Project) -> bool:
    return document_kind(project.platform) is not None


def message_target(body: Any, content: str) -> tuple[str | None, str | None, str | None]:
    """(slide, element, action) the message applies to.

    An imported PowerPoint or PDF is material for the whole deck: the slide
    or element selected in the editor when it was sent does not narrow it.
    Quick actions keep their target.
    """
    target = getattr(body, "target", None)
    target_slide = getattr(target, "slideId", None) if target else None
    target_element = getattr(target, "elementId", None) if target else None
    action = getattr(body, "action", None)
    if action in ("check_code", "make_files"):  # codelab actions mean nothing on a deck
        action = None
    if not action and attachments.documents(content):
        return None, None, None
    return target_slide, target_element, action


def rebuilds_from_powerpoint(content: str) -> bool:
    """True when the message brings a PowerPoint: the deck is rebuilt from it.

    Rebuilding goes through the outline, slide by slide: a deck edit asks for
    every slide in one answer, which a long PowerPoint does not fit in.
    """
    return any(doc.kind == "pptx" for doc in attachments.documents(content))


def start_document_message(
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
    """The SSE response for a chat message on a document project."""
    kind_id = document_kind(project.platform) or ""
    if kind_id == "codelab":
        # Codelabs have their own flows (app/services/codelab), same arguments.
        from app.services.codelab.chat_entry import start_codelab_message

        return start_codelab_message(
            db=db,
            user=user,
            project=project,
            chat=chat,
            body=body,
            content=content,
            mode=mode,
            locale=locale,
            route_for_request=route_for_request,
            effort_label=effort_label,
            resolve_gen_auth=resolve_gen_auth,
            event_stream=event_stream,
            anchor=anchor,
        )
    if kind_id == "design_system" and kind_enabled(kind_id):
        from app.services.design_system.chat_entry import start_message

        return start_message(
            db=db,
            user=user,
            project=project,
            chat=chat,
            body=body,
            content=content,
            mode=mode,
            locale=locale,
            route_for_request=route_for_request,
            effort_label=effort_label,
            resolve_gen_auth=resolve_gen_auth,
            event_stream=event_stream,
            anchor=anchor,
        )
    if not ai_available(kind_id):
        return event_stream(unavailable_stream(kind_id, locale))

    target_slide, target_element, action = message_target(body, content)
    targeted = bool(target_slide or target_element or action)
    pid = str(project.id)

    writing, editing = deck_routes()
    writing = route_for_request(writing, db, user, getattr(body, "model", None))
    editing = route_for_request(editing, db, user, getattr(body, "model", None))
    fresh = not targeted and (store.is_blank_deck(pid) or rebuilds_from_powerpoint(content))
    route = editing if targeted else writing
    task_class = "deck.edit.target" if targeted else (DECK_OUTLINE_TASK if fresh else "deck.edit")

    from app.services.history import bind_history_actor

    bind_history_actor(getattr(user, "name", None), user.email)
    history = _history(db, chat.id)
    if anchor is None:
        user_msg = Message(chat_id=chat.id, role="user", content=content)
        db.add(user_msg)
        db.flush()
    else:
        user_msg = anchor
    run = AgentRun(
        chat_id=chat.id,
        project_id=project.id,
        user_id=user.id,
        mode=mode,
        status="running",
        prompt=content,
        task_class=task_class,
        model_slug=route.model,
    )
    db.add(run)
    db.commit()
    db.refresh(user_msg)
    db.refresh(run)

    ctx = DeckContext(
        project_id=pid,
        run_pk=run.id,
        user_id=user.id,
        user_msg_id=str(user_msg.id),
        prompt=content,
        locale=locale,
        gen_model=writing.model,
        edit_model=editing.model,
        route_effort=effort_label(route.tier, locale),
        tier=route.tier,
        resolve_auth=resolve_gen_auth,
        history=history,
        target_slide=target_slide,
        target_element=target_element,
        action=action,
        action_input=getattr(body, "action_input", None),
        fresh=fresh,
    )
    # The stream runs for minutes: release the request's DB connection now.
    db.close()
    return event_stream(document_stream(ctx))


def is_deck_outline_run(run: AgentRun) -> bool:
    return (run.task_class or "") == DECK_OUTLINE_TASK


def confirm_deck_outline(
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
    if not ai_available(document_kind(project.platform) or ""):
        raise HTTPException(status_code=404, detail="This project type is not available yet.")
    try:
        meta = json.loads(run.plan_meta_json) if run.plan_meta_json else {}
    except ValueError:
        meta = {}
    stored = meta.get("deck") if isinstance(meta, dict) else None
    try:
        outline = outline_from_plan(stored, plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=t("plan_empty", locale)) from exc  # type: ignore[arg-type]

    run_pk = run.id
    run.plan_json = json.dumps(plan_tasks(outline), ensure_ascii=False)
    meta = {**(meta if isinstance(meta, dict) else {}), "deck": outline.model_dump()}
    run.plan_meta_json = json.dumps(meta, ensure_ascii=False)
    run.status = "running"
    prompt = run.prompt or ""
    model = run.model_slug or deck_routes()[0].model
    project_id = str(project.id)
    db.commit()
    db.close()

    spawn_deck_write_job(
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
