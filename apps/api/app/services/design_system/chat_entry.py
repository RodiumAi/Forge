"""Chat entry point of design_system projects.

``deck_ai.chat_entry.start_document_message`` hands design_system messages
here (same router helpers passed in, so there is no import cycle with
``routers/chats.py``). ``target.section`` selects the targeted edit.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.models import AgentRun, Chat, Message, Project, User
from app.services.deck_ai.routing import deck_routes
from app.services.design_system.flow import DesignSystemContext, document_stream, task_class


def _history(db: Session, chat_id) -> list[tuple[str, str]]:
    rows = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [(m.role, m.content) for m in rows]


def start_message(
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
    target = getattr(body, "target", None)
    section = getattr(target, "section", None) if target else None
    writing, editing = deck_routes()
    writing = route_for_request(writing, db, user, getattr(body, "model", None))
    editing = route_for_request(editing, db, user, getattr(body, "model", None))
    route = editing if section else writing

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
        task_class=task_class(section),
        model_slug=route.model,
    )
    db.add(run)
    db.commit()
    db.refresh(user_msg)
    db.refresh(run)
    ctx = DesignSystemContext(
        project_id=str(project.id),
        project_name=project.name or "Design system",
        run_pk=run.id,
        user_msg_id=str(user_msg.id),
        prompt=content,
        locale=locale,
        gen_model=writing.model,
        edit_model=editing.model,
        route_effort=effort_label(route.tier, locale),
        tier=route.tier,
        resolve_auth=resolve_gen_auth,
        history=history,
        section=section,
    )
    # The stream runs for a while: release the request's DB connection now.
    db.close()
    return event_stream(document_stream(ctx))
