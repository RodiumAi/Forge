"""A deck as the exports and the published player read it.

Every document is validated against its contract before it leaves the
project: a broken slide fails the export with a clear error instead of an
empty page. Asset paths come from validated documents only (contract
pattern: relative, no ``..``) and are resolved inside the project folder.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.contracts.forge_design import dump_document, validate_deck, validate_slide
from app.errors import SitesError
from app.services.document_scaffold import DECK_PATH, DESIGN_MD_PATH
from app.services.filesystem import project_dir

MAX_NOTE_CHARS = 20_000


@dataclass
class DeckSource:
    deck: dict[str, Any]
    #: Every slide listed in the deck, by id (hidden ones included).
    slides: dict[str, dict[str, Any]]
    #: Speaker notes by slide id (only read when asked for).
    notes: dict[str, str] = field(default_factory=dict)
    #: DESIGN.md (or design-system.json) text of the theme.
    design: str = ""

    @property
    def visible_ids(self) -> list[str]:
        return [ref["id"] for ref in self.deck.get("slides", []) if not ref.get("hidden")]

    @property
    def size(self) -> tuple[int, int]:
        fmt = self.deck.get("format") or {}
        return int(fmt.get("width") or 1920), int(fmt.get("height") or 1080)

    def elements(self, slide_ids: list[str] | None = None):
        """Every element of the given slides (all by default), groups flattened."""
        ids = slide_ids if slide_ids is not None else list(self.slides)

        def walk(items):
            for el in items:
                yield el
                if el.get("type") == "group":
                    yield from walk(el.get("children") or [])

        for sid in ids:
            yield from walk((self.slides.get(sid) or {}).get("elements") or [])

    def icons(self) -> list[str]:
        """Lucide icon names used by visible slides (bundle tree-shaking)."""
        seen: list[str] = []
        for el in self.elements(self.visible_ids):
            if el.get("type") == "icon" and el.get("icon") not in seen:
                seen.append(el["icon"])
        return seen

    def asset_paths(self) -> list[str]:
        """Project files the visible slides reference (images, posters, backgrounds)."""
        paths: list[str] = []

        def add(value: object) -> None:
            if isinstance(value, str) and value and value not in paths:
                paths.append(value)

        for sid in self.visible_ids:
            bg = (self.slides.get(sid) or {}).get("background") or {}
            if bg.get("type") == "image":
                add(bg.get("src"))
        for el in self.elements(self.visible_ids):
            if el.get("type") == "image":
                add(el.get("src"))
            elif el.get("type") == "video":
                add(el.get("poster"))
        return paths

    def has_animations(self) -> bool:
        return any(el.get("animation") for el in self.elements(self.visible_ids))


def _read_json(root: Path, relative: str) -> Any:
    path = root / relative
    if not path.is_file():
        raise SitesError(404, "DOCUMENT_MISSING", f"{relative} does not exist.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SitesError(422, "DOCUMENT_CORRUPT", f"{relative} is not valid JSON.") from exc


def _validated(fn, data: Any, relative: str) -> dict[str, Any]:
    try:
        return dump_document(fn(data))
    except ValidationError as exc:
        raise SitesError(
            422,
            "INVALID_DOCUMENT",
            f"{relative} does not match its contract.",
            {
                "file": relative,
                "errors": exc.errors(include_url=False, include_context=False, include_input=False),
            },
        ) from exc


def asset_file(project_id: str, relative: str) -> Path | None:
    """The project file for an asset path, or None when absent or outside ``public/``.

    Exports copy these files into what they publish, so only the project's
    public folder is reachable: never notes, sources or ``.forge`` state.
    """
    root = project_dir(project_id).resolve()
    public = root / "public"
    try:
        path = (root / relative).resolve()
    except OSError:
        return None
    if public not in path.parents or not path.is_file():
        return None
    return path


def load_deck(project_id: str, *, include_notes: bool = False) -> DeckSource:
    root = project_dir(project_id)
    deck = _validated(validate_deck, _read_json(root, DECK_PATH), DECK_PATH)
    slides: dict[str, dict[str, Any]] = {}
    for ref in deck.get("slides", []):
        sid = ref["id"]
        rel = f"slides/{sid}.json"
        if not (root / rel).is_file():
            slides[sid] = {"id": sid, "elements": []}
            continue
        slide = _validated(validate_slide, _read_json(root, rel), rel)
        slide["id"] = sid
        slides[sid] = slide
    notes: dict[str, str] = {}
    if include_notes:
        for sid in slides:
            path = root / "notes" / f"{sid}.md"
            if path.is_file():
                text = path.read_text(encoding="utf-8", errors="replace").strip()
                if text:
                    notes[sid] = text[:MAX_NOTE_CHARS]
    design = ""
    theme_path = str((deck.get("theme") or {}).get("tokens") or DESIGN_MD_PATH)
    for candidate in (theme_path, DESIGN_MD_PATH):
        file = asset_file(project_id, candidate)
        if file is not None:
            design = file.read_text(encoding="utf-8", errors="replace")[:200_000]
            break
    return DeckSource(deck=deck, slides=slides, notes=notes, design=design)
