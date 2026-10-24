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
    dump_document,
    validate_codelab,
    validate_deck,
    validate_design_system,
    validate_slide,
)
from app.services.filesystem import project_dir, write_file

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


def default_deck(title: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """deck.json and slides/s1.json of a new presentation."""
    deck = {
        "version": 1,
        "title": (title or "").strip()[:200] or "Presentation",
        "format": {"ratio": "16:9", "width": 1920, "height": 1080},
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
                "x": 160,
                "y": 380,
                "w": 1600,
                "h": 200,
                "content": [{"type": "paragraph", "text": deck["title"]}],
                "style": {"font": "display", "size": 96, "weight": 700, "color": "--fg", "align": "left"},
            },
            {
                "id": "subtitle",
                "type": "text",
                "role": "subtitle",
                "x": 160,
                "y": 600,
                "w": 1600,
                "h": 80,
                "content": [{"type": "paragraph", "text": ""}],
                "style": {"font": "body", "size": 40, "weight": 400, "color": "--muted", "align": "left"},
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


def _snapshot(project_id: str) -> None:
    try:
        from app.services import history

        history.snapshot(project_id, "initial scaffold")
    except Exception:  # pragma: no cover - history is best effort
        pass


def scaffold_slides(project_id: str, app_name: str) -> None:
    project_dir(project_id)
    deck, slide = default_deck(app_name)
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
