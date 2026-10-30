"""The brand guidelines of a design system, as a print document and as Markdown.

Modelled on the guidelines RodiumAi wrote by hand for Forge: an A4 landscape
document with a dark cover, then light editorial pages, one topic per page
(logo, backgrounds, clear space, don'ts, app icon, colour, contrast,
typography, iconography and imagery, voice, principles, components, files).

Everything comes from ``design-system.json`` and the brand files of the
project; a page whose data is missing is left out, and nothing is measured or
invented (there are no construction drawings). The logo variants (one-colour
black and white, the misuse examples) are drawn with CSS filters on the
uploaded file, so they always match it.

``brand_guide_html`` is printed by Playwright for the PDF export (no script
runs on the page); ``brand_guide_md`` is the Markdown export. DESIGN.md (what
the AI reads) is a different file, built by ``render.design_md``.
"""

from __future__ import annotations

import base64
import io
import re
from collections.abc import Callable
from datetime import UTC, datetime
from html import escape
from typing import Any

from app.services.design_system.color import (
    contrast_ratio,
    ensure_contrast,
    normalize_hex,
    to_rgb,
    wcag_level,
)
from app.services.design_system.site import FORGE_MARK_SVG
from app.services.design_system.tokens import (
    MISUSE_PREFIX,
    ROLES,
    colors_of,
    contrast_pairs,
    css_variables,
    font_families,
    google_fonts_url,
)

_PAPER = "#ffffff"
_PANEL = "#f3f3f4"
_FALLBACK_INK = "#1c1f26"
_GREY = "#6b6f78"
_LINE = "#e4e4e7"
_RED = "#e5484d"
_WHITE_FILTER = "brightness(0) invert(1)"
_BLACK_FILTER = "brightness(0)"

_LABELS: dict[str, dict[str, str]] = {
    "fr": {
        "guidelines": "Charte graphique",
        "cover_title": "Charte<br>graphique",
        "intro": "Introduction",
        "contents": "Sommaire",
        "name_title": "Écrire le nom",
        "name_rule": "Toujours <b>{name}</b>, avec cette orthographe et ces majuscules.",
        "name_rule_md": "Le nom s'écrit toujours **{name}**, avec cette orthographe et ces majuscules.",
        "audience": "Pour qui",
        "website": "Site",
        "tagline": "Signature",
        "logo": "Le logo",
        "logo_lead": "Le logo principal. Utilisez toujours les fichiers fournis : ne le redessinez pas "
        "et ne le recomposez pas avec une police.",
        "backgrounds": "Sur chaque fond",
        "bg_light": "Fond clair",
        "bg_dark": "Fond sombre",
        "bg_accent": "Couleur de marque",
        "mono_black": "Noir, une couleur",
        "mono_white": "Blanc, une couleur",
        "backgrounds_note": "Choisissez toujours la version qui garde le plus de contraste avec le fond. "
        "Les versions une couleur servent à l'impression, aux tampons et aux fonds photo.",
        "clear": "Zone de protection,<br>tailles minimales",
        "clear_md": "Zone de protection et tailles minimales",
        "clear_space": "Zone de protection",
        "clear_default": "Laissez un espace vide autour du logo, sans texte, filet ni image.",
        "min_size": "Taille minimale",
        "min_note": "En dessous de cette taille, le logo perd sa lisibilité.",
        "rules": "Règles d'usage",
        "donts": "À éviter",
        "donts_title": "Gardez-le intact",
        "d_stretch": "Ne pas l'étirer ni l'écraser",
        "d_rotate": "Ne pas le faire pivoter",
        "d_recolor": "Ne pas changer ses couleurs",
        "d_shadow": "Pas d'ombre ni d'effet",
        "d_busy": "Pas sur un fond chargé",
        "d_outline": "Ne pas le réduire à un contour",
        "d_contrast": "Pas sur un fond sans contraste",
        "also_avoid": "À éviter aussi",
        "app_icon": "L'icône d'application",
        "app_lead": "L'icône se pose sur un carré arrondi : le rayon des coins vaut 22,5 % du côté et "
        "l'icône occupe 62,5 % du côté.",
        "tile_dark": "Sombre",
        "tile_accent": "Couleur",
        "tile_light": "Clair",
        "tile_dark_use": "La référence : stores, favicon, avatar.",
        "tile_accent_use": "Réseaux sociaux, quand il faut plus d'impact.",
        "tile_light_use": "Interfaces et documents clairs.",
        "favicon": "Favicon",
        "icon": "L'icône",
        "colour": "Couleurs",
        "contrast": "Contraste et<br>accessibilité",
        "contrast_md": "Contraste et accessibilité",
        "pair": "Paire",
        "ratio": "Ratio",
        "level": "Niveau",
        "use": "Usage",
        "proportions": "Proportions conseillées",
        "prop_note": "Sur une page ou un visuel : environ 60 % de fond, 30 % de neutres et 10 % de "
        "couleur de marque.",
        "prop_bg": "Fond",
        "prop_neutral": "Neutres",
        "prop_accent": "Marque",
        "typography": "Typographie",
        "weights": "Graisses utilisées",
        "scale": "Échelle typographique",
        "fallback": "Polices de repli",
        "fallback_note": "Quand la police n'est pas disponible, utilisez :",
        "role_display": "Titres",
        "role_body": "Texte courant et interface",
        "role_mono": "Code et chiffres",
        "role_display_body": "Titres, texte et interface",
        "iconography": "Iconographie<br>et images",
        "iconography_md": "Iconographie",
        "icons": "Icônes",
        "library": "Bibliothèque",
        "style": "Style",
        "stroke": "Trait",
        "imagery": "Images",
        "voice": "Ton de voix",
        "do": "À faire",
        "dont": "À éviter",
        "principles": "Principes",
        "components": "Composants",
        "files": "Fichiers",
        "files_lead": "Les fichiers de la marque, dans le projet Forge.",
        "file": "Fichier",
        "f_logo": "Logo principal.",
        "f_dark": "Logo pour les fonds sombres.",
        "f_icon": "Icône carrée : icône d'application et favicon.",
        "f_tokens": "Jetons de design au format W3C.",
        "f_css": "Variables CSS prêtes à importer.",
        "f_tailwind": "Thème Tailwind relié aux variables CSS.",
        "f_md": "Cette charte en Markdown.",
        "version": "Version",
        "made_with": "Fait avec Forge",
        "primary": "Action principale",
        "secondary": "Secondaire",
        "email": "Adresse e-mail",
        "email_hint": "nom@exemple.com",
        "card_title": "Carte",
        "card_body": "Une surface pour regrouper un contenu et ses actions.",
        "badge": "Nouveau",
        "pending": "En attente",
        "alert_info": "Information utile pour la suite.",
        "alert_success": "Modifications enregistrées.",
        "alert_danger": "Une erreur est survenue.",
        "sample": "Le design system habille chaque projet.",
        "acc_text": "Texte principal sur le fond : {ratio}:1 ({level}).",
        "acc_accent_small": "La couleur de marque sur le fond atteint {ratio}:1 : réservez-la aux textes "
        "de 24 px et plus (18 px en gras), aux icônes et aux éléments graphiques. Pour le texte courant, "
        "utilisez la couleur du texte.",
        "acc_accent_ok": "La couleur de marque sur le fond atteint {ratio}:1 : elle convient aussi au texte, "
        "à toutes les tailles.",
        "acc_failing": "{count} paire(s) sous leur seuil : ne les utilisez jamais pour du petit texte.",
        "acc_all_pass": "Toutes les paires vérifiées atteignent leur seuil WCAG 2.2.",
        "colour_md_head": "| Couleur | Hex | RGB | Rôle |",
        "font_md_head": "| Police | Rôle | Graisses |",
        "scale_md_head": "| Niveau | Taille | Police | Graisse |",
        "min_md_head": "| Élément | Minimum |",
        "versions": "Versions",
        "version_md_head": "| Version | Fichier | Usage |",
        "v_main": "Logo principal",
        "v_main_use": "Par défaut : site, application, documents.",
        "v_dark": "Version sombre",
        "v_dark_use": "Sur les fonds sombres.",
        "v_icon": "Icône",
        "v_icon_use": "Avatars, icône d'application, favicon, petites tailles.",
        "app_md_head": "| Version | Tuile | Usage |",
        "tile_dark_md": "Tuile sombre, icône en couleur",
        "tile_accent_md": "Tuile couleur de marque, icône blanche",
        "tile_light_md": "Tuile blanche, icône en couleur",
        "pair_md_head": "| Paire | Ratio | Niveau | Usage |",
        "logo_el": "Logo",
    },
    "en": {
        "guidelines": "Brand guidelines",
        "cover_title": "Brand<br>guidelines",
        "intro": "Introduction",
        "contents": "Contents",
        "name_title": "Writing the name",
        "name_rule": "Always <b>{name}</b>, with this exact spelling and capitalisation.",
        "name_rule_md": "The name is always written **{name}**, with this exact spelling and capitalisation.",
        "audience": "Audience",
        "website": "Website",
        "tagline": "Tagline",
        "logo": "The logo",
        "logo_lead": "The primary logo. Always use the supplied files: never redraw it or retype it "
        "in a font.",
        "backgrounds": "On every background",
        "bg_light": "Light background",
        "bg_dark": "Dark background",
        "bg_accent": "Brand colour",
        "mono_black": "Black, one colour",
        "mono_white": "White, one colour",
        "backgrounds_note": "Always pick the version that keeps the most contrast with the background. "
        "The one-colour versions are for print, stamps and photos.",
        "clear": "Clear space,<br>minimum sizes",
        "clear_md": "Clear space and minimum sizes",
        "clear_space": "Clear space",
        "clear_default": "Keep empty space around the logo, free of text, rules and images.",
        "min_size": "Minimum size",
        "min_note": "Below this size the logo stops being legible.",
        "rules": "Usage rules",
        "donts": "Don'ts",
        "donts_title": "Keep it intact",
        "d_stretch": "Don't stretch or squash it",
        "d_rotate": "Don't rotate it",
        "d_recolor": "Don't change its colours",
        "d_shadow": "No shadows or effects",
        "d_busy": "Not on a busy background",
        "d_outline": "Don't reduce it to an outline",
        "d_contrast": "Not on a low-contrast background",
        "also_avoid": "Also avoid",
        "app_icon": "The app icon",
        "app_lead": "The icon sits on a rounded square: the corner radius is 22.5% of the side and the "
        "icon fills 62.5% of the side.",
        "tile_dark": "Dark",
        "tile_accent": "Brand colour",
        "tile_light": "Light",
        "tile_dark_use": "The reference: app stores, favicon, avatar.",
        "tile_accent_use": "Social media, wherever it needs more impact.",
        "tile_light_use": "Light interfaces and documents.",
        "favicon": "Favicon",
        "icon": "The icon",
        "colour": "Colour",
        "contrast": "Contrast and<br>accessibility",
        "contrast_md": "Contrast and accessibility",
        "pair": "Pair",
        "ratio": "Ratio",
        "level": "Level",
        "use": "Use",
        "proportions": "Recommended proportions",
        "prop_note": "On any page or visual: about 60% background, 30% neutrals and 10% brand colour.",
        "prop_bg": "Background",
        "prop_neutral": "Neutrals",
        "prop_accent": "Brand",
        "typography": "Typography",
        "weights": "Weights in use",
        "scale": "Type scale",
        "fallback": "Fallback",
        "fallback_note": "When the font isn't available, use:",
        "role_display": "Headings",
        "role_body": "Body text and interface",
        "role_mono": "Code and figures",
        "role_display_body": "Headings, text and interface",
        "iconography": "Iconography<br>and imagery",
        "iconography_md": "Iconography",
        "icons": "Icons",
        "library": "Library",
        "style": "Style",
        "stroke": "Stroke",
        "imagery": "Imagery",
        "voice": "Voice",
        "do": "Do",
        "dont": "Don't",
        "principles": "Principles",
        "components": "Components",
        "files": "Files",
        "files_lead": "The brand files, in the Forge project.",
        "file": "File",
        "f_logo": "Primary logo.",
        "f_dark": "Logo for dark backgrounds.",
        "f_icon": "Square icon: app icon and favicon.",
        "f_tokens": "Design tokens in the W3C format.",
        "f_css": "CSS variables, ready to import.",
        "f_tailwind": "Tailwind theme mapped onto the CSS variables.",
        "f_md": "These guidelines in Markdown.",
        "version": "Version",
        "made_with": "Made with Forge",
        "primary": "Primary action",
        "secondary": "Secondary",
        "email": "Email address",
        "email_hint": "name@example.com",
        "card_title": "Card",
        "card_body": "A surface that groups content and its actions.",
        "badge": "New",
        "pending": "Pending",
        "alert_info": "Helpful information for what comes next.",
        "alert_success": "Changes saved.",
        "alert_danger": "Something went wrong.",
        "sample": "The design system dresses every project.",
        "acc_text": "Main text on the background: {ratio}:1 ({level}).",
        "acc_accent_small": "The brand colour on the background reaches {ratio}:1: keep it for text 24 px "
        "and above (18 px bold), icons and graphics. For body text, use the text colour.",
        "acc_accent_ok": "The brand colour on the background reaches {ratio}:1: it also works for text "
        "at any size.",
        "acc_failing": "{count} pair(s) below their target: never use them for small text.",
        "acc_all_pass": "Every checked pair reaches its WCAG 2.2 target.",
        "colour_md_head": "| Colour | Hex | RGB | Role |",
        "font_md_head": "| Font | Role | Weights |",
        "scale_md_head": "| Level | Size | Font | Weight |",
        "min_md_head": "| Element | Minimum |",
        "versions": "Versions",
        "version_md_head": "| Version | File | When to use it |",
        "v_main": "Primary logo",
        "v_main_use": "Default: website, app, documents.",
        "v_dark": "Dark version",
        "v_dark_use": "On dark backgrounds.",
        "v_icon": "Icon",
        "v_icon_use": "Avatars, app icon, favicon, small sizes.",
        "app_md_head": "| Version | Tile | Use |",
        "tile_dark_md": "Dark tile, colour icon",
        "tile_accent_md": "Brand colour tile, white icon",
        "tile_light_md": "White tile, colour icon",
        "pair_md_head": "| Pair | Ratio | Level | Use |",
        "logo_el": "Logo",
    },
}

_COLOR_NAMES = {
    "fr": {
        "bg": "Fond",
        "surface": "Surface",
        "fg": "Texte",
        "muted": "Texte secondaire",
        "accent": "Accent",
        "accent-contrast": "Sur l'accent",
        "secondary": "Secondaire",
        "border": "Bordure",
        "success": "Succès",
        "warning": "Avertissement",
        "danger": "Danger",
        "info": "Information",
    },
    "en": {
        "bg": "Background",
        "surface": "Surface",
        "fg": "Text",
        "muted": "Muted text",
        "accent": "Accent",
        "accent-contrast": "On accent",
        "secondary": "Secondary",
        "border": "Border",
        "success": "Success",
        "warning": "Warning",
        "danger": "Danger",
        "info": "Info",
    },
}

_ROLES_FR = {
    "bg": "Fond des pages et des diapositives",
    "surface": "Cartes, panneaux et champs",
    "fg": "Texte principal",
    "muted": "Texte secondaire",
    "accent": "Accent de marque : boutons, liens, mises en avant",
    "accent-contrast": "Texte et icônes sur l'accent",
    "secondary": "Couleur de marque secondaire",
    "border": "Filets, séparateurs et bordures de champs",
    "success": "Statut positif",
    "warning": "Avertissement",
    "danger": "Erreurs et actions destructives",
    "info": "Information neutre",
}

_USES_FR = {
    "Body text": "Texte courant",
    "Text on cards": "Texte sur les cartes",
    "Secondary text": "Texte secondaire",
    "Secondary text on cards": "Texte secondaire sur les cartes",
    "Accent elements and large text": "Éléments d'accent et grands textes",
    "Button label": "Texte des boutons",
    "Status colour": "Couleur de statut",
}

_MONTHS = {
    "fr": (
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
    ),
    "en": (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ),
}

_WEIGHT_NAMES = {
    100: "Thin",
    200: "ExtraLight",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
    900: "Black",
}

# Type roles of the scale, in display order: (role, size token).
_SCALE = ("display", "h1", "h2", "h3", "body", "small", "caption", "code")

# Same six outline icons as the brand site (24x24, stroke=currentColor).
_ICONS = (
    '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    '<path d="M20 6L9 17l-5-5"/>',
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
)


# ── facts shared by the two renderings ─────────────────────────────────────


def _labels(lang: str) -> dict[str, str]:
    return _LABELS["fr" if lang == "fr" else "en"]


def _lang(lang: str) -> str:
    return "fr" if lang == "fr" else "en"


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _lines(block: Any, key: str, limit: int) -> list[str]:
    if not isinstance(block, dict):
        return []
    return [_clean(line) for line in block.get(key) or [] if _clean(line)][:limit]


def _logo(document: dict[str, Any]) -> dict[str, Any]:
    logo = document.get("logo")
    return logo if isinstance(logo, dict) and logo.get("src") else {}


def _usage(logo: dict[str, Any]) -> tuple[list[str], list[str]]:
    """(usage rules, misuse lines) of the logo."""
    usage = [line for line in logo.get("usage") or [] if isinstance(line, str)]
    rules = [line for line in usage if not line.startswith(MISUSE_PREFIX)]
    misuse = [line[len(MISUSE_PREFIX) :] for line in usage if line.startswith(MISUSE_PREFIX)]
    return rules, misuse


def _brand(document: dict[str, Any]) -> dict[str, str]:
    brand = document.get("brand") if isinstance(document.get("brand"), dict) else {}
    return {key: _clean(brand.get(key)) for key in ("tagline", "website", "audience")}


def _font_roles(document: dict[str, Any]) -> dict[str, tuple[str, list[str]]]:
    """role to (family, fallback stack) for display, body and mono."""
    font = (document.get("tokens") or {}).get("font") or {}
    out: dict[str, tuple[str, list[str]]] = {}
    for role in ("display", "body", "mono"):
        token = font.get(role)
        value = token.get("$value") if isinstance(token, dict) else None
        if isinstance(value, str):
            value = [part.strip().strip("\"'") for part in value.split(",")]
        if isinstance(value, list) and value and isinstance(value[0], str) and value[0].strip():
            out[role] = (value[0].strip(), [str(v) for v in value[1:] if str(v).strip()])
    return out


def _resolve(ref: Any, group: dict[str, Any]) -> Any:
    """``{weight.bold}`` to the token value in ``group`` (one level)."""
    if isinstance(ref, str):
        match = re.fullmatch(r"\{[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\}", ref.strip())
        if match:
            token = group.get(match.group(1))
            return token.get("$value") if isinstance(token, dict) else None
    return ref


def _type_rows(document: dict[str, Any]) -> list[dict[str, Any]]:
    """The composite type tokens: role, font role, size (CSS) and weight."""
    tokens = document.get("tokens") or {}
    type_group = tokens.get("type") or {}
    weights = tokens.get("weight") or {}
    variables = css_variables(document)
    rows = []
    for role in _SCALE:
        token = type_group.get(role)
        value = token.get("$value") if isinstance(token, dict) else None
        if not isinstance(value, dict):
            continue
        family_ref = str(value.get("fontFamily") or "")
        match = re.fullmatch(r"\{font\.(display|body|mono)\}", family_ref)
        size_ref = re.fullmatch(r"\{text\.([A-Za-z0-9_-]+)\}", str(value.get("fontSize") or ""))
        weight = _resolve(value.get("fontWeight"), weights)
        rows.append(
            {
                "role": role,
                "font": match.group(1) if match else "body",
                "size": variables.get(f"--text-{size_ref.group(1)}", "") if size_ref else "",
                "weight": weight if isinstance(weight, int) and not isinstance(weight, bool) else None,
            }
        )
    return rows


def _weights_by_font(document: dict[str, Any]) -> dict[str, list[tuple[int, list[str]]]]:
    """font role to [(weight, type roles using it)], lightest first."""
    out: dict[str, dict[int, list[str]]] = {}
    for row in _type_rows(document):
        if row["weight"] is None:
            continue
        out.setdefault(row["font"], {}).setdefault(row["weight"], []).append(row["role"])
    return {font: sorted(weights.items()) for font, weights in out.items()}


def _weight_name(weight: int) -> str:
    return f"{_WEIGHT_NAMES.get(weight, str(weight))} {weight}"


def _font_groups(document: dict[str, Any], labels: dict[str, str]) -> list[dict[str, Any]]:
    """One entry per distinct family: family, roles, label, fallback, weights."""
    roles = _font_roles(document)
    weights = _weights_by_font(document)
    groups: list[dict[str, Any]] = []
    for role in ("display", "body", "mono"):
        if role not in roles:
            continue
        family, fallback = roles[role]
        same = next((g for g in groups if g["family"] == family), None)
        if same:
            same["roles"].append(role)
            same["weights"] = sorted(set(same["weights"]) | {w for w, _ in weights.get(role, [])})
            continue
        groups.append(
            {
                "family": family,
                "roles": [role],
                "fallback": fallback,
                "weights": [w for w, _ in weights.get(role, [])],
            }
        )
    for group in groups:
        if group["roles"] == ["display", "body"]:
            group["label"] = labels["role_display_body"]
        else:
            group["label"] = ", ".join(labels[f"role_{r}"] for r in group["roles"])
    return groups


def _rgb(hex_value: str) -> str:
    r, g, b = (round(c * 255) for c in to_rgb(hex_value))
    return f"{r} {g} {b}"


def _color_name(name: str, lang: str) -> str:
    return _COLOR_NAMES[_lang(lang)].get(name) or name.replace("-", " ").capitalize()


def _color_role(name: str, lang: str) -> str:
    if _lang(lang) == "fr":
        return _ROLES_FR.get(name, "")
    return ROLES.get(name, "")


def _use(text: str, lang: str) -> str:
    return _USES_FR.get(text, text) if _lang(lang) == "fr" else text


def _accessibility(colors: dict[str, str], labels: dict[str, str]) -> list[str]:
    notes = []
    if "fg" in colors and "bg" in colors:
        ratio = contrast_ratio(colors["fg"], colors["bg"])
        notes.append(labels["acc_text"].format(ratio=_num(ratio), level=wcag_level(ratio)))
    if "accent" in colors and "bg" in colors:
        ratio = contrast_ratio(colors["accent"], colors["bg"])
        key = "acc_accent_ok" if ratio >= 4.5 else "acc_accent_small"
        notes.append(labels[key].format(ratio=_num(ratio)))
    failing = [row for row in contrast_pairs(colors) if not row["pass"]]
    notes.append(labels["acc_failing"].format(count=len(failing)) if failing else labels["acc_all_pass"])
    return notes


def _num(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def _month_year(lang: str, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    month = _MONTHS[_lang(lang)][now.month - 1]
    return f"{month} {now.year}"


def _public(path: str) -> str:
    return "/" + str(path).removeprefix("public/")


# ── Markdown ───────────────────────────────────────────────────────────────


def _md_cell(text: Any) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def _md_guidance(block: Any, labels: dict[str, str]) -> list[str]:
    if not isinstance(block, dict):
        return []
    lines: list[str] = []
    if _clean(block.get("summary")):
        lines += [_clean(block["summary"]), ""]
    dos = _lines(block, "do", 40)
    donts = _lines(block, "dont", 40)
    if dos:
        lines += [f"**{labels['do']}**", *(f"- {line}" for line in dos), ""]
    if donts:
        lines += [f"**{labels['dont']}**", *(f"- {line}" for line in donts), ""]
    return lines


def brand_guide_md(document: dict[str, Any], lang: str = "fr") -> str:
    """The brand guidelines in Markdown, in the order of the Forge guidelines."""
    labels = _labels(lang)
    name = _clean(document.get("name")) or "Design system"
    brand = _brand(document)
    logo = _logo(document)
    colors = colors_of(document)
    out: list[str] = [f"# {name}: {labels['guidelines']}", ""]
    if brand["tagline"]:
        out += [f"*{brand['tagline']}*", ""]
    if _clean(document.get("description")):
        out += [_clean(document["description"]), ""]
    facts = []
    if brand["audience"]:
        facts.append(
            f"**{labels['audience']}** : {brand['audience']}"
            if lang == "fr"
            else f"**{labels['audience']}**: {brand['audience']}"
        )
    if brand["website"]:
        facts.append(
            f"**{labels['website']}** : {brand['website']}"
            if lang == "fr"
            else f"**{labels['website']}**: {brand['website']}"
        )
    if facts:
        out += ["\n".join(f"- {fact}" for fact in facts), ""]
    out += [labels["name_rule_md"].format(name=name), ""]

    number = 0

    def heading(title: str) -> None:
        nonlocal number
        number += 1
        out.extend([f"## {number}. {title}", ""])

    if logo:
        rules, misuse = _usage(logo)
        heading(labels["logo"])
        out += [f"![{labels['logo_el']}]({_public(logo['src'])})", "", labels["logo_lead"], ""]
        out += [f"**{labels['versions']}**", "", labels["version_md_head"], "| --- | --- | --- |"]
        out.append(f"| {labels['v_main']} | `{_public(logo['src'])}` | {labels['v_main_use']} |")
        if logo.get("darkSrc"):
            out.append(f"| {labels['v_dark']} | `{_public(logo['darkSrc'])}` | {labels['v_dark_use']} |")
        if logo.get("iconSrc"):
            out.append(f"| {labels['v_icon']} | `{_public(logo['iconSrc'])}` | {labels['v_icon_use']} |")
        out.append("")
        if logo.get("darkSrc"):
            out += [f"![{labels['v_dark']}]({_public(logo['darkSrc'])})", ""]
        clear = _clean(logo.get("clearSpace")) or labels["clear_default"]
        out += [f"**{labels['clear_space']}.** {clear}", ""]
        if logo.get("minSizePx"):
            out += [f"**{labels['min_size']}**", "", labels["min_md_head"], "| --- | --- |"]
            out += [f"| {labels['logo_el']} | {int(logo['minSizePx'])} px |", ""]
        if rules:
            out += [f"**{labels['rules']}**", *(f"- {_md_cell(line)}" for line in rules), ""]
        donts = [
            labels["d_stretch"],
            labels["d_rotate"],
            labels["d_recolor"],
            labels["d_shadow"],
            labels["d_busy"],
            *misuse,
            *_lines(document.get("guidelines"), "dont", 40),
        ]
        out += [f"**{labels['donts']}**", *(f"- {line}" for line in dict.fromkeys(donts)), ""]

        if logo.get("iconSrc"):
            heading(labels["icon"])
            out += [f"![{labels['v_icon']}]({_public(logo['iconSrc'])})", "", labels["v_icon_use"], ""]
            heading(labels["app_icon"])
            out += [labels["app_lead"], "", labels["app_md_head"], "| --- | --- | --- |"]
            out += [
                f"| {labels['tile_dark']} | {labels['tile_dark_md']} | {labels['tile_dark_use']} |",
                f"| {labels['tile_accent']} | {labels['tile_accent_md']} | {labels['tile_accent_use']} |",
                f"| {labels['tile_light']} | {labels['tile_light_md']} | {labels['tile_light_use']} |",
                "",
            ]

    if colors:
        heading(labels["colour"])
        out += [labels["colour_md_head"], "| --- | --- | --- | --- |"]
        for token_name, value in colors.items():
            role = _color_role(token_name, lang)
            out.append(
                f"| {_color_name(token_name, lang)} (`--{token_name}`) | {value.upper()} | {_rgb(value)} "
                f"| {_md_cell(role)} |"
            )
        out.append("")
        notes = _accessibility(colors, labels)
        out += [f"**{labels['contrast_md']}.** " + " ".join(notes), ""]
        pairs = contrast_pairs(colors)
        if pairs:
            out += [labels["pair_md_head"], "| --- | --- | --- | --- |"]
            out += [
                f"| `--{row['fg']}` / `--{row['bg']}` | {_num(row['ratio'])}:1 | {row['level']} "
                f"| {_use(row['use'], lang)} |"
                for row in pairs
            ]
            out.append("")
        out += [f"**{labels['proportions']}.** {labels['prop_note']}", ""]

    groups = _font_groups(document, labels)
    if groups:
        heading(labels["typography"])
        out += [labels["font_md_head"], "| --- | --- | --- |"]
        for group in groups:
            weights = ", ".join(_weight_name(w) for w in group["weights"]) or "-"
            out.append(f"| {group['family']} | {group['label']} | {weights} |")
        out.append("")
        rows = [row for row in _type_rows(document) if row["size"]]
        families = {role: family for role, (family, _) in _font_roles(document).items()}
        if rows:
            out += [f"**{labels['scale']}**", "", labels["scale_md_head"], "| --- | --- | --- | --- |"]
            out += [
                f"| {row['role']} | {row['size']} | {families.get(row['font'], '')} | {row['weight'] or ''} |"
                for row in rows
            ]
            out.append("")
        url = google_fonts_url(font_families(document))
        fallback = [g for g in groups if g["fallback"]]
        if fallback:
            out.append(f"**{labels['fallback']}.** {labels['fallback_note']}")
            out += [f"- {g['family']}: {', '.join(g['fallback'])}" for g in fallback]
            out.append("")
        if url:
            out += [f"Google Fonts: {url}", ""]

    icon = (document.get("tokens") or {}).get("icon") or {}
    if isinstance(icon, dict) and icon:
        library = _clean((icon.get("library") or {}).get("$value"))
        style = _clean((icon.get("style") or {}).get("$value"))
        stroke = css_variables(document).get("--icon-stroke", "")
        guidance = (((icon.get("style") or {}).get("$extensions") or {}).get("forge") or {}).get("guidance")
        heading(labels["iconography_md"])
        facts = [
            f"{labels['library']}: {library}" if library else "",
            f"{labels['style']}: {style}" if style else "",
            f"{labels['stroke']}: {stroke}" if stroke else "",
        ]
        out += [" · ".join(f for f in facts if f), ""]
        out += _md_guidance(guidance, labels)

    for key, title in (("imagery", "imagery"), ("voice", "voice"), ("guidelines", "principles")):
        block = _md_guidance(document.get(key), labels)
        if key == "voice" and brand["audience"] and not block:
            block = [brand["audience"], ""]
        if block:
            heading(labels[title])
            out += block

    if document.get("components"):
        heading(labels["components"])
        out += [", ".join(str(c) for c in document["components"]), ""]

    heading(labels["files"])
    out += [labels["files_lead"], "", f"| {labels['file']} | {labels['use']} |", "| --- | --- |"]
    for row in _file_rows(document, labels):
        out.append(f"| `{row[0]}` | {row[1]} |")
    out.append("")
    return "\n".join(out).rstrip() + "\n"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (name or "design-system").lower()).strip("-")[:60] or "design-system"


def _file_rows(document: dict[str, Any], labels: dict[str, str]) -> list[tuple[str, str]]:
    logo = _logo(document)
    base = _slug(_clean(document.get("name")))
    rows: list[tuple[str, str]] = []
    if logo:
        rows.append((_public(logo["src"]), labels["f_logo"]))
        if logo.get("darkSrc"):
            rows.append((_public(logo["darkSrc"]), labels["f_dark"]))
        if logo.get("iconSrc"):
            rows.append((_public(logo["iconSrc"]), labels["f_icon"]))
    rows += [
        (f"{base}.tokens.json", labels["f_tokens"]),
        (f"{base}.tokens.css", labels["f_css"]),
        ("tailwind.config.js", labels["f_tailwind"]),
        (f"{base}-brand-guidelines.md", labels["f_md"]),
    ]
    return rows


# ── logo analysis (for the variants drawn with CSS) ────────────────────────

_VIEWBOX_RE = re.compile(r"viewBox\s*=\s*[\"'][-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)")
_SVG_COLOR_RE = re.compile(r"(?:fill|stroke|stop-color)\s*[=:]\s*[\"']?\s*(#[0-9A-Fa-f]{3,8})\b")


def logo_profile(url: str) -> dict[str, Any]:
    """``transparent``: the file has no background of its own, so CSS filters
    can recolour it; ``light``: it is drawn in light colours, for dark grounds;
    ``aspect``: width over height. Only inlined files (data URIs) are read;
    anything else counts as a dark, transparent mark of aspect 3."""
    profile: dict[str, Any] = {"transparent": True, "light": False, "aspect": 3.0}
    match = re.match(r"^data:([^;,]+);base64,(.*)$", url or "", re.S)
    if not match:
        return profile
    try:
        data = base64.b64decode(match.group(2))
    except ValueError:
        return profile
    if match.group(1) == "image/svg+xml":
        text = data.decode("utf-8", "ignore")
        box = _VIEWBOX_RE.search(text)
        if box and float(box.group(2)) > 0:
            profile["aspect"] = float(box.group(1)) / float(box.group(2))
        light = dark = 0
        for raw in _SVG_COLOR_RE.findall(text):
            value = normalize_hex(raw)
            if not value:
                continue
            ratio = contrast_ratio(value, "#ffffff")
            light += ratio < 1.6
            dark += ratio >= 4.5
        profile["light"] = light > 0 and light >= dark
        return profile
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as image:
            if image.height:
                profile["aspect"] = image.width / image.height
            rgba = image.convert("RGBA")
            rgba.thumbnail((96, 96))
            pixels = list(rgba.getdata())
    except Exception:
        return profile
    if not pixels:
        return profile
    clear = sum(1 for p in pixels if p[3] < 24)
    profile["transparent"] = clear / len(pixels) > 0.04
    opaque = [p for p in pixels if p[3] > 160]
    if opaque and profile["transparent"]:
        lum = [(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255 for p in opaque]
        light = sum(1 for v in lum if v > 0.82)
        dark = sum(1 for v in lum if v < 0.35)
        profile["light"] = light > dark
    return profile


# ── print document ─────────────────────────────────────────────────────────

# On a screen (the published page) the A4 pages stack like sheets on a desk,
# scaled down in steps so a page always fits the window width. Print is untouched.
_SCREEN_STYLE = """
@media screen{
html{background:#2b2e35}
body{background:transparent;padding:40px 16px 56px;display:flex;flex-direction:column;align-items:center;gap:32px}
.page{flex:none;border-radius:6px;box-shadow:0 18px 50px rgba(0,0,0,.4)}
}
@media screen and (max-width:1200px){body{zoom:.84;gap:28px}}
@media screen and (max-width:1020px){body{zoom:.7}}
@media screen and (max-width:860px){body{zoom:.58;padding:24px 12px 40px;gap:22px}}
@media screen and (max-width:720px){body{zoom:.48}}
@media screen and (max-width:600px){body{zoom:.4}}
@media screen and (max-width:500px){body{zoom:.32;padding:16px 8px 28px}}
"""

_STYLE = """
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--g-paper);color:var(--g-ink);font-family:var(--g-body);font-size:13px;line-height:1.55;
-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;padding:52px 60px 64px;display:flex;
flex-direction:column;page-break-after:always;break-after:page;background:var(--g-paper)}
.page:last-child{page-break-after:auto;break-after:auto}
.kicker{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--g-kicker);
margin:0 0 10px}
h1,h2,h3{font-family:var(--g-display);margin:0;font-weight:600;letter-spacing:-.01em}
h1{font-size:40px;line-height:1.06;margin-bottom:28px;max-width:760px}
h3{font-size:14px;font-weight:600;margin-bottom:8px}
p{margin:0 0 10px}
.content{flex:1;min-height:0;display:flex;gap:40px}
.col{flex:1;min-width:0;display:flex;flex-direction:column;gap:14px}
.col.narrow{flex:0 0 300px}
.grey{color:var(--g-grey)}
.small{font-size:11px;line-height:1.5}
.mono{font-family:var(--g-mono);font-size:.92em}
.lead{font-size:15px;line-height:1.6;max-width:560px}
.clamp4,.clamp6,.clamp10{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.clamp4{-webkit-line-clamp:4}.clamp6{-webkit-line-clamp:6}.clamp10{-webkit-line-clamp:10}
.panel{background:var(--g-panel);border-radius:14px;padding:18px 20px}
.footer{position:absolute;left:60px;right:60px;bottom:26px;display:flex;justify-content:space-between;
font-size:9.5px;color:var(--g-grey)}
table{width:100%;border-collapse:collapse}
td,th{text-align:left;padding:7px 0;border-bottom:1px solid var(--g-line);vertical-align:top;font-weight:400}
th{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--g-grey);padding-top:0}
td.n{width:44px;color:var(--g-grey)}
td.p{width:40px;text-align:right;color:var(--g-grey)}
ul.rules{margin:0;padding:0;list-style:none}
ul.rules li{padding:7px 0;border-bottom:1px solid var(--g-line)}
ul.rules li:first-child{padding-top:0}
.stage{display:flex;align-items:center;justify-content:center;border-radius:16px;overflow:hidden;position:relative}
.stage img{display:block;max-width:72%;max-height:62%;object-fit:contain}
.cap{font-size:10.5px;color:var(--g-grey);margin-top:7px;line-height:1.4}
.cap b{color:var(--g-ink);font-weight:600}
.grid{display:grid;gap:14px}
.cover{background:var(--g-cover);color:#ffffff;padding:56px 64px}
.cover .shape{position:absolute;top:0;right:0;width:46%;height:62%;background:var(--g-accent);
clip-path:polygon(18% 0,100% 0,100% 100%,82% 100%,82% 74%,64% 74%,64% 44%,46% 44%,46% 18%,28% 18%,28% 0)}
.cover .logo{height:62px;display:flex;align-items:center}
.cover .logo img{max-height:62px;max-width:300px;object-fit:contain}
.cover .plate{background:#ffffff;border-radius:12px;padding:10px 16px}
.cover .bottom{margin-top:auto}
.cover .kicker{color:var(--g-cover-kicker)}
.cover h1{font-size:64px;line-height:1.02;color:#ffffff;margin:0 0 18px;font-weight:600}
.cover .sub{font-size:13px;color:rgba(255,255,255,.72);max-width:520px}
.badge-forge{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px 0 6px;border-radius:999px;background:#1C1F26;color:#fff;border:1px solid rgba(255,255,255,.14);font-size:11.5px;font-weight:600;white-space:nowrap;text-decoration:none;font-family:system-ui,sans-serif}
.badge-forge svg{width:14px;height:14px;flex:none}
.cover .badge-forge{position:absolute;right:64px;bottom:52px}
.callout{background:var(--g-panel);border-radius:14px;padding:16px 20px;max-width:520px;font-size:12px}
.callout b.t{display:block;font-weight:600;margin-bottom:4px}
.facts{display:flex;gap:28px;margin-top:6px}
.facts div{font-size:12px}
.facts span{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--g-grey)}
.dont-tile{position:relative;height:172px;border-radius:12px;background:var(--g-panel);display:flex;
align-items:center;justify-content:center;overflow:hidden}
.dont-tile img{max-width:62%;max-height:48%;object-fit:contain}
.dont-tile .x{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:var(--g-red);
color:#fff;font-size:12px;line-height:18px;text-align:center;font-weight:700;font-family:Arial,sans-serif}
.busy{background:repeating-linear-gradient(45deg,var(--g-accent) 0 10px,#ffffff 10px 20px,var(--g-ink) 20px 30px)}
.clear-wrap{position:relative;display:inline-block;padding:28px;background:repeating-linear-gradient(-45deg,
var(--g-tint) 0 6px,transparent 6px 12px);outline:1.5px dashed var(--g-kicker)}
.clear-wrap .core{background:var(--g-paper);outline:1px solid var(--g-line)}
.stage .clear-wrap img{display:block;width:400px;height:auto;max-width:none;max-height:150px;object-fit:contain}
.tile{border-radius:22.5%;display:flex;align-items:center;justify-content:center;overflow:hidden}
.tile img{width:62.5%;height:62.5%;object-fit:contain}
.swatch{border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;justify-content:flex-end;
font-size:11px;line-height:1.5}
.swatch b{font-size:13px;font-weight:600;display:block}
.swatch.edge{box-shadow:inset 0 0 0 1px var(--g-line)}
.chip{border-radius:10px;height:46px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.prop{display:flex;height:34px;border-radius:10px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--g-line)}
.prop div{display:flex;align-items:center;padding:0 12px;font-size:10.5px;font-weight:600}
.aa{display:inline-flex;align-items:center;justify-content:center;width:42px;height:26px;border-radius:7px;
font-weight:700;font-size:12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.lvl{display:inline-block;border-radius:999px;padding:1px 9px;font-size:10px;font-weight:700}
.lvl.ok{background:#dcfce7;color:#14532d}
.lvl.ko{background:#fee2e2;color:#7f1d1d}
.specimen{font-size:96px;line-height:1;margin-bottom:6px}
.fontcard{border-top:1px solid var(--g-line);padding-top:14px}
.fontcard .fam{font-size:20px;font-weight:600;margin-bottom:2px}
.scale-row{display:flex;align-items:baseline;gap:16px;padding:6px 0;border-bottom:1px solid var(--g-line)}
.scale-row .meta{flex:0 0 110px;font-size:10px;color:var(--g-grey);line-height:1.35}
.scale-row .s{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15}
.icons{display:flex;gap:12px;flex-wrap:wrap}
.icons span{width:58px;height:58px;border-radius:12px;background:var(--g-panel);display:flex;align-items:center;
justify-content:center;color:var(--g-ink)}
.icons svg{width:26px;height:26px}
.icons.big{gap:18px}
.icons.big span{width:132px;height:132px;border-radius:22px}
.icons.big svg{width:48px;height:48px}
.dd{display:flex;gap:14px}
.dd .panel{flex:1}
.dd h3.do{color:#15803d}
.dd h3.dont{color:#b91c1c}
.dd ul{margin:0;padding-left:16px}
.dd li{margin:4px 0}
.col.narrow .dd{flex-direction:column}
.statement{font-family:var(--g-display);font-size:28px;line-height:1.25;max-width:860px;margin:0}
.roomy .dd{font-size:14px}
.roomy .dd .panel{padding:22px 26px}
.frame{background:var(--bg);color:var(--fg);border-radius:16px;padding:28px;font-family:var(--font-body,inherit);
display:grid;grid-template-columns:1fr 1fr;gap:22px;align-content:start;box-shadow:inset 0 0 0 1px var(--g-line)}
.frame .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.frame .btn{font:inherit;font-size:13px;font-weight:600;border-radius:var(--radius-md,8px);padding:9px 16px;
border:1px solid transparent}
.frame .btn.primary{background:var(--accent);color:var(--accent-contrast)}
.frame .btn.secondary{background:var(--surface);color:var(--fg);border-color:var(--border)}
.frame .field{display:grid;gap:5px;font-size:12px;color:var(--muted)}
.frame .field input{font:inherit;font-size:13px;padding:9px 11px;border-radius:var(--radius-md,8px);
border:1px solid var(--border);background:var(--surface);color:var(--fg)}
.frame .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,14px);
padding:16px;box-shadow:var(--shadow-md,none)}
.frame .card h4{margin:0 0 6px;font-family:var(--font-display,inherit);font-size:15px}
.frame .card p{color:var(--muted);font-size:12px;margin:0 0 12px}
.frame .tag{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:600}
.frame .tag.accent{background:var(--accent);color:var(--accent-contrast)}
.frame .tag.soft{background:var(--surface);color:var(--fg);border:1px solid var(--border)}
.frame .alert{border:1px solid;border-radius:var(--radius-md,8px);padding:9px 12px;font-size:12px;margin-bottom:8px}
.frame .alert.info{border-color:var(--info)}.frame .alert.success{border-color:var(--success)}
.frame .alert.danger{border-color:var(--danger)}
.frame table td{border-color:var(--border);padding:6px 4px;font-size:12px}
.radii{display:flex;gap:10px;margin-top:10px}
.radii div{width:60px;height:44px;background:var(--g-panel);font-size:9.5px;color:var(--g-grey);display:flex;
align-items:flex-end;padding:5px 6px;box-shadow:inset 0 0 0 1px var(--g-line)}
.closing{align-items:center;justify-content:center;text-align:center}
.closing img{max-height:110px;max-width:420px;object-fit:contain}
"""


class _Page:
    def __init__(self, key: str, title: str, toc: str, body: str, *, numbered: bool = True) -> None:
        self.key = key
        self.title = title
        self.toc = toc
        self.body = body
        self.numbered = numbered


def _img(src: str, alt: str, style: str = "") -> str:
    style_attr = f' style="{style}"' if style else ""
    return f'<img src="{escape(src)}" alt="{escape(alt)}"{style_attr}>'


def _list(items: list[str], css: str = "rules") -> str:
    return f'<ul class="{css}">' + "".join(f"<li>{escape(item)}</li>" for item in items) + "</ul>"


def _guidance_html(block: Any, labels: dict[str, str], limit: int = 6, *, statement: bool = False) -> str:
    if not isinstance(block, dict):
        return ""
    parts = []
    summary = _clean(block.get("summary"))
    if summary:
        css = "statement clamp4" if statement else "lead clamp4"
        parts.append(f'<p class="{css}">{escape(summary)}</p>')
    dos = _lines(block, "do", limit)
    donts = _lines(block, "dont", limit)
    if dos or donts:
        parts.append('<div class="dd">')
        if dos:
            parts.append(f'<div class="panel"><h3 class="do">{labels["do"]}</h3>{_list(dos, "")}</div>')
        if donts:
            parts.append(f'<div class="panel"><h3 class="dont">{labels["dont"]}</h3>{_list(donts, "")}</div>')
        parts.append("</div>")
    return "".join(parts)


def _theme(colors: dict[str, str]) -> dict[str, str]:
    """Colours of the guide itself: white pages, the brand's dark as ink and cover."""
    candidates = [colors[k] for k in ("fg", "bg", "surface") if k in colors]
    dark = min(candidates, key=lambda c: -contrast_ratio(c, "#ffffff"), default=_FALLBACK_INK)
    ink = dark if contrast_ratio(dark, "#ffffff") >= 12 else _FALLBACK_INK
    accent = colors.get("accent", "#ea580c")
    kicker = ensure_contrast(accent, _PAPER, 3.0)
    cover_kicker = accent if contrast_ratio(accent, ink) >= 3 else "#ffffff"
    r, g, b = (round(c * 255) for c in to_rgb(kicker))
    return {
        "ink": ink,
        "accent": accent,
        "kicker": kicker,
        "cover_kicker": cover_kicker,
        "tint": f"rgba({r},{g},{b},.10)",
    }


def _shorten(text: str, limit: int) -> str:
    """At most ``limit`` characters, cut at a word with an ellipsis."""
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.")
    return f"{cut}…"


def brand_guide_html(
    document: dict[str, Any],
    *,
    asset_url: Callable[[str], str],
    lang: str = "fr",
    badge: bool = True,
    remote_fonts: bool = True,
    now: datetime | None = None,
    screen: bool = False,
) -> str:
    """The brand guidelines as print pages (A4 landscape, one topic per page).

    ``screen`` adds the viewport and the on-screen layout, for the published page.
    """
    lang = _lang(lang)
    labels = _labels(lang)
    raw_name = _clean(document.get("name")) or "Design system"
    name = escape(raw_name)
    brand = _brand(document)
    colors = colors_of(document)
    variables = css_variables(document)
    theme = _theme(colors)
    ink = theme["ink"]
    accent = theme["accent"]
    roles = _font_roles(document)
    display_family = roles.get("display", ("", []))[0]
    body_family = roles.get("body", ("", []))[0]
    pages: list[_Page] = []

    logo = _logo(document)
    src = asset_url(str(logo["src"])) if logo else ""
    dark_src = asset_url(str(logo["darkSrc"])) if logo.get("darkSrc") else ""
    icon_src = asset_url(str(logo["iconSrc"])) if logo.get("iconSrc") else ""
    profile = logo_profile(src) if src else {"transparent": False, "light": False}

    def on_dark() -> tuple[str, str]:
        """(src, CSS filter) of the logo for a dark or coloured ground."""
        if dark_src:
            return dark_src, ""
        if profile["light"] or not profile["transparent"]:
            return src, ""
        return src, _WHITE_FILTER

    def on_light() -> tuple[str, str]:
        if not profile["light"]:
            return src, ""
        if profile["transparent"]:
            return src, _BLACK_FILTER
        return src, ""

    def logo_img(pair: tuple[str, str], style: str = "") -> str:
        source, filt = pair
        css = (f"filter:{filt};" if filt else "") + style
        return _img(source, raw_name, css)

    # Intro (filled in once every page is known, for the contents).
    intro_index = 0

    if src:
        main_ground = ink if profile["light"] and not dark_src else _PANEL
        rules, misuse = _usage(logo)
        pages.append(
            _Page(
                "logo",
                labels["logo"],
                labels["logo"],
                f'<div class="content" style="flex-direction:column;gap:16px">'
                f'<div class="stage" style="flex:1;background:{main_ground}">'
                f"{logo_img((src, ''), 'width:56%;height:auto;max-width:56%;max-height:58%')}</div>"
                f'<p class="grey" style="margin:0;max-width:620px">{escape(labels["logo_lead"])}</p></div>',
            )
        )

        # On every background.
        tiles: list[tuple[str, str, str, str]] = []  # (ground, img html, label, extra css)
        tiles.append(
            (_PAPER, logo_img(on_light()), labels["bg_light"], "box-shadow:inset 0 0 0 1px " + _LINE)
        )
        tiles.append((ink, logo_img(on_dark()), labels["bg_dark"], ""))
        accent_pair = (src, _WHITE_FILTER) if profile["transparent"] else on_dark()
        tiles.append((accent, logo_img(accent_pair), labels["bg_accent"], ""))
        if profile["transparent"]:
            tiles.append((_PANEL, logo_img((src, _BLACK_FILTER)), labels["mono_black"], ""))
            tiles.append((ink, logo_img((src, _WHITE_FILTER)), labels["mono_white"], ""))
        top = tiles[:3]
        bottom = tiles[3:]
        tile_html = (
            '<div class="grid" style="grid-template-columns:repeat(3,1fr)">'
            + "".join(
                f'<div><div class="stage" style="height:{170 if bottom else 230}px;background:{g};{extra}">{img}</div>'
                f'<div class="cap"><b>{escape(label)}</b></div></div>'
                for g, img, label, extra in top
            )
            + "</div>"
        )
        if bottom:
            tile_html += (
                '<div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:6px">'
                + "".join(
                    f'<div><div class="stage" style="height:150px;background:{g};{extra}">{img}</div>'
                    f'<div class="cap"><b>{escape(label)}</b></div></div>'
                    for g, img, label, extra in bottom
                )
                + f'<div class="small grey" style="align-self:end">{escape(labels["backgrounds_note"])}</div>'
                "</div>"
            )
        else:
            tile_html += (
                f'<p class="small grey" style="margin-top:14px">{escape(labels["backgrounds_note"])}</p>'
            )
        pages.append(
            _Page(
                "backgrounds",
                labels["backgrounds"],
                labels["backgrounds"],
                f'<div class="content" style="flex-direction:column;gap:0">{tile_html}</div>',
            )
        )

        # Clear space and minimum sizes.
        clear = _clean(logo.get("clearSpace"))
        min_px = int(logo["minSizePx"]) if logo.get("minSizePx") else 0
        light_pair = on_light()
        stage_ground = (
            ink if (profile["light"] and light_pair[1] == "" and not profile["transparent"]) else _PAPER
        )
        size_ground = _PANEL if stage_ground == _PAPER else ink
        sizes = ""
        if min_px:
            colon = " :" if lang == "fr" else ":"
            # The logo at its minimum size and at 2x and 3x, when they fit the column.
            aspect = max(0.2, float(profile["aspect"]))
            steps = [px for px in (min_px * 3, min_px * 2, min_px) if px <= 110 and px * aspect <= 340]
            samples = "".join(
                f'<div style="display:flex;align-items:center;gap:18px">'
                f"{logo_img(light_pair, f'height:{px}px;width:auto;max-width:none')}"
                f'<span class="cap" style="margin:0;white-space:nowrap">{px} px</span></div>'
                for px in steps or [min_px]
            )
            sizes = (
                f'<div><div class="kicker" style="color:{_GREY}">{labels["min_size"]}</div>'
                f'<div class="panel" style="display:flex;flex-direction:column;gap:16px;background:{size_ground}">'
                f'{samples}</div><p class="small grey" style="margin-top:8px">'
                f"{escape(labels['min_size'])}{colon} {min_px} px. {escape(labels['min_note'])}</p></div>"
            )
        rules_html = ""
        if rules:
            rules_html = f'<div><div class="kicker" style="color:{_GREY}">{labels["rules"]}</div>{_list(rules[:6])}</div>'
        pages.append(
            _Page(
                "clear",
                labels["clear"],
                labels["clear_md"],
                '<div class="content">'
                f'<div class="col" style="flex:1.25"><div class="stage" style="flex:1;background:{_PANEL}">'
                f'<div class="clear-wrap"><div class="core" style="background:{stage_ground}">'
                f"{logo_img(light_pair)}</div></div></div>"
                f'<p class="small" style="margin:0"><b>{labels["clear_space"]}.</b> '
                f"{escape(clear or labels['clear_default'])}</p></div>"
                f'<div class="col">{sizes}{rules_html}</div></div>',
            )
        )

        # Don'ts: misuse examples drawn from the logo itself.
        base = on_light()
        base_filter = f"filter:{base[1]};" if base[1] else ""
        examples = [
            ("transform:scale(1.45,.7);" + base_filter, labels["d_stretch"], ""),
            ("transform:rotate(-14deg);" + base_filter, labels["d_rotate"], ""),
            ("filter:hue-rotate(150deg) saturate(1.8) invert(.15);", labels["d_recolor"], ""),
            (
                f"filter:{base[1] + ' ' if base[1] else ''}drop-shadow(5px 6px 3px rgba(0,0,0,.55));",
                labels["d_shadow"],
                "",
            ),
            (base_filter, labels["d_busy"], "busy"),
        ]
        if profile["transparent"]:
            outline = " ".join(
                f"drop-shadow({x}px {y}px 0 {ink})" for x, y in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            examples.append((f"filter:{_WHITE_FILTER} {outline};", labels["d_outline"], ""))
        else:
            examples.append(("opacity:.28;", labels["d_contrast"], ""))
        tiles_html = "".join(
            f'<div><div class="dont-tile {cls}">{_img(src, raw_name, style)}<span class="x">×</span></div>'
            f'<div class="cap">{escape(caption)}</div></div>'
            for style, caption, cls in examples
        )
        extra = list(dict.fromkeys([*misuse, *_lines(document.get("guidelines"), "dont", 12)]))[:9]
        side = (
            f'<div class="col narrow"><div class="kicker" style="color:{_GREY}">{labels["also_avoid"]}</div>'
            f"{_list(extra)}</div>"
            if extra
            else ""
        )
        pages.append(
            _Page(
                "donts",
                labels["donts_title"],
                labels["donts"],
                '<div class="content"><div class="col"><div class="grid" '
                'style="grid-template-columns:repeat(3,1fr);row-gap:10px">'
                f"{tiles_html}</div></div>{side}</div>",
            )
        )

    # App icon.
    if icon_src:
        icon_profile = logo_profile(icon_src)
        icon_white = _WHITE_FILTER if icon_profile["transparent"] else ""
        tiles = [
            (ink, "", labels["tile_dark"], labels["tile_dark_use"], 250),
            (accent, icon_white, labels["tile_accent"], labels["tile_accent_use"], 150),
            (_PAPER, "", labels["tile_light"], labels["tile_light_use"], 150),
        ]
        tile_html = "".join(
            f'<div style="display:flex;flex-direction:column;align-items:flex-start">'
            f'<div class="tile" style="width:{size}px;height:{size}px;background:{ground};'
            f'box-shadow:inset 0 0 0 1px {_LINE}">'
            f"{_img(icon_src, raw_name, f'filter:{filt}' if filt else '')}</div>"
            f'<div class="cap" style="max-width:{max(size, 170)}px"><b>{escape(label)}</b><br>{escape(use)}</div></div>'
            for ground, filt, label, use, size in tiles
        )
        favicon = "".join(
            f'<div style="text-align:center"><div class="tile" style="width:{px}px;height:{px}px;background:{ink}">'
            f'{_img(icon_src, raw_name)}</div><div class="cap">{px} px</div></div>'
            for px in (64, 32, 16)
        )
        pages.append(
            _Page(
                "app_icon",
                labels["app_icon"],
                labels["app_icon"],
                '<div class="content"><div class="col narrow">'
                f'<p class="lead">{escape(labels["app_lead"])}</p>'
                f'<div><div class="kicker" style="color:{_GREY}">{labels["favicon"]}</div>'
                f'<div style="display:flex;gap:20px;align-items:flex-end">{favicon}</div></div></div>'
                f'<div class="col" style="flex-direction:row;gap:28px;align-items:flex-start">{tile_html}</div></div>',
            )
        )

    # Colour.
    if colors:
        brand_keys = [k for k in ("accent", "secondary", "fg", "bg") if k in colors]
        other_keys = [k for k in colors if k not in brand_keys and k != "accent-contrast"][:8]

        def swatch(key: str, height: str) -> str:
            value = colors[key]
            text = (
                "#ffffff"
                if contrast_ratio("#ffffff", value) >= contrast_ratio("#0b0b0f", value)
                else "#0b0b0f"
            )
            edge = " edge" if contrast_ratio(value, _PAPER) < 1.25 else ""
            return (
                f'<div class="swatch{edge}" style="background:{value};color:{text};height:{height}">'
                f"<b>{escape(_color_name(key, lang))}</b>"
                f"<span>{value.upper()} · RGB {_rgb(value)}</span>"
                f'<span style="opacity:.78">{escape(_color_role(key, lang))}</span></div>'
            )

        big = "".join(swatch(k, "270px" if other_keys else "340px") for k in brand_keys)
        chips = "".join(
            f'<div><div class="chip" style="background:{colors[k]}"></div>'
            f'<div class="cap"><b>{escape(_color_name(k, lang))}</b><br>{colors[k].upper()}</div></div>'
            for k in other_keys
        )
        bg = colors.get("bg", _PAPER)
        neutral = colors.get("surface", colors.get("muted", _PANEL))
        prop = (
            f'<div class="prop"><div style="flex:60;background:{bg};color:{_text_on(bg)}">60 % · {labels["prop_bg"]}</div>'
            f'<div style="flex:30;background:{neutral};color:{_text_on(neutral)}">30 % · {labels["prop_neutral"]}</div>'
            f'<div style="flex:10;background:{accent};color:{_text_on(accent)}">10 %</div></div>'
        )
        if lang == "en":
            prop = prop.replace(" %", "%")
        pages.append(
            _Page(
                "colour",
                labels["colour"],
                labels["colour"],
                '<div class="content" style="flex-direction:column;gap:18px">'
                f'<div class="grid" style="grid-template-columns:repeat({len(brand_keys)},1fr)">{big}</div>'
                + (
                    f'<div class="grid" style="grid-template-columns:repeat({max(len(other_keys), 1)},1fr)">{chips}</div>'
                    if other_keys
                    else ""
                )
                + f'<div><div class="kicker" style="color:{_GREY}">{labels["proportions"]}</div>{prop}'
                f'<p class="small grey" style="margin-top:8px">{escape(labels["prop_note"])}</p></div></div>',
            )
        )

        rows = "".join(
            f'<tr><td style="width:60px"><span class="aa" style="background:{colors[row["bg"]]};'
            f'color:{colors[row["fg"]]}">Aa</span></td>'
            f'<td><span class="mono">--{row["fg"]}</span> / <span class="mono">--{row["bg"]}</span></td>'
            f"<td>{_num(row['ratio'])}:1</td>"
            f'<td><span class="lvl {"ok" if row["pass"] else "ko"}">{row["level"]}</span></td>'
            f'<td class="grey">{escape(_use(row["use"], lang))}</td></tr>'
            for row in contrast_pairs(colors)
        )
        notes = "".join(f"<p>{escape(note)}</p>" for note in _accessibility(colors, labels))
        pages.append(
            _Page(
                "contrast",
                labels["contrast"],
                labels["contrast_md"],
                '<div class="content"><div class="col narrow">'
                f'<div class="lead" style="font-size:14px">{notes}</div></div>'
                f'<div class="col"><table><tr><th></th><th>{labels["pair"]}</th><th>{labels["ratio"]}</th>'
                f"<th>{labels['level']}</th><th>{labels['use']}</th></tr>{rows}</table></div></div>",
            )
        )

    # Typography.
    groups = _font_groups(document, labels)
    if groups:
        cards = ""
        for group in groups[:3]:
            family = escape(group["family"])
            weights = " · ".join(
                f'<span style="font-weight:{w}">{_weight_name(w)}</span>' for w in group["weights"]
            )
            size = 96 if len(groups) == 1 else (78 if len(groups) == 2 else 52)
            cards += (
                f'<div class="fontcard"><div class="specimen" style="font-family:\'{family}\',var(--g-body);'
                f'font-size:{size}px">Aa</div>'
                f'<div class="fam" style="font-family:\'{family}\',var(--g-body)">{family}</div>'
                f'<div class="small grey">{escape(group["label"])}</div>'
                + (f'<div class="small" style="margin-top:6px">{weights}</div>' if weights else "")
                + "</div>"
            )
        fallback = [g for g in groups if g["fallback"]]
        fallback_html = (
            (
                f'<p class="small grey" style="margin-top:auto">{labels["fallback"]} : '
                if lang == "fr"
                else f'<p class="small grey" style="margin-top:auto">{labels["fallback"]}: '
            )
            + "; ".join(f"{escape(g['family'])} → {escape(', '.join(g['fallback'][:3]))}" for g in fallback)
            + "</p>"
            if fallback
            else ""
        )
        sample_long = labels["sample"]
        sample_title = brand["tagline"] or raw_name
        scale_rows = ""
        for row in _type_rows(document):
            if not row["size"]:
                continue
            family = roles.get(row["font"], ("", []))[0]
            if row["role"] in ("display", "h1"):
                text = raw_name
            elif row["role"] in ("h2", "h3"):
                text = sample_title
            else:
                text = "const tokens = await load();" if row["role"] == "code" else sample_long
            meta = f"{row['role']}<br>{escape(row['size'])}" + (
                f" · {row['weight']}" if row["weight"] else ""
            )
            scale_rows += (
                f'<div class="scale-row"><div class="meta">{meta}</div>'
                f'<div class="s" style="font-family:\'{escape(family)}\',var(--g-body);'
                f'font-size:min({escape(row["size"])},48px);font-weight:{row["weight"] or 400}">'
                f"{escape(text)}</div></div>"
            )
        pages.append(
            _Page(
                "typography",
                labels["typography"],
                labels["typography"],
                '<div class="content"><div class="col" style="flex:0 0 340px;gap:14px">'
                f"{cards}{fallback_html}</div>"
                f'<div class="col"><div class="kicker" style="color:{_GREY}">{labels["scale"]}</div>'
                f"{scale_rows}</div></div>",
            )
        )

    # Iconography and imagery.
    icon = (document.get("tokens") or {}).get("icon") or {}
    if isinstance(icon, dict) and icon:
        stroke = variables.get("--icon-stroke", "1.75px").removesuffix("px")
        filled = (icon.get("style") or {}).get("$value") == "filled"
        icons = "".join(
            f'<span><svg viewBox="0 0 24 24" fill="{"currentColor" if filled else "none"}" stroke="currentColor" '
            f'stroke-width="{escape(stroke)}" stroke-linecap="round" stroke-linejoin="round">{path}</svg></span>'
            for path in _ICONS
        )
        library = _clean((icon.get("library") or {}).get("$value"))
        style = _clean((icon.get("style") or {}).get("$value"))
        facts = "".join(
            f"<div><span>{label}</span>{escape(value)}</div>"
            for label, value in (
                (labels["library"], library),
                (labels["style"], style),
                (labels["stroke"], variables.get("--icon-stroke", "")),
            )
            if value
        )
        guidance = (((icon.get("style") or {}).get("$extensions") or {}).get("forge") or {}).get("guidance")
        icon_rules = _guidance_html(guidance, labels, 3)
        imagery = _guidance_html(document.get("imagery"), labels, 4)
        if icon_rules or imagery:
            body_html = (
                '<div class="content"><div class="col narrow">'
                f'<div class="kicker" style="color:{_GREY}">{labels["icons"]}</div>'
                f'<div class="icons">{icons}</div><div class="facts">{facts}</div>{icon_rules}</div>'
                + (
                    f'<div class="col"><div class="kicker" style="color:{_GREY}">{labels["imagery"]}</div>'
                    f"{imagery}</div>"
                    if imagery
                    else ""
                )
                + "</div>"
            )
        else:
            # No written guidance: show the icon style larger, and the icon sizes of the tokens.
            sizes = "".join(
                f'<div style="text-align:center"><svg viewBox="0 0 24 24" width="{escape(value)}" '
                f'height="{escape(value)}" fill="none" stroke="currentColor" stroke-width="{escape(stroke)}" '
                f'stroke-linecap="round" stroke-linejoin="round">{_ICONS[1]}</svg>'
                f'<div class="cap">{escape(key[12:])} · {escape(value)}</div></div>'
                for key, value in variables.items()
                if key.startswith("--icon-size-")
            )
            body_html = (
                '<div class="content" style="flex-direction:column;gap:22px">'
                f'<div class="icons big">{icons}</div><div class="facts">{facts}</div>'
                + (f'<div style="display:flex;gap:36px;align-items:flex-end">{sizes}</div>' if sizes else "")
                + "</div>"
            )
        pages.append(
            _Page(
                "iconography",
                labels["iconography"] if imagery else labels["iconography_md"],
                labels["iconography_md"] + (f" · {labels['imagery']}" if imagery else ""),
                body_html,
            )
        )

    # Voice, and the principles (on the same page when both are short).
    voice = document.get("voice")
    voice_html = _guidance_html(voice, labels, 6, statement=True)
    guidelines = document.get("guidelines") if isinstance(document.get("guidelines"), dict) else {}
    has_principles = bool(
        _clean(guidelines.get("summary")) or guidelines.get("do") or (guidelines.get("dont") and not src)
    )
    audience = (
        f'<div class="callout"><b class="t">{labels["audience"]}</b>{escape(brand["audience"])}</div>'
        if brand["audience"]
        else ""
    )
    short = sum(len(_lines(block, key, 40)) for block in (voice, guidelines) for key in ("do", "dont")) <= (
        10 if audience else 12
    )
    if voice_html or audience:
        principles = ""
        if has_principles and short:
            principles = (
                f'<div><div class="kicker" style="color:{_GREY}">{labels["principles"]}</div>'
                f"{_guidance_html(guidelines, labels, 4)}</div>"
            )
            has_principles = False
        pages.append(
            _Page(
                "voice",
                labels["voice"],
                labels["voice"] + (f" · {labels['principles']}" if principles else ""),
                '<div class="content roomy" style="flex-direction:column;gap:22px">'
                f"{voice_html}{audience}{principles}</div>",
            )
        )

    # Principles on their own page (the general rules; their don'ts are on the don'ts page too).
    if has_principles:
        pages.append(
            _Page(
                "principles",
                labels["principles"],
                labels["principles"],
                '<div class="content roomy" style="flex-direction:column;gap:22px">'
                f"{_guidance_html(guidelines, labels, 6, statement=True)}</div>",
            )
        )

    # Components, in the brand's own theme.
    picked = [c for c in document.get("components") or [] if c in _SHOWCASE]
    if picked:
        showcase = "".join(_SHOWCASE[c](labels) for c in picked[:6])
        radii = "".join(
            f'<div style="border-radius:var({key})">{key[9:]}</div>'
            for key in variables
            if key.startswith("--radius-") and key != "--radius-full"
        )[:2000]
        pages.append(
            _Page(
                "components",
                labels["components"],
                labels["components"],
                f'<div class="content" style="flex-direction:column;gap:14px"><div class="frame">{showcase}</div>'
                + (f'<div class="radii">{radii}</div>' if radii else "")
                + "</div>",
            )
        )

    # Files and closing.
    file_rows = "".join(
        f'<tr><td class="mono" style="width:46%">{escape(path)}</td><td class="grey">{escape(use)}</td></tr>'
        for path, use in _file_rows(document, labels)
    )
    closing_logo = ""
    if src:
        closing_logo = f'<div style="margin-top:auto;text-align:center">{logo_img(on_light(), "max-height:90px;max-width:360px")}'
        if brand["website"]:
            closing_logo += (
                f'<div class="small grey" style="margin-top:10px">{escape(brand["website"])}</div>'
            )
        closing_logo += "</div>"
    made = (
        f'<div style="margin-top:14px"><span class="badge-forge" aria-label="{labels["made_with"]}">'
        f"{FORGE_MARK_SVG}By Forge</span></div>"
        if badge
        else ""
    )
    pages.append(
        _Page(
            "files",
            labels["files"],
            labels["files"],
            '<div class="content" style="flex-direction:column;gap:12px">'
            f'<p class="grey" style="margin:0">{escape(labels["files_lead"])}</p>'
            f'<table style="max-width:760px"><tr><th>{labels["file"]}</th><th>{labels["use"]}</th></tr>'
            f"{file_rows}</table>{closing_logo}{made}</div>",
        )
    )

    # Intro, with the contents (section numbers and page numbers).
    contents = "".join(
        f'<tr><td class="n">{i:02d}</td><td>{escape(page.toc)}</td><td class="p">{i + 1:02d}</td></tr>'
        for i, page in enumerate(pages, start=1)
    )
    description = _clean(document.get("description"))
    intro_title = escape(brand["tagline"]) if brand["tagline"] else name
    facts_html = "".join(
        f"<div><span>{label}</span>{escape(value)}</div>"
        for label, value in ((labels["website"], brand["website"]), (labels["audience"], brand["audience"]))
        if value
    )
    intro = _Page(
        "intro",
        intro_title,
        labels["intro"],
        '<div class="content"><div class="col">'
        + (f'<p class="lead clamp10">{escape(description)}</p>' if description else "")
        + (f'<div class="facts">{facts_html}</div>' if facts_html else "")
        + f'<div class="callout" style="margin-top:8px"><b class="t">{labels["name_title"]}</b>'
        f"{labels['name_rule'].format(name=name)}</div></div>"
        f'<div class="col"><table><tr><th colspan="3">{labels["contents"]}</th></tr>{contents}</table></div></div>',
    )
    pages.insert(intro_index, intro)

    # Cover.
    cover_logo = ""
    if src:
        pair = on_dark()
        if pair[0] == src and not profile["transparent"] and not profile["light"]:
            cover_logo = (
                f'<div class="logo"><span class="plate">{logo_img(pair, "max-height:44px")}</span></div>'
            )
        else:
            cover_logo = f'<div class="logo">{logo_img(pair)}</div>'
    else:
        cover_logo = f'<div class="logo" style="font-family:var(--g-display);font-size:26px;font-weight:700">{name}</div>'
    cover_sub = brand["tagline"] or description
    cover = (
        f'<section class="page cover" data-page="cover"><div class="shape"></div>{cover_logo}<div class="bottom">'
        f'<div class="kicker">{labels["version"]} 1.0 · {escape(_month_year(lang, now))}</div>'
        f"<h1>{labels['cover_title']}</h1>"
        f'<div class="sub clamp4"><b style="color:#fff">{name}</b>'
        + (f" · {escape(_shorten(cover_sub, 240))}" if cover_sub else "")
        + "</div></div>"
        + (
            f'<span class="badge-forge" aria-label="{labels["made_with"]}">{FORGE_MARK_SVG}By Forge</span>'
            if badge
            else ""
        )
        + "</section>"
    )

    body = [cover]
    for number, page in enumerate(pages, start=1):
        kicker = labels["intro"] if page.key == "intro" else f"{number - 1:02d} · {page.toc}"
        body.append(
            f'<section class="page" data-page="{page.key}"><div class="kicker">{escape(kicker)}</div>'
            f"<h1>{page.title}</h1>{page.body}"
            f'<div class="footer"><span>{name} · {labels["guidelines"]}</span><span>{number:02d}</span></div>'
            "</section>"
        )

    fonts_url = google_fonts_url(font_families(document))
    fonts_link = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link rel="stylesheet" href="{escape(fonts_url)}">'
        if fonts_url and remote_fonts
        else ""
    )
    stack = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
    guide_vars = (
        f"--g-paper:{_PAPER};--g-panel:{_PANEL};--g-ink:{ink};--g-grey:{_GREY};--g-line:{_LINE};"
        f"--g-red:{_RED};--g-accent:{accent};--g-kicker:{theme['kicker']};--g-cover:{ink};"
        f"--g-cover-kicker:{theme['cover_kicker']};--g-tint:{theme['tint']};"
        f"--g-display:{_family_css(display_family)}{stack};--g-body:{_family_css(body_family)}{stack};"
        "--g-mono:var(--font-mono,ui-monospace,monospace);"
    )
    root = "".join(f"{key}:{value};" for key, value in variables.items())
    return (
        f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">'
        + ('<meta name="viewport" content="width=device-width,initial-scale=1">' if screen else "")
        + f"<title>{name} · {labels['guidelines']}</title>"
        f"{fonts_link}<style>:root{{{root}{guide_vars}}}{_STYLE}{_SCREEN_STYLE if screen else ''}</style></head><body>"
        + "".join(body)
        + "</body></html>"
    )


def _family_css(family: str) -> str:
    if not family:
        return ""
    return "'" + family.replace("'", "").replace("\\", "") + "',"


def _text_on(background: str) -> str:
    return (
        "#ffffff"
        if contrast_ratio("#ffffff", background) >= contrast_ratio("#0b0b0f", background)
        else "#0b0b0f"
    )


def _button(labels: dict[str, str]) -> str:
    return (
        f'<div class="row"><button class="btn primary">{labels["primary"]}</button>'
        f'<button class="btn secondary">{labels["secondary"]}</button></div>'
    )


def _input(labels: dict[str, str]) -> str:
    return f'<label class="field">{labels["email"]}<input type="email" placeholder="{labels["email_hint"]}"></label>'


def _card(labels: dict[str, str]) -> str:
    return (
        f'<div class="card"><h4>{labels["card_title"]}</h4><p>{labels["card_body"]}</p>'
        f'<button class="btn primary">{labels["primary"]}</button></div>'
    )


def _badge(labels: dict[str, str]) -> str:
    return (
        f'<div class="row"><span class="tag accent">{labels["badge"]}</span>'
        f'<span class="tag soft">{labels["pending"]}</span></div>'
    )


def _alert(labels: dict[str, str]) -> str:
    return (
        f'<div><div class="alert info">{labels["alert_info"]}</div>'
        f'<div class="alert success">{labels["alert_success"]}</div>'
        f'<div class="alert danger" style="margin:0">{labels["alert_danger"]}</div></div>'
    )


def _table(labels: dict[str, str]) -> str:
    return (
        "<table><tr><td>Atlas</td><td><span class='tag accent'>"
        f"{labels['badge']}</span></td><td>1 240</td></tr>"
        f"<tr><td>Borealis</td><td><span class='tag soft'>{labels['pending']}</span></td><td>860</td></tr></table>"
    )


_SHOWCASE: dict[str, Callable[[dict[str, str]], str]] = {
    "button": _button,
    "input": _input,
    "card": _card,
    "badge": _badge,
    "alert": _alert,
    "table": _table,
}
