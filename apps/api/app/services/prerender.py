"""Pre-render a built site so every route ships real HTML.

A published site used to be `<div id="root"></div>` plus JavaScript: crawlers
and link previews that do not run JS saw an empty page, every route served
the same title, and unknown paths answered 200. After the production build,
the site is loaded in headless Chromium from the build directory itself,
routes are discovered by following its own links, and each one is saved as
`<route>/index.html` with its rendered markup, its title and the tags the page
set (react-helmet-async). A `404.html` is rendered from an unknown path.

Only the build directory (and the dependency CDN when the build kept it
external) is reachable from the page; every other request is refused, so
rendering never depends on, or reaches, anything else.
"""

from __future__ import annotations

import contextlib
import logging
import mimetypes
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

ORIGIN = "https://site.forge-prerender.invalid"
NOT_FOUND_PROBE = "/__forge_not_found__"
_ALLOWED_EXTERNAL_HOSTS = frozenset({"esm.sh"})
_PAGE_TIMEOUT_MS = 15_000
_EXTRACT_JS = """() => {
  const root = document.getElementById('root');
  return {
    html: root ? root.innerHTML : '',
    title: document.title || '',
    lang: document.documentElement.lang || '',
    managed: [...document.head.querySelectorAll('[data-rh]')].map((el) => el.outerHTML),
    links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || ''),
  };
}"""


@dataclass
class RenderedPage:
    route: str
    html: str
    title: str
    managed: list[str] = field(default_factory=list)


@dataclass
class PrerenderResult:
    pages: dict[str, RenderedPage]
    not_found: RenderedPage | None
    error: str | None = None


def _route_of(href: str) -> str | None:
    """Same-site page path of a link, normalised, or None."""
    href = (href or "").strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlparse(href)
    if (parsed.scheme or parsed.netloc) and f"{parsed.scheme}://{parsed.netloc}" != ORIGIN:
        return None
    path = parsed.path or "/"
    if not path.startswith("/"):
        return None
    if re.search(r"\.[a-z0-9]{1,8}$", path, re.I):  # a file, not a page
        return None
    path = re.sub(r"/{2,}", "/", path)
    return path.rstrip("/") or "/"


def _serve(out_dir: Path, url: str) -> tuple[int, bytes, str]:
    path = urlparse(url).path or "/"
    rel = path.lstrip("/")
    root = out_dir.resolve()
    candidate = (root / rel).resolve() if rel else root
    if root != candidate and root not in candidate.parents:
        return 404, b"", "text/plain"
    if candidate.is_dir():
        candidate = candidate / "index.html"
    if not candidate.is_file():
        if re.search(r"\.[a-z0-9]{1,8}$", path, re.I):
            return 404, b"", "text/plain"
        candidate = root / "index.html"  # client-side route
    ctype = "text/javascript" if candidate.suffix in (".js", ".mjs") else None
    ctype = ctype or mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
    return 200, candidate.read_bytes(), ctype


def _prerender_sync(out_dir: Path, max_routes: int, budget_s: float) -> PrerenderResult:
    from playwright.sync_api import sync_playwright

    deadline = time.monotonic() + budget_s
    pages: dict[str, RenderedPage] = {}
    not_found: RenderedPage | None = None

    def handle(route) -> None:
        url = route.request.url
        host = urlparse(url).hostname or ""
        try:
            if url.startswith(ORIGIN):
                if urlparse(url).path.startswith("/_rodium/"):
                    route.abort()
                    return
                status, body, ctype = _serve(out_dir, url)
                route.fulfill(status=status, body=body, headers={"Content-Type": ctype})
                return
            if host in _ALLOWED_EXTERNAL_HOSTS and route.request.method == "GET":
                route.continue_()
                return
            route.abort()
        except Exception:
            with contextlib.suppress(Exception):
                route.abort()

    def render(page, path: str) -> dict | None:
        page.goto(ORIGIN + path, wait_until="domcontentloaded", timeout=_PAGE_TIMEOUT_MS)
        with contextlib.suppress(Exception):
            page.wait_for_function(
                "() => { const r = document.getElementById('root'); return r && r.children.length > 0; }",
                timeout=8_000,
            )
        with contextlib.suppress(Exception):
            page.wait_for_load_state("networkidle", timeout=5_000)
        page.wait_for_timeout(250)  # Suspense / lazy routes settle
        return page.evaluate(_EXTRACT_JS)

    with sync_playwright() as p:
        browser = None
        for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
            try:
                browser = p.chromium.launch(headless=True, **kwargs)
                break
            except Exception:
                continue
        if browser is None:
            return PrerenderResult(pages={}, not_found=None, error="no Chromium available")
        try:
            context = browser.new_context(
                service_workers="block",
                accept_downloads=False,
                viewport={"width": 1280, "height": 900},
                java_script_enabled=True,
            )
            context.route("**/*", handle)
            route_ws = getattr(context, "route_web_socket", None)
            if callable(route_ws):
                route_ws("**/*", lambda ws: ws.close(code=1008, reason="disabled"))
            context.on("page", lambda pg: pg.close() if pg.opener() is not None else None)
            page = context.new_page()
            queue = ["/"]
            seen = {"/"}
            while queue and len(pages) < max_routes and time.monotonic() < deadline:
                path = queue.pop(0)
                try:
                    data = render(page, path)
                except Exception as exc:
                    logger.info("prerender skipped %s: %s", path, exc)
                    continue
                if not data or not data.get("html"):
                    continue
                pages[path] = RenderedPage(
                    path, data["html"], data.get("title") or "", data.get("managed") or []
                )
                for href in data.get("links") or []:
                    route = _route_of(href)
                    if route and route not in seen and route != NOT_FOUND_PROBE:
                        seen.add(route)
                        queue.append(route)
            if pages and time.monotonic() < deadline:
                with contextlib.suppress(Exception):
                    data = render(page, NOT_FOUND_PROBE)
                    if data and data.get("html"):
                        not_found = RenderedPage(
                            NOT_FOUND_PROBE, data["html"], data.get("title") or "", data.get("managed") or []
                        )
            context.close()
        finally:
            browser.close()
    return PrerenderResult(pages=pages, not_found=not_found)


async def prerender_site(out_dir: Path, *, max_routes: int = 30, budget_s: float = 75.0) -> PrerenderResult:
    """Never raises: an unavailable browser or a crash means a client-rendered site."""
    import asyncio

    try:
        return await asyncio.to_thread(_prerender_sync, out_dir, max_routes, budget_s)
    except Exception as exc:
        logger.warning("prerender failed", exc_info=True)
        return PrerenderResult(pages={}, not_found=None, error=str(exc)[:300])


_TAG_KEY_RE = re.compile(r'\b(name|property|rel|itemprop)=["\']([^"\']+)["\']', re.I)


def _tag_key(tag: str) -> str | None:
    if tag.lower().startswith("<title"):
        return "title"
    match = _TAG_KEY_RE.search(tag)
    return f"{match.group(1).lower()}={match.group(2).lower()}" if match else None


def compose_page(template: str, page: RenderedPage) -> str:
    """The built index.html with a page's markup, title and managed head tags."""
    doc = template.replace('<div id="root"></div>', f'<div id="root">{page.html}</div>', 1)
    managed = [t for t in page.managed if not t.lower().startswith("<title")]
    if page.title:
        from html import escape

        doc = re.sub(r"<title>.*?</title>", f"<title>{escape(page.title)}</title>", doc, count=1, flags=re.S)
    if managed:
        keys = {k for k in (_tag_key(t) for t in managed) if k}

        def drop(match: re.Match[str]) -> str:
            return "" if _tag_key(match.group(0)) in keys else match.group(0)

        head_end = doc.find("</head>")
        head, rest = doc[:head_end], doc[head_end:]
        head = re.sub(r"<(?:meta|link)\b[^>]*>\s*", drop, head)
        marker = "<!--forge:head-->"
        block = "\n".join(managed) + "\n"
        head = head.replace(marker, block + marker, 1) if marker in head else head + block
        doc = head + rest
    return doc
