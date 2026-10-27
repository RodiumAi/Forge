"""Read and write the deck files the way the document routes do.

Every write is validated against its contract and goes through the atomic
``write_file``. An AI run takes one history checkpoint before its first write
(``begin_run``), so the whole generation or edit can be undone in one step,
like an agent edit on a site.
"""

from __future__ import annotations

import contextlib
import json
import re
from typing import Any

from app.contracts.forge_design import ID_PATTERN, dump_document, validate_deck, validate_slide
from app.services import history
from app.services.document_scaffold import DECK_PATH
from app.services.filesystem import delete_file, read_file, write_file

_ID_RE = re.compile(ID_PATTERN)
MAX_NOTES_CHARS = 20_000


def slide_path(slide_id: str) -> str:
    if not _ID_RE.match(slide_id or ""):
        raise ValueError(f"invalid slide id {slide_id!r}")
    return f"slides/{slide_id}.json"


def notes_path(slide_id: str) -> str:
    if not _ID_RE.match(slide_id or ""):
        raise ValueError(f"invalid slide id {slide_id!r}")
    return f"notes/{slide_id}.md"


def _write_json(project_id: str, relative: str, document: dict[str, Any]) -> None:
    write_file(project_id, relative, json.dumps(document, ensure_ascii=False, indent=2) + "\n")


def begin_run(project_id: str, label: str) -> None:
    """Checkpoint the deck before an AI run writes anything (best effort)."""
    with contextlib.suppress(Exception):  # history is optional
        history.snapshot(project_id, label)


def read_deck(project_id: str) -> dict[str, Any]:
    data = json.loads(read_file(project_id, DECK_PATH))
    return dump_document(validate_deck(data))


def write_deck(project_id: str, deck: dict[str, Any]) -> dict[str, Any]:
    document = dump_document(validate_deck(deck))
    _write_json(project_id, DECK_PATH, document)
    return document


def read_slide(project_id: str, slide_id: str) -> dict[str, Any]:
    try:
        data = json.loads(read_file(project_id, slide_path(slide_id)))
    except FileNotFoundError:
        return {"id": slide_id, "elements": []}
    return dump_document(validate_slide(data))


def write_slide(project_id: str, slide: dict[str, Any]) -> dict[str, Any]:
    document = dump_document(validate_slide(slide))
    _write_json(project_id, slide_path(document["id"]), document)
    return document


def read_notes(project_id: str, slide_id: str) -> str:
    try:
        return read_file(project_id, notes_path(slide_id))
    except FileNotFoundError:
        return ""


def write_notes(project_id: str, slide_id: str, markdown: str) -> str:
    text = (markdown or "")[:MAX_NOTES_CHARS]
    write_file(project_id, notes_path(slide_id), text)
    return text


def remove_slide_files(project_id: str, slide_id: str) -> None:
    for relative in (slide_path(slide_id), notes_path(slide_id)):
        with contextlib.suppress(FileNotFoundError, OSError):
            delete_file(project_id, relative)


def is_blank_deck(project_id: str) -> bool:
    """True for a deck nobody has written yet (the scaffold's single title slide)."""
    try:
        deck = read_deck(project_id)
    except (FileNotFoundError, ValueError):
        return True
    refs = deck.get("slides") or []
    if len(refs) > 1:
        return False
    if not refs:
        return True
    slide = read_slide(project_id, refs[0]["id"])
    texts = []
    for element in slide.get("elements") or []:
        for block in element.get("content") or []:
            texts.append(str(block.get("text") or ""))
    # The scaffold writes the project name as title and an empty subtitle.
    return sum(1 for text in texts if text.strip()) <= 1 and len(slide.get("elements") or []) <= 2
