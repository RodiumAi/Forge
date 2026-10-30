"""Deck typefaces live in the project's theme, not in the slides.

A slide text names a font role (``display``, ``body``, ``mono``) or an explicit
family. Changing the font of the whole deck therefore rewrites the theme
(design-system.json and the DESIGN.md generated from it), and every slide
follows without being rewritten.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.contracts.forge_design import dump_document, validate_design_system
from app.services.design_system.render import design_md
from app.services.design_system.tokens import (
    apply_section,
    font_stack,
    known_font,
    spec_from_document,
)
from app.services.document_scaffold import DESIGN_MD_PATH, DESIGN_SYSTEM_PATH
from app.services.filesystem import read_file, write_file

FONT_ROLES = ("display", "body", "mono")


def check_fonts(raw: Any) -> dict[str, str] | None:
    """The ``fonts`` of a model answer, each family spelled as in the catalog."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError('"fonts" must be an object with display, body or mono')
    fonts: dict[str, str] = {}
    for role, value in raw.items():
        if role not in FONT_ROLES:
            raise ValueError(f"unknown font role {role!r}: use display, body or mono")
        if value in (None, ""):
            continue
        family = known_font(value)
        if family is None:
            raise ValueError(f"font {value!r} is not in the supported list")
        fonts[role] = family
    return fonts or None


def _css_stack(family: str) -> str:
    return ", ".join(
        f'"{name}"' if " " in name and not name.startswith('"') else name for name in font_stack(family)
    )


def _patch_markdown(text: str, fonts: dict[str, str]) -> str:
    """DESIGN.md written by hand: rewrite its font lines, add them when missing."""
    labels = {"display": "Display font", "body": "Body font", "mono": "Mono font"}
    for role, family in fonts.items():
        line_re = re.compile(rf"^(\s*[-*]?\s*{labels[role]}\s*:).*$", re.IGNORECASE | re.MULTILINE)
        if line_re.search(text):
            text = line_re.sub(lambda m, f=family: f"{m.group(1)} {f}", text)
        else:
            text = text.rstrip("\n") + f"\n- {labels[role]}: {family}\n"
        var_re = re.compile(rf"(--font-{role}\s*:\s*)[^;\n]+")
        text = var_re.sub(lambda m, f=family: m.group(1) + _css_stack(f), text)
        if role == "body":
            text = re.sub(
                r"(--font-sans\s*:\s*)[^;\n]+", lambda m, f=family: m.group(1) + _css_stack(f), text
            )
    return text


def apply_theme_fonts(project_id: str, fonts: dict[str, str]) -> list[str]:
    """Writes the new families into the project's theme; returns the files written."""
    try:
        document = dump_document(
            validate_design_system(json.loads(read_file(project_id, DESIGN_SYSTEM_PATH)))
        )
    except Exception:  # missing, unreadable or invalid: patch DESIGN.md instead
        document = None
    if document is not None:
        spec = spec_from_document(document)
        spec = spec.model_copy(update={"fonts": spec.fonts.model_copy(update=fonts)})
        document, _ = apply_section(document, "typography", spec)
        write_file(project_id, DESIGN_SYSTEM_PATH, json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        write_file(project_id, DESIGN_MD_PATH, design_md(document))
        return [DESIGN_SYSTEM_PATH, DESIGN_MD_PATH]
    try:
        text = read_file(project_id, DESIGN_MD_PATH)
    except (FileNotFoundError, ValueError):
        text = "# Design charter\n\n## Typography\n"
    write_file(project_id, DESIGN_MD_PATH, _patch_markdown(text, fonts))
    return [DESIGN_MD_PATH]


def fonts_summary(fonts: dict[str, str], locale: str) -> str:
    families = sorted(set(fonts.values()))
    names = ", ".join(families)
    if locale == "fr":
        return f"Police de la présentation : {names}."
    return f"Presentation font: {names}."
