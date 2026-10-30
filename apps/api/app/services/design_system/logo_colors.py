"""The real colours of an uploaded logo, measured from its pixels.

Vision models describe a logo's colours loosely (a teal becomes a green, a
blue is darkened), so the palette drifts from the brand. The generation gets
the measured colours as exact values, and ``align_palette`` brings accent and
secondary back onto them when the answer still strays.
"""

from __future__ import annotations

import io
import math
from collections import Counter

from app.services.design_system.color import contrast_ratio, normalize_hex, to_rgb

# Colours closer than this (RGB distance) are the same brand colour.
_MERGE = 42.0
# A colour must cover this share of the opaque pixels to count.
_MIN_SHARE = 0.03
# An accent further than this from every logo colour is not the logo's.
_STRAY = 18.0


def _distance(a: str, b: str) -> float:
    return math.dist(to_rgb(a), to_rgb(b)) * 255


def _is_background(rgb: tuple[int, int, int]) -> bool:
    """Near white: the canvas a logo is usually exported on."""
    return min(rgb) > 238


def measure_logo_colors(data: bytes, limit: int = 6) -> list[str]:
    """The logo's main colours as ``#rrggbb``, by area, most present first.

    Transparent pixels and a near-white canvas are ignored. Returns an empty
    list when the image cannot be read.
    """
    try:
        from PIL import Image

        image = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        return []
    image.thumbnail((160, 160))
    flat = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
    counts = Counter((r, g, b) for r, g, b, a in flat if a >= 128 and not _is_background((r, g, b)))
    total = sum(counts.values())
    if not total:
        return []

    # Most present first, so anti-aliased edge pixels merge into the colour they border.
    clusters: list[tuple[str, int]] = []
    for rgb, count in counts.most_common():
        hex_value = "#{:02x}{:02x}{:02x}".format(*rgb)
        for i, (existing, seen) in enumerate(clusters):
            if _distance(existing, hex_value) < _MERGE:
                clusters[i] = (existing, seen + count)
                break
        else:
            clusters.append((hex_value, count))
    kept = [
        hex_value for hex_value, count in sorted(clusters, key=lambda c: -c[1]) if count / total >= _MIN_SHARE
    ]
    return kept[:limit]


def logo_colors_prompt(colors: list[str]) -> str:
    listed = ", ".join(colors)
    return (
        f"Colours measured in the logo pixels (by area, exact values): {listed}. "
        "The palette must follow them: accent is one of these exact hex values, secondary another one "
        "when the logo has several, and every one of them appears in colors as brand-1, brand-2... "
        "Do not invent a brand hue that is not in the logo (status colours excepted)."
    )


def align_palette(colors: dict[str, str], logo: list[str]) -> dict[str, str]:
    """``colors`` with accent and secondary on the logo, and the logo colours as brand-N.

    Leaves a colour alone when it is already one of the logo's (or very close).
    The accent keeps the logo colour that reads best on the background, so the
    contrast repair that follows changes it as little as possible.
    """
    logo = [c for c in (normalize_hex(v) for v in logo) if c]
    if not logo:
        return colors
    out = {name: value for name, value in colors.items() if not name.startswith("brand-")}
    bg = out.get("bg", "#ffffff")

    def strays(name: str) -> bool:
        value = out.get(name)
        return not value or min(_distance(value, c) for c in logo) > _STRAY

    if strays("accent"):
        out["accent"] = max(logo, key=lambda c: min(contrast_ratio(c, bg), 4.5) + logo[::-1].index(c) * 0.01)
    if len(logo) > 1 and (strays("secondary") or _distance(out.get("secondary", ""), out["accent"]) < _MERGE):
        others = [c for c in logo if _distance(c, out["accent"]) >= _MERGE]
        if others:
            out["secondary"] = others[0]
    for i, value in enumerate(logo, start=1):
        out[f"brand-{i}"] = value
    return out
