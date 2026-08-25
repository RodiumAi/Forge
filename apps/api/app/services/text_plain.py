"""Normalize assistant-facing copy: plain text, no emoji, no markdown."""

from __future__ import annotations

import html
import re
from typing import Any

from app.i18n import Locale

# Broad emoji / symbol pictographs (incl. variation selectors / ZWJ sequences leftovers).
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "\U0001F000-\U0001F02F"
    "\U0001F0A0-\U0001F0FF"
    "\U0001F100-\U0001F1FF"
    "\U0001F200-\U0001F2FF"
    "\U0000FE0F"
    "\U0000200D"
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
    """Deterministic plain confirmation — never reuse LLM marketing prose."""
    done_titles = [
        str(t.get("title") or "").strip()
        for t in (tasks or [])
        if str(t.get("status") or "") in ("done", "pending", "running", "")
        and str(t.get("title") or "").strip()
    ]
    # Prefer completed tasks; if statuses missing, keep all titles.
    completed = [
        str(t.get("title") or "").strip()
        for t in (tasks or [])
        if str(t.get("status") or "") == "done" and str(t.get("title") or "").strip()
    ]
    titles = completed or done_titles
    file_count = len(applied or [])

    if locale == "fr":
        lines = ["Voici ce qui a été mis en place."]
        for title in titles[:8]:
            lines.append(f"- {to_plain_text(title)}")
        if file_count:
            lines.append(f"{file_count} fichier(s) mis à jour.")
        return "\n".join(lines)

    lines = ["Here is what was put in place."]
    for title in titles[:8]:
        lines.append(f"- {to_plain_text(title)}")
    if file_count:
        lines.append(f"{file_count} file(s) updated.")
    return "\n".join(lines)
