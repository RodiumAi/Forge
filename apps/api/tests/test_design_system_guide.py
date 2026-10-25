"""The brand guidelines exports: Markdown guide, print HTML for the PDF, brand facts in the contract."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from app.contracts.forge_design import validate_design_system
from app.services.design_system.exports import text_export
from app.services.design_system.guide import brand_guide_html, brand_guide_md
from app.services.design_system.tokens import Spec, apply_section, build_document, spec_from_document

SCHEMA = Path(__file__).resolve().parents[3] / "contracts" / "forge-design" / "design-system.schema.json"

SPEC = {
    "name": "Verdant",
    "description": "Fintech for small farms. Calm, trustworthy, warm.",
    "brand": {
        "tagline": "Money that grows with the season.",
        "website": "https://verdant.example",
        "audience": "Family farms with fewer than ten people.",
    },
    "colors": {
        "bg": "#fbfaf7",
        "surface": "#ffffff",
        "fg": "#1d2420",
        "muted": "#5f6b64",
        "accent": "#1f7a4d",
        "border": "#e3e0d8",
    },
    "fonts": {"display": "Fraunces", "body": "Inter", "mono": "JetBrains Mono"},
    "type": {"base": 17, "ratio": 1.2},
    "logo": {"clearSpace": "Half the logo height", "minSizePx": 32, "misuse": ["Never stretch it"]},
    "voice": {"summary": "Plain and warm.", "do": ["Short sentences"], "dont": ["Jargon"]},
    "imagery": {"summary": "Natural light photos.", "do": ["Real farms"], "dont": ["Stock handshakes"]},
    "guidelines": {"summary": "Clarity first.", "do": ["One accent per screen"], "dont": ["Gradients"]},
}

LOGO = "public/brand/logo.svg"
DARK = "public/brand/logo-dark.svg"
ICON = "public/brand/logo-icon.svg"


def _document(*, icon: bool = True) -> dict:
    document, _ = build_document(
        Spec.model_validate(SPEC), logo_src=LOGO, logo_dark_src=DARK, logo_icon_src=ICON if icon else None
    )
    return document


def _asset(path: str) -> str:
    return f"https://assets.test/{path}"


def _html(document: dict, lang: str = "fr", badge: bool = True) -> str:
    return brand_guide_html(
        document,
        asset_url=_asset,
        lang=lang,
        badge=badge,
        remote_fonts=False,
        now=datetime(2026, 10, 1, tzinfo=UTC),
    )


def _pages(html: str) -> list[str]:
    return re.findall(r'data-page="([a-z_]+)"', html)


# ── contract ───────────────────────────────────────────────────────────────


def test_brand_facts_and_icon_land_in_a_valid_document():
    document = _document()
    assert document["brand"] == SPEC["brand"]
    assert document["logo"]["iconSrc"] == ICON and document["logo"]["darkSrc"] == DARK
    validate_design_system(document)
    assert not list(
        Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8"))).iter_errors(document)
    )


def test_old_documents_without_brand_still_validate():
    document = _document(icon=False)
    document.pop("brand")
    document["logo"].pop("darkSrc")
    assert "iconSrc" not in document["logo"]
    validate_design_system(document)
    assert not list(
        Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8"))).iter_errors(document)
    )


def test_an_http_website_is_rejected():
    document = _document()
    document["brand"]["website"] = "http://verdant.example"
    with pytest.raises(ValidationError):
        validate_design_system(document)
    assert list(Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8"))).iter_errors(document))


def test_the_spec_drops_what_is_not_a_fact():
    spec = Spec.model_validate(
        {**SPEC, "brand": {"tagline": "", "website": "verdant.example", "audience": ""}}
    )
    document, _ = build_document(spec)
    assert "brand" not in document  # nothing given, nothing invented
    assert spec.brand.website == ""


def test_brand_and_icon_survive_the_round_trip_and_a_logo_edit():
    document = _document()
    spec = spec_from_document(document)
    assert spec.brand.tagline == SPEC["brand"]["tagline"]
    changed = Spec.model_validate({**SPEC, "logo": {**SPEC["logo"], "minSizePx": 40}})
    edited, _ = apply_section(document, "logo", changed)
    assert edited["logo"]["iconSrc"] == ICON and edited["brand"] == SPEC["brand"]


# ── Markdown ───────────────────────────────────────────────────────────────


def test_markdown_guide_follows_the_guidelines_outline():
    md = brand_guide_md(_document(), "fr")
    assert md.startswith("# Verdant: Charte graphique")
    assert "*Money that grows with the season.*" in md and "https://verdant.example" in md
    headings = re.findall(r"^## \d+\. (.+)$", md, flags=re.M)
    for title in ("Le logo", "L'icône d'application", "Couleurs", "Typographie", "Ton de voix", "Fichiers"):
        assert title in headings
    assert headings.index("Le logo") < headings.index("Couleurs") < headings.index("Typographie")
    assert "#1F7A4D" in md and "Never stretch it" in md and "Gradients" in md
    assert "\u2014" not in md


def test_markdown_guide_in_english_and_without_icon():
    md = brand_guide_md(_document(icon=False), "en")
    assert md.startswith("# Verdant: Brand guidelines")
    headings = re.findall(r"^## \d+\. (.+)$", md, flags=re.M)
    assert "The logo" in headings and "Typography" in headings
    assert "The app icon" not in headings


def test_markdown_export_is_named_after_the_guidelines():
    export = text_export(_document(), "md", lang="en")
    assert export.filename == "verdant-brand-guidelines.md"
    assert export.body.decode("utf-8").startswith("# Verdant: Brand guidelines")


# ── print HTML ─────────────────────────────────────────────────────────────


def test_print_html_has_one_page_per_topic():
    html = _html(_document())
    pages = _pages(html)
    assert pages[:3] == ["cover", "intro", "logo"]
    for key in ("backgrounds", "clear", "donts", "app_icon", "colour", "typography", "files"):
        assert key in pages
    assert pages[-1] == "files" and len(pages) == len(set(pages))
    assert "@page{size:297mm 210mm" in html and "page-break-after:always" in html
    assert "Charte graphique" in html and "Fait avec Forge" in html
    assert _asset(ICON) in html and _asset(DARK) in html
    assert "\u2014" not in html


def test_print_html_skips_the_icon_page_and_the_badge():
    html = _html(_document(icon=False), lang="en", badge=False)
    assert "app_icon" not in _pages(html)
    assert "Brand guidelines" in html and "Charte graphique" not in html
    assert "badge-forge" not in html.split("</style>", 1)[1]
