"""Rough visual check of a slides kit: renders every slide with plain DOM and screenshots a contact sheet."""
import html
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

kit = Path(sys.argv[1])
out = Path(sys.argv[2])
design = (kit / "DESIGN.md").read_text(encoding="utf-8")
tokens = dict(re.findall(r"- `(--[a-z0-9-]+)`: (#[0-9A-Fa-f]{6})", design))
fonts = {k.lower(): v.strip() for k, v in re.findall(r"- (Display|Body|Mono) font: (.+)", design)}
deck = json.loads((kit / "deck.json").read_text(encoding="utf-8"))


def col(v):
    return tokens.get(v, v) if v else "transparent"


def inline_html(b):
    if "runs" in b:
        return "".join(html.escape(r["text"]) for r in b["runs"])
    return html.escape(b.get("text", ""))


def el_html(e):
    st = f"position:absolute;left:{e['x']}px;top:{e['y']}px;width:{e['w']}px;height:{e['h']}px;z-index:{e.get('z', 0)};opacity:{e.get('opacity', 1)};outline:1px dashed rgba(255,0,0,.25);"
    t = e["type"]
    if t == "text":
        s = e.get("style", {})
        fam = fonts.get(s.get("font", "body"), "sans-serif")
        st += f"font-family:'{fam}';font-size:{s.get('size', 32)}px;font-weight:{s.get('weight', 400)};color:{col(s.get('color', '--fg'))};text-align:{s.get('align', 'left')};line-height:{s.get('lineHeight', 1.3)};letter-spacing:{s.get('letterSpacing', 0)}px;"
        if s.get("uppercase"):
            st += "text-transform:uppercase;"
        if s.get("italic"):
            st += "font-style:italic;"
        if s.get("valign") == "middle":
            st += "display:flex;flex-direction:column;justify-content:center;"
        inner = ""
        for b in e["content"]:
            if b["type"] == "paragraph":
                inner += f"<p style='margin:0'>{inline_html(b)}</p>"
            else:
                tag = "ul" if b["type"] == "bullet-list" else "ol"
                inner += f"<{tag} style='margin:0;padding-left:1.2em'>" + "".join(f"<li>{inline_html(i)}</li>" for i in b["items"]) + f"</{tag}>"
        return f"<div style=\"{st}\">{inner}</div>"
    if t == "image":
        return f"<img src='{(kit / e['src']).as_uri()}' style=\"{st}object-fit:cover;border-radius:{e.get('radius', 0)}px\">"
    if t == "shape":
        r = "50%" if e["shape"] == "ellipse" else f"{e.get('radius', 0)}px"
        return f"<div style=\"{st}background:{col(e.get('fill'))};border:{e.get('strokeWidth', 0)}px solid {col(e.get('stroke'))};border-radius:{r};box-sizing:border-box\"></div>"
    if t == "icon":
        return f"<div style=\"{st}border:3px solid {col(e.get('color'))};border-radius:30%;box-sizing:border-box;font-size:12px;color:{col(e.get('color'))}\">{e['icon']}</div>"
    if t == "table":
        s = e.get("style", {})
        rows = "".join("<tr>" + "".join(f"<td style='border-bottom:1px solid {col(s.get('border'))};padding:18px 24px;{'background:' + col(s.get('headerFill')) + ';font-weight:700' if i == 0 else ''}'>{inline_html(c)}</td>" for c in r) + "</tr>" for i, r in enumerate(e["rows"]))
        return f"<table style=\"{st}border-collapse:collapse;font-family:'{fonts['body']}';font-size:{s.get('size', 28)}px;color:{col(s.get('color'))}\">{rows}</table>"
    if t == "chart":
        vals = e["data"]["series"][0]["values"]
        mx = max(vals) or 1
        bars = "".join(f"<div style='flex:1;margin:0 8px;background:{col(e['data']['series'][0].get('color', '--accent'))};height:{v / mx * 90}%'></div>" for v in vals)
        return f"<div style=\"{st}display:flex;align-items:flex-end;border-bottom:2px solid {col('--border')}\">{bars}</div>"
    if t == "code":
        return f"<pre style=\"{st}margin:0;font-family:'{fonts['mono']}';font-size:{e.get('size', 22)}px;color:{col('--fg')};white-space:pre\">{html.escape(e['code'])}</pre>"
    return f"<div style=\"{st}\"></div>"


def bg_css(bg):
    if not bg:
        return f"background:{col('--bg')}"
    if bg["type"] == "color":
        return f"background:{col(bg['token'])}"
    if bg["type"] == "gradient":
        stops = ",".join(f"{col(s['color'])} {s['at'] * 100}%" for s in bg["stops"])
        return f"background:linear-gradient({bg.get('angle', 180)}deg,{stops})"
    return f"background:{col('--bg')} url('{(kit / bg['src']).as_uri()}') center/cover"


fam = "|".join(f.replace(" ", "+") + ":ital,wght@0,400;0,600;0,700;1,400" for f in set(fonts.values()))
parts = []
for ref in deck["slides"]:
    s = json.loads((kit / "slides" / f"{ref['id']}.json").read_text(encoding="utf-8"))
    overlay = ""
    bg = s.get("background")
    if bg and bg["type"] == "image" and bg.get("overlay"):
        overlay = f"<div style='position:absolute;inset:0;background:{col(bg['overlay'])};opacity:{bg.get('overlayOpacity', 0.5)}'></div>"
    parts.append(f"<div class='slide' style=\"{bg_css(bg)}\">{overlay}{''.join(el_html(e) for e in s['elements'])}</div>")
doc = f"""<html><head><link rel=stylesheet href="https://fonts.googleapis.com/css2?family={fam}&display=block">
<style>body{{margin:0;width:3880px;display:flex;flex-wrap:wrap;gap:40px;background:#888}} .slide{{position:relative;width:1920px;height:1080px;overflow:hidden;color:{col('--fg')}}}</style></head>
<body>{''.join(parts)}</body></html>"""
page_file = out.with_suffix(".html")
page_file.write_text(doc, encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 3880, "height": 1000})
    pg.goto(page_file.as_uri())
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out), full_page=True)
    b.close()
from PIL import Image
im = Image.open(out)
im.thumbnail((1900, 4000))
im.save(out)
