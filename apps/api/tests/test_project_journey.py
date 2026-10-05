"""Forge project journey: plan quota + Canva-style collaboration authorization.

Covers the paths a Forge Cloud user walks:
  - GET /projects/quota reflects the plan's `max_projects` vs projects used;
  - creating past the plan cap is refused with the plan + limit (what the UI
    turns into an upgrade alert), while a create under the cap succeeds;
  - a shared project is reachable by an invited collaborator and by the owner,
    but a stranger gets 404.

Same TestClient + dependency-override harness as test_reserved_slugs (no real DB).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import sqlalchemy.orm as sa_orm
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.services.entitlements as ent_mod
from app.auth import get_current_user
from app.config import clear_settings_cache
from app.db import get_db
from app.models import Project, ProjectCollaborator
from app.routers import projects as projects_mod

EN = {"Accept-Language": "en"}


def _user(**over) -> SimpleNamespace:
    return SimpleNamespace(
        id=over.get("id", uuid.uuid4()),
        email=over.get("email", "owner@example.com"),
        email_verified_at=datetime.now(UTC),
        rodium_sub=over.get("rodium_sub"),
    )


def _project(owner_id) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=owner_id,
        name="My Site",
        slug="my-site",
        status="ready",
        preview_port=None,
        preview_running=False,
        template_id=None,
        platform="web",
        visibility="private",
        billing_policy="owner_pays",
        published_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def _build_client(
    monkeypatch,
    tmp_path_factory,
    *,
    user,
    project=None,
    collaborators=(),
    limit=None,
    plan="free",
    used=0,
    accepted=True,
):
    """A projects-router client with a controllable fake session.

    `collaborators` is a set of user ids that own a ProjectCollaborator row on
    `project`. `limit`/`used` drive the quota; `max_projects_for` /
    `get_entitlements` are patched so no entitlement cache row is needed.
    """
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", lambda *_a, **_k: None)
    monkeypatch.setattr(projects_mod, "scaffold_vite_react", lambda *_a, **_k: None)
    monkeypatch.setattr(projects_mod, "capture_for_user", lambda *_a, **_k: None)
    monkeypatch.setattr(sa_orm.Session, "object_session", staticmethod(lambda _obj: None))
    monkeypatch.setattr(ent_mod, "max_projects_for", lambda _db, _u, _fallback: limit)
    monkeypatch.setattr(ent_mod, "get_entitlements", lambda _db, _u: SimpleNamespace(plan_slug=plan))

    collab_ids = {str(c) for c in collaborators}

    class FakeQuery:
        def filter(self, *_a, **_k):
            return self

        def join(self, *_a, **_k):
            return self

        def order_by(self, *_a, **_k):
            return self

        def with_for_update(self, *_a, **_k):
            return self

        def one(self):
            return SimpleNamespace(id=user.id)

        def scalar(self):
            return used

        def all(self):
            return []

        def first(self):
            return None

    db = SimpleNamespace()

    def db_query(*_a, **_k):
        return FakeQuery()

    def db_get(model, key):
        if model is Project:
            return project if project and str(key) == str(project.id) else None
        if model is ProjectCollaborator:
            # key is (project_id, user_id)
            if project and isinstance(key, tuple):
                pid, uid = key
                if str(pid) == str(project.id) and str(uid) in collab_ids:
                    return SimpleNamespace(
                        project_id=project.id,
                        user_id=uid,
                        role="editor",
                        accepted_at=datetime.now(UTC) if accepted else None,
                    )
            return None
        return None

    def db_refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        obj.created_at = obj.updated_at = datetime.now(UTC)
        obj.preview_running = False

    db.query = db_query
    db.get = db_get
    db.add = lambda *_a, **_k: None
    db.commit = lambda *_a, **_k: None
    db.flush = lambda *_a, **_k: None
    db.refresh = db_refresh

    app = FastAPI()
    app.include_router(projects_mod.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


# ── Quota endpoint ───────────────────────────────────────────────────────────


def test_quota_endpoint_reports_capacity(monkeypatch, tmp_path_factory):
    user = _user()
    client = _build_client(monkeypatch, tmp_path_factory, user=user, limit=3, used=1, plan="starter")
    r = client.get("/projects/quota", headers=EN)
    assert r.status_code == 200
    body = r.json()
    assert body == {"used": 1, "limit": 3, "can_create": True, "plan": "starter"}


def test_quota_endpoint_flags_full_free_plan(monkeypatch, tmp_path_factory):
    user = _user()
    client = _build_client(monkeypatch, tmp_path_factory, user=user, limit=1, used=1, plan="free")
    r = client.get("/projects/quota", headers=EN)
    assert r.status_code == 200
    assert r.json()["can_create"] is False


# ── Create vs plan cap ───────────────────────────────────────────────────────


def test_create_refused_at_plan_cap(monkeypatch, tmp_path_factory):
    """Free plan (1 project), already 1 used → the 2nd create is refused with the
    plan + limit the UI shows as an upgrade prompt."""
    user = _user()
    client = _build_client(monkeypatch, tmp_path_factory, user=user, limit=1, used=1, plan="free")
    r = client.post("/projects", json={"name": "Second"}, headers=EN)
    assert r.status_code == 403
    detail = r.json()["detail"]
    assert detail["code"] == "project_quota_exceeded"
    assert detail["limit"] == 1
    assert detail["plan"] == "free"
    assert "upgrade" in detail["actions"]


def test_create_allowed_under_cap(monkeypatch, tmp_path_factory):
    user = _user()
    client = _build_client(monkeypatch, tmp_path_factory, user=user, limit=3, used=0, plan="starter")
    r = client.post("/projects", json={"name": "My Portfolio"}, headers=EN)
    assert r.status_code == 201
    assert r.json()["slug"] == "my-portfolio"


def test_unlimited_plan_never_blocks(monkeypatch, tmp_path_factory):
    user = _user()
    # Scale: limit=None (unlimited), even with many projects used.
    client = _build_client(monkeypatch, tmp_path_factory, user=user, limit=None, used=99, plan="scale")
    assert client.get("/projects/quota", headers=EN).json()["can_create"] is True
    assert client.post("/projects", json={"name": "Another"}, headers=EN).status_code == 201


# ── Collaboration authorization ──────────────────────────────────────────────


def test_owner_opens_own_project(monkeypatch, tmp_path_factory):
    owner = _user()
    project = _project(owner.id)
    client = _build_client(monkeypatch, tmp_path_factory, user=owner, project=project, limit=3)
    assert client.get(f"/projects/{project.id}", headers=EN).status_code == 200


def test_invited_collaborator_opens_shared_project(monkeypatch, tmp_path_factory):
    owner = _user()
    collaborator = _user(email="guest@example.com")
    project = _project(owner.id)
    client = _build_client(
        monkeypatch,
        tmp_path_factory,
        user=collaborator,
        project=project,
        collaborators=[collaborator.id],
        limit=3,
    )
    assert client.get(f"/projects/{project.id}", headers=EN).status_code == 200


def test_pending_invite_cannot_open_project(monkeypatch, tmp_path_factory):
    owner = _user()
    collaborator = _user(email="guest@example.com")
    project = _project(owner.id)
    client = _build_client(
        monkeypatch,
        tmp_path_factory,
        user=collaborator,
        project=project,
        collaborators=[collaborator.id],
        limit=3,
        accepted=False,
    )
    assert client.get(f"/projects/{project.id}", headers=EN).status_code == 404


def test_stranger_cannot_open_project(monkeypatch, tmp_path_factory):
    owner = _user()
    stranger = _user(email="stranger@example.com")
    project = _project(owner.id)
    client = _build_client(
        monkeypatch, tmp_path_factory, user=stranger, project=project, collaborators=[], limit=3
    )
    assert client.get(f"/projects/{project.id}", headers=EN).status_code == 404
