"""Read and write the documents of the Forge Design kinds.

Slides, codelabs and design systems are data rendered by a Forge player, not
generated code (contracts in ``app/contracts``). Every write is validated
against its contract, then written atomically; the previous state is kept as
a history checkpoint (throttled, so an editor autosaving on every drag does
not commit each move).

Responses carry the file's content hash as ``ETag``. A write that sends
``If-Match`` with an older hash is refused with 409 instead of overwriting a
change made meanwhile by another tab, a collaborator or the agent.
"""

from __future__ import annotations

import json
import re
import threading
import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.contracts.forge_design import (
    ID_PATTERN,
    validate_codelab,
    validate_deck,
    validate_design_system,
    validate_slide,
)
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale
from app.kinds import kind_enabled, resolve_kind
from app.models import Project, User
from app.services import history
from app.services.document_scaffold import (
    CODELAB_PATH,
    DECK_PATH,
    DESIGN_MD_PATH,
    DESIGN_SYSTEM_PATH,
    design_md_from_design_system,
)
from app.services.filesystem import content_version, read_file, write_file
from app.services.project_access import accessible_project

router = APIRouter(prefix="/projects", tags=["documents"])

_ID_RE = re.compile(ID_PATTERN)
#: At most one checkpoint per project in this window.
CHECKPOINT_INTERVAL_SECONDS = 60.0
MAX_STEP_MARKDOWN_CHARS = 200_000

_last_checkpoint: dict[str, float] = {}
_checkpoint_lock = threading.Lock()


class StepMarkdown(BaseModel):
    markdown: str = Field(max_length=MAX_STEP_MARKDOWN_CHARS)


class ElementPatch(BaseModel):
    #: Fields of one element, ``id`` included. Given fields replace the stored
    #: ones (nested objects are replaced whole); the rest stay as they are.
    element: dict[str, Any]


def _document_project(
    db: Session,
    user: User,
    project_id: UUID,
    request: Request,
    kind_id: str,
    *,
    require_edit: bool = False,
) -> Project:
    locale = resolve_locale(request)
    project = accessible_project(db, user, project_id, locale, require_edit=require_edit)
    if resolve_kind(project.platform) != kind_id:
        raise SitesError(409, "WRONG_KIND", f"This project is not a {kind_id} project.")
    if not kind_enabled(kind_id):
        raise SitesError(404, "KIND_DISABLED", "This project type is not available yet.")
    return project


def _check_id(value: str, label: str) -> str:
    if not _ID_RE.match(value or ""):
        raise SitesError(400, "INVALID_ID", f"Invalid {label}.")
    return value


def _read_json(project_id: str, relative: str) -> dict[str, Any]:
    try:
        data = json.loads(read_file(project_id, relative))
    except FileNotFoundError as exc:
        raise SitesError(404, "DOCUMENT_MISSING", f"{relative} does not exist.") from exc
    except ValueError as exc:
        raise SitesError(500, "DOCUMENT_CORRUPT", f"{relative} is not valid JSON.") from exc
    if not isinstance(data, dict):
        raise SitesError(500, "DOCUMENT_CORRUPT", f"{relative} is not a JSON object.")
    return data


def _validated(validate, document: Any):
    try:
        return validate(document)
    except ValidationError as exc:
        errors = jsonable_encoder(exc.errors(include_url=False, include_context=False, include_input=False))
        raise SitesError(
            422, "INVALID_DOCUMENT", "The document does not match its contract.", {"errors": errors}
        ) from exc


def _check_version(project_id: str, relative: str, if_match: str | None) -> None:
    if not if_match:
        return
    expected = if_match.strip().strip('"')
    if expected and expected != content_version(project_id, relative):
        raise SitesError(409, "DOCUMENT_CHANGED", f"{relative} changed since it was loaded.")


def _checkpoint(project_id: str, label: str) -> None:
    """Keep the state before this write, at most once per interval."""
    now = time.monotonic()
    with _checkpoint_lock:
        last = _last_checkpoint.get(project_id)
        if last is not None and now - last < CHECKPOINT_INTERVAL_SECONDS:
            return
        _last_checkpoint[project_id] = now
    history.snapshot(project_id, label)


def _write_json(project_id: str, relative: str, document: dict[str, Any]) -> None:
    write_file(project_id, relative, json.dumps(document, ensure_ascii=False, indent=2) + "\n")


def _respond(project_id: str, relative: str, document: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        content=document,
        headers={"ETag": f'"{content_version(project_id, relative)}"', "Cache-Control": "no-store"},
    )


def _slide_ids(deck: dict[str, Any]) -> list[str]:
    return [str(ref.get("id")) for ref in deck.get("slides") or [] if isinstance(ref, dict)]


# ── Deck ───────────────────────────────────────────────────────────────────


@router.get("/{project_id}/deck")
def get_deck(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "slides")
    pid = str(project_id)
    return _respond(pid, DECK_PATH, _read_json(pid, DECK_PATH))


@router.put("/{project_id}/deck")
def put_deck(
    project_id: UUID,
    request: Request,
    document: dict[str, Any] = Body(...),
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "slides", require_edit=True)
    pid = str(project_id)
    _validated(validate_deck, document)
    _check_version(pid, DECK_PATH, if_match)
    _checkpoint(pid, "before deck edit")
    _write_json(pid, DECK_PATH, document)
    # A slide listed in the deck always has a body, so the player never 404s.
    for sid in _slide_ids(document):
        relative = f"slides/{sid}.json"
        if not content_version(pid, relative):
            _write_json(pid, relative, {"id": sid, "elements": []})
    return _respond(pid, DECK_PATH, document)


# ── Slides ─────────────────────────────────────────────────────────────────


def _slide_path(pid: str, sid: str) -> str:
    _check_id(sid, "slide id")
    if sid not in _slide_ids(_read_json(pid, DECK_PATH)):
        raise SitesError(404, "SLIDE_NOT_FOUND", "This slide is not in the deck.")
    return f"slides/{sid}.json"


@router.get("/{project_id}/slides/{slide_id}")
def get_slide(
    project_id: UUID,
    slide_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "slides")
    pid = str(project_id)
    relative = _slide_path(pid, slide_id)
    return _respond(pid, relative, _read_json(pid, relative))


@router.put("/{project_id}/slides/{slide_id}")
def put_slide(
    project_id: UUID,
    slide_id: str,
    request: Request,
    document: dict[str, Any] = Body(...),
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "slides", require_edit=True)
    pid = str(project_id)
    relative = _slide_path(pid, slide_id)
    _validated(validate_slide, document)
    if document.get("id") != slide_id:
        raise SitesError(400, "ID_MISMATCH", "The slide id does not match the URL.")
    _check_version(pid, relative, if_match)
    _checkpoint(pid, "before slide edit")
    _write_json(pid, relative, document)
    return _respond(pid, relative, document)


def _merge_element(elements: list, patch: dict[str, Any]) -> bool:
    for index, element in enumerate(elements):
        if not isinstance(element, dict):
            continue
        if element.get("id") == patch.get("id"):
            elements[index] = {**element, **patch}
            return True
        children = element.get("children")
        if isinstance(children, list) and _merge_element(children, patch):
            return True
    return False


@router.patch("/{project_id}/slides/{slide_id}")
def patch_slide_element(
    project_id: UUID,
    slide_id: str,
    request: Request,
    body: ElementPatch,
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update one element (also inside a group); the whole slide is revalidated."""
    _document_project(db, user, project_id, request, "slides", require_edit=True)
    pid = str(project_id)
    relative = _slide_path(pid, slide_id)
    element_id = _check_id(str(body.element.get("id") or ""), "element id")
    _check_version(pid, relative, if_match)
    slide = _read_json(pid, relative)
    elements = slide.get("elements")
    if not isinstance(elements, list) or not _merge_element(elements, body.element):
        raise SitesError(404, "ELEMENT_NOT_FOUND", f"No element {element_id} on this slide.")
    _validated(validate_slide, slide)
    _checkpoint(pid, "before slide edit")
    _write_json(pid, relative, slide)
    return _respond(pid, relative, slide)


# ── Speaker notes ──────────────────────────────────────────────────────────

MAX_NOTES_CHARS = 20_000


class NotesMarkdown(BaseModel):
    markdown: str = Field(max_length=MAX_NOTES_CHARS)


def _notes_response(pid: str, slide_id: str, relative: str, markdown: str) -> JSONResponse:
    return JSONResponse(
        content={"id": slide_id, "file": relative, "markdown": markdown},
        headers={"ETag": f'"{content_version(pid, relative)}"', "Cache-Control": "no-store"},
    )


@router.get("/{project_id}/notes/{slide_id}")
def get_notes(
    project_id: UUID,
    slide_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Speaker notes of a slide (``notes/<id>.md``); empty when none were written."""
    _document_project(db, user, project_id, request, "slides")
    pid = str(project_id)
    _slide_path(pid, slide_id)
    relative = f"notes/{slide_id}.md"
    try:
        markdown = read_file(pid, relative)
    except FileNotFoundError:
        markdown = ""
    return _notes_response(pid, slide_id, relative, markdown)


@router.put("/{project_id}/notes/{slide_id}")
def put_notes(
    project_id: UUID,
    slide_id: str,
    request: Request,
    body: NotesMarkdown,
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "slides", require_edit=True)
    pid = str(project_id)
    _slide_path(pid, slide_id)
    relative = f"notes/{slide_id}.md"
    _check_version(pid, relative, if_match)
    _checkpoint(pid, "before notes edit")
    write_file(pid, relative, body.markdown)
    return _notes_response(pid, slide_id, relative, body.markdown)


# ── Codelab ────────────────────────────────────────────────────────────────


@router.get("/{project_id}/codelab")
def get_codelab(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "codelab")
    pid = str(project_id)
    return _respond(pid, CODELAB_PATH, _read_json(pid, CODELAB_PATH))


@router.put("/{project_id}/codelab")
def put_codelab(
    project_id: UUID,
    request: Request,
    document: dict[str, Any] = Body(...),
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    pid = str(project_id)
    _validated(validate_codelab, document)
    _check_version(pid, CODELAB_PATH, if_match)
    _checkpoint(pid, "before codelab edit")
    _write_json(pid, CODELAB_PATH, document)
    # A step listed in codelab.json always has its Markdown file.
    for step in document.get("steps") or []:
        if not content_version(pid, step["file"]):
            write_file(pid, step["file"], f"# {step.get('title') or step['id']}\n")
    return _respond(pid, CODELAB_PATH, document)


def _step_file(pid: str, step_id: str) -> str:
    _check_id(step_id, "step id")
    # Validated, not just parsed: the step path comes from codelab.json, which
    # the agent or a hand edit may have changed, and must stay under steps/.
    codelab = _validated(validate_codelab, _read_json(pid, CODELAB_PATH))
    for step in codelab.steps:
        if step.id == step_id:
            return step.file
    raise SitesError(404, "STEP_NOT_FOUND", "This step is not in the codelab.")


def _step_response(pid: str, step_id: str, relative: str, markdown: str) -> JSONResponse:
    return JSONResponse(
        content={"id": step_id, "file": relative, "markdown": markdown},
        headers={"ETag": f'"{content_version(pid, relative)}"', "Cache-Control": "no-store"},
    )


@router.get("/{project_id}/steps/{step_id}")
def get_step(
    project_id: UUID,
    step_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "codelab")
    pid = str(project_id)
    relative = _step_file(pid, step_id)
    try:
        markdown = read_file(pid, relative)
    except FileNotFoundError:
        markdown = ""
    return _step_response(pid, step_id, relative, markdown)


@router.put("/{project_id}/steps/{step_id}")
def put_step(
    project_id: UUID,
    step_id: str,
    request: Request,
    body: StepMarkdown,
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    pid = str(project_id)
    relative = _step_file(pid, step_id)
    _check_version(pid, relative, if_match)
    _checkpoint(pid, "before step edit")
    write_file(pid, relative, body.markdown)
    return _step_response(pid, step_id, relative, body.markdown)


# ── Design system ──────────────────────────────────────────────────────────


@router.get("/{project_id}/design-system")
def get_design_system(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "design_system")
    pid = str(project_id)
    return _respond(pid, DESIGN_SYSTEM_PATH, _read_json(pid, DESIGN_SYSTEM_PATH))


@router.put("/{project_id}/design-system")
def put_design_system(
    project_id: UUID,
    request: Request,
    document: dict[str, Any] = Body(...),
    if_match: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _document_project(db, user, project_id, request, "design_system", require_edit=True)
    pid = str(project_id)
    _validated(validate_design_system, document)
    _check_version(pid, DESIGN_SYSTEM_PATH, if_match)
    _checkpoint(pid, "before design system edit")
    _write_json(pid, DESIGN_SYSTEM_PATH, document)
    # DESIGN.md is generated from the tokens; the agent reads it like a charter.
    write_file(pid, DESIGN_MD_PATH, design_md_from_design_system(document))
    return _respond(pid, DESIGN_SYSTEM_PATH, document)
