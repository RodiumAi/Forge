"""The design tokens a deck may reference, read from the project's charter.

Slides reference colors as CSS custom properties (``--accent``) so changing the
theme restyles the whole deck. The model is told which tokens exist and every
answer is cleaned so it only uses them.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.document_scaffold import DESIGN_MD_PATH, DESIGN_SYSTEM_PATH
from app.services.filesystem import read_file

_TOKEN_LINE_RE = re.compile(r"`(--[A-Za-z0-9-]{1,48})`\s*:\s*([^\n]+)")
_HEX_RE = re.compile(r"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")

#: Always offered, even when the charter lists nothing (the scaffold defines them).
BASE_TOKENS = ("--bg", "--surface", "--fg", "--muted", "--accent", "--border")
FALLBACK_TEXT_TOKEN = "--fg"
FALLBACK_FILL_TOKEN = "--accent"

#: Keys whose value is a color reference in the slide contract.
_COLOR_KEYS = frozenset({"color", "fill", "stroke", "token", "overlay", "headerFill", "border"})


@dataclass
class DeckTheme:
    #: Token name (``--accent``) to its value (``#f2620a``) when known.
    colors: dict[str, str] = field(default_factory=dict)
    fonts: dict[str, str] = field(default_factory=dict)
    charter: str = ""

    @property
    def token_names(self) -> list[str]:
        names = list(self.colors)
        for base in BASE_TOKENS:
            if base not in names:
                names.append(base)
        return names

    def describe(self) -> str:
        lines = ["Theme tokens (use these names for every color):"]
        for name in self.token_names:
            value = self.colors.get(name)
            lines.append(f"- {name}" + (f": {value}" if value else ""))
        if self.fonts:
            lines.append("Fonts: " + ", ".join(f"{role} = {stack}" for role, stack in self.fonts.items()))
        return "\n".join(lines)


def _from_design_system(document: dict[str, Any], theme: DeckTheme) -> None:
    tokens = document.get("tokens") or {}
    for name, token in (tokens.get("color") or {}).items():
        if isinstance(token, dict) and "$value" in token and not name.startswith("$"):
            theme.colors[f"--{name}"] = str(token["$value"])
    for name, token in (tokens.get("font") or {}).items():
        if isinstance(token, dict) and "$value" in token and not name.startswith("$"):
            value = token["$value"]
            theme.fonts[name] = ", ".join(value) if isinstance(value, list) else str(value)


def load_theme(project_id: str) -> DeckTheme:
    theme = DeckTheme()
    try:
        document = json.loads(read_file(project_id, DESIGN_SYSTEM_PATH))
        if isinstance(document, dict):
            _from_design_system(document, theme)
    except (FileNotFoundError, ValueError):
        pass
    try:
        charter = read_file(project_id, DESIGN_MD_PATH)
    except (FileNotFoundError, ValueError):
        charter = ""
    theme.charter = charter[:6000]
    for name, value in _TOKEN_LINE_RE.findall(charter):
        theme.colors.setdefault(name, value.strip())
    return theme


def clean_colors(value: Any, theme: DeckTheme, *, key: str = "") -> Any:
    """Replace unknown token names and raw hex colors by theme tokens.

    The contract accepts hex colors, but a hex value does not follow the theme
    when it changes, so a model answer is mapped back to tokens.
    """
    if isinstance(value, dict):
        return {k: clean_colors(v, theme, key=k) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_colors(item, theme, key=key) for item in value]
    if key in _COLOR_KEYS and isinstance(value, str):
        if value.startswith("--"):
            return value if value in theme.token_names else _fallback(key)
        if _HEX_RE.match(value):
            for name, known in theme.colors.items():
                if known.lower() == value.lower():
                    return name
            return _fallback(key)
    return value


def _fallback(key: str) -> str:
    if key == "token":
        return "--bg"
    return FALLBACK_FILL_TOKEN if key in ("fill", "stroke", "overlay", "headerFill") else FALLBACK_TEXT_TOKEN
