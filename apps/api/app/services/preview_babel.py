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


def runner_url(project_id: str | None = None) -> str:
    settings = get_settings()
    base = settings.api_base_url.rstrip("/")
    # ?p= extends the shell's import map with the project's own package.json
    # dependencies — import maps cannot be modified after document load, so
    # the extension has to happen at shell render time.
    suffix = f"?p={project_id}" if project_id else ""
    return f"{base}/runner/{suffix}"


def render_runner_shell(
    bundle: dict | None = None,
    *,
    thumb: bool = False,
    extra_imports: dict[str, str] | None = None,
) -> str:
    """Build the preview shell HTML.

    Served dynamically rather than as a static file because three things must be
    injected at request time:
      - the import map, derived from packages.json (a hand-written copy used to
        live in index.html and drifted from the AST allowlist),
      - the allowed parent origins, so postMessage can be pinned on both sides,
      - the visual-edit bridge, which no longer has any other injection point.

    When `bundle` is given (standalone draft link), the source files are embedded
    so the page renders on its own — the runner otherwise waits for a builder
    parent to postMessage the bundle, which an external tab does not have.

    `thumb=True` hides scrollbars for dashboard card miniatures.
    """
    import json

    from app.runtime_manifest import browser_import_map

    settings = get_settings()
    import_map = json.dumps({"imports": {**browser_import_map(), **(extra_imports or {})}}, indent=2)
    origins = json.dumps(settings.runner_parent_origins)
    draft = ""
    if bundle:
        # `</` must not terminate the script tag early when a file contains it.
        payload = json.dumps(bundle).replace("</", "<\\/")
        draft = f"<script>window.__FORGE_DRAFT__ = {payload};</script>\n  "
    thumb_css = ""
    if thumb:
        thumb_css = (
            "<style data-forge-thumb>"
            "html,body{overflow:hidden!important;scrollbar-width:none!important;"
            "-ms-overflow-style:none!important}"
            "html::-webkit-scrollbar,body::-webkit-scrollbar,"
            "#root::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}"
            "</style>\n  "
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Forge preview runner</title>
  <!-- Generated from runtime/packages.json - do not hand-edit. -->
  <script type="importmap" id="forge-importmap">
{import_map}
  </script>
  <style id="forge-tokens"></style>
  <style id="forge-app-css"></style>
  <script>window.__FORGE_PARENT_ORIGINS = {origins};</script>
  {thumb_css}{draft}<script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script src="/runner/bridge.js?v=nav4"></script>
  <script type="module" src="/runner/runner.js?v=nav4"></script>
</body>
</html>
"""


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
