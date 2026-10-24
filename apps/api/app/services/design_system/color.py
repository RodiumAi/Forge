"""Colour maths for design systems: hex parsing, WCAG contrast, contrast repair.

Contrast follows WCAG 2.2 (relative luminance, ratio from 1 to 21). A pair is
"AA" at 4.5 for body text, "AA-large" at 3 (large text and UI components) and
"AAA" at 7. ``ensure_contrast`` moves a foreground colour toward black or white
in small steps until a target ratio is reached, keeping its hue, so a palette
the model or a website proposed stays recognisable after repair.
"""

from __future__ import annotations

import re

HEX_RE = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

AA = 4.5
AA_LARGE = 3.0
AAA = 7.0

RGB = tuple[float, float, float]


def normalize_hex(raw: object) -> str | None:
    """``#rrggbb`` lower case, or None. Alpha in ``#rrggbbaa`` is dropped."""
    if not isinstance(raw, str):
        return None
    match = HEX_RE.match(raw.strip())
    if not match:
        return None
    body = match.group(1).lower()
    if len(body) == 3:
        body = "".join(ch * 2 for ch in body)
    return f"#{body[:6]}"


def to_rgb(hex_value: str) -> RGB:
    value = normalize_hex(hex_value)
    if value is None:
        raise ValueError(f"not a hex colour: {hex_value!r}")
    return (int(value[1:3], 16) / 255, int(value[3:5], 16) / 255, int(value[5:7], 16) / 255)


def to_hex(rgb: RGB) -> str:
    return "#" + "".join(f"{max(0, min(255, round(channel * 255))):02x}" for channel in rgb)


def _linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_value: str) -> float:
    r, g, b = (_linear(c) for c in to_rgb(hex_value))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def wcag_level(ratio: float) -> str:
    if ratio >= AAA:
        return "AAA"
    if ratio >= AA:
        return "AA"
    if ratio >= AA_LARGE:
        return "AA-large"
    return "fail"


def is_dark(hex_value: str) -> bool:
    return luminance(hex_value) < 0.18


def mix(a: str, b: str, weight: float) -> str:
    """``a`` moved ``weight`` (0..1) of the way toward ``b``."""
    ra, rb = to_rgb(a), to_rgb(b)
    return to_hex(tuple(x + (y - x) * weight for x, y in zip(ra, rb, strict=True)))  # type: ignore[arg-type]


def best_text_on(background: str, *, dark: str = "#0b0b0f", light: str = "#ffffff") -> str:
    """The more readable of a near-black and white on ``background``."""
    return dark if contrast_ratio(dark, background) >= contrast_ratio(light, background) else light


def ensure_contrast(foreground: str, background: str, target: float = AA) -> str:
    """``foreground`` adjusted (toward black or white) until it reaches ``target``.

    Returns the original colour when it already passes. Moves toward whichever
    extreme gives more contrast with the background; falls back to that
    extreme when even it cannot reach the target (only for mid-grey
    backgrounds with a target above about 5).
    """
    fg = normalize_hex(foreground) or "#000000"
    bg = normalize_hex(background) or "#ffffff"
    if contrast_ratio(fg, bg) >= target:
        return fg
    extreme = "#000000" if contrast_ratio("#000000", bg) >= contrast_ratio("#ffffff", bg) else "#ffffff"
    for step in range(1, 21):
        candidate = mix(fg, extreme, step / 20)
        if contrast_ratio(candidate, bg) >= target:
            return candidate
    return extreme
