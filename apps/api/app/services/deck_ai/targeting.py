"""Turn a model answer into a write that stays inside its target.

The chat may target one slide or one element. The target is a guarantee, not
a hint: whatever the model returns, only the targeted slide (or element) is
taken from its answer, everything else comes from the stored document, and
the result is revalidated before it is written.
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from typing import Any

from app.contracts.forge_design import ID_PATTERN, dump_document, validate_slide
from app.services.deck_ai.layouts import VISUAL_PLACEHOLDER
from app.services.deck_ai.theme import DeckTheme, clean_colors

_ID_RE = re.compile(ID_PATTERN)
_SLIDE_ANSWER_KEYS = {"slide", "notes", "layout", "visual"}


@dataclass
class Visual:
    query: str
    element_id: str


@dataclass
class SlideResult:
    slide: dict[str, Any]
    notes: str | None = None
    layout: str | None = None
    visual: Visual | None = None
    #: Parts of the answer that were outside the target and dropped.
    dropped: list[str] = field(default_factory=list)


def find_element(elements: list, element_id: str) -> dict[str, Any] | None:
    for element in elements or []:
        if not isinstance(element, dict):
            continue
        if element.get("id") == element_id:
            return element
        found = find_element(element.get("children") or [], element_id)
        if found is not None:
            return found
    return None


def _replace_element(elements: list, element: dict[str, Any]) -> bool:
    for index, current in enumerate(elements):
        if not isinstance(current, dict):
            continue
        if current.get("id") == element["id"]:
            elements[index] = element
            return True
        children = current.get("children")
        if isinstance(children, list) and _replace_element(children, element):
            return True
    return False


def _visual(answer: dict[str, Any], slide: dict[str, Any]) -> Visual | None:
    raw = answer.get("visual")
    if not isinstance(raw, dict):
        return None
    query = str(raw.get("query") or "").strip()[:100]
    element_id = str(raw.get("elementId") or "").strip()
    if not query:
        return None
    element = find_element(slide.get("elements") or [], element_id) if element_id else None
    if element is None:
        # The model named no element (or a wrong one): take the placeholder image.
        element = next(
            (
                e
                for e in slide.get("elements") or []
                if isinstance(e, dict) and e.get("type") == "image" and e.get("src") == VISUAL_PLACEHOLDER
            ),
            None,
        )
    if element is None or element.get("type") != "image":
        return None
    return Visual(query=query, element_id=str(element["id"]))


def _notes(answer: dict[str, Any]) -> str | None:
    notes = answer.get("notes")
    return notes.strip()[:20000] if isinstance(notes, str) else None


def slide_from_answer(answer: dict[str, Any], slide_id: str, theme: DeckTheme) -> SlideResult:
    """A validated slide whose id is forced to ``slide_id``."""
    raw = answer.get("slide")
    if not isinstance(raw, dict):
        # Some models answer with the slide itself instead of {"slide": ...}.
        if "elements" in answer:
            raw = {k: v for k, v in answer.items() if k not in _SLIDE_ANSWER_KEYS}
        else:
            raise ValueError('the answer has no "slide" object')
    slide = clean_colors(copy.deepcopy(raw), theme)
    dropped = []
    if slide.get("id") != slide_id:
        if "id" in slide:
            dropped.append("slide id")
        slide["id"] = slide_id
    slide = dump_document(validate_slide(slide))
    dropped += sorted(set(answer) - _SLIDE_ANSWER_KEYS)
    layout = answer.get("layout")
    return SlideResult(
        slide=slide,
        notes=_notes(answer),
        layout=layout if isinstance(layout, str) and layout.strip() else None,
        visual=_visual(answer, slide),
        dropped=dropped,
    )


def element_from_answer(
    answer: dict[str, Any], original: dict[str, Any], element_id: str, theme: DeckTheme
) -> SlideResult:
    """The stored slide with only ``element_id`` taken from the answer."""
    element = answer.get("element")
    dropped: list[str] = []
    if not isinstance(element, dict):
        # Repair: a whole slide came back, keep only the targeted element.
        slide = answer.get("slide") if isinstance(answer.get("slide"), dict) else answer
        element = find_element(slide.get("elements") or [], element_id) if isinstance(slide, dict) else None
        if element is None:
            raise ValueError(f'the answer has no "element" object with id {element_id}')
        dropped.append("other elements of the slide")
    element = clean_colors(copy.deepcopy(element), theme)
    if element.get("id") != element_id:
        dropped.append("element id")
        element["id"] = element_id
    slide = copy.deepcopy(original)
    if not _replace_element(slide.get("elements") or [], element):
        raise ValueError(f"element {element_id} is not on this slide")
    dropped += sorted(set(answer) - {"element"} - ({"slide"} if "slide" in answer else set()))
    return SlideResult(slide=dump_document(validate_slide(slide)), dropped=dropped)


def valid_target_id(value: object) -> str | None:
    text = str(value or "").strip()
    return text if _ID_RE.match(text) else None
