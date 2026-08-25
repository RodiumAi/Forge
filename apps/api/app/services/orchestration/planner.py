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
    r"navbar|hero|footer|login|signup|pricing)\b",
    re.I,
)


def needs_clarify(prompt: str, *, force_scaffold: bool = False) -> bool:
    from app.services.orchestration.router import strip_attachment_noise

    text = strip_attachment_noise(prompt or "")
    if not text:
        # Attachments alone are enough context — skip clarify.
        return False
    if len(text) >= 180 and _TARGET_RE.search(text):
        return False
    if force_scaffold and len(text) < 40:
        return True
    if len(text) < 55:
        return True
    if _VAGUE_RE.search(text) and not _TARGET_RE.search(text):
        return True
    return False


def build_clarify_questions(prompt: str, locale: Locale = "en") -> list[dict[str, Any]]:
    """Template questions — Cursor-like multiple choice."""
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
                    {"id": "full", "label": "Structure complète (plusieurs sections)"},
                    {"id": "hero", "label": "D’abord la page d’accueil / hero"},
                    {"id": "one_page", "label": "Une seule page simple"},
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
                {"id": "full", "label": "Full structure (multiple sections)"},
                {"id": "hero", "label": "Home / hero first"},
                {"id": "one_page", "label": "One simple page"},
            ],
        },
    ]


def _default_scaffold_plan(locale: Locale) -> list[dict[str, Any]]:
    if locale == "fr":
        titles = [
            ("structure", "Poser la structure de l’app"),
            ("layout", "Construire navigation et mise en page"),
            ("sections", "Ajouter les sections principales"),
            ("styles", "Appliquer le style et les tokens"),
            ("polish", "Peaufiner textes et états vides"),
        ]
    else:
        titles = [
            ("structure", "Set up app structure"),
            ("layout", "Build navigation and layout"),
            ("sections", "Add primary sections"),
            ("styles", "Apply style and design tokens"),
            ("polish", "Polish copy and empty states"),
        ]
    return [{"id": tid, "title": title, "status": "pending"} for tid, title in titles]


def _default_edit_plan(locale: Locale) -> list[dict[str, Any]]:
    if locale == "fr":
        titles = [
            ("understand", "Comprendre la demande"),
            ("edit", "Modifier les fichiers concernés"),
            ("verify", "Vérifier cohérence visuelle"),
        ]
    else:
        titles = [
            ("understand", "Understand the request"),
            ("edit", "Edit the relevant files"),
            ("verify", "Check visual consistency"),
        ]
    return [{"id": tid, "title": title, "status": "pending"} for tid, title in titles]


async def build_plan(
    *,
    prompt: str,
    answers: dict[str, str] | None,
    task_class: str,
    auth: RodiumGenerationAuth,
    model: str,
    locale: Locale = "en",
) -> list[dict[str, Any]]:
    """Build a 3–8 task plan. Falls back to templates if LLM fails."""
    if task_class.startswith("code.scaffold") or task_class.startswith("plan.scaffold"):
        fallback = _default_scaffold_plan(locale)
    else:
        fallback = _default_edit_plan(locale)

    answers_txt = ""
    if answers:
        answers_txt = "User clarifications:\n" + "\n".join(f"- {k}: {v}" for k, v in answers.items())

    system = (
        "You are Forge planner. Output ONLY valid JSON array of 3 to 8 objects: "
        '{"id":"snake_case","title":"short user-facing title"}. '
        "No code, no markdown fences. Titles in "
        + ("French." if locale == "fr" else "English.")
        + " Tasks must be actionable for building a web UI."
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
        for i, item in enumerate(parsed[:8]):
            if not isinstance(item, dict):
                continue
            tid = str(item.get("id") or f"task_{i+1}").strip()[:64]
            title = str(item.get("title") or tid).strip()[:200]
            if not title:
                continue
            out.append({"id": tid or f"task_{i+1}", "title": title, "status": "pending"})
        return out if len(out) >= 2 else fallback
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
