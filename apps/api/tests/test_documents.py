"""CRUD of the Forge Design documents: contracts, flags, access, concurrency."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.db import get_db
from app.models import Project, ProjectCollaborator
from app.routers import documents as documents_mod
from app.services.document_scaffold import scaffold_codelab, scaffold_design_system, scaffold_slides

FLAGS = {
    "slides": "FORGE_KIND_SLIDES_ENABLED",
    "codelab": "FORGE_KIND_CODELAB_ENABLED",
    "design_system": "FORGE_KIND_DESIGN_SYSTEM_ENABLED",
}
SCAFFOLDS = {"slides": scaffold_slides, "codelab": scaffold_codelab, "design_system": scaffold_design_system}


@pytest.fixture
def setup(monkeypatch, tmp_path_factory):
    """``setup(kind, flag=True, role="owner")`` -> (client, project_id, checkpoints)."""

    def make(kind: str, *, flag: bool = True, role: str = "owner"):
        monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
        for kind_id, env in FLAGS.items():
            monkeypatch.setenv(env, "true" if flag and kind_id == kind else "false")
        clear_settings_cache()
        owner_id, user_id = uuid.uuid4(), uuid.uuid4()
        project = SimpleNamespace(
            id=uuid.uuid4(), user_id=owner_id if role != "owner" else user_id, platform=kind
        )
        SCAFFOLDS[kind](str(project.id), "Mon projet")
        # Record the checkpoints the routes take (after the scaffold's own).
        checkpoints: list[str] = []
        monkeypatch.setattr(documents_mod.history, "snapshot", lambda _pid, label: checkpoints.append(label))
        documents_mod._last_checkpoint.clear()

        def db_get(model, key):
            if model is Project:
                return project if str(key) == str(project.id) else None
            if model is ProjectCollaborator and role in ("editor", "viewer"):
                return SimpleNamespace(role=role, accepted_at=datetime.now(UTC))
            return None

        app = FastAPI()
        app.include_router(documents_mod.router)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
        app.dependency_overrides[get_db] = lambda: SimpleNamespace(get=db_get)
        return TestClient(app), str(project.id), checkpoints

    yield make
    clear_settings_cache()


def _disk(pid: str, relative: str):
    return json.loads((get_settings().projects_path / pid / relative).read_text(encoding="utf-8"))


def test_deck_round_trip(setup):
    client, pid, checkpoints = setup("slides")
    r = client.get(f"/projects/{pid}/deck")
    assert r.status_code == 200
    deck = r.json()
    etag = r.headers["etag"]
    deck["format"] = {"ratio": "1:1", "width": 1080, "height": 1080}
    deck["slides"].append({"id": "s2", "layout": "section", "transition": {"type": "morph"}})
    r = client.put(f"/projects/{pid}/deck", json=deck, headers={"If-Match": etag})
    assert r.status_code == 200, r.text
    assert _disk(pid, "deck.json")["format"]["ratio"] == "1:1"
    # The new slide got an empty body.
    assert _disk(pid, "slides/s2.json") == {"id": "s2", "elements": []}
    assert checkpoints == ["before deck edit"]


def test_invalid_deck_is_refused_and_not_written(setup):
    client, pid, _ = setup("slides")
    before = _disk(pid, "deck.json")
    bad = {**before, "format": {"ratio": "16:9", "width": 1440, "height": 1080}}
    r = client.put(f"/projects/{pid}/deck", json=bad)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "INVALID_DOCUMENT"
    assert r.json()["detail"]["errors"]
    assert _disk(pid, "deck.json") == before


def test_stale_write_is_refused(setup):
    client, pid, _ = setup("slides")
    deck = client.get(f"/projects/{pid}/deck").json()
    r = client.put(f"/projects/{pid}/deck", json=deck, headers={"If-Match": '"0000000000000000"'})
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "DOCUMENT_CHANGED"


def test_slide_put_and_element_patch(setup):
    client, pid, checkpoints = setup("slides")
    slide = client.get(f"/projects/{pid}/slides/s1").json()
    slide["elements"].append(
        {
            "id": "grp",
            "type": "group",
            "x": 0,
            "y": 0,
            "w": 400,
            "h": 400,
            "children": [
                {"id": "dot", "type": "shape", "shape": "ellipse", "x": 0, "y": 0, "w": 10, "h": 10}
            ],
        }
    )
    assert client.put(f"/projects/{pid}/slides/s1", json=slide).status_code == 200
    # Move one element nested in the group; everything else is kept.
    r = client.patch(
        f"/projects/{pid}/slides/s1", json={"element": {"id": "dot", "x": 120, "fill": "--accent"}}
    )
    assert r.status_code == 200, r.text
    dot = _disk(pid, "slides/s1.json")["elements"][-1]["children"][0]
    assert dot == {
        "id": "dot",
        "type": "shape",
        "shape": "ellipse",
        "x": 120,
        "y": 0,
        "w": 10,
        "h": 10,
        "fill": "--accent",
    }
    # One checkpoint: the second write fell inside the throttle window.
    assert checkpoints == ["before slide edit"]


def test_element_patch_is_validated(setup):
    client, pid, _ = setup("slides")
    r = client.patch(f"/projects/{pid}/slides/s1", json={"element": {"id": "title", "w": 0}})
    assert r.status_code == 422
    r = client.patch(f"/projects/{pid}/slides/s1", json={"element": {"id": "ghost", "x": 1}})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "ELEMENT_NOT_FOUND"


def test_slide_must_belong_to_the_deck_and_match_the_url(setup):
    client, pid, _ = setup("slides")
    assert client.get(f"/projects/{pid}/slides/s9").status_code == 404
    assert client.get(f"/projects/{pid}/slides/..%2Fdeck").status_code in (400, 404)
    slide = client.get(f"/projects/{pid}/slides/s1").json()
    r = client.put(f"/projects/{pid}/slides/s1", json={**slide, "id": "s2"})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "ID_MISMATCH"


def test_codelab_and_steps(setup):
    client, pid, _ = setup("codelab")
    codelab = client.get(f"/projects/{pid}/codelab").json()
    codelab["steps"].append(
        {"id": "setup", "title": "Installation", "file": "steps/02-setup.md", "minutes": 7}
    )
    assert client.put(f"/projects/{pid}/codelab", json=codelab).status_code == 200
    step = client.get(f"/projects/{pid}/steps/setup").json()
    assert step == {"id": "setup", "file": "steps/02-setup.md", "markdown": "# Installation\n"}
    r = client.put(
        f"/projects/{pid}/steps/setup",
        json={"markdown": "# Installation\n\n```bash\npip install fastapi\n```\n"},
    )
    assert r.status_code == 200
    assert "pip install" in client.get(f"/projects/{pid}/steps/setup").json()["markdown"]
    assert client.get(f"/projects/{pid}/steps/missing").status_code == 404


def test_design_system_put_regenerates_design_md(setup):
    client, pid, _ = setup("design_system")
    ds = client.get(f"/projects/{pid}/design-system").json()
    ds["tokens"]["color"]["accent"]["$value"] = "#123456"
    assert client.put(f"/projects/{pid}/design-system", json=ds).status_code == 200
    design_md = (get_settings().projects_path / pid / "DESIGN.md").read_text(encoding="utf-8")
    assert "`--accent`: #123456" in design_md


def test_routes_stay_closed_while_the_flag_is_off(setup):
    client, pid, _ = setup("slides", flag=False)
    r = client.get(f"/projects/{pid}/deck")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "KIND_DISABLED"


def test_wrong_kind_is_refused(setup):
    client, pid, _ = setup("codelab")
    r = client.get(f"/projects/{pid}/deck")
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "WRONG_KIND"


def test_viewer_reads_but_cannot_write(setup):
    client, pid, _ = setup("slides", role="viewer")
    deck = client.get(f"/projects/{pid}/deck")
    assert deck.status_code == 200
    assert client.put(f"/projects/{pid}/deck", json=deck.json()).status_code == 404


def test_editor_can_write(setup):
    client, pid, _ = setup("slides", role="editor")
    deck = client.get(f"/projects/{pid}/deck").json()
    assert client.put(f"/projects/{pid}/deck", json=deck).status_code == 200


def test_stranger_gets_404(setup):
    client, pid, _ = setup("slides", role="stranger")
    assert client.get(f"/projects/{pid}/deck").status_code == 404
