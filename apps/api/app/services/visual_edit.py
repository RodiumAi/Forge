"""Replace visible text in project source files (visual edit from preview)."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.filesystem import write_file
from app.services.source_edit import SourceVariant, collect_matches, select_unique

_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css")


@dataclass
class VisualEditResult:
    path: str
    occurrences: int


def _candidate_variants(text: str) -> list[SourceVariant]:
    """Quote/escape variants of `text` as they may appear in source.

    The encoding kind travels with the literal so the replacement is re-encoded
    identically. The previous version re-detected the encoding by sniffing the
    matched literal, which misfired whenever a backslash and a quote coexisted.
    """
    variants: list[SourceVariant] = [SourceVariant(text, "raw")]

    backslash = text.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
    if backslash != text:
        variants.append(SourceVariant(backslash, "backslash"))

    html = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    if html != text:
        variants.append(SourceVariant(html, "html"))

    seen: set[str] = set()
    out: list[SourceVariant] = []
    for v in variants:
        if v.literal and v.literal not in seen:
            seen.add(v.literal)
            out.append(v)
    return out


def _encode_like(variant: SourceVariant, new: str) -> str:
    if variant.kind == "backslash":
        return new.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
    if variant.kind == "html":
        return new.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    return new


def apply_visual_text_edit(project_id: str, old_text: str, new_text: str) -> VisualEditResult:
    old_text = (old_text or "").strip()
    new_text = new_text or ""
    if len(old_text) < 2:
        raise ValueError("Text too short to edit safely")
    if old_text == new_text.strip():
        raise ValueError("No change")

    matches = collect_matches(project_id, _candidate_variants(old_text), _SOURCE_EXTS)
    if not matches:
        raise FileNotFoundError("text_not_found")

    match = select_unique(matches, "This text")

    replacement = _encode_like(match.variant, new_text)
    updated = match.content.replace(match.variant.literal, replacement, 1)
    if updated == match.content:
        raise FileNotFoundError("text_not_found")

    write_file(project_id, match.path, updated)
    return VisualEditResult(path=match.path, occurrences=1)
