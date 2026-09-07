"""Minimal task classifier + routing table (Gemini text, gpt-image-2 for images)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.config import get_settings
from app.services.attachments import extract_image_urls

# Effort labels shown in UI — never expose model slugs.
EFFORT_LABELS = {
    "lite": "Rapide",
    "primary": "Standard",
    "escalation": "Approfondi",
    "image": "Image",
}


@dataclass(frozen=True)
class Route:
    task_class: str
    model: str
    tier: str
    effort_label: str
    is_image: bool = False


# Only explicit *generation* intents — not "image attached" / reference screenshots.
_IMAGE_GENERATE_RE = re.compile(
    r"\b("
    r"génér(?:e|er|ation)\s+(?:une?\s+)?(?:image|illustration|logo|photo|visuel|bannière|banner)|"
    r"generate\s+(?:an?\s+)?(?:image|illustration|logo|photo|banner)|"
    r"crée(?:r)?\s+(?:une?\s+)?(?:image|illustration|logo|photo)|"
    r"create\s+(?:an?\s+)?(?:image|illustration|logo|photo)|"
    r"dessine(?:[- ]moi)?|"
    r"draw\s+(?:me\s+)?(?:an?\s+)?(?:image|logo|illustration)"
    r")\b",
    re.I,
)
_SCAFFOLD_RE = re.compile(
    r"\b(crée(?:r)?\s+(?:un\s+)?(?:site|app|page)|create\s+(?:a\s+)?(?:website|app|page)|"
    r"from\s+scratch|from scratch|nouveau\s+projet|landing\s*page|scaffold)\b",
    re.I,
)
_SMALL_RE = re.compile(
    r"\b(change|modifie|modifier|remplace|mets|mettre|renomme|rename|update|fix|"
    r"édite|edit|ajuste|couleur|color|typo|padding|margin|texte\s+du|texte\s+de|"
    r"titre|title|label|bouton|button\s+label|hero|footer|navbar|header)\b",
    re.I,
)

_ATTACH_NOISE_RE = re.compile(
    r"\[(?:Files|Fichiers|Image attached|Image jointe|Reference screenshot|Capture de référence|"
    r"PDF attached[^\]]*|PDF joint[^\]]*|Connector)[^\]]*\]|"
    r"###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte)"
    r"[^\n]*\n[\s\S]*?(?=\n###|\n\[|\Z)",
    re.I,
)

_REFERENCE_ATTACH_RE = re.compile(
    r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe|Files|Fichiers):|"
    r"###\s+(?:Markdown file|Fichier Markdown|PDF content|Contenu PDF|Text file|Fichier texte)",
    re.I,
)


def strip_attachment_noise(user_text: str) -> str:
    """Remove attachment markers so classification uses the user's real intent."""
    text = _ATTACH_NOISE_RE.sub(" ", user_text or "")
    # Drop the reference-instruction paragraphs that follow screenshot markers.
    text = re.sub(
        r"This is an? (?:REFERENCE screenshot(?:/mockup)?(?: for visual inspiration)?|uploaded site asset)[\s\S]*?(?=\n\n|\Z)",
        " ",
        text,
        flags=re.I,
    )
    text = re.sub(r"\[Connector:\s*[^\]]+\]", " ", text, flags=re.I)
    # Preview element-selection chips: long CSS selectors must not push a
    # one-line visual edit out of the single-pass path (len >= 180 → full plan).
    text = re.sub(r"\[(?:Sélection|Selection):\s*[^\]]*\]", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def has_reference_attachments(user_text: str) -> bool:
    return bool(_REFERENCE_ATTACH_RE.search(user_text or ""))


def classify_task(user_text: str) -> str:
    raw = user_text or ""
    text = strip_attachment_noise(raw)
    if has_reference_attachments(raw) and extract_image_urls(raw):
        return "code.edit.with_vision"
    if not text:
        # Attachments-only message → treat as code/design edit using the refs.
        if has_reference_attachments(raw):
            return "code.edit.medium"
        return "code.edit.medium"
    if _IMAGE_GENERATE_RE.search(text):
        return "image.generate"
    # (S or len>400) and (S or (page and crée))  ==  S or (len>400 and page and crée)
    if _SCAFFOLD_RE.search(text) or (len(text) > 400 and "page" in text.lower() and "crée" in text.lower()):
        return "code.scaffold"
    if len(text) < 120 and _SMALL_RE.search(text):
        return "code.edit.small"
    if len(text) > 800:
        return "code.edit.large"
    return "code.edit.medium"


def route_task(task_class: str) -> Route:
    settings = get_settings()
    lite = (settings.effective_lite_model or "").strip() or "google/gemini-3.7-flash"
    flash = (settings.effective_default_model or "").strip() or "google/gemini-3.7-flash"
    image = (settings.effective_default_image_model or "").strip() or "openai/gpt-image-2"
    escalation = (settings.effective_escalation_model or "").strip() or flash
    if settings.enable_pro_escalation and task_class in (
        "code.scaffold",
        "code.edit.large",
        "plan.scaffold",
    ):
        flash = escalation

    # Tiers only — model slugs come exclusively from Settings / .env
    table: dict[str, tuple[str, str]] = {
        "intent.classify": (lite, "lite"),
        "plan.scaffold": (flash, "primary"),
        "plan.feature": (flash, "primary"),
        "code.scaffold": (flash, "primary"),
        "code.scaffold.with_vision": (flash, "primary"),
        "code.section": (flash, "primary"),
        "code.assemble": (lite, "lite"),
        "code.edit.small": (lite, "lite"),
        "code.edit.medium": (flash, "primary"),
        "code.edit.with_vision": (flash, "primary"),
        "code.edit.large": (flash, "primary"),
        "code.fix.build": (flash, "primary"),
        "code.fix.runtime": (flash, "primary"),
        "text.copy": (lite, "lite"),
        "text.summarize": (lite, "lite"),
        "text.micro": (lite, "lite"),
        "image.generate": (image, "image"),
        "coherence.pass": (lite, "lite"),
        "verify.repair": (flash, "primary"),
    }
    model, tier = table.get(task_class, (flash, "primary"))
    return Route(
        task_class=task_class,
        model=model,
        tier=tier,
        effort_label=EFFORT_LABELS.get(tier, "Standard"),
        is_image=task_class == "image.generate",
    )


def fallback_model(model: str) -> str | None:
    """A different model to re-try a task on after the primary one failed.

    A task can fail for reasons that are about the model rather than the
    network — a refusal, a malformed response, a context it cannot handle. One
    attempt on the escalation model (or on the default when the failure WAS the
    escalation model) turns a fair share of those into successes, and costs one
    extra call at most once per task.

    Returns None when there is nothing distinct to fall back to, so the caller
    skips the attempt rather than paying for the same model twice.
    """
    settings = get_settings()
    default = (settings.effective_default_model or "").strip()
    escalation = (settings.effective_escalation_model or "").strip()
    current = (model or "").strip()

    for candidate in (escalation, default):
        if candidate and candidate != current:
            return candidate
    return None


def classify_and_route(user_text: str, *, force_scaffold: bool = False) -> Route:
    raw = user_text or ""
    text = strip_attachment_noise(raw)
    if force_scaffold and text and not _IMAGE_GENERATE_RE.search(text):
        if has_reference_attachments(raw) and extract_image_urls(raw):
            # Mockup-driven first build: Gemini vision, not Claude escalation.
            return route_task("code.scaffold.with_vision")
        return route_task("code.scaffold")
    return route_task(classify_task(user_text))
