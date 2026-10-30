"""Share links: owner settings, the public presentation read, and joining by link."""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.models import Project, ProjectCollaborator, User
from app.routers import share_links
from app.services.filesystem import write_bytes, write_file


def _png() -> bytes:
    from io import BytesIO

    from PIL import Image

    out = BytesIO()
    Image.new("RGB", (2, 2), "orange").save(out, format="PNG")
    return out.getvalue()


class FakeQuery:
    def __init__(self, db: FakeDB):
        self.db = db

    def filter(self, *_args):
        return self

    def one_or_none(self):
        token = self.db.lookup_token
        return next((p for p in self.db.projects.values() if p.link_token == token and token), None)


class FakeDB:
    def __init__(self):
        self.projects: dict[str, SimpleNamespace] = {}
        self.users: dict[str, SimpleNamespace] = {}
        self.collaborators: dict[tuple[str, str], object] = {}
        self.lookup_token: str | None = None
        self.commits = 0

    def query(self, model):
        assert model is Project
        return FakeQuery(self)

    def get(self, model, key):
        if model is User:
            return self.users.get(str(key))
        if model is ProjectCollaborator:
            return self.collaborators.get((str(key[0]), str(key[1])))
        return self.projects.get(str(key))

    def add(self, row):
        self.collaborators[(str(row.project_id), str(row.user_id))] = row

    def commit(self):
        self.commits += 1


def _user(name: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), email=f"{name}@example.com")


@pytest.fixture
def world(project, monkeypatch):
    db = FakeDB()
    owner, guest = _user("owner"), _user("guest")
    db.users = {str(owner.id): owner, str(guest.id): guest}
    proj = Project(
        id=uuid.uuid4(), user_id=owner.id, name="Deck", platform="slides", link_access="none", link_token=None
    )
    db.projects[str(proj.id)] = proj
    state = {"user": owner, "limit": 3, "occupied": set()}

    monkeypatch.setattr(share_links, "_share_seat_limit", lambda _db, _u: state["limit"])
    monkeypatch.setattr(share_links, "_occupied_emails", lambda _db, _p: state["occupied"])

    def owned(_db, user, project_id, _locale="fr"):
        found = db.projects.get(str(project_id))
        if found is None or found.user_id != user.id:
            from fastapi import HTTPException

            raise HTTPException(status_code=404)
        return found

    monkeypatch.setattr(share_links, "_owned_project", owned)

    # The token lookup goes through query().filter(); remember which token is asked.
    real_shared = share_links._shared_project

    def shared(_db, token, request):
        db.lookup_token = token
        return real_shared(_db, token, request)

    monkeypatch.setattr(share_links, "_shared_project", shared)

    app = FastAPI()
    app.include_router(share_links.router)
    app.include_router(share_links.public_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: state["user"]

    pid = str(proj.id)
    write_file(
        pid,
        "deck.json",
        json.dumps(
            {"theme": {"tokens": "DESIGN.md"}, "slides": [{"id": "s1"}, {"id": "s2", "hidden": True}]}
        ),
    )
    write_file(pid, "slides/s1.json", json.dumps({"id": "s1", "elements": []}))
    write_file(pid, "slides/s2.json", json.dumps({"id": "s2", "elements": []}))
    write_file(pid, "notes/s1.md", "secret notes")
    write_file(pid, "DESIGN.md", "# Theme")
    write_bytes(pid, "public/pic.png", _png())
    write_file(pid, "public/page.html", "<script>alert(1)</script>")
    return SimpleNamespace(client=TestClient(app), db=db, owner=owner, guest=guest, project=proj, state=state)


def test_link_is_closed_until_the_owner_opens_it(world):
    c = world.client
    assert c.get(f"/projects/{world.project.id}/link").json()["access"] == "none"
    out = c.put(f"/projects/{world.project.id}/link", json={"access": "view"}).json()
    assert out["access"] == "view" and out["token"]
    assert out["seats_left"] == 3 and out["can_edit_link"] is True
    world.project.link_access = "none"
    assert c.get(f"/share/{out['token']}").status_code == 404


def test_only_the_owner_sets_the_link(world):
    world.state["user"] = world.guest
    assert world.client.put(f"/projects/{world.project.id}/link", json={"access": "edit"}).status_code == 404


def test_edit_link_needs_sharing_in_the_plan(world):
    world.state["limit"] = 0
    res = world.client.put(f"/projects/{world.project.id}/link", json={"access": "edit"})
    assert res.status_code == 422
    assert world.client.put(f"/projects/{world.project.id}/link", json={"access": "view"}).status_code == 200


def test_reset_cuts_the_old_link(world):
    c = world.client
    old = c.put(f"/projects/{world.project.id}/link", json={"access": "view"}).json()["token"]
    new = c.post(f"/projects/{world.project.id}/link/reset").json()["token"]
    assert new != old
    assert c.get(f"/share/{old}").status_code == 404
    assert c.get(f"/share/{new}").json()["name"] == "Deck"


def test_presentation_skips_hidden_slides_and_notes(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "view"}).json()["token"]
    body = c.get(f"/share/{token}/presentation").json()
    assert [r["id"] for r in body["deck"]["slides"]] == ["s1"]
    assert set(body["slides"]) == {"s1"}
    assert body["theme"] == "# Theme"
    assert "secret notes" not in json.dumps(body)


def test_assets_serve_images_only(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "view"}).json()["token"]
    res = c.get(f"/share/{token}/asset/public/pic.png")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"
    assert c.get(f"/share/{token}/asset/page.html").status_code == 404
    assert c.get(f"/share/{token}/asset/..%2Fdeck.json").status_code == 404


def test_view_link_never_joins(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "view"}).json()["token"]
    world.state["user"] = world.guest
    assert c.post(f"/share/{token}/join").json()["role"] == "view"
    assert world.db.collaborators == {}


def test_edit_link_joins_as_editor_while_a_seat_is_free(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "edit"}).json()["token"]
    world.state["user"] = world.guest
    assert c.post(f"/share/{token}/join").json()["role"] == "editor"
    row = world.db.collaborators[(str(world.project.id), str(world.guest.id))]
    assert row.role == "editor" and row.accepted_at is not None


def test_edit_link_without_a_seat_gives_read_only(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "edit"}).json()["token"]
    world.state["occupied"] = {"a@x.io", "b@x.io", "c@x.io"}
    world.state["user"] = world.guest
    out = c.post(f"/share/{token}/join").json()
    assert out == {"project_id": str(world.project.id), "role": "view", "reason": "no_seat"}
    assert world.db.collaborators == {}


def test_owner_opening_the_link_stays_owner(world):
    c = world.client
    token = c.put(f"/projects/{world.project.id}/link", json={"access": "edit"}).json()["token"]
    assert c.post(f"/share/{token}/join").json()["role"] == "owner"


def test_unknown_or_malformed_token_is_404(world):
    assert world.client.get("/share/nope").status_code == 404
    assert world.client.get("/share/" + "a" * 30).status_code == 404
