"""Parser for the agent's file-operation tags.

The model never calls functions: it writes XML-ish tags in its answer.

    <forge-write path="src/App.tsx"> full file </forge-write>
    <forge-edit path="src/App.tsx">
    <<<<<<< SEARCH
    exact current lines
    =======
    replacement lines
    >>>>>>> REPLACE
    </forge-edit>
    <forge-delete path="src/Old.tsx"></forge-delete>

Writes and edits are returned in document order, because an edit may target a
file written earlier in the same answer. A tag left open (the output limit cut
the answer) is reported in ``ForgeOutput.truncated`` instead of being dropped
silently; when the same path is emitted again later, complete, the re-emission
wins and the path is no longer reported.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class WriteOp:
    path: str
    content: str


@dataclass
class EditOp:
    """Search/replace hunks applied to the current content of ``path``."""

    path: str
    hunks: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class DeleteOp:
    path: str


@dataclass
class ForgeOutput:
    writes: list[WriteOp | EditOp]
    deletes: list[DeleteOp]
    #: Paths whose tag was opened but never closed, and not re-emitted later.
    truncated: list[str]


_TAG_EVENT = re.compile(
    r"<forge-(write|edit)\s+path=[\"']([^\"']+)[\"']\s*>|</forge-(write|edit)\s*>",
    re.IGNORECASE,
)
TAG_DELETE = re.compile(
    r"<forge-delete\s+path=[\"']([^\"']+)[\"']\s*/?>",
    re.DOTALL | re.IGNORECASE,
)
# Markers sit on their own lines; an empty SEARCH (marker right after marker)
# is captured as empty instead of swallowing the next block.
_HUNK_RE = re.compile(
    r"^[ \t]*<{7}[ \t]*SEARCH[ \t]*\r?\n(.*?)^[ \t]*={7}[ \t]*\r?\n(.*?)^[ \t]*>{7}[ \t]*REPLACE",
    re.DOTALL | re.MULTILINE,
)


def _clean_path(raw: str) -> str | None:
    path = raw.strip().lstrip("./")
    if not path or ".." in path.split("/"):
        return None
    return path


def _strip_fences(content: str) -> str:
    # Models sometimes wrap a file body in a markdown fence.
    content = re.sub(r"^```[a-zA-Z0-9]*\n?", "", content.strip())
    return re.sub(r"\n?```$", "", content)


def _parse_hunks(body: str) -> list[tuple[str, str]]:
    hunks: list[tuple[str, str]] = []
    for match in _HUNK_RE.finditer(body):
        # The newline before the next marker belongs to the marker line.
        search = _drop_final_newline(match.group(1))
        replace = _drop_final_newline(match.group(2))
        # An empty SEARCH is kept: applying it reports it instead of dropping it.
        hunks.append((search, replace))
    return hunks


def _drop_final_newline(text: str) -> str:
    if text.endswith("\r\n"):
        return text[:-2]
    if text.endswith("\n"):
        return text[:-1]
    return text


def parse_forge_output(text: str) -> ForgeOutput:
    ops: list[WriteOp | EditOp] = []
    abandoned: list[str] = []
    open_tag: tuple[str, str, int] | None = None  # (kind, path, body_start)

    for match in _TAG_EVENT.finditer(text or ""):
        if match.group(1):  # opening tag
            if open_tag is not None:
                # A new file started while the previous one was never closed:
                # the previous one was cut (usually a continuation re-emitting it).
                abandoned.append(open_tag[1])
            open_tag = (match.group(1).lower(), match.group(2), match.end())
            continue
        kind = (match.group(3) or "").lower()
        if open_tag is None or kind != open_tag[0]:
            continue
        open_kind, raw_path, start = open_tag
        open_tag = None
        path = _clean_path(raw_path)
        if not path:
            continue
        body = text[start : match.start()]
        if open_kind == "write":
            ops.append(WriteOp(path=path, content=_strip_fences(body)))
        else:
            ops.append(EditOp(path=path, hunks=_parse_hunks(body)))

    if open_tag is not None:
        abandoned.append(open_tag[1])

    completed = {op.path for op in ops}
    truncated: list[str] = []
    for raw in abandoned:
        path = _clean_path(raw)
        if path and path not in completed and path not in truncated:
            truncated.append(path)

    deletes: list[DeleteOp] = []
    for match in TAG_DELETE.finditer(text or ""):
        path = _clean_path(match.group(1))
        if path:
            deletes.append(DeleteOp(path=path))

    return ForgeOutput(writes=ops, deletes=deletes, truncated=truncated)


def op_text(op: WriteOp | EditOp) -> str:
    """The text an op puts into its file (a write's body, an edit's replacements)."""
    if isinstance(op, EditOp):
        return "\n".join(replace for _search, replace in op.hunks)
    return op.content


def unclosed_paths(text: str) -> list[str]:
    """Paths whose write/edit tag is still open at the end of ``text``."""
    return parse_forge_output(text).truncated


def parse_forge_tags(text: str) -> tuple[list[WriteOp | EditOp], list[DeleteOp]]:
    out = parse_forge_output(text)
    return out.writes, out.deletes
