"""Shared machinery for source-rewriting edits driven from the preview.

Both the text tool and the image tool locate a literal in the project sources
and substitute it. The hard part is not the substitution but refusing to do it
when the target is not uniquely identified: a wrong guess silently corrupts the
user's code.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.filesystem import list_files

SKIP_PARTS = {"node_modules", "dist", ".vite", ".git"}


class AmbiguousMatch(LookupError):
    """Target found, but not in a single unambiguous location."""

    def __init__(self, message: str, candidates: list[str] | None = None, count: int = 0):
        super().__init__(message)
        self.candidates = candidates or []
        self.count = count


@dataclass
class SourceVariant:
    """A literal to search for, plus how to re-encode the replacement."""

    literal: str
    kind: str = "raw"  # "raw" | "backslash" | "html"


@dataclass
class SourceMatch:
    path: str
    content: str
    variant: SourceVariant
    count: int


def collect_matches(
    project_id: str,
    variants: list[SourceVariant],
    source_exts: tuple[str, ...],
) -> list[SourceMatch]:
    """First matching variant per file, with its occurrence count."""
    matches: list[SourceMatch] = []
    for path, content in list_files(project_id).items():
        if any(part in SKIP_PARTS for part in path.split("/")):
            continue
        if not path.endswith(source_exts):
            continue
        for variant in variants:
            count = content.count(variant.literal)
            if count > 0:
                matches.append(SourceMatch(path, content, variant, count))
                break
    return matches


def select_unique(matches: list[SourceMatch], label: str) -> SourceMatch:
    """Pick the single file to edit, or refuse.

    A file containing the target more than once is never edited: replacing the
    first occurrence would be a coin flip on which element the user meant. The
    previous implementation did exactly that whenever every candidate file had
    multiple hits.
    """
    unique = [m for m in matches if m.count == 1]

    if len(unique) == 1:
        return unique[0]

    if len(unique) > 1:
        src_unique = [m for m in unique if m.path.startswith("src/")]
        if len(src_unique) == 1:
            return src_unique[0]
        raise AmbiguousMatch(
            f"{label} appears once in several files",
            candidates=[m.path for m in unique],
        )

    best = min(m.count for m in matches)
    raise AmbiguousMatch(
        f"{label} appears {best} times in the same file",
        candidates=[m.path for m in matches if m.count == best],
        count=best,
    )
