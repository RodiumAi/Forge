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

The site's code is the project owner's, so rendering runs in a child process
(`python -m app.services.prerender`) with a minimal environment (no API
secrets) and a hard deadline: a page that blocks its main thread cannot hold
the publish, a worker thread or a browser beyond it.
"""

from __future__ import annotations

import contextlib
import json
import logging
import mimetypes
import os
import posixpath
import re
import sys
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlparse

logger = logging.getLogger(__name__)

ORIGIN = "https://site.forge-prerender.invalid"
NOT_FOUND_PROBE = "/__forge_not_found__"
_ALLOWED_EXTERNAL_HOSTS = frozenset({"esm.sh"})
_PAGE_TIMEOUT_MS = 15_000
_MAX_ROUTE_CHARS = 200
_MAX_ROUTE_DEPTH = 8
# Paths with these extensions are files, everything else is a page route (a
# route may contain a dot: /blog/v1.2, /u/jane.doe). Mirrors the Caddyfiles.
FILE_EXT_RE = re.compile(
    r"\.(?:js|mjs|css|map|json|html?|txt|xml|webmanifest|png|jpe?g|gif|webp|avif|svg|ico|"
    r"woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|pdf|zip)$",
    re.I,
)
# Environment the render child keeps: enough to start Python and Chromium.
_CHILD_ENV_KEYS = (
    "PATH",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
    "LOCALAPPDATA",
    "APPDATA",
    "PLAYWRIGHT_BROWSERS_PATH",
    "LANG",
)
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
    """Same-site page path of a link, normalised and safe as a folder name, or None.

    Routes become `<route>/index.html` on disk, so anything that could leave
    the build folder or the bucket prefix (`..`, backslashes, encoded
    characters, control characters) is refused rather than cleaned.
    """
    href = (href or "").strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlparse(href)
    if (parsed.scheme or parsed.netloc) and f"{parsed.scheme}://{parsed.netloc}" != ORIGIN:
        return None
    path = parsed.path or "/"
    if not path.startswith("/") or FILE_EXT_RE.search(path):
        return None
    if "\\" in path or "%" in path or any(ord(c) < 32 or c == "\x7f" for c in path):
        return None
    segments = [s for s in path.split("/") if s]
    if any(s in (".", "..") for s in segments) or len(segments) > _MAX_ROUTE_DEPTH:
        return None
    route = posixpath.normpath("/" + "/".join(segments)) if segments else "/"
    if len(route) > _MAX_ROUTE_CHARS or not route.startswith("/"):
        return None
    return route


def route_target(out_dir: Path, route: str) -> Path | None:
    """`<out_dir>/<route>/index.html`, or None when it would land outside out_dir."""
    root = out_dir.resolve()
    target = (root / route.lstrip("/") / "index.html").resolve() if route != "/" else root / "index.html"
    return target if root in target.parents else None


def _serve(out_dir: Path, url: str) -> tuple[int, bytes, str]:
    path = unquote(urlparse(url).path or "/")
    rel = path.lstrip("/")
    root = out_dir.resolve()
    candidate = (root / rel).resolve() if rel else root
    if root != candidate and root not in candidate.parents:
        return 404, b"", "text/plain"
    if candidate.is_dir():
        candidate = candidate / "index.html"
    if not candidate.is_file():
        if FILE_EXT_RE.search(path):
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
            context.set_default_timeout(_PAGE_TIMEOUT_MS)
            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.dismiss())
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


def _result_from_json(raw: bytes) -> PrerenderResult:
    data = json.loads(raw.decode("utf-8") or "{}")
    pages = {}
    for route, page in (data.get("pages") or {}).items():
        safe = _route_of(route)  # the child is untrusted output too
        if safe == route:
            pages[route] = RenderedPage(**page)
    not_found = data.get("not_found")
    return PrerenderResult(
        pages=pages,
        not_found=RenderedPage(**not_found) if isinstance(not_found, dict) else None,
        error=data.get("error"),
    )


def _kill_tree(proc) -> None:
    with contextlib.suppress(Exception):
        if os.name == "nt":
            import subprocess

            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
                check=False,
            )
        else:
            import signal

            os.killpg(proc.pid, signal.SIGKILL)
    with contextlib.suppress(Exception):
        proc.kill()


async def prerender_site(out_dir: Path, *, max_routes: int = 30, budget_s: float = 75.0) -> PrerenderResult:
    """Render in a child process with a hard deadline. Never raises.

    An unavailable browser, a crash or a page that never finishes means a
    client-rendered site, not a stuck publish.
    """
    import asyncio

    env = {k: os.environ[k] for k in _CHILD_ENV_KEYS if k in os.environ}
    api_root = Path(__file__).resolve().parents[2]
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            "import sys; sys.path.insert(0, sys.argv[1]); "
            "from app.services.prerender import _child_main; _child_main(sys.argv[2:])",
            str(api_root),
            str(out_dir.resolve()),
            str(max_routes),
            str(budget_s),
            cwd=str(out_dir),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=os.name != "nt",
        )
    except Exception as exc:
        logger.warning("prerender could not start", exc_info=True)
        return PrerenderResult(pages={}, not_found=None, error=str(exc)[:300])
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=budget_s + 15)
    except TimeoutError:
        _kill_tree(proc)
        with contextlib.suppress(Exception):
            await asyncio.wait_for(proc.wait(), timeout=10)
        return PrerenderResult(pages={}, not_found=None, error="prerender timed out")
    if proc.returncode != 0:
        _kill_tree(proc)  # browsers left behind by a crashed child
        err = (stderr or b"").decode("utf-8", "replace")[-300:]
        return PrerenderResult(pages={}, not_found=None, error=f"prerender exited {proc.returncode}: {err}")
    try:
        return _result_from_json(stdout)
    except Exception as exc:
        return PrerenderResult(pages={}, not_found=None, error=f"prerender output: {exc}"[:300])


def _child_main(argv: list[str]) -> None:
    """Entry point of the render child: JSON result on stdout."""
    out_dir, max_routes, budget_s = Path(argv[0]), int(argv[1]), float(argv[2])

    def watchdog() -> None:
        # A page busy-looping on its main thread blocks every Playwright call,
        # so the deadline is enforced outside the browser protocol, and takes
        # the driver and the browser down too (they hold our stdout open).
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

    timer = threading.Timer(budget_s + 5, watchdog)
    timer.daemon = True
    timer.start()
    try:
        result = _prerender_sync(out_dir, max_routes, budget_s)
    except Exception as exc:
        result = PrerenderResult(pages={}, not_found=None, error=str(exc)[:300])
    payload = {
        "pages": {route: asdict(page) for route, page in result.pages.items()},
        "not_found": asdict(result.not_found) if result.not_found else None,
        "error": result.error,
    }
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    timer.cancel()


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

        title = f"<title>{escape(page.title)}</title>"
        # A function replacement: the title is page text, never a regex template.
        doc = re.sub(r"<title>.*?</title>", lambda _m: title, doc, count=1, flags=re.S)
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
