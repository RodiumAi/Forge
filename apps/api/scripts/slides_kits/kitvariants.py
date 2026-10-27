"""Layout variants for slides kits, on top of kitlib (1920 x 1080 canvas).

The 12 layouts keep the geometry of docs/templates/slides-style-guide.md, but a
kit can pick a variant per layout and a decoration set through `theme["style"]`
so two kits never read as a recolour of the same deck:

- `title`: full hero "left" (default), "center", "bottom"; split hero "right"
  (default), "left", "inset", "band" (photo band on top).
- `accent`: header accent "bar" (default), "rule", "dot", "side", "tab".
- `pattern`: background shapes on content slides: "none", "dots", "circles",
  "frame", "band", "corner", "grid", "blobs".
- `section`: "left", "center", "watermark". `text_panel`: "surface", "accent".
- `columns`: "plain", "cards". `image_text`: "left", "right", "inset",
  "circle", "framed". `quote`: "surface", "accent", "center", "image".
- `figures`: "cards", "plain", "accent". `chart`: "left", "right".
- `team`: "circles", "cards". `timeline`: "line", "cards".
- `thanks`: "left", "center", "split". `footer`: "plain", "rule".
- `upper`: uppercase headings. `heading_size`: slide heading size (64).

Every builder returns (background, elements) like kitlib, with the same element
ids so build_kits (preview, DESIGN.md) keeps working.
"""
from __future__ import annotations

import base64
import io

import kitlib
from kitlib import CONTENT_W, H, M, W, anim, color_bg, icon, image, image_bg, shape, text

#: Transparent fill for outline-only shapes (the player fills shapes with --accent by default).
NONE = "#00000000"

CONTENT_LAYOUTS = {"text", "two-columns", "key-numbers", "chart", "table", "team", "timeline"}


def _st(t, key, default):
    return t.get("style", {}).get(key, default)


def _find(els, eid):
    return next((e for e in els if e["id"] == eid), None)


# ── decorations ────────────────────────────────────────────────────────────


def _pattern(t, sid):
    kind = _st(t, "pattern", "none")
    els = []
    if kind == "dots":
        for r in range(4):
            for c in range(7):
                els.append(shape(f"{sid}-dot-{r}-{c}", 1540 + c * 36, 104 + r * 36, 8, 8, "ellipse",
                                 fill="--border", z=0))
    elif kind == "circles":
        els += [
            shape(f"{sid}-ring1", 1500, -330, 700, 700, "ellipse", stroke="--border", sw=2, fill=NONE, z=0),
            shape(f"{sid}-ring2", 1620, -210, 460, 460, "ellipse", stroke="--border", sw=2, fill=NONE, z=0),
        ]
    elif kind == "frame":
        els.append(shape(f"{sid}-frame", 40, 40, W - 80, H - 80, stroke="--border", sw=2, fill=NONE, z=0))
    elif kind == "band":
        els.append(shape(f"{sid}-band", 0, 0, W, 336, fill="--surface", z=0))
    elif kind == "corner":
        els.append(shape(f"{sid}-glow", 1460, -520, 900, 900, "ellipse", fill="--accent", opacity=0.12, z=0))
    elif kind == "grid":
        for i in range(1, 9):
            els.append(shape(f"{sid}-grid{i}", round(i * W / 9), 0, 1, H, fill="--border", opacity=0.6, z=0))
    elif kind == "blobs":
        els += [
            shape(f"{sid}-blob1", 1620, -170, 470, 470, "ellipse", fill="--accent-2", opacity=0.22, z=0),
            shape(f"{sid}-blob2", 1500, 140, 150, 150, "ellipse", fill="--accent", opacity=0.18, z=0),
        ]
    return els


def _accent(t, els, sid):
    """Restyle the header accent (bar above the kicker) of a content slide."""
    kind = _st(t, "accent", "bar")
    bar, kicker, heading = _find(els, f"{sid}-bar"), _find(els, f"{sid}-kicker"), _find(els, f"{sid}-heading")
    if bar is None or kicker is None:
        return els
    x, col_w = bar["x"], kicker["w"]
    if kind == "rule":
        bar.update(y=bar["y"] + 3, w=96, h=4, radius=0)
        els.append(shape(f"{sid}-rule", x, bar["y"] + 1, col_w if x != M else CONTENT_W, 2, fill="--border", z=1))
    elif kind == "dot":
        bar.update(shape="ellipse", y=kicker["y"] + 11, w=20, h=20)
        bar.pop("radius", None)
        kicker.update(x=x + 36, w=col_w - 36)
    elif kind == "side":
        bar.update(x=0 if x == M else x - 60, y=kicker["y"], w=14, h=170, radius=0)
    elif kind == "tab":
        label = kicker["content"][0]["text"]
        pill_w = int(len(label) * 19.5 + 52)
        bar.update(y=kicker["y"] - 6, w=pill_w, h=50, radius=25)
        kicker.update(x=x + 26, w=pill_w, y=kicker["y"] - 2)
        kicker["style"]["color"] = "--accent-contrast"
        if heading is not None:
            heading["y"] += 16
    if heading is not None and _st(t, "upper", False):
        heading["style"]["uppercase"] = True
        heading["style"]["letterSpacing"] = 1
    if heading is not None and _st(t, "heading_size", None):
        heading["style"]["size"] = _st(t, "heading_size", 64)
    return els


def _footer_rule(t, sid):
    if _st(t, "footer", "plain") != "rule":
        return []
    return [shape(f"{sid}-footrule", M, 978, CONTENT_W, 2, fill="--border", z=1)]


def _decorate(fn, layout):
    def build(t, c, sid, n):
        bg, els = fn(t, c, sid, n)
        if layout in CONTENT_LAYOUTS or layout == "image-text":
            els = _accent(t, els, sid)
        if layout in CONTENT_LAYOUTS:
            els = _pattern(t, sid) + els + _footer_rule(t, sid)
        return bg, els
    return build


# ── title ──────────────────────────────────────────────────────────────────


def title(t, c, sid, n):
    variant = _st(t, "title", "left" if t["hero"] == "full" else "right")
    img = t["images"][c["image"]]
    size = c.get("size", 100)
    tw, ta = anim(t, "title"), anim(t, "body")
    default = variant == ("left" if t["hero"] == "full" else "right")
    if default and not _st(t, "upper", False):
        return kitlib.title(t, c, sid, n)
    if default:
        bg, els = kitlib.title(t, c, sid, n)
        _find(els, f"{sid}-title")["style"].update(uppercase=True, letterSpacing=0)
        return bg, els
    if variant == "center":
        bg = image_bg(img, "--bg", t.get("hero_overlay", 0.66))
        x, w = 160, 1600
        els = [
            shape(f"{sid}-bar", 900, 290, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-label", x, 326, w, 48, c["label"], role="label", size=26, weight=600, color="--accent",
                 ls=4, upper=True, lh=1.4, align="center"),
            text(f"{sid}-title", x, 390, w, 310, c["title"], role="title", font="display", size=size,
                 weight=t["display_weight"], lh=1.05, ls=-1, align="center", match="slide-title", anim=tw),
            text(f"{sid}-subtitle", 310, 720, 1300, 130, c["subtitle"], role="subtitle", size=34, opacity=0.88,
                 lh=1.35, align="center", anim=ta),
            text(f"{sid}-meta", x, 930, w, 44, c["meta"], role="caption", size=24, weight=500, color="--muted",
                 lh=1.4, align="center"),
        ]
    elif variant == "bottom":
        bg = image_bg(img, "--bg", t.get("hero_overlay", 0.62))
        els = [
            text(f"{sid}-meta", M, 100, 1100, 44, c["meta"], role="caption", size=24, weight=600, color="--fg",
                 lh=1.4, opacity=0.85),
            shape(f"{sid}-topline", M, 160, CONTENT_W, 2, fill="--fg", opacity=0.35, z=2),
            shape(f"{sid}-bar", M, 430, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-label", M, 466, 1400, 48, c["label"], role="label", size=26, weight=600, color="--accent",
                 ls=3, upper=True, lh=1.4),
            text(f"{sid}-title", M, 524, 1640, 270, c["title"], role="title", font="display", size=size,
                 weight=t["display_weight"], lh=1.04, ls=-2, match="slide-title", anim=tw),
            text(f"{sid}-subtitle", M, 820, 1200, 110, c["subtitle"], role="subtitle", size=32, opacity=0.88,
                 lh=1.4, anim=ta),
        ]
    elif variant == "left":  # split hero, photo on the left
        bg = color_bg("--bg")
        x, w = 1040, 740
        els = [
            image(f"{sid}-image", 0, 0, 920, H, img, c["alt"], match="hero-image"),
            shape(f"{sid}-bar", x, 300, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-label", x, 336, w, 48, c["label"], role="label", size=26, weight=600, color="--accent",
                 ls=3, upper=True, lh=1.4),
            text(f"{sid}-title", x, 396, w, 300, c["title"], role="title", font="display", size=size,
                 weight=t["display_weight"], lh=1.05, ls=-1, match="slide-title", anim=tw),
            text(f"{sid}-subtitle", x, 720, w, 150, c["subtitle"], role="subtitle", size=32, opacity=0.86,
                 lh=1.4, anim=ta),
            text(f"{sid}-meta", x, 930, w, 44, c["meta"], role="caption", size=24, weight=500, color="--muted",
                 lh=1.4),
        ]
    elif variant == "inset":
        bg = color_bg("--bg")
        x, w = M, 780
        els = [
            shape(f"{sid}-backdrop", 1060, 0, 860, H, fill="--surface", z=0),
            image(f"{sid}-image", 1000, 90, 820, 900, img, c["alt"], radius=t["radius"] * 2, match="hero-image"),
            shape(f"{sid}-bar", x, 300, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-label", x, 336, w, 48, c["label"], role="label", size=26, weight=600, color="--accent",
                 ls=3, upper=True, lh=1.4),
            text(f"{sid}-title", x, 396, w, 300, c["title"], role="title", font="display", size=size,
                 weight=t["display_weight"], lh=1.05, ls=-1, match="slide-title", anim=tw),
            text(f"{sid}-subtitle", x, 720, w, 150, c["subtitle"], role="subtitle", size=32, opacity=0.86,
                 lh=1.4, anim=ta),
            text(f"{sid}-meta", x, 930, w, 44, c["meta"], role="caption", size=24, weight=500, color="--muted",
                 lh=1.4),
        ]
    elif variant == "band":
        bg = color_bg("--bg")
        els = [
            image(f"{sid}-image", 0, 0, W, 540, img, c["alt"], match="hero-image"),
            shape(f"{sid}-bar", M, 600, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-label", M, 636, 1100, 48, c["label"], role="label", size=26, weight=600, color="--accent",
                 ls=3, upper=True, lh=1.4),
            text(f"{sid}-meta", 1180, 636, 600, 48, c["meta"], role="caption", size=24, weight=500, color="--muted",
                 align="right", lh=1.4),
            text(f"{sid}-title", M, 694, CONTENT_W, 190, c["title"], role="title", font="display", size=size,
                 weight=t["display_weight"], lh=1.05, ls=-1, match="slide-title", anim=tw),
            text(f"{sid}-subtitle", M, 900, 1500, 100, c["subtitle"], role="subtitle", size=30, color="--muted",
                 lh=1.4, anim=ta),
        ]
    else:
        raise ValueError(f"unknown title variant {variant}")
    if _st(t, "upper", False):
        _find(els, f"{sid}-title")["style"].update(uppercase=True, letterSpacing=0)
    return bg, els


# ── section ────────────────────────────────────────────────────────────────


def section(t, c, sid, n):
    variant = _st(t, "section", "left")
    if variant == "left":
        return kitlib.section(t, c, sid, n)
    if c.get("image"):
        bg = image_bg(t["images"][c["image"]], "--bg", t.get("section_overlay", 0.8))
    else:
        bg = color_bg("--surface")
    w8 = t["display_weight"]
    if variant == "center":
        els = [
            text(f"{sid}-number", 460, 200, 1000, 260, c["number"], role="label", font="display", size=220,
                 weight=w8, color="--accent", align="center", lh=1.1, anim=anim(t, "title")),
            shape(f"{sid}-bar", 900, 500, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-title", 160, 540, 1600, 200, c["title"], role="title", font="display", size=88,
                 weight=w8, align="center", lh=1.1, match="slide-title", anim=anim(t, "body")),
            text(f"{sid}-subtitle", 310, 760, 1300, 100, c["subtitle"], role="subtitle", size=34, color="--muted",
                 align="center", lh=1.35, anim=anim(t, "body")),
        ]
    else:  # watermark: giant outlined number on the right
        els = [
            text(f"{sid}-number", 960, 250, 880, 440, c["number"], role="label", font="display", size=400,
                 weight=w8, color="--accent", align="right", lh=1.0, ls=-12, opacity=0.9, z=1,
                 anim=anim(t, "title")),
            shape(f"{sid}-bar", M, 440, 120, 10, fill="--accent", radius=5, match="accent-bar", z=2),
            text(f"{sid}-title", M, 470, 800, 210, c["title"], role="title", font="display", size=92,
                 weight=w8, lh=1.05, match="slide-title", anim=anim(t, "body"), z=3),
            text(f"{sid}-subtitle", M, 700, 800, 130, c["subtitle"], role="subtitle", size=34, color="--muted",
                 lh=1.35, anim=anim(t, "body"), z=3),
        ]
    if _st(t, "upper", False):
        _find(els, f"{sid}-title")["style"].update(uppercase=True)
    return bg, els


# ── text, two columns ──────────────────────────────────────────────────────


def text_layout(t, c, sid, n):
    bg, els = kitlib.text_layout(t, c, sid, n)
    if _st(t, "text_panel", "surface") == "accent" and not c.get("code"):
        panel = _find(els, f"{sid}-panel")
        panel["fill"] = "--accent"
        panel.pop("stroke", None)
        panel.pop("strokeWidth", None)
        _find(els, f"{sid}-icon")["color"] = "--accent-contrast"
        _find(els, f"{sid}-callout")["style"].update(color="--accent-contrast", weight=500)
    return bg, els


def two_columns(t, c, sid, n):
    if _st(t, "columns", "plain") == "plain":
        return kitlib.two_columns(t, c, sid, n)
    els = kitlib.header(t, c, sid)
    for i, col in enumerate(c["columns"]):
        x = M + i * 840
        els += [
            shape(f"{sid}-card{i+1}", x, 360, 800, 560, fill="--surface", stroke="--border", sw=1,
                  radius=t["radius"], z=1, anim=anim(t, "step", i * 2)),
            shape(f"{sid}-badge{i+1}", x + 56, 410, 104, 104, "ellipse", fill="--accent", z=2,
                  anim=anim(t, "step", i * 2)),
            icon(f"{sid}-icon{i+1}", x + 82, 436, 52, col["icon"], color="--accent-contrast",
                 anim=anim(t, "step", i * 2)),
            text(f"{sid}-col{i+1}-title", x + 56, 560, 690, 64, col["title"], role="heading", font="display",
                 size=40, weight=t["display_weight"], lh=1.2),
            text(f"{sid}-col{i+1}-body", x + 56, 636, 690, 250, col["body"], size=30, color="--muted", lh=1.5,
                 anim=anim(t, "step", i * 2 + 1)),
        ]
    return color_bg("--bg"), els + kitlib.footer(t, sid, n)


# ── image and text ─────────────────────────────────────────────────────────


def image_text(t, c, sid, n):
    variant = _st(t, "image_text", "left")
    bg, els = kitlib.image_text(t, c, sid, n)
    if variant == "left":
        return bg, els
    img_el = _find(els, f"{sid}-image")
    if variant == "right":
        img_el.update(x=W - 880)
        for e in els:
            if e is not img_el and e["id"] != f"{sid}-page":
                e["x"] = e["x"] - 1000 + M
        page = _find(els, f"{sid}-page")
        page.update(x=M, style=dict(page["style"], align="left"))
    elif variant == "inset":
        img_el.update(x=80, y=80, w=800, h=920, radius=t["radius"] * 2)
    elif variant == "circle":
        img_el.update(x=100, y=160, w=760, h=760, radius=380)
        els.append(shape(f"{sid}-ring", 70, 130, 820, 820, "ellipse", stroke="--accent", sw=3, fill=NONE, z=0))
        els.append(shape(f"{sid}-spot", 700, 760, 140, 140, "ellipse", fill="--accent-2", z=2))
    elif variant == "framed":
        img_el.update(x=80, y=90, w=760, h=860, radius=t["radius"])
        els.append(shape(f"{sid}-frame", 130, 140, 760, 860, fill="--accent", radius=t["radius"], z=0))
    return bg, els


# ── quote ──────────────────────────────────────────────────────────────────


def quote(t, c, sid, n):
    variant = _st(t, "quote", "surface")
    bg, els = kitlib.quote(t, c, sid, n)
    if variant == "surface":
        return bg, els
    if variant == "image" and c.get("image"):
        bg = image_bg(t["images"][c["image"]], "--bg", c.get("overlay", 0.82))
    elif variant == "accent":
        bg = color_bg("--accent")
        for e in els:
            if e["type"] == "text":
                e["style"]["color"] = "--accent-contrast"
            if e["type"] == "shape":
                e["fill"] = "--accent-contrast"
        _find(els, f"{sid}-mark")["opacity"] = 0.45
        _find(els, f"{sid}-role")["opacity"] = 0.85
        for k in ("footer", "page"):
            _find(els, f"{sid}-{k}")["opacity"] = 0.8
    elif variant == "center":
        for e in els:
            if e["id"].endswith(("-mark", "-quote", "-author", "-role")):
                e.update(x=210, w=1500)
                e["style"]["align"] = "center"
        _find(els, f"{sid}-bar").update(x=920)
    return bg, els


# ── figures ────────────────────────────────────────────────────────────────


def key_figures(t, c, sid, n):
    variant = _st(t, "figures", "cards")
    bg, els = kitlib.key_figures(t, c, sid, n)
    figs = c["figures"]
    if variant == "accent":
        card = _find(els, f"{sid}-card1")
        card["fill"] = "--accent"
        card.pop("stroke", None)
        card.pop("strokeWidth", None)
        for k in ("value1", "label1", "detail1"):
            _find(els, f"{sid}-{k}")["style"]["color"] = "--accent-contrast"
        _find(els, f"{sid}-detail1")["opacity"] = 0.85
    elif variant == "plain":
        size = 92 if len(figs) == 4 else 120
        for i in range(len(figs)):
            card = _find(els, f"{sid}-card{i+1}")
            card.update(y=380, h=6, fill="--accent", radius=0)
            card.pop("stroke", None)
            card.pop("strokeWidth", None)
            for k, dy in (("value", 30), ("label", 30), ("detail", 30)):
                e = _find(els, f"{sid}-{k}{i+1}")
                e["x"] -= 40
                e["w"] += 60
                e["y"] += dy
            _find(els, f"{sid}-value{i+1}")["style"]["size"] = size
            _find(els, f"{sid}-value{i+1}")["h"] = 170
            _find(els, f"{sid}-label{i+1}")["y"] += 20
            _find(els, f"{sid}-detail{i+1}")["y"] += 20
    return bg, els


def chart(t, c, sid, n):
    bg, els = kitlib.chart(t, c, sid, n)
    if _st(t, "chart", "left") == "right":
        _find(els, f"{sid}-chart")["x"] = W - M - 1080
        for k in ("icon", "takeaway", "comment"):
            _find(els, f"{sid}-{k}")["x"] = M
    return bg, els


# ── team ───────────────────────────────────────────────────────────────────


def team(t, c, sid, n):
    if _st(t, "team", "circles") == "circles":
        return kitlib.team(t, c, sid, n)
    els = kitlib.header(t, c, sid)
    people = c["people"]
    gap = 40
    cw = (CONTENT_W - gap * (len(people) - 1)) / len(people)
    for i, p in enumerate(people):
        x = round(M + i * (cw + gap))
        a = anim(t, "step", i)
        initials = "".join(w[0] for w in p["name"].replace("-", " ").split()[:2]).upper()
        els += [
            shape(f"{sid}-card{i+1}", x, 360, round(cw), 560, fill="--surface", stroke="--border", sw=1,
                  radius=t["radius"], z=1, anim=a),
            shape(f"{sid}-avatar{i+1}", x + 40, 400, 150, 150, fill="--accent", radius=t["radius"], z=2, anim=a),
            text(f"{sid}-initials{i+1}", x + 40, 400, 150, 150, initials, role="label", font="display", size=44,
                 weight=t["display_weight"], color="--accent-contrast", align="center", valign="middle", lh=1.0,
                 anim=a),
            text(f"{sid}-name{i+1}", x + 40, 590, round(cw) - 80, 50, p["name"], role="heading", size=32,
                 weight=700, lh=1.3, anim=a),
            text(f"{sid}-role{i+1}", x + 40, 644, round(cw) - 80, 44, p["role"], role="caption", size=24,
                 weight=600, color="--accent", lh=1.4, anim=a),
            text(f"{sid}-bio{i+1}", x + 40, 700, round(cw) - 80, 180, p["bio"], role="caption", size=24,
                 color="--muted", lh=1.45, anim=a),
        ]
    return color_bg("--bg"), els + kitlib.footer(t, sid, n)


# ── timeline ───────────────────────────────────────────────────────────────


def timeline(t, c, sid, n):
    if _st(t, "timeline", "line") == "line":
        return kitlib.timeline(t, c, sid, n)
    els = kitlib.header(t, c, sid)
    steps = c["steps"]
    gap = 40
    cw = (CONTENT_W - gap * (len(steps) - 1)) / len(steps)
    for i, s in enumerate(steps):
        x = round(M + i * (cw + gap))
        a = anim(t, "step", i)
        els += [
            shape(f"{sid}-card{i+1}", x, 380, round(cw), 520, fill="--surface", stroke="--border", sw=1,
                  radius=t["radius"], z=1, anim=a),
            shape(f"{sid}-strip{i+1}", x, 380, round(cw), 10, fill="--accent" if i == 0 else "--border",
                  radius=0, z=2, anim=a),
            text(f"{sid}-num{i+1}", x + 40, 420, 80, 40, f"{i + 1:02d}", role="label", font="mono", size=24,
                 color="--muted", lh=1.4, anim=a),
            text(f"{sid}-date{i+1}", x + 40, 470, round(cw) - 80, 60, s["date"], role="label", font="display",
                 size=40, weight=t["display_weight"], color="--accent", lh=1.3, anim=a),
            text(f"{sid}-step{i+1}", x + 40, 560, round(cw) - 80, 90, s["title"], role="heading", size=30,
                 weight=700, lh=1.3, anim=a),
            text(f"{sid}-desc{i+1}", x + 40, 670, round(cw) - 80, 200, s["desc"], role="caption", size=24,
                 color="--muted", lh=1.45, anim=a),
        ]
        if i < len(steps) - 1:
            els.append(icon(f"{sid}-arrow{i+1}", x + round(cw) + 4, 618, 32, "chevron-right", color="--accent",
                            z=3))
    return color_bg("--bg"), els + kitlib.footer(t, sid, n)


# ── thank you ──────────────────────────────────────────────────────────────


def thank_you(t, c, sid, n):
    variant = _st(t, "thanks", "left")
    bg, els = kitlib.thank_you(t, c, sid, n)
    if variant == "center":
        _find(els, f"{sid}-bar").update(x=900)
        for k in ("title", "subtitle"):
            e = _find(els, f"{sid}-{k}")
            e.update(x=160, w=1600)
            e["style"]["align"] = "center"
        # Contacts side by side, centered.
        pairs = [(i, _find(els, f"{sid}-icon{i}"), _find(els, f"{sid}-contact{i}")) for i in (1, 2)]
        for i, ic, ct in pairs:
            if ic is None:
                continue
            x0 = 260 if i == 1 else 1000
            ic.update(x=x0, y=760)
            ct.update(x=x0 + 70, y=760, w=640)
    elif variant == "split" and c.get("side_image"):
        bg = color_bg("--bg")
        els.append(image(f"{sid}-image", 1100, 0, 820, H, t["images"][c["side_image"]], c.get("alt", ""),
                         match="hero-image"))
        e = _find(els, f"{sid}-title")
        e.update(w=900)
        e["style"]["size"] = min(e["style"]["size"], 130)
        _find(els, f"{sid}-subtitle").update(w=860)
        for i in (1, 2):
            ct = _find(els, f"{sid}-contact{i}")
            if ct:
                ct.update(w=860)
    if _st(t, "upper", False):
        _find(els, f"{sid}-title")["style"].update(uppercase=True)
    return bg, els


LAYOUTS = {
    "title": title,
    "section": section,
    "text": _decorate(text_layout, "text"),
    "two-columns": _decorate(two_columns, "two-columns"),
    "image-text": _decorate(image_text, "image-text"),
    "quote": quote,
    "key-numbers": _decorate(key_figures, "key-numbers"),
    "chart": _decorate(chart, "chart"),
    "table": _decorate(kitlib.table, "table"),
    "team": _decorate(team, "team"),
    "timeline": _decorate(timeline, "timeline"),
    "thanks": thank_you,
}

LAYOUT_NOTES = {
    "title": {
        "center": "cover: photo background with a --bg veil, label, title, subtitle and meta centered",
        "bottom": "cover: photo background, meta and a hairline at the top, title block anchored low",
        "left": "cover: photo on the left half, label, title, subtitle and meta on the right",
        "inset": "cover: text on the left, rounded photo inset on a --surface backdrop on the right",
        "band": "cover: photo band across the top half, title block below it",
    },
    "section": {
        "center": "centered section number, title and one line",
        "watermark": "giant section number on the right, title and one line on the left",
    },
    "two-columns": {"cards": "heading and two --surface cards, each with an icon badge, subheading and paragraph"},
    "image-text": {
        "right": "kicker, heading, paragraph and list on the left, photo on the right half",
        "inset": "rounded photo inset on the left, kicker, heading, paragraph and list on the right",
        "circle": "round photo with an accent ring on the left, text column on the right",
        "framed": "photo on the left over an offset --accent frame, text column on the right",
    },
    "quote": {
        "accent": "full --accent background, quote in --accent-contrast",
        "center": "centered quote, author and role on --surface",
        "image": "quote over a photo with a strong --bg veil",
    },
    "key-numbers": {
        "accent": "heading and figure cards, the first card filled with --accent",
        "plain": "heading and three or four figures under accent rules, no cards",
    },
    "chart": {"right": "heading, takeaway on the left, editable chart on the right"},
    "team": {"cards": "heading and four --surface cards (square initials avatar, name, role, one line)"},
    "timeline": {"cards": "heading and four numbered milestone cards linked by chevrons"},
    "thanks": {
        "center": "closing title and subtitle centered, two contacts side by side",
        "split": "closing title, subtitle and contacts on the left, photo on the right",
    },
}

STYLE_KEYS = {"title": "title", "section": "section", "two-columns": "columns", "image-text": "image_text",
              "quote": "quote", "key-numbers": "figures", "chart": "chart", "team": "team",
              "timeline": "timeline", "thanks": "thanks"}
ACCENT_NOTES = {
    "bar": "an 80 x 8 accent bar above the kicker",
    "rule": "a hairline across the slide top with a short --accent segment",
    "dot": "an --accent dot before the kicker",
    "side": "a vertical --accent bar on the left edge beside the kicker and heading",
    "tab": "the kicker set in --accent-contrast inside an --accent pill",
}
PATTERN_NOTES = {
    "dots": "a 7 x 4 grid of small --border dots in the top right corner",
    "circles": "two thin --border rings bleeding off the top right corner",
    "frame": "a thin --border frame inset 40 px from the edges",
    "band": "a --surface band behind the header (y 0 to 336)",
    "corner": "a soft --accent glow (opacity 0.12) in the top right corner",
    "grid": "thin vertical --border lines dividing the canvas in nine columns",
    "blobs": "two soft round shapes in --accent-2 and --accent at the top right",
}


def layout_notes(theme):
    """Layout descriptions overriding build_kits.LAYOUT_DESC for the chosen variants."""
    out = {}
    for layout, key in STYLE_KEYS.items():
        v = _st(theme, key, None)
        if v and v in LAYOUT_NOTES.get(layout, {}):
            out[layout] = LAYOUT_NOTES[layout][v]
    return out


def style_lines(theme):
    lines = [f"- Header accent: {ACCENT_NOTES[_st(theme, 'accent', 'bar')]}."]
    p = _st(theme, "pattern", "none")
    if p != "none":
        lines.append(f"- Background pattern on content slides: {PATTERN_NOTES[p]} (shapes, z 0).")
    if _st(theme, "footer", "plain") == "rule":
        lines.append("- A --border hairline sits above the footer (y 978).")
    if _st(theme, "upper", False):
        lines.append("- Titles and headings are set in uppercase.")
    if _st(theme, "text_panel", "surface") == "accent":
        lines.append("- The side panel of text slides is filled with --accent, icon and callout in --accent-contrast.")
    return lines


def preview_html(kit, theme, hero_path, slide1):
    """Static 480 x 300 thumbnail matching the cover variant."""
    from PIL import Image

    c = theme["colors"]
    im = Image.open(hero_path).convert("RGB")
    im.thumbnail((480, 480))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=55, method=6)
    data = base64.b64encode(buf.getvalue()).decode()
    by = {e["id"].split("-", 1)[1]: e for e in slide1["elements"]}
    title_txt = by["title"]["content"][0]["text"]
    label = by["label"]["content"][0]["text"]
    sub = by["subtitle"]["content"][0]["text"]
    serif = theme.get("serif", False)
    stack = 'Georgia, "Times New Roman", serif' if serif else 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    variant = _st(theme, "title", "left" if theme["hero"] == "full" else "right")
    url = f"url(data:image/webp;base64,{data}) center/cover"
    align = "left"
    if theme["hero"] == "full":
        hero = f".hero {{ position: absolute; inset: 0; background: {url}; }}"
        veil = f".veil {{ position: absolute; inset: 0; background: {c['bg']}; opacity: {theme.get('hero_overlay', 0.62)}; }}"
        if variant == "center":
            box = ".text { position: absolute; left: 40px; right: 40px; top: 84px; text-align: center; }"
            align = "center"
        elif variant == "bottom":
            box = ".text { position: absolute; left: 30px; width: 400px; bottom: 34px; }"
        else:
            box = ".text { position: absolute; left: 30px; top: 92px; width: 340px; }"
    else:
        veil = ".veil { display: none; }"
        if variant == "left":
            hero = f".hero {{ position: absolute; top: 0; left: 0; bottom: 0; width: 230px; background: {url}; }}"
            box = ".text { position: absolute; left: 255px; top: 92px; width: 200px; }"
        elif variant == "band":
            hero = f".hero {{ position: absolute; top: 0; left: 0; right: 0; height: 150px; background: {url}; }}"
            box = ".text { position: absolute; left: 30px; top: 166px; width: 420px; }"
        elif variant == "inset":
            hero = (f".hero {{ position: absolute; top: 22px; right: 22px; bottom: 22px; width: 200px; "
                    f"border-radius: 10px; background: {url}; }}")
            box = ".text { position: absolute; left: 30px; top: 92px; width: 200px; }"
        else:
            hero = f".hero {{ position: absolute; top: 0; right: 0; bottom: 0; width: 230px; background: {url}; }}"
            box = ".text { position: absolute; left: 30px; top: 92px; width: 200px; }"
    narrow = "width: 200px" in box
    tsize = (20 if len(title_txt) < 30 else 16) if narrow else (26 if len(title_txt) < 34 else 21)
    upper = "text-transform: uppercase;" if _st(theme, "upper", False) else ""
    bar_margin = "0 auto 8px" if align == "center" else "0 0 8px"
    n = len(kit["slides"])
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
  {hero}
  {veil}
  {box}
  .bar {{ width: 30px; height: 3px; border-radius: 2px; background: {c['accent']}; margin: {bar_margin}; }}
  .label {{ font-size: 7px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: {c['accent']}; margin-bottom: 8px; }}
  h1 {{ font-family: {stack}; font-size: {tsize}px; line-height: 1.05; font-weight: {700 if theme['display_weight'] >= 600 else 400}; letter-spacing: -.01em; {upper} }}
  p {{ font-size: 8.5px; line-height: 1.4; margin-top: 10px; opacity: .85; }}
  .count {{ position: absolute; right: 12px; bottom: 10px; font-size: 7px; font-weight: 600;
    color: {c['fg']}; background: {c['surface']}; border: 1px solid {c['border']}; padding: 3px 7px; border-radius: 99px; }}
</style>
</head>
<body>
  <div class="hero"></div>
  <div class="veil"></div>
  <div class="text">
    <div class="bar"></div>
    <div class="label">{label}</div>
    <h1>{title_txt}</h1>
    <p>{sub}</p>
  </div>
  <div class="count">{n} slides</div>
</body>
</html>
"""
