"""Text renderings of a design system: DESIGN.md, tokens.json, CSS, Tailwind.

DESIGN.md is what the agent and the players read. It keeps the charter layout
the site builder already understands (``- `--token`: #hex`` colour lines,
``Display font:`` and ``Body font:`` lines, the Google Fonts import), and ends
with a CSS block holding every variable, which the web player and the colour
panel parse.
"""

from __future__ import annotations

import json
from typing import Any

from app.services.design_system.tokens import (
    MISUSE_PREFIX,
    ROLES,
    colors_of,
    contrast_pairs,
    css_text,
    css_variables,
    font_families,
    google_fonts_url,
)

DEFAULT_CHARTER_MARKER = "<!-- forge:default-charter -->"


def _guidance_lines(title: str, block: Any) -> list[str]:
    if not isinstance(block, dict) or not any(block.get(k) for k in ("summary", "do", "dont")):
        return []
    lines = ["", f"## {title}"]
    if block.get("summary"):
        lines.append(str(block["summary"]))
    lines += [f"- Do: {item}" for item in block.get("do") or []]
    lines += [f"- Don't: {item}" for item in block.get("dont") or []]
    return lines


def design_md(document: dict[str, Any], *, placeholder: bool = False) -> str:
    """DESIGN.md for ``document``. ``placeholder`` marks a scaffold default charter."""
    tokens = document.get("tokens") or {}
    name = document.get("name") or "Design system"
    lines: list[str] = []
    if placeholder:
        lines.append(DEFAULT_CHARTER_MARKER)
    lines += [
        f"# Design charter: {name}",
        "",
        "Generated from design-system.json (Forge design system). Forge injects it into every AI call;",
        "edit the design system rather than this file.",
    ]
    description = (document.get("description") or "").strip()
    if description:
        lines += ["", "## Brand", description]

    colors = colors_of(document)
    lines += ["", "## Colors"]
    for token_name, value in colors.items():
        lines.append(f"- `--{token_name}`: {value}")
        role = ROLES.get(token_name)
        if role:
            lines.append(f"  - {role}")
    failing = [row for row in contrast_pairs(colors) if not row["pass"]]
    lines.append("")
    lines.append("Contrast (WCAG 2.2):")
    for row in contrast_pairs(colors):
        lines.append(
            f"- {row['fg']} on {row['bg']}: {row['ratio']} to 1 ({row['level']}), {row['use'].lower()}"
        )
    if failing:
        lines.append("- Some pairs are below their target: never use them for small text.")

    families = font_families(document)
    font = tokens.get("font") or {}
    lines += ["", "## Typography"]
    labels = {"display": "Display font", "body": "Body font", "mono": "Mono font"}
    for role, label in labels.items():
        value = (font.get(role) or {}).get("$value") if isinstance(font.get(role), dict) else None
        family = value[0] if isinstance(value, list) and value else value
        if family:
            lines.append(f"- {label}: {family}")
    url = google_fonts_url(families)
    if url:
        lines.append(f"- Google Fonts: {url}")
        lines.append(f'- Load it as the FIRST line of src/index.css: @import url("{url}");')
    variables = css_variables(document)
    # Summaries name variables without "--" so only the CSS block below defines them.
    scale = [f"{key[2:]} {value}" for key, value in variables.items() if key.startswith("--text-")]
    if scale:
        lines.append("- Type scale: " + ", ".join(scale))

    spacing = [f"{k[2:]} {v}" for k, v in variables.items() if k.startswith(("--space-", "--radius-"))]
    if spacing:
        lines += ["", "## Spacing & radius", "- " + ", ".join(spacing)]
    motion = [f"{k[2:]} {v}" for k, v in variables.items() if k.startswith(("--motion-", "--ease-"))]
    if motion:
        lines += ["", "## Motion", "- " + ", ".join(motion)]

    icon = tokens.get("icon") or {}
    if isinstance(icon, dict) and icon:
        library = (icon.get("library") or {}).get("$value")
        style = (icon.get("style") or {}).get("$value")
        lines += ["", "## Iconography"]
        if library:
            lines.append(f"- Library: {library}, style: {style or 'outline'}")
        guidance = (((icon.get("style") or {}).get("$extensions") or {}).get("forge") or {}).get("guidance")
        lines += _guidance_lines("Iconography", guidance)[2:]

    lines += _guidance_lines("Imagery", document.get("imagery"))
    lines += _guidance_lines("Tone of voice", document.get("voice"))

    logo = document.get("logo")
    if isinstance(logo, dict) and logo.get("src"):
        lines += ["", "## Logo", f"- File: /{str(logo['src']).removeprefix('public/')}"]
        if logo.get("darkSrc"):
            lines.append(f"- On dark backgrounds: /{str(logo['darkSrc']).removeprefix('public/')}")
        if logo.get("clearSpace"):
            lines.append(f"- Clear space: {logo['clearSpace']}")
        if logo.get("minSizePx"):
            lines.append(f"- Minimum size: {logo['minSizePx']}px")
        for line in logo.get("usage") or []:
            if line.startswith(MISUSE_PREFIX):
                lines.append(f"- Don't: {line[len(MISUSE_PREFIX) :]}")
            else:
                lines.append(f"- {line}")

    lines += _guidance_lines("Do / Don't", document.get("guidelines"))
    if document.get("components"):
        lines += ["", "## Components", "- " + ", ".join(document["components"])]

    lines += ["", "## CSS variables", "```css", css_text(document).rstrip(), "```"]
    return "\n".join(lines) + "\n"


def tokens_json(document: dict[str, Any]) -> str:
    """The W3C Design Tokens file: the token tree with its name and description."""
    body: dict[str, Any] = {}
    if document.get("description"):
        body["$description"] = str(document["description"])[:500]
    body.update(document.get("tokens") or {})
    return json.dumps(body, ensure_ascii=False, indent=2) + "\n"


def tailwind_config(document: dict[str, Any]) -> str:
    """A tailwind.config.js ``theme.extend`` mapped onto the CSS variables."""
    variables = css_variables(document)
    colors = {key[2:]: f"var({key})" for key in variables if key[2:] in colors_of(document)}

    def pick(prefix: str) -> dict[str, str]:
        return {key[len(prefix) :]: f"var({key})" for key in variables if key.startswith(prefix)}

    extend = {
        "colors": colors,
        "fontFamily": {
            role: [f"var(--font-{role})"]
            for role in ("display", "body", "mono")
            if f"--font-{role}" in variables
        },
        "fontSize": pick("--text-"),
        "spacing": pick("--space-"),
        "borderRadius": pick("--radius-"),
        "boxShadow": pick("--shadow-"),
        "transitionDuration": pick("--motion-"),
        "transitionTimingFunction": pick("--ease-"),
    }
    body = json.dumps({key: value for key, value in extend.items() if value}, ensure_ascii=False, indent=2)
    name = document.get("name") or "Design system"
    return (
        f"// Tailwind theme for {name}, generated by Forge from design-system.json.\n"
        "// Load tokens.css (the CSS variables) before Tailwind's base layer.\n"
        "/** @type {import('tailwindcss').Config} */\n"
        "module.exports = {\n"
        "  theme: {\n"
        "    extend: " + body.replace("\n", "\n    ") + ",\n"
        "  },\n"
        "};\n"
    )
