from __future__ import annotations

import pytest

from app.services import integrations as integ


@pytest.fixture(autouse=True)
def _fresh_cache():
    integ.clear_integrations_cache()
    yield
    integ.clear_integrations_cache()


def test_parse_marker_reads_ids_in_both_languages():
    assert integ.parse_integrations_marker(
        "[Intégrations : Google Maps Embed (google-maps), Tally (tally)]\n\nAjoute la carte"
    ) == ["google-maps", "tally"]
    assert integ.parse_integrations_marker("[Integrations: Tally (tally), Tally (tally)]") == ["tally"]
    assert integ.parse_integrations_marker("no marker here") == []


def test_block_carries_the_guide_and_the_missing_snippet_rule():
    block = integ.format_selected_integrations_block(
        "[Integrations: Google Maps Embed (google-maps)]\n\nadd a map"
    )
    assert 'id="google-maps"' in block
    assert "never invent an id" in block
    assert "placeholder" in block
    assert "maps/embed" in block  # the guide body itself


def test_unknown_ids_are_ignored():
    assert integ.format_selected_integrations_block("[Integrations: Nope (not-a-real-one)]") == ""


def test_embed_hosts_come_from_the_guide_snippets():
    maps = integ.get_integration("google-maps")
    assert maps is not None
    assert integ.embed_hosts(maps) == ("google.com",)
    assert integ._registrable("outlook.office365.com") == "office365.com"
    assert integ._registrable("shop.example.co.uk") == "example.co.uk"
