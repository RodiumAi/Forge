"""GET /templates/{id}/detail: kind-specific content for the public template page."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import clear_settings_cache
from app.main import app
from app.services.templates import list_templates, template_detail


def _first(kind: str):
    kits = list_templates(kind=kind)
    assert kits, f"no {kind} kit in the catalogue"
    return kits[0]


def test_detail_per_kind():
    site = template_detail(_first("web").id)
    assert site is not None and site["kind"] == "web"
    assert isinstance(site["sections"], list)

    app_kit = template_detail(_first("mobile").id)
    assert app_kit is not None and app_kit["screens"]
    assert all(name[0].isupper() for name in app_kit["screens"])


def test_detail_codelab_and_design_system(monkeypatch):
    monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "true")
    monkeypatch.setenv("FORGE_KIND_DESIGN_SYSTEM_ENABLED", "true")
    clear_settings_cache()
    codelab = template_detail(_first("codelab").id)
    assert codelab is not None
    ids = [step["id"] for step in codelab["codelab"]["steps"]]
    assert ids and set(codelab["steps"]) <= set(ids)
    assert all(isinstance(text, str) and text for text in codelab["steps"].values())
    assert all(".." not in path for path in codelab["files"])

    ds = template_detail(_first("design_system").id)
    assert ds is not None and ds["design_system"]["tokens"]["color"]
    clear_settings_cache()


def test_detail_unknown_ids():
    assert template_detail("does-not-exist") is None
    assert template_detail("../etc") is None


def test_detail_endpoint(monkeypatch):
    monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "true")
    clear_settings_cache()
    client = TestClient(app)
    res = client.get(f"/templates/{_first('codelab').id}/detail")
    assert res.status_code == 200
    assert res.json()["codelab"]["steps"]
    assert "max-age" in res.headers.get("cache-control", "")
    assert client.get(f"/templates/{_first('web').id}/detail").status_code == 200
    assert client.get("/templates/nope-nope/detail").status_code == 404
    clear_settings_cache()


def test_detail_endpoint_hides_kits_behind_their_flag(monkeypatch):
    monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "false")
    clear_settings_cache()
    client = TestClient(app)
    assert client.get(f"/templates/{_first('codelab').id}/detail").status_code == 404
    clear_settings_cache()
