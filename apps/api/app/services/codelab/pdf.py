"""PDF of a codelab: the published player in print mode, printed by Chromium.

The static site is built into a temporary folder (``build_codelab_site``),
then opened by headless Chromium on a fake origin served from that folder
only (``prerender._serve``); Google Fonts are the only outside requests let
through. The player renders every step expanded (``?print=1``) and flags the
page ready (``data-codelab-ready``) once fonts and code highlighting settled.

Like the pre-render, Chromium runs in a child process with a minimal
environment and a hard deadline.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from app.errors import SitesError
from app.services.prerender import _CHILD_ENV_KEYS, ORIGIN, _kill_tree, _serve

_FONT_HOSTS = frozenset({"fonts.googleapis.com", "fonts.gstatic.com"})
_BUDGET_S = 60.0
MAX_PDF_BYTES = 80 * 1024 * 1024


def _print_sync(out_dir: Path, pdf_path: Path) -> None:
    from playwright.sync_api import sync_playwright

    def handle(route) -> None:
        url = route.request.url
        try:
            if url.startswith(ORIGIN):
                status, body, ctype = _serve(out_dir, url)
                route.fulfill(status=status, body=body, headers={"Content-Type": ctype})
            elif (urlparse(url).hostname or "") in _FONT_HOSTS and route.request.method == "GET":
                route.continue_()
            else:
                route.abort()
        except Exception:
            with contextlib.suppress(Exception):
                route.abort()

    with sync_playwright() as p:
        browser = None
        for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
            try:
                browser = p.chromium.launch(headless=True, **kwargs)
                break
            except Exception:
                continue
        if browser is None:
            raise RuntimeError("no Chromium available")
        try:
            context = browser.new_context(service_workers="block", accept_downloads=False)
            context.route("**/*", handle)
            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.dismiss())
            page.goto(f"{ORIGIN}/?print=1", wait_until="domcontentloaded", timeout=20_000)
            page.wait_for_selector("[data-codelab-ready]", timeout=30_000)
            page.emulate_media(media="print")
            page.pdf(
                path=str(pdf_path),
                format="A4",
                print_background=True,
                margin={"top": "16mm", "bottom": "16mm", "left": "14mm", "right": "14mm"},
            )
            context.close()
        finally:
            browser.close()


def _child_main(argv: list[str]) -> None:
    _print_sync(Path(argv[0]), Path(argv[1]))


async def render_pdf(site_dir: Path) -> bytes:
    """PDF bytes of a built codelab site; raises SitesError when printing fails."""
    env = {k: os.environ[k] for k in _CHILD_ENV_KEYS if k in os.environ}
    api_root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix="forge-codelab-pdf-") as tmp:
        pdf_path = Path(tmp) / "codelab.pdf"
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            "import sys; sys.path.insert(0, sys.argv[1]); "
            "from app.services.codelab.pdf import _child_main; _child_main(sys.argv[2:])",
            str(api_root),
            str(site_dir.resolve()),
            str(pdf_path),
            cwd=str(site_dir),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=os.name != "nt",
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=_BUDGET_S)
        except TimeoutError as exc:
            _kill_tree(proc)
            raise SitesError(504, "EXPORT_TIMEOUT", "The PDF took too long to render.") from exc
        if proc.returncode != 0 or not pdf_path.is_file():
            _kill_tree(proc)
            detail = (stderr or b"").decode("utf-8", "replace")[-300:]
            raise SitesError(500, "EXPORT_FAILED", f"The PDF could not be rendered. {detail}".strip())
        data = pdf_path.read_bytes()
        if len(data) > MAX_PDF_BYTES:
            raise SitesError(413, "EXPORT_TOO_LARGE", "The PDF is too large.")
        return data
