"""A text wordmark used as the logo until the brand uploads its own.

The showcase, the brand site and the logo rules need a file to point at; a
generated SVG wordmark (the name in the display font on the accent colour)
keeps them meaningful from the first minute. It is replaced as soon as a real
logo is uploaded.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

from app.services.design_system.color import best_text_on, normalize_hex


def initials(name: str) -> str:
    words = [w for w in (name or "").replace("-", " ").split() if w[:1].isalnum()]
    letters = "".join(w[0] for w in words[:2]).upper()
    return letters or "R"


def wordmark_svg(name: str, accent: str, fg: str, font: str = "Inter") -> str:
    """A 96 px high SVG: a rounded monogram tile and the brand name."""
    accent = normalize_hex(accent) or "#f2620a"
    fg = normalize_hex(fg) or "#111111"
    on_accent = best_text_on(accent)
    raw = (name or "Brand").strip()[:28]
    label = escape(raw, {'"': "&quot;"})
    family = escape(font or "Inter", {'"': "&quot;"})
    width = max(200, 104 + 18 * len(raw))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="96" viewBox="0 0 {width} 96" '
        f'role="img" aria-label="{label}">'
        f'<rect x="8" y="16" width="64" height="64" rx="16" fill="{accent}"/>'
        f'<text x="40" y="59" text-anchor="middle" font-family="{family}, sans-serif" font-size="28" '
        f'font-weight="700" fill="{on_accent}">{escape(initials(name))}</text>'
        f'<text x="88" y="60" font-family="{family}, sans-serif" font-size="30" font-weight="700" '
        f'fill="{fg}">{label}</text>'
        "</svg>\n"
    )
