"""Contract tests for data/integrations kits (enforced by CI)."""

from __future__ import annotations

import json
import re

import pytest

from app.services.integrations import (
    clear_integrations_cache,
    get_integration,
    guide_path,
    list_integrations,
    logo_path,
)

# Drop-in static embeds only (iframe / script / link). No partials, no SDK-only kits.
EXPECTED_IDS = {
    "airtable",
    "baserow",
    "beehiiv",
    "brevo",
    "cal-com",
    "calendly",
    "chatbase",
    "chatbot-com",
    "common-ninja",
    "crisp",
    "disqus",
    "ecwid",
    "elfsight",
    "giscus",
    "google-analytics",
    "google-forms",
    "google-maps",
    "google-sheets",
    "gumroad",
    "jotform",
    "kit",
    "lemon-squeezy",
    "mailchimp",
    "microsoft-bookings",
    "nocodb",
    "openstreetmap",
    "paypal",
    "plausible",
    "posthog",
    "powr",
    "savvycal",
    "shopify-buy-button",
    "snipcart",
    "soundcloud",
    "spotify",
    "substack",
    "tally",
    "tawk-to",
    "tidio",
    "tidycal",
    "typeform",
    "umami",
    "vimeo",
    "voiceflow",
    "youtube",
}

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
_HEADING_RE = re.compile(r"^#{1,3}\s+", re.M)
_EMBED_METHODS = frozenset({"iframe", "script", "link"})


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_integrations_cache()
    yield
    clear_integrations_cache()


def test_all_kits_are_listed():
    assert {m.id for m in list_integrations()} == EXPECTED_IDS


def test_every_kit_ships_the_full_contract():
    from app.services.integrations import integrations_root

    root = integrations_root()
    assert root.is_dir(), f"integrations root missing: {root}"

    for tid in sorted(EXPECTED_IDS):
        folder = root / tid
        assert folder.is_dir(), f"missing folder {tid}"
        meta_path = folder / "integration.json"
        assert meta_path.is_file(), tid
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        assert data.get("id") == tid
        assert _ID_RE.match(tid)
        assert data.get("name")
        assert isinstance(data.get("categories"), list) and data["categories"]
        assert data.get("access") == "yes"
        methods = data.get("methods") or []
        assert isinstance(methods, list) and methods
        assert _EMBED_METHODS.intersection(methods), f"{tid} needs iframe/script/link"
        assert data.get("docsUrl")
        logo = data.get("logo") or "logo.svg"
        assert (folder / logo).is_file(), f"{tid} missing logo"
        assert (folder / "guide.en.md").is_file()
        assert (folder / "guide.fr.md").is_file()


def test_guides_have_headings_and_no_raw_script_tags():
    from app.services.integrations import integrations_root

    root = integrations_root()
    for tid in sorted(EXPECTED_IDS):
        for locale in ("en", "fr"):
            path = root / tid / f"guide.{locale}.md"
            text = path.read_text(encoding="utf-8")
            assert _HEADING_RE.search(text), f"{tid} guide.{locale}.md needs a heading"
            # Allow <script> only inside fenced code blocks.
            outside = re.sub(r"```[\s\S]*?```", "", text)
            assert "<script" not in outside.lower(), f"{tid} guide.{locale}.md has raw <script>"


def test_logo_and_detail_resolve():
    meta = get_integration("tally")
    assert meta is not None
    assert logo_path("tally") is not None
    assert guide_path("tally", "fr") is not None


def test_category_and_query_filters():
    forms = list_integrations(category="forms")
    assert forms
    assert all("forms" in m.categories for m in forms)
    tallies = list_integrations(q="tally")
    assert {m.id for m in tallies} == {"tally"}
    # Catalog is drop-in only — no partial kits.
    assert list_integrations(access="partial") == []
    assert all(m.access == "yes" for m in list_integrations())


def test_http_locale_switches_title_and_guide_and_varies():
    """Accept-Language must change body + be listed in Vary (browser/CDN cache)."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)

    fr = client.get("/integrations", headers={"Accept-Language": "fr"})
    en = client.get("/integrations", headers={"Accept-Language": "en"})
    assert fr.status_code == 200 and en.status_code == 200
    assert "accept-language" in (fr.headers.get("vary") or "").lower()
    assert "accept-language" in (en.headers.get("vary") or "").lower()

    fr_tally = next(item for item in fr.json() if item["id"] == "tally")
    en_tally = next(item for item in en.json() if item["id"] == "tally")
    assert fr_tally["blurb"] != en_tally["blurb"]
    assert "formulaire" in fr_tally["blurb"].lower()
    assert "embed" in en_tally["blurb"].lower()

    fr_detail = client.get("/integrations/tally", headers={"Accept-Language": "fr"})
    en_detail = client.get("/integrations/tally", headers={"Accept-Language": "en"})
    assert fr_detail.status_code == 200 and en_detail.status_code == 200
    assert "accept-language" in (fr_detail.headers.get("vary") or "").lower()
    assert fr_detail.json()["guide_md"] != en_detail.json()["guide_md"]
    assert fr_detail.json()["guide_md"].strip()
    assert en_detail.json()["guide_md"].strip()

    fr_guide = client.get("/integrations/tally/guide", headers={"Accept-Language": "fr"})
    en_guide = client.get("/integrations/tally/guide", headers={"Accept-Language": "en"})
    assert fr_guide.status_code == 200 and en_guide.status_code == 200
    assert "accept-language" in (fr_guide.headers.get("vary") or "").lower()
    assert fr_guide.text != en_guide.text
