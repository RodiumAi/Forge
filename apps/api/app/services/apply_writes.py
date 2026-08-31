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
from app.services.filesystem import write_file
from app.services.import_validator import ImportViolation, validate_write_content

logger = logging.getLogger("apply_writes")

_LOCKED_BRAND_RE = re.compile(
    r"^(DESIGN\.md|public/logo(?:\.(?:png|jpe?g|webp|gif|svg))?)$",
    re.IGNORECASE,
)
_CSS_SHRINK_MIN_EXISTING = 800
_CSS_SHRINK_RATIO = 0.75


def is_locked_brand_path(path: str) -> bool:
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    return bool(_LOCKED_BRAND_RE.match(rel))


def _css_shrink_violation(project_id: str, path: str, content: str) -> dict | None:
    """Reject mid-plan rewrites that drop most of index.css (append-only rule)."""
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    if rel != "src/index.css":
        return None
    from app.services.filesystem import read_file

    try:
        existing = read_file(project_id, path)
    except FileNotFoundError:
        return None
    if len(existing) < _CSS_SHRINK_MIN_EXISTING:
        return None
    if len(content) >= int(len(existing) * _CSS_SHRINK_RATIO):
        return None
    return {
        "code": "CSS_SHRINK_REJECTED",
        "path": path,
        "specifier": "",
        "message": (
            f"Rejected rewrite of src/index.css ({len(content)} chars vs {len(existing)} on disk). "
            "Mid-plan CSS must APPEND — preserve every existing selector (navbar/hero/layout) "
            "and add only this task's rules."
        ),
    }


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

    for op in writes:
        path = str(getattr(op, "path", "") or "")
        content = str(getattr(op, "content", "") or "")
        if not path:
            continue
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
        shrink = _css_shrink_violation(project_id, path, content)
        if shrink:
            violations.append(shrink)
            continue
        accepted.append((path, content))

    if not accepted:
        return [], violations

    # --- Phase 2: snapshot, then commit the batch to disk --------------------
    if snapshot_label:
        history.snapshot(project_id, snapshot_label)

    applied: list[dict] = []
    for path, content in accepted:
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
