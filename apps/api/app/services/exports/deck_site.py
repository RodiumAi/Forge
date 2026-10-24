"""Static deck player sites.

Three shapes of the same page (bundle from ``bundle.py``, entry
``runtime/deck/src/entry.tsx``):

- **published link**: ``index.html`` (audience), ``presenter/index.html``
  (presenter view, synced with the audience window over BroadcastChannel, no
  server), ``deck.json``, ``slides/<id>.json``, ``theme.json``, ``notes.json``
  only when the owner shares notes, the referenced images under their project
  path (``public/images/...``) and the hashed bundle under ``assets/``;
- **print page** (``print.html``) rendered by Chromium for PDF, PNG and PPTX;
- **single-file HTML export**: bundle, documents and images inline, works
  offline (the presenter view opens as a popup of the same page).

Every page carries its own Content-Security-Policy: scripts from the site (or
the inline bundle by hash), YouTube (privacy-enhanced host) and Vimeo frames,
Google Fonts for the theme fonts, nothing else.
"""

from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import re
import shutil
from html import escape
from pathlib import Path
from typing import Any

from app.errors import SitesError
from app.services.exports.deck_source import DeckSource, asset_file

FRAME_ORIGINS = ("https://www.youtube-nocookie.com", "https://player.vimeo.com")
FONT_CSS_ORIGIN = "https://fonts.googleapis.com"
FONT_FILE_ORIGIN = "https://fonts.gstatic.com"
#: Ceiling of the images inlined in a single-file HTML export.
MAX_INLINE_ASSET_BYTES = 80 * 1024 * 1024

_SCRIPT_CLOSE_RE = re.compile(r"</(script)", re.I)


def bundle_path(bundle: bytes) -> str:
    """Content-hashed path of the bundle (cached forever by the sites gateway)."""
    return f"assets/deck-{hashlib.sha256(bundle).hexdigest()[:12]}.js"


def deck_csp(*, inline_script: bytes | None = None, offline: bool = False) -> str:
    """Policy of a deck page. ``inline_script`` allows that exact inline bundle."""
    script = (
        f"'sha256-{base64.b64encode(hashlib.sha256(inline_script).digest()).decode()}'"
        if inline_script
        else "'self'"
    )
    self_src = "" if offline else " 'self'"
    directives = [
        "default-src 'none'",
        f"script-src {script}",
        f"style-src 'unsafe-inline' {FONT_CSS_ORIGIN}",
        f"font-src {FONT_FILE_ORIGIN} data:",
        f"img-src{self_src} data: blob:",
        f"media-src{self_src} https: data: blob:",
        f"connect-src{self_src}" if not offline else "connect-src 'none'",
        f"frame-src {' '.join(FRAME_ORIGINS)}",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
    ]
    return "; ".join(directives)


def json_for_script(value: Any) -> str:
    """JSON safe inside a <script> element (no tag or comment can close it)."""
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        text.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def inline_script_text(bundle: bytes) -> str:
    """Bundle source safe to inline: a literal "</script" never ends the element."""
    return _SCRIPT_CLOSE_RE.sub(r"<\\/\1", bundle.decode("utf-8"))


def page_html(
    *,
    title: str,
    lang: str,
    config: dict[str, Any],
    script_src: str | None = None,
    inline_script: str | None = None,
    data: dict[str, Any] | None = None,
    csp: str,
    description: str | None = None,
) -> str:
    head = [
        '<meta charset="utf-8" />',
        f'<meta http-equiv="Content-Security-Policy" content="{escape(csp)}" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
        '<meta name="referrer" content="strict-origin-when-cross-origin" />',
        '<meta name="generator" content="Forge by RodiumAi" />',
        f"<title>{escape(title)}</title>",
    ]
    if description:
        head.append(f'<meta name="description" content="{escape(description)}" />')
        head.append(f'<meta property="og:title" content="{escape(title)}" />')
    if config.get("mode") != "print":
        head.append(
            "<style>html,body,#forge-deck{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style>"
        )
    body = [
        '<div id="forge-deck"></div>',
        f'<script type="application/json" id="forge-deck-config">{json_for_script(config)}</script>',
    ]
    if data is not None:
        body.append(f'<script type="application/json" id="forge-deck-data">{json_for_script(data)}</script>')
    if inline_script is not None:
        body.append(f"<script>{inline_script}</script>")
    elif script_src:
        body.append(f'<script src="{escape(script_src)}" defer></script>')
    return (
        f'<!doctype html>\n<html lang="{escape(lang or "en")}">\n<head>\n'
        + "\n".join(head)
        + "\n</head>\n<body>\n"
        + "\n".join(body)
        + "\n</body>\n</html>\n"
    )


def write_documents(src: DeckSource, out: Path, *, notes: bool) -> None:
    """deck.json, slides/<id>.json, theme.json and (optionally) notes.json."""
    (out / "slides").mkdir(parents=True, exist_ok=True)
    (out / "deck.json").write_text(json.dumps(src.deck, ensure_ascii=False), encoding="utf-8")
    for sid in src.visible_ids:
        slide = src.slides.get(sid) or {"id": sid, "elements": []}
        (out / "slides" / f"{sid}.json").write_text(json.dumps(slide, ensure_ascii=False), encoding="utf-8")
    (out / "theme.json").write_text(json.dumps({"design": src.design}, ensure_ascii=False), encoding="utf-8")
    if notes:
        visible = set(src.visible_ids)
        shared = {k: v for k, v in src.notes.items() if k in visible}
        (out / "notes.json").write_text(json.dumps(shared, ensure_ascii=False), encoding="utf-8")


def copy_assets(project_id: str, src: DeckSource, out: Path) -> list[str]:
    """Referenced images under their project path; missing files are skipped."""
    copied: list[str] = []
    root = out.resolve()
    for rel in src.asset_paths():
        source = asset_file(project_id, rel)
        if source is None:
            continue
        dest = (root / rel).resolve()
        if root not in dest.parents:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        copied.append(rel)
    return copied


def deck_title(src: DeckSource, fallback: str) -> str:
    return str(src.deck.get("title") or fallback or "Presentation")[:200]


def write_published_site(
    project_id: str,
    src: DeckSource,
    out: Path,
    bundle: bytes,
    *,
    title: str,
    lang: str,
    badge: bool,
    notes: bool,
) -> dict[str, Any]:
    """The published link: audience page, presenter page, data, images, bundle."""
    out.mkdir(parents=True, exist_ok=True)
    script = bundle_path(bundle)
    (out / script).parent.mkdir(parents=True, exist_ok=True)
    (out / script).write_bytes(bundle)
    write_documents(src, out, notes=notes)
    assets = copy_assets(project_id, src, out)
    csp = deck_csp()
    locale = "fr" if (lang or "").lower().startswith("fr") else "en"
    audience = {
        "mode": "present",
        "badge": badge,
        "notes": notes,
        "base": "./",
        "presenter": "presenter/",
        "locale": locale,
    }
    presenter = {"mode": "presenter", "notes": notes, "base": "../", "locale": locale}
    (out / "index.html").write_text(
        page_html(title=title, lang=lang, config=audience, script_src=script, csp=csp, description=title),
        encoding="utf-8",
    )
    (out / "presenter").mkdir(exist_ok=True)
    (out / "presenter" / "index.html").write_text(
        page_html(
            title=f"{title} · presenter", lang=lang, config=presenter, script_src=f"../{script}", csp=csp
        ).replace("<head>", '<head>\n<meta name="robots" content="noindex" />', 1),
        encoding="utf-8",
    )
    return {"assets": assets, "bundle": script}


def write_print_site(
    project_id: str, src: DeckSource, out: Path, bundle: bytes, *, steps: bool, title: str
) -> str:
    """print.html and what it loads; returns the page name."""
    out.mkdir(parents=True, exist_ok=True)
    script = bundle_path(bundle)
    (out / script).parent.mkdir(parents=True, exist_ok=True)
    (out / script).write_bytes(bundle)
    write_documents(src, out, notes=False)
    copy_assets(project_id, src, out)
    config = {"mode": "print", "steps": steps, "base": "./"}
    (out / "print.html").write_text(
        page_html(title=title, lang="en", config=config, script_src=script, csp=deck_csp()),
        encoding="utf-8",
    )
    return "print.html"


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix.lower() == ".webp":
        mime = "image/webp"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def single_file_html(
    project_id: str,
    src: DeckSource,
    bundle: bytes,
    *,
    title: str,
    lang: str,
    badge: bool,
    notes: bool,
) -> str:
    """One self-contained page: bundle, documents and images inline."""
    assets: dict[str, str] = {}
    total = 0
    for rel in src.asset_paths():
        file = asset_file(project_id, rel)
        if file is None:
            continue
        total += file.stat().st_size
        if total > MAX_INLINE_ASSET_BYTES:
            raise SitesError(
                413,
                "EXPORT_TOO_LARGE",
                "The images of this presentation are too large for a single HTML file.",
            )
        assets[rel] = data_uri(file)
    visible = set(src.visible_ids)
    data = {
        "deck": src.deck,
        "slides": {k: v for k, v in src.slides.items() if k in visible},
        "notes": {k: v for k, v in src.notes.items() if k in visible} if notes else None,
        "design": src.design,
        "assets": assets,
    }
    if data["notes"] is None:
        del data["notes"]
    script = inline_script_text(bundle)
    locale = "fr" if (lang or "").lower().startswith("fr") else "en"
    config = {"mode": "present", "badge": badge, "locale": locale, "presenter": None}
    return page_html(
        title=title,
        lang=lang,
        config=config,
        inline_script=script,
        data=data,
        csp=deck_csp(inline_script=script.encode("utf-8"), offline=True),
    )
