import json
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import AgentRun, Chat, Message, Project, User
from app.schemas import (
    AgentRunOut,
    BranchMessagesRequest,
    ClarifyAnswersRequest,
    ConfirmPlanRequest,
    MessageOut,
    SendMessageRequest,
)
from app.services.apply_writes import apply_validated_writes_async
from app.services.attachments import extract_image_urls
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.filesystem import delete_file
from app.services.llm import RodiumError, stream_chat_completion
from app.services.orchestration.cancel import clear_cancelled, is_cancelled, mark_cancelled
from app.services.orchestration.context import build_llm_messages
from app.services.orchestration.images import generate_project_image
from app.services.orchestration.plan_persist import (
    persist_assistant as _persist_assistant,
)
from app.services.orchestration.plan_worker import iter_run_event_sse, spawn_plan_job
from app.services.orchestration.planner import (
    build_clarify_questions_llm,
    build_plan,
    effort_label,
    format_answers_for_prompt,
    needs_clarify,
)
from app.services.orchestration.router import (
    classify_and_route,
    has_reference_attachments,
    strip_attachment_noise,
)
from app.services.rodium_generation import resolve_generation_auth
from app.services.sse import with_sse_heartbeats
from app.services.tags import parse_forge_tags
from app.services.text_plain import build_run_summary, to_plain_text

router = APIRouter(tags=["chats"])


def _owned_chat(
    db: Session,
    user: User,
    project_id: UUID,
    chat_id: UUID,
    locale: str,
) -> tuple[Project, Chat]:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    chat = db.get(Chat, chat_id)
    if chat is None or chat.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("chat_not_found", locale),  # type: ignore[arg-type]
        )
    return project, chat


def _owned_run(
    db: Session,
    user: User,
    project_id: UUID,
    chat_id: UUID,
    run_id: UUID,
    locale: str,
) -> tuple[Project, Chat, AgentRun]:
    project, chat = _owned_chat(db, user, project_id, chat_id, locale)
    run = db.get(AgentRun, run_id)
    if run is None or run.chat_id != chat.id or run.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("run_not_found", locale))  # type: ignore[arg-type]
    return project, chat, run


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _event_stream(source):
    """SSE response with comment heartbeats (ALB idle timeout target: 600s)."""
    settings = get_settings()
    return StreamingResponse(
        with_sse_heartbeats(source, interval_s=settings.sse_heartbeat_seconds),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _parse_sse_chunk(chunk: str) -> dict | None:
    if not chunk.startswith("data: "):
        return None
    try:
        data = json.loads(chunk[6:].strip())
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def _history(db: Session, chat_id: UUID) -> list[tuple[str, str]]:
    rows = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [(m.role, m.content) for m in rows]


def _should_single_pass(task_class: str, user_content: str, mode: str) -> bool:
    """Small edits in agent mode skip multi-task plans."""
    if mode != "agent":
        return False
    if task_class in ("code.edit.small", "text.copy", "text.micro"):
        return True
    clean = strip_attachment_noise(user_content)
    return bool(task_class == "code.edit.medium" and len(clean) < 180)


def _plan_requires_confirm(mode: str, task_class: str, plan: list) -> bool:
    """Big builds pause after planning so the user can pick run-all vs
    step-by-step; small agent-mode edits (1-3 task plans) run immediately."""
    if mode == "plan":
        return True
    if str(task_class or "").startswith(("code.scaffold", "plan.scaffold")):
        return True
    return len(plan) >= 4


async def _iter_single_pass(
    *,
    db: Session,
    run_pk: UUID,
    project_id_str: str,
    chat_id_pk: UUID,
    user_content: str,
    model: str,
    auth,
    locale: str,
    route_effort: str,
    user_id: UUID | None = None,
    surgical_edit: bool = False,
):
    """Yield SSE for a direct code edit (no plan panel)."""
    steps: list[dict] = []
    thinking_parts: list[str] = []
    full: list[str] = []
    applied: list[dict] = []
    run_id_str = str(run_pk)

    def push_step(step_id: str, label: str, st: str) -> str:
        existing = next((s for s in steps if s["id"] == step_id), None)
        if existing:
            existing["status"] = st
            existing["label"] = label
        else:
            steps.append({"id": step_id, "label": label, "status": st})
        return _sse({"type": "step", "id": step_id, "label": label, "status": st})

    yield push_step("select_files", t("step_select_files", locale), "running")
    history = _history(db, chat_id_pk)
    llm_messages = await build_llm_messages(
        project_id=project_id_str,
        history=history,
        user_query=user_content,
        db=db,
        user_id=user_id,
        locale=locale,
        auth=auth,
        model=model,
        surgical_edit=surgical_edit,
    )
    yield push_step("select_files", t("step_select_files", locale), "done")
    yield push_step("generate", t("step_generate_code", locale), "running")

    try:
        async for chunk in stream_chat_completion(
            auth=auth,
            model=model,
            messages=llm_messages,
            locale=locale,  # type: ignore[arg-type]
        ):
            if is_cancelled(run_id_str):
                yield push_step("generate", t("step_generate_code", locale), "error")
                yield _sse({"type": "error", "message": "cancelled"})
                live = db.get(AgentRun, run_pk)
                if live is not None:
                    live.status = "cancelled"
                    db.commit()
                clear_cancelled(run_id_str)
                return
            if chunk.kind == "thinking":
                thinking_parts.append(chunk.content)
                yield _sse({"type": "thinking", "delta": chunk.content})
            else:
                full.append(chunk.content)
                yield _sse({"type": "token", "content": chunk.content})
    except RodiumError as exc:
        yield push_step("generate", t("step_generate_code", locale), "error")
        yield _sse({"type": "error", "message": str(exc)})
        live = db.get(AgentRun, run_pk)
        if live is not None:
            live.status = "error"
            db.commit()
        return

    yield push_step("generate", t("step_generate_code", locale), "done")
    yield push_step("apply_writes", t("step_apply_writes", locale), "running")
    writes, deletes = parse_forge_tags("".join(full))

    # Empty/near-empty model response (transient upstream hiccup): retry once,
    # then fail HONESTLY. Reporting "Here is what was put in place" with zero
    # writes made users believe the edit happened.
    if not writes and not deletes and len("".join(full).strip()) < 40:
        yield push_step("generate", t("step_generate_code", locale), "running")
        nudge = (
            "Your previous response was empty. Implement the user's request NOW "
            "using forge-write tags with full file contents. Do not answer with prose only.\n\n"
            f"User request:\n{user_content}"
        )
        empty_retry_messages = await build_llm_messages(
            project_id=project_id_str,
            history=[*history, ("user", user_content), ("user", nudge)],
            user_query=nudge,
            db=db,
            user_id=user_id,
            locale=locale,
            auth=auth,
            model=model,
            surgical_edit=surgical_edit,
        )
        empty_retry_full: list[str] = []
        try:
            async for chunk in stream_chat_completion(
                auth=auth,
                model=model,
                messages=empty_retry_messages,
                locale=locale,  # type: ignore[arg-type]
            ):
                if is_cancelled(run_id_str):
                    yield push_step("generate", t("step_generate_code", locale), "error")
                    yield _sse({"type": "error", "message": "cancelled"})
                    return
                if chunk.kind == "thinking":
                    thinking_parts.append(chunk.content)
                    yield _sse({"type": "thinking", "delta": chunk.content})
                else:
                    empty_retry_full.append(chunk.content)
                    yield _sse({"type": "token", "content": chunk.content})
        except RodiumError as exc:
            yield push_step("generate", t("step_generate_code", locale), "error")
            yield _sse({"type": "error", "message": str(exc)})
            return
        if empty_retry_full:
            full = empty_retry_full
            writes, deletes = parse_forge_tags("".join(full))
        yield push_step("generate", t("step_generate_code", locale), "done")
        if not writes and not deletes and len("".join(full).strip()) < 40:
            yield push_step("apply_writes", t("step_apply_writes", locale), "error")
            yield _sse({"type": "error", "message": t("empty_model_response", locale)})
            live = db.get(AgentRun, run_pk)
            if live is not None:
                live.status = "error"
                db.commit()
            return

    required_urls = [img.url for img in extract_image_urls(user_content) if img.url.startswith("http")]
    if required_urls and not any(any(url in op.content for op in writes) for url in required_urls):
        retry_prompt = (
            "CRITICAL: The user's uploaded asset URL(s) must appear verbatim in your forge-write output "
            '(e.g. <img src="..."> or background-image: url(...)). Do not use placeholders.\n'
            + "\n".join(f"- {u}" for u in required_urls)
            + f"\n\nOriginal request:\n{user_content}"
        )
        yield push_step("generate", t("step_generate_code", locale), "running")
        retry_messages = await build_llm_messages(
            project_id=project_id_str,
            history=[*history, ("user", user_content), ("assistant", "".join(full)), ("user", retry_prompt)],
            user_query=retry_prompt,
            db=db,
            user_id=user_id,
            locale=locale,
            auth=auth,
            model=model,
            surgical_edit=surgical_edit,
        )
        retry_full: list[str] = []
        try:
            async for chunk in stream_chat_completion(
                auth=auth,
                model=model,
                messages=retry_messages,
                locale=locale,  # type: ignore[arg-type]
            ):
                if is_cancelled(run_id_str):
                    yield push_step("generate", t("step_generate_code", locale), "error")
                    yield _sse({"type": "error", "message": "cancelled"})
                    return
                if chunk.kind == "thinking":
                    thinking_parts.append(chunk.content)
                    yield _sse({"type": "thinking", "delta": chunk.content})
                else:
                    retry_full.append(chunk.content)
                    yield _sse({"type": "token", "content": chunk.content})
        except RodiumError as exc:
            yield push_step("generate", t("step_generate_code", locale), "error")
            yield _sse({"type": "error", "message": str(exc)})
            return
        if retry_full:
            full = retry_full
            writes, deletes = parse_forge_tags("".join(full))
        yield push_step("generate", t("step_generate_code", locale), "done")

    written, violations = await apply_validated_writes_async(
        project_id_str, writes, snapshot_label="before edit"
    )
    applied.extend(written)
    for item in written:
        yield _sse({"type": "file_write", "path": item["path"]})
    for v in violations:
        yield _sse(
            {
                "type": "warning",
                "message": f"{v.get('code')}: {v.get('message')}",
                "violation": v,
            }
        )
    for op in deletes:
        delete_file(project_id_str, op.path)
        applied.append({"op": "delete", "path": op.path})
        yield _sse({"type": "file_delete", "path": op.path})
    yield push_step("apply_writes", t("step_apply_writes", locale), "done")
    if applied:
        yield _sse({"type": "preview_refresh"})
    yield push_step("done", t("step_done", locale), "done")

    summary = to_plain_text(
        build_run_summary(tasks=None, applied=applied, locale=locale if locale in ("en", "fr") else "fr")  # type: ignore[arg-type]
    )
    payload = {
        "summary": summary,
        "assistant_content": "".join(full),
        "thinking_text": "".join(thinking_parts) or None,
        "steps": steps,
        "applied": applied,
    }
    live = db.get(AgentRun, run_pk)
    if live is not None:
        _persist_assistant(db, live, payload, locale)
        live.status = "done"
        db.commit()
    yield _sse({"type": "done", **payload, "effort_label": route_effort})


@router.get("/projects/{project_id}/chats/{chat_id}/messages", response_model=list[MessageOut])
def list_messages(
    project_id: UUID,
    chat_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Message]:
    locale = resolve_locale(request)
    _, chat = _owned_chat(db, user, project_id, chat_id, locale)
    return db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.created_at.asc()).all()


@router.get(
    "/projects/{project_id}/chats/{chat_id}/runs/active",
    response_model=AgentRunOut | None,
)
def get_active_run(
    project_id: UUID,
    chat_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentRunOut | None:
    """Restore HITL plan/clarify state after a page refresh."""
    locale = resolve_locale(request)
    _, chat = _owned_chat(db, user, project_id, chat_id, locale)
    run = (
        db.query(AgentRun)
        .filter(
            AgentRun.chat_id == chat.id,
            AgentRun.status.in_(
                ("awaiting_plan_confirm", "awaiting_clarify", "running", "error"),
            ),
        )
        .order_by(AgentRun.created_at.desc())
        .first()
    )
    if run is None:
        return None

    def _plan_all_done(items: list) -> bool:
        if not items:
            return False
        return all(isinstance(t, dict) and t.get("status") == "done" for t in items)

    plan: list[dict] = []
    clarify: list[dict] = []
    try:
        plan = json.loads(run.plan_json) if run.plan_json else []
        if not isinstance(plan, list):
            plan = []
    except Exception:
        plan = []
    try:
        clarify = json.loads(run.clarify_json) if run.clarify_json else []
        if not isinstance(clarify, list):
            clarify = []
    except Exception:
        clarify = []

    # Plan finished but worker never emitted the final done checkpoint — close the run
    # so refresh shows the persisted assistant message instead of a stale live panel.
    if _plan_all_done(plan):
        run.status = "done"
        run.plan_json = json.dumps(plan)
        db.commit()
        return None

    # A bare "running" stream without checkpointed plan cannot be resumed after refresh.
    # Plan-mode / checkpointed runs resurface for confirm or resume.
    if run.status == "running":
        if plan:
            # Keep as running if background worker may still be active; UI will subscribe.
            # If no live worker (legacy SSE), treat as resumable confirm.
            for task in plan:
                if isinstance(task, dict) and task.get("status") == "running":
                    task["status"] = "pending"
            run.plan_json = json.dumps(plan)
            # Prefer resume UX unless still actively claimed by worker (phase 3).
            from app.services.orchestration.run_queue import is_run_claimed

            if not is_run_claimed(str(run.id)):
                run.status = (
                    "error"
                    if any(isinstance(t, dict) and t.get("status") == "done" for t in plan)
                    else "awaiting_plan_confirm"
                )
            db.commit()
        else:
            run.status = "interrupted"
            db.commit()
            return None

    return AgentRunOut(
        id=run.id,
        status=run.status,
        mode=run.mode,
        prompt=run.prompt or "",
        plan=plan,
        clarify=clarify,
    )


@router.post("/projects/{project_id}/chats/{chat_id}/messages")
async def send_message(
    project_id: UUID,
    chat_id: UUID,
    body: SendMessageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    locale = resolve_locale(request)
    project, chat = _owned_chat(db, user, project_id, chat_id, locale)
    require_rodi_for_paid_capability(user, db)
    gen_auth = await resolve_generation_auth(db, user)

    user_content = body.content.strip()
    mode = (body.mode or "agent").strip().lower()
    if mode not in ("agent", "plan"):
        mode = "agent"

    prior_count = db.query(Message).filter(Message.chat_id == chat.id).count()
    force_scaffold = prior_count == 0
    route = classify_and_route(user_content, force_scaffold=force_scaffold)
    has_atts = has_reference_attachments(user_content)
    route_effort = (
        t("effort_attachments", locale)  # type: ignore[arg-type]
        if has_atts and not route.is_image
        else effort_label(route.tier, locale)  # type: ignore[arg-type]
    )

    user_msg = Message(chat_id=chat.id, role="user", content=user_content)
    db.add(user_msg)
    db.flush()

    run = AgentRun(
        chat_id=chat.id,
        project_id=project.id,
        user_id=user.id,
        mode=mode,
        status="running",
        prompt=user_content,
        task_class=route.task_class,
        model_slug=route.model,
    )
    db.add(run)
    db.commit()
    db.refresh(user_msg)
    db.refresh(run)

    project_id_str = str(project.id)
    user_msg_id = str(user_msg.id)
    chat_id_pk = chat.id
    run_pk = run.id
    use_single_pass = _should_single_pass(route.task_class, user_content, mode)
    clarify = (
        False
        if use_single_pass
        else needs_clarify(
            user_content,
            force_scaffold=force_scaffold,
            task_class=route.task_class,
        )
    )

    # Prototype mode (FE-only): no connector clarify gate (Resend/Firebase/…).
    # RodiumAi generation auth remains via resolve_generation_auth / Settings.

    # Image branch: keep single-pass for V1
    if route.is_image and mode == "agent":
        history = _history(db, chat.id)

        async def image_stream():
            steps: list[dict] = []
            thinking_parts: list[str] = []
            full: list[str] = []
            applied: list[dict] = []

            def push_step(step_id: str, label: str, st: str) -> str:
                existing = next((s for s in steps if s["id"] == step_id), None)
                if existing:
                    existing["status"] = st
                    existing["label"] = label
                else:
                    steps.append({"id": step_id, "label": label, "status": st})
                return _sse({"type": "step", "id": step_id, "label": label, "status": st})

            yield _sse({"type": "user_message", "id": user_msg_id, "run_id": str(run.id)})
            yield push_step("classify", t("step_classify", locale), "running")
            yield _sse(
                {
                    "type": "route",
                    "task_class": route.task_class,
                    "effort_label": route_effort,
                    "tier": route.tier,
                }
            )
            yield push_step("classify", t("step_classify", locale), "done")
            try:
                yield push_step("generate_image", t("step_generate_image", locale), "running")
                image_info = await generate_project_image(
                    auth=gen_auth,
                    project_id=project_id_str,
                    prompt=user_content,
                    model=route.model,
                    locale=locale,
                )
                applied.append({"op": "write", "path": image_info["path"]})
                yield _sse({"type": "file_write", "path": image_info["path"]})
                yield push_step("generate_image", t("step_generate_image", locale), "done")

                wire_prompt = (
                    f"An image was generated at `{image_info['path']}` "
                    f"(URL in the app: `{image_info['public_path']}`).\n"
                    f"User request: {user_content}\n"
                    "Update the UI to showcase this image where appropriate. "
                    "Use forge-write tags."
                )
                yield push_step("select_files", t("step_select_files", locale), "running")
                llm_messages = await build_llm_messages(
                    project_id=project_id_str,
                    history=[*history, ("user", wire_prompt)],
                    user_query=wire_prompt,
                    db=db,
                    user_id=user.id,
                    locale=locale,
                    auth=gen_auth,
                    model=get_settings().effective_default_model,
                )
                yield push_step("select_files", t("step_select_files", locale), "done")
                yield push_step("generate", t("step_generate_code", locale), "running")
                async for chunk in stream_chat_completion(
                    auth=gen_auth,
                    model=get_settings().effective_default_model,
                    messages=llm_messages,
                    locale=locale,  # type: ignore[arg-type]
                ):
                    if chunk.kind == "thinking":
                        thinking_parts.append(chunk.content)
                        yield _sse({"type": "thinking", "delta": chunk.content})
                    else:
                        full.append(chunk.content)
                        yield _sse({"type": "token", "content": chunk.content})
                yield push_step("generate", t("step_generate_code", locale), "done")
                yield push_step("apply_writes", t("step_apply_writes", locale), "running")
                writes, deletes = parse_forge_tags("".join(full))
                written, violations = await apply_validated_writes_async(
                    project_id_str, writes, snapshot_label="before edit"
                )
                applied.extend(written)
                for item in written:
                    yield _sse({"type": "file_write", "path": item["path"]})
                for v in violations:
                    yield _sse(
                        {
                            "type": "warning",
                            "message": f"{v.get('code')}: {v.get('message')}",
                            "violation": v,
                        }
                    )
                for op in deletes:
                    delete_file(project_id_str, op.path)
                    applied.append({"op": "delete", "path": op.path})
                    yield _sse({"type": "file_delete", "path": op.path})
                yield push_step("apply_writes", t("step_apply_writes", locale), "done")
                if applied:
                    yield _sse({"type": "preview_refresh"})
                yield push_step("done", t("step_done", locale), "done")
                summary = (
                    "Image générée et intégrée."
                    if locale == "fr"
                    else "Image generated and wired into the UI."
                )
                payload = {
                    "summary": summary,
                    "assistant_content": "".join(full),
                    "thinking_text": "".join(thinking_parts) or None,
                    "steps": steps,
                    "applied": applied,
                }
                _persist_assistant(db, run, payload, locale)
                run.status = "done"
                db.commit()
                yield _sse({"type": "done", **payload, "effort_label": route_effort})
            except RodiumError as exc:
                run.status = "error"
                db.commit()
                yield _sse({"type": "error", "message": str(exc)})

        return _event_stream(image_stream())

    # Clarify gate
    if clarify:
        # Contextual questionnaire (LLM) with static-template fallback: a
        # "developer portfolio" prompt asks for the developer's name/title/
        # projects, not three generic questions.
        questions = await build_clarify_questions_llm(
            user_content,
            locale,  # type: ignore[arg-type]
            auth=gen_auth,
            model=route.model,
            force_scaffold=force_scaffold,
        )
        run.clarify_json = json.dumps(questions)
        run.status = "awaiting_clarify"
        db.commit()

        async def clarify_stream():
            yield _sse({"type": "user_message", "id": user_msg_id, "run_id": str(run.id)})
            yield _sse(
                {
                    "type": "route",
                    "task_class": route.task_class,
                    "effort_label": route_effort,
                    "tier": route.tier,
                }
            )
            yield _sse(
                {
                    "type": "step",
                    "id": "clarify",
                    "label": t("step_clarify", locale),
                    "status": "running",
                }
            )
            yield _sse(
                {
                    "type": "clarify",
                    "run_id": str(run.id),
                    "questions": questions,
                }
            )

        return _event_stream(clarify_stream())

    def _attachment_steps():
        """Yield SSE steps for reading/parsing user attachments (not image gen)."""
        if not has_atts:
            return
        lower = user_content.lower()
        has_image = bool(
            re.search(
                r"\[(?:reference screenshot|capture de référence|image attached|image jointe):|"
                r"\.(?:png|jpe?g|gif|webp|svg)\b",
                lower,
            )
        )
        has_doc = bool(
            re.search(
                r"###\s+(?:markdown file|fichier markdown|pdf content|contenu pdf|text file|fichier texte)|"
                r"\[(?:pdf attached|pdf joint)",
                lower,
            )
        )
        yield _sse(
            {
                "type": "step",
                "id": "read_attachments",
                "label": t("step_read_attachments", locale),
                "status": "running",
            }
        )
        if has_image:
            yield _sse(
                {
                    "type": "step",
                    "id": "parse_image",
                    "label": t("step_parse_image", locale),
                    "status": "running",
                }
            )
            yield _sse(
                {
                    "type": "step",
                    "id": "parse_image",
                    "label": t("step_parse_image", locale),
                    "status": "done",
                }
            )
        if has_doc:
            yield _sse(
                {
                    "type": "step",
                    "id": "parse_document",
                    "label": t("step_parse_document", locale),
                    "status": "running",
                }
            )
            yield _sse(
                {
                    "type": "step",
                    "id": "parse_document",
                    "label": t("step_parse_document", locale),
                    "status": "done",
                }
            )
        yield _sse(
            {
                "type": "step",
                "id": "read_attachments",
                "label": t("step_read_attachments", locale),
                "status": "done",
            }
        )

    # Build plan (and auto-exec for agent mode)

    async def plan_stream():
        try:
            yield _sse({"type": "user_message", "id": user_msg_id, "run_id": str(run_pk)})
            yield _sse(
                {
                    "type": "step",
                    "id": "classify",
                    "label": t("step_classify", locale),
                    "status": "done",
                }
            )
            yield _sse(
                {
                    "type": "route",
                    "task_class": route.task_class,
                    "effort_label": route_effort,
                    "tier": route.tier,
                }
            )
            for step_evt in _attachment_steps():
                yield step_evt

            if use_single_pass:
                async for chunk in _iter_single_pass(
                    db=db,
                    run_pk=run_pk,
                    project_id_str=project_id_str,
                    chat_id_pk=chat_id_pk,
                    user_content=user_content,
                    model=route.model,
                    auth=gen_auth,
                    locale=locale,  # type: ignore[arg-type]
                    route_effort=route_effort,
                    user_id=user.id,
                    surgical_edit=route.task_class
                    in ("code.edit.small", "text.copy", "text.micro", "code.edit.medium"),
                ):
                    yield chunk
                return

            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "running",
                }
            )
            plan = await build_plan(
                prompt=user_content,
                answers=None,
                task_class=route.task_class,
                auth=gen_auth,
                model=route.model,
                locale=locale,  # type: ignore[arg-type]
            )
            live = db.get(AgentRun, run_pk)
            if live is None:
                yield _sse({"type": "error", "message": t("run_invalid_state", locale)})
                return
            live.plan_json = json.dumps(plan)
            # Multi-step plans always pause after planning: the user chooses
            # between running the whole pipeline or step-by-step execution.
            needs_confirm = _plan_requires_confirm(mode, route.task_class, plan)
            live.status = "awaiting_plan_confirm" if needs_confirm else "running"
            db.commit()
            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "done",
                }
            )
            yield _sse(
                {
                    "type": "plan",
                    "run_id": str(run_pk),
                    "tasks": plan,
                    "needs_confirm": needs_confirm,
                }
            )
            if needs_confirm:
                return
            history = _history(db, chat_id_pk)
            spawn_plan_job(
                run_id=run_pk,
                user_id=user.id,
                project_id=project_id_str,
                history=history,
                user_prompt=user_content,
                answers_block="",
                tasks=plan,
                model=route.model,
                locale=locale,  # type: ignore[arg-type]
            )
            async for chunk in iter_run_event_sse(str(run_pk)):
                yield chunk
        except Exception as exc:
            try:
                err_row = db.get(AgentRun, run_pk)
                if err_row is not None:
                    err_row.status = "error"
                    db.commit()
            except Exception:
                pass
            yield _sse({"type": "error", "message": str(exc)[:500]})

    return _event_stream(plan_stream())


@router.post("/projects/{project_id}/chats/{chat_id}/runs/{run_id}/clarify")
async def submit_clarify(
    project_id: UUID,
    chat_id: UUID,
    run_id: UUID,
    body: ClarifyAnswersRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    locale = resolve_locale(request)
    project, chat, run = _owned_run(db, user, project_id, chat_id, run_id, locale)
    if run.status != "awaiting_clarify":
        raise HTTPException(status_code=400, detail=t("run_invalid_state", locale))  # type: ignore[arg-type]
    require_rodi_for_paid_capability(user, db)
    gen_auth = await resolve_generation_auth(db, user)

    # Snapshot before commit — StreamingResponse runs after ORM instances expire.
    run_pk = run.id
    run_id_str = str(run.id)
    run_prompt = run.prompt or ""
    run_task_class = run.task_class or "code.edit.medium"
    run_model = run.model_slug or get_settings().effective_default_model
    clarify_json = run.clarify_json
    answers = body.answers or {}
    auto_exec = (run.mode or "agent") == "agent"
    project_id_str = str(project.id)
    chat_id_pk = chat.id

    run.answers_json = json.dumps(answers)
    db.commit()

    async def stream():
        try:
            yield _sse(
                {
                    "type": "step",
                    "id": "clarify",
                    "label": t("step_clarify", locale),
                    "status": "done",
                }
            )
            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "running",
                }
            )
            plan = await build_plan(
                prompt=run_prompt,
                answers=answers,
                task_class=run_task_class,
                auth=gen_auth,
                model=run_model,
                locale=locale,  # type: ignore[arg-type]
            )
            run_row = db.get(AgentRun, run_pk)
            if run_row is None:
                yield _sse({"type": "error", "message": t("run_invalid_state", locale)})
                return
            run_row.plan_json = json.dumps(plan)
            needs_confirm = _plan_requires_confirm("agent" if auto_exec else "plan", run_task_class, plan)
            run_row.status = "awaiting_plan_confirm" if needs_confirm else "running"
            db.commit()
            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "done",
                }
            )
            yield _sse(
                {
                    "type": "plan",
                    "run_id": run_id_str,
                    "tasks": plan,
                    "needs_confirm": needs_confirm,
                }
            )
            if needs_confirm:
                return

            history = _history(db, chat_id_pk)
            questions = json.loads(clarify_json) if clarify_json else None
            answers_block = format_answers_for_prompt(answers, questions)
            spawn_plan_job(
                run_id=run_pk,
                user_id=user.id,
                project_id=project_id_str,
                history=history,
                user_prompt=run_prompt,
                answers_block=answers_block,
                tasks=plan,
                model=run_model,
                locale=locale,  # type: ignore[arg-type]
            )
            async for chunk in iter_run_event_sse(str(run_pk)):
                yield chunk
        except Exception as exc:
            live = db.get(AgentRun, run_pk)
            if live is not None:
                live.status = "error"
                db.commit()
            yield _sse({"type": "error", "message": str(exc)[:500]})

    return _event_stream(stream())


@router.post("/projects/{project_id}/chats/{chat_id}/runs/{run_id}/confirm-plan")
async def confirm_plan(
    project_id: UUID,
    chat_id: UUID,
    run_id: UUID,
    body: ConfirmPlanRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    locale = resolve_locale(request)
    project, chat, run = _owned_run(db, user, project_id, chat_id, run_id, locale)
    if run.status not in ("awaiting_plan_confirm", "error"):
        raise HTTPException(status_code=400, detail=t("run_invalid_state", locale))  # type: ignore[arg-type]
    require_rodi_for_paid_capability(user, db)
    # Called for its side effect: raises early if the account has no usable
    # generation key, before we start mutating the run.
    await resolve_generation_auth(db, user)

    plan = body.plan if body.plan else (json.loads(run.plan_json) if run.plan_json else [])
    if not plan:
        raise HTTPException(status_code=400, detail=t("plan_empty", locale))  # type: ignore[arg-type]
    for task in plan:
        if isinstance(task, dict) and task.get("status") != "done":
            task["status"] = "pending"

    run_pk = run.id
    run_prompt = run.prompt or ""
    answers = json.loads(run.answers_json) if run.answers_json else None
    questions = json.loads(run.clarify_json) if run.clarify_json else None
    answers_block = format_answers_for_prompt(answers, questions)
    model = run.model_slug or get_settings().effective_default_model
    project_id_str = str(project.id)
    chat_id_pk = chat.id

    run.plan_json = json.dumps(plan)
    run.status = "running"
    db.commit()

    history = _history(db, chat_id_pk)
    user_id = user.id

    spawn_plan_job(
        run_id=run_pk,
        user_id=user_id,
        project_id=project_id_str,
        history=history,
        user_prompt=run_prompt,
        answers_block=answers_block,
        tasks=plan,
        model=model,
        locale=locale,  # type: ignore[arg-type]
        step_mode=bool(body.step_mode),
    )

    async def stream():
        async for chunk in iter_run_event_sse(str(run_pk)):
            yield chunk

    return _event_stream(stream())


@router.get("/projects/{project_id}/chats/{chat_id}/runs/{run_id}/events")
async def stream_run_events(
    project_id: UUID,
    chat_id: UUID,
    run_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Replay + live SSE for a background plan run (reconnect after refresh)."""
    locale = resolve_locale(request)
    _owned_run(db, user, project_id, chat_id, run_id, locale)
    after = 0
    try:
        after = max(0, int(request.query_params.get("after") or 0))
    except Exception:
        after = 0

    async def stream():
        async for chunk in iter_run_event_sse(str(run_id), start_after=after):
            yield chunk

    return _event_stream(stream())


@router.post("/projects/{project_id}/chats/{chat_id}/runs/{run_id}/cancel")
def cancel_run(
    project_id: UUID,
    chat_id: UUID,
    run_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    locale = resolve_locale(request)
    _, _, run = _owned_run(db, user, project_id, chat_id, run_id, locale)
    if run.status not in ("running", "awaiting_plan_confirm", "awaiting_clarify"):
        raise HTTPException(status_code=400, detail=t("run_invalid_state", locale))  # type: ignore[arg-type]
    mark_cancelled(str(run.id))
    run.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/chats/{chat_id}/messages/branch")
async def branch_messages(
    project_id: UUID,
    chat_id: UUID,
    body: BranchMessagesRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Truncate chat after a message and send a revised prompt."""
    locale = resolve_locale(request)
    project, chat = _owned_chat(db, user, project_id, chat_id, locale)
    require_rodi_for_paid_capability(user, db)

    anchor = db.get(Message, body.from_message_id)
    if anchor is None or anchor.chat_id != chat.id or anchor.role != "user":
        raise HTTPException(status_code=404, detail=t("run_not_found", locale))  # type: ignore[arg-type]

    db.query(Message).filter(
        Message.chat_id == chat.id,
        Message.created_at > anchor.created_at,
    ).delete(synchronize_session=False)

    user_content = body.content.strip()
    mode = (body.mode or "agent").strip().lower()
    if mode not in ("agent", "plan"):
        mode = "agent"

    anchor.content = user_content
    db.flush()

    gen_auth = await resolve_generation_auth(db, user)
    prior_count = db.query(Message).filter(Message.chat_id == chat.id).count()
    force_scaffold = prior_count == 0
    route = classify_and_route(user_content, force_scaffold=force_scaffold)
    route_effort = (
        t("effort_attachments", locale)  # type: ignore[arg-type]
        if has_reference_attachments(user_content) and not route.is_image
        else effort_label(route.tier, locale)  # type: ignore[arg-type]
    )

    run = AgentRun(
        chat_id=chat.id,
        project_id=project.id,
        user_id=user.id,
        mode=mode,
        status="running",
        prompt=user_content,
        task_class=route.task_class,
        model_slug=route.model,
    )
    db.add(run)
    db.commit()
    db.refresh(anchor)
    db.refresh(run)

    user_msg_id = str(anchor.id)
    project_id_str = str(project.id)
    chat_id_pk = chat.id
    run_pk = run.id
    use_single_pass = _should_single_pass(route.task_class, user_content, mode)
    clarify = (
        False
        if use_single_pass
        else needs_clarify(
            user_content,
            force_scaffold=force_scaffold,
            task_class=route.task_class,
        )
    )

    if clarify:
        questions = await build_clarify_questions_llm(
            user_content,
            locale,  # type: ignore[arg-type]
            auth=gen_auth,
            model=route.model,
            force_scaffold=force_scaffold,
        )
        run.clarify_json = json.dumps(questions)
        run.status = "awaiting_clarify"
        db.commit()

        async def clarify_stream():
            yield _sse({"type": "user_message", "id": user_msg_id, "run_id": str(run_pk)})
            yield _sse(
                {
                    "type": "route",
                    "task_class": route.task_class,
                    "effort_label": route_effort,
                    "tier": route.tier,
                }
            )
            yield _sse(
                {
                    "type": "clarify",
                    "run_id": str(run_pk),
                    "questions": questions,
                }
            )

        return _event_stream(clarify_stream())

    async def branch_stream():
        try:
            yield _sse({"type": "user_message", "id": user_msg_id, "run_id": str(run_pk)})
            yield _sse(
                {
                    "type": "route",
                    "task_class": route.task_class,
                    "effort_label": route_effort,
                    "tier": route.tier,
                }
            )
            if use_single_pass:
                async for chunk in _iter_single_pass(
                    db=db,
                    run_pk=run_pk,
                    project_id_str=project_id_str,
                    chat_id_pk=chat_id_pk,
                    user_content=user_content,
                    model=route.model,
                    auth=gen_auth,
                    locale=locale,  # type: ignore[arg-type]
                    route_effort=route_effort,
                    user_id=user.id,
                    surgical_edit=route.task_class
                    in ("code.edit.small", "text.copy", "text.micro", "code.edit.medium"),
                ):
                    yield chunk
                return

            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "running",
                }
            )
            plan = await build_plan(
                prompt=user_content,
                answers=None,
                task_class=route.task_class,
                auth=gen_auth,
                model=route.model,
                locale=locale,  # type: ignore[arg-type]
            )
            live = db.get(AgentRun, run_pk)
            if live is None:
                yield _sse({"type": "error", "message": t("run_invalid_state", locale)})
                return
            live.plan_json = json.dumps(plan)
            needs_confirm = _plan_requires_confirm(mode, route.task_class, plan)
            live.status = "awaiting_plan_confirm" if needs_confirm else "running"
            db.commit()
            yield _sse(
                {
                    "type": "step",
                    "id": "plan",
                    "label": t("step_plan", locale),
                    "status": "done",
                }
            )
            yield _sse(
                {
                    "type": "plan",
                    "run_id": str(run_pk),
                    "tasks": plan,
                    "needs_confirm": needs_confirm,
                }
            )
            if needs_confirm:
                return
            history = _history(db, chat_id_pk)
            spawn_plan_job(
                run_id=run_pk,
                user_id=user.id,
                project_id=project_id_str,
                history=history,
                user_prompt=user_content,
                answers_block="",
                tasks=plan,
                model=route.model,
                locale=locale,  # type: ignore[arg-type]
            )
            async for chunk in iter_run_event_sse(str(run_pk)):
                yield chunk
        except Exception as exc:
            err_row = db.get(AgentRun, run_pk)
            if err_row is not None:
                err_row.status = "error"
                db.commit()
            yield _sse({"type": "error", "message": str(exc)[:500]})

    return _event_stream(branch_stream())
