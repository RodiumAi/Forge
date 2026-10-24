"""Design system documents: built from a compact spec, checked, and read back.

The model (and the template authoring scripts) never write W3C tokens by hand.
They write a ``Spec``: a palette by role, three font families, a type scale, a
spacing unit, radii, a shadow and a motion preset, plus the written guidance.
``build_document`` turns a spec into a complete ``design-system.json``:

* colours with their role and the WCAG contrast of the pairs that matter,
  repaired when a pair fails (``forge.contrast`` in each token's extensions);
* font families from the curated Google Fonts list, with fallback stacks;
* a modular type scale (``text``), weights, line heights and composite
  ``typography`` tokens;
* spacing, radii, shadows, durations and an easing curve;
* iconography as ``icon`` tokens (library, style, stroke, sizes).

Each part is built by its own function so a targeted edit rebuilds one section
and leaves the rest of the document, including hand edits, untouched.
``spec_from_document`` reads a document back into a spec (small hints are kept
in ``$extensions``), which is what a section edit merges into.
"""

from __future__ import annotations

import copy
import re
from typing import Any, Literal
from urllib.parse import quote_plus

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.contracts.forge_design import dump_document, validate_design_system
from app.services.brand_charter import GOOGLE_FONTS
from app.services.design_system.color import (
    AA,
    AA_LARGE,
    best_text_on,
    contrast_ratio,
    ensure_contrast,
    is_dark,
    mix,
    normalize_hex,
    wcag_level,
)
from app.services.typography import strip_long_dashes

SECTIONS: tuple[str, ...] = (
    "colors",
    "typography",
    "spacing",
    "logo",
    "iconography",
    "imagery",
    "voice",
    "guidelines",
    "components",
)
COMPONENTS: tuple[str, ...] = ("button", "input", "card", "badge", "alert", "table")
LOGO_PATH = "public/brand/logo.svg"
#: Prefix of a logo usage line that describes a misuse (shown as "don't").
MISUSE_PREFIX = "Avoid: "

REQUIRED_COLORS = ("bg", "surface", "fg", "muted", "accent", "border")
SEMANTIC_COLORS = ("success", "warning", "danger", "info")

ROLES: dict[str, str] = {
    "bg": "Page and slide background",
    "surface": "Cards, panels and inputs",
    "fg": "Main text",
    "muted": "Secondary text",
    "accent": "Brand accent: buttons, links, highlights",
    "accent-contrast": "Text and icons on the accent colour",
    "secondary": "Secondary brand colour",
    "border": "Hairlines, dividers and input borders",
    "success": "Positive status",
    "warning": "Warning status",
    "danger": "Errors and destructive actions",
    "info": "Neutral information",
}

#: (foreground, background, minimum ratio, what the pair is used for).
CONTRAST_PAIRS: tuple[tuple[str, str, float, str], ...] = (
    ("fg", "bg", AA, "Body text"),
    ("fg", "surface", AA, "Text on cards"),
    ("muted", "bg", AA, "Secondary text"),
    ("muted", "surface", AA, "Secondary text on cards"),
    ("accent-contrast", "accent", AA, "Button label"),
    ("accent", "bg", AA_LARGE, "Accent elements and large text"),
    ("success", "bg", AA_LARGE, "Status colour"),
    ("warning", "bg", AA_LARGE, "Status colour"),
    ("danger", "bg", AA_LARGE, "Status colour"),
    ("info", "bg", AA_LARGE, "Status colour"),
)

_STACKS: dict[str, list[str]] = {
    "sans": ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
    "serif": ["Georgia", "Times New Roman", "serif"],
    "display": ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
    "mono": ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
}
_FONT_KEYS = {name.lower(): name for name in GOOGLE_FONTS}
_STEPS: tuple[tuple[str, int], ...] = (
    ("xs", -2),
    ("sm", -1),
    ("base", 0),
    ("lg", 1),
    ("xl", 2),
    ("2xl", 3),
    ("3xl", 4),
    ("4xl", 5),
    ("5xl", 6),
)
_SPACE: tuple[tuple[str, float], ...] = (
    ("xs", 0.5),
    ("sm", 1),
    ("md", 2),
    ("lg", 3),
    ("xl", 4),
    ("2xl", 6),
    ("3xl", 8),
)
_MOTION = {
    "calm": (200, 400, 700, [0.4, 0, 0.2, 1]),
    "balanced": (150, 300, 500, [0.2, 0, 0, 1]),
    "snappy": (100, 200, 320, [0.3, 0, 0, 1]),
}
_EXT = "forge"

ShadowStyle = Literal["none", "soft", "medium", "hard"]
MotionStyle = Literal["calm", "balanced", "snappy"]


def _px(value: float) -> dict[str, Any]:
    return {"value": round(value, 2) if value % 1 else int(value), "unit": "px"}


def _clip(text: Any, limit: int) -> str:
    return strip_long_dashes(str(text or "").strip())[:limit]


def _lines(raw: Any, limit: int = 12) -> list[str]:
    if not isinstance(raw, list):
        return []
    out = [_clip(item, 400) for item in raw if str(item or "").strip()]
    return out[:limit]


# ── spec ───────────────────────────────────────────────────────────────────


class _Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


class GuidanceSpec(_Loose):
    summary: str = ""
    do: list[str] = Field(default_factory=list)
    dont: list[str] = Field(default_factory=list)

    @field_validator("summary", mode="before")
    @classmethod
    def _summary(cls, value: Any) -> str:
        return _clip(value, 2000)

    @field_validator("do", "dont", mode="before")
    @classmethod
    def _list(cls, value: Any) -> list[str]:
        return _lines(value)


class FontsSpec(_Loose):
    display: str = "Inter"
    body: str = "Inter"
    mono: str = "JetBrains Mono"


class TypeSpec(_Loose):
    base: float = Field(default=16, ge=12, le=22)
    ratio: float = Field(default=1.25, ge=1.067, le=1.618)


class RadiusSpec(_Loose):
    sm: float = Field(default=4, ge=0, le=64)
    md: float = Field(default=8, ge=0, le=64)
    lg: float = Field(default=16, ge=0, le=96)


class LogoSpec(_Loose):
    clearSpace: str = ""
    minSizePx: int = Field(default=24, ge=8, le=2000)
    usage: list[str] = Field(default_factory=list)
    misuse: list[str] = Field(default_factory=list)

    @field_validator("usage", "misuse", mode="before")
    @classmethod
    def _list(cls, value: Any) -> list[str]:
        return _lines(value, 10)

    @field_validator("clearSpace", mode="before")
    @classmethod
    def _clear(cls, value: Any) -> str:
        return _clip(value, 200)


class IconSpec(_Loose):
    library: str = "lucide"
    style: Literal["outline", "filled", "duotone"] = "outline"
    stroke: float = Field(default=1.75, ge=0.5, le=4)
    summary: str = ""
    do: list[str] = Field(default_factory=list)
    dont: list[str] = Field(default_factory=list)

    @field_validator("do", "dont", mode="before")
    @classmethod
    def _list(cls, value: Any) -> list[str]:
        return _lines(value, 8)

    @field_validator("summary", "library", mode="before")
    @classmethod
    def _text(cls, value: Any) -> str:
        return _clip(value, 300)


class Spec(_Loose):
    name: str = "Design system"
    description: str = ""
    colors: dict[str, str] = Field(default_factory=dict)
    fonts: FontsSpec = Field(default_factory=FontsSpec)
    type: TypeSpec = Field(default_factory=TypeSpec)
    space: float = Field(default=8, ge=2, le=16)
    radius: RadiusSpec = Field(default_factory=RadiusSpec)
    shadow: ShadowStyle = "soft"
    motion: MotionStyle = "balanced"
    logo: LogoSpec = Field(default_factory=LogoSpec)
    iconography: IconSpec = Field(default_factory=IconSpec)
    imagery: GuidanceSpec = Field(default_factory=GuidanceSpec)
    voice: GuidanceSpec = Field(default_factory=GuidanceSpec)
    guidelines: GuidanceSpec = Field(default_factory=GuidanceSpec)
    components: list[str] = Field(default_factory=lambda: list(COMPONENTS))

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, value: Any) -> str:
        return _clip(value, 120) or "Design system"

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, value: Any) -> str:
        return _clip(value, 2000)

    @field_validator("colors", mode="before")
    @classmethod
    def _colors(cls, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise ValueError("colors must be an object of role to #rrggbb")
        out: dict[str, str] = {}
        for raw_name, raw_hex in value.items():
            name = re.sub(r"[^a-z0-9-]", "-", str(raw_name).strip().lower().replace("_", "-")).strip("-")
            name = {"accentcontrast": "accent-contrast", "on-accent": "accent-contrast"}.get(name, name)
            hex_value = normalize_hex(raw_hex)
            if name and hex_value and re.match(r"^[a-z0-9][a-z0-9-]{0,40}$", name):
                out[name] = hex_value
        missing = [role for role in ("bg", "fg", "accent") if role not in out]
        if missing:
            raise ValueError(f"colors is missing {', '.join(missing)}")
        return out

    @field_validator("components", mode="before")
    @classmethod
    def _components(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return list(COMPONENTS)
        picked = [str(item) for item in value if str(item) in COMPONENTS]
        return list(dict.fromkeys(picked)) or list(COMPONENTS)


def check_spec(data: dict[str, Any]) -> Spec:
    """The spec in a model answer (``{"designSystem": {...}}`` or bare)."""
    body = data.get("designSystem") if isinstance(data.get("designSystem"), dict) else data
    return Spec.model_validate(body)


# ── fonts ──────────────────────────────────────────────────────────────────


def match_font(raw: Any, fallback: str) -> str:
    name = re.sub(r"[`\"'*]", "", str(raw or "")).split(",")[0].strip()
    return _FONT_KEYS.get(name.lower(), fallback)


def font_category(family: str) -> str:
    return GOOGLE_FONTS.get(family, ("sans", ""))[0]


def font_stack(family: str) -> list[str]:
    return [family, *_STACKS[font_category(family)]]


def google_fonts_url(families: list[str]) -> str:
    parts = []
    for family in dict.fromkeys(families):
        if family not in GOOGLE_FONTS:
            continue
        parts.append(f"family={quote_plus(family)}:wght@{GOOGLE_FONTS[family][1]}")
    if not parts:
        return ""
    return "https://fonts.googleapis.com/css2?" + "&".join(parts) + "&display=swap"


# ── colours ────────────────────────────────────────────────────────────────


def complete_palette(colors: dict[str, str]) -> dict[str, str]:
    """Every role filled in: missing surface, muted, border, semantic colours derived."""
    out = dict(colors)
    bg, fg = out["bg"], out["fg"]
    dark = is_dark(bg)
    out.setdefault("surface", mix(bg, fg, 0.06 if dark else 0.03))
    out.setdefault("muted", mix(fg, bg, 0.4))
    out.setdefault("border", mix(bg, fg, 0.16 if dark else 0.12))
    defaults = (
        {"success": "#34d399", "warning": "#fbbf24", "danger": "#f87171", "info": "#60a5fa"}
        if dark
        else {"success": "#15803d", "warning": "#b45309", "danger": "#b91c1c", "info": "#1d4ed8"}
    )
    for role, value in defaults.items():
        out.setdefault(role, value)
    out.setdefault("accent-contrast", best_text_on(out["accent"]))
    return out


def repair_contrast(colors: dict[str, str]) -> tuple[dict[str, str], list[dict[str, Any]]]:
    """Colours with every failing pair fixed, and the list of fixes made."""
    out = dict(colors)
    fixes: list[dict[str, Any]] = []
    for fg, bg, target, _use in CONTRAST_PAIRS:
        if fg not in out or bg not in out:
            continue
        before = out[fg]
        if contrast_ratio(before, out[bg]) >= target:
            continue
        if fg == "accent-contrast":
            after = best_text_on(out[bg])
            if contrast_ratio(after, out[bg]) < target:
                after = ensure_contrast(after, out[bg], target)
        else:
            after = ensure_contrast(before, out[bg], target)
        out[fg] = after
        fixes.append(
            {
                "token": fg,
                "on": bg,
                "from": before,
                "to": after,
                "ratio": round(contrast_ratio(after, out[bg]), 2),
            }
        )
    return out, fixes


def contrast_pairs(colors: dict[str, str]) -> list[dict[str, Any]]:
    """The checked pairs with their ratio and WCAG level."""
    rows = []
    for fg, bg, target, use in CONTRAST_PAIRS:
        if fg in colors and bg in colors:
            ratio = contrast_ratio(colors[fg], colors[bg])
            rows.append(
                {
                    "fg": fg,
                    "bg": bg,
                    "ratio": round(ratio, 2),
                    "level": wcag_level(ratio),
                    "required": target,
                    "pass": ratio >= target,
                    "use": use,
                }
            )
    return rows


def build_color_group(colors: dict[str, str]) -> dict[str, Any]:
    pairs = contrast_pairs(colors)
    group: dict[str, Any] = {"$type": "color"}
    order = [*REQUIRED_COLORS, "accent-contrast", "secondary", *SEMANTIC_COLORS]
    names = [name for name in order if name in colors] + sorted(n for n in colors if n not in order)
    for name in names:
        token: dict[str, Any] = {"$value": colors[name]}
        role = ROLES.get(name)
        if role:
            token["$description"] = role
        checks = [
            {"on": row["bg"], "ratio": row["ratio"], "level": row["level"], "required": row["required"]}
            for row in pairs
            if row["fg"] == name
        ]
        ext: dict[str, Any] = {"role": name}
        if checks:
            ext["contrast"] = checks
        token["$extensions"] = {_EXT: ext}
        group[name] = token
    return group


def colors_of(document: dict[str, Any]) -> dict[str, str]:
    group = ((document.get("tokens") or {}).get("color")) or {}
    out: dict[str, str] = {}
    for name, token in group.items():
        if name.startswith("$") or not isinstance(token, dict):
            continue
        value = normalize_hex(token.get("$value"))
        if value:
            out[name] = value
    return out


def annotate_contrast(document: dict[str, Any]) -> dict[str, Any]:
    """Recompute the ``forge.contrast`` notes of every colour (values unchanged)."""
    doc = copy.deepcopy(document)
    group = (doc.get("tokens") or {}).get("color")
    if not isinstance(group, dict):
        return doc
    colors = colors_of(doc)
    pairs = contrast_pairs(colors)
    for name, token in group.items():
        if name.startswith("$") or not isinstance(token, dict) or "$value" not in token:
            continue
        ext = token.get("$extensions") if isinstance(token.get("$extensions"), dict) else {}
        forge = dict(ext.get(_EXT) or {}) if isinstance(ext.get(_EXT), dict) else {}
        checks = [
            {"on": row["bg"], "ratio": row["ratio"], "level": row["level"], "required": row["required"]}
            for row in pairs
            if row["fg"] == name
        ]
        if checks:
            forge["contrast"] = checks
        else:
            forge.pop("contrast", None)
        if forge:
            token["$extensions"] = {**ext, _EXT: forge}
    return doc


# ── typography, spacing, motion, icons ────────────────────────────────────


def build_type_groups(fonts: FontsSpec, scale: TypeSpec) -> dict[str, Any]:
    display = match_font(fonts.display, "Inter")
    body = match_font(fonts.body, "Inter")
    mono = match_font(fonts.mono, "JetBrains Mono")
    if font_category(mono) != "mono":
        mono = "JetBrains Mono"
    # Small steps never go below a readable size, whatever the ratio.
    floors = {"xs": 12, "sm": 13}
    sizes = {name: max(floors.get(name, 0), round(scale.base * scale.ratio**step)) for name, step in _STEPS}
    text: dict[str, Any] = {"$type": "dimension"}
    for name, value in sizes.items():
        text[name] = {"$value": _px(value)}
    text["base"]["$extensions"] = {_EXT: {"base": scale.base, "ratio": scale.ratio}}

    def typo(family: str, size: str, weight: str, leading: str, tracking: float = 0) -> dict[str, Any]:
        return {
            "$value": {
                "fontFamily": f"{{font.{family}}}",
                "fontSize": f"{{text.{size}}}",
                "fontWeight": f"{{weight.{weight}}}",
                "lineHeight": f"{{leading.{leading}}}",
                "letterSpacing": _px(tracking),
            }
        }

    return {
        "font": {
            "$type": "fontFamily",
            "display": {"$value": font_stack(display), "$description": "Titles and headings"},
            "body": {"$value": font_stack(body), "$description": "Body text and interface"},
            "mono": {"$value": font_stack(mono), "$description": "Code and figures"},
        },
        "weight": {
            "$type": "fontWeight",
            "regular": {"$value": 400},
            "medium": {"$value": 500},
            "semibold": {"$value": 600},
            "bold": {"$value": 700},
        },
        "text": text,
        "leading": {
            "$type": "number",
            "tight": {"$value": 1.15},
            "snug": {"$value": 1.3},
            "normal": {"$value": 1.55},
        },
        "type": {
            "$type": "typography",
            "display": typo("display", "5xl", "bold", "tight", -1),
            "h1": typo("display", "4xl", "bold", "tight", -0.5),
            "h2": typo("display", "3xl", "semibold", "snug"),
            "h3": typo("display", "2xl", "semibold", "snug"),
            "body": typo("body", "base", "regular", "normal"),
            "small": typo("body", "sm", "regular", "normal"),
            "caption": typo("body", "xs", "medium", "normal", 0.2),
            "code": typo("mono", "sm", "regular", "normal"),
        },
    }


def _shadow(x: float, y: float, blur: float, spread: float, color: str, alpha: float) -> dict[str, Any]:
    return {
        "color": f"{color}{max(0, min(255, round(alpha * 255))):02x}",
        "offsetX": _px(x),
        "offsetY": _px(y),
        "blur": _px(blur),
        "spread": _px(spread),
    }


def build_space_groups(
    space: float, radius: RadiusSpec, shadow: ShadowStyle, motion: MotionStyle, colors: dict[str, str]
) -> dict[str, Any]:
    dark = is_dark(colors.get("bg", "#ffffff"))
    shade = "#000000"
    boost = 2.2 if dark else 1.0
    if shadow == "none":
        levels = [(0, 0, 0, 0, 0.0), (0, 0, 0, 0, 0.0), (0, 0, 0, 0, 0.0)]
    elif shadow == "hard":
        shade = colors.get("fg", "#000000")
        levels = [(2, 2, 0, 0, 1.0), (4, 4, 0, 0, 1.0), (8, 8, 0, 0, 1.0)]
        boost = 1.0
    else:
        k = 1.0 if shadow == "soft" else 1.8
        levels = [
            (0, 1, 2, 0, 0.06 * k),
            (0, 4, 12, -2, 0.1 * k),
            (0, 12, 32, -8, 0.16 * k),
        ]
    shadow_group: dict[str, Any] = {"$type": "shadow"}
    for name, (x, y, blur, spread, alpha) in zip(("sm", "md", "lg"), levels, strict=True):
        shadow_group[name] = {"$value": _shadow(x, y, blur, spread, shade, min(1.0, alpha * boost))}
    shadow_group["md"]["$extensions"] = {_EXT: {"style": shadow}}

    fast, base, slow, curve = _MOTION[motion]
    space_group: dict[str, Any] = {"$type": "dimension"}
    for name, factor in _SPACE:
        space_group[name] = {"$value": _px(space * factor)}
    space_group["sm"]["$extensions"] = {_EXT: {"unit": space}}
    return {
        "space": space_group,
        "radius": {
            "$type": "dimension",
            "none": {"$value": _px(0)},
            "sm": {"$value": _px(radius.sm)},
            "md": {"$value": _px(radius.md)},
            "lg": {"$value": _px(radius.lg)},
            "xl": {"$value": _px(round(radius.lg * 1.5))},
            "full": {"$value": _px(9999)},
        },
        "shadow": shadow_group,
        "motion": {
            "$type": "duration",
            "fast": {"$value": {"value": fast, "unit": "ms"}},
            "base": {"$value": {"value": base, "unit": "ms"}, "$extensions": {_EXT: {"style": motion}}},
            "slow": {"$value": {"value": slow, "unit": "ms"}},
        },
        "ease": {
            "$type": "cubicBezier",
            "standard": {"$value": list(curve)},
        },
    }


def build_icon_group(icons: IconSpec) -> dict[str, Any]:
    guidance = {"summary": icons.summary, "do": icons.do, "dont": icons.dont}
    return {
        "library": {
            "$value": icons.library or "lucide",
            "$description": icons.summary[:500] if icons.summary else "Icon library",
        },
        "style": {"$value": icons.style, "$extensions": {_EXT: {"guidance": guidance}}},
        "stroke": {"$type": "dimension", "$value": _px(icons.stroke)},
        "size": {
            "$type": "dimension",
            "sm": {"$value": _px(16)},
            "md": {"$value": _px(20)},
            "lg": {"$value": _px(24)},
        },
    }


# ── whole document ─────────────────────────────────────────────────────────


def _guidance(spec: GuidanceSpec) -> dict[str, Any] | None:
    out: dict[str, Any] = {}
    if spec.summary:
        out["summary"] = spec.summary
    if spec.do:
        out["do"] = spec.do
    if spec.dont:
        out["dont"] = spec.dont
    return out or None


def _logo(spec: LogoSpec, src: str | None, dark_src: str | None = None) -> dict[str, Any] | None:
    if not src:
        return None
    usage = [*spec.usage, *(MISUSE_PREFIX + line for line in spec.misuse)][:40]
    out: dict[str, Any] = {"src": src, "minSizePx": spec.minSizePx}
    if dark_src:
        out["darkSrc"] = dark_src
    if spec.clearSpace:
        out["clearSpace"] = spec.clearSpace
    if usage:
        out["usage"] = usage
    return out


def build_document(
    spec: Spec, *, logo_src: str | None = LOGO_PATH, logo_dark_src: str | None = None
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """(validated design-system.json, contrast fixes) for ``spec``."""
    colors, fixes = repair_contrast(complete_palette(spec.colors))
    tokens: dict[str, Any] = {"color": build_color_group(colors)}
    tokens.update(build_type_groups(spec.fonts, spec.type))
    tokens.update(build_space_groups(spec.space, spec.radius, spec.shadow, spec.motion, colors))
    tokens["icon"] = build_icon_group(spec.iconography)
    document: dict[str, Any] = {"version": 1, "name": spec.name, "tokens": tokens}
    if spec.description:
        document["description"] = spec.description
    logo = _logo(spec.logo, logo_src, logo_dark_src)
    if logo:
        document["logo"] = logo
    for key in ("voice", "imagery", "guidelines"):
        value = _guidance(getattr(spec, key))
        if value:
            document[key] = value
    document["components"] = list(spec.components)
    return dump_document(validate_design_system(document)), fixes


def _ext(token: Any) -> dict[str, Any]:
    if isinstance(token, dict) and isinstance(token.get("$extensions"), dict):
        forge = token["$extensions"].get(_EXT)
        if isinstance(forge, dict):
            return forge
    return {}


def _value_px(token: Any, fallback: float) -> float:
    value = token.get("$value") if isinstance(token, dict) else None
    if isinstance(value, dict) and isinstance(value.get("value"), (int, float)):
        return float(value["value"])
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return fallback


def _first_family(token: Any, fallback: str) -> str:
    value = token.get("$value") if isinstance(token, dict) else None
    if isinstance(value, list) and value:
        return match_font(value[0], fallback)
    if isinstance(value, str):
        return match_font(value, fallback)
    return fallback


def _guidance_spec(raw: Any) -> GuidanceSpec:
    return GuidanceSpec.model_validate(raw if isinstance(raw, dict) else {})


def spec_from_document(document: dict[str, Any]) -> Spec:
    """The spec a document was built from (best effort for hand-edited ones)."""
    tokens = document.get("tokens") or {}
    colors = colors_of(document)
    for role, fallback in (("bg", "#ffffff"), ("fg", "#111111"), ("accent", "#2563eb")):
        colors.setdefault(role, fallback)
    font = tokens.get("font") or {}
    text = tokens.get("text") or {}
    base_hint = _ext(text.get("base"))
    radius = tokens.get("radius") or {}
    space = tokens.get("space") or {}
    shadow_hint = _ext((tokens.get("shadow") or {}).get("md"))
    motion_hint = _ext((tokens.get("motion") or {}).get("base"))
    icon = tokens.get("icon") or {}
    icon_guidance = _ext(icon.get("style")).get("guidance") or {}
    logo = document.get("logo") or {}
    usage = [line for line in logo.get("usage") or [] if isinstance(line, str)]
    space_unit = _ext(space.get("sm")).get("unit")
    return Spec.model_validate(
        {
            "name": document.get("name") or "Design system",
            "description": document.get("description") or "",
            "colors": colors,
            "fonts": {
                "display": _first_family(font.get("display"), "Inter"),
                "body": _first_family(font.get("body"), "Inter"),
                "mono": _first_family(font.get("mono"), "JetBrains Mono"),
            },
            "type": {
                "base": base_hint.get("base") or _value_px(text.get("base"), 16),
                "ratio": base_hint.get("ratio") or 1.25,
            },
            "space": space_unit or _value_px(space.get("sm"), 8),
            "radius": {
                "sm": _value_px(radius.get("sm"), 4),
                "md": _value_px(radius.get("md"), 8),
                "lg": _value_px(radius.get("lg"), 16),
            },
            "shadow": shadow_hint.get("style") or "soft",
            "motion": motion_hint.get("style") or "balanced",
            "logo": {
                "clearSpace": logo.get("clearSpace") or "",
                "minSizePx": logo.get("minSizePx") or 24,
                "usage": [line for line in usage if not line.startswith(MISUSE_PREFIX)],
                "misuse": [line[len(MISUSE_PREFIX) :] for line in usage if line.startswith(MISUSE_PREFIX)],
            },
            "iconography": {
                "library": (icon.get("library") or {}).get("$value") or "lucide",
                "style": (icon.get("style") or {}).get("$value") or "outline",
                "stroke": _value_px(icon.get("stroke"), 1.75),
                "summary": icon_guidance.get("summary") or "",
                "do": icon_guidance.get("do") or [],
                "dont": icon_guidance.get("dont") or [],
            },
            "imagery": document.get("imagery") or {},
            "voice": document.get("voice") or {},
            "guidelines": document.get("guidelines") or {},
            "components": document.get("components") or list(COMPONENTS),
        }
    )


def apply_section(
    document: dict[str, Any], section: str, spec: Spec
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """``document`` with only ``section`` rebuilt from ``spec``; the rest untouched."""
    if section not in SECTIONS:
        raise ValueError(f"unknown section {section!r}")
    doc = copy.deepcopy(document)
    tokens = doc.setdefault("tokens", {})
    fixes: list[dict[str, Any]] = []
    if section == "colors":
        colors, fixes = repair_contrast(complete_palette(spec.colors))
        tokens["color"] = build_color_group(colors)
    elif section == "typography":
        tokens.update(build_type_groups(spec.fonts, spec.type))
    elif section == "spacing":
        tokens.update(build_space_groups(spec.space, spec.radius, spec.shadow, spec.motion, colors_of(doc)))
    elif section == "iconography":
        tokens["icon"] = build_icon_group(spec.iconography)
    elif section == "logo":
        current = doc.get("logo") or {}
        logo = _logo(spec.logo, current.get("src") or LOGO_PATH, current.get("darkSrc"))
        if logo:
            doc["logo"] = logo
    elif section == "components":
        doc["components"] = list(spec.components)
    else:
        value = _guidance(getattr(spec, section))
        if value:
            doc[section] = value
        else:
            doc.pop(section, None)
    return dump_document(validate_design_system(annotate_contrast(doc))), fixes


# ── CSS variables (same mapping as the web player) ─────────────────────────


def _var_name(path: list[str]) -> str:
    if path[0] == "color" and len(path) > 1:
        return "--" + "-".join(path[1:])
    return "--" + "-".join(path)


def _alias(value: str) -> str:
    return re.sub(r"\{([A-Za-z0-9_.-]+)\}", lambda m: f"var({_var_name(m.group(1).split('.'))})", value)


def _quote_family(name: str) -> str:
    name = name.strip()
    generic = re.compile(
        r"^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$"
    )
    if re.match(r"^[\"'].*[\"']$", name) or not re.search(r"\s", name) or generic.match(name):
        return name
    return f'"{name}"'


def _dimension(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return f"{value}px"
    if isinstance(value, str):
        return _alias(value)
    if isinstance(value, dict) and isinstance(value.get("value"), (int, float)):
        unit = value.get("unit") if isinstance(value.get("unit"), str) else "px"
        return f"{value['value']}{unit}"
    return None


def token_css(value: Any, kind: str | None) -> str | None:
    """One W3C token value as CSS, None when it has no CSS meaning."""
    if kind == "fontFamily" or (
        isinstance(value, list) and value and all(isinstance(v, str) for v in value) and kind != "cubicBezier"
    ):
        items = value if isinstance(value, list) else [str(value)]
        return ", ".join(_quote_family(v) for v in items if str(v).strip()) or None
    if kind == "cubicBezier" and isinstance(value, list) and len(value) == 4:
        return "cubic-bezier(" + ", ".join(str(v) for v in value) + ")"
    if kind == "shadow":
        items = value if isinstance(value, list) else [value]
        parts = []
        for item in items:
            if isinstance(item, str):
                parts.append(_alias(item))
                continue
            if not isinstance(item, dict):
                continue
            dims = [_dimension(item.get(k, 0)) or "0px" for k in ("offsetX", "offsetY", "blur", "spread")]
            color = _alias(item["color"]) if isinstance(item.get("color"), str) else "transparent"
            parts.append(("inset " if item.get("inset") else "") + " ".join(dims) + f" {color}")
        return ", ".join(parts) or None
    if kind == "duration" and isinstance(value, dict) and isinstance(value.get("value"), (int, float)):
        return f"{value['value']}{'s' if value.get('unit') == 's' else 'ms'}"
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return f"{value}px" if kind == "dimension" else str(value)
    if isinstance(value, str):
        return _alias(value)
    if isinstance(value, dict) and isinstance(value.get("value"), (int, float)):
        return _dimension(value)
    return None


def css_variables(document: dict[str, Any]) -> dict[str, str]:
    """``--name`` to CSS value for every token, ``$type`` inherited from groups."""
    out: dict[str, str] = {}

    def walk(node: Any, path: list[str], inherited: str | None) -> None:
        if not isinstance(node, dict):
            return
        kind = node.get("$type") if isinstance(node.get("$type"), str) else inherited
        if "$value" in node:
            css = token_css(node["$value"], kind)
            if css is not None and path:
                out[_var_name(path)] = css
            return
        for key, child in node.items():
            if not key.startswith("$"):
                walk(child, [*path, key], kind)

    walk(document.get("tokens") or {}, [], None)
    # Sites written by the agent read --font-sans for body text.
    if "--font-body" in out:
        out.setdefault("--font-sans", out["--font-body"])
    return out


def css_text(document: dict[str, Any], selector: str = ":root") -> str:
    variables = css_variables(document)
    fonts = google_fonts_url(font_families(document))
    lines = []
    if fonts:
        lines.append(f'@import url("{fonts}");')
        lines.append("")
    lines.append(f"{selector} {{")
    lines += [f"  {name}: {value};" for name, value in variables.items()]
    lines.append("}")
    return "\n".join(lines) + "\n"


def font_families(document: dict[str, Any]) -> list[str]:
    font = (document.get("tokens") or {}).get("font") or {}
    out = []
    for role in ("display", "body", "mono"):
        family = _first_family(font.get(role), "")
        if family:
            out.append(family)
    return out
