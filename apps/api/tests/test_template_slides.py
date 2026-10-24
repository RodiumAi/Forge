"""Slides kits (``kind: "slides"``): documents rendered by the Forge player.

Every kit must validate against the Forge Design contract, provide one example
slide per required layout, ship its images with credits, stay under the size
budget and fork into a valid slides project.
"""

from __future__ import annotations

import json
import re

import pytest

from app.config import clear_settings_cache, get_settings
from app.contracts.forge_design import validate_deck, validate_slide
from app.services.brand_charter import GOOGLE_FONTS
from app.services.templates import SLIDES_LAYOUTS, fork_template, get_template, list_templates

MAX_KIT_BYTES = 3 * 1024 * 1024
LONG_DASH = chr(0x2014)
REQUIRED_FILES = ("template.json", "DESIGN.md", "deck.json", "preview.html")


def _kits():
    return list_templates(kind="slides")


def _read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _walk(elements):
    for element in elements:
        yield element
        if element.get("type") == "group":
            yield from _walk(element["children"])


def _lucide_icons() -> set[str]:
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "runtime" / "lucide_exports.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    names = data if isinstance(data, list) else data.get("exports", [])
    split = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])")
    return {split.sub("-", name).lower() for name in names}


def test_slides_kits_are_listed():
    assert len(_kits()) >= 6


@pytest.mark.parametrize("kit", _kits(), ids=lambda kit: kit.id)
class TestSlidesKit:
    def test_ships_the_document_files(self, kit):
        assert kit.id.startswith("slides-")
        for rel in REQUIRED_FILES:
            assert (kit.path / rel).is_file(), f"{kit.id} misses {rel}"
        assert not (kit.path / "package.json").exists()

    def test_deck_and_slides_validate_against_the_contract(self, kit):
        deck = validate_deck(_read_json(kit.path / "deck.json"))
        assert 8 <= len(deck.slides) <= 12
        ids = {ref.id for ref in deck.slides}
        files = {p.stem for p in (kit.path / "slides").glob("*.json")}
        assert files == ids, f"{kit.id}: slide files and deck.json disagree"
        for ref in deck.slides:
            slide = validate_slide(_read_json(kit.path / "slides" / f"{ref.id}.json"))
            assert slide.id == ref.id
            assert (kit.path / "notes" / f"{ref.id}.md").is_file(), f"{kit.id} misses notes/{ref.id}.md"

    def test_every_required_layout_is_used(self, kit):
        deck = _read_json(kit.path / "deck.json")
        used = {ref["layout"] for ref in deck["slides"]}
        assert set(SLIDES_LAYOUTS) <= used, f"{kit.id} misses {set(SLIDES_LAYOUTS) - used}"
        # template.json maps each layout to its example slide.
        layouts = _read_json(kit.path / "template.json")["layouts"]
        by_id = {ref["id"]: ref["layout"] for ref in deck["slides"]}
        assert set(layouts) == set(SLIDES_LAYOUTS)
        for layout, slide_id in layouts.items():
            assert by_id.get(slide_id) == layout, f"{kit.id}: {layout} -> {slide_id}"

    def test_assets_exist_and_images_are_credited(self, kit):
        icons = _lucide_icons()
        for path in (kit.path / "slides").glob("*.json"):
            slide = _read_json(path)
            background = slide.get("background") or {}
            if background.get("type") == "image":
                assert (kit.path / background["src"]).is_file(), background["src"]
                assert background.get("credit"), f"{kit.id}/{path.name} background has no credit"
            for element in _walk(slide["elements"]):
                if element["type"] == "image":
                    assert element["src"].startswith("public/images/")
                    assert element["src"].endswith(".webp")
                    assert (kit.path / element["src"]).is_file(), element["src"]
                    credit = element.get("credit") or {}
                    assert credit.get("source") and credit.get("author"), f"{kit.id} {element['id']}"
                if element["type"] == "icon":
                    assert element["icon"] in icons, f"{kit.id}: unknown lucide icon {element['icon']}"

    def test_theme_tokens_and_fonts_come_from_design_md(self, kit):
        design = (kit.path / "DESIGN.md").read_text(encoding="utf-8")
        defined = set(re.findall(r"- `(--[a-z0-9-]+)`: #[0-9A-Fa-f]{6}", design))
        assert {"--bg", "--surface", "--fg", "--muted", "--accent", "--border"} <= defined
        for path in (kit.path / "slides").glob("*.json"):
            used = set(re.findall(r'"(--[a-z0-9-]+)"', path.read_text(encoding="utf-8")))
            assert used <= defined, f"{kit.id}/{path.name} uses undefined tokens {used - defined}"
        fonts = re.findall(r"- (?:Display|Body|Mono) font: (.+)", design)
        assert len(fonts) == 3
        for family in fonts:
            assert family.strip() in GOOGLE_FONTS, f"{kit.id}: {family} is not a curated Google Font"

    def test_stays_light_static_and_dash_free(self, kit):
        size = sum(p.stat().st_size for p in kit.path.rglob("*") if p.is_file())
        assert size < MAX_KIT_BYTES, f"{kit.id} weighs {size} bytes"
        preview = (kit.path / "preview.html").read_text(encoding="utf-8")
        assert "<script" not in preview.lower()
        assert re.findall(r"https?://", preview) == [], f"{kit.id} preview loads remote content"
        for path in kit.path.rglob("*"):
            if path.suffix in (".json", ".md", ".html"):
                assert LONG_DASH not in path.read_text(encoding="utf-8"), f"{path} has a long dash"


@pytest.fixture
def projects_tmp(monkeypatch, tmp_path):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path))
    clear_settings_cache()
    yield tmp_path
    clear_settings_cache()


def test_forking_a_slides_kit_gives_a_valid_slides_project(projects_tmp):
    meta = fork_template("slides-pitch-startup", "deck-project", "Ma levée de fonds")
    assert meta.kind == "slides"
    dest = get_settings().projects_path / "deck-project"
    deck = validate_deck(_read_json(dest / "deck.json"))
    assert deck.title == "Ma levée de fonds"
    for ref in deck.slides:
        validate_slide(_read_json(dest / "slides" / f"{ref.id}.json"))
        assert (dest / "notes" / f"{ref.id}.md").is_file()
    assert any((dest / "public" / "images").glob("*.webp"))
    assert (dest / "DESIGN.md").is_file()
    # Authoring metadata leaves the project; the origin is kept for the agent.
    assert not (dest / "template.json").exists()
    origin = _read_json(dest / ".forge" / "template.json")
    assert origin["id"] == "slides-pitch-startup" and origin["kind"] == "slides"
    # A document project gets no React scaffolding.
    assert not (dest / "package.json").exists()
    assert not (dest / "index.html").exists()


def test_a_broken_slides_kit_is_not_listed(monkeypatch, tmp_path):
    kit = tmp_path / "slides-broken"
    kit.mkdir()
    (kit / "template.json").write_text(json.dumps({"id": "slides-broken", "kind": "slides"}), encoding="utf-8")
    monkeypatch.setenv("TEMPLATES_ROOT", str(tmp_path))
    clear_settings_cache()
    try:
        assert get_template("slides-broken") is None
        (kit / "deck.json").write_text("{}", encoding="utf-8")
        (kit / "slides").mkdir()
        assert get_template("slides-broken") is not None
    finally:
        clear_settings_cache()


@pytest.mark.parametrize("name", ["", "   ", None, "New project", "Nouveau projet", "nouveau PROJET "])
def test_a_generic_project_name_keeps_the_kit_deck_title(projects_tmp, name):
    kit_title = _read_json(get_template("slides-pitch-startup").path / "deck.json")["title"]
    fork_template("slides-pitch-startup", "deck-generic", name)
    deck = _read_json(get_settings().projects_path / "deck-generic" / "deck.json")
    assert deck["title"] == kit_title
