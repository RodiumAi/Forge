"""Per-kit visual variants for the wave 2 (agent F2) slides kits.

kitlib.py builds the 12 layouts with one shared geometry. Each kit of
kits_content_f2.py declares a ``style`` dict; ``make_post(style)`` returns a
post-processing hook that build_kits.py calls on every slide to restyle the
header, add background patterns made of shapes, change the image treatment,
the figure cards, the quote, the avatars and the closing slide. Element ids
stay those of kitlib so the deck generator and the editor still find them.
"""
from __future__ import annotations

from kitlib import CONTENT_W, H, M, W, shape, text
from kitlib import image as image_el

HEADER_LAYOUTS = {"text", "two-columns", "key-numbers", "chart", "table", "team", "timeline"}
CONTENT_LAYOUTS = HEADER_LAYOUTS | {"quote"}
CLEAR = "#0000"  # transparent fill for outlined shapes (shapes default to --accent)


def _find(els, eid):
    for el in els:
        if el["id"] == eid:
            return el
    return None


def _txt(el):
    block = el["content"][0]
    return block.get("text", "")


def _set_text(el, value):
    el["content"] = [{"type": "paragraph", "text": value}]


def _center(el, x=M, w=CONTENT_W):
    el["x"], el["w"] = x, w
    el["style"]["align"] = "center"


def _label_width(label, size=24, ls=3):
    return round(len(label) * (size * 0.68 + ls)) + 56


# ── header ─────────────────────────────────────────────────────────────────


def header(kind, els, sid, n, opts):
    bar, kick, head = _find(els, f"{sid}-bar"), _find(els, f"{sid}-kicker"), _find(els, f"{sid}-heading")
    if not (bar and kick and head):
        return els
    label = _txt(kick)
    if kind == "number":
        prefix = opts.get("number_prefix", "")
        _set_text(kick, f"{prefix}{n:02d}  ·  {label}")
        kick["style"]["font"] = "mono"
    elif kind == "comment":
        _set_text(kick, f"// {label.lower()}")
        kick["style"].update(font="mono", letterSpacing=0)
        kick["style"].pop("uppercase", None)
        kick["style"]["size"] = 26
    elif kind == "rule":
        kick["y"], head["y"] = 100, 146
        bar.update(y=302, w=CONTENT_W, h=3, radius=0)
    elif kind == "newspaper":
        bar.update(y=96, w=CONTENT_W, h=5, radius=0, fill="--fg")
        els.append(shape(f"{bar['id']}-thin", M, 108, CONTENT_W, 1, fill="--fg", z=2))
        kick["y"], head["y"] = 124, 172
    elif kind in ("pill", "block", "badge"):
        w = _label_width(label)
        bar.update(y=102, w=w, h=54, radius={"pill": 27, "block": 0, "badge": 6}[kind])
        if kind == "badge":
            bar.update(fill=CLEAR, stroke="--accent", strokeWidth=2)
        else:
            kick["style"]["color"] = "--accent-contrast"
        kick.update(x=M + 28, y=108, w=max(w, 600))
        head["y"] = 184
    elif kind == "side":
        bar.update(x=96, y=112, w=8, h=180, radius=4)
    elif kind == "dot":
        bar.update(y=133, w=20, h=20, radius=10)
        kick["x"] = M + 36
    elif kind == "tape":
        w = _label_width(label)
        bar.update(x=M - 18, y=114, w=w, h=56, radius=2, fill="--accent-2", opacity=0.3, rotation=-2, z=1)
        kick.update(x=M + 10, y=122, w=max(w, 600))
        kick["style"]["color"] = "--fg"
        head["y"] = 188
    elif kind == "hairline":
        bar.update(w=48, h=2, radius=0, fill="--fg")
        kick["style"]["color"] = "--muted"
    elif kind == "center":
        bar["x"] = (W - bar["w"]) // 2
        _center(kick)
        _center(head)
    return els


# ── background patterns (shapes under the content) ─────────────────────────


def pattern(kind, sid, opts):
    p = f"{sid}-pt"
    out = []
    if kind == "grid":
        step = opts.get("grid_step", 120)
        for i, x in enumerate(range(step, W, step)):
            out.append(shape(f"{p}v{i}", x, 0, 1, H, fill="--border", opacity=0.8, z=0))
        for i, y in enumerate(range(step, H, step)):
            out.append(shape(f"{p}h{i}", 0, y, W, 1, fill="--border", opacity=0.8, z=0))
    elif kind == "dots":
        for r in range(5):
            for c in range(8):
                out.append(shape(f"{p}d{r}{c}", 1560 + c * 34, 60 + r * 34, 8, 8, "ellipse",
                                 fill="--accent", opacity=0.35 if (r + c) % 3 else 0.8, z=0))
    elif kind == "rings":
        for i, d in enumerate((900, 640, 380)):
            out.append(shape(f"{p}r{i}", W - d // 2 - 60, H - d // 2 + 40, d, d, "ellipse", fill=CLEAR,
                             stroke="--border", sw=2, z=0))
    elif kind == "topbar":
        out.append(shape(f"{p}top", 0, 0, W, 14, fill="--accent", z=0))
        out.append(shape(f"{p}top2", 0, 14, 480, 14, fill="--accent-2", z=0))
    elif kind == "sidebar":
        out.append(shape(f"{p}side", 0, 0, 72, H, fill="--surface", z=0))
        out.append(shape(f"{p}sidebar", 70, 0, 2, H, fill="--border", z=0))
        out.append(text(f"{p}sidelabel", -444, 520, 960, 40, opts.get("side_label", ""), role="caption",
                        size=20, weight=600, color="--muted", ls=4, upper=True, align="center", lh=1.4))
        out[-1]["rotation"] = -90
    elif kind == "terminal":
        out.append(shape(f"{p}chrome", 0, 0, W, 56, fill="--surface", z=0))
        for i, tok in enumerate(("--accent", "--accent-2", "--muted")):
            out.append(shape(f"{p}light{i}", 28 + i * 34, 18, 20, 20, "ellipse", fill=tok, z=1))
        out.append(text(f"{p}path", 160, 12, 1200, 34, opts.get("path", ""), role="caption", font="mono", size=22,
                        color="--muted", lh=1.4))
        out.append(shape(f"{p}glow", 1380, 640, 900, 900, "ellipse", fill="--accent", opacity=0.07, z=0))
    elif kind == "hazard":
        for i in range(26):
            out.append(shape(f"{p}hz{i}", -40 + i * 80, -46, 36, 120, fill="--accent-2" if i % 2 else "--accent",
                             opacity=0.9, z=0))
            out[-1]["rotation"] = 40
        out.append(shape(f"{p}hzline", 0, 26, W, 2, fill="--border", z=0))
    elif kind == "corner":
        out.append(shape(f"{p}corner", W - 300, 0, 300, 300, fill="--surface", z=0))
        out.append(shape(f"{p}cornerdot", W - 120, 92, 28, 28, fill="--accent", z=0))
    elif kind == "frame":
        out.append(shape(f"{p}frame", 40, 40, W - 80, H - 80, fill=CLEAR, stroke="--border", sw=2, z=0))
        out.append(shape(f"{p}frame2", 56, 56, W - 112, H - 112, fill=CLEAR, stroke="--accent", sw=1, z=0,
                         opacity=0.6))
    elif kind == "blobs":
        out.append(shape(f"{p}sun", 1500, -260, 680, 680, "ellipse", fill="--accent", opacity=0.14, z=0))
        out.append(shape(f"{p}sea", -240, 860, 760, 420, "ellipse", fill="--accent-2", opacity=0.12, z=0))
    elif kind == "marks":
        for i, (x, y, sx, sy) in enumerate(((48, 48, 1, 1), (W - 48, 48, -1, 1), (48, H - 48, 1, -1),
                                            (W - 48, H - 48, -1, -1))):
            out.append(shape(f"{p}m{i}a", x if sx > 0 else x - 56, y if sy > 0 else y - 2, 56, 2, fill="--fg", z=0))
            out.append(shape(f"{p}m{i}b", x if sx > 0 else x - 2, y if sy > 0 else y - 56, 2, 56, fill="--fg", z=0))
    elif kind == "confetti":
        spots = ((1580, 110, 18, "--accent"), (1700, 210, 12, "--accent-2"), (1820, 90, 22, "--accent-2"),
                 (1640, 300, 10, "--accent"), (1780, 380, 16, "--accent"), (1500, 230, 10, "--accent-2"),
                 (1860, 300, 12, "--accent"), (1730, 60, 10, "--accent"))
        for i, (x, y, d, tok) in enumerate(spots):
            out.append(shape(f"{p}c{i}", x, y, d, d, "ellipse", fill=tok, opacity=0.85, z=0))
        out.append(shape(f"{p}halo", 1460, -320, 760, 760, "ellipse", fill="--accent-2", opacity=0.08, z=0))
    elif kind == "columns":
        for i, x in enumerate((M + 410, M + 820, M + 1230)):
            out.append(shape(f"{p}col{i}", x, 0, 1, H, fill="--border", opacity=0.6, z=0))
    elif kind == "diagonal":
        band = shape(f"{p}band", 1820, -200, 520, 1500, fill="--surface", z=0)
        band["rotation"] = 18
        out.append(band)
        line = shape(f"{p}bandline", 1760, -200, 6, 1500, fill="--accent-2", opacity=0.4, z=0)
        line["rotation"] = 18
        out.append(line)
    elif kind == "margin":
        out.append(shape(f"{p}margin", 96, 0, 2, H, fill="--accent", opacity=0.5, z=0))
    return out


# ── cover ──────────────────────────────────────────────────────────────────


def cover(kind, t, els, sid, opts, content):
    by = {e["id"].rsplit("-", 1)[-1]: e for e in els if e["id"].startswith(f"{sid}-")}
    img = by.get("image")
    textual = [by[k] for k in ("bar", "label", "title", "subtitle", "meta") if k in by]
    if kind == "center":
        for e in textual:
            if e["type"] == "text":
                _center(e)
        by["bar"]["x"] = (W - by["bar"]["w"]) // 2
    elif kind == "split-left" and img:
        img["x"] = 0
        for e in textual:
            e["x"] = 1060
            if e["type"] == "text":
                e["w"] = 720
    elif kind == "inset" and img:
        img.update(x=1040, y=80, w=800, h=920, radius=t["radius"] * 2)
        els.append(shape(f"{sid}-deco", 1000, 120, 800, 920, fill="--accent", radius=t["radius"] * 2, z=0,
                         opacity=0.9))
    elif kind == "circle" and img:
        img.update(x=1080, y=200, w=680, h=680, radius=340)
        els.append(shape(f"{sid}-ring", 1050, 170, 740, 740, "ellipse", fill=CLEAR, stroke="--accent", sw=4, z=0))
        els.append(shape(f"{sid}-blob", 1500, 700, 300, 300, "ellipse", fill="--accent-2", opacity=0.85, z=0))
    elif kind == "narrow" and img:
        img.update(x=1300, w=620)
    elif kind == "bottom":
        dy = opts.get("cover_dy", 120)
        for e in textual:
            e["y"] += dy
        by["meta"]["y"] = 120
    elif kind == "mosaic" and img:
        extra = opts.get("mosaic", [])
        img.update(x=1000, y=60, w=500, h=960, radius=t["radius"])
        imgs = t["images"]
        for i, (key, alt) in enumerate(extra[:2]):
            els.append(image_el(f"{sid}-image{i + 2}", 1530, 60 + i * 495, 330, 465, imgs[key], alt,
                                radius=t["radius"], z=1))
    if opts.get("cover_label_color"):
        by["label"]["style"]["color"] = opts["cover_label_color"]
    if opts.get("cover_meta_color"):
        by["meta"]["style"]["color"] = opts["cover_meta_color"]
    if opts.get("cover_badge"):
        label = opts["cover_badge"]
        w = _label_width(label, 22, 2)
        bx = by["bar"]["x"]
        els.append(shape(f"{sid}-badge", bx, 214, w, 50, fill=CLEAR, stroke="--accent", sw=2, radius=6, z=2))
        els.append(text(f"{sid}-badgetext", bx + 24, 222, w - 30, 40, label, role="label", font="mono", size=22,
                        weight=600, color="--accent", ls=2, upper=True, lh=1.4))
    return els


# ── image + text ───────────────────────────────────────────────────────────


def image_text(kind, t, els, sid, opts):
    img = _find(els, f"{sid}-image")
    cols = [e for e in els if e["id"] in {f"{sid}-{k}" for k in ("bar", "kicker", "heading", "body", "list")}]
    if kind == "right":
        img["x"] = W - 880
        for e in cols:
            e["x"] = M
        page = _find(els, f"{sid}-page")
        page["x"] = M
        page["style"]["align"] = "left"
    elif kind == "inset":
        img.update(x=80, y=80, w=800, h=920, radius=t["radius"] * 2)
    elif kind == "pill":
        img.update(x=120, y=80, w=700, h=920, radius=350)
        els.append(shape(f"{sid}-arch", 96, 56, 748, 968, fill=CLEAR, stroke="--accent", sw=2, radius=374, z=0))
    elif kind == "duotone":
        els.append(shape(f"{sid}-tint", 0, 0, 880, H, fill=opts.get("tint", "--accent"),
                         opacity=opts.get("tint_opacity", 0.35), z=2))
    elif kind == "polaroid":
        img.update(x=30, y=30, w=700, h=720, z=1)
        img.pop("matchKey", None)
        group = {"id": f"{sid}-photo", "type": "group", "x": 110, "y": 110, "w": 760, "h": 880, "z": 1,
                 "rotation": -3, "matchKey": "hero-image", "children": [
                     shape(f"{sid}-paper", 0, 0, 760, 880, fill="--surface", stroke="--border", sw=1, radius=4, z=0),
                     img,
                     text(f"{sid}-caption", 30, 780, 700, 60, opts.get("polaroid_caption", ""), role="caption",
                          font="mono", size=24, color="--muted", align="center", lh=1.4),
                 ]}
        els = [group if e is img else e for e in els]
    elif kind == "caption":
        img.update(x=M, y=100, w=740, h=760)
        els.append(shape(f"{sid}-caprule", M, 884, 740, 2, fill="--fg", z=2))
        els.append(text(f"{sid}-caption", M, 900, 740, 80, opts.get("image_caption", ""), role="caption",
                        size=22, color="--muted", italic=True, lh=1.4))
    elif kind == "mosaic":
        img.update(x=80, y=80, w=520, h=920, radius=t["radius"])
        key, alt = opts["mosaic2"]
        els.append(image_el(f"{sid}-image2", 620, 80, 300, 450, t["images"][key], alt, radius=t["radius"], z=1))
        els.append(shape(f"{sid}-swatch", 620, 550, 300, 450, fill="--accent", radius=t["radius"], z=1))
        els.append(text(f"{sid}-swatchlabel", 650, 900, 240, 70, opts.get("swatch_label", ""), role="caption",
                        font="mono", size=22, color="--accent-contrast", lh=1.4))
        for e in cols:
            e["x"] = 1040
            if e["type"] == "text":
                e["w"] = 740
    return els


# ── key figures ────────────────────────────────────────────────────────────


def figures(kind, t, els, sid):
    cards = [e for e in els if e["id"].startswith(f"{sid}-card")]
    if kind == "outline":
        for c in cards:
            c.update(fill=CLEAR, stroke="--accent", strokeWidth=2)
    elif kind == "topline":
        for c in cards:
            c.update(fill="--surface", strokeWidth=0)
            c.pop("stroke", None)
            els.append(shape(f"{c['id']}-top", c["x"], c["y"], c["w"], 8, fill="--accent", radius=0, z=2))
    elif kind == "accent-first":
        first = cards[0]
        first.update(fill="--accent", stroke="--accent")
        num = first["id"][len(f"{sid}-card"):]
        for k in ("value", "label", "detail"):
            el = _find(els, f"{sid}-{k}{num}")
            el["style"]["color"] = "--accent-contrast"
            if k == "detail":
                el["opacity"] = 0.85
    elif kind == "plain":
        for i, c in enumerate(cards):
            els.remove(c)
            if i:
                els.append(shape(f"{sid}-sep{i}", c["x"] - 20, 400, 2, 420, fill="--border", z=1))
            els.append(shape(f"{sid}-tick{i + 1}", c["x"] + 40, 380, 64, 6, fill="--accent", z=1))
    return els


# ── quote ──────────────────────────────────────────────────────────────────


def quote(kind, els, sid):
    mark, q = _find(els, f"{sid}-mark"), _find(els, f"{sid}-quote")
    bar, author, role = _find(els, f"{sid}-bar"), _find(els, f"{sid}-author"), _find(els, f"{sid}-role")
    if kind == "center":
        _center(mark, (W - 300) // 2, 300)
        for e in (q, author, role):
            _center(e, 210, 1500)
        bar["x"] = (W - bar["w"]) // 2
    elif kind == "side":
        els.remove(mark)
        els.append(shape(f"{sid}-rule", M, 300, 10, 480, fill="--accent", radius=5, z=2))
        for e in (q, author, role, bar):
            e["x"] = M + 60
        q.update(y=300, w=1520)
        bar.update(y=800)
        author["y"], role["y"] = 830, 884
    return els


# ── team ───────────────────────────────────────────────────────────────────


def team(kind, els, sid):
    for e in els:
        if e["id"].startswith(f"{sid}-avatar"):
            num = e["id"][len(f"{sid}-avatar"):]
            ini = _find(els, f"{sid}-initials{num}")
            if kind == "square":
                e.update(shape="rect", radius=36)
            elif kind == "filled":
                e.update(fill="--accent", stroke="--accent")
                ini["style"]["color"] = "--accent-contrast"
            elif kind == "soft":
                e.update(fill="--accent", stroke="--accent", opacity=0.16)
                e.pop("animation", None)
    return els


# ── section, closing ───────────────────────────────────────────────────────


def section(kind, els, sid):
    if kind == "center":
        for k in ("number", "title", "subtitle"):
            _center(_find(els, f"{sid}-{k}"))
        bar = _find(els, f"{sid}-bar")
        bar["x"] = (W - bar["w"]) // 2
    elif kind == "split":
        els.append(shape(f"{sid}-panel", 0, 0, 720, H, fill="--accent", z=0))
        num = _find(els, f"{sid}-number")
        num.update(x=M, y=380, w=480)
        num["style"]["color"] = "--accent-contrast"
        for k in ("bar", "title", "subtitle"):
            el = _find(els, f"{sid}-{k}")
            el["x"] = 840
            if el["type"] == "text":
                el["w"] = 940
        _find(els, f"{sid}-bar")["y"] = 400
        _find(els, f"{sid}-title")["y"] = 440
        _find(els, f"{sid}-subtitle")["y"] = 660
    elif kind == "outline":
        num = _find(els, f"{sid}-number")
        num["style"]["size"] = 320
        num.update(y=120, h=380, opacity=0.9)
    return els


def closing(kind, els, sid):
    if kind == "center":
        for e in els:
            if e["type"] == "text" and e["id"] in (f"{sid}-title", f"{sid}-subtitle"):
                _center(e)
        bar = _find(els, f"{sid}-bar")
        bar["x"] = (W - bar["w"]) // 2
        n = sum(1 for e in els if e["id"].startswith(f"{sid}-contact"))
        for i in range(1, n + 1):
            ic, ct = _find(els, f"{sid}-icon{i}"), _find(els, f"{sid}-contact{i}")
            span = 56 + len(_txt(ct)) * 18
            x0 = round((W - span) / 2)
            ic["x"] = x0
            ct.update(x=x0 + 76, w=span)
    return els


# ── code panel ─────────────────────────────────────────────────────────────


def code_panel(els, sid, opts):
    code = _find(els, f"{sid}-code")
    if not code:
        return els
    panel = _find(els, f"{sid}-panel")
    body = _find(els, f"{sid}-body")
    if opts.get("code_wide"):
        body["w"] = 940
        panel.update(x=1140, w=640)
        code.update(x=1140, w=640)
    code.update(y=420, h=500, x=panel["x"], w=panel["w"])
    panel.update(y=360, h=560)
    code["size"] = opts.get("code_size", 22)
    if opts.get("code_highlight"):
        code["highlight"] = opts["code_highlight"]
    for i, tok in enumerate(("--accent", "--accent-2", "--muted")):
        els.append(shape(f"{sid}-light{i}", panel["x"] + 24 + i * 30, 380, 16, 16, "ellipse", fill=tok, z=3))
    if opts.get("code_file"):
        els.append(text(f"{sid}-file", panel["x"] + 130, 370, panel["w"] - 150, 36, opts["code_file"],
                        role="caption", font="mono", size=22, color="--muted", lh=1.4))
    return els


def divider_arrow(els, sid):
    d = _find(els, f"{sid}-divider")
    if d:
        els.remove(d)
        els.append(shape(f"{sid}-arrow", 820, 400, 130, 24, "arrow", stroke="--accent", sw=4, z=2))
    return els


def footer_line(els, sid):
    if _find(els, f"{sid}-footer"):
        els.append(shape(f"{sid}-footline", M, 978, CONTENT_W, 1, fill="--border", z=1))
    return els


# ── hook ───────────────────────────────────────────────────────────────────


def make_post(style):
    def post(t, content, sid, n, layout, bg, els):
        s = dict(style, **content.get("style", {}))
        if layout == "title":
            els = cover(s.get("cover", "default"), t, els, sid, s, content)
        elif layout == "section":
            els = section(s.get("section", "default"), els, sid)
        elif layout == "image-text":
            els = image_text(s.get("image", "default"), t, els, sid, s)
        elif layout == "quote":
            els = quote(s.get("quote", "default"), els, sid)
        elif layout == "key-numbers":
            els = figures(s.get("figures", "default"), t, els, sid)
        elif layout == "team":
            els = team(s.get("avatar", "ring"), els, sid)
        elif layout == "thanks":
            els = closing(s.get("closing", "default"), els, sid)
        elif layout == "text":
            els = code_panel(els, sid, s)
        elif layout == "two-columns" and s.get("columns_arrow"):
            els = divider_arrow(els, sid)
        if layout in HEADER_LAYOUTS:
            els = header(s.get("header", "bar"), els, sid, n, s)
        if s.get("footer_line") and layout in CONTENT_LAYOUTS:
            els = footer_line(els, sid)
        pat_on = s.get("pattern_on", CONTENT_LAYOUTS)
        if s.get("pattern") and layout in pat_on:
            els = pattern(s["pattern"], sid, s) + els
        for extra in content.get("extra", []):
            els.append(dict(extra, id=f"{sid}-{extra['id']}"))
        if s.get("bg") and layout in s.get("bg_on", HEADER_LAYOUTS):
            bg = s["bg"]
        return bg, els

    return post
