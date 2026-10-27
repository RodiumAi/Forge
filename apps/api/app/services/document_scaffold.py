"""Starting files of the document kinds (slides, codelab, design system).

Each scaffold writes the smallest valid document of its contract (one title
slide, one intro step, the default tokens) plus a DESIGN.md generated from the
default design system, then takes the baseline history checkpoint like the
React scaffold does. Every document is validated before it is written, so a
contract change that breaks a scaffold fails at once.
"""

from __future__ import annotations

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


def design_md_from_design_system(design_system: dict[str, Any], *, placeholder: bool = False) -> str:
    """The DESIGN.md charter generated from a design-system document.

    ``placeholder`` marks the charter of a scaffold that nobody chose yet, so the
    site builder may still replace it with a generated one.
    """
    from app.services.design_system.render import design_md

    return design_md(design_system, placeholder=placeholder)


def default_design_system(name: str, *, with_logo: bool = False) -> dict[str, Any]:
    """The starting design system: the Forge palette, Inter, a calm scale.

    ``with_logo`` points the logo at the generated wordmark (written by
    ``scaffold_design_system``); decks and codelabs only need the tokens.
    """
    from app.services.design_system.tokens import LOGO_PATH, Spec, build_document

    spec = Spec.model_validate(
        {
            "name": (name or "Design system").strip()[:120] or "Design system",
            "colors": {
                "bg": DEFAULT_TOKENS["color"]["bg"]["$value"],
                "surface": DEFAULT_TOKENS["color"]["surface"]["$value"],
                "fg": DEFAULT_TOKENS["color"]["fg"]["$value"],
                "muted": DEFAULT_TOKENS["color"]["muted"]["$value"],
                "accent": DEFAULT_TOKENS["color"]["accent"]["$value"],
                "border": DEFAULT_TOKENS["color"]["border"]["$value"],
            },
            "fonts": {"display": "Inter", "body": "Inter", "mono": "JetBrains Mono"},
        }
    )
    document, _fixes = build_document(spec, logo_src=LOGO_PATH if with_logo else None)
    return document


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
    write_file(
        project_id,
        DESIGN_MD_PATH,
        design_md_from_design_system(default_design_system(app_name), placeholder=True),
    )
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
    write_file(
        project_id,
        DESIGN_MD_PATH,
        design_md_from_design_system(default_design_system(app_name), placeholder=True),
    )
    _snapshot(project_id)


def scaffold_design_system(project_id: str, app_name: str) -> None:
    from app.services.design_system.logo import wordmark_svg
    from app.services.design_system.tokens import LOGO_PATH

    project_dir(project_id)
    design_system = default_design_system(app_name, with_logo=True)
    _write_json(project_id, DESIGN_SYSTEM_PATH, design_system)
    colors = DEFAULT_TOKENS["color"]
    write_file(
        project_id,
        LOGO_PATH,
        wordmark_svg(design_system["name"], colors["accent"]["$value"], colors["fg"]["$value"]),
    )
    write_file(project_id, DESIGN_MD_PATH, design_md_from_design_system(design_system))
    _snapshot(project_id)


def apply_design_system(project_id: str, source_project_id: str, kind_id: str | None = None) -> bool:
    """Dress a project with the tokens of a design_system project.

    Writes DESIGN.md from the source ``design-system.json``; a deck or a codelab
    gets ``theme.designSystem`` pointing at the source, a site gets the values
    in ``src/index.css`` (see ``services/design_system/sync.py``). Returns False
    (nothing written) when the source has no valid design system. The link and
    the applied version are recorded on the project by the caller.
    """
    from app.services.design_system import sync

    try:
        source = json.loads(read_file(source_project_id, DESIGN_SYSTEM_PATH))
        design_system = dump_document(validate_design_system(source))
    except Exception:
        return False
    if kind_id is None:
        root = project_dir(project_id)
        if (root / DECK_PATH).is_file():
            kind_id = "slides"
        elif (root / CODELAB_PATH).is_file():
            kind_id = "codelab"
        else:
            kind_id = "web"
    sync.apply(project_id, kind_id, design_system, source_project_id)
    _snapshot(project_id, "apply design system")
    return True
