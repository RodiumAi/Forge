"""POST /projects options of the Forge Design home: deck format and design system."""

from __future__ import annotations

import json

import pytest
from test_project_journey import EN, _build_client, _project, _user
from test_project_kinds import flags  # noqa: F401  (fixture)

from app.config import get_settings
from app.contracts import validate_deck, validate_slide
from app.services.document_scaffold import default_deck, scaffold_design_system


def _read(project_id: str, relative: str):
    return json.loads((get_settings().projects_path / project_id / relative).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("ratio", "width", "height"), [("16:9", 1920, 1080), ("4:3", 1440, 1080), ("1:1", 1080, 1080)]
)
def test_default_deck_fits_every_format(ratio, width, height):
    deck, slide = default_deck("Carrousel", ratio)
    validate_deck(deck)
    validate_slide(slide)
    assert deck["format"] == {"ratio": ratio, "width": width, "height": height}
    for element in slide["elements"]:
        assert element["x"] >= 0 and element["x"] + element["w"] <= width
        assert element["y"] >= 0 and element["y"] + element["h"] <= height


def test_unknown_ratio_falls_back_to_16_9():
    deck, _slide = default_deck("Deck", "21:9")
    assert deck["format"]["ratio"] == "16:9"


def test_slides_format_reaches_the_scaffold(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    flags("slides")
    r = client.post(
        "/projects", json={"name": "Carrousel", "platform": "slides", "format": "1:1"}, headers=EN
    )
    assert r.status_code == 201, r.text
    assert _read(r.json()["id"], "deck.json")["format"]["ratio"] == "1:1"


def test_slides_without_format_stay_16_9(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    flags("slides")
    r = client.post("/projects", json={"name": "Deck", "platform": "slides"}, headers=EN)
    assert r.status_code == 201, r.text
    assert _read(r.json()["id"], "deck.json")["format"]["ratio"] == "16:9"


def test_unknown_format_is_a_validation_error(monkeypatch, tmp_path_factory):
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    r = client.post("/projects", json={"name": "Deck", "platform": "web", "format": "21:9"}, headers=EN)
    assert r.status_code == 422


def test_format_is_ignored_for_other_kinds(monkeypatch, tmp_path_factory):
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    r = client.post("/projects", json={"name": "Site", "platform": "web", "format": "1:1"}, headers=EN)
    assert r.status_code == 201, r.text


def _design_system_project(user, monkeypatch, tmp_path_factory, flags):  # noqa: F811
    source = _project(user.id)
    source.platform = "design_system"
    client = _build_client(monkeypatch, tmp_path_factory, user=user, project=source, limit=5, plan="starter")
    flags("slides", "design_system")
    scaffold_design_system(str(source.id), "Marque Rodium")
    tokens = _read(str(source.id), "design-system.json")
    tokens["tokens"]["color"]["accent"]["$value"] = "#eb6118"
    (get_settings().projects_path / str(source.id) / "design-system.json").write_text(
        json.dumps(tokens), encoding="utf-8"
    )
    return client, source


def test_design_system_dresses_a_new_deck(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    client, source = _design_system_project(user, monkeypatch, tmp_path_factory, flags)
    r = client.post(
        "/projects",
        json={"name": "Pitch", "platform": "slides", "design_system_id": str(source.id)},
        headers=EN,
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert _read(pid, "deck.json")["theme"]["designSystem"] == str(source.id)
    design_md = (get_settings().projects_path / pid / "DESIGN.md").read_text(encoding="utf-8")
    assert "#eb6118" in design_md
    assert "Marque Rodium" in design_md


def test_design_system_must_be_a_design_system_project(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    source = _project(user.id)  # a web project
    client = _build_client(monkeypatch, tmp_path_factory, user=user, project=source, limit=5, plan="starter")
    flags("slides")
    r = client.post(
        "/projects",
        json={"name": "Pitch", "platform": "slides", "design_system_id": str(source.id)},
        headers=EN,
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "NOT_A_DESIGN_SYSTEM"


def test_someone_elses_design_system_is_not_found(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    stranger = _project(_user().id)
    stranger.platform = "design_system"
    client = _build_client(
        monkeypatch, tmp_path_factory, user=user, project=stranger, limit=5, plan="starter"
    )
    flags("slides", "design_system")
    r = client.post(
        "/projects",
        json={"name": "Pitch", "platform": "slides", "design_system_id": str(stranger.id)},
        headers=EN,
    )
    assert r.status_code == 404
