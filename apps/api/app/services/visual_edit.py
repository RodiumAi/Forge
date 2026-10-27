"""Replace visible text in project source files (visual edit from preview)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.edit_target import element_span, parse_forge_id
from app.services.filesystem import read_file, write_file
from app.services.source_edit import SourceMatch, SourceVariant, collect_matches, select_unique

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


def _ws_flexible_pattern(text: str) -> re.Pattern[str]:
    """Match `text` allowing any JSX/source whitespace between words."""
    parts = [p for p in re.split(r"\s+", text.strip()) if p]
    if len(parts) < 1:
        raise ValueError("Text too short to edit safely")
    return re.compile(r"\s+".join(re.escape(p) for p in parts))


def _collect_ws_matches(project_id: str, text: str) -> list[SourceMatch]:
    """Exact substring failed — retry with whitespace-flexible search.

    Preview `innerText` collapses newlines/indentation that still exist in the
    JSX source (`care\\n          coordination`). Without this path almost every
    multi-line paragraph edit returns visual_edit_not_found.
    """
    from app.services.filesystem import list_files

    pattern = _ws_flexible_pattern(text)
    html_pattern = None
    html = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    if html != text:
        html_pattern = _ws_flexible_pattern(html)

    matches: list[SourceMatch] = []
    for path, content in list_files(project_id).items():
        if any(part in {"node_modules", "dist", ".vite", ".git"} for part in path.split("/")):
            continue
        if not path.endswith(_SOURCE_EXTS):
            continue
        for kind, pat in (("raw", pattern), ("html", html_pattern)):
            if pat is None:
                continue
            found = list(pat.finditer(content))
            if not found:
                continue
            # Store the first matched source span as the literal to replace.
            literal = found[0].group(0)
            matches.append(
                SourceMatch(
                    path,
                    content,
                    SourceVariant(literal, kind),
                    count=len(found),
                )
            )
            break
    return matches


def _edit_inside_element(
    project_id: str, forge_id: str | None, old_text: str, new_text: str
) -> VisualEditResult | None:
    """Replace `old_text` inside the element the preview pointed at.

    Exact where the literal search is ambiguous (the same label in a header and
    a footer). None when the id is stale, the element does not hold the text
    literally (it comes from a prop or a data array), or holds it more than
    once: the caller then falls back to the project-wide search.
    """
    loc = parse_forge_id(forge_id)
    if loc is None or not loc.path.endswith(_SOURCE_EXTS):
        return None
    try:
        content = read_file(project_id, loc.path)
    except (OSError, ValueError):
        return None
    span = element_span(content, loc)
    if span is None:
        return None
    start, end = span
    region = content[start:end]

    hit: tuple[int, SourceVariant] | None = None
    for variant in _candidate_variants(old_text):
        count = region.count(variant.literal)
        if count > 1:
            return None
        if count == 1:
            hit = (start + region.index(variant.literal), variant)
            break
    if hit is None:
        html = old_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
        for kind, needle in (("raw", old_text), ("html", html)):
            found = list(_ws_flexible_pattern(needle).finditer(region))
            if len(found) > 1:
                return None
            if found:
                hit = (start + found[0].start(), SourceVariant(found[0].group(0), kind))
                break
    if hit is None:
        return None
    index, variant = hit
    updated = content[:index] + _encode_like(variant, new_text) + content[index + len(variant.literal) :]
    if updated == content:
        return None
    write_file(project_id, loc.path, updated)
    return VisualEditResult(path=loc.path, occurrences=1)


def apply_visual_text_edit(
    project_id: str,
    old_text: str,
    new_text: str,
    forge_id: str | None = None,
) -> VisualEditResult:
    """Replace edited preview text in the source.

    ``forge_id`` (the element's ``data-forge-id``) pins the edit to that JSX
    element; without it, or when the text is not literally inside it, the
    literal is searched across the project and must be unique.
    """
    old_text = (old_text or "").strip()
    new_text = new_text or ""
    if len(old_text) < 2:
        raise ValueError("Text too short to edit safely")
    if old_text == new_text.strip():
        raise ValueError("No change")

    pinned = _edit_inside_element(project_id, forge_id, old_text, new_text)
    if pinned is not None:
        return pinned

    matches = collect_matches(project_id, _candidate_variants(old_text), _SOURCE_EXTS)
    if not matches:
        matches = _collect_ws_matches(project_id, old_text)
    if not matches:
        raise FileNotFoundError("text_not_found")

    match = select_unique(matches, "This text")

    replacement = _encode_like(match.variant, new_text)
    updated = match.content.replace(match.variant.literal, replacement, 1)
    if updated == match.content:
        raise FileNotFoundError("text_not_found")

    write_file(project_id, match.path, updated)
    return VisualEditResult(path=match.path, occurrences=1)
