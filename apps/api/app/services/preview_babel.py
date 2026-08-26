"""Babel-runner preview helpers — no Vite / node_modules."""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import get_settings
from app.services.filesystem import list_files, project_dir

logger = logging.getLogger("preview_babel")

# In-memory "ready" markers (no OS process).
_babel_ready: set[str] = set()


def runtime_public_dir() -> Path:
    # apps/api/runtime/public (sibling of app/)
    return Path(__file__).resolve().parents[2] / "runtime" / "public"


def runner_url() -> str:
    settings = get_settings()
    base = settings.api_base_url.rstrip("/")
    return f"{base}/runner/"


def mark_babel_preview_ready(project_id: str) -> None:
    _babel_ready.add(project_id)


def is_babel_preview_ready(project_id: str) -> bool:
    return project_id in _babel_ready


def stop_babel_preview(project_id: str) -> None:
    _babel_ready.discard(project_id)


def collect_project_source_files(project_id: str) -> dict[str, str]:
    """Text source files for the runner (tsx/ts/jsx/js/css + html shells)."""
    files = list_files(project_id)
    out: dict[str, str] = {}
    for path, content in files.items():
        norm = path.replace("\\", "/")
        if any(part in {"node_modules", ".git", "dist", ".vite"} for part in norm.split("/")):
            continue
        if norm.endswith((".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".html", ".md", ".svg")):
            out[norm] = content
    return out


def ensure_babel_project_layout(project_id: str) -> None:
    """Ensure entry exists; no npm install."""
    root = project_dir(project_id)
    main = root / "src" / "main.tsx"
    if not main.is_file():
        logger.warning("babel preview: missing src/main.tsx for %s", project_id)
