"""Structured compaction of long chat history (ported from Forge compaction prompt)."""

from __future__ import annotations

from app.i18n import Locale
from app.prompts.system import COMPACTION_SYSTEM_PROMPT
from app.services.llm import RodiumError, complete_chat
from app.services.rodium_generation import RodiumGenerationAuth


def _format_turns(turns: list[tuple[str, str]], *, max_chars: int = 24_000) -> str:
    parts: list[str] = []
    used = 0
    for role, content in turns:
        chunk = f"### {role}\n{(content or '')[:4000]}\n\n"
        if used + len(chunk) > max_chars:
            break
        parts.append(chunk)
        used += len(chunk)
    return "".join(parts).strip()


async def compact_conversation(
    *,
    turns: list[tuple[str, str]],
    auth: RodiumGenerationAuth,
    model: str,
    locale: Locale = "en",
) -> str | None:
    """Return a structured summary, or None if compaction fails / nothing to compact."""
    if len(turns) < 4:
        return None
    transcript = _format_turns(turns)
    if not transcript.strip():
        return None
    try:
        return await complete_chat(
            auth=auth,
            model=model,
            messages=[
                {"role": "system", "content": COMPACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "Summarize this Forge builder conversation:\n\n" + transcript,
                },
            ],
            locale=locale,
            temperature=0.1,
        )
    except (RodiumError, Exception):
        return None
