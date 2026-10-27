"""Layout builders for Forge slides kits (1920 x 1080 canvas).

Each builder returns (background, elements) for one layout from a theme and a
content dict. Positions follow docs/templates/slides-style-guide.md.
"""
from __future__ import annotations

import math

W, H, M = 1920, 1080, 140
CONTENT_W = W - 2 * M

FIT_WARNINGS: list[str] = []


def _blocks(value):
    if isinstance(value, str):
        return [{"type": "paragraph", "text": value}]
    return value


def _fit(eid, blocks, w, h, size, lh):
    # Rough check: average glyph width ~0.53 em.
    per_line = max(1, int(w / (size * 0.53)))
    lines = 0
    for b in blocks:
        texts = [b.get("text", "")] if b["type"] == "paragraph" else [i.get("text", "") for i in b["items"]]
        for t in texts:
            lines += max(1, math.ceil(len(t) / per_line))
    need = lines * size * lh
    if need > h * 1.02:
        FIT_WARNINGS.append(f"{eid}: needs ~{need:.0f}px, box {h}px")


def text(eid, x, y, w, h, value, *, role="body", font="body", size=32, weight=400, color="--fg",
         align="left", valign=None, lh=1.3, ls=None, upper=None, italic=None, anim=None, z=3,
         match=None, opacity=None):
    blocks = _blocks(value)
    style = {"font": font, "size": size, "weight": weight, "color": color, "align": align, "lineHeight": lh}
    if valign:
        style["valign"] = valign
    if ls is not None:
        style["letterSpacing"] = ls
    if upper:
        style["uppercase"] = True
    if italic:
        style["italic"] = True
    el = {"id": eid, "type": "text", "role": role, "x": x, "y": y, "w": w, "h": h, "z": z}
    if opacity is not None:
        el["opacity"] = opacity
    if match:
        el["matchKey"] = match
    el["content"] = blocks
    el["style"] = style
    if anim:
        el["animation"] = anim
    _fit(eid, blocks, w * (0.5 if role == "label" and False else 1), h, size, lh)
    return el


def shape(eid, x, y, w, h, kind="rect", *, fill=None, stroke=None, sw=None, radius=None, z=1,
          match=None, anim=None, opacity=None):
    el = {"id": eid, "type": "shape", "x": x, "y": y, "w": w, "h": h, "z": z, "shape": kind}
    if fill:
        el["fill"] = fill
    if stroke:
        el["stroke"] = stroke
    if sw is not None:
        el["strokeWidth"] = sw
    if radius is not None:
        el["radius"] = radius
    if match:
        el["matchKey"] = match
    if opacity is not None:
        el["opacity"] = opacity
    if anim:
        el["animation"] = anim
    return el


def icon(eid, x, y, size, name, color="--accent", z=3, anim=None):
    el = {"id": eid, "type": "icon", "x": x, "y": y, "w": size, "h": size, "z": z, "icon": name,
          "color": color, "strokeWidth": 1.75}
    if anim:
        el["animation"] = anim
    return el


def image(eid, x, y, w, h, img, alt, *, radius=None, z=1, anim=None, match=None):
    el = {"id": eid, "type": "image", "x": x, "y": y, "w": w, "h": h, "z": z,
          "src": f"public/images/{img['file']}", "alt": alt, "fit": "cover"}
    if radius:
        el["radius"] = radius
    if match:
        el["matchKey"] = match
    el["credit"] = credit(img)
    if anim:
        el["animation"] = anim
    return el


def credit(img):
    return {"source": "pixabay", "author": img["author"], "url": img["url"]}


def image_bg(img, overlay="--bg", opacity=0.7):
    return {"type": "image", "src": f"public/images/{img['file']}", "fit": "cover", "overlay": overlay,
            "overlayOpacity": opacity, "credit": credit(img)}


def color_bg(token="--bg"):
    return {"type": "color", "token": token}


def gradient_bg(a, b, angle=135):
    return {"type": "gradient", "angle": angle, "stops": [{"color": a, "at": 0}, {"color": b, "at": 1}]}


# ── animation presets ──────────────────────────────────────────────────────

PRESETS = {
    # "Sobre": fades only, content appears with the slide.
    "sober": {
        "transition": {"type": "fade", "durationMs": 500, "easing": "ease-in-out"},
        "first": {"type": "fade", "durationMs": 500, "easing": "ease-in-out"},
        "title": None,
        "body": None,
        "step": {"type": "appear", "trigger": "after-previous", "durationMs": 300},
        "figure": {"type": "appear", "trigger": "after-previous", "durationMs": 300},
    },
    # "Dynamique": push between slides, content rises.
    "dynamic": {
        "transition": {"type": "push", "direction": "left", "durationMs": 600, "easing": "ease-out"},
        "first": {"type": "fade", "durationMs": 600, "easing": "ease-out"},
        "title": {"type": "rise", "trigger": "on-enter", "durationMs": 500},
        "body": {"type": "rise", "trigger": "after-previous", "delayMs": 80, "durationMs": 450},
        "step": {"type": "rise", "trigger": "after-previous", "delayMs": 60, "durationMs": 400},
        "figure": {"type": "pop", "trigger": "after-previous", "delayMs": 60, "durationMs": 400},
    },
    # "Elegant": morph between slides (shared matchKeys), titles revealed by a mask.
    "elegant": {
        "transition": {"type": "morph", "durationMs": 800, "easing": "ease-in-out"},
        "first": {"type": "fade", "durationMs": 700, "easing": "ease-in-out"},
        "title": {"type": "mask-reveal", "trigger": "on-enter", "direction": "up", "durationMs": 700},
        "body": {"type": "appear", "trigger": "after-previous", "delayMs": 120, "durationMs": 500},
        "step": {"type": "appear", "trigger": "after-previous", "delayMs": 80, "durationMs": 400},
        "figure": {"type": "appear", "trigger": "after-previous", "delayMs": 80, "durationMs": 400},
    },
}


def anim(theme, kind, order=None):
    base = PRESETS[theme["preset"]][kind]
    if base is None:
        return None
    out = dict(base)
    if order is not None:
        out["order"] = order
    return out


# ── shared chrome ──────────────────────────────────────────────────────────


def header(t, c, sid):
    els = [
        shape(f"{sid}-bar", M, 100, 80, 8, fill="--accent", radius=4, match="accent-bar", z=2),
        text(f"{sid}-kicker", M, 126, 1200, 44, c["kicker"], role="label", size=24, weight=600,
             color="--accent", ls=3, upper=True, lh=1.4),
        text(f"{sid}-heading", M, 176, CONTENT_W, 140, c["heading"], role="heading", font="display",
             size=64, weight=t["display_weight"], lh=1.1, match="slide-title", anim=anim(t, "title")),
    ]
    return els


def footer(t, sid, number):
    return [
        text(f"{sid}-footer", M, 1000, 1100, 40, t["footer"], role="caption", size=20, color="--muted", lh=1.4),
        text(f"{sid}-page", W - M - 120, 1000, 120, 40, f"{number:02d}", role="caption", size=20,
             color="--muted", align="right", lh=1.4),
    ]


# ── layouts ────────────────────────────────────────────────────────────────


def title(t, c, sid, n):
    img = t["images"][c["image"]]
    contrast = "--fg"
    if t["hero"] == "full":
        bg = image_bg(img, "--bg", t.get("hero_overlay", 0.62))
        x, w = M, 1500
        els = []
    else:
        bg = color_bg("--bg")
        x, w = M, 820
        els = [image(f"{sid}-image", 1000, 0, 920, H, img, c["alt"], z=1, match="hero-image")]
    els += [
        shape(f"{sid}-bar", x, 300, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
        text(f"{sid}-label", x, 336, w, 48, c["label"], role="label", size=26, weight=600, color="--accent",
             ls=3, upper=True, lh=1.4),
        text(f"{sid}-title", x, 396, w, 300, c["title"], role="title", font="display",
             size=c.get("size", 100), weight=t["display_weight"], color=contrast, lh=1.05, ls=-1,
             match="slide-title", anim=anim(t, "title")),
        text(f"{sid}-subtitle", x, 720, w, 130, c["subtitle"], role="subtitle", size=34, color=contrast,
             opacity=0.86, lh=1.35, anim=anim(t, "body")),
        text(f"{sid}-meta", x, 930, w, 44, c["meta"], role="caption", size=24, weight=500, color="--muted", lh=1.4),
    ]
    return bg, els


def section(t, c, sid, n):
    if c.get("image"):
        bg = image_bg(t["images"][c["image"]], "--bg", t.get("section_overlay", 0.78))
    else:
        bg = color_bg("--surface")
    els = [
        text(f"{sid}-number", M, 250, 600, 240, c["number"], role="label", font="display", size=200,
             weight=t["display_weight"], color="--accent", lh=1.1, anim=anim(t, "title")),
        shape(f"{sid}-bar", M, 510, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
        text(f"{sid}-title", M, 550, 1500, 200, c["title"], role="title", font="display", size=88,
             weight=t["display_weight"], lh=1.1, match="slide-title", anim=anim(t, "body")),
        text(f"{sid}-subtitle", M, 770, 1400, 100, c["subtitle"], role="subtitle", size=34, color="--muted",
             lh=1.35, anim=anim(t, "body")),
    ]
    return bg, els


def text_layout(t, c, sid, n):
    els = header(t, c, sid)
    els.append(text(f"{sid}-body", M, 360, 1060, 560, [{"type": c.get("list", "bullet-list"),
                    "items": [{"text": i} for i in c["items"]]}], size=34, lh=1.55, anim=anim(t, "body")))
    els.append(shape(f"{sid}-panel", 1300, 360, 480, 560, fill="--surface", stroke="--border", sw=1,
                     radius=t["radius"], z=1))
    if c.get("code"):
        els.append({"id": f"{sid}-code", "type": "code", "x": 1330, "y": 390, "w": 420, "h": 500, "z": 3,
                    "language": c["code_lang"], "code": c["code"], "lineNumbers": True, "size": 22,
                    **({"animation": anim(t, "body")} if anim(t, "body") else {})})
    else:
        els.append(icon(f"{sid}-icon", 1360, 420, 72, c["icon"]))
        els.append(text(f"{sid}-callout", 1360, 530, 360, 340, c["callout"], size=30, lh=1.45,
                        anim=anim(t, "body")))
    return color_bg("--bg"), els + footer(t, sid, n)


def two_columns(t, c, sid, n):
    els = header(t, c, sid)
    for i, col in enumerate(c["columns"]):
        x = M + i * 860
        els += [
            icon(f"{sid}-icon{i+1}", x, 380, 64, col["icon"], anim=anim(t, "step", i * 2)),
            text(f"{sid}-col{i+1}-title", x, 470, 780, 64, col["title"], role="heading", font="display",
                 size=40, weight=t["display_weight"], lh=1.2),
            text(f"{sid}-col{i+1}-body", x, 548, 760, 320, col["body"], size=30, color="--muted", lh=1.5,
                 anim=anim(t, "step", i * 2 + 1)),
        ]
    els.append(shape(f"{sid}-divider", 950, 380, 2, 460, fill="--border", z=1))
    return color_bg("--bg"), els + footer(t, sid, n)


def image_text(t, c, sid, n):
    img = t["images"][c["image"]]
    els = [
        image(f"{sid}-image", 0, 0, 880, H, img, c["alt"], match="hero-image"),
        shape(f"{sid}-bar", 1000, 180, 80, 8, fill="--accent", radius=4, match="accent-bar", z=2),
        text(f"{sid}-kicker", 1000, 206, 780, 44, c["kicker"], role="label", size=24, weight=600,
             color="--accent", ls=3, upper=True, lh=1.4),
        text(f"{sid}-heading", 1000, 256, 780, 210, c["heading"], role="heading", font="display", size=60,
             weight=t["display_weight"], lh=1.1, match="slide-title", anim=anim(t, "title")),
        text(f"{sid}-body", 1000, 490, 780, 180, c["body"], size=30, color="--muted", lh=1.5,
             anim=anim(t, "body")),
        text(f"{sid}-list", 1000, 690, 780, 250, [{"type": "bullet-list", "items": [{"text": i} for i in c["items"]]}],
             size=28, lh=1.55, anim=anim(t, "body")),
        text(f"{sid}-page", W - M - 120, 1000, 120, 40, f"{n:02d}", role="caption", size=20,
             color="--muted", align="right", lh=1.4),
    ]
    return color_bg("--bg"), els


def quote(t, c, sid, n):
    bg = color_bg("--surface") if not c.get("gradient") else gradient_bg("--surface", "--bg")
    els = [
        text(f"{sid}-mark", M, 120, 300, 240, "«", role="label", font="display", size=240,
             weight=t["display_weight"], color="--accent", lh=1.0),
        text(f"{sid}-quote", M, 370, 1500, 380, c["quote"], role="quote", font="display", size=c.get("size", 56),
             weight=t.get("quote_weight", 400), italic=t.get("quote_italic", True), lh=1.3,
             match="slide-title", anim=anim(t, "title")),
        shape(f"{sid}-bar", M, 790, 80, 8, fill="--accent", radius=4, match="accent-bar", z=2),
        text(f"{sid}-author", M, 820, 1200, 50, c["author"], role="caption", size=30, weight=700, lh=1.3,
             anim=anim(t, "body")),
        text(f"{sid}-role", M, 874, 1200, 44, c["role"], role="caption", size=24, color="--muted", lh=1.4),
    ]
    return bg, els + footer(t, sid, n)


def key_figures(t, c, sid, n):
    els = header(t, c, sid)
    figs = c["figures"]
    gap = 40
    cw = (CONTENT_W - gap * (len(figs) - 1)) / len(figs)
    num_size = 76 if len(figs) == 4 else 100
    for i, f in enumerate(figs):
        x = round(M + i * (cw + gap))
        a = anim(t, "figure", i)
        els += [
            shape(f"{sid}-card{i+1}", x, 380, round(cw), 460, fill="--surface", stroke="--border", sw=1,
                  radius=t["radius"], z=1, anim=a),
            text(f"{sid}-value{i+1}", x + 40, 420, round(cw) - 80, 150, f["value"], role="heading", font="display",
                 size=num_size, weight=t["display_weight"], color="--accent", lh=1.1, ls=-1, anim=a),
            text(f"{sid}-label{i+1}", x + 40, 600, round(cw) - 80, 90, f["label"], role="body", size=30,
                 weight=600, lh=1.3, anim=a),
            text(f"{sid}-detail{i+1}", x + 40, 700, round(cw) - 80, 110, f["detail"], role="caption", size=24,
                 color="--muted", lh=1.4, anim=a),
        ]
    return color_bg("--bg"), els + footer(t, sid, n)


def chart(t, c, sid, n):
    els = header(t, c, sid)
    colors = ["--accent", "--accent-2", "--muted"]
    series = [dict(s, color=s.get("color", colors[i % 3])) for i, s in enumerate(c["series"])]
    if c["chart"] == "pie":
        series = [{k: v for k, v in s.items() if k != "color"} for s in series]
    el = {"id": f"{sid}-chart", "type": "chart", "x": M, "y": 350, "w": 1080, "h": 600, "z": 2,
          "chart": c["chart"], "data": {"labels": c["labels"], "series": series},
          "options": {"legend": len(series) > 1 or c["chart"] == "pie", "values": c.get("values", True)}}
    a = anim(t, "body")
    if a:
        el["animation"] = a
    els.append(el)
    els += [
        icon(f"{sid}-icon", 1320, 380, 56, c["icon"]),
        text(f"{sid}-takeaway", 1320, 460, 460, 130, c["takeaway"], role="heading", font="display", size=40,
             weight=t["display_weight"], lh=1.2, anim=anim(t, "step", 1)),
        text(f"{sid}-comment", 1320, 610, 460, 300, c["comment"], size=26, color="--muted", lh=1.5,
             anim=anim(t, "step", 2)),
    ]
    return color_bg("--bg"), els + footer(t, sid, n)


def table(t, c, sid, n):
    els = header(t, c, sid)
    rows = [[{"text": cell} for cell in row] for row in c["rows"]]
    el = {"id": f"{sid}-table", "type": "table", "x": M, "y": 360, "w": CONTENT_W, "h": 110 * len(rows) - 20,
          "z": 2, "rows": rows, "headerRow": True, "style": {"size": 28, "color": "--fg", "headerFill": "--surface",
                                                               "border": "--border"}}
    if c.get("widths"):
        el["columnWidths"] = c["widths"]
    a = anim(t, "body")
    if a:
        el["animation"] = a
    els.append(el)
    return color_bg("--bg"), els + footer(t, sid, n)


def team(t, c, sid, n):
    els = header(t, c, sid)
    people = c["people"]
    gap = 40
    cw = (CONTENT_W - gap * (len(people) - 1)) / len(people)
    for i, p in enumerate(people):
        x = M + i * (cw + gap)
        cx = x + cw / 2
        a = anim(t, "step", i)
        initials = "".join(w[0] for w in p["name"].replace("-", " ").split()[:2]).upper()
        els += [
            shape(f"{sid}-avatar{i+1}", round(cx - 100), 370, 200, 200, "ellipse", fill="--surface",
                  stroke="--accent", sw=4, z=1, anim=a),
            text(f"{sid}-initials{i+1}", round(cx - 100), 370, 200, 200, initials, role="label", font="display",
                 size=64, weight=t["display_weight"], color="--accent", align="center", valign="middle", lh=1.0,
                 anim=a),
            text(f"{sid}-name{i+1}", round(x), 600, round(cw), 50, p["name"], role="heading", size=32, weight=700,
                 align="center", lh=1.3, anim=a),
            text(f"{sid}-role{i+1}", round(x), 656, round(cw), 44, p["role"], role="caption", size=24,
                 weight=600, color="--accent", align="center", lh=1.4, anim=a),
            text(f"{sid}-bio{i+1}", round(x) + 10, 710, round(cw) - 20, 110, p["bio"], role="caption", size=22,
                 color="--muted", align="center", lh=1.45, anim=a),
        ]
    return color_bg("--bg"), els + footer(t, sid, n)


def timeline(t, c, sid, n):
    els = header(t, c, sid)
    steps = c["steps"]
    els.append(shape(f"{sid}-line", M, 598, CONTENT_W, 4, fill="--border", z=1))
    seg = CONTENT_W / len(steps)
    for i, s in enumerate(steps):
        cx = M + seg * i + seg / 2
        a = anim(t, "step", i)
        els += [
            text(f"{sid}-date{i+1}", round(cx - seg / 2 + 10), 500, round(seg) - 20, 56, s["date"], role="label",
                 font="display", size=34, weight=t["display_weight"], color="--accent", align="center", lh=1.3,
                 anim=a),
            shape(f"{sid}-dot{i+1}", round(cx - 16), 584, 32, 32, "ellipse", fill="--accent", stroke="--bg", sw=6,
                  z=2, anim=a),
            text(f"{sid}-step{i+1}", round(cx - seg / 2 + 10), 650, round(seg) - 20, 50, s["title"], role="heading",
                 size=30, weight=700, align="center", lh=1.3, anim=a),
            text(f"{sid}-desc{i+1}", round(cx - seg / 2 + 20), 706, round(seg) - 40, 110, s["desc"], role="caption",
                 size=24, color="--muted", align="center", lh=1.45, anim=a),
        ]
    return color_bg("--bg"), els + footer(t, sid, n)


def thank_you(t, c, sid, n):
    if c.get("image"):
        bg = image_bg(t["images"][c["image"]], "--bg", c.get("overlay", 0.82))
    else:
        bg = gradient_bg("--bg", "--surface", 135)
    els = [
        shape(f"{sid}-bar", M, 260, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
        text(f"{sid}-title", M, 300, 1640, 230, c["title"], role="title", font="display", size=c.get("size", 150),
             weight=t["display_weight"], lh=1.05, ls=-2, match="slide-title", anim=anim(t, "title")),
        text(f"{sid}-subtitle", M, 550, 1400, 110, c["subtitle"], role="subtitle", size=38, color="--muted",
             lh=1.35, anim=anim(t, "body")),
    ]
    for i, (ic, line) in enumerate(c["contacts"]):
        y = 730 + i * 80
        a = anim(t, "step", i)
        els += [
            icon(f"{sid}-icon{i+1}", M, y, 48, ic, anim=a),
            text(f"{sid}-contact{i+1}", M + 76, y, 1200, 52, line, role="body", size=32, weight=500, lh=1.5,
                 anim=a),
        ]
    return bg, els


LAYOUTS = {
    "title": title,
    "section": section,
    "text": text_layout,
    "two-columns": two_columns,
    "image-text": image_text,
    "quote": quote,
    "key-numbers": key_figures,
    "chart": chart,
    "table": table,
    "team": team,
    "timeline": timeline,
    "thanks": thank_you,
}
