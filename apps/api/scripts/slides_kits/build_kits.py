"""Build the six reference slides kits into data/templates/slides-<id>/.

usage: python build_kits.py <repo root> <converted images root>
"""
from __future__ import annotations

import base64
import io
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import kitlib  # noqa: E402
from kits_content import KITS  # noqa: E402

REPO = Path(sys.argv[1])
IMAGES = Path(sys.argv[2])
CREDITS = json.loads((IMAGES / "credits.json").read_text(encoding="utf-8"))
LUCIDE = json.loads((REPO / "apps/api/runtime/lucide_exports.json").read_text(encoding="utf-8"))
LUCIDE = LUCIDE if isinstance(LUCIDE, list) else LUCIDE["exports"]
LUCIDE_KEBAB = {re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])", "-", n).lower() for n in LUCIDE}

ROLE_DESC = {
    "bg": "slide background", "surface": "cards, panels and quote slides", "fg": "main text",
    "muted": "secondary text, captions", "accent": "brand accent: bars, numbers, icons",
    "accent-2": "second chart series", "accent-contrast": "text on --accent", "border": "hairlines, table borders",
}
LAYOUT_DESC = {
    "title": "cover: label, title, subtitle, meta",
    "section": "big section number, title and one line",
    "text": "heading, bullet or numbered list, side panel with icon and callout (or code)",
    "two-columns": "heading, two columns each with icon, subheading and paragraph",
    "image-text": "photo on the left half, kicker, heading, paragraph and list on the right",
    "quote": "large quote mark, quote, author and role",
    "key-figures": "heading and three or four figure cards",
    "chart": "heading, editable chart on the left, takeaway on the right",
    "table": "heading and a full width table with a header row",
    "team": "heading and four members (initials avatar, name, role, one line)",
    "timeline": "heading and four milestones on a horizontal line",
    "thank-you": "closing title, subtitle and two contact lines with icons",
}
PRESET_NAMES = {"sober": "Sobre", "dynamic": "Dynamique", "elegant": "Élégant"}
PRESET_DESC = {
    "sober": "fade between slides (500 ms), lists and figures appear one after the other",
    "dynamic": "push to the left between slides (600 ms), titles rise, figures pop",
    "elegant": "morph between slides (800 ms): the accent bar and the title share matchKeys "
               "(`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal",
}


def walk_icons(els):
    for el in els:
        if el["type"] == "icon":
            yield el["icon"]
        if el["type"] == "group":
            yield from walk_icons(el["children"])


def design_md(kit, theme, layouts_map):
    c = theme["colors"]
    f = theme["fonts"]
    lines = [
        f"# Design charter: {theme['name']}",
        "",
        "## Template",
        f"- id: {kit['id']}",
        f"- name: {kit['title']['en']} ({kit['title']['fr']})",
        "- kind: slides",
        "- format: 16:9, 1920 x 1080",
        "",
        "## Colors",
    ]
    for token, value in c.items():
        lines.append(f"- `--{token}`: {value} ({ROLE_DESC[token]})")
    lines += [
        "",
        "## Typography",
        f"- Display font: {f['display']}",
        f"- Body font: {f['body']}",
        f"- Mono font: {f['mono']}",
        f"- Display weight: {theme['display_weight']}",
        "- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,",
        "  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.",
        "- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.",
        "",
        "## Spacing & radius",
        "- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.",
        "- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.",
        f"- Card and panel radius: {theme['radius']} px. Gap between cards: 40 px.",
        "",
        "## Layouts",
        "One example slide per layout; reuse these positions when adding slides.",
    ]
    for layout, sid in layouts_map.items():
        lines.append(f"- {layout} ({sid}): {LAYOUT_DESC[layout]}")
    lines += [
        "",
        "## Transitions",
        f"- Preset: {PRESET_NAMES[theme['preset']]} ({theme['preset']}): {PRESET_DESC[theme['preset']]}.",
        "- The first slide fades in. Keep one transition type for the whole deck.",
        "",
        "## Imagery",
        f"- Style: {theme['imagery']}",
        "- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.",
        "- Pixabay search terms: " + ", ".join(theme["pixabay"]) + ".",
    ]
    for key, alt in kit["images"].items():
        cr = CREDITS[kit["id"]][key]
        lines.append(f"- `public/images/{key}.webp`: {alt}, by {cr['author']} ({cr['url']})")
    lines += [
        "",
        "## Tone",
        kit["tone"].capitalize() + ". One idea per slide, six lines at most, numbers put forward, short sentences.",
        "",
        "## Do / Don't",
        "- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.",
        "- Do keep the accent bar above every heading; it carries the identity.",
        "- Do credit every new image (source, author, page URL) in the element `credit`.",
        "- Don't add a second accent family or more than two fonts plus the mono.",
        "- Don't shrink body text under 22 px; split the slide instead.",
        "- Contact details use the reserved `.example` domain: replace them with real ones.",
    ]
    return "\n".join(lines) + "\n"


def preview_html(kit, theme, hero_path, slide1):
    c = theme["colors"]
    im = Image.open(hero_path).convert("RGB")
    im.thumbnail((480, 480))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=55, method=6)
    data = base64.b64encode(buf.getvalue()).decode()
    title = next(e for e in slide1["elements"] if e["id"].endswith("-title"))["content"][0]["text"]
    label = next(e for e in slide1["elements"] if e["id"].endswith("-label"))["content"][0]["text"]
    sub = next(e for e in slide1["elements"] if e["id"].endswith("-subtitle"))["content"][0]["text"]
    serif = theme["fonts"]["display"] in ("Fraunces", "Playfair Display", "Instrument Serif")
    display_stack = 'Georgia, "Times New Roman", serif' if serif else 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    if theme["hero"] == "full":
        hero_css = (f".hero {{ position: absolute; inset: 0; background: url(data:image/webp;base64,{data}) center/cover; }}\n"
                    f"  .veil {{ position: absolute; inset: 0; background: {c['bg']}; opacity: {theme.get('hero_overlay', 0.6)}; }}\n"
                    "  .text { position: absolute; left: 30px; top: 92px; width: 330px; }")
    else:
        hero_css = (f".hero {{ position: absolute; top: 0; right: 0; bottom: 0; width: 230px; background: url(data:image/webp;base64,{data}) center/cover; }}\n"
                    "  .veil { display: none; }\n"
                    "  .text { position: absolute; left: 30px; top: 92px; width: 200px; }")
    tsize = 26 if len(title) < 30 else 20
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>{kit['title']['en']} preview</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 480px; height: 300px; overflow: hidden; position: relative;
    background: {c['bg']}; color: {c['fg']};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  }}
  {hero_css}
  .bar {{ width: 30px; height: 3px; border-radius: 2px; background: {c['accent']}; margin-bottom: 8px; }}
  .label {{ font-size: 7px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: {c['accent']}; margin-bottom: 8px; }}
  h1 {{ font-family: {display_stack}; font-size: {tsize}px; line-height: 1.05; font-weight: {700 if theme['display_weight'] >= 600 else 400}; letter-spacing: -.01em; }}
  p {{ font-size: 8.5px; line-height: 1.4; margin-top: 10px; opacity: .85; }}
  .count {{ position: absolute; right: 12px; bottom: 10px; font-size: 7px; font-weight: 600;
    color: {c['fg']}; background: {c['surface']}; border: 1px solid {c['border']}; padding: 3px 7px; border-radius: 99px; }}
  .dots {{ position: absolute; left: 30px; bottom: 14px; display: flex; gap: 3px; }}
  .dots i {{ display: block; width: 10px; height: 3px; border-radius: 2px; background: {c['muted']}; opacity: .5; }}
  .dots i:first-child {{ background: {c['accent']}; opacity: 1; }}
</style>
</head>
<body>
  <div class="hero"></div>
  <div class="veil"></div>
  <div class="text">
    <div class="bar"></div>
    <div class="label">{label}</div>
    <h1>{title}</h1>
    <p>{sub}</p>
  </div>
  <div class="dots">{'<i></i>' * len(kit['slides'])}</div>
  <div class="count">{len(kit['slides'])} slides</div>
</body>
</html>
"""


def build(kit):
    theme = dict(kit["theme"])
    theme["images"] = {}
    for key in kit["images"]:
        cr = CREDITS[kit["id"]][key]
        theme["images"][key] = {"file": f"{key}.webp", "author": cr["author"], "url": cr["url"]}
    dest = REPO / "data" / "templates" / kit["id"]
    if dest.exists():
        shutil.rmtree(dest)
    (dest / "slides").mkdir(parents=True)
    (dest / "notes").mkdir()
    shutil.copytree(IMAGES / kit["id"] / "public", dest / "public")

    refs, layouts_map, slides = [], {}, []
    for i, content in enumerate(kit["slides"], start=1):
        sid = f"s{i}"
        layout = content["layout"]
        bg, els = kitlib.LAYOUTS[layout](theme, content, sid, i)
        for name in walk_icons(els):
            assert name in LUCIDE_KEBAB, f"{kit['id']}: unknown lucide icon {name}"
        slide = {"id": sid, "background": bg, "elements": els}
        slides.append(slide)
        (dest / "slides" / f"{sid}.json").write_text(json.dumps(slide, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (dest / "notes" / f"{sid}.md").write_text(content.get("notes", "") + "\n", encoding="utf-8")
        preset = kitlib.PRESETS[theme["preset"]]
        refs.append({"id": sid, "layout": layout, "transition": dict(preset["first" if i == 1 else "transition"])})
        layouts_map.setdefault(layout, sid)

    deck = {"version": 1, "title": kit["deck_title"], "format": {"ratio": "16:9", "width": 1920, "height": 1080},
            "theme": {"designSystem": "local", "tokens": "DESIGN.md"}, "slides": refs}
    (dest / "deck.json").write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (dest / "DESIGN.md").write_text(design_md(kit, theme, layouts_map), encoding="utf-8")
    c = theme["colors"]
    meta = {
        "kind": "slides",
        "id": kit["id"],
        "title": kit["title"],
        "description": kit["description"],
        "tags": kit["tags"],
        "category": kit["category"],
        "preview": "preview.html",
        "bootHint": kit["bootHint"],
        "accent": c["accent"],
        "bg": c["bg"],
        "fg": c["fg"],
        "muted": c["muted"],
        "tone": kit["tone"],
        "fonts": theme["fonts"],
        "transitionPreset": theme["preset"],
        "layouts": layouts_map,
    }
    (dest / "template.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    hero_key = kit["slides"][0]["image"]
    (dest / "preview.html").write_text(
        preview_html(kit, theme, IMAGES / kit["id"] / "public" / "images" / f"{hero_key}.webp", slides[0]),
        encoding="utf-8")
    size = sum(p.stat().st_size for p in dest.rglob("*") if p.is_file())
    print(f"{kit['id']}: {len(slides)} slides, {size / 1024:.0f} KiB")


for kit in KITS:
    build(kit)
for w in kitlib.FIT_WARNINGS:
    print("FIT", w)
