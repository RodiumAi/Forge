"""Selector-preserving merge for stylesheet rewrites.

Plan tasks rewrite `src/index.css` as a full file, but the LLM only sees a
truncated version of a large stylesheet — so later tasks routinely re-emit the
file without the middle rules, breaking earlier pages. Instead of rejecting
such writes (which loses the new styles), we merge: keep the new content and
re-append every top-level block whose selector disappeared.
"""

from __future__ import annotations

import re

_WS_RE = re.compile(r"\s+")
_COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)


def _normalize_key(prelude: str) -> str:
    return _WS_RE.sub(" ", _COMMENT_RE.sub("", prelude)).strip()


def parse_top_level_blocks(css: str) -> list[tuple[str, str]]:
    """Return [(normalized_selector_key, full_block_text)] for top-level rules.

    Handles nested braces (@media, @keyframes) as single blocks, and
    brace-less at-rules terminated by `;` (@import, @charset).
    """
    blocks: list[tuple[str, str]] = []
    i = 0
    n = len(css)
    start = 0
    depth = 0
    while i < n:
        ch = css[i]
        if ch == "/" and i + 1 < n and css[i + 1] == "*":
            end = css.find("*/", i + 2)
            i = n if end == -1 else end + 2
            continue
        if ch in "\"'":
            quote = ch
            i += 1
            while i < n and css[i] != quote:
                i += 2 if css[i] == "\\" else 1
            i += 1
            continue
        if ch == "{":
            depth += 1
            i += 1
            continue
        if ch == "}":
            depth = max(0, depth - 1)
            i += 1
            if depth == 0:
                segment = css[start:i]
                prelude = segment[: segment.find("{")]
                key = _normalize_key(prelude)
                if key:
                    blocks.append((key, segment.strip()))
                start = i
            continue
        if ch == ";" and depth == 0:
            segment = css[start : i + 1]
            key = _normalize_key(segment[:-1])
            if key:
                blocks.append((key, segment.strip()))
            start = i + 1
            i += 1
            continue
        i += 1
    return blocks


def merge_css_preserving(existing: str, new: str) -> tuple[str, list[str]]:
    """Merge a stylesheet rewrite with the on-disk version.

    Returns (merged_css, preserved_selector_keys). The new content wins for
    every selector it declares; blocks that only exist on disk are appended
    verbatim so earlier pages keep their styles.
    """
    if not existing.strip():
        return new, []
    new_keys = {key for key, _ in parse_top_level_blocks(new)}
    if not new_keys:
        return new, []
    preserved: list[str] = []
    chunks: list[str] = []
    prepend: list[str] = []
    seen: set[str] = set()
    for key, block in parse_top_level_blocks(existing):
        if key in new_keys or key in seen:
            continue
        seen.add(key)
        preserved.append(key)
        # @import / @charset are only valid before other rules.
        if key.startswith(("@import", "@charset")):
            prepend.append(block)
        else:
            chunks.append(block)
    if not preserved:
        return new, []
    merged = new.rstrip()
    if prepend:
        merged = "\n".join(prepend) + "\n" + merged
    if chunks:
        merged = (
            merged
            + "\n\n/* — preserved styles (auto-merged, do not remove) — */\n"
            + "\n\n".join(chunks)
            + "\n"
        )
    return merged, preserved
