"""The chat flows of a slides project.

Three entry points, picked by ``document_stream``:

* a new deck (blank deck or first request): the outline is proposed and the
  run pauses for confirmation (``plan`` + ``deck.outline`` events); on
  confirm, ``spawn_deck_write_job`` writes the slides one by one in the
  background, reconnectable through ``/runs/{id}/events`` like a site build;
* a target (slide or element) or a quick action: one edit restricted to the
  target, enforced server-side;
* anything else: a deck-level edit (add, remove, reorder, restyle slides).

Flows yield event dicts; ``as_sse`` serializes them for the inline streams and
the background job publishes them to the run queue. The event shapes the web
client already parses (``user_message``, ``route``, ``step``, ``plan``,
``file_write``, ``warning``, ``error``, ``done``) keep their meaning; the deck
specific ones are ``deck.outline``, ``deck.deck``, ``deck.slide``,
``deck.slide_removed`` and ``deck.done``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.contracts.forge_design import FORMAT_SIZES, Transition, dump_document
from app.db import SessionLocal
from app.models import AgentRun
from app.prompts.deck import (
    DECK_EDIT_SYSTEM,
    OUTLINE_SYSTEM,
    QUICK_ACTION_INSTRUCTIONS,
    SLIDE_SYSTEM,
    TARGETED_ELEMENT_SYSTEM,
    TARGETED_SLIDE_SYSTEM,
)
from app.services.deck_ai import store
from app.services.deck_ai.layouts import (
    LAYOUT_NAMES,
    describe_layout,
    fallback_slide,
    normalize_layout,
)
from app.services.deck_ai.llm import DeckAnswerError, ask_json
from app.services.deck_ai.outline import Outline, check_outline, plan_tasks
from app.services.deck_ai.targeting import SlideResult, element_from_answer, find_element, slide_from_answer
from app.services.deck_ai.theme import DeckTheme, load_theme
from app.services.deck_ai.visuals import drop_placeholders, fill_visual
from app.services.document_scaffold import DECK_PATH, DEFAULT_THEME
from app.services.llm import RodiumError, error_code_for
from app.services.orchestration.cancel import clear_cancelled, is_cancelled

logger = logging.getLogger(__name__)

Event = dict[str, Any]

QUICK_ACTIONS = tuple(QUICK_ACTION_INSTRUCTIONS)
DEFAULT_TRANSITION = {"type": "fade", "durationMs": 500}
#: Context budget of a deck-level edit (characters of slide JSON).
MAX_DECK_CONTEXT_CHARS = 60_000
MAX_PROMPT_CHARS = 12_000

_LABELS: dict[str, tuple[str, str]] = {
    "deck_outline": ("Plan de la présentation", "Planning the deck"),
    "deck_write": ("Rédaction des slides", "Writing the slides"),
    "deck_edit": ("Modification de la slide", "Editing the slide"),
    "deck_restyle": ("Modification de la présentation", "Editing the deck"),
    "deck_visual": ("Recherche d'images", "Finding images"),
    "done": ("Terminé", "Done"),
}
_UNAVAILABLE = {
    "fr": "La génération par l'IA n'est pas encore disponible pour ce type de projet.",
    "en": "AI generation is not available for this project type yet.",
}
_TARGET_REQUIRED = {
    "fr": "Sélectionnez une slide ou un élément pour cette action.",
    "en": "Select a slide or an element for this action.",
}
_TARGET_MISSING = {
    "fr": "La slide ou l'élément sélectionné n'existe plus.",
    "en": "The selected slide or element no longer exists.",
}
_INVALID_OUTPUT = {
    "fr": "L'IA n'a pas produit une slide valide. Réessayez.",
    "en": "The AI did not produce a valid slide. Please try again.",
}


def label(step_id: str, locale: str) -> str:
    fr, en = _LABELS.get(step_id, (step_id, step_id))
    return fr if locale == "fr" else en


def _msg(table: dict[str, str], locale: str) -> str:
    return table["fr" if locale == "fr" else "en"]


def as_sse(event: Event) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@dataclass
class DeckContext:
    project_id: str
    run_pk: UUID
    user_id: UUID
    user_msg_id: str
    prompt: str
    locale: str
    #: Escalation-tier model (outline, writing) and default model (small edits),
    #: both already filtered by the plan's allowed tiers.
    gen_model: str
    edit_model: str
    route_effort: str
    tier: str
    resolve_auth: Callable[[], Awaitable[Any]]
    history: list[tuple[str, str]] = field(default_factory=list)
    target_slide: str | None = None
    target_element: str | None = None
    action: str | None = None
    action_input: str | None = None
    fresh: bool = False


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


# ── run bookkeeping ────────────────────────────────────────────────────────


def _update_run(run_pk: UUID, **fields: Any) -> None:
    with SessionLocal() as db:
        row = db.get(AgentRun, run_pk)
        if row is None:
            return
        for key, value in fields.items():
            setattr(row, key, value)
        db.commit()


def _finish_run(run_pk: UUID, payload: dict[str, Any], locale: str) -> None:
    from app.services.orchestration.plan_persist import persist_assistant

    with SessionLocal() as db:
        row = db.get(AgentRun, run_pk)
        if row is None:
            return
        persist_assistant(db, row, payload, locale)
        row.status = "done"
        db.commit()


def _fail_run(run_pk: UUID, code: str, message: str) -> None:
    from app.services.orchestration.plan_persist import record_run_outcome

    with SessionLocal() as db:
        row = db.get(AgentRun, run_pk)
        if row is None:
            return
        row.status = "cancelled" if code == "cancelled" else "error"
        record_run_outcome(row, code=code, message=message)
        db.commit()


def error_event(exc: BaseException, locale: str) -> Event:
    if isinstance(exc, DeckAnswerError):
        return {"type": "error", "code": "invalid_model_output", "message": _msg(_INVALID_OUTPUT, locale)}
    return {"type": "error", "code": error_code_for(exc), "message": str(exc)[:500]}


async def _guarded(run_pk: UUID, locale: str, source: AsyncIterator[Event]) -> AsyncIterator[Event]:
    """Close the run on any failure with a terminal ``error`` event."""
    try:
        async for event in source:
            yield event
    except Exception as exc:
        if not isinstance(exc, (RodiumError, DeckAnswerError)):
            logger.exception("deck run failed run_id=%s", run_pk)
        event = error_event(exc, locale)
        _fail_run(run_pk, event["code"], str(exc))
        yield event


# ── context ────────────────────────────────────────────────────────────────


def _read_deck_or_default(project_id: str) -> dict[str, Any]:
    try:
        return store.read_deck(project_id)
    except (FileNotFoundError, ValueError):
        return {
            "version": 1,
            "format": {"ratio": "16:9", "width": 1920, "height": 1080},
            "theme": dict(DEFAULT_THEME),
            "slides": [],
        }


def _conversation(history: list[tuple[str, str]], limit: int = 6) -> str:
    recent = [(role, text) for role, text in history if role in ("user", "assistant")][-limit:]
    if not recent:
        return ""
    lines = ["Recent conversation:"]
    lines += [f"{role}: {text.strip()[:600]}" for role, text in recent]
    return "\n".join(lines)


def _outline_text(deck: dict[str, Any], titles: dict[str, str]) -> str:
    lines = [f"Deck: {deck.get('title') or ''} ({deck['format']['ratio']})"]
    for index, ref in enumerate(deck.get("slides") or [], start=1):
        lines.append(f"{index}. [{ref['id']}] {titles.get(ref['id'], '')} (layout {ref['layout']})")
    return "\n".join(lines)


def _slide_title(slide: dict[str, Any]) -> str:
    for element in slide.get("elements") or []:
        if element.get("type") == "text" and element.get("role") == "title":
            return " ".join(str(b.get("text") or "") for b in element.get("content") or []).strip()[:120]
    return ""


def _deck_titles(project_id: str, deck: dict[str, Any]) -> dict[str, str]:
    titles = {}
    for ref in deck.get("slides") or []:
        try:
            titles[ref["id"]] = _slide_title(store.read_slide(project_id, ref["id"]))
        except (ValueError, OSError):
            titles[ref["id"]] = ""
    return titles


def wants_generated_images(prompt: str) -> bool:
    """AI images only when the user explicitly asked to generate some."""
    from app.services.orchestration.router import requested_image_prompts

    return bool(requested_image_prompts(prompt))


# ── entry point ────────────────────────────────────────────────────────────


def unavailable_stream(kind_id: str, locale: str) -> AsyncIterator[str]:
    async def stream():
        yield as_sse(
            {
                "type": "error",
                "code": "kind_not_available",
                "kind": kind_id,
                "message": _msg(_UNAVAILABLE, locale),
            }
        )

    return stream()


async def document_stream(ctx: DeckContext) -> AsyncIterator[str]:
    """SSE of one chat message on a slides project."""
    yield as_sse({"type": "user_message", "id": ctx.user_msg_id, "run_id": str(ctx.run_pk)})
    yield as_sse(
        {"type": "route", "task_class": _task_class(ctx), "effort_label": ctx.route_effort, "tier": ctx.tier}
    )
    if ctx.target_slide or ctx.target_element or ctx.action:
        source = _targeted_edit(ctx)
    elif ctx.fresh:
        source = _outline(ctx)
    else:
        source = _deck_edit(ctx)
    async for event in _guarded(ctx.run_pk, ctx.locale, source):
        yield as_sse(event)


def _task_class(ctx: DeckContext) -> str:
    if ctx.target_slide or ctx.target_element or ctx.action:
        return "deck.edit.target"
    return "deck.outline" if ctx.fresh else "deck.edit"


# ── outline ────────────────────────────────────────────────────────────────


async def _outline(ctx: DeckContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("deck_outline", "running")
    auth = await ctx.resolve_auth()
    theme = load_theme(ctx.project_id)
    deck = _read_deck_or_default(ctx.project_id)
    user = "\n\n".join(
        part
        for part in (
            f"Request:\n{ctx.prompt[:MAX_PROMPT_CHARS]}",
            _conversation(ctx.history),
            f"Current format: {deck['format']['ratio']}",
            "Layouts: " + ", ".join(LAYOUT_NAMES),
            theme.describe(),
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
    tasks = plan_tasks(outline)
    meta = {"title": outline.title, "summary": outline.summary}
    _update_run(
        ctx.run_pk,
        plan_json=json.dumps(tasks, ensure_ascii=False),
        plan_meta_json=json.dumps({**meta, "deck": outline.model_dump()}, ensure_ascii=False),
        status="awaiting_plan_confirm",
        task_class="deck.outline",
        model_slug=ctx.gen_model,
    )
    yield {"type": "deck.outline", "run_id": str(ctx.run_pk), "outline": outline.model_dump()}
    yield steps.push("deck_outline", "done")
    yield {"type": "plan", "run_id": str(ctx.run_pk), "tasks": tasks, "meta": meta, "needs_confirm": True}


# ── writing (after confirm) ────────────────────────────────────────────────


def _slide_prompt(*, outline: Outline, index: int, request: str, theme: DeckTheme, ratio: str) -> str:
    slide = outline.slides[index]
    titles = "\n".join(f"{i}. {s.title}" for i, s in enumerate(outline.slides, start=1))
    parts = [
        f"Deck: {outline.title}\nAudience and purpose: {outline.summary}",
        f"Outline:\n{titles}",
        f'Write slide {index + 1} of {len(outline.slides)} (id "{slide.id}").\n'
        f"Title: {slide.title}\nIdea: {slide.idea}\nLayout: {slide.layout}",
        describe_layout(slide.layout, ratio),
        "This slide wants a photo or illustration." if slide.visual else "",
        theme.describe(),
        f"Brand charter:\n{theme.charter[:3000]}" if theme.charter else "",
        f"Original request:\n{request[:MAX_PROMPT_CHARS]}",
    ]
    return "\n\n".join(part for part in parts if part)


async def _place_visual(
    project_id: str,
    result: SlideResult,
    *,
    generate: bool,
    auth: Any,
    locale: str,
) -> tuple[dict[str, Any], str | None]:
    """The slide with its picture filled (or its placeholder dropped)."""
    if result.visual is None:
        return drop_placeholders(result.slide), None
    outcome = await fill_visual(
        project_id=project_id,
        slide=result.slide,
        visual=result.visual,
        generate=generate,
        auth=auth,
        locale=locale,
    )
    return drop_placeholders(outcome.slide), outcome.path


def _new_deck(outline: Outline, previous: dict[str, Any]) -> dict[str, Any]:
    width, height = FORMAT_SIZES[outline.format]
    return {
        "version": 1,
        "title": outline.title[:200] or previous.get("title") or "Presentation",
        "format": {"ratio": outline.format, "width": width, "height": height},
        "theme": previous.get("theme") or dict(DEFAULT_THEME),
        "slides": [
            {"id": slide.id, "layout": slide.layout, "transition": dict(DEFAULT_TRANSITION)}
            for slide in outline.slides
        ],
    }


async def deck_write_events(
    *,
    project_id: str,
    run_pk: UUID,
    prompt: str,
    outline: Outline,
    model: str,
    locale: str,
    resolve_auth: Callable[[], Awaitable[Any]],
) -> AsyncIterator[Event]:
    """Write the confirmed outline: deck.json, then each slide, its notes and visuals."""
    rid = str(run_pk)
    steps = _Steps(locale)
    applied: list[dict[str, str]] = []
    warnings: list[str] = []
    tasks = plan_tasks(outline)
    yield steps.push("deck_write", "running")
    auth = await resolve_auth()
    theme = load_theme(project_id)
    generate = wants_generated_images(prompt)

    store.begin_run(project_id, "before deck generation")
    previous = _read_deck_or_default(project_id)
    deck = store.write_deck(project_id, _new_deck(outline, previous))
    keep = {ref["id"] for ref in deck["slides"]}
    for ref in previous.get("slides") or []:
        if ref["id"] not in keep:
            store.remove_slide_files(project_id, ref["id"])
    for ref in deck["slides"]:
        # Empty bodies first: the player can render the deck while it fills.
        store.write_slide(project_id, {"id": ref["id"], "elements": []})
    applied.append({"op": "write", "path": DECK_PATH})
    yield {"type": "file_write", "path": DECK_PATH}
    yield {"type": "deck.deck", "run_id": rid, "deck": deck}

    ratio = outline.format
    written: list[str] = []
    for index, planned in enumerate(outline.slides):
        if is_cancelled(rid):
            clear_cancelled(rid)
            raise asyncio.CancelledError
        task = tasks[index]
        yield steps.push(f"task:{planned.id}", "running", planned.title)
        fallback = False
        repairs = 0
        try:
            answer = await ask_json(
                auth=auth,
                model=model,
                system=SLIDE_SYSTEM,
                user=_slide_prompt(outline=outline, index=index, request=prompt, theme=theme, ratio=ratio),
                check=lambda data, sid=planned.id: slide_from_answer(data, sid, theme),
                locale=locale,
            )
            result = answer.value
            repairs = answer.repairs
        except DeckAnswerError as exc:
            # A broken slide never breaks the deck: write the plain layout and say so.
            fallback = True
            warnings.append(f"{planned.id}: {exc.last_errors[:300]}")
            yield {
                "type": "warning",
                "message": f"SLIDE_FALLBACK: {planned.id}",
                "violation": {"code": "SLIDE_FALLBACK", "path": store.slide_path(planned.id)},
            }
            result = SlideResult(
                slide=fallback_slide(
                    planned.id, planned.layout, ratio, title=planned.title, idea=planned.idea
                ),
                notes=planned.idea,
            )
        if result.visual is not None:
            yield steps.push("deck_visual", "running")
        slide, image_path = await _place_visual(
            project_id, result, generate=generate, auth=auth, locale=locale
        )
        if result.visual is not None:
            yield steps.push("deck_visual", "done")
        slide = store.write_slide(project_id, slide)
        notes = store.write_notes(project_id, planned.id, result.notes or "")
        for path in (store.slide_path(planned.id), store.notes_path(planned.id), image_path):
            if path:
                applied.append({"op": "write", "path": path})
                yield {"type": "file_write", "path": path}
        yield {
            "type": "deck.slide",
            "run_id": rid,
            "slide_id": planned.id,
            "index": index,
            "total": len(outline.slides),
            "slide": slide,
            "notes": notes,
            "repaired": repairs > 0,
            "fallback": fallback,
        }
        task["status"] = "done"
        written.append(planned.id)
        yield steps.push(f"task:{planned.id}", "done", planned.title)

    yield steps.push("deck_write", "done")
    yield {"type": "deck.done", "run_id": rid, "slides": written, "warnings": warnings}
    yield steps.push("done", "done")
    summary = (
        f"Présentation de {len(written)} slides générée."
        if locale == "fr"
        else f"Generated a {len(written)}-slide presentation."
    )
    payload = {"summary": summary, "steps": steps.items, "applied": applied, "plan": tasks}
    _finish_run(run_pk, payload, locale)
    yield {"type": "done", **payload}


def spawn_deck_write_job(
    *,
    project_id: str,
    run_pk: UUID,
    prompt: str,
    outline: Outline,
    model: str,
    locale: str,
    resolve_auth: Callable[[], Awaitable[Any]],
) -> None:
    """Run ``deck_write_events`` in the background; events go to the run queue.

    The browser reads them through ``iter_run_event_sse`` (the confirm-plan
    response, or ``/runs/{id}/events`` after a refresh), exactly like a site
    build, so closing the tab does not stop the deck.
    """
    from app.services.orchestration import plan_worker, run_queue

    rid = str(run_pk)
    existing = plan_worker._running_tasks.get(rid)
    if existing and not existing.done():
        return

    async def runner() -> None:
        run_queue.clear_run_events(rid)
        run_queue.claim_run(rid)
        try:
            source = deck_write_events(
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

    plan_worker._running_tasks[rid] = asyncio.create_task(runner(), name=f"forge-deck-{rid}")
    run_queue.enqueue_plan_run(rid)


# ── targeted edit ──────────────────────────────────────────────────────────


def _instruction(ctx: DeckContext) -> str:
    request = ctx.prompt[:MAX_PROMPT_CHARS]
    if not ctx.action:
        return f"User request:\n{request}"
    template = QUICK_ACTION_INSTRUCTIONS[ctx.action]
    if ctx.action == "change_layout":
        arg = (
            normalize_layout(ctx.action_input)
            if ctx.action_input
            else "a different layout that suits the content"
        )
        template += f" Available layouts: {', '.join(LAYOUT_NAMES)}."
    elif ctx.action == "translate":
        arg = (ctx.action_input or ("English" if ctx.locale == "fr" else "French")).strip()[:40]
    else:
        arg = ""
    return f"Action: {template.format(arg=arg)}\nUser message: {request}"


async def _targeted_edit(ctx: DeckContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("deck_edit", "running")
    pid = ctx.project_id
    if ctx.action and not (ctx.target_slide or ctx.target_element):
        yield steps.push("deck_edit", "error")
        _fail_run(ctx.run_pk, "target_required", "quick action without target")
        yield {"type": "error", "code": "target_required", "message": _msg(_TARGET_REQUIRED, ctx.locale)}
        return
    deck = _read_deck_or_default(pid)
    ids = [ref["id"] for ref in deck.get("slides") or []]
    slide_id = ctx.target_slide
    if slide_id is None and ctx.target_element:
        # An element target without its slide: find the slide that holds it.
        slide_id = next(
            (
                sid
                for sid in ids
                if find_element(store.read_slide(pid, sid).get("elements") or [], ctx.target_element)
            ),
            None,
        )
    if slide_id not in ids:
        yield steps.push("deck_edit", "error")
        _fail_run(ctx.run_pk, "target_not_found", "target slide not in deck")
        yield {"type": "error", "code": "target_not_found", "message": _msg(_TARGET_MISSING, ctx.locale)}
        return
    original = store.read_slide(pid, slide_id)
    element_id = ctx.target_element
    if element_id and find_element(original.get("elements") or [], element_id) is None:
        yield steps.push("deck_edit", "error")
        _fail_run(ctx.run_pk, "target_not_found", "target element not on slide")
        yield {"type": "error", "code": "target_not_found", "message": _msg(_TARGET_MISSING, ctx.locale)}
        return

    auth = await ctx.resolve_auth()
    theme = load_theme(pid)
    ref = next(r for r in deck["slides"] if r["id"] == slide_id)
    ratio = deck["format"]["ratio"]
    context = [
        "Read-only context:",
        _outline_text(deck, _deck_titles(pid, deck)),
        theme.describe(),
        describe_layout(ref["layout"], ratio),
    ]
    if element_id:
        system = TARGETED_ELEMENT_SYSTEM
        element = find_element(original["elements"], element_id)
        user = "\n\n".join(
            [
                *context,
                f"The slide (read-only):\n{json.dumps(original, ensure_ascii=False)}",
                f'Element to change (id "{element_id}"):\n{json.dumps(element, ensure_ascii=False)}',
                _instruction(ctx),
            ]
        )

        def check(data: dict[str, Any]) -> SlideResult:
            return element_from_answer(data, original, element_id, theme)

    else:
        system = TARGETED_SLIDE_SYSTEM
        user = "\n\n".join(
            [
                *context,
                f"Speaker notes of the slide:\n{store.read_notes(pid, slide_id)[:2000]}",
                f'The slide to change (id "{slide_id}"):\n{json.dumps(original, ensure_ascii=False)}',
                _instruction(ctx),
            ]
        )

        def check(data: dict[str, Any]) -> SlideResult:
            return slide_from_answer(data, slide_id, theme)

    answer = await ask_json(
        auth=auth, model=ctx.edit_model, system=system, user=user, check=check, locale=ctx.locale
    )
    result = answer.value
    store.begin_run(pid, "before slide edit")
    applied: list[dict[str, str]] = []
    if result.dropped:
        yield {
            "type": "warning",
            "message": "TARGET_SCOPE: " + ", ".join(result.dropped),
            "violation": {"code": "TARGET_SCOPE", "path": store.slide_path(slide_id)},
        }
    slide, image_path = await _place_visual(
        pid, result, generate=wants_generated_images(ctx.prompt), auth=auth, locale=ctx.locale
    )
    slide = store.write_slide(pid, slide)
    applied.append({"op": "write", "path": store.slide_path(slide_id)})
    yield {"type": "file_write", "path": store.slide_path(slide_id)}
    if image_path:
        applied.append({"op": "write", "path": image_path})
        yield {"type": "file_write", "path": image_path}
    notes = store.read_notes(pid, slide_id)
    if result.notes is not None and not element_id:
        notes = store.write_notes(pid, slide_id, result.notes)
        applied.append({"op": "write", "path": store.notes_path(slide_id)})
        yield {"type": "file_write", "path": store.notes_path(slide_id)}
    if result.layout and not element_id and normalize_layout(result.layout) != ref["layout"]:
        # The only deck.json change a slide target may make: its own layout name.
        ref["layout"] = normalize_layout(result.layout)
        deck = store.write_deck(pid, deck)
        applied.append({"op": "write", "path": DECK_PATH})
        yield {"type": "file_write", "path": DECK_PATH}
        yield {"type": "deck.deck", "run_id": str(ctx.run_pk), "deck": deck}
    yield {
        "type": "deck.slide",
        "run_id": str(ctx.run_pk),
        "slide_id": slide_id,
        "index": [r["id"] for r in deck["slides"]].index(slide_id),
        "total": len(deck["slides"]),
        "slide": slide,
        "notes": notes,
        "repaired": answer.repairs > 0,
        "fallback": False,
        "target": {"slideId": slide_id, **({"elementId": element_id} if element_id else {})},
    }
    yield steps.push("deck_edit", "done")
    yield {"type": "deck.done", "run_id": str(ctx.run_pk), "slides": [slide_id], "warnings": []}
    yield steps.push("done", "done")
    summary = "Slide mise à jour." if ctx.locale == "fr" else "Slide updated."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}


# ── deck-level edit ────────────────────────────────────────────────────────


@dataclass
class DeckEdit:
    order: list[str]
    slides: dict[str, SlideResult]
    transition: dict[str, Any] | None


def _check_deck_edit(data: dict[str, Any], existing: set[str], theme: DeckTheme) -> DeckEdit:
    from app.services.deck_ai.targeting import valid_target_id

    raw_order = data.get("order")
    if not isinstance(raw_order, list) or not raw_order:
        raise ValueError('"order" must be a non-empty list of slide ids')
    order: list[str] = []
    for item in raw_order:
        sid = valid_target_id(item)
        if sid is None:
            raise ValueError(f"invalid slide id in order: {item!r}")
        if sid not in order:
            order.append(sid)
    slides: dict[str, SlideResult] = {}
    for entry in data.get("slides") or []:
        if not isinstance(entry, dict):
            raise ValueError("each entry of slides must be an object")
        raw = entry.get("slide") if isinstance(entry.get("slide"), dict) else entry
        sid = valid_target_id(raw.get("id"))
        if sid is None:
            raise ValueError("a changed slide has no valid id")
        slides[sid] = slide_from_answer({**entry, "slide": raw}, sid, theme)
    missing = [sid for sid in order if sid not in existing and sid not in slides]
    if missing:
        raise ValueError(f"order lists slides that do not exist: {missing}")
    transition = None
    if isinstance(data.get("transition"), dict):
        transition = dump_document(Transition.model_validate(data["transition"]))
    return DeckEdit(order=order[:500], slides=slides, transition=transition)


async def _deck_edit(ctx: DeckContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    yield steps.push("deck_restyle", "running")
    pid = ctx.project_id
    auth = await ctx.resolve_auth()
    theme = load_theme(pid)
    deck = _read_deck_or_default(pid)
    existing = {ref["id"]: ref for ref in deck.get("slides") or []}
    bodies: list[str] = []
    budget = MAX_DECK_CONTEXT_CHARS
    for ref in deck.get("slides") or []:
        text = json.dumps(store.read_slide(pid, ref["id"]), ensure_ascii=False)
        if len(text) > budget:
            text = json.dumps({"id": ref["id"], "title": _slide_title(store.read_slide(pid, ref["id"]))})
        budget -= len(text)
        bodies.append(f"layout {ref['layout']}: {text}")
    user = "\n\n".join(
        part
        for part in (
            f"deck.json:\n{json.dumps(deck, ensure_ascii=False)}",
            "Slides:\n" + "\n".join(bodies),
            "Layouts: " + ", ".join(LAYOUT_NAMES),
            theme.describe(),
            _conversation(ctx.history),
            f"User request:\n{ctx.prompt[:MAX_PROMPT_CHARS]}",
        )
        if part
    )
    answer = await ask_json(
        auth=auth,
        model=ctx.gen_model,
        system=DECK_EDIT_SYSTEM,
        user=user,
        check=lambda data: _check_deck_edit(data, set(existing), theme),
        locale=ctx.locale,
    )
    edit = answer.value
    store.begin_run(pid, "before deck edit")
    applied: list[dict[str, str]] = []
    generate = wants_generated_images(ctx.prompt)
    refs = []
    for sid in edit.order:
        ref = dict(existing.get(sid) or {"id": sid, "layout": "text", "transition": dict(DEFAULT_TRANSITION)})
        changed = edit.slides.get(sid)
        if changed is not None and changed.layout:
            ref["layout"] = normalize_layout(changed.layout)
        if edit.transition is not None:
            ref["transition"] = dict(edit.transition)
        refs.append(ref)
    deck = store.write_deck(pid, {**deck, "slides": refs})
    applied.append({"op": "write", "path": DECK_PATH})
    yield {"type": "file_write", "path": DECK_PATH}
    yield {"type": "deck.deck", "run_id": str(ctx.run_pk), "deck": deck}
    for sid in existing:
        if sid not in edit.order:
            store.remove_slide_files(pid, sid)
            applied.append({"op": "delete", "path": store.slide_path(sid)})
            yield {"type": "file_delete", "path": store.slide_path(sid)}
            yield {"type": "deck.slide_removed", "run_id": str(ctx.run_pk), "slide_id": sid}
    order = [ref["id"] for ref in deck["slides"]]
    for sid in order:
        result = edit.slides.get(sid)
        if result is None:
            if sid not in existing:
                # Listed in order, never written: an empty slide keeps the player happy.
                store.write_slide(pid, {"id": sid, "elements": []})
            continue
        slide, image_path = await _place_visual(pid, result, generate=generate, auth=auth, locale=ctx.locale)
        slide = store.write_slide(pid, slide)
        notes = store.read_notes(pid, sid)
        if result.notes is not None:
            notes = store.write_notes(pid, sid, result.notes)
        for path in (store.slide_path(sid), image_path):
            if path:
                applied.append({"op": "write", "path": path})
                yield {"type": "file_write", "path": path}
        yield {
            "type": "deck.slide",
            "run_id": str(ctx.run_pk),
            "slide_id": sid,
            "index": order.index(sid),
            "total": len(order),
            "slide": slide,
            "notes": notes,
            "repaired": answer.repairs > 0,
            "fallback": False,
        }
    yield steps.push("deck_restyle", "done")
    yield {"type": "deck.done", "run_id": str(ctx.run_pk), "slides": list(edit.slides), "warnings": []}
    yield steps.push("done", "done")
    summary = "Présentation mise à jour." if ctx.locale == "fr" else "Presentation updated."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}
