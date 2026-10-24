"""Render the deck print page in Chromium: PDF, PNG, and the PPTX layout.

Same isolation as ``prerender.py``: a child process
(``python -I -c ... _child_main``) with a minimal environment and a hard
deadline, the browser killed with its process tree when the budget runs out.
The page is served from the export folder through request interception;
only Google Fonts (theme fonts) may be fetched from outside, everything else
is refused, so rendering never reaches anything the deck does not need.

Jobs (JSON on stdin):
- ``pdf``: one page per print page at the canvas size, vector text;
- ``png``: one image per print page (``slide-001.png``...);
- ``layout``: the element layout read by ``src/extract.ts`` plus a
  screenshot of each raster it lists (for the PPTX).
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from app.services.prerender import _CHILD_ENV_KEYS, _kill_tree, _serve

logger = logging.getLogger(__name__)

ORIGIN = "https://deck.forge-export.invalid"
_ALLOWED_EXTERNAL_HOSTS = frozenset({"fonts.googleapis.com", "fonts.gstatic.com"})
_READY_TIMEOUT_MS = 30_000
MAX_PAGES = 600
MAX_RASTERS = 1500


class RenderError(RuntimeError):
    pass


@dataclass
class RenderResult:
    files: list[str] = field(default_factory=list)
    layout: dict | None = None
    rasters: dict[str, str] = field(default_factory=dict)
    error: str | None = None


def _launch(p):
    for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        try:
            return p.chromium.launch(headless=True, **kwargs)
        except Exception:
            continue
    return None


def _render_sync(job: dict) -> dict:
    from playwright.sync_api import sync_playwright

    site = Path(job["site_dir"])
    out = Path(job["out_dir"])
    kind = job["kind"]
    width, height = int(job["width"]), int(job["height"])
    deadline = time.monotonic() + float(job["budget_s"])

    def handle(route) -> None:
        url = route.request.url
        host = urlparse(url).hostname or ""
        try:
            if url.startswith(ORIGIN):
                status, body, ctype = _serve(site, url)
                route.fulfill(status=status, body=body, headers={"Content-Type": ctype})
                return
            if host in _ALLOWED_EXTERNAL_HOSTS and route.request.method == "GET":
                route.continue_()
                return
            route.abort()
        except Exception:
            with contextlib.suppress(Exception):
                route.abort()

    result: dict = {"files": [], "layout": None, "rasters": {}, "error": None}
    with sync_playwright() as p:
        browser = _launch(p)
        if browser is None:
            result["error"] = "no Chromium available"
            return result
        try:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=float(job.get("scale") or 1),
                service_workers="block",
                accept_downloads=False,
            )
            context.route("**/*", handle)
            route_ws = getattr(context, "route_web_socket", None)
            if callable(route_ws):
                route_ws("**/*", lambda ws: ws.close(code=1008, reason="disabled"))
            context.on("page", lambda pg: pg.close() if pg.opener() is not None else None)
            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.dismiss())
            page.goto(f"{ORIGIN}/{job['page']}", wait_until="domcontentloaded", timeout=_READY_TIMEOUT_MS)
            page.wait_for_function(
                "() => !!document.documentElement.dataset.deckReady", timeout=_READY_TIMEOUT_MS
            )
            if page.evaluate("() => document.documentElement.dataset.deckReady") != "1":
                result["error"] = "the deck could not be loaded"
                return result
            pages = page.locator("[data-print-page]")
            count = min(pages.count(), MAX_PAGES)
            if kind == "pdf":
                target = out / "deck.pdf"
                page.pdf(
                    path=str(target),
                    width=f"{width}px",
                    height=f"{height}px",
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                )
                result["files"].append(target.name)
            elif kind == "png":
                for i in range(count):
                    if time.monotonic() > deadline:
                        raise RenderError("time budget exceeded")
                    name = f"slide-{i + 1:03d}.png"
                    pages.nth(i).screenshot(path=str(out / name), animations="disabled")
                    result["files"].append(name)
            elif kind == "layout":
                layout = page.evaluate("() => window.__forgeDeck.extract()")
                result["layout"] = layout
                for ref in (layout.get("rasters") or [])[:MAX_RASTERS]:
                    if time.monotonic() > deadline:
                        raise RenderError("time budget exceeded")
                    selector = page.evaluate("(r) => window.__forgeDeck.isolate(r)", ref)
                    if not selector:
                        continue
                    name = f"raster-{len(result['rasters']) + 1:04d}.png"
                    page.locator(selector).first.screenshot(
                        path=str(out / name),
                        omit_background=ref.get("elementId") is not None,
                        animations="disabled",
                    )
                    result["rasters"][ref["key"]] = name
                page.evaluate("() => window.__forgeDeck.restore()")
            else:
                result["error"] = f"unknown job {kind}"
            context.close()
        finally:
            browser.close()
    return result


def _child_main(argv: list[str]) -> None:
    """Entry point of the render child: job JSON on stdin, result JSON on stdout."""
    job = json.loads(sys.stdin.read() or "{}")
    budget = float(job.get("budget_s") or 60)

    def watchdog() -> None:
        with contextlib.suppress(Exception):
            if os.name == "nt":
                import subprocess

                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(os.getpid())], capture_output=True, check=False
                )
            else:
                import signal

                os.killpg(os.getpgid(0), signal.SIGKILL)
        os._exit(3)

    timer = threading.Timer(budget + 5, watchdog)
    timer.daemon = True
    timer.start()
    try:
        result = _render_sync(job)
    except Exception as exc:
        result = {"files": [], "layout": None, "rasters": {}, "error": str(exc)[:500]}
    sys.stdout.write(json.dumps(result))
    sys.stdout.flush()
    timer.cancel()


def _safe_name(name: object) -> str | None:
    """Output files are flat names the child wrote in out_dir; anything else is ignored."""
    if not isinstance(name, str) or not name or "/" in name or "\\" in name or name.startswith("."):
        return None
    return name


async def render_deck(
    site_dir: Path,
    out_dir: Path,
    *,
    kind: str,
    width: int,
    height: int,
    page: str = "print.html",
    scale: float = 1.0,
    budget_s: float = 120.0,
) -> RenderResult:
    """Run one job in the render child. Raises RenderError on failure."""
    env = {k: os.environ[k] for k in _CHILD_ENV_KEYS if k in os.environ}
    api_root = Path(__file__).resolve().parents[3]
    job = {
        "site_dir": str(site_dir.resolve()),
        "out_dir": str(out_dir.resolve()),
        "kind": kind,
        "width": width,
        "height": height,
        "page": page,
        "scale": scale,
        "budget_s": budget_s,
    }
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            "import sys; sys.path.insert(0, sys.argv[1]); "
            "from app.services.exports.render import _child_main; _child_main(sys.argv[2:])",
            str(api_root),
            cwd=str(out_dir),
            env=env,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=os.name != "nt",
        )
    except Exception as exc:
        raise RenderError(f"renderer could not start: {exc}"[:300]) from exc
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(json.dumps(job).encode()), timeout=budget_s + 20
        )
    except TimeoutError as exc:
        _kill_tree(proc)
        with contextlib.suppress(Exception):
            await asyncio.wait_for(proc.wait(), timeout=10)
        raise RenderError("rendering timed out") from exc
    if proc.returncode != 0:
        _kill_tree(proc)
        err = (stderr or b"").decode("utf-8", "replace")[-300:]
        raise RenderError(f"renderer exited {proc.returncode}: {err}")
    try:
        data = json.loads(stdout.decode("utf-8") or "{}")
    except ValueError as exc:
        raise RenderError("renderer output unreadable") from exc
    if data.get("error"):
        raise RenderError(str(data["error"])[:500])
    files = [n for n in (_safe_name(f) for f in data.get("files") or []) if n and (out_dir / n).is_file()]
    rasters = {
        str(k): n
        for k, v in (data.get("rasters") or {}).items()
        if (n := _safe_name(v)) and (out_dir / n).is_file()
    }
    layout = data.get("layout") if isinstance(data.get("layout"), dict) else None
    return RenderResult(files=files, layout=layout, rasters=rasters)
