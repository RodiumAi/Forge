"""Render every kit's preview.html to preview.png (the gallery card image).

    python scripts/render_template_previews.py            # every kit
    python scripts/render_template_previews.py lumen-wallet vinyl-music

The gallery used to lay out one iframe per card; a still image costs nothing
to show. Run it after editing a preview.html and commit the PNG next to it.
Cards are 480x270 at 2x (960x540). Only the kit folder, Google Fonts and
Unsplash are reachable while rendering.

Design system kits are skipped: their preview.html is the brand site, and
their gallery image is a composed cover drawn by design_system_kits/build_kits.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3] / "data" / "templates"
ALLOWED_HOSTS = frozenset({"fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com"})
WIDTH, HEIGHT, SCALE = 480, 270, 2


def _is_design_system(kit: Path) -> bool:
    try:
        meta = json.loads((kit / "template.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return meta.get("kind") == "design_system"


def main(ids: list[str]) -> int:
    from playwright.sync_api import sync_playwright

    kits = [ROOT / i for i in ids] if ids else sorted(p for p in ROOT.iterdir() if (p / "preview.html").is_file())
    failed = 0
    with sync_playwright() as p:
        browser = None
        for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
            try:
                browser = p.chromium.launch(headless=True, **kwargs)
                break
            except Exception:
                continue
        if browser is None:
            print("no Chromium available", file=sys.stderr)
            return 1
        context = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=SCALE)

        def route(r) -> None:
            url = r.request.url
            host = urlparse(url).hostname or ""
            if url.startswith("file:") or host in ALLOWED_HOSTS:
                r.continue_()
            else:
                r.abort()

        context.route("**/*", route)
        for kit in kits:
            html = kit / "preview.html"
            if not html.is_file():
                print(f"skip {kit.name}: no preview.html")
                continue
            if _is_design_system(kit):
                print(f"skip {kit.name}: design system, rendered by build_kits.py")
                continue
            page = context.new_page()
            try:
                page.goto(html.as_uri(), wait_until="networkidle", timeout=30_000)
                page.evaluate("document.fonts.ready")
                page.wait_for_function(
                    "Array.from(document.images).every(i => i.complete)", timeout=15_000
                )
                page.wait_for_timeout(300)
                page.screenshot(path=str(kit / "preview.png"), clip={"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT})
                print(f"ok {kit.name}")
            except Exception as exc:  # report and go on with the next kit
                failed += 1
                print(f"FAIL {kit.name}: {exc}", file=sys.stderr)
            finally:
                page.close()
        browser.close()
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
