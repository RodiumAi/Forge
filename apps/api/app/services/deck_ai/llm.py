"""One JSON answer from the model, validated, repaired when it is not.

Every deck call goes through ``ask_json``: the gateway bills it like any other
Forge call (``complete_chat``), the answer is parsed and checked by the
caller's ``check``, and a broken answer is sent back with its errors for a
bounded number of repairs, the way ``verify_build`` repairs a broken site.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from app.config import get_settings
from app.prompts.deck import REPAIR_PROMPT
from app.services.deck_ai.jsonio import ModelJsonError, parse_json_object
from app.services.llm import complete_chat

#: Repairs after the first answer (so at most 3 calls per slide).
MAX_REPAIRS = 2
MAX_TOKENS = 8192


class DeckAnswerError(ValueError):
    """The model never produced a valid answer within the repair budget."""

    def __init__(self, message: str, last_errors: str = "") -> None:
        super().__init__(message)
        self.last_errors = last_errors


@dataclass
class Answer[T]:
    value: T
    repairs: int


def describe_errors(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        lines = []
        for error in exc.errors(include_url=False)[:12]:
            where = ".".join(str(part) for part in error.get("loc") or ())
            lines.append(f"- {where or 'root'}: {error.get('msg')}")
        return "\n".join(lines)
    return f"- {exc}"


async def ask_json[T](
    *,
    auth: Any,
    model: str,
    system: str,
    user: str,
    check: Callable[[dict[str, Any]], T],
    locale: str = "fr",
    max_repairs: int = MAX_REPAIRS,
    temperature: float = 0.4,
) -> Answer[T]:
    """Ask, parse, ``check``; on failure send the errors back, up to ``max_repairs`` times."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    errors = ""
    for attempt in range(max_repairs + 1):
        text = await complete_chat(
            auth=auth,
            model=model,
            messages=messages,
            locale=locale,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=MAX_TOKENS,
            reasoning_effort=get_settings().generation_effort,
        )
        try:
            data = parse_json_object(text)
            return Answer(value=check(data), repairs=attempt)
        except (ModelJsonError, ValidationError, ValueError, TypeError, KeyError) as exc:
            errors = describe_errors(exc)
        messages = [
            *messages,
            {"role": "assistant", "content": (text or "")[-12000:]},
            {"role": "user", "content": REPAIR_PROMPT.format(errors=errors)},
        ]
    raise DeckAnswerError("no valid answer after repairs", errors)
