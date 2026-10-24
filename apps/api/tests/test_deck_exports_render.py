"""End to end: the fixture deck through the real bundle, Chromium and pptxgenjs.

Skipped when node, the deck runtime's node_modules or Chromium are missing
(install with ``npm ci`` in ``runtime`` and ``runtime/deck``, then
``python -m playwright install chromium``).
"""

from __future__ import annotations

import asyncio
import io
import re
import shutil
import zipfile
from functools import cache

import pytest
from deck_fixture import build_deck_project

from app.config import clear_settings_cache, get_settings
from app.services.exports.bundle import deck_runtime_dir, player_source_dir
from app.services.exports.deck_exports import export_deck


@cache
def _chromium_available() -> bool:
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            browser.close()
        return True
    except Exception:
        return False


def _runtime_ready() -> bool:
    deck = deck_runtime_dir()
    return (
        shutil.which("node") is not None
        and (deck / "node_modules" / "pptxgenjs").is_dir()
        and (deck.parent / "node_modules" / "esbuild").is_dir()
        and player_source_dir() is not None
    )


pytestmark = pytest.mark.skipif(not _runtime_ready(), reason="deck runtime (node, npm ci) not installed")


@pytest.fixture
def deck_project(project, monkeypatch):
    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
    clear_settings_cache()
    build_deck_project(get_settings().projects_path / project)
    yield project
    clear_settings_cache()


def _export(pid: str, fmt: str, **kwargs):
    return asyncio.run(export_deck(pid, fmt, name="Deck", lang="fr", **kwargs))


def _needs_chromium():
    if not _chromium_available():
        pytest.skip("Chromium not installed for Playwright")


def test_pdf_has_one_page_per_step_at_canvas_size(deck_project):
    _needs_chromium()
    result = _export(deck_project, "pdf", steps=True)
    assert result.data.startswith(b"%PDF")
    pages = re.findall(rb"/Type\s*/Page\b(?!s)", result.data)
    # s1: 2 steps, s2: 1, s3 (contract full slide): 2, s4: 1; hidden s5 left out.
    assert len(pages) == 6
    assert b"/MediaBox [0 0 1080 810]" in result.data  # 1440 x 1080 px in points
    plain = _export(deck_project, "pdf")
    assert len(re.findall(rb"/Type\s*/Page\b(?!s)", plain.data)) == 4


def test_png_zip_has_one_image_per_slide(deck_project):
    _needs_chromium()
    from PIL import Image

    result = _export(deck_project, "png")
    with zipfile.ZipFile(io.BytesIO(result.data)) as zf:
        names = sorted(zf.namelist())
        assert names == [f"slide-{i:03d}.png" for i in range(1, 5)]
        with Image.open(io.BytesIO(zf.read(names[1]))) as img:
            assert img.size == (1440, 1080)


def test_pptx_is_native_with_transitions_and_notes(deck_project):
    _needs_chromium()
    result = _export(deck_project, "pptx")
    zf = zipfile.ZipFile(io.BytesIO(result.data))
    names = zf.namelist()
    slides = sorted(n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n))
    assert len(slides) == 4
    pres = zf.read("ppt/presentation.xml").decode()
    assert 'cx="9144000"' in pres and 'cy="6858000"' in pres  # 1440 x 1080 px = 10 x 7.5 in
    s1 = zf.read("ppt/slides/slide1.xml").decode()
    s2 = zf.read("ppt/slides/slide2.xml").decode()
    assert "<p:fade/>" in s1 and "Rapport annuel 2026" in s1
    assert "<p159:morph" in s2 and "!!headline" in s2
    assert "<a:tbl>" in s2  # native table
    assert any(n.startswith("ppt/charts/chart") for n in names)  # native charts
    assert any(n.startswith("ppt/notesSlides/") for n in names)
    codes = {w["code"] for w in result.warnings}
    assert {
        "FONT_NOT_EMBEDDED",
        "RENDERED_AS_IMAGE",
        "TRANSITION_APPROXIMATED",
        "ANIMATIONS_NOT_EXPORTED",
    } <= codes


def test_single_file_html_plays_offline(deck_project, tmp_path):
    _needs_chromium()
    from playwright.sync_api import sync_playwright

    result = _export(deck_project, "html")
    page_file = tmp_path / "deck.html"
    page_file.write_bytes(result.data)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            # Offline: nothing but the file itself may load.
            context.route(
                "**/*",
                lambda route: route.continue_() if route.request.url.startswith("file:") else route.abort(),
            )
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(page_file.as_uri())
            page.wait_for_selector("[data-deck-player]", timeout=15_000)
            assert page.get_attribute("[data-deck-player]", "data-index") == "0"
            page.keyboard.press("ArrowRight")  # s1 has one click step
            page.keyboard.press("ArrowRight")
            page.wait_for_function("() => document.querySelector('[data-deck-player]').dataset.index === '1'")
            assert page.locator("[data-deck-player] img").count() > 0
            assert not errors
        finally:
            browser.close()
