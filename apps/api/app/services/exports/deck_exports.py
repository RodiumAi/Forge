"""The four deck export formats, one entry point.

| format | output |
|---|---|
| ``pdf``  | one page per slide (or per animation step) at the canvas size, vector text |
| ``png``  | one image per slide, zipped |
| ``html`` | one self-contained file (player, documents, images), works offline |
| ``pptx`` | native PowerPoint: text boxes, images, shapes, tables, charts, notes, transitions |
"""

from __future__ import annotations

import asyncio
import io
import re
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.errors import SitesError
from app.services.exports.bundle import BundleError, build_player_bundle
from app.services.exports.deck_site import deck_title, single_file_html, write_print_site
from app.services.exports.deck_source import load_deck
from app.services.exports.pptx import PptxError, build_pptx
from app.services.exports.render import RenderError, render_deck

FORMATS = ("pdf", "png", "pptx", "html")
MEDIA_TYPES = {
    "pdf": "application/pdf",
    "png": "application/zip",
    "html": "text/html; charset=utf-8",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
EXTENSIONS = {"pdf": "pdf", "png": "zip", "html": "html", "pptx": "pptx"}
# At most two exports at once per API worker: Chromium is the expensive part.
_export_slots = asyncio.Semaphore(2)


@dataclass
class ExportResult:
    data: bytes
    filename: str
    media_type: str
    warnings: list[dict[str, Any]] = field(default_factory=list)


def safe_filename(name: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.")[:80] or "presentation"
    return f"{base}.{ext}"


def _failed(fmt: str, exc: Exception) -> SitesError:
    return SitesError(500, "EXPORT_FAILED", f"The {fmt.upper()} export failed: {str(exc)[:500]}")


async def export_deck(
    project_id: str,
    fmt: str,
    *,
    name: str,
    lang: str = "en",
    steps: bool = False,
    notes: bool = True,
    badge: bool = False,
) -> ExportResult:
    if fmt not in FORMATS:
        raise SitesError(404, "EXPORT_FORMAT_UNKNOWN", f"Unknown export format {fmt}.")
    src = await asyncio.to_thread(load_deck, project_id, include_notes=notes and fmt in ("html", "pptx"))
    if not src.visible_ids:
        raise SitesError(422, "DECK_EMPTY", "The presentation has no visible slide.")
    title = deck_title(src, name)
    filename = safe_filename(title, EXTENSIONS[fmt])
    async with _export_slots:
        try:
            if fmt == "html":
                bundle = await build_player_bundle(src.icons(), variant="site")
                html = await asyncio.to_thread(
                    single_file_html,
                    project_id,
                    src,
                    bundle,
                    title=title,
                    lang=lang,
                    badge=badge,
                    notes=notes,
                )
                return ExportResult(html.encode("utf-8"), filename, MEDIA_TYPES[fmt])
            bundle = await build_player_bundle(src.icons(), variant="export" if fmt == "pptx" else "site")
            with tempfile.TemporaryDirectory(prefix="forge-deck-export-") as tmp:
                site = Path(tmp) / "site"
                work = Path(tmp) / "out"
                work.mkdir()
                page = await asyncio.to_thread(
                    write_print_site, project_id, src, site, bundle, steps=steps and fmt == "pdf", title=title
                )
                width, height = src.size
                if fmt == "pptx":
                    data, warnings = await build_pptx(project_id, src, site, work)
                    return ExportResult(data, filename, MEDIA_TYPES[fmt], warnings)
                rendered = await render_deck(site, work, kind=fmt, width=width, height=height, page=page)
                if fmt == "pdf":
                    return ExportResult((work / "deck.pdf").read_bytes(), filename, MEDIA_TYPES[fmt])
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for file in rendered.files:
                        zf.write(work / file, arcname=file)
                return ExportResult(buf.getvalue(), filename, MEDIA_TYPES[fmt])
        except SitesError:
            raise
        except (BundleError, RenderError, PptxError, OSError) as exc:
            raise _failed(fmt, exc) from exc
