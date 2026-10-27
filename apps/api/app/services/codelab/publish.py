"""Static site of a published codelab (publish mode ``codelab_player``).

The published page is the Forge codelab player (bundled once from
``apps/web/components/codelab-player`` into ``runtime/codelab/dist`` by
``apps/api/runtime/codelab/build.mjs``) plus the codelab data:

    index.html                  shell, metadata, noscript summary
    codelab-data.json           codelab.json, every step, DESIGN.md, downloads
    assets/codelab/...          player bundle (hashed, cached forever)
    public/...                  images of the steps
    files/...                   downloadable files
    downloads/<id>.zip          declared downloads with ``zip: true``

No server code runs for a published codelab: it is plain files on the site
bucket, like a published site.
"""

from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from app.services.codelab.exports import read_settings
from app.services.codelab.files import list_files, zip_folder
from app.services.codelab.store import read_all_steps, read_codelab
from app.services.document_scaffold import DESIGN_MD_PATH
from app.services.filesystem import project_dir, read_file

DATA_FILE = "codelab-data.json"
ASSETS_DIR = "assets/codelab"


class CodelabBundleMissing(RuntimeError):
    """The player bundle was not built into runtime/codelab/dist."""


def bundle_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "runtime" / "codelab" / "dist"


def bundle_entry() -> str:
    """File name of the player entry, from the manifest the build writes."""
    manifest = bundle_dir() / "manifest.json"
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        entry = str(data["entry"])
    except (OSError, ValueError, KeyError) as exc:
        raise CodelabBundleMissing(
            "The codelab player bundle is missing: run `npm run build:codelab-player` in apps/web."
        ) from exc
    if not re.match(r"^[A-Za-z0-9_.-]+\.js$", entry) or not (bundle_dir() / entry).is_file():
        raise CodelabBundleMissing("The codelab player bundle manifest is invalid.")
    return entry


_GENERIC_FONTS = {
    "serif",
    "sans-serif",
    "monospace",
    "system-ui",
    "ui-monospace",
    "ui-sans-serif",
    "ui-serif",
    "inter",  # served by the system stack fallback when absent
}


def font_families(design_md: str) -> list[str]:
    """Google Fonts families named by the charter (display, body, mono)."""
    found: list[str] = []
    patterns = (
        r"^\s*[-*]?\s*(?:display|body|mono|heading|code)(?:\s+font)?\s*:\s*(.+)$",
        r"^\s*[-*]?\s*(?:display|body|mono)\s+font\s*:\s*(.+)$",
        r"--font-(?:display|body|mono)`?\s*:\s*(.+)$",
    )
    for line in (design_md or "").splitlines():
        for pattern in patterns:
            match = re.match(pattern, line, re.I)
            if not match:
                continue
            first = match.group(1).split(",")[0].strip().strip("`'\"").strip()
            first = re.sub(r"\s*\(.*$", "", first).strip()
            valid = first and first.lower() not in _GENERIC_FONTS and re.match(r"^[A-Za-z0-9 ]{2,60}$", first)
            if valid and first not in found:
                found.append(first)
            break
    return found[:3]


def fonts_link(families: list[str]) -> str:
    if not families:
        return ""
    query = "&".join(f"family={quote_plus(name)}:wght@400;600;700" for name in families)
    return (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{query}&display=swap">'
    )


CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; "
    "base-uri 'self'; form-action 'none'"
)


def index_html(
    *,
    codelab: dict[str, Any],
    titles: list[str],
    entry: str,
    site_url: str,
    lang: str,
    design_md: str,
) -> str:
    esc = html.escape
    title = codelab.get("title") or "Codelab"
    summary = (codelab.get("summary") or "").strip()
    steps = "".join(f"<li>{esc(t)}</li>" for t in titles)
    return f"""<!doctype html>
<html lang="{esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{esc(CSP)}">
<title>{esc(title)}</title>
<meta name="description" content="{esc(summary[:300])}">
<link rel="canonical" href="{esc(site_url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(summary[:300])}">
<meta property="og:url" content="{esc(site_url)}">
{fonts_link(font_families(design_md))}
<style>html,body{{margin:0;padding:0;min-height:100%}}</style>
</head>
<body>
<div id="codelab-root" data-src="{DATA_FILE}"></div>
<noscript>
<main style="max-width:760px;margin:40px auto;padding:0 16px;font-family:system-ui,sans-serif">
<h1>{esc(title)}</h1>
<p>{esc(summary)}</p>
<ol>{steps}</ol>
</main>
</noscript>
<script type="module" src="{ASSETS_DIR}/{esc(entry)}"></script>
</body>
</html>
"""


def _copy_tree(src: Path, dest: Path) -> int:
    if not src.is_dir():
        return 0
    count = 0
    for path in src.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(src)
        if any(part.startswith(".") for part in rel.parts):
            continue
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        count += 1
    return count


def _step_titles(codelab: dict[str, Any], steps: dict[str, str]) -> list[str]:
    titles = []
    for step in codelab.get("steps") or []:
        title = step.get("title")
        if not title:
            match = re.search(r"^#\s+(.+)$", steps.get(step["id"], ""), re.M)
            title = match.group(1).strip() if match else step["id"]
        titles.append(title)
    return titles


def build_downloads(project_id: str, codelab: dict[str, Any], out: Path) -> list[dict[str, Any]]:
    """Pack the declared downloads; plain files keep their path under files/."""
    sizes = {item.path: item.size for item in list_files(project_id)}
    result: list[dict[str, Any]] = []
    for item in codelab.get("downloads") or []:
        entry: dict[str, Any] = {k: item[k] for k in ("id", "label", "path") if k in item}
        if item.get("zip"):
            try:
                data = zip_folder(project_id, item["path"])
            except Exception:
                # A declared download whose folder is gone: listed, not linked.
                result.append({**entry, "zip": True})
                continue
            target = out / "downloads" / f"{item['id']}.zip"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            entry.update(
                zip=True, url=f"downloads/{item['id']}.zip", size=len(data), name=f"{item['id']}.zip"
            )
        elif item["path"] in sizes:
            entry.update(url=item["path"], size=sizes[item["path"]], name=item["path"].rsplit("/", 1)[-1])
        result.append(entry)
    return result


def build_codelab_site(
    project_id: str,
    out: Path,
    *,
    site_url: str,
    lang: str = "fr",
    badge: bool = True,
    public_url: str | None = None,
) -> dict[str, Any]:
    """Write the static codelab site into ``out``; returns a build summary.

    ``public_url`` is the address the cover's QR code points to: the site
    URL when publishing, the live URL (or nothing) for the PDF export.
    """
    entry = bundle_entry()
    codelab = read_codelab(project_id)
    steps = read_all_steps(project_id, codelab)
    try:
        design_md = read_file(project_id, DESIGN_MD_PATH)
    except FileNotFoundError:
        design_md = ""
    root = project_dir(project_id)
    _copy_tree(bundle_dir(), out / ASSETS_DIR)
    _copy_tree(root / "public", out / "public")
    _copy_tree(root / "files", out / "files")
    downloads = build_downloads(project_id, codelab, out)
    settings = read_settings(project_id)
    data = {
        "version": 1,
        "codelab": codelab,
        "steps": steps,
        "design": design_md,
        "downloads": downloads,
        "feedbackUrl": settings.get("feedbackUrl"),
        "badge": badge,
        "locale": lang,
        "publicUrl": public_url,
    }
    (out / DATA_FILE).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    titles = _step_titles(codelab, steps)
    (out / "index.html").write_text(
        index_html(
            codelab=codelab, titles=titles, entry=entry, site_url=site_url, lang=lang, design_md=design_md
        ),
        encoding="utf-8",
    )
    return {"mode": "codelab_player", "steps": len(titles), "downloads": len(downloads)}


async def publish_codelab_player(
    project_id: str, slug: str, *, site_url: str, lang: str, badge: bool
) -> dict:
    """Publish mode ``codelab_player``: build the static site, upload it under ``{slug}/``."""
    import asyncio
    import tempfile

    from app.services.publish_esm import upload_site_dir

    with tempfile.TemporaryDirectory(prefix="forge-codelab-") as tmp:
        out = Path(tmp) / "dist"
        out.mkdir(parents=True, exist_ok=True)
        build = await asyncio.to_thread(
            build_codelab_site,
            project_id,
            out,
            site_url=site_url,
            lang=lang,
            badge=badge,
            public_url=site_url,
        )
        uploaded, orphans = await upload_site_dir(out, slug)
    return {
        "public_url": site_url,
        "files_uploaded": uploaded,
        "orphans_deleted": orphans,
        "build_mode": build.get("mode"),
        "routes": ["/"],
        "prerendered": False,
        "lang": lang,
    }
