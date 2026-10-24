"""Kind registry: web and mobile unchanged, document kinds dark behind flags."""

from __future__ import annotations

import json
import typing

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_project_journey import EN, _build_client, _user

from app.config import clear_settings_cache, get_settings
from app.contracts import validate_codelab, validate_deck, validate_design_system, validate_slide
from app.kinds import (
    KIND_IDS,
    KindId,
    all_kinds,
    get_kind,
    kind_enabled,
    react_kind,
    react_kind_ids,
    resolve_kind,
)
from app.prompts.system import MOBILE_PLATFORM_RULES, SYSTEM_PROMPT, system_prompt_with_design
from app.routers import kinds as kinds_router
from app.routers import templates as templates_router
from app.services.document_scaffold import scaffold_codelab, scaffold_design_system, scaffold_slides

FLAGS = {
    "slides": "FORGE_KIND_SLIDES_ENABLED",
    "codelab": "FORGE_KIND_CODELAB_ENABLED",
    "design_system": "FORGE_KIND_DESIGN_SYSTEM_ENABLED",
}


@pytest.fixture
def flags(monkeypatch):
    """Turn document kinds on for one test: ``flags("slides")``."""

    def enable(*kind_ids: str) -> None:
        for kind_id in kind_ids:
            monkeypatch.setenv(FLAGS[kind_id], "true")
        clear_settings_cache()

    yield enable
    clear_settings_cache()


def test_registry_matches_the_kind_literal():
    assert typing.get_args(KindId) == KIND_IDS
    assert [kind.id for kind in all_kinds()] == list(KIND_IDS)
    assert react_kind_ids() == ("web", "mobile")


def test_web_and_mobile_are_always_on_and_document_kinds_ship_dark():
    clear_settings_cache()
    assert kind_enabled("web") and kind_enabled("mobile")
    for kind_id in FLAGS:
        assert not kind_enabled(kind_id), kind_id
        assert get_kind(kind_id).engine == "document"
        assert get_kind(kind_id).flag
    assert not kind_enabled("diagram")


def test_resolution_falls_back_to_web():
    assert resolve_kind("mobile") == "mobile"
    assert resolve_kind(" Slides ") == "slides"
    assert resolve_kind("diagram") == "web"
    assert resolve_kind(None) == "web"
    assert react_kind("mobile") == "mobile"
    assert react_kind("slides") == "web"


def test_system_prompt_is_unchanged_for_web_and_mobile():
    web = system_prompt_with_design(False, platform="web")
    mobile = system_prompt_with_design(False, platform="mobile")
    assert web.startswith(SYSTEM_PROMPT + "\n")
    assert MOBILE_PLATFORM_RULES not in web
    assert mobile.startswith(SYSTEM_PROMPT + "\n" + MOBILE_PLATFORM_RULES + "\n")
    # Document kinds add no rules yet; an unknown value behaves like web.
    assert system_prompt_with_design(False, platform="slides") == web
    assert system_prompt_with_design(False, platform="diagram") == web


def _read(project: str, relative: str):
    return (get_settings().projects_path / project / relative).read_text(encoding="utf-8")


def test_slides_scaffold_is_a_valid_deck(project):
    scaffold_slides(project, "Rapport annuel")
    deck = validate_deck(json.loads(_read(project, "deck.json")))
    assert deck.format.ratio == "16:9"
    assert [ref.id for ref in deck.slides] == ["s1"]
    slide = validate_slide(json.loads(_read(project, "slides/s1.json")))
    assert slide.elements[0].type == "text"
    assert "Rapport annuel" in _read(project, "slides/s1.json")
    assert "--accent" in _read(project, "DESIGN.md")


def test_codelab_scaffold_is_a_valid_codelab(project):
    scaffold_codelab(project, "API FastAPI")
    codelab = validate_codelab(json.loads(_read(project, "codelab.json")))
    assert codelab.steps[0].file == "steps/01-intro.md"
    assert _read(project, "steps/01-intro.md").startswith("# Introduction")


def test_design_system_scaffold_has_default_tokens(project):
    scaffold_design_system(project, "Acme")
    ds = validate_design_system(json.loads(_read(project, "design-system.json")))
    assert ds.name == "Acme"
    assert {"color", "font"} <= set(ds.tokens)
    assert "`--fg`" in _read(project, "DESIGN.md")


def _kinds_client() -> TestClient:
    app = FastAPI()
    app.include_router(kinds_router.router)
    app.include_router(templates_router.router)
    return TestClient(app)


def test_kinds_endpoint_reports_flags(flags):
    clear_settings_cache()
    rows = {row["id"]: row for row in _kinds_client().get("/kinds").json()}
    assert list(rows) == list(KIND_IDS)
    assert rows["web"]["enabled"] and rows["mobile"]["enabled"]
    assert not rows["slides"]["enabled"]
    assert rows["slides"]["editor"] == "deck"
    flags("slides")
    rows = {row["id"]: row for row in _kinds_client().get("/kinds").json()}
    assert rows["slides"]["enabled"]
    assert not rows["codelab"]["enabled"]


def test_templates_filter_accepts_registered_kinds_only():
    client = _kinds_client()
    assert client.get("/templates?kind=diagram").status_code == 400
    assert client.get("/templates?kind=slides").json() == []


def test_creating_a_dark_kind_is_refused(monkeypatch, tmp_path_factory):
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    r = client.post("/projects", json={"name": "Deck", "platform": "slides"}, headers=EN)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "KIND_DISABLED"
    # An unknown kind is still a validation error, as before.
    assert client.post("/projects", json={"name": "X", "platform": "diagram"}, headers=EN).status_code == 422


@pytest.mark.parametrize(
    ("kind_id", "document"),
    [("slides", "deck.json"), ("codelab", "codelab.json"), ("design_system", "design-system.json")],
)
def test_creating_an_enabled_document_kind_scaffolds_it(
    monkeypatch, tmp_path_factory, flags, kind_id, document
):
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    flags(kind_id)
    r = client.post("/projects", json={"name": "Mon livrable", "platform": kind_id}, headers=EN)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["platform"] == kind_id
    assert (get_settings().projects_path / body["id"] / document).is_file()


def test_web_and_mobile_creation_still_use_the_react_scaffold(monkeypatch, tmp_path_factory):
    calls = []
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3, plan="starter")
    from app.routers import projects as projects_mod

    monkeypatch.setattr(projects_mod, "scaffold_vite_react", lambda *a, **_k: calls.append(a[2]))
    for platform in ("web", "mobile"):
        r = client.post("/projects", json={"name": f"App {platform}", "platform": platform}, headers=EN)
        assert r.status_code == 201
        assert r.json()["platform"] == platform
    assert calls == ["web", "mobile"]
