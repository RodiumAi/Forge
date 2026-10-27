"""One set of slide layout names for the kits, the slides AI and the deck editor."""

from __future__ import annotations

import re
from pathlib import Path

from app.services.deck_ai.layouts import LAYOUT_ALIASES, LAYOUTS, describe_layout, normalize_layout
from app.services.templates import SLIDES_LAYOUTS

_EDITOR_LAYOUTS = Path(__file__).resolve().parents[2] / "web" / "components" / "deck-editor" / "layouts.ts"


def _editor_layout_names() -> list[str]:
    source = _EDITOR_LAYOUTS.read_text(encoding="utf-8")
    block = re.search(r"export const LAYOUT_NAMES = \[(.*?)\] as const;", source, re.S)
    assert block, "LAYOUT_NAMES not found in the deck editor layouts"
    return re.findall(r'"([a-z0-9-]+)"', block.group(1))


def test_kits_ai_and_editor_use_the_same_layout_names():
    assert set(SLIDES_LAYOUTS) == set(LAYOUTS)
    assert _editor_layout_names() == list(LAYOUTS)


def test_old_kit_names_map_to_the_current_layouts():
    assert normalize_layout("key-figures") == "key-numbers"
    assert normalize_layout("thank-you") == "thanks"
    assert normalize_layout("Thank you") == "thanks"
    assert all(target in LAYOUTS for target in LAYOUT_ALIASES.values())
    assert not set(LAYOUT_ALIASES) & set(LAYOUTS)


def test_an_old_kit_name_gets_its_own_grid():
    assert "Layout 'key-numbers'" in describe_layout("key-figures", "16:9")
    assert "Layout 'thanks'" in describe_layout("thank-you", "16:9")
    assert normalize_layout("not-a-layout") == "text"
