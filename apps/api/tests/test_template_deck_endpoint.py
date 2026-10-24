"""GET /templates/{id}/deck: the deck a gallery card plays on hover."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import clear_settings_cache
from app.contracts.forge_design import validate_deck, validate_slide
from app.main import app
from app.services.templates import list_templates, template_deck


def _first(kind: str):
    kits = list_templates(kind=kind)
    assert kits, f"no {kind} kit in the catalogue"
    return kits[0]


def test_template_deck_returns_valid_documents():
    kit = _first("slides")
    payload = template_deck(kit.id)
    assert payload is not None
    validate_deck(payload["deck"])
    ids = [ref["id"] for ref in payload["deck"]["slides"]]
    assert [s["id"] for s in payload["slides"]] == ids
    for slide in payload["slides"]:
        validate_slide(slide)
    assert isinstance(payload["design"], str) and payload["design"]


def test_template_deck_is_none_for_other_kinds_and_unknown_ids():
    assert template_deck(_first("web").id) is None
    assert template_deck("does-not-exist") is None
    assert template_deck("../etc") is None


def _with_slides_flag(monkeypatch, enabled: bool):
    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true" if enabled else "false")
    clear_settings_cache()


def test_template_deck_endpoint(monkeypatch):
    _with_slides_flag(monkeypatch, True)
    client = TestClient(app)
    kit = _first("slides")
    res = client.get(f"/templates/{kit.id}/deck")
    assert res.status_code == 200
    body = res.json()
    assert body["deck"]["slides"] and len(body["slides"]) == len(body["deck"]["slides"])
    assert "max-age" in res.headers.get("cache-control", "")
    assert client.get(f"/templates/{_first('web').id}/deck").status_code == 404
    assert client.get("/templates/nope-nope/deck").status_code == 404
    clear_settings_cache()


def test_template_deck_endpoint_hides_kits_behind_their_flag(monkeypatch):
    _with_slides_flag(monkeypatch, False)
    client = TestClient(app)
    res = client.get(f"/templates/{_first('slides').id}/deck")
    assert res.status_code == 404
    clear_settings_cache()
