"""Starter kits as a quality reference for builds that did not fork one.

A blank project used to be built with no example of finished work at all: the
36 kits only served as files to copy. During the build tasks of a young
project, the prompt now carries a short excerpt of the closest kit (its
foundation tokens and one section) as a bar to match, never as content to copy.
A forked project gets its kit's tone instead.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache

from app.services.filesystem import read_file

_EXCERPT_CSS_CHARS = 3_200
_EXCERPT_TSX_CHARS = 3_600
_YOUNG_PROJECT_MAX_SRC = 30
_PLAN_TASK_RE = re.compile(r"Current plan task \(\d+/\d+\):", re.I)
_SKIP_TASK_RE = re.compile(r"(coh[ée]rence|\bedit\b|\bmodifier\b)", re.I)
_WORD_RE = re.compile(r"[a-zA-Zàâçéèêëîïôûùüÿœ]{3,}")
_DEFAULT_KIT = {"web": "aurora-ai", "mobile": "nova-bank"}
_SECTION_FILES = (
    "src/components/Hero.tsx",
    "src/components/Features.tsx",
    "src/screens/HomeScreen.tsx",
    "src/components/HomeScreen.tsx",
)


def _forked_origin(project_id: str) -> dict | None:
    try:
        data = json.loads(read_file(project_id, ".forge/template.json"))
    except (FileNotFoundError, ValueError):
        return None
    return data if isinstance(data, dict) and data.get("id") else None


def _pick_kit(query: str, platform: str):
    from app.services.templates import get_template, list_templates

    kits = list_templates(kind=platform if platform in ("web", "mobile") else "web")
    if not kits:
        return None
    words = {w.lower() for w in _WORD_RE.findall(query or "")}
    best, best_score = None, 0.0
    for kit in kits:
        haystack = " ".join(
            [*kit.tags, kit.title_en, kit.description_en, kit.description_fr, kit.tone]
        ).lower()
        score = sum(2.0 if w in kit.tags else 1.0 for w in words if w in haystack)
        if score > best_score:
            best, best_score = kit, score
    if best is not None and best_score >= 2:
        return best
    return get_template(_DEFAULT_KIT.get(platform, "aurora-ai")) or kits[0]


@lru_cache(maxsize=64)
def _kit_excerpt(kit_id: str) -> str:
    from app.services.templates import get_template

    kit = get_template(kit_id)
    if kit is None:
        return ""
    root = kit.path
    css_path = root / "src" / "index.css"
    css = css_path.read_text(encoding="utf-8")[:_EXCERPT_CSS_CHARS] if css_path.is_file() else ""
    section = ""
    for rel in _SECTION_FILES:
        candidate = root / rel
        if candidate.is_file():
            section = f"--- {rel} ---\n" + candidate.read_text(encoding="utf-8")[:_EXCERPT_TSX_CHARS]
            break
    if not section:
        app = root / "src" / "App.tsx"
        if app.is_file():
            section = "--- src/App.tsx ---\n" + app.read_text(encoding="utf-8")[:_EXCERPT_TSX_CHARS]
    if not css and not section:
        return ""
    return f"--- src/index.css (excerpt) ---\n{css}\n\n{section}"


def format_template_example_layer(
    project_id: str,
    files: dict[str, str],
    user_query: str,
    *,
    platform: str = "web",
) -> str:
    origin = _forked_origin(project_id)
    if origin is not None:
        tone = str(origin.get("tone") or "").strip()
        lines = [f"This project started from the Forge kit `{origin.get('id')}`."]
        if tone:
            lines.append(f"Kit tone: {tone}.")
        lines.append(
            "When adapting it, keep its signature composition and finish (type scale, "
            "spacing rhythm, imagery treatment) unless the user asks for a different look."
        )
        return "\n".join(lines)

    task = _PLAN_TASK_RE.search(user_query or "")
    if task is None or _SKIP_TASK_RE.search((user_query or "")[task.end() : task.end() + 120]):
        return ""
    src_count = sum(1 for p in files if p.startswith("src/") and p.endswith((".tsx", ".ts", ".css")))
    if src_count > _YOUNG_PROJECT_MAX_SRC:
        return ""
    kit = _pick_kit(user_query, platform)
    if kit is None:
        return ""
    excerpt = _kit_excerpt(kit.id)
    if not excerpt:
        return ""
    return (
        f"QUALITY REFERENCE (Forge kit `{kit.id}`, mood: {kit.tone or kit.description_en}). "
        "This is the level of finish to match: real design tokens, a deliberate type "
        "scale, layered composition, hover/focus states, mobile-first breakpoints. Do NOT "
        "copy its brand, colors, copy or images; this project follows its own DESIGN.md "
        "and brief.\n\n" + excerpt
    )
