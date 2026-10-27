"""The slide layouts the AI picks from, with their boxes on each format.

Boxes are drawn on the 16:9 canvas (1920 x 1080) and scaled horizontally for
4:3 (1440 x 1080) and 1:1 (1080 x 1080); heights never change. The model gets
the boxes of the chosen layout as a starting grid, and the same boxes build a
plain, always valid slide when the model fails to produce one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.contracts.forge_design import FORMAT_SIZES

BASE_WIDTH = 1920
DEFAULT_LAYOUT = "text"
#: Placeholder ``src`` of an image the visuals step still has to fill.
VISUAL_PLACEHOLDER = "public/images/__visual__.webp"


@dataclass(frozen=True)
class Box:
    id: str
    kind: str  # title | subtitle | body | image | number | quote | caption | chart | table | accent
    x: int
    y: int
    w: int
    h: int
    size: int = 0


LAYOUTS: dict[str, tuple[Box, ...]] = {
    "title": (
        Box("title", "title", 160, 360, 1600, 220, 104),
        Box("subtitle", "subtitle", 160, 600, 1600, 100, 40),
        Box("accent", "accent", 160, 320, 160, 8),
    ),
    "section": (
        Box("number", "number", 160, 300, 400, 160, 120),
        Box("title", "title", 160, 480, 1600, 200, 88),
    ),
    "text": (
        Box("title", "title", 120, 100, 1680, 160, 72),
        Box("body", "body", 120, 320, 1680, 640, 36),
    ),
    "two-columns": (
        Box("title", "title", 120, 100, 1680, 160, 72),
        Box("left", "body", 120, 320, 800, 640, 34),
        Box("right", "body", 1000, 320, 800, 640, 34),
    ),
    "image-text": (
        Box("title", "title", 120, 120, 820, 200, 64),
        Box("body", "body", 120, 360, 820, 600, 34),
        Box("image", "image", 1040, 0, 880, 1080),
    ),
    "quote": (
        Box("quote", "quote", 240, 300, 1440, 400, 64),
        Box("caption", "caption", 240, 740, 1440, 80, 32),
    ),
    "key-numbers": (
        Box("title", "title", 120, 100, 1680, 160, 64),
        Box("n1", "number", 120, 380, 520, 200, 120),
        Box("n2", "number", 700, 380, 520, 200, 120),
        Box("n3", "number", 1280, 380, 520, 200, 120),
        Box("l1", "caption", 120, 600, 520, 120, 30),
        Box("l2", "caption", 700, 600, 520, 120, 30),
        Box("l3", "caption", 1280, 600, 520, 120, 30),
    ),
    "chart": (
        Box("title", "title", 120, 100, 1680, 160, 64),
        Box("chart", "chart", 120, 300, 1100, 680),
        Box("body", "body", 1300, 300, 500, 680, 30),
    ),
    "table": (
        Box("title", "title", 120, 100, 1680, 160, 64),
        Box("table", "table", 120, 300, 1680, 680, 28),
    ),
    "team": (
        Box("title", "title", 120, 100, 1680, 160, 64),
        Box("body", "body", 120, 320, 1680, 640, 32),
    ),
    "timeline": (
        Box("title", "title", 120, 100, 1680, 160, 64),
        Box("line", "accent", 120, 520, 1680, 6),
        Box("body", "body", 120, 580, 1680, 400, 30),
    ),
    "thanks": (
        Box("title", "title", 160, 380, 1600, 200, 104),
        Box("subtitle", "subtitle", 160, 600, 1600, 100, 36),
    ),
}

LAYOUT_NAMES: tuple[str, ...] = tuple(LAYOUTS)


def canvas(ratio: str) -> tuple[int, int]:
    return FORMAT_SIZES.get(ratio, FORMAT_SIZES["16:9"])


#: Names the slides kits used before they matched this list; decks forked from
#: those kits still carry them.
LAYOUT_ALIASES: dict[str, str] = {"key-figures": "key-numbers", "thank-you": "thanks"}


def normalize_layout(name: object) -> str:
    value = str(name or "").strip().lower().replace("_", "-").replace(" ", "-")
    value = LAYOUT_ALIASES.get(value, value)
    return value if value in LAYOUTS else DEFAULT_LAYOUT


def scaled_boxes(layout: str, ratio: str) -> list[Box]:
    width, _ = canvas(ratio)
    sx = width / BASE_WIDTH
    text_scale = 1.0 if sx >= 1 else (0.85 if sx >= 0.7 else 0.7)
    return [
        Box(
            box.id,
            box.kind,
            round(box.x * sx),
            box.y,
            max(1, round(box.w * sx)),
            box.h,
            round(box.size * text_scale) if box.size else 0,
        )
        for box in LAYOUTS[normalize_layout(layout)]
    ]


def describe_layout(layout: str, ratio: str) -> str:
    width, height = canvas(ratio)
    lines = [f"Canvas: {width} x {height} pixels ({ratio}). Layout '{normalize_layout(layout)}' grid:"]
    for box in scaled_boxes(layout, ratio):
        size = f", font size {box.size}" if box.size else ""
        lines.append(f"- {box.id} ({box.kind}): x={box.x} y={box.y} w={box.w} h={box.h}{size}")
    lines.append("Use this grid as a starting point; adjust boxes to the content.")
    return "\n".join(lines)


_ROLE = {"title": "title", "subtitle": "subtitle", "body": "body", "number": "heading", "quote": "quote"}


def _text(box: Box, text: str, *, color: str = "--fg", font: str = "body", weight: int = 400) -> dict:
    return {
        "id": box.id,
        "type": "text",
        "role": _ROLE.get(box.kind, "caption"),
        "x": box.x,
        "y": box.y,
        "w": box.w,
        "h": box.h,
        "content": [{"type": "paragraph", "text": text}],
        "style": {"font": font, "size": box.size or 32, "weight": weight, "color": color, "align": "left"},
    }


def fallback_slide(slide_id: str, layout: str, ratio: str, *, title: str, idea: str) -> dict[str, Any]:
    """A plain slide for ``layout``: the title and the idea, nothing invented."""
    elements: list[dict[str, Any]] = []
    body_used = False
    for box in scaled_boxes(layout, ratio):
        if box.kind == "title":
            elements.append(_text(box, title, font="display", weight=700))
        elif box.kind in ("subtitle", "body", "quote", "caption") and not body_used and idea:
            body_used = True
            elements.append(_text(box, idea, color="--muted" if box.kind != "body" else "--fg"))
        elif box.kind == "accent":
            elements.append(
                {
                    "id": box.id,
                    "type": "shape",
                    "shape": "rect",
                    "x": box.x,
                    "y": box.y,
                    "w": box.w,
                    "h": box.h,
                    "fill": "--accent",
                }
            )
    if not any(element["type"] == "text" and element["role"] == "title" for element in elements):
        width, _ = canvas(ratio)
        elements.insert(0, _text(Box("title", "title", 120, 100, width - 240, 160, 64), title, weight=700))
    return {"id": slide_id, "background": {"type": "color", "token": "--bg"}, "elements": elements}
