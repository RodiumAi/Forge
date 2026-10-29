"""DrawingML colours: theme scheme, colour map and modifiers, resolved to hex.

A shape names its colour in many ways (``srgbClr``, ``schemeClr`` through the
master's colour map, ``sysClr``, ``prstClr``...) and adjusts it with child
modifiers (``lumMod``, ``tint``, ``alpha``...). Everything ends up as a
literal ``#RRGGBB`` (or ``#RRGGBBAA`` when transparent), which is what a Forge
slide stores when it keeps the original look.
"""

from __future__ import annotations

import colorsys
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from .archive import kid, kids, local

#: Default colour map of a master (``p:clrMap``).
DEFAULT_MAP = {
    "bg1": "lt1",
    "tx1": "dk1",
    "bg2": "lt2",
    "tx2": "dk2",
    "accent1": "accent1",
    "accent2": "accent2",
    "accent3": "accent3",
    "accent4": "accent4",
    "accent5": "accent5",
    "accent6": "accent6",
    "hlink": "hlink",
    "folHlink": "folHlink",
}

DEFAULT_SCHEME = {
    "dk1": "000000",
    "lt1": "FFFFFF",
    "dk2": "44546A",
    "lt2": "E7E6E6",
    "accent1": "4472C4",
    "accent2": "ED7D31",
    "accent3": "A5A5A5",
    "accent4": "FFC000",
    "accent5": "5B9BD5",
    "accent6": "70AD47",
    "hlink": "0563C1",
    "folHlink": "954F72",
}

# The preset colours decks actually use; the rest fall back to black.
PRESET = {
    "black": "000000",
    "white": "FFFFFF",
    "red": "FF0000",
    "green": "008000",
    "lime": "00FF00",
    "blue": "0000FF",
    "yellow": "FFFF00",
    "cyan": "00FFFF",
    "magenta": "FF00FF",
    "gray": "808080",
    "grey": "808080",
    "darkGray": "A9A9A9",
    "lightGray": "D3D3D3",
    "orange": "FFA500",
    "purple": "800080",
    "navy": "000080",
    "teal": "008080",
    "maroon": "800000",
    "olive": "808000",
    "silver": "C0C0C0",
}

_COLOR_TAGS = {"srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr", "hslClr"}


@dataclass
class Theme:
    colors: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_SCHEME))
    major_font: str = ""
    minor_font: str = ""
    #: Line widths of ``a:lnStyleLst`` (EMU), for ``p:style/a:lnRef``.
    line_widths: list[int] = field(default_factory=list)


def read_theme(root: ET.Element | None) -> Theme:
    theme = Theme()
    if root is None:
        return theme
    elements = kid(root, "themeElements")
    scheme = kid(elements, "clrScheme")
    for slot in list(scheme) if scheme is not None else []:
        value = _base_hex(next(iter(slot), None), {})
        if value:
            theme.colors[local(slot.tag)] = value
    fonts = kid(elements, "fontScheme")
    for attr, slot in (("major_font", "majorFont"), ("minor_font", "minorFont")):
        latin = kid(kid(fonts, slot), "latin")
        setattr(theme, attr, latin.get("typeface", "") if latin is not None else "")
    lines = kid(kid(elements, "fmtScheme"), "lnStyleLst")
    theme.line_widths = [int(ln.get("w") or 9525) for ln in kids(lines, "ln")]
    return theme


def read_map(el: ET.Element | None) -> dict[str, str]:
    """``p:clrMap`` (or an override) as a dict; the default map when absent."""
    if el is None:
        return dict(DEFAULT_MAP)
    out = dict(DEFAULT_MAP)
    out.update({key: value for key, value in el.attrib.items() if key in DEFAULT_MAP})
    return out


@dataclass
class Palette:
    """What resolving a colour needs: the theme, the colour map, ``phClr``."""

    theme: Theme
    color_map: dict[str, str]
    placeholder: str | None = None

    def with_placeholder(self, value: str | None) -> Palette:
        return Palette(self.theme, self.color_map, value)


def _base_hex(
    el: ET.Element | None, scheme_lookup: dict[str, str], palette: Palette | None = None
) -> str | None:
    if el is None:
        return None
    tag = local(el.tag)
    if tag == "srgbClr":
        value = (el.get("val") or "").upper()
        return value if len(value) == 6 and all(c in "0123456789ABCDEF" for c in value) else None
    if tag == "sysClr":
        value = (el.get("lastClr") or "").upper()
        if len(value) == 6:
            return value
        return "FFFFFF" if el.get("val") == "window" else "000000"
    if tag == "prstClr":
        return PRESET.get(el.get("val") or "", "000000")
    if tag == "scrgbClr":
        parts = [_pct(el.get(k)) for k in ("r", "g", "b")]
        return "".join(f"{round(_gamma(v) * 255):02X}" for v in parts)
    if tag == "hslClr":
        hue = int(el.get("hue") or 0) / 60000 / 360
        r, g, b = colorsys.hls_to_rgb(hue % 1, _pct(el.get("lum")), _pct(el.get("sat")))
        return _hex(r, g, b)
    if tag == "schemeClr" and palette is not None:
        name = el.get("val") or ""
        if name == "phClr":
            return palette.placeholder or palette.theme.colors.get("dk1")
        slot = palette.color_map.get(name, name)
        return palette.theme.colors.get(slot) or DEFAULT_SCHEME.get(slot)
    return None


def _pct(value: str | None) -> float:
    try:
        return max(0.0, min(1.0, int(value or 0) / 100000))
    except ValueError:
        return 0.0


def _gamma(linear: float) -> float:
    return 12.92 * linear if linear <= 0.0031308 else 1.055 * linear ** (1 / 2.4) - 0.055


def _hex(r: float, g: float, b: float) -> str:
    return "".join(f"{max(0, min(255, round(v * 255))):02X}" for v in (r, g, b))


def _rgb(value: str) -> tuple[float, float, float]:
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _apply(value: str, el: ET.Element) -> tuple[str, float]:
    """Apply the modifiers under a colour element; returns (hex, alpha)."""
    r, g, b = _rgb(value)
    alpha = 1.0
    for mod in el:
        name = local(mod.tag)
        try:
            amount = int(mod.get("val") or 0) / 100000
        except ValueError:
            continue
        if name in ("lumMod", "lumOff", "satMod", "satOff", "hueMod", "hueOff"):
            h, lum, s = colorsys.rgb_to_hls(r, g, b)
            if name == "lumMod":
                lum *= amount
            elif name == "lumOff":
                lum += amount
            elif name == "satMod":
                s *= amount
            elif name == "satOff":
                s += amount
            elif name == "hueMod":
                h = (h * amount) % 1
            else:
                h = (h + amount * 100000 / 60000 / 360) % 1
            r, g, b = colorsys.hls_to_rgb(h, max(0.0, min(1.0, lum)), max(0.0, min(1.0, s)))
        elif name == "tint":
            r, g, b = (c * amount + (1 - amount) for c in (r, g, b))
        elif name == "shade":
            r, g, b = (c * amount for c in (r, g, b))
        elif name == "inv":
            r, g, b = (1 - c for c in (r, g, b))
        elif name == "gray":
            gray = 0.3 * r + 0.59 * g + 0.11 * b
            r = g = b = gray
        elif name == "alpha":
            alpha = max(0.0, min(1.0, amount))
        elif name == "alphaMod":
            alpha = max(0.0, min(1.0, alpha * amount))
        elif name == "alphaOff":
            alpha = max(0.0, min(1.0, alpha + amount))
    return _hex(r, g, b), alpha


def color_of(container: ET.Element | None, palette: Palette) -> str | None:
    """``#RRGGBB[AA]`` of the colour element directly under ``container``."""
    if container is None:
        return None
    el = next((child for child in container if local(child.tag) in _COLOR_TAGS), None)
    if el is None:
        return None
    base = _base_hex(el, {}, palette)
    if base is None:
        return None
    value, alpha = _apply(base, el)
    return to_css(value, alpha)


def to_css(value: str, alpha: float = 1.0) -> str:
    if alpha >= 0.999:
        return f"#{value}"
    return f"#{value}{round(alpha * 255):02X}"


def raw_hex(el: ET.Element | None, palette: Palette) -> str | None:
    """Colour of a bare colour element (``a:schemeClr`` itself), modifiers applied."""
    if el is None or local(el.tag) not in _COLOR_TAGS:
        return None
    base = _base_hex(el, {}, palette)
    if base is None:
        return None
    value, alpha = _apply(base, el)
    return to_css(value, alpha)
