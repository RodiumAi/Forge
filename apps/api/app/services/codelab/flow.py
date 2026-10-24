"""The chat flows of a codelab project (contract: docs/plans/codelab-ai-events.md).

Picked by ``codelab_stream``:

* a new codelab (blank project): the outline is proposed and the run pauses
  for confirmation (``codelab.outline`` + ``plan``); on confirm,
  ``spawn_codelab_write_job`` writes the steps one by one in the background,
  each streamed as ``codelab.delta`` chunks, reconnectable like a site build;
* a step target (``target.stepId``): only that step is rewritten, enforced
  here (the model receives the other steps read-only and only that file is
  written);
* ``action: "check_code"``: a review of code consistency across the steps,
  nothing written;
* ``action: "make_files"`` (or outline ``files``): starter and solution files
  under ``files/`` plus their download entries;
* anything else: a codelab-level edit (add, remove, reorder, rewrite steps,
  metadata).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.config import get_settings
from app.errors import SitesError
from app.services.codelab import files as codelab_files
from app.services.codelab import store
from app.services.codelab.outline import Outline, check_outline, plan_tasks
from app.services.codelab.prompts import (
    CHECK_SYSTEM,
    CODELAB_EDIT_SYSTEM,
    FILES_SYSTEM,
    OUTLINE_SYSTEM,
    REQUEST_FILES_WORDS,
    STEP_SYSTEM,
    TARGETED_STEP_SYSTEM,
)
from app.services.deck_ai.flow import _fail_run, _finish_run, _guarded, _update_run, as_sse
from app.services.deck_ai.llm import ask_json
from app.services.deck_ai.targeting import valid_target_id
from app.services.document_scaffold import CODELAB_PATH, DESIGN_MD_PATH
from app.services.filesystem import read_file
from app.services.llm import RodiumError, is_transient_network_error, stream_chat_completion
from app.services.orchestration.cancel import clear_cancelled, is_cancelled
from app.services.typography import strip_long_dashes

logger = logging.getLogger(__name__)

Event = dict[str, Any]

MAX_PROMPT_CHARS = 12_000
#: Characters of earlier steps given to the writer so the code stays consistent.
MAX_PREVIOUS_CHARS = 24_000
#: Context budget of a codelab-level edit or a check (characters of Markdown).
MAX_CODELAB_CONTEXT_CHARS = 80_000
MAX_STEP_TOKENS = 6000
#: Stream chunks are grouped to this many characters before an event is sent.
DELTA_CHARS = 240
MAX_GENERATED_FILES = 30

CODELAB_ACTIONS = ("check_code", "make_files")
#: Deck quick actions that also make sense on one step.
STEP_ACTIONS = {
    "shorten": "Make this step shorter and tighter, keep every command and file it needs.",
    "punchier": "Make the prose of this step clearer and more engaging; do not change the code.",
    "translate": "Translate the prose of this step into {arg}; keep code, file names and commands unchanged.",
}

_LABELS: dict[str, tuple[str, str]] = {
    "codelab_outline": ("Plan du codelab", "Planning the codelab"),
    "codelab_write": ("Rédaction des étapes", "Writing the steps"),
    "codelab_edit": ("Modification de l'étape", "Editing the step"),
    "codelab_restructure": ("Modification du codelab", "Editing the codelab"),
    "codelab_check": ("Vérification du code", "Checking the code"),
    "codelab_files": ("Fichiers du projet", "Project files"),
    "done": ("Terminé", "Done"),
}
_MESSAGES = {
    "unavailable": (
        "La génération par l'IA n'est pas encore disponible pour ce type de projet.",
        "AI generation is not available for this project type yet.",
    ),
    "target_required": ("Sélectionnez une étape pour cette action.", "Select a step for this action."),
    "target_not_found": ("L'étape sélectionnée n'existe plus.", "The selected step no longer exists."),
    "empty": (
        "L'IA n'a rien écrit pour cette étape. Réessayez.",
        "The AI wrote nothing for this step. Try again.",
    ),
}


def _msg(key: str, locale: str) -> str:
    fr, en = _MESSAGES[key]
    return fr if locale == "fr" else en


def label(step_id: str, locale: str) -> str:
    fr, en = _LABELS.get(step_id, (step_id, step_id))
    return fr if locale == "fr" else en


class _Steps:
    def __init__(self, locale: str) -> None:
        self.locale = locale
        self.items: list[dict[str, str]] = []

    def push(self, step_id: str, status: str, text: str | None = None) -> Event:
        text = text or label(step_id, self.locale)
        existing = next((s for s in self.items if s["id"] == step_id), None)
        if existing:
            existing.update(status=status, label=text)
        else:
            self.items.append({"id": step_id, "label": text, "status": status})
        return {"type": "step", "id": step_id, "label": text, "status": status}


@dataclass
class CodelabContext:
    project_id: str
    run_pk: UUID
    user_id: UUID
    user_msg_id: str
    prompt: str
    locale: str
    gen_model: str
    edit_model: str
    route_effort: str
    tier: str
    resolve_auth: Callable[[], Awaitable[Any]]
    history: list[tuple[str, str]] = field(default_factory=list)
    target_step: str | None = None
    action: str | None = None
    action_input: str | None = None
    fresh: bool = False


def task_class(ctx: CodelabContext) -> str:
    if ctx.action == "check_code":
        return "codelab.check"
    if ctx.action == "make_files":
        return "codelab.files"
    if ctx.target_step or ctx.action:
        return "codelab.edit.target"
    return "codelab.outline" if ctx.fresh else "codelab.edit"


def wants_files(prompt: str) -> bool:
    lower = (prompt or "").lower()
    return any(word in lower for word in REQUEST_FILES_WORDS)


def unavailable_stream(locale: str) -> AsyncIterator[str]:
    async def stream():
        yield as_sse(
            {
                "type": "error",
                "code": "kind_not_available",
                "kind": "codelab",
                "message": _msg("unavailable", locale),
            }
        )

    return stream()


async def codelab_stream(ctx: CodelabContext) -> AsyncIterator[str]:
    """SSE of one chat message on a codelab project."""
    yield as_sse({"type": "user_message", "id": ctx.user_msg_id, "run_id": str(ctx.run_pk)})
    yield as_sse(
        {"type": "route", "task_class": task_class(ctx), "effort_label": ctx.route_effort, "tier": ctx.tier}
    )
    if ctx.action == "check_code":
        source = _check(ctx)
    elif ctx.action == "make_files":
        source = _files_flow(ctx)
    elif ctx.target_step or ctx.action:
        source = _targeted_edit(ctx)
    elif ctx.fresh:
        source = _outline(ctx)
    else:
        source = _codelab_edit(ctx)
    async for event in _guarded(ctx.run_pk, ctx.locale, source):
        yield as_sse(event)


# ── context helpers ────────────────────────────────────────────────────────


def _conversation(history: list[tuple[str, str]], limit: int = 6) -> str:
    recent = [(role, text) for role, text in history if role in ("user", "assistant")][-limit:]
    if not recent:
        return ""
    return "\n".join(["Recent conversation:", *[f"{role}: {text.strip()[:600]}" for role, text in recent]])


def _charter(project_id: str) -> str:
    try:
        return read_file(project_id, DESIGN_MD_PATH)[:2000]
    except (FileNotFoundError, OSError, ValueError):
        return ""


def _step_title(step: dict[str, Any], markdown: str) -> str:
    if step.get("title"):
        return step["title"]
    match = re.search(r"^#\s+(.+?)\s*#*\s*$", markdown or "", re.M)
    return match.group(1).strip() if match else step["id"]


def _outline_text(codelab: dict[str, Any], bodies: dict[str, str]) -> str:
    lines = [f"Codelab: {codelab.get('title')} ({codelab.get('level')})"]
    for index, step in enumerate(codelab.get("steps") or [], start=1):
        title = _step_title(step, bodies.get(step["id"], ""))
        lines.append(f"{index}. [{step['id']}] {title} ({step.get('minutes', 0)} min)")
    return "\n".join(lines)


def _fit(parts: list[tuple[str, str]], budget: int) -> str:
    """Join (header, body) parts, newest last, dropping the oldest beyond the budget."""
    kept: list[str] = []
    for header, body in reversed(parts):
        block = f"{header}\n{body}"
        if len(block) > budget:
            if not kept:
                kept.append(f"{header}\n{body[-budget:]}")
            break
        kept.append(block)
        budget -= len(block)
    return "\n\n".join(reversed(kept))


def clean_markdown(text: str, title: str) -> str:
    """The model's step Markdown, unwrapped, headed, bounded, house typography."""
    body = (text or "").strip()
    # A whole answer wrapped in one ```markdown fence.
    fenced = re.match(r"^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$", body)
    if fenced:
        body = fenced.group(1).strip()
    if not body.startswith("# "):
        body = f"# {title}\n\n{body}" if body else f"# {title}\n"
    return strip_long_dashes(body)[: store.MAX_STEP_CHARS].rstrip() + "\n"


async def stream_markdown(
    *,
    auth: Any,
    model: str,
    system: str,
    user: str,
    locale: str,
    step_id: str,
    run_id: str,
) -> AsyncIterator[Event | str]:
    """Stream a step: ``codelab.delta`` events, then the full text (a str) last.

    A network failure before the first token is retried once; after it, the
    error goes up (the caller writes a fallback step).
    """
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for attempt in range(2):
        parts: list[str] = []
        pending = ""
        try:
            async for chunk in stream_chat_completion(
                auth=auth,
                model=model,
                messages=messages,
                locale=locale,
                temperature=0.3,
                max_tokens=MAX_STEP_TOKENS,
                reasoning_effort=get_settings().generation_effort,
            ):
                if chunk.kind != "token":
                    continue
                parts.append(chunk.content)
                pending += chunk.content
                if len(pending) >= DELTA_CHARS:
                    yield {"type": "codelab.delta", "run_id": run_id, "step_id": step_id, "text": pending}
                    pending = ""
            if pending:
                yield {"type": "codelab.delta", "run_id": run_id, "step_id": step_id, "text": pending}
            yield "".join(parts)
            return
        except RodiumError as exc:
            if parts or attempt or not is_transient_network_error(exc):
                raise
            await asyncio.sleep(0.6)


# ── outline ────────────────────────────────────────────────────────────────


async def _outline(ctx: CodelabContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("codelab_outline", "running")
    auth = await ctx.resolve_auth()
    user = "\n\n".join(
        part
        for part in (
            f"Request:\n{ctx.prompt[:MAX_PROMPT_CHARS]}",
            _conversation(ctx.history),
            "The user explicitly asked for downloadable files." if wants_files(ctx.prompt) else "",
        )
        if part
    )
    answer = await ask_json(
        auth=auth,
        model=ctx.gen_model,
        system=OUTLINE_SYSTEM,
        user=user,
        check=check_outline,
        locale=ctx.locale,
        max_repairs=1,
    )
    outline = answer.value
    if wants_files(ctx.prompt) and not (outline.files.starter or outline.files.solution):
        outline.files.starter = outline.files.solution = True
    tasks = plan_tasks(outline)
    meta = {"title": outline.title, "summary": outline.summary}
    _update_run(
        ctx.run_pk,
        plan_json=json.dumps(tasks, ensure_ascii=False),
        plan_meta_json=json.dumps({**meta, "codelab": outline.model_dump()}, ensure_ascii=False),
        status="awaiting_plan_confirm",
        task_class="codelab.outline",
        model_slug=ctx.gen_model,
    )
    yield {"type": "codelab.outline", "run_id": str(ctx.run_pk), "outline": outline.model_dump()}
    yield steps.push("codelab_outline", "done")
    yield {"type": "plan", "run_id": str(ctx.run_pk), "tasks": tasks, "meta": meta, "needs_confirm": True}


# ── writing (after confirm) ────────────────────────────────────────────────


def new_codelab(outline: Outline, previous: dict[str, Any]) -> dict[str, Any]:
    steps = [
        {
            "id": step.id,
            "title": step.title,
            "file": store.step_filename(index, step.id),
            "minutes": step.minutes,
        }
        for index, step in enumerate(outline.steps, start=1)
    ]
    document = {
        **{k: v for k, v in previous.items() if k in ("author", "repoUrl", "theme", "downloads")},
        "version": 1,
        "title": (outline.title or previous.get("title") or "Codelab")[:200],
        "summary": outline.summary,
        "level": outline.level,
        "durationMinutes": min(6000, sum(step["minutes"] for step in steps)),
        "prerequisites": outline.prerequisites,
        "learn": outline.learn,
        "steps": steps,
    }
    document.setdefault("downloads", [])
    return document


def _step_prompt(
    *, outline: Outline, index: int, request: str, written: list[tuple[str, str]], charter: str
) -> str:
    step = outline.steps[index]
    titles = "\n".join(f"{i}. {s.title}: {s.idea}" for i, s in enumerate(outline.steps, start=1))
    previous = _fit(
        [(f"Step {i + 1} as written:", body) for i, (_, body) in enumerate(written)], MAX_PREVIOUS_CHARS
    )
    parts = [
        f"Codelab: {outline.title} ({outline.level})\nFor whom and what: {outline.summary}",
        "Prerequisites: " + "; ".join(outline.prerequisites) if outline.prerequisites else "",
        "The reader will learn: " + "; ".join(outline.learn) if outline.learn else "",
        f"Outline:\n{titles}",
        f"Earlier steps (keep file names and code consistent with them):\n{previous}" if previous else "",
        f'Write step {index + 1} of {len(outline.steps)} (id "{step.id}").\n'
        f"Title: {step.title}\nWhat it does: {step.idea}\nReading time: about {step.minutes} minutes.",
        f"Tone of the brand charter:\n{charter}" if charter else "",
        f"Original request:\n{request[:MAX_PROMPT_CHARS]}",
    ]
    return "\n\n".join(part for part in parts if part)


async def codelab_write_events(
    *,
    project_id: str,
    run_pk: UUID,
    prompt: str,
    outline: Outline,
    model: str,
    locale: str,
    resolve_auth: Callable[[], Awaitable[Any]],
) -> AsyncIterator[Event]:
    """Write the confirmed outline: codelab.json, then each step, then the files asked for."""
    rid = str(run_pk)
    steps = _Steps(locale)
    applied: list[dict[str, str]] = []
    warnings: list[str] = []
    tasks = plan_tasks(outline)
    yield steps.push("codelab_write", "running")
    auth = await resolve_auth()
    charter = _charter(project_id)

    store.begin_run(project_id, "before codelab generation")
    previous = store.read_codelab_or_default(project_id)
    codelab = store.write_codelab(project_id, new_codelab(outline, previous))
    keep = {step["file"] for step in codelab["steps"]}
    for step in previous.get("steps") or []:
        if step["file"] not in keep:
            store.remove_step_file(project_id, step["file"])
    for step in codelab["steps"]:
        # Headings first: the player can show the codelab while it fills.
        store.write_step(project_id, step["file"], f"# {step['title']}\n")
    applied.append({"op": "write", "path": CODELAB_PATH})
    yield {"type": "file_write", "path": CODELAB_PATH}
    yield {"type": "codelab.codelab", "run_id": rid, "codelab": codelab}

    written: list[tuple[str, str]] = []
    total = len(outline.steps)
    for index, planned in enumerate(outline.steps):
        if is_cancelled(rid):
            clear_cancelled(rid)
            raise asyncio.CancelledError
        entry = codelab["steps"][index]
        yield steps.push(f"task:{planned.id}", "running", planned.title)
        fallback = False
        markdown = ""
        try:
            async for item in stream_markdown(
                auth=auth,
                model=model,
                system=STEP_SYSTEM,
                user=_step_prompt(
                    outline=outline, index=index, request=prompt, written=written, charter=charter
                ),
                locale=locale,
                step_id=planned.id,
                run_id=rid,
            ):
                if isinstance(item, str):
                    markdown = item
                else:
                    yield item
        except RodiumError:
            raise
        except Exception as exc:  # a broken step never breaks the codelab
            logger.warning("codelab step %s failed: %s", planned.id, exc)
            markdown = ""
        if not markdown.strip():
            fallback = True
            warnings.append(f"{planned.id}: empty answer")
            yield {
                "type": "warning",
                "message": f"STEP_FALLBACK: {planned.id}",
                "violation": {"code": "STEP_FALLBACK", "path": entry["file"]},
            }
            markdown = f"# {planned.title}\n\n{planned.idea}\n"
        markdown = store.write_step(project_id, entry["file"], clean_markdown(markdown, planned.title))
        written.append((planned.id, markdown))
        applied.append({"op": "write", "path": entry["file"]})
        yield {"type": "file_write", "path": entry["file"]}
        yield {
            "type": "codelab.step",
            "run_id": rid,
            "step_id": planned.id,
            "index": index,
            "total": total,
            "step": entry,
            "markdown": markdown,
            "fallback": fallback,
        }
        tasks[index]["status"] = "done"
        yield steps.push(f"task:{planned.id}", "done", planned.title)
    yield steps.push("codelab_write", "done")

    kinds = [kind for kind in ("starter", "solution") if getattr(outline.files, kind)]
    if kinds:
        async for event in _write_files(
            project_id=project_id,
            run_pk=run_pk,
            auth=auth,
            model=model,
            locale=locale,
            kinds=kinds,
            steps=steps,
        ):
            if event.get("type") == "file_write":
                applied.append({"op": "write", "path": event["path"]})
            if event.get("type") == "warning":
                warnings.append(event["message"])
            yield event

    yield {"type": "codelab.done", "run_id": rid, "steps": [sid for sid, _ in written], "warnings": warnings}
    yield steps.push("done", "done")
    summary = (
        f"Codelab de {len(written)} étapes généré."
        if locale == "fr"
        else f"Generated a {len(written)}-step codelab."
    )
    payload = {"summary": summary, "steps": steps.items, "applied": applied, "plan": tasks}
    _finish_run(run_pk, payload, locale)
    yield {"type": "done", **payload}


def spawn_codelab_write_job(
    *,
    project_id: str,
    run_pk: UUID,
    prompt: str,
    outline: Outline,
    model: str,
    locale: str,
    resolve_auth: Callable[[], Awaitable[Any]],
) -> None:
    """Run ``codelab_write_events`` in the background; events go to the run queue."""
    from app.services.orchestration import plan_worker, run_queue

    rid = str(run_pk)
    existing = plan_worker._running_tasks.get(rid)
    if existing and not existing.done():
        return

    async def runner() -> None:
        run_queue.clear_run_events(rid)
        run_queue.claim_run(rid)
        try:
            source = codelab_write_events(
                project_id=project_id,
                run_pk=run_pk,
                prompt=prompt,
                outline=outline,
                model=model,
                locale=locale,
                resolve_auth=resolve_auth,
            )
            try:
                async for event in _guarded(run_pk, locale, source):
                    run_queue.publish_run_event(rid, event)
            except asyncio.CancelledError:
                _fail_run(run_pk, "cancelled", "cancelled")
                run_queue.publish_run_event(
                    rid, {"type": "error", "code": "cancelled", "message": "cancelled"}
                )
        finally:
            run_queue.release_run(rid)
            plan_worker._running_tasks.pop(rid, None)

    plan_worker._running_tasks[rid] = asyncio.create_task(runner(), name=f"forge-codelab-{rid}")
    run_queue.enqueue_plan_run(rid)


# ── targeted edit (one step) ───────────────────────────────────────────────


def _instruction(ctx: CodelabContext) -> str:
    request = ctx.prompt[:MAX_PROMPT_CHARS]
    if ctx.action in STEP_ACTIONS:
        arg = (ctx.action_input or ("English" if ctx.locale == "fr" else "French")).strip()[:40]
        return f"Action: {STEP_ACTIONS[ctx.action].format(arg=arg)}\nUser message: {request}"
    return f"User request:\n{request}"


def _fail(ctx: CodelabContext, steps: _Steps, step_id: str, code: str) -> list[Event]:
    _fail_run(ctx.run_pk, code, code)
    return [steps.push(step_id, "error"), {"type": "error", "code": code, "message": _msg(code, ctx.locale)}]


async def _targeted_edit(ctx: CodelabContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("codelab_edit", "running")
    pid = ctx.project_id
    if not ctx.target_step:
        for event in _fail(ctx, steps, "codelab_edit", "target_required"):
            yield event
        return
    codelab = store.read_codelab_or_default(pid)
    ids = [step["id"] for step in codelab.get("steps") or []]
    if ctx.target_step not in ids:
        for event in _fail(ctx, steps, "codelab_edit", "target_not_found"):
            yield event
        return
    index = ids.index(ctx.target_step)
    entry = codelab["steps"][index]
    bodies = store.read_all_steps(pid, codelab)
    original = bodies.get(entry["id"], "")
    title = _step_title(entry, original)
    neighbours = []
    if index > 0:
        neighbours.append(("Previous step (read-only):", bodies.get(ids[index - 1], "")[-8000:]))
    if index + 1 < len(ids):
        neighbours.append(("Next step (read-only):", bodies.get(ids[index + 1], "")[:6000]))
    user = "\n\n".join(
        part
        for part in (
            "Read-only context:",
            _outline_text(codelab, bodies),
            *[f"{h}\n{b}" for h, b in neighbours if b.strip()],
            f'The step to change (id "{entry["id"]}", file {entry["file"]}):\n{original[:60000]}',
            _instruction(ctx),
        )
        if part
    )
    auth = await ctx.resolve_auth()
    markdown = ""
    async for item in stream_markdown(
        auth=auth,
        model=ctx.edit_model,
        system=TARGETED_STEP_SYSTEM,
        user=user,
        locale=ctx.locale,
        step_id=entry["id"],
        run_id=str(ctx.run_pk),
    ):
        if isinstance(item, str):
            markdown = item
        else:
            yield item
    if not markdown.strip():
        _fail_run(ctx.run_pk, "invalid_model_output", "empty step")
        yield steps.push("codelab_edit", "error")
        yield {"type": "error", "code": "invalid_model_output", "message": _msg("empty", ctx.locale)}
        return
    store.begin_run(pid, "before step edit")
    # The only file a step target may write is that step's own Markdown.
    markdown = store.write_step(pid, entry["file"], clean_markdown(markdown, title))
    applied = [{"op": "write", "path": entry["file"]}]
    yield {"type": "file_write", "path": entry["file"]}
    new_title = _step_title({"id": entry["id"]}, markdown)
    if entry.get("title") and new_title != entry["title"]:
        # ...and its own title in codelab.json when the heading changed.
        entry["title"] = new_title[:200]
        codelab = store.write_codelab(pid, codelab)
        applied.append({"op": "write", "path": CODELAB_PATH})
        yield {"type": "file_write", "path": CODELAB_PATH}
        yield {"type": "codelab.codelab", "run_id": str(ctx.run_pk), "codelab": codelab}
    yield {
        "type": "codelab.step",
        "run_id": str(ctx.run_pk),
        "step_id": entry["id"],
        "index": index,
        "total": len(ids),
        "step": entry,
        "markdown": markdown,
        "fallback": False,
        "target": {"stepId": entry["id"]},
    }
    yield steps.push("codelab_edit", "done")
    yield {"type": "codelab.done", "run_id": str(ctx.run_pk), "steps": [entry["id"]], "warnings": []}
    yield steps.push("done", "done")
    summary = "Étape mise à jour." if ctx.locale == "fr" else "Step updated."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}


# ── codelab-level edit ─────────────────────────────────────────────────────


@dataclass
class CodelabEdit:
    order: list[str]
    steps: dict[str, dict[str, Any]]
    meta: dict[str, Any]


_META_KEYS = ("title", "summary", "level", "prerequisites", "learn")


def check_codelab_edit(data: dict[str, Any], existing: set[str]) -> CodelabEdit:
    raw_order = data.get("order")
    if not isinstance(raw_order, list) or not raw_order:
        raise ValueError('"order" must be a non-empty list of step ids')
    order: list[str] = []
    for item in raw_order[:200]:
        sid = valid_target_id(item)
        if sid is None:
            raise ValueError(f"invalid step id in order: {item!r}")
        if sid not in order:
            order.append(sid)
    changed: dict[str, dict[str, Any]] = {}
    for entry in data.get("steps") or []:
        if not isinstance(entry, dict):
            raise ValueError("each entry of steps must be an object")
        sid = valid_target_id(entry.get("id"))
        if sid is None:
            raise ValueError("a changed step has no valid id")
        markdown = entry.get("markdown")
        if sid not in existing and not (isinstance(markdown, str) and markdown.strip()):
            raise ValueError(f"new step {sid} needs its markdown")
        minutes = entry.get("minutes")
        changed[sid] = {
            "title": str(entry.get("title") or "").strip()[:200] or None,
            "minutes": max(0, min(600, int(minutes))) if isinstance(minutes, (int, float)) else None,
            "markdown": markdown if isinstance(markdown, str) and markdown.strip() else None,
        }
    missing = [sid for sid in order if sid not in existing and sid not in changed]
    if missing:
        raise ValueError(f"order lists steps that do not exist: {missing}")
    meta_raw = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    meta = {k: meta_raw[k] for k in _META_KEYS if k in meta_raw}
    return CodelabEdit(order=order[:200], steps=changed, meta=meta)


def _apply_meta(codelab: dict[str, Any], meta: dict[str, Any]) -> None:
    if isinstance(meta.get("title"), str) and meta["title"].strip():
        codelab["title"] = meta["title"].strip()[:200]
    if isinstance(meta.get("summary"), str):
        codelab["summary"] = meta["summary"].strip()[:2000]
    if meta.get("level") in ("beginner", "intermediate", "advanced"):
        codelab["level"] = meta["level"]
    for key in ("prerequisites", "learn"):
        if isinstance(meta.get(key), list):
            codelab[key] = [str(item).strip()[:300] for item in meta[key] if str(item).strip()][:30]


async def _codelab_edit(ctx: CodelabContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("codelab_restructure", "running")
    pid = ctx.project_id
    codelab = store.read_codelab_or_default(pid)
    bodies = store.read_all_steps(pid, codelab)
    existing = {step["id"]: step for step in codelab.get("steps") or []}
    context = _fit(
        [
            (f"[{step['id']}] file {step['file']}:", bodies.get(step["id"], ""))
            for step in codelab.get("steps") or []
        ],
        MAX_CODELAB_CONTEXT_CHARS,
    )
    meta = {k: codelab.get(k) for k in _META_KEYS}
    user = "\n\n".join(
        part
        for part in (
            f"codelab.json metadata:\n{json.dumps(meta, ensure_ascii=False)}",
            _outline_text(codelab, bodies),
            f"Steps:\n{context}",
            _conversation(ctx.history),
            f"User request:\n{ctx.prompt[:MAX_PROMPT_CHARS]}",
        )
        if part
    )
    auth = await ctx.resolve_auth()
    answer = await ask_json(
        auth=auth,
        model=ctx.gen_model,
        system=CODELAB_EDIT_SYSTEM,
        user=user,
        check=lambda data: check_codelab_edit(data, set(existing)),
        locale=ctx.locale,
    )
    edit = answer.value
    store.begin_run(pid, "before codelab edit")
    applied: list[dict[str, str]] = []
    number = store.next_step_number(codelab)
    refs: list[dict[str, Any]] = []
    for sid in edit.order:
        ref = dict(existing.get(sid) or {})
        change = edit.steps.get(sid) or {}
        if not ref:
            ref = {"id": sid, "file": store.step_filename(number, sid), "minutes": 5}
            number += 1
        if change.get("title"):
            ref["title"] = change["title"]
        if change.get("minutes") is not None:
            ref["minutes"] = change["minutes"]
        refs.append(ref)
    _apply_meta(codelab, edit.meta)
    codelab["steps"] = refs
    codelab["durationMinutes"] = store.total_minutes(codelab)
    codelab = store.write_codelab(pid, codelab)
    applied.append({"op": "write", "path": CODELAB_PATH})
    yield {"type": "file_write", "path": CODELAB_PATH}
    yield {"type": "codelab.codelab", "run_id": str(ctx.run_pk), "codelab": codelab}
    for sid, ref in existing.items():
        if sid not in edit.order:
            store.remove_step_file(pid, ref["file"])
            applied.append({"op": "delete", "path": ref["file"]})
            yield {"type": "file_delete", "path": ref["file"]}
            yield {"type": "codelab.step_removed", "run_id": str(ctx.run_pk), "step_id": sid}
    order = [step["id"] for step in codelab["steps"]]
    touched: list[str] = []
    for index, ref in enumerate(codelab["steps"]):
        change = edit.steps.get(ref["id"]) or {}
        if change.get("markdown") is None:
            if ref["id"] not in existing:
                store.write_step(pid, ref["file"], f"# {ref.get('title') or ref['id']}\n")
            continue
        markdown = store.write_step(
            pid, ref["file"], clean_markdown(change["markdown"], ref.get("title") or ref["id"])
        )
        touched.append(ref["id"])
        applied.append({"op": "write", "path": ref["file"]})
        yield {"type": "file_write", "path": ref["file"]}
        yield {
            "type": "codelab.step",
            "run_id": str(ctx.run_pk),
            "step_id": ref["id"],
            "index": index,
            "total": len(order),
            "step": ref,
            "markdown": markdown,
            "fallback": False,
        }
    yield steps.push("codelab_restructure", "done")
    yield {"type": "codelab.done", "run_id": str(ctx.run_pk), "steps": touched, "warnings": []}
    yield steps.push("done", "done")
    summary = "Codelab mis à jour." if ctx.locale == "fr" else "Codelab updated."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}


# ── code consistency check ─────────────────────────────────────────────────

_SEVERITIES = ("error", "warning", "info")


def check_review(data: dict[str, Any], ids: set[str]) -> dict[str, Any]:
    issues_raw = data.get("issues")
    if not isinstance(issues_raw, list):
        raise ValueError('"issues" must be a list')
    issues = []
    for item in issues_raw[:50]:
        if not isinstance(item, dict) or not str(item.get("message") or "").strip():
            continue
        sid = item.get("stepId")
        issues.append(
            {
                "stepId": sid if sid in ids else None,
                "severity": item.get("severity") if item.get("severity") in _SEVERITIES else "warning",
                "message": strip_long_dashes(str(item["message"]).strip())[:600],
                "fix": strip_long_dashes(str(item.get("fix") or "").strip())[:600] or None,
            }
        )
    return {"summary": strip_long_dashes(str(data.get("summary") or "").strip())[:600], "issues": issues}


async def _check(ctx: CodelabContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("codelab_check", "running")
    pid = ctx.project_id
    codelab = store.read_codelab_or_default(pid)
    bodies = store.read_all_steps(pid, codelab)
    ids = {step["id"] for step in codelab.get("steps") or []}
    context = _fit(
        [(f"[{step['id']}]", bodies.get(step["id"], "")) for step in codelab.get("steps") or []],
        MAX_CODELAB_CONTEXT_CHARS,
    )
    file_list = ", ".join(item.path for item in codelab_files.list_files(pid)[:80]) or "none"
    user = "\n\n".join(
        [
            _outline_text(codelab, bodies),
            f"Project files: {file_list}",
            f"Steps:\n{context}",
            f"User message: {ctx.prompt[:2000]}",
        ]
    )
    auth = await ctx.resolve_auth()
    answer = await ask_json(
        auth=auth,
        model=ctx.gen_model,
        system=CHECK_SYSTEM,
        user=user,
        check=lambda data: check_review(data, ids),
        locale=ctx.locale,
        temperature=0.1,
    )
    review = answer.value
    yield {"type": "codelab.check", "run_id": str(ctx.run_pk), **review}
    yield steps.push("codelab_check", "done")
    yield steps.push("done", "done")
    count = len(review["issues"])
    if ctx.locale == "fr":
        summary = review["summary"] or (
            "Aucun problème trouvé." if not count else f"{count} point(s) à corriger."
        )
    else:
        summary = review["summary"] or ("No problem found." if not count else f"{count} issue(s) to fix.")
    payload = {"summary": summary, "steps": steps.items, "applied": [], "check": review}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}


# ── starter and solution files ─────────────────────────────────────────────


def check_files(data: dict[str, Any], kinds: list[str]) -> list[tuple[str, str]]:
    raw = data.get("files")
    if not isinstance(raw, list) or not raw:
        raise ValueError('"files" must be a non-empty list')
    out: list[tuple[str, str]] = []
    for item in raw[:MAX_GENERATED_FILES]:
        if not isinstance(item, dict) or not isinstance(item.get("content"), str):
            raise ValueError("each file needs a path and a string content")
        try:
            path = codelab_files.normalize_path(str(item.get("path") or ""))
        except SitesError as exc:
            raise ValueError(f"invalid path {item.get('path')!r}") from exc
        if path.split("/")[1] not in kinds:
            raise ValueError(f"{path} is not under files/{' or files/'.join(kinds)}/")
        out.append((path, item["content"][: store.MAX_STEP_CHARS]))
    return out


async def _write_files(
    *,
    project_id: str,
    run_pk: UUID,
    auth: Any,
    model: str,
    locale: str,
    kinds: list[str],
    steps: _Steps,
    request: str = "",
) -> AsyncIterator[Event]:
    yield steps.push("codelab_files", "running")
    codelab = store.read_codelab_or_default(project_id)
    bodies = store.read_all_steps(project_id, codelab)
    context = _fit(
        [(f"[{step['id']}]", bodies.get(step["id"], "")) for step in codelab.get("steps") or []],
        MAX_CODELAB_CONTEXT_CHARS,
    )
    user = "\n\n".join(
        part
        for part in (
            f"Write the {' and '.join(kinds)} files.",
            _outline_text(codelab, bodies),
            f"Steps:\n{context}",
            f"User message: {request[:2000]}" if request else "",
        )
        if part
    )
    answer = await ask_json(
        auth=auth,
        model=model,
        system=FILES_SYSTEM,
        user=user,
        check=lambda data: check_files(data, kinds),
        locale=locale,
        temperature=0.2,
    )
    written: list[str] = []
    for path, content in answer.value:
        try:
            codelab_files.save_text_file(project_id, path, content)
        except Exception as exc:
            yield {
                "type": "warning",
                "message": f"FILE_SKIPPED: {path}",
                "violation": {"code": "FILE_SKIPPED", "path": path},
            }
            logger.info("codelab file %s skipped: %s", path, exc)
            continue
        written.append(path)
        yield {"type": "file_write", "path": path}
    # Each kind that got files is offered as a ZIP download.
    downloads = list(codelab.get("downloads") or [])
    known = {item["id"] for item in downloads}
    labels = {
        "starter": ("Projet de départ", "Starter project"),
        "solution": ("Solution finale", "Final solution"),
    }
    changed = False
    for kind in kinds:
        if kind in known or not any(path.startswith(f"files/{kind}/") for path in written):
            continue
        fr, en = labels[kind]
        downloads.append(
            {"id": kind, "label": fr if locale == "fr" else en, "path": f"files/{kind}", "zip": True}
        )
        changed = True
    if changed:
        codelab["downloads"] = downloads
        codelab = store.write_codelab(project_id, codelab)
        yield {"type": "file_write", "path": CODELAB_PATH}
        yield {"type": "codelab.codelab", "run_id": str(run_pk), "codelab": codelab}
    yield {"type": "codelab.files", "run_id": str(run_pk), "files": written}
    yield steps.push("codelab_files", "done")


async def _files_flow(ctx: CodelabContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    lower = (ctx.action_input or ctx.prompt or "").lower()
    kinds = [kind for kind in ("starter", "solution") if kind in lower] or ["starter", "solution"]
    auth = await ctx.resolve_auth()
    store.begin_run(ctx.project_id, "before codelab files")
    applied: list[dict[str, str]] = []
    async for event in _write_files(
        project_id=ctx.project_id,
        run_pk=ctx.run_pk,
        auth=auth,
        model=ctx.gen_model,
        locale=ctx.locale,
        kinds=kinds,
        steps=steps,
        request=ctx.prompt,
    ):
        if event.get("type") == "file_write":
            applied.append({"op": "write", "path": event["path"]})
        yield event
    yield {"type": "codelab.done", "run_id": str(ctx.run_pk), "steps": [], "warnings": []}
    yield steps.push("done", "done")
    count = sum(1 for item in applied if item["path"].startswith("files/"))
    summary = f"{count} fichier(s) écrit(s)." if ctx.locale == "fr" else f"Wrote {count} file(s)."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}
