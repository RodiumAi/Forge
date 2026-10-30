"""Deck fonts: the assistant changes the theme fonts, and says so only when something changed."""

from __future__ import annotations

import json

import pytest

from app.services.deck_ai import flow, store
from app.services.deck_ai import llm as deck_llm
from app.services.deck_ai.fonts import _patch_markdown, check_fonts, fonts_summary
from app.services.design_system.tokens import font_names, known_font
from app.services.filesystem import read_file
from tests.test_deck_ai import ctx, deck, events_of, run_log, script, two_slides  # noqa: F401


def test_check_fonts_keeps_known_families_by_role():
    assert check_fonts(None) is None
    assert check_fonts({"display": "open sauce sans", "body": "Inter"}) == {
        "display": "Open Sauce Sans",
        "body": "Inter",
    }
    with pytest.raises(ValueError):
        check_fonts({"display": "Comic Papyrus"})
    with pytest.raises(ValueError):
        check_fonts({"title": "Inter"})


def test_catalog_offers_many_families():
    names = font_names()
    assert len(names) >= 90
    assert known_font("roboto") == "Roboto"
    assert known_font("Open Sauce Sans") == "Open Sauce Sans"


def test_patch_markdown_rewrites_lines_and_variables():
    text = "# Theme\n\nDisplay font: Inter\n\n--font-display: Inter, sans-serif;\n--font-sans: Inter, sans-serif;\n"
    out = _patch_markdown(text, {"display": "Lora", "body": "Open Sauce Sans"})
    assert "Display font: Lora" in out and "Display font: Inter" not in out
    assert "Body font: Open Sauce Sans" in out
    assert "--font-display: " in out and "Lora" in out.split("--font-display:")[1].split(";")[0]
    assert "Open Sauce Sans" in out.split("--font-sans:")[1].split(";")[0]


def test_fonts_summary_names_the_families():
    assert fonts_summary({"display": "Lora", "body": "Lora"}, "fr") == "Police de la présentation : Lora."


class TestDeckFonts:
    async def test_a_font_only_edit_rewrites_the_theme(self, two_slides, monkeypatch, run_log):  # noqa: F811
        before = read_file(two_slides, "slides/s2.json")
        calls = script(
            monkeypatch,
            {
                "order": ["s1", "s2"],
                "slides": [],
                "fonts": {"display": "Open Sauce Sans", "body": "Open Sauce Sans"},
            },
        )
        events = await events_of(
            flow.document_stream(ctx(two_slides, prompt="Mets toute la police en Open Sauce"))
        )
        assert "Open Sauce Sans" in calls[0][0]["content"] + calls[0][1]["content"]
        written = [e["path"] for e in events if e["type"] == "file_write" and e["path"] != "deck.json"]
        assert written, events
        for path in written:
            assert "Open Sauce Sans" in read_file(two_slides, path)
        assert read_file(two_slides, "slides/s2.json") == before
        assert run_log["finished"]["summary"] == "Police de la présentation : Open Sauce Sans."

    async def test_an_edit_that_changes_nothing_says_so(self, two_slides, monkeypatch, run_log):  # noqa: F811
        script(monkeypatch, {"order": ["s1", "s2"], "slides": []})
        await events_of(flow.document_stream(ctx(two_slides, prompt="Rends ça plus beau")))
        assert run_log["finished"]["summary"].startswith("Aucune modification")

    async def test_the_planned_path_applies_fonts_without_rewriting_slides(
        self,
        two_slides,
        monkeypatch,
        run_log,  # noqa: F811
    ):
        monkeypatch.setattr(flow, "MAX_ONE_SHOT_DECK_CHARS", 10)
        deck_before = json.dumps(store.read_deck(two_slides), sort_keys=True)

        async def fake(*, messages, **_kwargs):
            assert "Deck outline:" in messages[1]["content"]
            return json.dumps({"order": ["s1", "s2"], "change": [], "fonts": {"body": "Lora"}})

        monkeypatch.setattr(deck_llm, "complete_chat", fake)
        events = await events_of(flow.document_stream(ctx(two_slides, prompt="Texte en Lora")))
        assert json.dumps(store.read_deck(two_slides), sort_keys=True) == deck_before
        assert not [e for e in events if e["type"] == "deck.slide"]
        assert any(e["type"] == "file_write" for e in events)
        assert run_log["finished"]["summary"] == "Police de la présentation : Lora."
