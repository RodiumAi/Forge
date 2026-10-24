"""Starting files of the document kinds (slides, codelab, design system).

Each scaffold writes the smallest valid document of its contract (one title
slide, one intro step, the default tokens) plus a DESIGN.md generated from the
default design system, then takes the baseline history checkpoint like the
React scaffold does. Every document is validated before it is written, so a
contract change that breaks a scaffold fails at once.
"""

from __future__ import annotations

import copy
import json
from typing import Any

from app.contracts.forge_design import (
    FORMAT_SIZES,
    dump_document,
    validate_codelab,
    validate_deck,
    validate_design_system,
    validate_slide,
)
from app.services.filesystem import project_dir, read_file, write_file

DECK_PATH = "deck.json"
CODELAB_PATH = "codelab.json"
DESIGN_SYSTEM_PATH = "design-system.json"
DESIGN_MD_PATH = "DESIGN.md"
DEFAULT_THEME = {"designSystem": "local", "tokens": DESIGN_MD_PATH}

# Same palette as the React scaffold's default charter, as W3C design tokens.
DEFAULT_TOKENS: dict[str, Any] = {
    "color": {
        "$type": "color",
        "bg": {"$value": "#0a0a0a", "$description": "Page and slide background"},
        "surface": {"$value": "#151515", "$description": "Cards and panels"},
        "fg": {"$value": "#f5f5f5", "$description": "Main text"},
        "muted": {"$value": "#9a9a9a", "$description": "Secondary text"},
        "accent": {"$value": "#f2620a", "$description": "Brand accent"},
        "border": {"$value": "#262626", "$description": "Hairlines and dividers"},
    },
    "font": {
        "$type": "fontFamily",
        "display": {"$value": ["Inter", "system-ui", "sans-serif"]},
        "body": {"$value": ["Inter", "system-ui", "sans-serif"]},
        "mono": {"$value": ["JetBrains Mono", "ui-monospace", "monospace"]},
    },
    "radius": {
        "$type": "dimension",
        "sm": {"$value": {"value": 4, "unit": "px"}},
        "md": {"$value": {"value": 8, "unit": "px"}},
        "lg": {"$value": {"value": 16, "unit": "px"}},
    },
    "space": {
        "$type": "dimension",
        "sm": {"$value": {"value": 8, "unit": "px"}},
        "md": {"$value": {"value": 16, "unit": "px"}},
        "lg": {"$value": {"value": 32, "unit": "px"}},
    },
    "motion": {
        "fast": {"$type": "duration", "$value": {"value": 150, "unit": "ms"}},
        "base": {"$type": "duration", "$value": {"value": 300, "unit": "ms"}},
    },
}


def _write_json(project_id: str, relative: str, document: dict[str, Any]) -> None:
    write_file(project_id, relative, json.dumps(document, ensure_ascii=False, indent=2) + "\n")


def _font_stack(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def design_md_from_design_system(design_system: dict[str, Any]) -> str:
    """The DESIGN.md charter generated from a design-system document."""
    tokens = design_system.get("tokens") or {}
    lines = [
        "<!-- forge:default-charter -->",
        f"# Design charter: {design_system.get('name') or 'Design system'}",
        "",
        "Generated from design-system.json. Forge injects it into every AI call.",
        "",
        "## Colors",
    ]
    for name, token in (tokens.get("color") or {}).items():
        if isinstance(token, dict) and "$value" in token:
            lines.append(f"- `--{name}`: {token['$value']}")
    lines += ["", "## Typography"]
    for name, token in (tokens.get("font") or {}).items():
        if isinstance(token, dict) and "$value" in token:
            lines.append(f"- {name}: {_font_stack(token['$value'])}")
    description = (design_system.get("description") or "").strip()
    if description:
        lines += ["", "## Notes", description]
    return "\n".join(lines) + "\n"


def default_design_system(name: str) -> dict[str, Any]:
    document = {
        "version": 1,
        "name": (name or "Design system").strip()[:120] or "Design system",
        "tokens": copy.deepcopy(DEFAULT_TOKENS),
        "components": ["button", "input", "card", "badge", "alert", "table"],
    }
    return dump_document(validate_design_system(document))


def default_deck(title: str, ratio: str = "16:9") -> tuple[dict[str, Any], dict[str, Any]]:
    """deck.json and slides/s1.json of a new presentation.

    ``ratio`` is one of the contract formats (16:9, 4:3, 1:1). The title slide
    keeps the 16:9 proportions: margins and type sizes follow the canvas width.
    """
    if ratio not in FORMAT_SIZES:
        ratio = "16:9"
    width, height = FORMAT_SIZES[ratio]
    scale = width / 1920

    def px(value: float) -> int:
        return round(value * scale)

    margin = px(160)
    deck = {
        "version": 1,
        "title": (title or "").strip()[:200] or "Presentation",
        "format": {"ratio": ratio, "width": width, "height": height},
        "theme": dict(DEFAULT_THEME),
        "slides": [{"id": "s1", "layout": "title", "transition": {"type": "fade", "durationMs": 500}}],
    }
    slide = {
        "id": "s1",
        "background": {"type": "color", "token": "--bg"},
        "elements": [
            {
                "id": "title",
                "type": "text",
                "role": "title",
                "x": margin,
                "y": round(height * 380 / 1080),
                "w": width - 2 * margin,
                "h": max(px(200), 120),
                "content": [{"type": "paragraph", "text": deck["title"]}],
                "style": {
                    "font": "display",
                    "size": max(px(96), 64),
                    "weight": 700,
                    "color": "--fg",
                    "align": "left",
                },
            },
            {
                "id": "subtitle",
                "type": "text",
                "role": "subtitle",
                "x": margin,
                "y": round(height * 600 / 1080),
                "w": width - 2 * margin,
                "h": max(px(80), 56),
                "content": [{"type": "paragraph", "text": ""}],
                "style": {
                    "font": "body",
                    "size": max(px(40), 32),
                    "weight": 400,
                    "color": "--muted",
                    "align": "left",
                },
            },
        ],
    }
    return dump_document(validate_deck(deck)), dump_document(validate_slide(slide))


def default_codelab(title: str) -> dict[str, Any]:
    codelab = {
        "version": 1,
        "title": (title or "").strip()[:200] or "Codelab",
        "summary": "",
        "level": "beginner",
        "durationMinutes": 5,
        "prerequisites": [],
        "learn": [],
        "theme": dict(DEFAULT_THEME),
        "steps": [{"id": "intro", "title": "Introduction", "file": "steps/01-intro.md", "minutes": 5}],
        "downloads": [],
    }
    return dump_document(validate_codelab(codelab))


def _snapshot(project_id: str, message: str = "initial scaffold") -> None:
    try:
        from app.services import history

        history.snapshot(project_id, message)
    except Exception:  # pragma: no cover - history is best effort
        pass


def scaffold_slides(project_id: str, app_name: str, *, ratio: str = "16:9") -> None:
    project_dir(project_id)
    deck, slide = default_deck(app_name, ratio)
    _write_json(project_id, DECK_PATH, deck)
    _write_json(project_id, "slides/s1.json", slide)
    write_file(project_id, "notes/s1.md", "")
    write_file(project_id, DESIGN_MD_PATH, design_md_from_design_system(default_design_system(app_name)))
    _snapshot(project_id)


def scaffold_codelab(project_id: str, app_name: str) -> None:
    project_dir(project_id)
    codelab = default_codelab(app_name)
    _write_json(project_id, CODELAB_PATH, codelab)
    write_file(
        project_id,
        "steps/01-intro.md",
        f"# Introduction\n\nWelcome to {codelab['title']}.\n\n## What you will build\n\n## What you will learn\n",
    )
    write_file(project_id, DESIGN_MD_PATH, design_md_from_design_system(default_design_system(app_name)))
    _snapshot(project_id)


def scaffold_design_system(project_id: str, app_name: str) -> None:
    project_dir(project_id)
    design_system = default_design_system(app_name)
    _write_json(project_id, DESIGN_SYSTEM_PATH, design_system)
    write_file(project_id, DESIGN_MD_PATH, design_md_from_design_system(design_system))
    _snapshot(project_id)


def apply_design_system(project_id: str, source_project_id: str) -> bool:
    """Dress a new project with the tokens of a design_system project.

    Writes DESIGN.md from the source ``design-system.json`` and, for a deck or a
    codelab, points ``theme.designSystem`` at the source project id. Returns
    False (nothing written) when the source has no valid design system. The
    dedicated design system table arrives with wave 2; until then the link is
    this id in the document theme.
    """
    try:
        source = json.loads(read_file(source_project_id, DESIGN_SYSTEM_PATH))
        design_system = dump_document(validate_design_system(source))
    except Exception:
        return False
    write_file(project_id, DESIGN_MD_PATH, design_md_from_design_system(design_system))
    for relative, validate in ((DECK_PATH, validate_deck), (CODELAB_PATH, validate_codelab)):
        try:
            document = json.loads(read_file(project_id, relative))
        except Exception:
            continue
        theme = document.get("theme")
        if not isinstance(theme, dict):
            continue
        theme["designSystem"] = source_project_id
        _write_json(project_id, relative, dump_document(validate(document)))
    _snapshot(project_id, "apply design system")
    return True
