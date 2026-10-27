"""The chat flows of a design_system project.

Two flows, picked by ``document_stream``:

* generation (no section target): a complete design system from the request,
  plus a website when the message holds a URL (computed styles read through
  the SSRF guard, one screenshot for vision) and a logo when an image is
  attached or the design system already has an uploaded one (vision);
* a targeted edit (``target.section``): the model returns that section only,
  Forge rebuilds it and leaves every other section, hand edits included,
  untouched.

Both write ``design-system.json`` and the generated DESIGN.md after a history
checkpoint, and stream the events described in
``docs/contracts/design-system-ai-events.md`` (``design_system.findings``,
``design_system.document``, ``design_system.done`` on top of the usual
``user_message``, ``route``, ``step``, ``file_write``, ``warning``,
``error`` and ``done``).
"""

from __future__ import annotations

import base64
import json
import logging
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.contracts.forge_design import dump_document, validate_design_system
from app.db import SessionLocal
from app.models import AgentRun
from app.services.deck_ai.flow import as_sse
from app.services.design_system.generate import (
    DesignSystemAnswerError,
    edit_section,
    generate_spec,
    generation_prompt,
)
from app.services.design_system.logo import wordmark_svg
from app.services.design_system.render import design_md
from app.services.design_system.site_extract import extract_site, screenshot_part
from app.services.design_system.tokens import (
    LOGO_PATH,
    SECTIONS,
    apply_section,
    build_document,
    colors_of,
    contrast_pairs,
    font_families,
)
from app.services.document_scaffold import DEFAULT_TOKENS, DESIGN_MD_PATH, DESIGN_SYSTEM_PATH
from app.services.filesystem import read_file, safe_resolve, write_bytes, write_file
from app.services.llm import RodiumError, error_code_for

logger = logging.getLogger(__name__)

Event = dict[str, Any]

TASK_GENERATE = "design_system.generate"
TASK_SECTION = "design_system.edit.section"
_RASTER = (".png", ".jpg", ".jpeg", ".webp")
_DATA_URL_RE = re.compile(r"^data:(image/(png|jpeg|webp));base64,(.+)$", re.S)

_LABELS: dict[str, tuple[str, str]] = {
    "ds_capture": ("Lecture du site", "Reading the website"),
    "ds_logo": ("Analyse du logo", "Analysing the logo"),
    "ds_generate": ("Création du design system", "Creating the design system"),
    "ds_edit": ("Modification de la section", "Editing the section"),
    "done": ("Terminé", "Done"),
}
_SECTION_LABELS = {
    "colors": ("couleurs", "colours"),
    "typography": ("typographie", "typography"),
    "spacing": ("espacements", "spacing"),
    "logo": ("logo", "logo"),
    "iconography": ("iconographie", "iconography"),
    "imagery": ("images", "imagery"),
    "voice": ("ton de voix", "tone of voice"),
    "guidelines": ("à faire et à éviter", "do and don't"),
    "components": ("composants", "components"),
}
_INVALID = {
    "fr": "L'IA n'a pas produit un design system valide. Réessayez.",
    "en": "The AI did not produce a valid design system. Please try again.",
}
_BAD_SECTION = {
    "fr": "Cette section du design system n'existe pas.",
    "en": "This design system section does not exist.",
}


def label(step_id: str, locale: str) -> str:
    fr, en = _LABELS.get(step_id, (step_id, step_id))
    return fr if locale == "fr" else en


def _msg(table: dict[str, str], locale: str) -> str:
    return table["fr" if locale == "fr" else "en"]


@dataclass
class DesignSystemContext:
    project_id: str
    project_name: str
    run_pk: UUID
    user_msg_id: str
    prompt: str
    locale: str
    #: Stronger model for a whole design system, default model for one section.
    gen_model: str
    edit_model: str
    route_effort: str
    tier: str
    resolve_auth: Callable[[], Awaitable[Any]]
    history: list[tuple[str, str]] = field(default_factory=list)
    section: str | None = None


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


def task_class(section: str | None) -> str:
    return TASK_SECTION if section else TASK_GENERATE


# ── run bookkeeping ────────────────────────────────────────────────────────


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
    if isinstance(exc, DesignSystemAnswerError):
        return {"type": "error", "code": "invalid_model_output", "message": _msg(_INVALID, locale)}
    return {"type": "error", "code": error_code_for(exc), "message": str(exc)[:500]}


async def _guarded(run_pk: UUID, locale: str, source: AsyncIterator[Event]) -> AsyncIterator[Event]:
    try:
        async for event in source:
            yield event
    except Exception as exc:
        if not isinstance(exc, (RodiumError, DesignSystemAnswerError)):
            logger.exception("design system run failed run_id=%s", run_pk)
        event = error_event(exc, locale)
        _fail_run(run_pk, event["code"], str(exc))
        yield event


# ── files ──────────────────────────────────────────────────────────────────


def read_current(project_id: str) -> dict[str, Any] | None:
    try:
        data = json.loads(read_file(project_id, DESIGN_SYSTEM_PATH))
        return dump_document(validate_design_system(data))
    except Exception:
        return None


def is_untouched(document: dict[str, Any] | None) -> bool:
    """True for the scaffold's default design system (nothing to preserve)."""
    if document is None:
        return True
    defaults = {
        name: token["$value"] for name, token in DEFAULT_TOKENS["color"].items() if not name.startswith("$")
    }
    colors = colors_of(document)
    same = all(colors.get(name) == value for name, value in defaults.items())
    return same and not document.get("description") and not document.get("voice")


def write_document(project_id: str, document: dict[str, Any]) -> list[str]:
    write_file(project_id, DESIGN_SYSTEM_PATH, json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    write_file(project_id, DESIGN_MD_PATH, design_md(document))
    return [DESIGN_SYSTEM_PATH, DESIGN_MD_PATH]


def _checkpoint(project_id: str, label_text: str) -> None:
    try:
        from app.services import history

        history.snapshot(project_id, label_text)
    except Exception:  # pragma: no cover - history is best effort
        pass


def _uploaded_logo(project_id: str, document: dict[str, Any] | None) -> str | None:
    """The raster logo of the design system when one was uploaded (not the wordmark)."""
    src = ((document or {}).get("logo") or {}).get("src")
    if not isinstance(src, str) or not src.lower().endswith(_RASTER):
        return None
    try:
        return src if safe_resolve(project_id, src).is_file() else None
    except ValueError:
        return None


async def _logo_image(
    project_id: str, prompt: str, document: dict[str, Any] | None
) -> tuple[dict | None, str | None]:
    """(vision part, logo path in the project) from an attached image or the uploaded logo."""
    from app.services.attachments import ResolvedImage, extract_image_urls, resolve_image_part
    from app.services.url_capture import strip_auto_url_capture_markers

    images = extract_image_urls(strip_auto_url_capture_markers(prompt))
    with SessionLocal() as db:
        for image in images:
            part = await resolve_image_part(db, project_id, image)
            if not part or part.get("type") != "image_url":
                continue
            match = _DATA_URL_RE.match(str((part.get("image_url") or {}).get("url") or ""))
            if not match:
                return part, None
            ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[match.group(1)]
            relative = f"public/brand/logo.{ext}"
            write_bytes(project_id, relative, base64.b64decode(match.group(3)))
            return part, relative
        existing = _uploaded_logo(project_id, document)
        if existing:
            part = await resolve_image_part(
                db, project_id, ResolvedImage(url="/" + existing.removeprefix("public/"), name="brand-logo")
            )
            if part and part.get("type") == "image_url":
                return part, existing
    return None, None


def _conversation(history: list[tuple[str, str]], limit: int = 6) -> str:
    recent = [(role, text) for role, text in history if role in ("user", "assistant")][-limit:]
    if not recent:
        return ""
    return "Recent conversation:\n" + "\n".join(f"{role}: {text.strip()[:600]}" for role, text in recent)


def _document_event(
    ctx: DesignSystemContext, document: dict[str, Any], fixes: list, section: str | None
) -> Event:
    event: Event = {
        "type": "design_system.document",
        "run_id": str(ctx.run_pk),
        "document": document,
        "contrast": contrast_pairs(colors_of(document)),
        "fixes": fixes,
    }
    if section:
        event["section"] = section
    return event


# ── entry point ────────────────────────────────────────────────────────────


async def document_stream(ctx: DesignSystemContext) -> AsyncIterator[str]:
    yield as_sse({"type": "user_message", "id": ctx.user_msg_id, "run_id": str(ctx.run_pk)})
    yield as_sse(
        {
            "type": "route",
            "task_class": task_class(ctx.section),
            "effort_label": ctx.route_effort,
            "tier": ctx.tier,
        }
    )
    source = _section_edit(ctx) if ctx.section else _generate(ctx)
    async for event in _guarded(ctx.run_pk, ctx.locale, source):
        yield as_sse(event)


async def _generate(ctx: DesignSystemContext) -> AsyncIterator[Event]:
    from app.services.url_capture import extract_site_urls, strip_auto_url_capture_markers

    steps = _Steps(ctx.locale)
    pid = ctx.project_id
    current = read_current(pid)
    warnings: list[str] = []
    images: list[dict[str, Any]] = []
    findings_text: str | None = None
    prompt = strip_auto_url_capture_markers(ctx.prompt)

    urls = extract_site_urls(prompt)
    if urls:
        yield steps.push("ds_capture", "running")
        try:
            findings = await extract_site(urls[0], ctx.locale)
        except RodiumError as exc:
            yield steps.push("ds_capture", "error")
            warnings.append(f"SITE_CAPTURE_FAILED: {urls[0]}")
            yield {"type": "warning", "message": str(exc)[:300], "violation": {"code": "SITE_CAPTURE_FAILED"}}
        else:
            findings_text = findings.describe()
            shot = screenshot_part(findings)
            if shot:
                images.append(shot)
            yield {
                "type": "design_system.findings",
                "run_id": str(ctx.run_pk),
                "source": "url",
                "url": findings.url,
                "background": findings.background,
                "text": findings.text,
                "accent": findings.accent,
                "palette": findings.palette,
                "fonts": {"heading": findings.heading_font, "body": findings.body_font},
                "radius": findings.radius_px,
                "spacing": findings.spacing_px,
            }
            yield steps.push("ds_capture", "done")

    logo_part, logo_path = await _logo_image(pid, prompt, current)
    if logo_part is not None:
        yield steps.push("ds_logo", "running")
        images.append(logo_part)
        if logo_path and logo_path != ((current or {}).get("logo") or {}).get("src"):
            yield {"type": "file_write", "path": logo_path}
        yield steps.push("ds_logo", "done")

    yield steps.push("ds_generate", "running")
    auth = await ctx.resolve_auth()
    fresh_source = bool(urls or logo_part)
    user = generation_prompt(
        brief=prompt,
        project_name=ctx.project_name,
        current=None if (fresh_source or is_untouched(current)) else current,
        findings=findings_text,
        has_logo_image=logo_part is not None,
        conversation=_conversation(ctx.history),
    )
    answer = await generate_spec(auth=auth, model=ctx.gen_model, user=user, images=images, locale=ctx.locale)
    spec = answer.spec
    old_logo = (current or {}).get("logo") or {}
    src = logo_path or old_logo.get("src") or LOGO_PATH
    # A new logo image makes the old dark and icon versions stale.
    document, fixes = build_document(
        spec,
        logo_src=src,
        logo_dark_src=old_logo.get("darkSrc") if not logo_path else None,
        logo_icon_src=old_logo.get("iconSrc") if not logo_path else None,
    )

    _checkpoint(pid, "before design system generation")
    applied: list[dict[str, str]] = []
    if src == LOGO_PATH:
        # The wordmark follows the brand name and palette until a real logo is uploaded.
        families = font_families(document)
        colors = colors_of(document)
        write_file(
            pid,
            LOGO_PATH,
            wordmark_svg(
                document["name"], colors["accent"], colors["fg"], families[0] if families else "Inter"
            ),
        )
        applied.append({"op": "write", "path": LOGO_PATH})
        yield {"type": "file_write", "path": LOGO_PATH}
    for path in write_document(pid, document):
        applied.append({"op": "write", "path": path})
        yield {"type": "file_write", "path": path}
    if fixes:
        warnings.append("CONTRAST_REPAIRED: " + ", ".join(f"{f['token']} on {f['on']}" for f in fixes))
    yield _document_event(ctx, document, fixes, None)
    yield steps.push("ds_generate", "done")
    yield {
        "type": "design_system.done",
        "run_id": str(ctx.run_pk),
        "warnings": warnings,
        "repaired": answer.repairs > 0,
    }
    yield steps.push("done", "done")
    if ctx.locale == "fr":
        summary = (
            f"Design system « {document['name']} » créé : couleurs, typographie, espacements, logo et règles."
        )
    else:
        summary = f'Design system "{document["name"]}" created: colours, typography, spacing, logo and rules.'
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}


async def _section_edit(ctx: DesignSystemContext) -> AsyncIterator[Event]:
    steps = _Steps(ctx.locale)
    section = ctx.section or ""
    yield steps.push("ds_edit", "running")
    if section not in SECTIONS:
        yield steps.push("ds_edit", "error")
        _fail_run(ctx.run_pk, "target_not_found", f"unknown section {section!r}")
        yield {"type": "error", "code": "target_not_found", "message": _msg(_BAD_SECTION, ctx.locale)}
        return
    current = read_current(ctx.project_id)
    if current is None:
        from app.services.document_scaffold import default_design_system

        current = default_design_system(ctx.project_name, with_logo=True)
    auth = await ctx.resolve_auth()
    answer = await edit_section(
        auth=auth,
        model=ctx.edit_model,
        section=section,
        document=current,
        request=ctx.prompt,
        locale=ctx.locale,
    )
    document, fixes = apply_section(current, section, answer.spec)
    _checkpoint(ctx.project_id, "before design system edit")
    applied = []
    for path in write_document(ctx.project_id, document):
        applied.append({"op": "write", "path": path})
        yield {"type": "file_write", "path": path}
    yield _document_event(ctx, document, fixes, section)
    yield steps.push("ds_edit", "done")
    warnings = (
        ["CONTRAST_REPAIRED: " + ", ".join(f"{f['token']} on {f['on']}" for f in fixes)] if fixes else []
    )
    yield {
        "type": "design_system.done",
        "run_id": str(ctx.run_pk),
        "warnings": warnings,
        "repaired": answer.repairs > 0,
        "section": section,
    }
    yield steps.push("done", "done")
    fr, en = _SECTION_LABELS[section]
    summary = f"Section {fr} mise à jour." if ctx.locale == "fr" else f"{en.capitalize()} section updated."
    payload = {"summary": summary, "steps": steps.items, "applied": applied}
    _finish_run(ctx.run_pk, payload, ctx.locale)
    yield {"type": "done", **payload, "effort_label": ctx.route_effort}
