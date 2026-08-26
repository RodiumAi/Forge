"""Plan + clarify helpers for Forge agent runs."""

from __future__ import annotations

import json
import re
from typing import Any

from app.i18n import Locale, t
from app.services.llm import RodiumError, complete_chat
from app.services.rodium_generation import RodiumGenerationAuth

_VAGUE_RE = re.compile(
    r"\b(truc|machin|quelque\s*chose|something|stuff|nice|beau|moderne|cool|joli|"
    r"améliore|improve|mieux|better|refais|redo)\b",
    re.I,
)
_TARGET_RE = re.compile(
    r"\b(page|site|app|landing|dashboard|portfolio|blog|shop|formulaire|form|"
    r"navbar|hero|footer|login|signup|pricing|header|contact|section|titre|title|"
    r"texte|text|bouton|button|couleur|color)\b",
    re.I,
)
_SECTION_RE = re.compile(
    r"\b(navbar|hero|footer|login|signup|pricing|header|contact|section|titre|title|"
    r"texte|text|bouton|button|couleur|color|landing|dashboard|portfolio|blog|shop|"
    r"formulaire|form)\b",
    re.I,
)
_GENERIC_ONLY_RE = re.compile(
    r"^\s*(?:am[eé]liore|improve|mieux|better|modernise|modernize)"
    r"(?:\s+(?:le|la|l'|the|mon|ma|ton|un|une))?"
    r"\s+(?:site|page|app|application|website)?\s*[.!]?\s*$",
    re.I,
)
_EDIT_VERB_RE = re.compile(
    r"\b(change|modifie|modifier|remplace|mets|mettre|update|fix|rename|renomme|"
    r"édite|edit|ajuste|adjust|corrige|correct)\b",
    re.I,
)
_FULL_REDESIGN_RE = re.compile(
    r"\b(refais\s+tout|redesign|from\s+scratch|tout\s+le\s+site|entire\s+site|"
    r"whole\s+site|recree|recrée|rebuild\s+everything)\b",
    re.I,
)
_SMALL_TASK_CLASSES = frozenset({"code.edit.small", "text.copy", "text.micro"})


def needs_clarify(
    prompt: str,
    *,
    force_scaffold: bool = False,
    task_class: str | None = None,
) -> bool:
    """Ask clarify only for major ambiguity — never for scoped micro-edits."""
    from app.services.orchestration.router import strip_attachment_noise

    text = strip_attachment_noise(prompt or "")
    if not text:
        # Attachments alone are enough context — skip clarify.
        return False

    if task_class in _SMALL_TASK_CLASSES:
        return False

    # Explicit full redesign — execute, don't ask.
    if _FULL_REDESIGN_RE.search(text):
        return False

    # Concrete edit of a named section/element → execute directly.
    if _EDIT_VERB_RE.search(text) and _SECTION_RE.search(text):
        return False

    if len(text) >= 180 and _TARGET_RE.search(text):
        return False

    # Blank-slate: very short / vague first message without a section target.
    if force_scaffold and len(text) < 40 and not _SECTION_RE.search(text):
        return True
    if force_scaffold and _VAGUE_RE.search(text) and len(text) < 100 and not _SECTION_RE.search(text):
        return True

    # Existing project: major ambiguity only (e.g. "améliore le site").
    if _GENERIC_ONLY_RE.search(text):
        return True
    return bool(_VAGUE_RE.search(text) and not _SECTION_RE.search(text) and not _EDIT_VERB_RE.search(text))


def build_clarify_questions(
    prompt: str,
    locale: Locale = "en",
    *,
    force_scaffold: bool = False,
) -> list[dict[str, Any]]:
    """Template questions — scoped for existing projects, fuller for scaffold."""
    existing_project = not force_scaffold

    if existing_project:
        if locale == "fr":
            return [
                {
                    "id": "scope",
                    "prompt": "Où appliquer ce changement ?",
                    "options": [
                        {"id": "mentioned", "label": "Uniquement l’élément / la section citée"},
                        {"id": "hero", "label": "La section hero / accueil"},
                        {"id": "one_section", "label": "Une seule section (sans toucher au reste)"},
                        {"id": "full", "label": "Tout le site (redesign)"},
                    ],
                },
            ]
        return [
            {
                "id": "scope",
                "prompt": "Where should this change apply?",
                "options": [
                    {"id": "mentioned", "label": "Only the mentioned element / section"},
                    {"id": "hero", "label": "Hero / home section"},
                    {"id": "one_section", "label": "One section only (leave the rest)"},
                    {"id": "full", "label": "Whole site (redesign)"},
                ],
            },
        ]

    if locale == "fr":
        return [
            {
                "id": "goal",
                "prompt": "Quel est l’objectif principal ?",
                "options": [
                    {"id": "marketing", "label": "Site vitrine / marketing"},
                    {"id": "product", "label": "Produit / app interactive"},
                    {"id": "portfolio", "label": "Portfolio / présentation"},
                    {"id": "other", "label": "Autre (précisé dans le prompt)"},
                ],
            },
            {
                "id": "style",
                "prompt": "Quel style visuel préférez-vous ?",
                "options": [
                    {"id": "minimal", "label": "Minimal & épuré"},
                    {"id": "bold", "label": "Audacieux & contrasté"},
                    {"id": "soft", "label": "Doux & éditorial"},
                    {"id": "dark", "label": "Sombre & tech"},
                ],
            },
            {
                "id": "scope",
                "prompt": "Par où commencer ?",
                "options": [
                    {"id": "hero", "label": "D’abord la page d’accueil / hero"},
                    {"id": "one_page", "label": "Une seule page simple"},
                    {"id": "full", "label": "Structure complète (plusieurs sections)"},
                ],
            },
        ]
    return [
        {
            "id": "goal",
            "prompt": "What is the main goal?",
            "options": [
                {"id": "marketing", "label": "Marketing / landing site"},
                {"id": "product", "label": "Interactive product / app"},
                {"id": "portfolio", "label": "Portfolio / showcase"},
                {"id": "other", "label": "Other (already in the prompt)"},
            ],
        },
        {
            "id": "style",
            "prompt": "Which visual direction?",
            "options": [
                {"id": "minimal", "label": "Minimal & clean"},
                {"id": "bold", "label": "Bold & high-contrast"},
                {"id": "soft", "label": "Soft & editorial"},
                {"id": "dark", "label": "Dark & tech"},
            ],
        },
        {
            "id": "scope",
            "prompt": "Where should we start?",
            "options": [
                {"id": "hero", "label": "Home / hero first"},
                {"id": "one_page", "label": "One simple page"},
                {"id": "full", "label": "Full structure (multiple sections)"},
            ],
        },
    ]


def _default_scaffold_plan(locale: Locale) -> list[dict[str, Any]]:
    if locale == "fr":
        items = [
            (
                "architecture",
                "Poser l’architecture App + Context + shell",
                "App/main + Provider API + slots layout compilent; scroll OK",
                ["src/App.tsx", "src/main.tsx", "src/context", "src/index.css"],
            ),
            (
                "styles_foundation",
                "Fondation CSS complète (tokens, layout, navbar/hero base)",
                "index.css complet: variables, typo, grid, navbar, hero base, utilities",
                ["src/index.css", "src/App.tsx", "DESIGN.md"],
            ),
            (
                "home",
                "Build Home / Hero (contenu TSX + append CSS)",
                "Hero navigable; nouvelles classes APPENDÉES à index.css sans supprimer l’existant",
                ["src/components", "src/App.tsx", "src/index.css"],
            ),
            (
                "primary_sections",
                "Build sections principales (TSX + append CSS)",
                "Chaque section a TSX + CSS append; règles navbar/hero préservées",
                ["src/components", "src/App.tsx", "src/index.css"],
            ),
            (
                "flows",
                "Build flux mock (panier / formulaires / empty states)",
                "localStorage ou state; UI complète sans API tierce",
                ["src/components", "src/context", "src/index.css"],
            ),
            (
                "coherence",
                "Passe cohérence Context + CSS + scroll",
                "Provider keys = consumers; classes TSX↔CSS; pas d’overflow:hidden html/body",
                ["src/context", "src/App.tsx", "src/main.tsx", "src/index.css", "DESIGN.md"],
            ),
        ]
    else:
        items = [
            (
                "architecture",
                "Set up App + Context + shell architecture",
                "App/main + Provider API + layout slots compile; scroll OK",
                ["src/App.tsx", "src/main.tsx", "src/context", "src/index.css"],
            ),
            (
                "styles_foundation",
                "Complete CSS foundation (tokens, layout, navbar/hero base)",
                "Full index.css: variables, type, grid, navbar, hero base, utilities",
                ["src/index.css", "src/App.tsx", "DESIGN.md"],
            ),
            (
                "home",
                "Build Home / Hero (TSX content + append CSS)",
                "Navigable hero; new classes APPENDED to index.css without dropping existing rules",
                ["src/components", "src/App.tsx", "src/index.css"],
            ),
            (
                "primary_sections",
                "Build primary sections (TSX + append CSS)",
                "Each section ships TSX + appended CSS; navbar/hero rules preserved",
                ["src/components", "src/App.tsx", "src/index.css"],
            ),
            (
                "flows",
                "Build mock flows (cart / forms / empty states)",
                "localStorage or state; complete UI without third-party APIs",
                ["src/components", "src/context", "src/index.css"],
            ),
            (
                "coherence",
                "Coherence pass Context + CSS + scroll",
                "Provider keys match consumers; TSX↔CSS; no html/body overflow:hidden",
                ["src/context", "src/App.tsx", "src/main.tsx", "src/index.css", "DESIGN.md"],
            ),
        ]
    return [
        {
            "id": tid,
            "title": title,
            "acceptance": acceptance,
            "files": files,
            "status": "pending",
        }
        for tid, title, acceptance, files in items
    ]


def _default_edit_plan(locale: Locale) -> list[dict[str, Any]]:
    if locale == "fr":
        return [
            {
                "id": "edit",
                "title": "Modifier uniquement la section / le texte demandé",
                "acceptance": "Seul le périmètre demandé change; le reste intact",
                "files": [],
                "status": "pending",
            }
        ]
    return [
        {
            "id": "edit",
            "title": "Edit only the mentioned section / text",
            "acceptance": "Only requested scope changes; rest untouched",
            "files": [],
            "status": "pending",
        }
    ]


async def build_plan(
    *,
    prompt: str,
    answers: dict[str, str] | None,
    task_class: str,
    auth: RodiumGenerationAuth,
    model: str,
    locale: Locale = "en",
) -> list[dict[str, Any]]:
    """Build a short task plan. Falls back to templates if LLM fails."""
    if task_class.startswith(("code.scaffold", "plan.scaffold")):
        fallback = _default_scaffold_plan(locale)
        max_tasks = 8
        min_tasks = 2
    else:
        fallback = _default_edit_plan(locale)
        max_tasks = 3
        min_tasks = 1

    answers_txt = ""
    if answers:
        answers_txt = "User clarifications:\n" + "\n".join(f"- {k}: {v}" for k, v in answers.items())

    system = (
        "You are Forge planner in PLAN MODE. Output ONLY valid JSON array of objects: "
        '{"id":"snake_case","title":"short UX-facing title",'
        '"acceptance":"one-line done criteria","files":["optional/paths"]}. '
        "NO code, NO markdown fences, NO forge-write tags. Titles in "
        + ("French." if locale == "fr" else "English.")
        + " Plan UX-first for edits: pages/sections/states before polish. "
        + f"Prefer 1 to {max_tasks} tasks for edits (max {max_tasks}). "
        "Do not invent redesign/polish tasks unless the user explicitly asks for a full redesign. "
        "For scoped requests, tasks must name the target section/file only. "
        "For scaffolds, use this ORDER: "
        "(1) architecture — App/Context/shell, "
        "(2) styles_foundation — complete index.css tokens/layout/navbar/hero base BEFORE content, "
        "(3) home / primary_sections / flows — content with CSS APPEND only "
        "(never drop existing selectors), "
        "(4) final coherence (Context + CSS + scroll). "
        "A styles_foundation task BEFORE sections is required for scaffolds. "
        "After styles_foundation, never ship orphan TSX without appending matching CSS. "
        "Frontend-only prototype: no backend connector tasks. "
        "Each task needs a clear acceptance criterion."
    )
    user = f"Request:\n{prompt}\n\n{answers_txt}".strip()
    try:
        raw = await complete_chat(
            auth=auth,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            locale=locale,
            temperature=0.2,
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list) or not parsed:
            return fallback
        out: list[dict[str, Any]] = []
        for i, item in enumerate(parsed[:max_tasks]):
            if not isinstance(item, dict):
                continue
            tid = str(item.get("id") or f"task_{i + 1}").strip()[:64]
            title = str(item.get("title") or tid).strip()[:200]
            if not title:
                continue
            acceptance = str(item.get("acceptance") or item.get("done_when") or "").strip()[:240]
            files_raw = item.get("files") or item.get("paths") or []
            files: list[str] = []
            if isinstance(files_raw, list):
                files = [str(p).strip()[:120] for p in files_raw if str(p).strip()][:8]
            out.append(
                {
                    "id": tid or f"task_{i + 1}",
                    "title": title,
                    "acceptance": acceptance,
                    "files": files,
                    "status": "pending",
                }
            )
        if len(out) >= min_tasks:
            out = out[:max_tasks]
            if len(out) >= 2 and not any(str(t.get("id")) == "coherence" for t in out):
                if locale == "fr":
                    out.append(
                        {
                            "id": "coherence",
                            "title": "Passe cohérence finale App + CSS + DESIGN + Context API",
                            "acceptance": (
                                "Provider keys = consumers; classes TSX↔CSS; createRoot; mount sans throw"
                            ),
                            "files": [
                                "src/context",
                                "src/App.tsx",
                                "src/main.tsx",
                                "src/index.css",
                                "DESIGN.md",
                            ],
                            "status": "pending",
                        }
                    )
                else:
                    out.append(
                        {
                            "id": "coherence",
                            "title": "Final coherence pass App + CSS + DESIGN + Context API",
                            "acceptance": (
                                "Provider keys match consumers; TSX↔CSS; named createRoot; mounts"
                            ),
                            "files": [
                                "src/context",
                                "src/App.tsx",
                                "src/main.tsx",
                                "src/index.css",
                                "DESIGN.md",
                            ],
                            "status": "pending",
                        }
                    )
            return out
        return fallback
    except (RodiumError, json.JSONDecodeError, TypeError, ValueError):
        return fallback
    except Exception:
        return fallback


def format_answers_for_prompt(answers: dict[str, str] | None, questions: list[dict] | None) -> str:
    if not answers:
        return ""
    label_by_opt: dict[str, str] = {}
    for q in questions or []:
        for opt in q.get("options") or []:
            label_by_opt[f"{q.get('id')}:{opt.get('id')}"] = str(opt.get("label") or opt.get("id"))
    lines = []
    for qid, oid in answers.items():
        label = label_by_opt.get(f"{qid}:{oid}", oid)
        lines.append(f"- {qid}: {label}")
    return "Clarifications:\n" + "\n".join(lines)


def effort_label(tier: str, locale: Locale) -> str:
    key = {
        "lite": "effort_lite",
        "primary": "effort_primary",
        "escalation": "effort_escalation",
        "image": "effort_image",
    }.get(tier, "effort_primary")
    return t(key, locale)
