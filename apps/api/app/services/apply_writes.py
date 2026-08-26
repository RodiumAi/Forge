"""Apply forge-write ops with AST import validation (tree-sitter)."""

from __future__ import annotations

import re
from typing import Any

from app.services.cpu_pool import run_cpu
from app.services.filesystem import write_file
from app.services.import_validator import ImportViolation, validate_write_content

_LOCKED_BRAND_RE = re.compile(
    r"^(DESIGN\.md|public/logo(?:\.(?:png|jpe?g|webp|gif|svg))?)$",
    re.IGNORECASE,
)


def is_locked_brand_path(path: str) -> bool:
    rel = (path or "").strip().lstrip("/").replace("\\", "/")
    return bool(_LOCKED_BRAND_RE.match(rel))


def apply_validated_writes(
    project_id: str,
    writes: list[Any],
    *,
    allow_brand_writes: bool = False,
) -> tuple[list[dict], list[dict]]:
    """
    Write allowed files; return (applied, violations_as_dicts).
    CPU-bound AST checks run in ProcessPoolExecutor.

    DESIGN.md and public/logo.* are locked by default so agent turns cannot
    silently reinvent the project brand after the user set a charter/logo.
    """
    applied: list[dict] = []
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
        try:
            found: list[ImportViolation] = run_cpu(validate_write_content, path, content)
        except Exception:
            # Pool/pickle failure — fall back to in-process validation.
            found = validate_write_content(path, content)
        if found:
            violations.extend(v.as_dict() for v in found)
            continue
        write_file(project_id, path, content)
        applied.append({"op": "write", "path": path})
    if applied:
        try:
            from app.services.firestore_live import bump_files

            bump_files(project_id, [str(a.get("path") or "") for a in applied])
        except Exception:
            pass
    return applied, violations
