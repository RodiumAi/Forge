"""Draw the brand marks of the six design system kits (one-off tool, needs fontTools).

Writes icon.svg, logo.svg (light ground) and logo-dark.svg (dark ground) per kit into
apps/api/scripts/design_system_kits/brands/<id>/. Wordmarks are outlined from the
brand's display font so they render the same everywhere, without any web font.

Not part of the app: fontTools is not a project dependency. To redraw:

    uv pip install --target <dir> fonttools brotli
    PYTHONPATH=<dir> python draw_brandmarks.py <ttf folder> brands

The ttf folder holds the static Google Fonts files named in KITS (Inter-600.ttf,
Manrope-800.ttf, ...). Then run build_kits.py to copy the marks into the kits.
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS = Path(sys.argv[1])
OUT = Path(sys.argv[2])


def _rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _lum(h: str) -> float:
    def ch(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(c) for c in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def mix(a: str, b: str, t: float) -> str:
    ra, rb = _rgb(a), _rgb(b)
    return "#" + "".join(f"{round((x + (y - x) * t) * 255):02x}" for x, y in zip(ra, rb, strict=True))


def readable(color: str, ground: str, need: float) -> str:
    target = "#ffffff" if _lum(ground) < 0.2 else "#000000"
    t = 0.0
    while contrast(color, ground) < need and t < 1:
        t += 0.05
        color = mix(color, target, 0.05 / max(1 - t + 0.05, 0.05))
    return color


def outline(text: str, font_file: str, size: float, tracking: float) -> tuple[str, float, float]:
    """SVG path of `text` at `size` units, baseline at y=0. Returns (d, width, cap height)."""
    font = TTFont(FONTS / font_file)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    scale = size / upm
    cap = (getattr(font["OS/2"], "sCapHeight", 0) or upm * 0.7) * scale
    hmtx = font["hmtx"]
    x = 0.0
    parts: list[str] = []
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None:
            raise SystemExit(f"{font_file}: no glyph for {ch!r}")
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        d = pen.getCommands()
        if d:
            parts.append(d)
        x += hmtx[name][0] * scale + tracking * size
    width = x - tracking * size
    return " ".join(parts), width, cap


# Icons on a 100 x 100 grid, single colour, drawn as fills (or strokes for the fine luxury arch).
ICONS: dict[str, str] = {
    # Ardoise: three ascending columns, the board of a product team moving forward.
    "design-system-saas": (
        '<rect x="12" y="52" width="20" height="36" rx="6"/>'
        '<rect x="40" y="32" width="20" height="56" rx="6"/>'
        '<rect x="68" y="12" width="20" height="76" rx="6"/>'
    ),
    # Nuvia: one continuous rounded stroke drawing the N, money that flows.
    "design-system-fintech": (
        '<path d="M22 80V24L78 76V20" fill="none" stroke="currentColor" stroke-width="18" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    # Soina: two leaves growing from one stem, care that grows.
    "design-system-sante": (
        '<path d="M48 90C26 84 12 64 14 30C38 34 52 56 48 90Z"/>'
        '<path d="M53 90C50 54 64 26 88 16C94 52 80 80 53 90Z"/>'
    ),
    # Kalo: an open book and the learner above it.
    "design-system-education": (
        '<circle cx="50" cy="17" r="11"/>'
        '<path d="M46 40C36 33 22 31 10 34V82C22 79 36 81 46 89Z"/>'
        '<path d="M54 40C64 33 78 31 90 34V82C78 79 64 81 54 89Z"/>'
    ),
    # Studio Ondé: a hard block with a wave for a top edge (onde: the wave).
    "design-system-creatif": (
        '<path d="M10 90V42C22 22 36 22 48 42S74 62 90 42V90Z"/>'
    ),
    # Maison Orée: the arch of the workshop door at the edge of the woods, a sun on the horizon.
    "design-system-luxe": (
        '<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="square">'
        '<path d="M26 88V46a24 24 0 0 1 48 0V88"/>'
        '<path d="M14 88H86"/>'
        '<path d="M26 68H74"/>'
        '<path d="M41 68a9 9 0 0 1 18 0"/>'
        "</g>"
    ),
}

KITS: dict[str, dict] = {
    "design-system-saas": {"text": "Ardoise", "font": "Inter-600.ttf", "track": -0.02,
                           "accent": "#2563eb", "ink": "#0f172a", "paper": "#ffffff"},
    "design-system-fintech": {"text": "nuvia", "font": "Manrope-800.ttf", "track": -0.03,
                              "accent": "#10b981", "ink": "#0b1220", "paper": "#e8eef8"},
    "design-system-sante": {"text": "soina", "font": "Lexend-500.ttf", "track": -0.01,
                            "accent": "#0f766e", "ink": "#16302b", "paper": "#fbfaf6", "dark_icon": "#4fb8a8"},
    "design-system-education": {"text": "kalo", "font": "Fredoka-600.ttf", "track": 0.0,
                                "accent": "#c2410c", "ink": "#1f2a44", "paper": "#fffaf3"},
    "design-system-creatif": {"text": "Studio Ondé", "font": "Syne-800.ttf", "track": -0.02,
                              "accent": "#d6246e", "ink": "#141414", "paper": "#fff7ec"},
    "design-system-luxe": {"text": "MAISON ORÉE", "font": "CormorantGaramond-500.ttf", "track": 0.16, "icon": 2.1,
                           "accent": "#c8a96a", "ink": "#0c0a09", "paper": "#f2ece4", "light_icon": "#8c6b3f"},
}

DARK_GROUND = "#14161b"


def icon_svg(kit_id: str, color: str, size: int = 512) -> str:
    body = ICONS[kit_id]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 100 100" '
        f'fill="{color}" color="{color}">{body}</svg>\n'
    )


def lockup(kit_id: str, spec: dict, icon_color: str, text_color: str) -> str:
    size = 100.0
    d, width, cap = outline(spec["text"], spec["font"], size, spec["track"])
    icon_h = cap * spec.get("icon", 1.85)
    gap = icon_h * 0.36
    pad = icon_h * 0.3
    # Icon sits centred on the cap height; text baseline at y=0 before translation.
    icon_y = -cap / 2 - icon_h / 2
    total_w = pad + icon_h + gap + width + pad
    top = icon_y - pad
    h = icon_h + 2 * pad
    k = icon_h / 100
    vb = f"0 {top:.2f} {total_w:.2f} {h:.2f}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{round(total_w * 4)}" height="{round(h * 4)}" '
        f'viewBox="{vb}" role="img" aria-label="{spec["text"].title() if spec["text"].isupper() else spec["text"]}">'
        f'<g transform="translate({pad:.2f} {icon_y:.2f}) scale({k:.4f})" fill="{icon_color}" color="{icon_color}">'
        f"{ICONS[kit_id]}</g>"
        f'<path transform="translate({pad + icon_h + gap:.2f} 0)" fill="{text_color}" d="{d}"/>'
        "</svg>\n"
    )


def main() -> None:
    for kit_id, spec in KITS.items():
        folder = OUT / kit_id
        folder.mkdir(parents=True, exist_ok=True)
        accent = spec["accent"]
        light_icon = spec.get("light_icon") or readable(accent, "#ffffff", 3.0)
        dark_icon = spec.get("dark_icon") or readable(accent, DARK_GROUND, 4.0)
        light_text = spec["ink"] if _lum(spec["ink"]) < 0.2 else "#111111"
        dark_text = spec["paper"] if _lum(spec["paper"]) > 0.6 else "#ffffff"
        (folder / "icon.svg").write_text(icon_svg(kit_id, accent), encoding="utf-8")
        (folder / "logo.svg").write_text(lockup(kit_id, spec, light_icon, light_text), encoding="utf-8")
        (folder / "logo-dark.svg").write_text(lockup(kit_id, spec, dark_icon, dark_text), encoding="utf-8")
        print("drew", kit_id, light_icon, dark_icon)


if __name__ == "__main__":
    main()
