"""PPTX export: Chromium reads the layout, node writes the file.

1. ``render.render_deck(kind="layout")`` opens the print page, reads every
   element box and computed style (``src/extract.ts``) and screenshots what
   PowerPoint cannot draw.
2. Images are prepared here with Pillow: the crop and the fit (cover,
   contain, fill) are applied to the pixels so PowerPoint only places a
   picture in a box, and WebP/AVIF become PNG or JPEG.
3. ``runtime/deck/pptx.mjs`` builds the slides with pptxgenjs and adds the
   slide transitions to the XML. It returns warnings (fonts to install,
   elements exported as pictures, transitions approximated).
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
from pathlib import Path
from typing import Any

from app.services.exports.bundle import deck_runtime_dir
from app.services.exports.deck_source import DeckSource, asset_file
from app.services.exports.render import RenderError, render_deck

NODE_TIMEOUT_S = 120.0
_MAX_IMAGE_SIDE = 3840


class PptxError(RuntimeError):
    pass


def fit_box(box: dict, natural: tuple[int, int], fit: str) -> dict:
    """Box actually covered by an image drawn with ``contain`` (centered)."""
    nw, nh = natural
    if fit != "contain" or nw <= 0 or nh <= 0:
        return dict(box)
    scale = min(box["w"] / nw, box["h"] / nh)
    w, h = nw * scale, nh * scale
    return {**box, "x": box["x"] + (box["w"] - w) / 2, "y": box["y"] + (box["h"] - h) / 2, "w": w, "h": h}


def crop_rect(natural: tuple[int, int], box: dict, fit: str, crop: dict | None) -> tuple[int, int, int, int]:
    """Source pixels shown in the box: the crop rectangle, then cover's center crop."""
    nw, nh = natural
    left, top, cw, ch = 0.0, 0.0, float(nw), float(nh)
    if crop:
        left, top = crop["x"] * nw, crop["y"] * nh
        cw, ch = max(1.0, crop["w"] * nw), max(1.0, crop["h"] * nh)
    if fit == "cover" and box["w"] > 0 and box["h"] > 0:
        target = box["w"] / box["h"]
        if cw / ch > target:
            new_w = ch * target
            left += (cw - new_w) / 2
            cw = new_w
        else:
            new_h = cw / target
            top += (ch - new_h) / 2
            ch = new_h
    right, bottom = min(nw, left + cw), min(nh, top + ch)
    return max(0, round(left)), max(0, round(top)), max(1, round(right)), max(1, round(bottom))


def prepare_image(source: Path, item: dict, dest_dir: Path, name: str) -> dict | None:
    """Image with crop and fit applied, as PNG (alpha) or JPEG. None if unreadable."""
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover
        return None
    try:
        with Image.open(source) as img:
            img.load()
            natural = img.size
            fit = item.get("fit") or "cover"
            box = item["box"]
            region = crop_rect(natural, box, fit, item.get("crop"))
            if region != (0, 0, natural[0], natural[1]):
                img = img.crop(region)
            if fit == "contain":
                box = fit_box(box, img.size, "contain")
            if max(img.size) > _MAX_IMAGE_SIDE:
                img.thumbnail((_MAX_IMAGE_SIDE, _MAX_IMAGE_SIDE))
            has_alpha = img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info
            buf = io.BytesIO()
            if has_alpha:
                img.convert("RGBA").save(buf, format="PNG", optimize=True)
                suffix = ".png"
            else:
                img.convert("RGB").save(buf, format="JPEG", quality=88, optimize=True)
                suffix = ".jpg"
    except Exception:
        return None
    target = dest_dir / f"{name}{suffix}"
    target.write_bytes(buf.getvalue())
    return {"path": str(target), "box": {"x": box["x"], "y": box["y"], "w": box["w"], "h": box["h"]}}


async def build_pptx(
    project_id: str,
    src: DeckSource,
    site_dir: Path,
    work_dir: Path,
    *,
    budget_s: float = 150.0,
) -> tuple[bytes, list[dict[str, Any]]]:
    width, height = src.size
    try:
        rendered = await render_deck(
            site_dir, work_dir, kind="layout", width=width, height=height, scale=2.0, budget_s=budget_s
        )
    except RenderError as exc:
        raise PptxError(str(exc)) from exc
    layout = rendered.layout
    if not layout:
        raise PptxError("no layout read from the deck")

    images: dict[str, dict] = {}
    for page in layout.get("slides") or []:
        for item in page.get("items") or []:
            if item.get("kind") != "image":
                continue
            source = asset_file(project_id, str(item.get("src") or ""))
            if source is None:
                continue
            key = f"{page['page']}:{item['id']}"
            prepared = await asyncio.to_thread(
                prepare_image, source, item, work_dir, f"img-{len(images) + 1:04d}"
            )
            if prepared:
                images[key] = prepared

    transitions = {
        ref["id"]: ref.get("transition") for ref in src.deck.get("slides", []) if ref.get("transition")
    }
    payload = {
        "layout": layout,
        "transitions": transitions,
        "notes": src.notes,
        "images": images,
        "rasters": {k: str(work_dir / v) for k, v in rendered.rasters.items()},
        "animated": src.has_animations(),
    }
    out = work_dir / "deck.pptx"
    script = deck_runtime_dir() / "pptx.mjs"
    proc = await asyncio.create_subprocess_exec(
        "node",
        str(script),
        "--out",
        str(out),
        cwd=str(deck_runtime_dir()),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(json.dumps(payload).encode("utf-8")), timeout=NODE_TIMEOUT_S
        )
    except TimeoutError as exc:
        with contextlib.suppress(ProcessLookupError):
            proc.kill()
        raise PptxError("PPTX generation timed out") from exc
    try:
        result = json.loads(stdout.decode("utf-8") or "{}")
    except ValueError:
        result = {}
    if proc.returncode != 0 or not result.get("ok") or not out.is_file():
        detail = result.get("error") or stderr.decode("utf-8", "replace")[-1500:]
        raise PptxError(f"PPTX generation failed: {detail}")
    warnings = [w for w in result.get("warnings") or [] if isinstance(w, dict)]
    return out.read_bytes(), warnings
