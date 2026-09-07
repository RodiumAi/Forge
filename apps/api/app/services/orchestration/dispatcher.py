"""Sequential multi-task execution for Forge agent plans."""

from __future__ import annotations

import asyncio
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from app.db import SessionLocal
from app.i18n import Locale, t
from app.services.apply_writes import apply_validated_writes_async
from app.services.filesystem import delete_file
from app.services.llm import (
    ERR_AUTH_BUSY,
    ERR_AUTH_EXPIRED,
    ERR_INVALID_KEY,
    ERR_QUOTA,
    RodiumError,
    StreamChunk,
    error_code_for,
    is_transient_network_error,
    stream_chat_completion,
)
from app.services.orchestration.context import build_llm_messages
from app.services.orchestration.router import fallback_model
from app.services.rodium_generation import RodiumGenerationAuth
from app.services.tags import parse_forge_tags
from app.services.text_plain import build_run_summary, to_plain_text

# Wall-clock ceiling for one plan task's generation, across every retry-free
# attempt. httpx only bounds the wait for the NEXT chunk, so a model dribbling
# one token a minute could hold a task open indefinitely — one production run
# burned 28 minutes before dying. A task that has not finished in four minutes
# is not going to.
_TASK_BUDGET_S = 240.0


def _sse(payload: dict) -> str:
    import json

    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_within_budget(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale,
    budget_s: float,
) -> AsyncIterator[StreamChunk]:
    """`stream_chat_completion` under a total wall-clock budget.

    Raises `asyncio.TimeoutError` once the budget is spent, which the caller
    classifies as `timeout` and treats like any other task failure.
    """
    deadline = time.monotonic() + budget_s
    agen = stream_chat_completion(auth=auth, model=model, messages=messages, locale=locale).__aiter__()
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"generation exceeded {budget_s:.0f}s")
            try:
                chunk = await asyncio.wait_for(agen.__anext__(), timeout=remaining)
            except StopAsyncIteration:
                return
            yield chunk
    finally:
        # wait_for cancels the pending __anext__ on timeout, leaving the
        # underlying HTTP stream open unless we close it explicitly.
        await agen.aclose()


def _resume_context_block(tasks: list[dict[str, Any]], applied: list[dict], idx: int) -> str:
    done = [str(t.get("title") or t.get("id") or "") for t in tasks if str(t.get("status") or "") == "done"]
    paths = sorted({str(a.get("path") or "") for a in applied if a.get("path")})
    lines = [
        "Resume context:",
        f"- Retrying task index {idx + 1}/{len(tasks)} after a previous interruption or failure.",
        "- Do not redo completed work. Preserve existing files unless this task requires edits.",
    ]
    if done:
        lines.append("- Completed tasks: " + "; ".join(done[:12]))
    if paths:
        lines.append("- Files already touched: " + ", ".join(paths[:40]))
    return "\n".join(lines)


def _failed_context_block(failures: list[dict[str, Any]]) -> str:
    """Tell the model which earlier tasks were skipped.

    Continuing past a failure is only safe if the tasks that follow know the
    ground shifted: a page task whose "architecture" step never ran will import
    modules that do not exist and take the whole build down with it.
    """
    if not failures:
        return ""
    titles = [str(f.get("title") or f.get("task_id") or "") for f in failures]
    return "\n".join(
        [
            "Skipped tasks (these did NOT complete):",
            *(f"- {title}" for title in titles[:8]),
            "If your task depends on any of them, implement the minimum needed "
            "for the app to compile and render — do not assume their files, "
            "exports or styles exist. Do not attempt to redo them in full.",
        ]
    )


def _failures_summary(failures: list[dict[str, Any]], locale: Locale, *, stopped: bool = False) -> str:
    """The end-of-run note listing what did not go through.

    A run that quietly drops two of eight steps and still says "done" is worse
    than one that fails loudly, so the skipped work is named in the assistant
    message itself, not only in the plan checklist. `stopped` marks the case
    where a structural task failed and the plan halted instead of degrading
    through the rest of the tasks — the wording says so plainly, since the
    remaining tasks were never attempted at all.
    """
    if not failures:
        return ""
    titles = [str(f.get("title") or f.get("task_id") or "") for f in failures]
    if stopped:
        stop_title = titles[0]
        if locale == "fr":
            head = f"Le plan s'est arrêté à l'étape « {stop_title} » :"
            tail = "Les étapes suivantes en dépendent et n'ont pas été lancées. Vous pouvez les relancer depuis le plan."
        else:
            head = f'The plan stopped at step "{stop_title}":'
            tail = (
                "The remaining steps depend on it and were never started. You can re-run them from the plan."
            )
        return "\n".join([head, tail])
    if locale == "fr":
        head = (
            "Une étape n'a pas abouti :" if len(titles) == 1 else f"{len(titles)} étapes n'ont pas abouti :"
        )
        tail = "Vous pouvez les relancer depuis le plan."
    else:
        head = "One step did not complete:" if len(titles) == 1 else f"{len(titles)} steps did not complete:"
        tail = "You can re-run them from the plan."
    return "\n".join([head, *(f"- {title}" for title in titles), tail])


def _coherence_task(locale: Locale) -> dict[str, Any]:
    files = [
        "src/context",
        "src/App.tsx",
        "src/main.tsx",
        "src/index.css",
        "DESIGN.md",
    ]
    if locale == "fr":
        return {
            "id": "coherence",
            "title": "Passe cohérence finale App + CSS + DESIGN + Context API",
            "acceptance": (
                "Provider keys = useX() consumers; classes TSX↔index.css; "
                "createRoot nommé; pas de crash mount"
            ),
            "files": files,
            "status": "pending",
        }
    return {
        "id": "coherence",
        "title": "Final coherence pass App + CSS + DESIGN + Context API",
        "acceptance": (
            "Provider keys match useX() consumers; TSX↔index.css classes; "
            "named createRoot; app mounts without throw"
        ),
        "files": files,
        "status": "pending",
    }


def ensure_coherence_task(tasks: list[dict[str, Any]], locale: Locale) -> list[dict[str, Any]]:
    """After multi-task plans, ensure a final coherence pass exists."""
    if len(tasks) < 2:
        return tasks
    if any(str(t.get("id") or "") == "coherence" for t in tasks):
        return tasks
    return [*list(tasks), _coherence_task(locale)]


def _task_prompt_block(task: dict[str, Any], *, idx: int, total: int) -> str:
    title = str(task.get("title") or task.get("id") or f"task_{idx + 1}")
    acceptance = str(task.get("acceptance") or "").strip()
    files = task.get("files") or []
    tid = str(task.get("id") or "").lower()
    lines = [
        f"Current plan task ({idx + 1}/{total}): {title}",
    ]
    if acceptance:
        lines.append(f"Acceptance: {acceptance}")
    if isinstance(files, list) and files:
        lines.append("Suggested files: " + ", ".join(str(p) for p in files[:12]))
    lines.append(
        "Implement ONLY this task using forge-write / forge-delete tags. "
        "Touch only the files required for it. Do not restyle unrelated sections. "
        "When rewriting a file, preserve unchanged sections verbatim. "
        "Do not write markdown feature lists or emoji outside the tags."
    )
    if tid == "styles_foundation":
        lines.append(
            "STYLES FOUNDATION: Write a complete src/index.css with design tokens, "
            "typography, layout shell, navbar and hero BASE styles, and utilities. "
            "Do not invent parallel naming schemes later tasks cannot reuse."
        )
    elif (
        tid != "styles_foundation"
        and tid != "architecture"
        and (
            tid in ("home", "primary_sections", "flows", "sections")
            or "section" in tid
            or "home" in tid
            or "flow" in tid
            or (total >= 2 and idx > 0)
        )
    ):
        lines.append(
            "CSS APPEND RULE (critical): When writing src/index.css you MUST preserve "
            "ALL existing selectors verbatim (especially navbar/hero/layout). "
            "Only APPEND new rules for this task's classes. Never replace the whole "
            "stylesheet with a shorter subset. Prefer reusing foundation classes."
        )
    if tid == "coherence":
        lines.append(
            "COHERENCE PASS (black-preview prevention):\n"
            "1) Align Context Provider value keys with every useX() destructuring "
            "(add aliases; do NOT rename half the consumers).\n"
            "2) Align TSX classNames with src/index.css (same naming scheme).\n"
            "3) Ensure src/main.tsx uses: import { createRoot } from 'react-dom/client'.\n"
            "4) Ensure arrays from context default to [] so .filter/.map never throw.\n"
            "5) Do not add new product features — only fix coherence."
        )
    return "\n".join(lines)


def _is_surgical_task(task: dict[str, Any], *, total_tasks: int) -> bool:
    tid = str(task.get("id") or "").lower()
    title = str(task.get("title") or "").lower()
    if tid in (
        "coherence",
        "edit",
        "styles",
        "polish",
        "home",
        "primary_sections",
        "flows",
        "sections",
    ):
        return True
    if total_tasks >= 2 and tid not in ("architecture", "structure"):
        # Multi-task plans after architecture: prefer minimal CSS/TSX diffs.
        return True
    return bool(total_tasks == 1 and ("edit" in tid or "modif" in title or "change" in title))


_STRUCTURAL_TASK_IDS = {"architecture", "structure", "styles_foundation"}
_STRUCTURAL_TASK_RE = re.compile(r"architect|structure|styles?_found|foundation")


def is_structural_task(task: dict[str, Any]) -> bool:
    """Everything else in the plan assumes this one landed.

    A failed `architecture` or `styles_foundation` task means later tasks import
    modules and reuse classes that were never written — continuing degrades the
    whole build instead of just skipping one feature. The regex also catches
    LLM-authored plans that rename the id but keep the same structural role.
    """
    tid = str(task.get("id") or "").lower()
    return tid in _STRUCTURAL_TASK_IDS or bool(_STRUCTURAL_TASK_RE.search(tid))


# A failure with one of these codes dooms every remaining task, not just this
# one: an empty RODI balance or a dead key can't heal between tasks, so skipping
# ahead only burns wall-clock re-hitting the same wall while the UI keeps showing
# "Building…". These abort the run outright with a terminal `error` frame, which
# the browser turns into the red inline message and unlocks the composer.
_FATAL_FAILURE_CODES = {ERR_QUOTA, ERR_INVALID_KEY, ERR_AUTH_EXPIRED, ERR_AUTH_BUSY}


async def _stream_verify_repair(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    findings: list[Any],
    db,
    user_id,
    locale: Locale,
    auth: RodiumGenerationAuth,
    resolve_auth: Callable[[], Awaitable[RodiumGenerationAuth]] | None,
    run_id: str | None,
    tasks: list[dict[str, Any]],
    applied: list[dict],
    full: list[str],
    thinking_parts: list[str],
    step_id: str,
    step_label: str,
    snapshot_label: str,
    format_findings_for_prompt,
    push_step: Callable[[str, str, str], str],
    focus_paths: list[str] | None = None,
    extra_prompt: str = "",
    surgical_edit: bool = True,
) -> AsyncIterator[str]:
    """One LLM verify-repair pass."""
    from app.services.orchestration.cancel import is_cancelled
    from app.services.orchestration.router import route_task

    repair_route = route_task("verify.repair")
    repair_prompt = (
        f"User request (context):\n{user_prompt}\n\n"
        f"{format_findings_for_prompt(findings)}\n\n"
        f"{extra_prompt}\n\n"
        "Fix ONLY these issues with forge-write tags. Prefer extending the Context "
        "Provider with aliases over rewriting all consumers. Sync orphan CSS class "
        "names. Fix scroll (no overflow:hidden on html/body). "
        "Do not add new features."
    ).strip()
    repair_messages = await build_llm_messages(
        project_id=project_id,
        history=[*history, ("user", repair_prompt)],
        user_query=repair_prompt,
        db=db,
        user_id=user_id,
        locale=locale,
        auth=auth,
        model=repair_route.model,
        surgical_edit=surgical_edit,
        focus_paths=focus_paths,
    )
    if db is not None:
        db.commit()  # release the pooled connection before the LLM stream
    current_auth = await resolve_auth() if resolve_auth else auth
    repair_buf: list[str] = []
    try:
        async for chunk in stream_chat_completion(
            auth=current_auth,
            model=repair_route.model,
            messages=repair_messages,
            locale=locale,
        ):
            if run_id and is_cancelled(run_id):
                yield push_step(step_id, step_label, "error")
                yield _sse({"type": "error", "code": "cancelled", "message": "cancelled", "plan": tasks})
                return
            if chunk.kind == "thinking":
                thinking_parts.append(chunk.content)
                yield _sse({"type": "thinking", "delta": chunk.content})
            else:
                repair_buf.append(chunk.content)
                full.append(chunk.content)
                yield _sse({"type": "token", "content": chunk.content})
        writes, deletes = parse_forge_tags("".join(repair_buf))
        written, violations = await apply_validated_writes_async(
            project_id, writes, snapshot_label=snapshot_label
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
            delete_file(project_id, op.path)
            applied.append({"op": "delete", "path": op.path})
            yield _sse({"type": "file_delete", "path": op.path})
        yield push_step(step_id, step_label, "done")
    except Exception as exc:
        yield push_step(step_id, step_label, "error")
        yield _sse({"type": "warning", "message": f"verify repair failed: {str(exc)[:240]}"})


async def run_plan_tasks(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_prompt: str,
    answers_block: str,
    tasks: list[dict[str, Any]],
    model: str,
    auth: RodiumGenerationAuth,
    resolve_auth: Callable[[], Awaitable[RodiumGenerationAuth]] | None = None,
    on_progress: Callable[[list[dict[str, Any]], int], Awaitable[None] | None] | None = None,
    locale: Locale,
    run_id: str | None = None,
    user_id=None,
    db=None,
    step_mode: bool = False,
) -> AsyncIterator[str]:
    """Yield SSE chunks while executing each plan task sequentially.

    A task that exhausts its retry budget is recorded and SKIPPED; the plan
    carries on. It used to `return`, which meant one bad step threw away every
    step after it — in production that cost a run 28 minutes of work at task 3
    of 8, with no record of why. Failures are collected here, announced as they
    happen, injected into later prompts so dependent tasks can degrade
    gracefully, and reported in the terminal `done` frame.

    The one exception is a failed *structural* task (`is_structural_task`):
    everything after it assumes it landed, so degrading gracefully is not an
    option and the plan stops there instead, leaving the rest `pending` for
    the Resume button.
    """
    from app.services.orchestration.cancel import is_cancelled

    tasks = ensure_coherence_task(tasks, locale)
    thinking_parts: list[str] = []
    full: list[str] = []
    applied: list[dict] = []
    steps: list[dict] = []
    failures: list[dict[str, Any]] = []
    stopped_early = False

    async def emit_progress(cursor: int) -> None:
        if not on_progress:
            return
        result = on_progress(tasks, cursor)
        if result is not None:
            await result

    def push_step(step_id: str, label: str, status: str) -> str:
        existing = next((s for s in steps if s["id"] == step_id), None)
        if existing:
            existing["status"] = status
            existing["label"] = label
        else:
            steps.append({"id": step_id, "label": label, "status": status})
        return _sse({"type": "step", "id": step_id, "label": label, "status": status})

    for idx, task in enumerate(tasks):
        if run_id and is_cancelled(run_id):
            task["status"] = "error"
            await emit_progress(idx)
            yield _sse({"type": "error", "code": "cancelled", "message": "cancelled", "plan": tasks})
            return

        if str(task.get("status") or "") == "done":
            continue

        tid = str(task.get("id") or f"task_{idx + 1}")
        title = str(task.get("title") or tid)
        task["status"] = "running"
        await emit_progress(idx)
        yield _sse({"type": "plan_task", "id": tid, "status": "running", "label": title})
        yield push_step(f"task:{tid}", title, "running")

        is_resume = any(str(t.get("status") or "") == "done" for t in tasks) or bool(applied)
        resume_block = _resume_context_block(tasks, applied, idx) if is_resume else ""
        failed_block = _failed_context_block(failures)

        task_prompt = (
            f"User request:\n{user_prompt}\n\n"
            f"{answers_block}\n\n"
            f"{resume_block}\n\n"
            f"{failed_block}\n\n"
            f"{_task_prompt_block(task, idx=idx, total=len(tasks))}"
        ).strip()

        if "intent:asset" in (user_prompt or ""):
            task_prompt += (
                "\n\nASSET RULE: Uploaded logos/icons with intent:asset must be used via "
                '<img src="/images/..."> or /logo.png from the markers — '
                "never redraw as SVG/CSS/emoji/icons."
            )

        surgical = _is_surgical_task(task, total_tasks=len(tasks))
        if surgical:
            task_prompt += (
                "\n\nSURGICAL EDIT: Prefer minimal diffs. Change only the lines needed "
                "for this task. Do not rewrite entire files unless the acceptance criteria "
                "require a full rewrite. Keep imports and unrelated JSX/CSS intact."
            )

        yield push_step("select_files", t("step_select_files", locale), "running")
        # Vision/asset materialization needs a DB session (S3 object rows).
        # plan_worker intentionally passes db=None so we never pin a connection
        # across the multi-minute LLM stream — open a short-lived session only
        # around message construction, then close before streaming.
        msg_kwargs = dict(
            project_id=project_id,
            history=[*history, ("user", task_prompt)],
            user_query=task_prompt,
            user_id=user_id,
            locale=locale,
            auth=auth,
            model=model,
            surgical_edit=surgical,
            # The plan names the files each task touches: guarantee their
            # current content is in the prompt, or the model rewrites them
            # from stale conversation memory.
            focus_paths=[str(f) for f in (task.get("files") or []) if isinstance(f, str)],
        )
        if db is not None:
            llm_messages = await build_llm_messages(db=db, **msg_kwargs)
            # End the read transaction: the LLM stream below can run for minutes
            # and must not pin a pooled DB connection the whole time.
            db.commit()
        else:
            with SessionLocal() as vision_db:
                llm_messages = await build_llm_messages(db=vision_db, **msg_kwargs)
                vision_db.commit()
        yield push_step("select_files", t("step_select_files", locale), "done")
        yield push_step("generate", t("step_generate", locale), "running")

        current_auth = await resolve_auth() if resolve_auth else auth
        task_buf: list[str] = []
        auth_retried = False
        network_retries = 0
        model_retried = False
        task_model = model
        task_cancelled = False
        task_failure: dict[str, Any] | None = None
        attempts = 0

        def _rewind(buf: list[str] = task_buf) -> None:
            # Drop this attempt's partial tokens: the browser is told to rewind
            # too, so a retry does not append to half an answer. The guard
            # matters — `full[-0:]` is the WHOLE list, not an empty slice.
            if buf:
                del full[-len(buf) :]
            buf.clear()

        while True:
            attempts += 1
            try:
                async for chunk in _stream_within_budget(
                    auth=current_auth,
                    model=task_model,
                    messages=llm_messages,
                    locale=locale,
                    budget_s=_TASK_BUDGET_S,
                ):
                    if run_id and is_cancelled(run_id):
                        task_cancelled = True
                        break
                    if chunk.kind == "thinking":
                        thinking_parts.append(chunk.content)
                        yield _sse({"type": "thinking", "delta": chunk.content})
                    else:
                        task_buf.append(chunk.content)
                        full.append(chunk.content)
                        yield _sse({"type": "token", "content": chunk.content})
                break
            except Exception as exc:
                code = error_code_for(exc)
                retryable_auth = (
                    isinstance(exc, RodiumError)
                    and exc.status_code in (401, 403)
                    and resolve_auth is not None
                )

                if not auth_retried and retryable_auth:
                    auth_retried = True
                    current_auth = await resolve_auth()
                    _rewind()
                    continue

                if network_retries < 2 and is_transient_network_error(exc):
                    network_retries += 1
                    _rewind()
                    yield _sse({"type": "stream_reset", "reason": code})
                    yield push_step("generate", t("step_generate", locale), "running")
                    continue

                # Not the network and not auth: the model itself failed, refused
                # or produced something unusable. One shot on a different model
                # before giving the task up.
                alternate = None if model_retried else fallback_model(task_model)
                if alternate:
                    model_retried = True
                    task_model = alternate
                    _rewind()
                    yield _sse({"type": "stream_reset", "reason": code})
                    yield push_step("generate", t("step_generate", locale), "running")
                    continue

                _rewind()
                task_failure = {
                    "task_id": tid,
                    "title": title,
                    "code": code,
                    "message": str(exc)[:300] or t("step_generate", locale),
                    "attempts": attempts,
                }
                break

        if task_cancelled:
            task["status"] = "error"
            await emit_progress(idx)
            yield push_step("generate", t("step_generate", locale), "error")
            yield _sse({"type": "error", "code": "cancelled", "message": "cancelled", "plan": tasks})
            return

        if task_failure is not None:
            # Skip, do not abort: the tasks after this one are still worth
            # running, and `_failed_context_block` warns them about the gap.
            # A structural task is the one exception — the rest of the plan
            # assumes it landed, so it stays `pending` instead of degrading.
            failures.append(task_failure)
            task["status"] = "error"
            await emit_progress(idx)
            yield push_step("generate", t("step_generate", locale), "error")
            yield push_step(f"task:{tid}", title, "error")
            yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
            yield _sse(
                {
                    "type": "task_failed",
                    "id": tid,
                    "label": title,
                    "code": task_failure["code"],
                    "message": task_failure["message"],
                }
            )
            # An empty balance or dead key can't recover between tasks: don't
            # skip ahead into a run of identical failures with "Building…" still
            # spinning. Abort with a terminal `error` — the browser stops the run,
            # shows the red inline message, and offers the recharge action.
            if task_failure["code"] in _FATAL_FAILURE_CODES:
                yield _sse(
                    {
                        "type": "error",
                        "code": task_failure["code"],
                        "message": task_failure["message"],
                        "plan": tasks,
                    }
                )
                return
            if is_structural_task(task):
                stopped_early = True
                break
            continue

        yield push_step("generate", t("step_generate", locale), "done")
        yield push_step("apply_writes", t("step_apply_writes", locale), "running")
        assistant_text = "".join(task_buf)
        writes, deletes = parse_forge_tags(assistant_text)

        # Empty model response (upstream hiccup): retry the task once, then
        # fail it honestly — a "done" task with zero writes silently skipped
        # the work and the user believed it was applied. The final coherence
        # pass is exempt: "nothing to fix" is a legitimate empty outcome.
        if tid != "coherence" and not writes and not deletes and len(assistant_text.strip()) < 40:
            yield push_step("generate", t("step_generate", locale), "running")
            yield _sse({"type": "stream_reset", "reason": "empty_response"})
            retry_buf: list[str] = []
            retry_cancelled = False
            try:
                async for chunk in _stream_within_budget(
                    auth=current_auth,
                    model=task_model,
                    messages=llm_messages,
                    locale=locale,
                    budget_s=_TASK_BUDGET_S,
                ):
                    if run_id and is_cancelled(run_id):
                        retry_cancelled = True
                        break
                    if chunk.kind == "thinking":
                        thinking_parts.append(chunk.content)
                        yield _sse({"type": "thinking", "delta": chunk.content})
                    else:
                        retry_buf.append(chunk.content)
                        full.append(chunk.content)
                        yield _sse({"type": "token", "content": chunk.content})
            except Exception:
                retry_buf = []
            if retry_cancelled:
                task["status"] = "error"
                await emit_progress(idx)
                yield _sse({"type": "error", "code": "cancelled", "message": "cancelled", "plan": tasks})
                return
            yield push_step("generate", t("step_generate", locale), "done")
            if retry_buf:
                assistant_text = "".join(retry_buf)
                writes, deletes = parse_forge_tags(assistant_text)
            if not writes and not deletes and len(assistant_text.strip()) < 40:
                failures.append(
                    {
                        "task_id": tid,
                        "title": title,
                        "code": "empty_response",
                        "message": t("empty_model_response", locale),
                        "attempts": attempts + 1,
                    }
                )
                task["status"] = "error"
                await emit_progress(idx)
                yield push_step(f"task:{tid}", title, "error")
                yield _sse({"type": "plan_task", "id": tid, "status": "error", "label": title})
                yield _sse(
                    {
                        "type": "task_failed",
                        "id": tid,
                        "label": title,
                        "code": "empty_response",
                        "message": t("empty_model_response", locale),
                    }
                )
                continue

        written, violations = await apply_validated_writes_async(
            project_id, writes, snapshot_label=f"before: {title}"
        )
        applied.extend(written)
        for item in written:
            yield _sse({"type": "file_write", "path": item["path"]})
        for v in violations:
            yield _sse({"type": "warning", "message": f"{v.get('code')}: {v.get('message')}", "violation": v})
        for op in deletes:
            delete_file(project_id, op.path)
            applied.append({"op": "delete", "path": op.path})
            yield _sse({"type": "file_delete", "path": op.path})
        yield push_step("apply_writes", t("step_apply_writes", locale), "done")

        task["status"] = "done"
        await emit_progress(idx)
        yield push_step(f"task:{tid}", title, "done")
        yield _sse({"type": "plan_task", "id": tid, "status": "done", "label": title})
        # One preview refresh per completed task (not per file write): the
        # client used to reload the iframe on every write, which flickered
        # non-stop during multi-task plans.
        if written:
            yield _sse({"type": "preview_refresh"})

        # Mid-plan CSS/build check — catch orphan classes before the next rewrite.
        if len(tasks) >= 2 and tid != "coherence":
            from app.services.orchestration.verify_build import (
                autofix_local_imports,
                format_css_second_pass_prompt,
                format_findings_for_prompt,
                repair_focus_paths,
                scaffold_fill_findings,
                verify_project_build,
            )

            casing_fixed, scaffolded = autofix_local_imports(project_id)
            if casing_fixed:
                yield _sse(
                    {
                        "type": "warning",
                        "message": (
                            "[verify-mid:info] import.casing_fixed: "
                            + ", ".join(f"{a} → {b}" for a, b in casing_fixed[:8])
                        ),
                    }
                )
            if scaffolded:
                yield _sse(
                    {
                        "type": "warning",
                        "message": ("[verify-mid:info] import.scaffolded: " + ", ".join(scaffolded[:8])),
                    }
                )
            mid_findings = verify_project_build(project_id) + scaffold_fill_findings(scaffolded)
            critical_mid = [
                f
                for f in mid_findings
                if f.severity == "critical"
                and f.code
                in (
                    "css.orphan_classes",
                    "css.overflow_hidden_root",
                    "entry.createRoot",
                    "import.module_not_found",
                    "import.scaffold_fill",
                )
            ]
            for finding in critical_mid:
                yield _sse(
                    {
                        "type": "warning",
                        "message": (f"[verify-mid:{finding.severity}] {finding.code}: {finding.message}"),
                        "finding": finding.to_dict(),
                    }
                )
            if critical_mid:
                yield push_step("verify_repair_mid", "Repairing mid-plan CSS/build", "running")
                async for chunk in _stream_verify_repair(
                    project_id=project_id,
                    history=history,
                    user_prompt=user_prompt,
                    findings=critical_mid,
                    db=db,
                    user_id=user_id,
                    locale=locale,
                    auth=auth,
                    resolve_auth=resolve_auth,
                    run_id=run_id,
                    tasks=tasks,
                    applied=applied,
                    full=full,
                    thinking_parts=thinking_parts,
                    step_id="verify_repair_mid",
                    step_label="Repairing mid-plan CSS/build",
                    snapshot_label=f"before repair: {title}",
                    format_findings_for_prompt=format_findings_for_prompt,
                    push_step=push_step,
                    focus_paths=repair_focus_paths(critical_mid),
                ):
                    yield chunk
                recheck = [
                    f
                    for f in verify_project_build(project_id)
                    if f.severity == "critical" and f.code == "css.orphan_classes"
                ]
                if recheck:
                    yield push_step("verify_repair_mid2", "CSS repair pass 2", "running")
                    css_extra = format_css_second_pass_prompt(recheck)
                    async for chunk in _stream_verify_repair(
                        project_id=project_id,
                        history=history,
                        user_prompt=user_prompt,
                        findings=recheck,
                        db=db,
                        user_id=user_id,
                        locale=locale,
                        auth=auth,
                        resolve_auth=resolve_auth,
                        run_id=run_id,
                        tasks=tasks,
                        applied=applied,
                        full=full,
                        thinking_parts=thinking_parts,
                        step_id="verify_repair_mid2",
                        step_label="CSS repair pass 2",
                        snapshot_label=f"before css repair 2: {title}",
                        format_findings_for_prompt=format_findings_for_prompt,
                        push_step=push_step,
                        focus_paths=["src/index.css", "src/App.tsx"],
                        extra_prompt=css_extra,
                    ):
                        yield chunk
                    still = [
                        f
                        for f in verify_project_build(project_id)
                        if f.severity == "critical" and f.code == "css.orphan_classes"
                    ]
                    if still:
                        yield _sse(
                            {
                                "type": "warning",
                                "message": (
                                    "Warning: critical CSS orphans remain after 2 repair passes — "
                                    + still[0].message[:240]
                                ),
                                "finding": still[0].to_dict(),
                            }
                        )

        # Step-by-step mode: pause after each task so the user can review the
        # result and explicitly launch the next step from the plan panel.
        if step_mode:
            remaining = [t2 for t2 in tasks if str(t2.get("status") or "") != "done"]
            if remaining:
                if applied:
                    yield _sse({"type": "preview_refresh"})
                summary = to_plain_text(build_run_summary(tasks=tasks, applied=applied, locale=locale))
                if failures:
                    summary = (summary + "\n\n" + _failures_summary(failures, locale)).strip()
                yield _sse(
                    {
                        "type": "done",
                        "paused": True,
                        "applied": applied,
                        "summary": summary,
                        "assistant_content": "".join(full),
                        "thinking_text": "".join(thinking_parts) or None,
                        "steps": steps,
                        "plan": tasks,
                        "failed": failures,
                        "verify_findings": [],
                    }
                )
                return

    # Deterministic verify + optional repair (black-preview prevention)
    from app.services.orchestration.page_visit_check import page_route_findings
    from app.services.orchestration.smoke_check import smoke_transform_findings
    from app.services.orchestration.verify_build import (
        autofix_local_imports,
        css_critical_findings,
        findings_have_critical,
        format_css_second_pass_prompt,
        format_findings_for_prompt,
        repair_focus_paths,
        scaffold_fill_findings,
        verify_project_build,
    )

    yield push_step("verify_build", "Verifying build", "running")
    yield push_step("verify_pages", t("step_verify_pages", locale), "running")
    casing_fixed, scaffolded = autofix_local_imports(project_id)
    if casing_fixed:
        yield _sse(
            {
                "type": "warning",
                "message": (
                    "[verify:info] import.casing_fixed: "
                    + ", ".join(f"{a} → {b}" for a, b in casing_fixed[:8])
                ),
            }
        )
    if scaffolded:
        yield _sse(
            {
                "type": "warning",
                "message": ("[verify:info] import.scaffolded: " + ", ".join(scaffolded[:8])),
            }
        )
    # Static heuristics + compile + named exports + route structure.
    findings = (
        scaffold_fill_findings(scaffolded)
        + verify_project_build(project_id)
        + await smoke_transform_findings(project_id)
        + page_route_findings(project_id)
    )
    for finding in findings:
        yield _sse(
            {
                "type": "warning",
                "message": f"[verify:{finding.severity}] {finding.code}: {finding.message}",
                "finding": finding.to_dict(),
            }
        )

    route_critical = any(f.severity == "critical" and f.code.startswith("route.") for f in findings)
    yield push_step(
        "verify_pages",
        t("step_verify_pages", locale),
        "error" if route_critical else "done",
    )

    # A structural task never ran: the project is deliberately half-built, and
    # a repair pass would try to improvise the missing architecture/foundation
    # instead of leaving it for the Resume button. Skip repair, keep findings.
    if findings_have_critical(findings) and not stopped_early:
        yield push_step("verify_build", "Verifying build", "error")
        yield push_step("verify_repair", "Repairing verify findings", "running")
        async for chunk in _stream_verify_repair(
            project_id=project_id,
            history=history,
            user_prompt=user_prompt,
            findings=findings,
            db=db,
            user_id=user_id,
            locale=locale,
            auth=auth,
            resolve_auth=resolve_auth,
            run_id=run_id,
            tasks=tasks,
            applied=applied,
            full=full,
            thinking_parts=thinking_parts,
            step_id="verify_repair",
            step_label="Repairing verify findings",
            snapshot_label="before final repair",
            format_findings_for_prompt=format_findings_for_prompt,
            push_step=push_step,
            focus_paths=repair_focus_paths(findings),
        ):
            yield chunk

        _, re_scaffolded = autofix_local_imports(project_id)
        findings = (
            scaffold_fill_findings(re_scaffolded)
            + verify_project_build(project_id)
            + await smoke_transform_findings(project_id)
            + page_route_findings(project_id)
        )
        if findings_have_critical(findings) and css_critical_findings(findings):
            yield push_step("verify_repair_css", "CSS repair pass 2", "running")
            css_findings = css_critical_findings(findings)
            css_extra = format_css_second_pass_prompt(findings)
            async for chunk in _stream_verify_repair(
                project_id=project_id,
                history=history,
                user_prompt=user_prompt,
                findings=css_findings,
                db=db,
                user_id=user_id,
                locale=locale,
                auth=auth,
                resolve_auth=resolve_auth,
                run_id=run_id,
                tasks=tasks,
                applied=applied,
                full=full,
                thinking_parts=thinking_parts,
                step_id="verify_repair_css",
                step_label="CSS repair pass 2",
                snapshot_label="before final css repair 2",
                format_findings_for_prompt=format_findings_for_prompt,
                push_step=push_step,
                focus_paths=["src/index.css", "src/App.tsx"],
                extra_prompt=css_extra,
            ):
                yield chunk
            _, re_scaffolded2 = autofix_local_imports(project_id)
            findings = (
                scaffold_fill_findings(re_scaffolded2)
                + verify_project_build(project_id)
                + await smoke_transform_findings(project_id)
                + page_route_findings(project_id)
            )

        for finding in findings:
            yield _sse(
                {
                    "type": "warning",
                    "message": f"[verify:{finding.severity}] {finding.code}: {finding.message}",
                    "finding": finding.to_dict(),
                }
            )
        route_critical = any(f.severity == "critical" and f.code.startswith("route.") for f in findings)
        yield push_step(
            "verify_pages",
            t("step_verify_pages", locale),
            "error" if route_critical else "done",
        )
        # A plan that skipped tasks is far likelier to leave the project
        # uncompilable, and the repair pass is the only thing standing between
        # that and a black preview. Buy one more attempt in exactly that case.
        if failures and findings_have_critical(findings):
            yield push_step("verify_repair_gap", "Repairing skipped-task fallout", "running")
            async for chunk in _stream_verify_repair(
                project_id=project_id,
                history=history,
                user_prompt=user_prompt,
                findings=findings,
                db=db,
                user_id=user_id,
                locale=locale,
                auth=auth,
                resolve_auth=resolve_auth,
                run_id=run_id,
                tasks=tasks,
                applied=applied,
                full=full,
                thinking_parts=thinking_parts,
                step_id="verify_repair_gap",
                step_label="Repairing skipped-task fallout",
                snapshot_label="before gap repair",
                format_findings_for_prompt=format_findings_for_prompt,
                push_step=push_step,
                focus_paths=repair_focus_paths(findings),
                extra_prompt=_failed_context_block(failures),
            ):
                yield chunk
            findings = (
                verify_project_build(project_id)
                + await smoke_transform_findings(project_id)
                + page_route_findings(project_id)
            )

        if findings_have_critical(findings):
            yield _sse(
                {
                    "type": "warning",
                    "message": (
                        "Critical verify findings remain — preview may stay black until "
                        "Context API / createRoot / CSS sync are fixed."
                    ),
                }
            )
            yield push_step("verify_build", "Verifying build", "error")
        else:
            yield push_step("verify_build", "Verifying build", "done")
    else:
        yield push_step(
            "verify_build",
            "Verifying build",
            "error" if findings_have_critical(findings) else "done",
        )

    if applied:
        # No dependency install and no dev server to bounce: the runner receives
        # the new source bundle straight from the browser on the next refresh.
        yield _sse({"type": "preview_refresh"})

    summary = to_plain_text(build_run_summary(tasks=tasks, applied=applied, locale=locale))
    if failures:
        summary = (summary + "\n\n" + _failures_summary(failures, locale, stopped=stopped_early)).strip()
    if findings_have_critical(findings):
        summary = (
            summary + "\n\nWarning: critical build verify findings remain — preview may be black."
        ).strip()

    yield push_step("done", t("step_done", locale), "done")
    yield _sse(
        {
            "type": "done",
            "applied": applied,
            "summary": summary,
            "assistant_content": "".join(full),
            "thinking_text": "".join(thinking_parts) or None,
            "steps": steps,
            "plan": tasks,
            "failed": failures,
            "stopped": stopped_early,
            "verify_findings": [f.to_dict() for f in findings],
        }
    )
