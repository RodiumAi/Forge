"""A small slides project built from the contract fixtures, for export tests.

Slides: a title slide with a click step, ``slide.full`` (every element type)
and ``slide.image-background``. Images are generated with Pillow so no binary
lives in the repository.
"""

from __future__ import annotations

import json
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "forge-design" / "fixtures" / "valid"

DESIGN_MD = """# Acme charter

- Display font: Inter, sans-serif
- Body font: Inter, sans-serif

```css
--bg: #0B0D12;
--fg: #F5F7FA;
--muted: #8B93A7;
--accent: #F2620A;
--surface: #151922;
--border: #2A3140;
```
"""

TITLE_SLIDE = {
    "id": "s1",
    "background": {"type": "color", "token": "--bg"},
    "elements": [
        {
            "id": "t1",
            "type": "text",
            "role": "title",
            "matchKey": "headline",
            "x": 160,
            "y": 300,
            "w": 1120,
            "h": 200,
            "content": [{"type": "paragraph", "text": "Rapport annuel 2026"}],
            "style": {"size": 96, "weight": 700, "color": "--fg"},
        },
        {
            "id": "t2",
            "type": "text",
            "role": "body",
            "x": 160,
            "y": 560,
            "w": 1120,
            "h": 200,
            "content": [
                {"type": "bullet-list", "items": [{"text": "Croissance"}, {"text": "Equipe", "level": 1}]}
            ],
            "animation": {"type": "rise", "trigger": "on-click"},
        },
    ],
}


#: Every element type at a sensible place on a 1440 x 1080 canvas.
CONTENT_SLIDE = {
    "id": "s2",
    "background": {"type": "color", "token": "--surface"},
    "elements": [
        {
            "id": "h",
            "type": "text",
            "role": "heading",
            "matchKey": "headline",
            "x": 80,
            "y": 60,
            "w": 1280,
            "h": 110,
            "content": [
                {
                    "type": "paragraph",
                    "runs": [{"text": "Chiffres "}, {"text": "clefs", "color": "--accent", "italic": True}],
                }
            ],
            "style": {"size": 72, "align": "center"},
        },
        {
            "id": "img",
            "type": "image",
            "x": 80,
            "y": 200,
            "w": 400,
            "h": 300,
            "src": "public/images/hero.webp",
            "fit": "cover",
            "link": "https://example.com/photo",
        },
        {
            "id": "rect",
            "type": "shape",
            "shape": "rect",
            "x": 520,
            "y": 200,
            "w": 200,
            "h": 120,
            "fill": "--accent",
            "radius": 16,
        },
        {
            "id": "dot",
            "type": "shape",
            "shape": "ellipse",
            "x": 760,
            "y": 200,
            "w": 120,
            "h": 120,
            "fill": "#3B82F6",
            "opacity": 0.5,
        },
        {
            "id": "arw",
            "type": "shape",
            "shape": "arrow",
            "x": 920,
            "y": 240,
            "w": 200,
            "h": 40,
            "stroke": "--fg",
            "strokeWidth": 6,
            "rotation": 30,
        },
        {
            "id": "ico",
            "type": "icon",
            "icon": "trending-up",
            "x": 1180,
            "y": 200,
            "w": 120,
            "h": 120,
            "color": "--accent",
        },
        {
            "id": "tbl",
            "type": "table",
            "x": 520,
            "y": 360,
            "w": 840,
            "h": 160,
            "headerRow": True,
            "rows": [[{"text": "Region"}, {"text": "CA"}], [{"text": "Europe"}, {"text": "12 M"}]],
            "style": {"size": 28},
        },
        {
            "id": "chart",
            "type": "chart",
            "chart": "bar",
            "x": 80,
            "y": 560,
            "w": 640,
            "h": 420,
            "data": {
                "labels": ["2024", "2025", "2026"],
                "series": [
                    {"name": "CA", "values": [1.2, 2.5, 4]},
                    {"name": "Marge", "values": [0.3, 0.6, 1.1]},
                ],
            },
            "options": {"legend": True, "values": True},
        },
        {
            "id": "pie",
            "type": "chart",
            "chart": "pie",
            "x": 760,
            "y": 560,
            "w": 280,
            "h": 280,
            "data": {"labels": ["A", "B", "C"], "series": [{"name": "Parts", "values": [50, 30, 20]}]},
        },
        {
            "id": "code",
            "type": "code",
            "x": 1060,
            "y": 560,
            "w": 300,
            "h": 160,
            "language": "python",
            "code": "def f(x):\n    return x * 2\n",
            "highlight": "2",
            "size": 20,
        },
        {
            "id": "vid",
            "type": "video",
            "x": 1060,
            "y": 760,
            "w": 300,
            "h": 170,
            "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "poster": "public/images/poster.webp",
        },
        {
            "id": "grp",
            "type": "group",
            "x": 760,
            "y": 880,
            "w": 280,
            "h": 120,
            "children": [
                {
                    "id": "gtext",
                    "type": "text",
                    "x": 0,
                    "y": 0,
                    "w": 280,
                    "h": 60,
                    "content": [{"type": "paragraph", "text": "Groupe"}],
                    "style": {"size": 32},
                },
                {
                    "id": "gline",
                    "type": "shape",
                    "shape": "line",
                    "x": 0,
                    "y": 80,
                    "w": 280,
                    "h": 20,
                    "stroke": "--muted",
                    "strokeWidth": 4,
                },
            ],
        },
    ],
}


def _image(path: Path, size: tuple[int, int], color: tuple[int, int, int]) -> None:
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, color).save(path, format="WEBP")


def build_deck_project(root: Path, *, ratio: str = "4:3") -> Path:
    """Write the project under ``root`` and return it."""
    root.mkdir(parents=True, exist_ok=True)
    deck = json.loads((FIXTURES / "deck.full.json").read_text(encoding="utf-8"))
    deck["slides"] = [
        {"id": "s1", "layout": "title", "transition": {"type": "fade", "durationMs": 500}},
        {"id": "s2", "layout": "two-columns", "transition": {"type": "morph", "durationMs": 800}},
        {"id": "s3", "layout": "key-numbers", "transition": {"type": "push", "direction": "left"}},
        {"id": "s4", "layout": "image", "transition": {"type": "cube"}},
        {"id": "s5", "layout": "thanks", "hidden": True},
    ]
    if ratio == "16:9":
        deck["format"] = {"ratio": "16:9", "width": 1920, "height": 1080}
    (root / "deck.json").write_text(json.dumps(deck), encoding="utf-8")
    slides = root / "slides"
    slides.mkdir(exist_ok=True)
    (slides / "s1.json").write_text(json.dumps(TITLE_SLIDE), encoding="utf-8")
    (slides / "s2.json").write_text(json.dumps(CONTENT_SLIDE), encoding="utf-8")
    # The contract's "every field" slide: overlapping and overflowing on purpose.
    full = json.loads((FIXTURES / "slide.full.json").read_text(encoding="utf-8"))
    full["id"] = "s3"
    (slides / "s3.json").write_text(json.dumps(full), encoding="utf-8")
    bg = json.loads((FIXTURES / "slide.image-background.json").read_text(encoding="utf-8"))
    bg["id"] = "s4"
    (slides / "s4.json").write_text(json.dumps(bg), encoding="utf-8")
    (slides / "s5.json").write_text(json.dumps({"id": "s5", "elements": []}), encoding="utf-8")
    notes = root / "notes"
    notes.mkdir(exist_ok=True)
    (notes / "s1.md").write_text("Saluer le public.", encoding="utf-8")
    (notes / "s2.md").write_text("Montrer le graphique.", encoding="utf-8")
    (root / "DESIGN.md").write_text(DESIGN_MD, encoding="utf-8")
    _image(root / "public" / "images" / "hero.webp", (800, 600), (40, 120, 200))
    _image(root / "public" / "images" / "poster.webp", (640, 360), (20, 20, 20))
    _image(root / "public" / "images" / "bg.webp", (1600, 900), (90, 30, 120))
    return root
