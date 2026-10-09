"""Apply forge-write ops with AST import validation (tree-sitter).

Guarantee: a batch is **all-or-nothing at the validation stage**. Every op is
validated before any file touches disk, so the workspace can never end up with
`App.tsx` updated while the component it imports was rejected. Each individual
write is atomic (temp file + os.replace), and a snapshot is taken beforehand so
the whole batch can be rolled back from the UI.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from app.services import history
from app.services.cpu_pool import run_cpu
from app.services.edit_apply import apply_hunks
from app.services.filesystem import write_file
from app.services.import_validator import ImportViolation, validate_write_content
from app.services.tags import EditOp
from app.services.typography import strip_long_dashes_in_file

logger = logging.getLogger("apply_writes")

_LOCKED_BRAND_RE = re.compile(
    r"^(DESIGN\.md|public/logo(?:\.(?:png|jpe?g|webp|gif))?)$",
    re.IGNORECASE,
)
_CSS_MERGE_MIN_EXISTING = 400
# The foundation stylesheet is shared by every page: a full rewrite of it that
# drops rules is almost always a rewrite from memory, not a deliberate removal.
# Page stylesheets belong to one task and may be rewritten freely; removing a
# foundation rule on purpose goes through a <forge-edit>.
_MERGED_STYLESHEETS = frozenset({"src/index.css"})

# An explicit request to change the brand unlocks DESIGN.md / public/logo.* for
# that turn ("change the brand", "nouvelle charte", "regenerate DESIGN.md"...).
_BRAND_CHANGE_RE = re.compile(
    r"design\.md|"
    r"\b(?:change|update|redo|regenerate|rework|new)\s+(?:the\s+|our\s+|my\s+)?"
    r"(?:brand(?:ing)?|charter|graphic\s+charter|visual\s+identity|logo|palette)\b|"
    r"\b(?:change|changer|modifie[rz]?|refai[st]|refaire|r[ée]g[ée]n[èe]re[rz]?|nouvel(?:le)?|nouveau)\s+"
    r"(?:la\s+|le\s+|l['’]\s*|ma\s+|mon\s+|notre\s+)?"
    r"(?:charte(?:\s+graphique)?|identit[ée]\s+visuelle|marque|logo|palette)\b",
    re.IGNORECASE,
)


def brand_change_requested(text: str) -> bool:
    """True when the user explicitly asks to change the brand / charter / logo."""
    return bool(_BRAND_CHANGE_RE.search(text or ""))


def is_locked_brand_path(path: str) -> bool:
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    return bool(_LOCKED_BRAND_RE.match(rel))


def _css_preserving_content(project_id: str, path: str, content: str) -> tuple[str, dict | None]:
    """Merge foundation-stylesheet rewrites with disk so dropped selectors survive.

    A task that re-emits src/index.css in full from an incomplete view of it
    would silently delete earlier rules (navbar/hero/layout). Instead of
    rejecting the write, keep the new rules and re-append every top-level
    block whose selector disappeared. Returns (final_content, info_violation).
    """
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    if rel not in _MERGED_STYLESHEETS:
        return content, None
    from app.services.filesystem import read_file

    try:
        existing = read_file(project_id, path)
    except FileNotFoundError:
        return content, None
    if len(existing) < _CSS_MERGE_MIN_EXISTING:
        return content, None
    try:
        from app.services.css_merge import merge_css_preserving

        merged, preserved = merge_css_preserving(existing, content)
    except Exception:
        logger.warning("css merge failed for %s/%s", project_id, path, exc_info=True)
        return content, None
    if not preserved:
        return content, None
    return merged, {
        "code": "CSS_MERGE_PRESERVED",
        "path": path,
        "specifier": "",
        "message": (
            f"Full rewrite of {rel} dropped {len(preserved)} existing selector(s); "
            "they were kept (the foundation is only trimmed through forge-edit). "
            "Examples: " + ", ".join(preserved[:8])
        ),
    }


def _resolve_edit(project_id: str, op: EditOp, batch_content: dict[str, str]) -> tuple[str, dict | None]:
    """Full new content for a forge-edit, or a violation when it cannot apply."""
    from app.services.filesystem import read_file

    base = batch_content.get(op.path)
    if base is None:
        try:
            base = read_file(project_id, op.path)
        except FileNotFoundError:
            return "", {
                "code": "EDIT_TARGET_MISSING",
                "path": op.path,
                "specifier": "",
                "message": f"forge-edit targets `{op.path}`, which does not exist. Use forge-write to create it.",
            }
    content, failure = apply_hunks(base, op.hunks, path=op.path)
    if failure is not None:
        return "", {"code": failure.code, "path": op.path, "specifier": "", "message": failure.message}
    return content, None


def _validate(path: str, content: str, allowlist: dict[str, str] | None = None) -> list[ImportViolation]:
    try:
        return run_cpu(validate_write_content, path, content, allowlist)
    except Exception:
        # Pool/pickle failure — fall back to in-process validation.
        logger.warning("cpu pool validation failed for %s, running inline", path, exc_info=True)
        return validate_write_content(path, content, allowlist)


def _batch_allowlist(project_id: str, writes: list[Any]) -> dict[str, str]:
    """Allowlist = base manifest + project package.json deps + deps declared by
    a package.json in THIS batch (the agent adds the dependency and imports it
    in the same turn; disk-only validation would reject that batch)."""
    from app.services.project_packages import project_allowed_packages, sanitize_batch_dependencies

    allow = dict(project_allowed_packages(project_id))
    for op in writes:
        if str(getattr(op, "path", "") or "").strip().lstrip("/") == "package.json":
            allow.update(sanitize_batch_dependencies(str(getattr(op, "content", "") or "")))
    return allow


def apply_validated_writes(
    project_id: str,
    writes: list[Any],
    *,
    allow_brand_writes: bool = False,
    snapshot_label: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """
    Write allowed files; return (applied, violations_as_dicts).
    CPU-bound AST checks run in the CPU pool.

    DESIGN.md and public/logo.* are locked by default so agent turns cannot
    silently reinvent the project brand after the user set a charter/logo.
    """
    # --- Phase 1: validate everything, write nothing -------------------------
    accepted: list[tuple[str, str]] = []
    violations: list[dict] = []
    allowlist = _batch_allowlist(project_id, writes)
    # Latest accepted content per path in this batch: an edit may target a
    # file written (or edited) earlier in the same answer.
    batch_content: dict[str, str] = {}

    for op in writes:
        path = str(getattr(op, "path", "") or "")
        if not path:
            continue
        is_edit = isinstance(op, EditOp)
        if is_edit:
            content, failure = _resolve_edit(project_id, op, batch_content)
            if failure is not None:
                violations.append(failure)
                continue
        else:
            content = str(getattr(op, "content", "") or "")
        if not allow_brand_writes and is_locked_brand_path(path):
            violations.append(
                {
                    "code": "BRAND_LOCKED",
                    "path": path,
                    "specifier": "",
                    "message": (
                        f"Skipped write to `{path}` — brand assets are locked. "
                        "Change the brand via Design charter, or ask explicitly to update it."
                    ),
                }
            )
            continue
        found = _validate(path, content, allowlist)
        if found:
            violations.extend(v.as_dict() for v in found)
            continue
        # House typography: no long dashes on the generated site (text, SEO, alt…).
        content = strip_long_dashes_in_file(path, content)
        if not is_edit:
            content, merge_info = _css_preserving_content(project_id, path, content)
            if merge_info:
                violations.append(merge_info)
        accepted.append((path, content))
        batch_content[path] = content

    if not accepted:
        return [], violations

    # --- Phase 2: snapshot, then commit the batch to disk --------------------
    if snapshot_label:
        history.snapshot(project_id, snapshot_label)

    # Several ops on one path collapse to its final content.
    final: dict[str, str] = {}
    for path, content in accepted:
        final[path] = content

    applied: list[dict] = []
    for path, content in final.items():
        try:
            write_file(project_id, path, content)
        except (OSError, ValueError) as exc:
            logger.error("write failed for %s/%s: %s", project_id, path, exc)
            violations.append(
                {
                    "code": "WRITE_FAILED",
                    "path": path,
                    "specifier": "",
                    "message": f"Could not write `{path}`: {exc}",
                }
            )
            continue
        applied.append({"op": "write", "path": path})

    return applied, violations


async def apply_validated_writes_async(
    project_id: str,
    writes: list[Any],
    *,
    allow_brand_writes: bool = False,
    snapshot_label: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """Off-loop variant for the SSE generators.

    The sync version runs tree-sitter validation and a git snapshot subprocess.
    Called directly from an async generator it froze the whole event loop for
    the duration of a large batch, which made every other request (preview
    restart, file tree...) time out client-side during heavy generations.
    """
    return await asyncio.to_thread(
        apply_validated_writes,
        project_id,
        writes,
        allow_brand_writes=allow_brand_writes,
        snapshot_label=snapshot_label,
    )
