"""Plan + clarify helpers for Forge agent runs."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.db import SessionLocal
from app.i18n import Locale, t
from app.services.attachments import (
    carried_reference_markers,
    count_markers_by_intent,
    enrich_user_message_with_vision,
    with_carried_references,
)
from app.services.llm import RodiumError, complete_chat
from app.services.rodium_generation import RodiumGenerationAuth
from app.services.typography import NO_LONG_DASH_RULE, strip_long_dashes

logger = logging.getLogger("planner")

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
    """Ask clarify only for major ambiguity, never for scoped micro-edits."""
    from app.services.orchestration.router import strip_attachment_noise

    text = strip_attachment_noise(prompt or "")
    if not text:
        # Attachments alone are enough context, skip clarify.
        return False

    if task_class in _SMALL_TASK_CLASSES:
        return False

    # Explicit full redesign, execute, don't ask.
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
    """Template questions, scoped for existing projects, fuller for scaffold."""
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


_QUESTION_TYPE_RULE = (
    'Set "type" per question: "multiple" when several options can be wanted together '
    "(pages or sections to include, features, social networks, languages, content types) "
    'and the prompt then says the user may pick several; "single" when the choices '
    "exclude each other (the name, the kind of project, the main tone, the overall style). "
)

#: Clarify answers keyed by question id: an option id or free text for a
#: single-choice question, a list of those for a multiple-choice one.
ClarifyAnswers = dict[str, str | list[str]]

MAX_CLARIFY_QUESTIONS = 10
_CLARIFY_ID_RE = re.compile(r"[^a-z0-9_]+")


def sanitize_clarify_questions(raw: object) -> list[dict[str, Any]]:
    """Validate/normalize LLM-generated questions; empty list = unusable.

    Contract kept end-to-end: {id, prompt, type, options: [{id, label}]} with
    unique slug ids, 2-6 options each, capped at MAX_CLARIFY_QUESTIONS.
    ``type`` is ``"single"`` (one choice) or ``"multiple"`` (several choices
    apply together); anything unknown falls back to ``"single"``. The web layer
    always offers a free-text answer on top, so options are suggestions, not
    a closed set.
    """
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for i, item in enumerate(raw):
        if len(out) >= MAX_CLARIFY_QUESTIONS:
            break
        if not isinstance(item, dict):
            continue
        prompt = strip_long_dashes(str(item.get("prompt") or item.get("question") or "").strip())[:200]
        if not prompt:
            continue
        qid = _CLARIFY_ID_RE.sub("_", str(item.get("id") or f"q{i + 1}").strip().lower()).strip("_")[:40]
        if not qid or qid in seen_ids:
            qid = f"q{i + 1}"
        if qid in seen_ids:
            continue
        options_raw = item.get("options")
        options: list[dict[str, str]] = []
        seen_opts: set[str] = set()
        if isinstance(options_raw, list):
            for j, opt in enumerate(options_raw[:6]):
                if isinstance(opt, str):
                    label, oid = strip_long_dashes(opt.strip(), label=True), f"opt{j + 1}"
                elif isinstance(opt, dict):
                    label = strip_long_dashes(str(opt.get("label") or opt.get("text") or "").strip(), label=True)
                    oid = _CLARIFY_ID_RE.sub("_", str(opt.get("id") or f"opt{j + 1}").lower()).strip("_")[:40]
                else:
                    continue
                if not label or not oid or oid in seen_opts:
                    continue
                seen_opts.add(oid)
                options.append({"id": oid, "label": label[:90]})
        if len(options) < 2:
            continue
        seen_ids.add(qid)
        out.append({"id": qid, "prompt": prompt, "type": _question_type(item), "options": options})
    return out


_MULTI_TYPES = frozenset({"multiple", "multi", "multi_select", "multiselect", "checkbox", "checkboxes"})


def _question_type(item: dict[str, Any]) -> str:
    raw = str(item.get("type") or item.get("kind") or "").strip().lower()
    if raw in _MULTI_TYPES or item.get("multiple") is True:
        return "multiple"
    return "single"


def answer_labels(qid: str, value: object, label_by_opt: dict[str, str]) -> list[str]:
    """Human labels for one answer: an option id, free text, or a list of either
    (a multiple-choice question)."""
    values = value if isinstance(value, list) else [value]
    out: list[str] = []
    for v in values:
        text = str(v or "").strip()
        if text:
            out.append(label_by_opt.get(f"{qid}:{text}", text))
    return out


async def build_clarify_questions_llm(
    prompt: str,
    locale: Locale = "en",
    *,
    auth: RodiumGenerationAuth,
    model: str,
    force_scaffold: bool = False,
) -> list[dict[str, Any]]:
    """Contextual questionnaire generated from the actual prompt.

    "Build a developer portfolio" should ask for the developer's NAME, title,
    projects to feature, not the same three generic template questions. Falls
    back to the static templates on any failure.
    """
    fallback = build_clarify_questions(prompt, locale, force_scaffold=force_scaffold)
    lang = "French" if locale == "fr" else "English"
    system = (
        "You prepare a SHORT clarification questionnaire before building a website. "
        "Output ONLY a valid JSON array (no markdown fences) of question objects: "
        '{"id":"snake_case","prompt":"the question","type":"single|multiple",'
        '"options":[{"id":"snake_case","label":"choice"}]}. '
        f"{_QUESTION_TYPE_RULE}"
        f"All prompts and labels in {lang}. "
        "Rules: 3 to 8 questions maximum; ask about the CONTENT the site needs "
        "(names, titles, sections, tone, colors, links, business specifics), most "
        "important first; every question ships 2 to 5 concrete, plausible example "
        "options tailored to the request (the user can always type a custom answer, "
        "so options are smart suggestions, never 'other'); never ask about hosting, "
        "frameworks, backends or budgets; skip anything the prompt already answers."
        + " " + NO_LONG_DASH_RULE
    )
    try:
        raw = await complete_chat(
            auth=auth,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Request:\n{prompt.strip()[:4000]}"},
            ],
            locale=locale,
            temperature=0.4,
        )
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        questions = sanitize_clarify_questions(json.loads(cleaned))
        return questions or fallback
    except Exception:
        return fallback


_CLARITY_SKIP_RE = re.compile(
    r"\b(sans\s+(?:poser\s+de\s+)?questions?|pas\s+de\s+questions?|no\s+questions?|"
    r"skip\s+(?:the\s+)?questions?|construis\s+directement|build\s+(?:it\s+)?directly|"
    r"just\s+build|vas-?y\s+directement|lance\s+directement)\b",
    re.I,
)


def clarity_gauge_eligible(
    prompt: str,
    *,
    force_scaffold: bool,
    task_class: str | None,
) -> bool:
    """Should the AI clarity gauge run on this request?

    Only for builds, the first message of a project or a scaffold-class ask.
    Never for scoped edits (an existing project already defines the brand),
    never when a reference screenshot is attached (the image IS the spec), and
    never when the user explicitly asked to build without questions.
    """
    from app.services.orchestration.router import (
        has_reference_attachments,
        strip_attachment_noise,
    )

    text = strip_attachment_noise(prompt or "")
    if not text:
        return False
    if has_reference_attachments(prompt or ""):
        return False
    if _CLARITY_SKIP_RE.search(text):
        return False
    if task_class in _SMALL_TASK_CLASSES:
        return False
    if _EDIT_VERB_RE.search(text) and _SECTION_RE.search(text):
        return False
    return force_scaffold or str(task_class or "").startswith(("code.scaffold", "plan.scaffold"))


class ClarityAssessment:
    """Result of the clarity gauge. ``score`` is None when the gauge failed."""

    __slots__ = ("score", "missing", "questions")

    def __init__(self, score: int | None, missing: list[str], questions: list[dict[str, Any]]):
        self.score = score
        self.missing = missing
        self.questions = questions

    def needs_questions(self, threshold: int) -> bool:
        return self.score is not None and self.score < threshold


def _parse_json_object(raw: str) -> Any:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Tolerate a sentence around the object: keep the outermost {...}.
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


async def assess_prompt_clarity(
    prompt: str,
    locale: Locale = "en",
    *,
    auth: RodiumGenerationAuth,
    model: str,
    force_scaffold: bool = True,
    threshold: int = 70,
) -> ClarityAssessment:
    """AI clarity gauge: score how buildable the request is WITHOUT guessing.

    One call returns the score (0-100), what is missing, and, only when the
    score is under ``threshold`` the tailored questions to fill the gaps.
    Never raises: on any failure it returns ``score=None`` so the caller builds
    instead of blocking the user.
    """
    lang = "French" if locale == "fr" else "English"
    context_rule = (
        "This is a NEW project: nothing exists yet, so brand, content and structure "
        "must come from the request."
        if force_scaffold
        else "This is an EXISTING project: its brand and structure already exist in code. "
        "Only score low if the requested change itself is ambiguous."
    )
    system = (
        "You are Forge's request analyst. Before anything is built, rate how clear and "
        "complete the user's request is. Score 0-100 = how well a designer could build "
        "exactly what the user wants WITHOUT guessing. Judge: the kind of site/app and "
        "its purpose; the brand or project NAME; the audience; the key pages/sections or "
        "features; concrete content (names, offers, texts, links); the style/tone/colors. "
        "Typos do not lower the score. Calibration: 'a comedy showcase platform' (type only, "
        "no name, audience, sections or content) is about 35; a request giving name + "
        "purpose + sections + style is 80 or more. "
        f"{context_rule} "
        "Output ONLY a JSON object (no markdown fences): "
        '{"score": <int 0-100>, "missing": ["short item"...], "questions": [ '
        '{"id":"snake_case","prompt":"the question","type":"single|multiple",'
        '"options":[{"id":"snake_case","label":"choice"}]} ]}. '
        f"{_QUESTION_TYPE_RULE}"
        f"Write missing items, prompts and labels in {lang}. "
        f"Include 3 to 8 questions ONLY when score < {threshold} (otherwise an empty list): "
        "ask about the CONTENT the site needs (name, audience, sections, key texts, tone, "
        "colors, links, business specifics), most important first; every question ships 2 "
        "to 5 concrete, plausible options tailored to the request (the user can always type "
        "a custom answer, so never offer 'other'); never ask about hosting, frameworks, "
        "backends or budgets; never ask what the request already answers."
        + " " + NO_LONG_DASH_RULE
    )
    try:
        raw = await complete_chat(
            auth=auth,
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Request:\n{(prompt or '').strip()[:4000]}"},
            ],
            locale=locale,
            temperature=0.2,
        )
        parsed = _parse_json_object(raw)
        if not isinstance(parsed, dict):
            raise ValueError("clarity gauge: not an object")
        score = int(round(float(parsed.get("score"))))
        score = max(0, min(100, score))
        missing = [strip_long_dashes(str(m).strip(), label=True)[:120] for m in (parsed.get("missing") or []) if str(m).strip()][:8]
        questions = sanitize_clarify_questions(parsed.get("questions") or [])
        return ClarityAssessment(score, missing, questions)
    except Exception:
        logger.warning("clarity gauge failed, building without questions", exc_info=True)
        return ClarityAssessment(None, [], [])


async def build_final_brief(
    prompt: str,
    *,
    questions: list[dict[str, Any]] | None,
    answers: ClarifyAnswers | None,
    locale: Locale = "en",
    auth: RodiumGenerationAuth,
    model: str,
) -> str:
    """Merge the request and the user's answers into ONE clear build brief.

    The planner and every build task then read a complete, human-readable brief
    instead of the vague first sentence plus raw ``question_id: option_id``
    pairs. Falls back to request + labelled answers on any failure.
    """
    answers_block = format_answers_for_prompt(answers, questions)
    fallback = f"{(prompt or '').strip()}\n\n{answers_block}".strip()
    if not answers:
        return (prompt or "").strip()
    qa_lines = []
    label_by_opt: dict[str, str] = {}
    prompt_by_q: dict[str, str] = {}
    for q in questions or []:
        prompt_by_q[str(q.get("id"))] = str(q.get("prompt") or q.get("id"))
        for opt in q.get("options") or []:
            label_by_opt[f"{q.get('id')}:{opt.get('id')}"] = str(opt.get("label") or opt.get("id"))
    for qid, value in answers.items():
        question = prompt_by_q.get(str(qid), str(qid))
        labels = answer_labels(str(qid), value, label_by_opt)
        if not labels:
            continue
        # A multiple-choice answer lists every selection, each one is wanted.
        qa_lines.append(f"- {question} → {' + '.join(labels) if len(labels) > 1 else labels[0]}")
    lang = "French" if locale == "fr" else "English"
    system = (
        "You write the FINAL BUILD BRIEF for a website/app, from the user's request and "
        "their answers to clarification questions. An answer listing several choices "
        "joined by ' + ' means the user wants ALL of them. Produce one clear, complete brief the "
        "planner can build from: project name, purpose, audience, pages/sections (in "
        "order), the key content of each, style/tone/colors, and any links or specifics. "
        "Keep every fact the user gave, verbatim where it is a name or text. Do not invent "
        "facts; where something is still unknown, choose a sensible default and label it "
        "'(default)'. Forge builds a FRONTEND prototype: describe features as UI (a booking "
        "form, a calendar, a map embed), never promise backends, payments, real-time data "
        "or security. Plain text with short headed lines, no markdown fences, max 1800 "
        f"characters, in {lang}. {NO_LONG_DASH_RULE}"
    )
    user = f"Request:\n{(prompt or '').strip()[:4000]}\n\nAnswers:\n" + "\n".join(qa_lines)
    try:
        raw = await complete_chat(
            auth=auth,
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            locale=locale,
            temperature=0.3,
        )
        brief = (raw or "").strip()
        if brief.startswith("```"):
            brief = re.sub(r"^```\w*\s*", "", brief)
            brief = re.sub(r"\s*```$", "", brief)
        brief = strip_long_dashes(brief.strip())[:2400]
        return brief or fallback
    except Exception:
        logger.warning("final brief failed, using request + answers", exc_info=True)
        return fallback


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
    answers: ClarifyAnswers | None,
    task_class: str,
    auth: RodiumGenerationAuth,
    model: str,
    locale: Locale = "en",
    project_id: str | None = None,
    conversation: list[tuple[str, str]] | None = None,
    brief: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Build a short task plan plus display meta (title/summary).

    ``conversation`` (the chat history, current turn included) gives the planner
    the recent turns so a follow-up is planned as a continuation, not as a
    brand-new request, and re-attaches the latest reference screenshot.
    ``brief`` (the merged request + clarification answers) replaces the raw
    ``answers`` pairs when present.

    Returns ``(tasks, meta)`` where ``meta`` is ``{"title","summary"}`` (either
    key may be missing when the LLM answer lacks them).

    On LLM / parse failure this **raises** ``RodiumError`` so the chat stream
    can surface the error instead of silently substituting a static template
    that looks like a real plan.

    When ``project_id`` is set, attached images are resolved via a short-lived
    DB session and sent as multimodal ``image_url`` parts (same path as
    execution).
    """
    if task_class.startswith(("code.scaffold", "plan.scaffold")):
        max_tasks = 8
        min_tasks = 2
    else:
        max_tasks = 3
        min_tasks = 1

    ref_count = count_markers_by_intent(prompt, "reference")
    # Multiple reference screenshots ⇒ one page/route each (plus foundation tasks).
    if ref_count >= 2 and task_class.startswith(("code.scaffold", "plan.scaffold", "code.edit")):
        max_tasks = max(max_tasks, min(8, ref_count + 3))
        min_tasks = max(min_tasks, min(ref_count + 1, max_tasks))

    answers_txt = ""
    if brief:
        answers_txt = "Final brief (request + the user's clarification answers):\n" + brief.strip()
    elif answers:
        answers_txt = "User clarifications:\n" + "\n".join(
            f"- {k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in answers.items()
        )

    conversation_txt = ""
    carried: list[str] = []
    if conversation:
        from app.services.orchestration.router import strip_attachment_noise

        turns = list(conversation)
        if turns and turns[-1][0] == "user":
            turns = turns[:-1]
        lines = []
        for role, content in turns[-4:]:
            clean = strip_attachment_noise(content or "")[: 500 if role == "assistant" else 700]
            if clean:
                lines.append(f"{role}: {clean}")
        if lines:
            conversation_txt = (
                "Recent conversation (the new request CONTINUES this work on the existing "
                "project, plan it as a follow-up, never start over):\n" + "\n".join(lines)
            )
        carried = carried_reference_markers(conversation)

    multi_page_rule = ""
    if ref_count >= 2:
        multi_page_rule = (
            f" MULTI-PAGE REFERENCES: the user attached {ref_count} reference screenshots. "
            "Plan ONE distinct page/route per screenshot (navigable), deriving route names "
            "from filenames when possible (home→/, pricing→/pricing, about→/about). "
            "Do NOT collapse them into a single long scrolling landing unless the user "
            "explicitly asks for one page only. "
        )

    system = (
        "You are Forge planner in PLAN MODE. Output ONLY valid JSON object: "
        '{"title":"3-6 word plan name","summary":"1-2 sentence description of the goal",'
        '"tasks":[{"id":"snake_case","title":"short UX-facing title",'
        '"acceptance":"one-line done criteria","files":["optional/paths"]}]}. '
        "NO code, NO markdown fences, NO forge-write tags. Title, summary and task titles in "
        + ("French." if locale == "fr" else "English.")
        + " Plan UX-first for edits: pages/sections/states before polish. "
        + f"Prefer 1 to {max_tasks} tasks for edits (max {max_tasks}). "
        "Do not invent redesign/polish tasks unless the user explicitly asks for a full redesign. "
        "For scoped requests, tasks must name the target section/file only. "
        + multi_page_rule
        + "For scaffolds, use this ORDER: "
        "(1) architecture, App/Context/shell, "
        "(2) styles_foundation, complete index.css tokens/layout/navbar base BEFORE content, "
        "(3) home / primary_sections / flows, each page brings its OWN src/styles/<page>.css "
        "(never rewrite index.css after the foundation), "
        "(4) final coherence (Context + CSS + scroll). "
        "A styles_foundation task BEFORE sections is required for scaffolds. "
        "After styles_foundation, never ship orphan TSX without appending matching CSS. "
        "Frontend-only prototype: no backend connector tasks. "
        "Each task needs a clear acceptance criterion."
        + " " + NO_LONG_DASH_RULE
    )
    request_body = f"{prompt}\n\n{answers_txt}".strip() if answers_txt else prompt
    if carried:
        request_body = with_carried_references(request_body, carried, locale)
    request_text = f"Request:\n{request_body}".strip()
    if conversation_txt:
        request_text = f"{conversation_txt}\n\n{request_text}"
    user: str | list[dict[str, Any]] = request_text
    if project_id:
        with SessionLocal() as vision_db:
            user = await enrich_user_message_with_vision(vision_db, project_id, request_text)
            vision_db.commit()
    plan_failed_en = "Planning failed. Check your generation key and try again."
    plan_failed_fr = "Échec du plan. Vérifie ta clé de génération et réessaie."
    plan_unusable_en = "Planning failed, the model returned an unusable response. Try again."
    plan_unusable_fr = "Échec du plan, la réponse du modèle est inutilisable. Réessaie."
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
        meta: dict[str, str] = {}
        if isinstance(parsed, dict):
            # New object shape: {"title", "summary", "tasks": [...]}.
            title = strip_long_dashes(str(parsed.get("title") or "").strip(), label=True)[:120]
            summary = strip_long_dashes(str(parsed.get("summary") or parsed.get("description") or "").strip())[:400]
            if title:
                meta["title"] = title
            if summary:
                meta["summary"] = summary
            parsed = parsed.get("tasks")
        if not isinstance(parsed, list) or not parsed:
            raise RodiumError(plan_unusable_fr if locale == "fr" else plan_unusable_en)
        out: list[dict[str, Any]] = []
        for i, item in enumerate(parsed[:max_tasks]):
            if not isinstance(item, dict):
                continue
            tid = str(item.get("id") or f"task_{i + 1}").strip()[:64]
            title = strip_long_dashes(str(item.get("title") or tid).strip(), label=True)[:200]
            if not title:
                continue
            acceptance = strip_long_dashes(str(item.get("acceptance") or item.get("done_when") or "").strip())[:240]
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
        if len(out) < min_tasks:
            raise RodiumError(plan_unusable_fr if locale == "fr" else plan_unusable_en)
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
                        "acceptance": ("Provider keys match consumers; TSX↔CSS; named createRoot; mounts"),
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
        return out, meta
    except RodiumError:
        raise
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.warning("planner LLM response unusable: %s", exc)
        raise RodiumError(plan_unusable_fr if locale == "fr" else plan_unusable_en) from exc
    except Exception as exc:
        logger.warning("planner LLM failed (unexpected)", exc_info=True)
        raise RodiumError(plan_failed_fr if locale == "fr" else plan_failed_en) from exc


def format_answers_for_prompt(answers: ClarifyAnswers | None, questions: list[dict] | None) -> str:
    if not answers:
        return ""
    label_by_opt: dict[str, str] = {}
    for q in questions or []:
        for opt in q.get("options") or []:
            label_by_opt[f"{q.get('id')}:{opt.get('id')}"] = str(opt.get("label") or opt.get("id"))
    lines = []
    for qid, value in answers.items():
        labels = answer_labels(str(qid), value, label_by_opt)
        if labels:
            lines.append(f"- {qid}: {', '.join(labels)}")
    return "Clarifications:\n" + "\n".join(lines)


def effort_label(tier: str, locale: Locale) -> str:
    key = {
        "lite": "effort_lite",
        "primary": "effort_primary",
        "escalation": "effort_escalation",
        "image": "effort_image",
    }.get(tier, "effort_primary")
    return t(key, locale)
