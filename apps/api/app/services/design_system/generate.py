"""Model calls of the design system AI: one JSON spec, validated and repaired.

The model writes a compact spec (``tokens.Spec``), never W3C tokens: Forge
builds the tokens, checks the contrast pairs and repairs the ones that fail.
A broken answer is sent back with its errors for a bounded number of repairs,
the same loop as the slides AI, with image parts allowed in the request (a
logo, a website screenshot).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from app.config import get_settings
from app.services.deck_ai.jsonio import ModelJsonError, parse_json_object
from app.services.deck_ai.llm import describe_errors
from app.services.design_system.prompts import (
    GENERATE_SYSTEM,
    REPAIR,
    SECTION_FIELDS,
    SECTION_SYSTEM,
)
from app.services.design_system.tokens import Spec, check_spec, spec_from_document
from app.services.llm import complete_chat

MAX_REPAIRS = 2
MAX_TOKENS = 6000
MAX_BRIEF_CHARS = 8000


class DesignSystemAnswerError(ValueError):
    """No valid spec within the repair budget."""


@dataclass
class SpecAnswer:
    spec: Spec
    repairs: int


async def ask_spec(
    *,
    auth: Any,
    model: str,
    system: str,
    user: str,
    images: list[dict[str, Any]] | None = None,
    check: Callable[[dict[str, Any]], Spec],
    locale: str = "fr",
    max_repairs: int = MAX_REPAIRS,
) -> SpecAnswer:
    content: str | list[dict[str, Any]] = user
    if images:
        content = [{"type": "text", "text": user}, *images]
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": content},
    ]
    errors = ""
    for attempt in range(max_repairs + 1):
        text = await complete_chat(
            auth=auth,
            model=model,
            messages=messages,
            locale=locale,  # type: ignore[arg-type]
            temperature=0.5,
            max_tokens=MAX_TOKENS,
            reasoning_effort=get_settings().generation_effort,
        )
        try:
            return SpecAnswer(spec=check(parse_json_object(text)), repairs=attempt)
        except (ModelJsonError, ValidationError, ValueError, TypeError, KeyError) as exc:
            errors = describe_errors(exc)
        messages = [
            *messages,
            {"role": "assistant", "content": (text or "")[-12000:]},
            {"role": "user", "content": REPAIR.format(errors=errors)},
        ]
    raise DesignSystemAnswerError(errors or "no valid design system")


def generation_prompt(
    *,
    brief: str,
    project_name: str,
    current: dict[str, Any] | None,
    findings: str | None,
    has_logo_image: bool,
    conversation: str = "",
) -> str:
    parts = [f"Project name: {project_name}", f"Request:\n{brief.strip()[:MAX_BRIEF_CHARS]}"]
    if conversation:
        parts.append(conversation)
    if findings:
        parts.append(findings)
    if has_logo_image:
        parts.append(
            "The attached image is the brand logo: analyse its colours, contrast, geometry and mood, "
            "and build the palette and the type pairing from it."
        )
    if current is not None:
        spec = spec_from_document(current).model_dump()
        parts.append(
            "Current design system (keep what the request does not ask to change):\n"
            + json.dumps(spec, ensure_ascii=False)[:12000]
        )
    return "\n\n".join(parts)


async def generate_spec(
    *, auth: Any, model: str, user: str, images: list[dict[str, Any]], locale: str
) -> SpecAnswer:
    return await ask_spec(
        auth=auth,
        model=model,
        system=GENERATE_SYSTEM,
        user=user,
        images=images,
        check=check_spec,
        locale=locale,
    )


def section_checker(section: str, current: Spec) -> Callable[[dict[str, Any]], Spec]:
    """Merge the keys of ``section`` from the answer into ``current``; other keys are ignored."""
    fields = SECTION_FIELDS[section]

    def check(data: dict[str, Any]) -> Spec:
        body = data.get("designSystem") if isinstance(data.get("designSystem"), dict) else data
        if not any(key in body for key in fields):
            raise ValueError(f"the answer must contain {', '.join(fields)}")
        merged = current.model_dump()
        for key in fields:
            if key in body:
                value = body[key]
                if isinstance(value, dict) and isinstance(merged.get(key), dict) and key != "colors":
                    merged[key] = {**merged[key], **value}
                else:
                    merged[key] = value
        return Spec.model_validate(merged)

    return check


async def edit_section(
    *, auth: Any, model: str, section: str, document: dict[str, Any], request: str, locale: str
) -> SpecAnswer:
    current = spec_from_document(document)
    fields = SECTION_FIELDS[section]
    user = "\n\n".join(
        [
            "Design system (read-only context):\n"
            + json.dumps(current.model_dump(), ensure_ascii=False)[:12000],
            f"Section to change: {section} (keys: {', '.join(fields)})",
            "Current value of the section:\n"
            + json.dumps({key: current.model_dump()[key] for key in fields}, ensure_ascii=False),
            f"Request:\n{request.strip()[:MAX_BRIEF_CHARS]}",
        ]
    )
    return await ask_spec(
        auth=auth,
        model=model,
        system=SECTION_SYSTEM,
        user=user,
        check=section_checker(section, current),
        locale=locale,
    )
