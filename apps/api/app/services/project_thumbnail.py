"""Project card thumbnails, rendered on the server.

Dashboard cards used to run every project live: one hidden iframe per card,
Babel compiling the whole app in the visitor's browser, then html2canvas.
Heavy, slow, and it froze the page on small machines. Now the API renders the
home page once in headless Chromium, frames the capture in a 16:9 card (a
browser window for sites, a phone for apps) with the project name, and saves
it as ``thumbnail.jpg``. Cards only ever show that image.

A design system card is the cover page of its guidelines document (the same
document as the PDF and the published page), laid out at the card's size.

A capture is redone when the project's sources are newer than the image
(``thumbnail.json`` keeps the sources' stamp). Requests are queued and run one
at a time in a background thread, so neither the listing nor a chat run waits.

The code is the project owner's: like the pre-render, Chromium runs in a child
process with a minimal environment and a hard deadline, on a fake origin that
serves the runner shell, the runner assets and the project's ``public/`` only.
"""

from __future__ import annotations

import contextlib
import html
import json
import logging
import mimetypes
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

logger = logging.getLogger(__name__)

THUMBNAIL_FILENAME = "thumbnail.jpg"
META_FILENAME = "thumbnail.json"
# Bump to redo every stored thumbnail (new card layout).
CARD_VERSION = 2
ORIGIN = "https://app.forge-thumb.invalid"
_ALLOWED_HOSTS = frozenset(
    {"esm.sh", "fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com", "plus.unsplash.com"}
)
_BUDGET_S = 60.0
_CARD_W, _CARD_H = 1280, 720
_KINDS = ("web", "mobile", "design_system")
_SOURCE_DIRS = ("src", "public")
_SOURCE_FILES = ("index.html", "package.json", "design-system.json")
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
    "PLAYWRIGHT_BROWSERS_PATH",
)


# ── staleness ──────────────────────────────────────────────────────────────


def sources_stamp(project_dir: Path) -> float:
    """Newest mtime among the files the home page is built from."""
    newest = 0.0
    for name in _SOURCE_FILES:
        with contextlib.suppress(OSError):
            newest = max(newest, (project_dir / name).stat().st_mtime)
    for folder in _SOURCE_DIRS:
        root = project_dir / folder
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in {"node_modules", "dist", ".vite"}]
            for name in filenames:
                with contextlib.suppress(OSError):
                    newest = max(newest, os.stat(os.path.join(dirpath, name)).st_mtime)
    return newest


def is_stale(project_dir: Path) -> bool:
    if not (project_dir / THUMBNAIL_FILENAME).is_file():
        return True
    try:
        meta = json.loads((project_dir / META_FILENAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return True  # an old browser capture: redo it on the server
    if meta.get("v") != CARD_VERSION:
        return True
    return sources_stamp(project_dir) > float(meta.get("stamp") or 0)


# ── rendering (child process) ──────────────────────────────────────────────


def _content_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _safe_file(root: Path, rel: str) -> Path | None:
    target = (root / rel).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None
    return target if target.is_file() else None


def _accent(png: bytes) -> tuple[int, int, int]:
    """The most saturated colour that covers a fair share of the capture."""
    import colorsys
    import io

    from PIL import Image

    img = Image.open(io.BytesIO(png)).convert("RGB").resize((48, 32))
    counts: dict[tuple[int, int, int], int] = {}
    for r, g, b in img.getdata():
        key = (r // 24 * 24, g // 24 * 24, b // 24 * 24)
        counts[key] = counts.get(key, 0) + 1
    best, score = (235, 97, 24), 0.0  # RodiumAi orange when nothing stands out
    for (r, g, b), n in counts.items():
        _, light, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if n < 6 or sat < 0.35 or not 0.25 < light < 0.75:
            continue
        s = sat * n
        if s > score:
            best, score = (r + 12, g + 12, b + 12), s
    return best


def _card_html(shot_png: bytes, kind: str, name: str, accent: tuple[int, int, int]) -> str:
    import base64

    data = base64.b64encode(shot_png).decode("ascii")
    r, g, b = accent
    title = html.escape(name.strip() or "Forge", quote=True)
    label = "App" if kind == "mobile" else "Site"
    if kind == "mobile":
        device = f"""<div class="phone"><img src="data:image/png;base64,{data}" alt=""/></div>"""
        layout = "mobile"
    else:
        device = f"""<div class="win"><div class="bar"><i></i><i></i><i></i><span></span></div>
<img src="data:image/png;base64,{data}" alt=""/></div>"""
        layout = "web"
    return f"""<!doctype html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap"/>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{_CARD_W}px;height:{_CARD_H}px;overflow:hidden;position:relative;font-family:Inter,system-ui,sans-serif;color:#f6f4f0;
background:radial-gradient(70% 90% at 85% 110%,rgba({r},{g},{b},.55),transparent 65%),
radial-gradient(60% 70% at 0% 0%,rgba({r},{g},{b},.22),transparent 70%),#111318}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(70% 80% at 50% 40%,#000,transparent)}}
.meta{{position:absolute;display:flex;flex-direction:column;gap:14px}}
.chip{{align-self:flex-start;font-size:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgb({r},{g},{b});background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);padding:7px 14px;border-radius:99px}}
h1{{font-weight:700;letter-spacing:-.03em;line-height:1.02;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.web .meta{{left:72px;top:54px;right:72px;flex-direction:row;align-items:center;gap:18px}}
.web h1{{font-size:52px;-webkit-line-clamp:1}}
.win{{position:absolute;left:72px;right:72px;top:148px;height:640px;border-radius:22px;overflow:hidden;background:#fff;
box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.12)}}
.bar{{height:44px;background:#1b1e25;display:flex;align-items:center;gap:9px;padding:0 18px}}
.bar i{{width:13px;height:13px;border-radius:99px;background:#3a3f4b}}
.bar span{{margin-left:18px;width:340px;height:22px;border-radius:99px;background:#272b34}}
.win img{{display:block;width:100%}}
.mobile .meta{{left:88px;top:0;bottom:0;width:560px;justify-content:center}}
.mobile h1{{font-size:76px}}
.phone{{position:absolute;right:150px;top:70px;width:340px;height:736px;border-radius:52px;overflow:hidden;background:#000;
border:10px solid #1b1e25;box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.12);transform:rotate(-4deg)}}
.phone::before{{content:"";position:absolute;top:12px;left:50%;transform:translateX(-50%);width:96px;height:26px;border-radius:99px;background:#000;z-index:2}}
.phone img{{display:block;width:100%}}
</style></head><body class="{layout}"><div class="grid"></div>
<div class="meta"><span class="chip">{label}</span><h1>{title}</h1></div>
{device}</body></html>"""


def _render_sync(
    shell: Path, project_public: Path, runner_dir: Path, kind: str, name: str, out: Path
) -> None:
    from playwright.sync_api import sync_playwright

    shell_html = shell.read_bytes()

    def handle(route) -> None:
        url = route.request.url
        try:
            parsed = urlparse(url)
            if url.startswith(ORIGIN):
                path = unquote(parsed.path)
                if path.startswith("/runner/"):
                    file = _safe_file(runner_dir, path[len("/runner/") :])
                elif "/public/" in path and path.startswith("/projects/"):
                    file = _safe_file(project_public, path.split("/public/", 1)[1])
                else:
                    route.fulfill(
                        status=200, body=shell_html, headers={"Content-Type": "text/html; charset=utf-8"}
                    )
                    return
                if file is None:
                    route.fulfill(status=404, body=b"")
                else:
                    route.fulfill(
                        status=200, body=file.read_bytes(), headers={"Content-Type": _content_type(file)}
                    )
            elif (parsed.hostname or "") in _ALLOWED_HOSTS and route.request.method == "GET":
                route.continue_()
            else:
                route.abort()
        except Exception:
            with contextlib.suppress(Exception):
                route.abort()

    mobile = kind == "mobile"
    viewport = {"width": 390, "height": 844} if mobile else {"width": 1280, "height": 800}
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
            context = browser.new_context(
                viewport=viewport,
                device_scale_factor=2 if mobile else 1,
                is_mobile=mobile,
                has_touch=mobile,
                service_workers="block",
                accept_downloads=False,
            )
            context.route("**/*", handle)
            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.dismiss())
            page.goto(f"{ORIGIN}/", wait_until="domcontentloaded", timeout=20_000)
            page.wait_for_function(
                "(() => { const r = document.getElementById('root'); return r && r.childElementCount > 0 && document.body.innerText.trim().length > 0; })()",
                timeout=30_000,
            )
            with contextlib.suppress(Exception):
                page.wait_for_load_state("networkidle", timeout=8_000)
            with contextlib.suppress(Exception):
                page.wait_for_function("Array.from(document.images).every(i => i.complete)", timeout=6_000)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(700)
            shot = page.screenshot(type="png")

            # The card itself at 1x, whatever the capture's pixel ratio.
            card = browser.new_page(viewport={"width": _CARD_W, "height": _CARD_H}, device_scale_factor=1)
            card.route(
                "**/*",
                lambda r: (
                    r.continue_()
                    if (urlparse(r.request.url).hostname or "") in _ALLOWED_HOSTS
                    or r.request.url.startswith("data:")
                    else r.abort()
                ),
            )
            card.set_content(_card_html(shot, kind, name, _accent(shot)), wait_until="load", timeout=15_000)
            card.evaluate("document.fonts.ready")
            card.screenshot(path=str(out), type="jpeg", quality=82)
            card.close()
            context.close()
        finally:
            browser.close()


# The cover page only, reflowed to the card's 16:9 frame (the page keeps its
# own layout: flex column, accent shape, logo top, title at the bottom).
_COVER_ONLY = (
    "body{margin:0;padding:0;background:#111318}"
    f".page{{width:{_CARD_W}px!important;height:{_CARD_H}px!important;border-radius:0!important;"
    "box-shadow:none!important;margin:0!important}.page~.page{display:none!important}"
)


def _render_guide_sync(guide: Path, out: Path) -> None:
    from playwright.sync_api import sync_playwright

    html_doc = guide.read_text(encoding="utf-8").replace("</head>", f"<style>{_COVER_ONLY}</style></head>", 1)
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
            page = browser.new_page(viewport={"width": _CARD_W, "height": _CARD_H}, device_scale_factor=1)
            page.route(
                "**/*",
                lambda r: (
                    r.continue_()
                    if (urlparse(r.request.url).hostname or "") in _ALLOWED_HOSTS
                    or r.request.url.startswith("data:")
                    else r.abort()
                ),
            )
            page.set_content(html_doc, wait_until="load", timeout=15_000)
            page.evaluate("document.fonts.ready")
            cover = page.locator(".page").first
            cover.screenshot(path=str(out), type="jpeg", quality=82)
        finally:
            browser.close()


def _child_main(argv: list[str]) -> None:
    if argv and argv[0] == "--guide":
        _render_guide_sync(Path(argv[1]), Path(argv[2]))
        return
    shell, public, runner, kind, name, out = argv
    _render_sync(Path(shell), Path(public), Path(runner), kind, name, Path(out))


def _guide_html(project_id: str) -> str | None:
    """The guidelines document of a design system project, assets inlined."""
    from app.contracts.forge_design import dump_document, validate_design_system
    from app.services.design_system.guide import brand_guide_html
    from app.services.design_system.registry import read_document
    from app.services.design_system.site import local_asset_url

    raw = read_document(project_id)
    if raw is None:
        return None
    try:
        document = dump_document(validate_design_system(raw))
    except Exception:
        return None
    return brand_guide_html(document, asset_url=local_asset_url(project_id), badge=False)


def _run_child(args: list[str], project_id: str) -> bool:
    env = {k: os.environ[k] for k in _CHILD_ENV_KEYS if k in os.environ}
    api_root = Path(__file__).resolve().parents[2]
    try:
        proc = subprocess.run(
            [
                sys.executable,
                "-I",
                "-c",
                "import sys; sys.path.insert(0, sys.argv[1]); "
                "from app.services.project_thumbnail import _child_main; _child_main(sys.argv[2:])",
                str(api_root),
                *args,
            ],
            cwd=tempfile.gettempdir(),
            env=env,
            capture_output=True,
            timeout=_BUDGET_S,
        )
    except subprocess.TimeoutExpired:
        logger.warning("thumbnail timed out for %s", project_id)
        return False
    if proc.returncode != 0:
        logger.warning(
            "thumbnail failed for %s: %s", project_id, proc.stderr.decode("utf-8", "replace")[-400:]
        )
        return False
    return True


def _save(project_id: str, data: bytes, stamp: float) -> None:
    from app.services.filesystem import write_bytes

    write_bytes(project_id, THUMBNAIL_FILENAME, data)
    write_bytes(project_id, META_FILENAME, json.dumps({"v": CARD_VERSION, "stamp": stamp}).encode("utf-8"))


def render_guide_thumbnail(project_id: str) -> bool:
    """Capture the cover of a design system's guidelines as its card."""
    from app.services.filesystem import project_dir

    stamp = sources_stamp(project_dir(project_id))
    guide = _guide_html(project_id)
    if guide is None:
        return False
    with tempfile.TemporaryDirectory(prefix="forge-thumb-") as tmp:
        source = Path(tmp) / "guide.html"
        source.write_text(guide, encoding="utf-8")
        out = Path(tmp) / THUMBNAIL_FILENAME
        if not _run_child(["--guide", str(source), str(out)], project_id) or not out.is_file():
            return False
        data = out.read_bytes()
    _save(project_id, data, stamp)
    return True


def render_thumbnail(project_id: str, kind: str, name: str) -> bool:
    """Capture and save the card of one project. False when it could not render."""
    if kind == "design_system":
        return render_guide_thumbnail(project_id)
    from app.services import preview_babel
    from app.services.filesystem import project_dir
    from app.services.project_packages import extra_import_map

    root = project_dir(project_id)
    stamp = sources_stamp(root)
    files = preview_babel.collect_project_source_files(project_id)
    if "src/main.tsx" not in files:
        return False
    shell_html = preview_babel.render_runner_shell(
        bundle={
            "files": files,
            "entry": "src/main.tsx",
            "title": name,
            "assets": {"base": f"/projects/{project_id}/public", "routerBase": "/"},
        },
        extra_imports=extra_import_map(project_id),
    )
    env = {k: os.environ[k] for k in _CHILD_ENV_KEYS if k in os.environ}
    api_root = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory(prefix="forge-thumb-") as tmp:
        shell = Path(tmp) / "shell.html"
        shell.write_text(shell_html, encoding="utf-8")
        out = Path(tmp) / THUMBNAIL_FILENAME
        try:
            proc = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "import sys; sys.path.insert(0, sys.argv[1]); "
                    "from app.services.project_thumbnail import _child_main; _child_main(sys.argv[2:])",
                    str(api_root),
                    str(shell),
                    str(root / "public"),
                    str(preview_babel.runtime_public_dir()),
                    kind,
                    name,
                    str(out),
                ],
                cwd=tmp,
                env=env,
                capture_output=True,
                timeout=_BUDGET_S,
            )
        except subprocess.TimeoutExpired:
            logger.warning("thumbnail timed out for %s", project_id)
            return False
        if proc.returncode != 0 or not out.is_file():
            logger.warning(
                "thumbnail failed for %s: %s", project_id, proc.stderr.decode("utf-8", "replace")[-400:]
            )
            return False
        data = out.read_bytes()
    from app.services.filesystem import write_bytes

    write_bytes(project_id, THUMBNAIL_FILENAME, data)
    write_bytes(project_id, META_FILENAME, json.dumps({"v": CARD_VERSION, "stamp": stamp}).encode("utf-8"))
    return True


# ── queue ──────────────────────────────────────────────────────────────────

_queue: queue.Queue[tuple[str, str, str]] = queue.Queue(maxsize=200)
_pending: set[str] = set()
_checked: dict[str, float] = {}
_lock = threading.Lock()
_worker: threading.Thread | None = None
# A project is looked at most this often from listings (staleness is cheap,
# but a dashboard refresh should not walk every project tree every time).
_RECHECK_S = 30.0


def _work() -> None:
    from app.services.filesystem import project_dir

    while True:
        project_id, kind, name = _queue.get()
        try:
            if is_stale(project_dir(project_id)):
                render_thumbnail(project_id, kind, name)
        except Exception:
            logger.exception("thumbnail worker failed for %s", project_id)
        finally:
            with _lock:
                _pending.discard(project_id)
            _queue.task_done()


def request_thumbnail(project_id: str, kind: str | None, name: str, *, force: bool = False) -> None:
    """Queue a (re)capture of a site or app card. Cheap and never blocks."""
    global _worker
    if (kind or "web") not in _KINDS or os.environ.get("FORGE_THUMBNAILS") == "off":
        return
    now = time.monotonic()
    with _lock:
        if project_id in _pending:
            return
        if not force and now - _checked.get(project_id, -_RECHECK_S) < _RECHECK_S:
            return
        _checked[project_id] = now
        _pending.add(project_id)
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_work, name="forge-thumbnails", daemon=True)
            _worker.start()
    try:
        _queue.put_nowait((project_id, kind or "web", name))
    except queue.Full:
        with _lock:
            _pending.discard(project_id)
