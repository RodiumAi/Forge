"""Fill the image placeholders of a slide.

Free images first: the best Pixabay hit for the slide's search words is
imported into ``public/images/`` (WebP, credited in ``.forge/media.json``, the
same path as the image panel's import). An AI image is generated instead only
when the user explicitly asked for generated images. When neither works the
placeholder element is removed, so a slide never points at a missing file.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any

from app.services import image_bank
from app.services.deck_ai.targeting import Visual, find_element
from app.services.project_media import record_media, save_webp_with_variants

logger = logging.getLogger(__name__)

STOCK_FOLDER = "public/images"


@dataclass
class VisualOutcome:
    slide: dict[str, Any]
    path: str | None = None
    credit: dict[str, Any] | None = None
    #: "stock", "generated" or "removed".
    source: str = "removed"
    error: str | None = None


def _orientation(element: dict[str, Any]) -> str:
    width, height = float(element.get("w") or 1), float(element.get("h") or 1)
    if width > height * 1.2:
        return "horizontal"
    if height > width * 1.2:
        return "vertical"
    return "all"


def _best_hit(hits: list[dict[str, Any]], element: dict[str, Any]) -> dict[str, Any] | None:
    """The hit whose aspect ratio is closest to the frame (Pixabay ranks by relevance)."""
    if not hits:
        return None
    target = float(element.get("w") or 1) / float(element.get("h") or 1)

    def score(item: tuple[int, dict[str, Any]]) -> float:
        rank, hit = item
        ratio = float(hit.get("width") or 1) / float(hit.get("height") or 1)
        return abs(ratio - target) / max(target, 0.1) + rank * 0.05

    return min(enumerate(hits[:8]), key=score)[1]


def _without(slide: dict[str, Any], element_id: str) -> dict[str, Any]:
    def strip(elements: list) -> list:
        out = []
        for element in elements:
            if element.get("id") == element_id:
                continue
            if element.get("type") == "group":
                children = strip(element.get("children") or [])
                if not children:
                    continue
                element = {**element, "children": children}
            out.append(element)
        return out

    return {**slide, "elements": strip(slide.get("elements") or [])}


def _set_image(slide: dict[str, Any], element_id: str, src: str, alt: str, credit: dict | None) -> dict:
    def walk(elements: list) -> list:
        out = []
        for element in elements:
            if element.get("id") == element_id:
                element = {**element, "src": src, "fit": element.get("fit") or "cover"}
                if alt:
                    element["alt"] = alt[:300]
                if credit:
                    element["credit"] = credit
                else:
                    element.pop("credit", None)
            elif element.get("type") == "group":
                element = {**element, "children": walk(element.get("children") or [])}
            out.append(element)
        return out

    return {**slide, "elements": walk(slide.get("elements") or [])}


async def _stock(project_id: str, visual: Visual, element: dict[str, Any], lang: str):
    result = await asyncio.to_thread(
        image_bank.search,
        visual.query,
        orientation=_orientation(element),
        lang=lang,  # type: ignore[arg-type]
    )
    hit = _best_hit(result.get("hits") or [], element)
    if hit is None:
        return None
    raw, meta = await asyncio.to_thread(image_bank.fetch_for_import, str(hit["id"]))
    entry = await asyncio.to_thread(
        save_webp_with_variants, project_id, raw, stem=f"pixabay-{meta.id}", folder=STOCK_FOLDER
    )
    entry.kind = "stock"
    entry.alt = re.sub(r"\s+", " ", meta.tags).strip()[:140]
    record_media(
        project_id,
        entry,
        extra={"credit": {"source": "pixabay", "author": meta.author, "pageUrl": meta.pageUrl}},
    )
    credit: dict[str, Any] = {"source": "pixabay"}
    if meta.author:
        credit["author"] = meta.author[:200]
    if meta.pageUrl.startswith("https://"):
        credit["url"] = meta.pageUrl
    return "public" + entry.path, entry.alt, credit


async def _generated(project_id: str, visual: Visual, element: dict[str, Any], auth, locale: str):
    from app.services.orchestration.images import request_image_bytes

    orientation = _orientation(element)
    size = {"horizontal": "1536x1024", "vertical": "1024x1536"}.get(orientation, "1024x1024")
    raw = await request_image_bytes(auth=auth, prompt=visual.query, size=size, locale=locale)
    stem = "deck-" + (re.sub(r"[^a-z0-9]+", "-", visual.query.lower()).strip("-")[:40] or "visual")
    entry = await asyncio.to_thread(save_webp_with_variants, project_id, raw, stem=stem, folder=STOCK_FOLDER)
    entry.kind = "generated"
    entry.alt = visual.query[:140]
    record_media(project_id, entry)
    return "public" + entry.path, entry.alt, {"source": "generated"}


async def fill_visual(
    *,
    project_id: str,
    slide: dict[str, Any],
    visual: Visual,
    generate: bool = False,
    auth: Any = None,
    lang: str = "en",
    locale: str = "fr",
) -> VisualOutcome:
    """Import (or generate) the picture of ``visual`` into ``slide``."""
    element = find_element(slide.get("elements") or [], visual.element_id)
    if element is None or element.get("type") != "image":
        return VisualOutcome(slide=slide, error="no image element")
    try:
        if generate and auth is not None:
            found = await _generated(project_id, visual, element, auth, locale)
            source = "generated"
        else:
            found = await _stock(project_id, visual, element, lang) if image_bank.is_configured() else None
            source = "stock"
    except Exception as exc:
        # Billing errors of a generated image must reach the user; the rest is
        # a missing picture, never a failed deck.
        from app.services.llm import RodiumError

        if isinstance(exc, RodiumError):
            raise
        logger.warning("deck visual failed for %r", visual.query, exc_info=True)
        return VisualOutcome(slide=_without(slide, visual.element_id), error=str(exc)[:200])
    if found is None:
        return VisualOutcome(slide=_without(slide, visual.element_id), error="no image found")
    path, alt, credit = found
    return VisualOutcome(
        slide=_set_image(slide, visual.element_id, path, alt, credit),
        path=path,
        credit=credit,
        source=source,
    )


def drop_placeholders(slide: dict[str, Any]) -> dict[str, Any]:
    """Remove image elements still pointing at the placeholder."""
    from app.services.deck_ai.layouts import VISUAL_PLACEHOLDER

    out = slide
    for element in list(slide.get("elements") or []):
        if element.get("type") == "image" and element.get("src") == VISUAL_PLACEHOLDER:
            out = _without(out, element["id"])
    return out
