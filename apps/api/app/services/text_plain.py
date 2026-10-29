"""Normalize assistant-facing copy: plain text, no emoji, no markdown."""

from __future__ import annotations

import html
import re
from typing import Any

from app.i18n import Locale

# Broad emoji / symbol pictographs (incl. variation selectors / ZWJ sequences leftovers).
_EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f9ff"
    "\U0001fa00-\U0001faff"
    "\U00002600-\U000026ff"
    "\U00002700-\U000027bf"
    "\U0001f000-\U0001f02f"
    "\U0001f0a0-\U0001f0ff"
    "\U0001f100-\U0001f1ff"
    "\U0001f200-\U0001f2ff"
    "\U0000fe0f"
    "\U0000200d"
    "]+",
    flags=re.UNICODE,
)
_MD_BOLD_RE = re.compile(r"(\*\*|__)(.*?)\1")
_MD_ITALIC_RE = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)")
_MD_CODE_RE = re.compile(r"`([^`]+)`")
_MD_HEADING_RE = re.compile(r"^#{1,6}\s+", re.M)
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MD_BULLET_RE = re.compile(r"^\s*[-*+]\s+", re.M)
_MD_NUMBERED_RE = re.compile(r"^\s*\d+\.\s+", re.M)
_MULTI_BLANK_RE = re.compile(r"\n{3,}")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def to_plain_text(raw: str | None) -> str:
    """Strip emoji + markdown chrome; keep readable line breaks and dashes."""
    if not raw:
        return ""
    text = html.unescape(str(raw))
    text = _EMOJI_RE.sub("", text)
    text = _MD_LINK_RE.sub(r"\1", text)
    text = _MD_BOLD_RE.sub(r"\2", text)
    text = _MD_ITALIC_RE.sub(lambda m: m.group(1) or m.group(2) or "", text)
    text = _MD_CODE_RE.sub(r"\1", text)
    text = _MD_HEADING_RE.sub("", text)
    text = _MD_BULLET_RE.sub("- ", text)
    # Keep numbered lists as "- " for a calmer scan (non-dev audience).
    text = _MD_NUMBERED_RE.sub("- ", text)
    text = text.replace("**", "").replace("__", "").replace("*", "")
    text = _MULTI_SPACE_RE.sub(" ", text)
    text = _MULTI_BLANK_RE.sub("\n\n", text)
    lines = [ln.rstrip() for ln in text.splitlines()]
    return "\n".join(lines).strip()


def build_run_summary(
    *,
    tasks: list[dict[str, Any]] | None,
    applied: list[dict[str, Any]] | None,
    locale: Locale = "fr",
) -> str:
    """Deterministic plain confirmation — never reuse LLM marketing prose.

    Only completed tasks are listed. When the plan carries statuses and none of
    them is `done`, the summary says nothing was built instead of listing the
    planned titles: a plan stopped on its first task used to read
    "Here is what was put in place" followed by eight steps that never ran.
    """
    task_list = [t for t in (tasks or []) if str(t.get("title") or "").strip()]
    completed = [str(t.get("title") or "").strip() for t in task_list if str(t.get("status") or "") == "done"]
    has_statuses = any(str(t.get("status") or "") for t in task_list)
    # A plan without any status at all predates status tracking: keep its titles.
    titles = completed if has_statuses else [str(t.get("title") or "").strip() for t in task_list]
    file_count = len(applied or [])
    nothing_done = bool(task_list) and not titles

    if locale == "fr":
        if nothing_done:
            head = "Aucune étape du plan n'a abouti, rien n'a été construit."
            if file_count:
                head = "Aucune étape du plan n'a abouti."
            lines = [head]
        else:
            lines = ["Voici ce qui a été mis en place."]
        for title in titles[:8]:
            lines.append(f"- {to_plain_text(title)}")
        if file_count:
            lines.append(f"{file_count} fichier(s) mis à jour.")
        return "\n".join(lines)

    if nothing_done:
        head = "No plan step completed; nothing was built."
        if file_count:
            head = "No plan step completed."
        lines = [head]
    else:
        lines = ["Here is what was put in place."]
    for title in titles[:8]:
        lines.append(f"- {to_plain_text(title)}")
    if file_count:
        lines.append(f"{file_count} file(s) updated.")
    return "\n".join(lines)
