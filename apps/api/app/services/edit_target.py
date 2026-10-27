"""Targeted edits of React projects: what the user pointed at in the preview.

The preview tags every host JSX element with ``data-forge-id="<file>:<line>:<col>"``
(1-based, see ``runtime/transform.mjs``). A chat message may carry that id, the
current route and an explicit file. This module maps them back to source files,
builds the instruction the model receives, and computes the write allowlist
enforced by ``apply_writes``.
"""

from __future__ import annotations

import logging
import posixpath
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.orchestration.page_routes import normalize_route, page_file_for_route

logger = logging.getLogger("edit_target")

SOURCE_EXTS = (".tsx", ".jsx", ".ts", ".js")
_FORGE_ID_RE = re.compile(
    r"^(?P<path>[A-Za-z0-9_@$.\-/ ]{1,300}\.(?:tsx|jsx|ts|js)):(?P<line>[1-9]\d{0,5}):(?P<col>[1-9]\d{0,4})$"
)
_CSS_IMPORT_RE = re.compile(r"""^\s*import\s+["'](\.{1,2}/[^"']+\.css)["']""", re.M)
SNIPPET_MAX_LINES = 40
SNIPPET_MAX_CHARS = 4_000


@dataclass(frozen=True)
class ForgeLocation:
    path: str
    line: int
    col: int

    @property
    def forge_id(self) -> str:
        return f"{self.path}:{self.line}:{self.col}"


def clean_rel_path(value: str | None) -> str | None:
    """Project-relative POSIX path, or None when it could escape the project."""
    raw = str(value or "").strip().replace("\\", "/")
    if not raw or raw.startswith("/") or len(raw) > 300:
        return None
    norm = posixpath.normpath(raw)
    if norm in (".", "") or norm.startswith("../") or norm == ".." or "/../" in f"/{norm}/":
        return None
    return norm


def parse_forge_id(value: str | None) -> ForgeLocation | None:
    match = _FORGE_ID_RE.match(str(value or "").strip())
    if not match:
        return None
    path = clean_rel_path(match.group("path"))
    if not path:
        return None
    return ForgeLocation(path, int(match.group("line")), int(match.group("col")))


def _offset_of(content: str, line: int, col: int) -> int | None:
    """Character offset of 1-based (line, col), or None when out of range."""
    lines = content.split("\n")
    if line < 1 or line > len(lines) or col < 1 or col > len(lines[line - 1]):
        return None
    return sum(len(chunk) + 1 for chunk in lines[: line - 1]) + col - 1


def _element_end_treesitter(content: str, start: int) -> int | None:
    try:
        import tree_sitter_typescript as tstype
        from tree_sitter import Language, Parser
    except Exception:  # pragma: no cover - dependency is pinned
        return None
    try:
        raw = content.encode("utf-8")
        start_byte = len(content[:start].encode("utf-8"))
        parser = Parser(Language(tstype.language_tsx()))
        tree = parser.parse(raw)
        node = tree.root_node.descendant_for_byte_range(start_byte, start_byte)
        while node is not None:
            if node.start_byte != start_byte:
                return None
            if node.type in ("jsx_element", "jsx_self_closing_element"):
                return len(raw[: node.end_byte].decode("utf-8", errors="ignore"))
            node = node.parent
    except Exception:
        logger.debug("tree-sitter element lookup failed", exc_info=True)
    return None


def _opening_tag_end(content: str, start: int) -> int | None:
    """End of the opening tag starting at `start` (quotes and braces aware)."""
    depth = 0
    quote = ""
    i = start + 1
    while i < len(content):
        ch = content[i]
        if quote:
            if ch == quote:
                quote = ""
        elif ch in "\"'`":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth = max(0, depth - 1)
        elif ch == ">" and depth == 0:
            return i + 1
        i += 1
    return None


def element_span(content: str, loc: ForgeLocation) -> tuple[int, int] | None:
    """[start, end) character span of the JSX element at `loc`.

    None when the location no longer points at a `<` (the file changed since
    the preview rendered): callers fall back to their literal search.
    """
    start = _offset_of(content, loc.line, loc.col)
    if start is None or content[start] != "<":
        return None
    end = _element_end_treesitter(content, start) or _opening_tag_end(content, start)
    if end is None or end <= start:
        return None
    return start, end


def _numbered_snippet(content: str, loc: ForgeLocation, span: tuple[int, int] | None) -> str:
    lines = content.split("\n")
    first = loc.line
    last = first + content[span[0] : span[1]].count("\n") if span is not None else first
    last = min(last, first + SNIPPET_MAX_LINES - 1, len(lines))
    out = [f"{n:>5} | {lines[n - 1]}" for n in range(first, last + 1)]
    text = "\n".join(out)
    return text[:SNIPPET_MAX_CHARS]


def _imported_stylesheets(path: str, files: dict[str, str]) -> list[str]:
    content = files.get(path) or ""
    base = posixpath.dirname(path)
    out: list[str] = []
    for spec in _CSS_IMPORT_RE.findall(content):
        resolved = clean_rel_path(posixpath.join(base, spec))
        if resolved and resolved in files and resolved not in out:
            out.append(resolved)
    return out


@dataclass
class ResolvedTarget:
    route: str | None = None
    page_file: str | None = None
    element: ForgeLocation | None = None
    file_path: str | None = None
    snippet: str | None = None
    restrict: bool = False
    allowed_paths: list[str] = field(default_factory=list)
    focus_paths: list[str] = field(default_factory=list)
    #: Pages picked in the pages rail: (route, file that renders it or None).
    pages: list[tuple[str, str | None]] = field(default_factory=list)

    @property
    def has_selection(self) -> bool:
        return self.element is not None or self.file_path is not None

    @property
    def scoped(self) -> bool:
        """Writes are limited to `allowed_paths`."""
        return self.restrict and bool(self.allowed_paths)


def resolve_target(target: Any, files: dict[str, str]) -> ResolvedTarget | None:
    """Map a ``MessageTarget`` (route / forgeId / filePath) onto project files."""
    if target is None:
        return None
    raw_route = getattr(target, "route", None)
    raw_forge = getattr(target, "forgeId", None)
    raw_file = getattr(target, "filePath", None)
    raw_pages = getattr(target, "pages", None) or []
    if not (raw_route or raw_forge or raw_file or raw_pages):
        return None

    out = ResolvedTarget()
    if raw_route:
        out.route = normalize_route(str(raw_route))
        if out.route:
            out.page_file = page_file_for_route(out.route, files)

    for raw_page in list(raw_pages)[:40]:
        page = normalize_route(str(raw_page))
        if page and all(page != seen for seen, _ in out.pages):
            out.pages.append((page, page_file_for_route(page, files)))

    loc = parse_forge_id(raw_forge)
    if loc is not None and loc.path in files:
        out.element = loc
        content = files[loc.path]
        out.snippet = _numbered_snippet(content, loc, element_span(content, loc))

    explicit = clean_rel_path(raw_file)
    if explicit and explicit in files:
        out.file_path = explicit

    picked_files = [page_file for _, page_file in out.pages]
    for path in (out.element.path if out.element else None, out.file_path, out.page_file, *picked_files):
        if path and path not in out.focus_paths:
            out.focus_paths.append(path)

    out.restrict = bool(getattr(target, "restrict", False)) and out.has_selection
    if out.restrict:
        allowed: list[str] = []
        for path in (out.element.path if out.element else None, out.file_path):
            if path and path not in allowed:
                allowed.append(path)
        # The element's own stylesheet and the page stylesheet: restyling the
        # selection almost always goes through them.
        for owner in (*allowed, out.page_file):
            if not owner:
                continue
            for css in _imported_stylesheets(owner, files):
                if css not in allowed:
                    allowed.append(css)
        out.allowed_paths = allowed
        for css in allowed:
            if css not in out.focus_paths:
                out.focus_paths.append(css)
    return out


def target_instruction(resolved: ResolvedTarget | None) -> str | None:
    """System message describing the target, or None when there is nothing to add."""
    if resolved is None:
        return None
    parts: list[str] = []
    if resolved.route:
        where = f"The user is looking at the route `{resolved.route}` of the preview"
        if resolved.page_file:
            where += f" (rendered by `{resolved.page_file}`)"
        parts.append(where + ".")
    if resolved.pages:
        listed = ", ".join(
            f"`{route}`" + (f" (`{page_file}`)" if page_file else "") for route, page_file in resolved.pages
        )
        parts.append(
            f"Pages selected by the user for this request: {listed}. Apply the change to "
            "these pages; leave the other pages as they are unless the request clearly says "
            "otherwise. Shared parts (header, footer, layout) may change only when the "
            "request is about them."
        )
    if resolved.element is not None:
        loc = resolved.element
        parts.append(
            f"Selected element: `{loc.path}` line {loc.line}, column {loc.col}. "
            "This is the exact element the [Selection] marker refers to; change it and "
            "nothing else unless the request clearly says otherwise. If it is rendered "
            "from a list or a prop, edit the data or the caller that provides it."
        )
        if resolved.snippet:
            parts.append(f"Current source of the element:\n```tsx\n{resolved.snippet}\n```")
    elif resolved.file_path:
        parts.append(f"Target file: `{resolved.file_path}`.")
    if resolved.scoped:
        parts.append(
            "Edit scope is LIMITED to these files: "
            + ", ".join(f"`{p}`" for p in resolved.allowed_paths)
            + ". Writes or deletions of any other file will be refused. If the request "
            "really needs another file, make the part you can inside the scope, then say "
            "in one sentence which other file(s) you would change and why: the user can "
            "allow changes to other files and resend."
        )
    if not parts:
        return None
    parts.append("Never write `data-forge-id` attributes in the source: they are preview-only.")
    return "Targeted edit.\n" + "\n".join(parts)
