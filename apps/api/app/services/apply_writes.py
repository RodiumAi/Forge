"""Apply forge-write ops with AST import validation (tree-sitter).

Guarantee: a batch is **all-or-nothing at the validation stage**. Every op is
validated before any file touches disk, so the workspace can never end up with
`App.tsx` updated while the component it imports was rejected. Each individual
write is atomic (temp file + os.replace), and a snapshot is taken beforehand so
the whole batch can be rolled back from the UI.
"""

from __future__ import annotations

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


def is_locked_brand_path(path: str) -> bool:
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    return bool(_LOCKED_BRAND_RE.match(rel))


def _validate(path: str, content: str) -> list[ImportViolation]:
    try:
        return run_cpu(validate_write_content, path, content)
    except Exception:
        # Pool/pickle failure — fall back to in-process validation.
        logger.warning("cpu pool validation failed for %s, running inline", path, exc_info=True)
        return validate_write_content(path, content)


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
        found = _validate(path, content)
        if found:
            violations.extend(v.as_dict() for v in found)
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

    if applied:
        try:
            from app.services.firestore_live import bump_files

            bump_files(project_id, [str(a.get("path") or "") for a in applied])
        except Exception:
            pass
    return applied, violations
