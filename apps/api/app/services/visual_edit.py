"""Replace visible text in project source files (visual edit from preview)."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.filesystem import list_files, write_file

_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css")
_SKIP_PARTS = {"node_modules", "dist", ".vite", ".git"}


@dataclass
class VisualEditResult:
    path: str
    occurrences: int


def _candidate_literals(text: str) -> list[str]:
    """Return quote/escape variants of text as they may appear in source."""
    variants: list[str] = [text]
    esc = text.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
    if esc != text:
        variants.append(esc)
    html = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    if html != text:
        variants.append(html)
    # Dedupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _escape_like(lit: str, old: str, new: str) -> str:
    if lit == old:
        return new
    if "\\'" in lit or (lit.count("\\") and "'" in lit):
        return new.replace("\\", "\\\\").replace("'", "\\'")
    if '\\"' in lit:
        return new.replace("\\", "\\\\").replace('"', '\\"')
    if "&amp;" in lit or "&lt;" in lit or "&gt;" in lit:
        return new.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    return new


def apply_visual_text_edit(project_id: str, old_text: str, new_text: str) -> VisualEditResult:
    old_text = (old_text or "").strip()
    if new_text is None:
        new_text = ""
    if len(old_text) < 2:
        raise ValueError("Text too short to edit safely")
    if old_text == new_text.strip():
        raise ValueError("No change")

    files = list_files(project_id)
    matches: list[tuple[str, str, str, int]] = []

    for path, content in files.items():
        parts = path.split("/")
        if any(p in _SKIP_PARTS for p in parts):
            continue
        if not path.endswith(_SOURCE_EXTS):
            continue
        for lit in _candidate_literals(old_text):
            count = content.count(lit)
            if count > 0:
                matches.append((path, content, lit, count))
                break

    if not matches:
        raise FileNotFoundError("text_not_found")

    unique = [m for m in matches if m[3] == 1]
    if len(unique) == 1:
        path, content, lit, _ = unique[0]
    elif len(unique) > 1:
        # Prefer src/ if only one src hit
        src_unique = [m for m in unique if m[0].startswith("src/")]
        if len(src_unique) == 1:
            path, content, lit, _ = src_unique[0]
        else:
            raise LookupError("text_ambiguous")
    else:
        # All multi-occurrence — pick lowest count if unique
        matches.sort(key=lambda m: (m[3], 0 if m[0].startswith("src/") else 1, m[0]))
        best = matches[0]
        peers = [m for m in matches if m[3] == best[3]]
        if len(peers) > 1:
            raise LookupError("text_ambiguous")
        path, content, lit, _ = best

    replacement = _escape_like(lit, old_text, new_text)
    updated = content.replace(lit, replacement, 1)
    if updated == content:
        raise FileNotFoundError("text_not_found")
    write_file(project_id, path, updated)
    return VisualEditResult(path=path, occurrences=1)
