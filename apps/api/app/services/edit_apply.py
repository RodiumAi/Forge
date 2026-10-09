"""Apply <forge-edit> search/replace hunks to a file's current content.

A hunk must match exactly once. Models often get trailing whitespace or the
indentation of the first line slightly wrong, so a second, line-based pass
compares lines with trailing whitespace stripped and accepts a unique match.
Anything else is refused rather than guessed: a wrong replacement is worse
than a skipped one, because the caller reports skipped edits back to the model.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EditFailure:
    code: str  # EDIT_NO_MATCH | EDIT_AMBIGUOUS | EDIT_EMPTY
    message: str


def _line_match_spans(content: str, search: str) -> list[tuple[int, int]]:
    """Character spans of `search` matched line-by-line, trailing spaces ignored."""
    lines = content.splitlines(keepends=True)
    needle = [line.rstrip() for line in search.strip("\n").splitlines()]
    if not needle:
        return []
    starts: list[int] = []
    pos = 0
    for line in lines:
        starts.append(pos)
        pos += len(line)
    starts.append(pos)
    stripped = [line.rstrip() for line in lines]
    spans: list[tuple[int, int]] = []
    width = len(needle)
    for i in range(len(lines) - width + 1):
        window = stripped[i : i + width]
        if window == needle or [w.strip() for w in window] == [n.strip() for n in needle]:
            end = starts[i + width]
            # Keep the final newline of the matched block in place.
            if lines[i + width - 1].endswith("\n"):
                end -= 2 if lines[i + width - 1].endswith("\r\n") else 1
            spans.append((starts[i], end))
    return spans


def _reindent(replace: str, matched: str, search: str) -> str:
    """Carry the file's real indentation over when the model got it wrong."""
    first_real = next((line for line in matched.splitlines() if line.strip()), "")
    first_search = next((line for line in search.splitlines() if line.strip()), "")
    real_indent = first_real[: len(first_real) - len(first_real.lstrip())]
    search_indent = first_search[: len(first_search) - len(first_search.lstrip())]
    if real_indent == search_indent:
        return replace
    out = []
    for line in replace.splitlines(keepends=True):
        if line.startswith(search_indent):
            out.append(real_indent + line[len(search_indent) :])
        else:
            out.append(line)
    return "".join(out)


def apply_hunks(
    content: str, hunks: list[tuple[str, str]], *, path: str = ""
) -> tuple[str, EditFailure | None]:
    """Return (new_content, failure). On failure the content is unchanged."""
    if not hunks:
        return content, EditFailure(
            "EDIT_EMPTY",
            f"forge-edit on `{path}` had no SEARCH/REPLACE block.",
        )
    current = content
    for idx, (search, replace) in enumerate(hunks, start=1):
        count = current.count(search)
        if count == 1:
            current = current.replace(search, replace, 1)
            continue
        if count > 1:
            return content, EditFailure(
                "EDIT_AMBIGUOUS",
                f"forge-edit block {idx} on `{path}` matches {count} places; "
                "include more surrounding lines so it matches exactly once.",
            )
        spans = _line_match_spans(current, search)
        if len(spans) == 1:
            start, end = spans[0]
            matched = current[start:end]
            current = current[:start] + _reindent(replace, matched, search) + current[end:]
            continue
        if len(spans) > 1:
            return content, EditFailure(
                "EDIT_AMBIGUOUS",
                f"forge-edit block {idx} on `{path}` matches {len(spans)} places; "
                "include more surrounding lines so it matches exactly once.",
            )
        preview = search.strip().splitlines()[0][:80] if search.strip() else ""
        return content, EditFailure(
            "EDIT_NO_MATCH",
            f"forge-edit block {idx} on `{path}` was not found in the current file "
            f"(first line: {preview!r}). Copy the SEARCH lines exactly from the current file.",
        )
    return current, None
