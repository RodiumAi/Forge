"""Derive a short symbolic project name from the user's first prompt."""

from __future__ import annotations

import asyncio
import re
import unicodedata

from sqlalchemy.orm import Session

from app.config import get_settings
from app.i18n import Locale
from app.models import User
from app.services.llm import complete_chat
from app.services.rodium_generation import resolve_generation_auth

_MAX_NAME_LEN = 32
_MAX_TOKENS = 4

_STOPWORDS = frozenset(
    {
        # FR
        "a",
        "ai",
        "au",
        "aux",
        "avec",
        "ce",
        "ces",
        "cette",
        "comme",
        "cree",
        "creer",
        "crée",
        "créer",
        "dans",
        "de",
        "des",
        "du",
        "en",
        "et",
        "faire",
        "fais",
        "je",
        "la",
        "le",
        "les",
        "ma",
        "mes",
        "moi",
        "mon",
        "notre",
        "ou",
        "pour",
        "qui",
        "sa",
        "se",
        "ses",
        "son",
        "sur",
        "toi",
        "ton",
        "tu",
        "un",
        "une",
        "veux",
        "voudrais",
        "vos",
        "votre",
        "y",
        # EN
        "an",
        "and",
        "app",
        "application",
        "build",
        "building",
        "can",
        "create",
        "creating",
        "for",
        "from",
        "help",
        "i",
        "into",
        "make",
        "making",
        "me",
        "my",
        "need",
        "of",
        "or",
        "our",
        "please",
        "site",
        "the",
        "to",
        "want",
        "website",
        "with",
        "would",
        "you",
    }
)


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _tokenize(prompt: str) -> list[str]:
    cleaned = re.sub(r"[^\w\s'-]", " ", prompt, flags=re.UNICODE)
    return [tok for tok in re.split(r"[\s_]+", cleaned) if tok]


def heuristic_project_name(prompt: str, *, fallback: str = "Nouveau projet") -> str:
    """Extract 2–4 meaningful tokens from a free-form prompt."""
    raw = (prompt or "").strip()
    if not raw:
        return fallback

    keep: list[str] = []
    for tok in _tokenize(raw):
        folded = _strip_accents(tok).lower()
        folded = re.sub(r"[^a-z0-9]", "", folded)
        if len(folded) < 2:
            continue
        if folded in _STOPWORDS:
            continue
        # Prefer original casing with accents for display when short.
        display = tok.strip("-'")
        if not display:
            continue
        keep.append(display)
        if len(keep) >= _MAX_TOKENS:
            break

    if not keep:
        # Last resort: first few non-empty words of the prompt.
        keep = [t for t in _tokenize(raw)[:3] if t] or [fallback]

    title_parts: list[str] = []
    for i, part in enumerate(keep):
        if i == 0:
            title_parts.append(part[:1].upper() + part[1:] if part else part)
        else:
            title_parts.append(part.lower() if part.isalpha() else part)

    name = " ".join(title_parts).strip()
    if len(name) > _MAX_NAME_LEN:
        name = name[:_MAX_NAME_LEN].rsplit(" ", 1)[0].strip() or name[:_MAX_NAME_LEN]
    return name or fallback


def _clean_llm_title(text: str, *, fallback: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    line = re.sub(r'^["\'«»]+|["\'«»]+$', "", line)
    line = re.sub(r"\s+", " ", line).strip()
    # Reject if the model echoed a sentence.
    if len(line) > _MAX_NAME_LEN or len(line.split()) > _MAX_TOKENS + 1:
        return fallback
    if not line or line.lower() in {"none", "n/a", "null"}:
        return fallback
    return line


async def suggest_project_name(
    prompt: str,
    *,
    locale: Locale,
    db: Session,
    user: User,
    fallback: str = "Nouveau projet",
) -> str:
    """Heuristic first; optionally polish with a short LLM call.

    The WHOLE remote path (auth refresh + LLM) is capped at 4s: this runs inside
    POST /projects, and the dashboard blocks on that response before redirecting
    to the builder. A slow OIDC refresh used to sit outside the cap and could
    stall project creation for up to 30s.
    """
    base = heuristic_project_name(prompt, fallback=fallback)
    raw = (prompt or "").strip()
    if not raw or len(raw) < 12:
        return base

    settings = get_settings()
    system = (
        "You invent a short project display name from a user build request. "
        "Reply with ONLY the name: 2 to 4 words, max 32 characters, no quotes, "
        "no punctuation, Title Case. Prefer the product concept (e.g. "
        "'Portfolio développeurs'), never the full sentence."
        if locale == "en"
        else "Tu inventes un nom d'affichage court pour un projet à partir d'une "
        "demande utilisateur. Réponds UNIQUEMENT avec le nom : 2 à 4 mots, "
        "max 32 caractères, sans guillemets ni ponctuation, Title Case. "
        "Privilégie le concept (ex. 'Portfolio développeurs'), jamais la phrase entière."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": raw[:500]},
    ]

    async def _remote_name() -> str:
        auth = await resolve_generation_auth(db, user)
        return await complete_chat(
            auth=auth,
            model=settings.default_model,
            messages=messages,
            locale=locale,
            temperature=0.2,
        )

    try:
        result = await asyncio.wait_for(_remote_name(), timeout=4.0)
        return _clean_llm_title(result, fallback=base)
    except Exception:
        return base
