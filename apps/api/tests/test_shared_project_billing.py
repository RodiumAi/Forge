"""Shared-project FRODI billing wiring (F-1, forge-web side).

Complements the gateway-side counter tests (`test_frodi_collaborator_cap.py`)
by exercising the pieces that only live in forge-web:

  * `chats._generation_auth_resolver` → on an ``owner_pays`` project opened by a
    collaborator, billing switches to the OWNER and the collaborator's per-cycle
    FRODI cap + identity are attached (so the gateway can enforce the ceiling).
  * `llm._forge_billing_context` / `_current_frodi_cycle_key` → the lane payload
    carries the right cap context, and only for a non-owner actor.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.models import Project, ProjectCollaborator, User
from app.routers import chats as chats_mod
from app.routers import projects as projects_mod
from app.services import llm as llm_mod
from app.services.rodium_generation import RodiumGenerationAuth


def _user(sub: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), rodium_sub=sub, email=f"{sub}@example.com")


def _fake_auth_db(objects: dict):
    """A stand-in for the SessionLocal() auth_db, resolving `.get(model, key)`."""

    def get(model, key):
        if model is User:
            return objects["users"].get(str(key))
        if model is Project:
            proj = objects.get("project")
            return proj if proj and str(key) == str(proj.id) else None
        if model is ProjectCollaborator:
            if isinstance(key, tuple):
                return objects["collaborators"].get((str(key[0]), str(key[1])))
            return None
        return None

    return SimpleNamespace(get=get)


def _install(monkeypatch, *, auth_db, resolved_auth: RodiumGenerationAuth):
    @contextmanager
    def fake_session():
        yield auth_db

    monkeypatch.setattr(chats_mod, "SessionLocal", fake_session)

    async def fake_resolve(_db, _user):
        return resolved_auth

    monkeypatch.setattr(chats_mod, "resolve_generation_auth", fake_resolve)


# ── chats: owner_pays billing switch + cap resolution ────────────────────────


@pytest.mark.asyncio
async def test_collaborator_generation_bills_owner_with_cap(monkeypatch):
    owner = _user("owner_sub")
    collab = _user("collab_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays")

    auth_db = _fake_auth_db(
        {
            "users": {str(owner.id): owner, str(collab.id): collab},
            "project": project,
            "collaborators": {
                (str(project.id), str(collab.id)): SimpleNamespace(
                    project_id=project.id, user_id=collab.id, frodi_cap_per_cycle=2000
                )
            },
        }
    )
    # Before the switch, the collaborator resolves to their OWN billing uid.
    resolved = RodiumGenerationAuth(mode="secret", billing_uid=collab.rodium_sub)
    _install(monkeypatch, auth_db=auth_db, resolved_auth=resolved)

    resolver = chats_mod._generation_auth_resolver(collab.id, "en", project.id)
    auth = await resolver()

    # Billing flips to the owner; the collaborator identity + cap ride along.
    assert auth.billing_uid == "owner_sub"
    assert auth.actor_uid == "collab_sub"
    assert auth.project_id == str(project.id)
    assert auth.frodi_cap_per_cycle == 2000


@pytest.mark.asyncio
async def test_collaborator_without_cap_row_has_no_ceiling(monkeypatch):
    owner = _user("owner_sub")
    collab = _user("collab_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays")

    auth_db = _fake_auth_db(
        {
            "users": {str(owner.id): owner, str(collab.id): collab},
            "project": project,
            "collaborators": {},  # accepted collaborator, but no cap row
        }
    )
    resolved = RodiumGenerationAuth(mode="secret", billing_uid=collab.rodium_sub)
    _install(monkeypatch, auth_db=auth_db, resolved_auth=resolved)

    auth = await chats_mod._generation_auth_resolver(collab.id, "en", project.id)()

    assert auth.billing_uid == "owner_sub"
    assert auth.actor_uid == "collab_sub"
    assert auth.frodi_cap_per_cycle is None  # gateway → uncapped


@pytest.mark.asyncio
async def test_owner_generation_is_not_capped_or_switched(monkeypatch):
    owner = _user("owner_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays")

    auth_db = _fake_auth_db(
        {"users": {str(owner.id): owner}, "project": project, "collaborators": {}}
    )
    resolved = RodiumGenerationAuth(mode="secret", billing_uid=owner.rodium_sub)
    _install(monkeypatch, auth_db=auth_db, resolved_auth=resolved)

    auth = await chats_mod._generation_auth_resolver(owner.id, "en", project.id)()

    # Owner on their own project: no switch, no actor, no cap.
    assert auth.billing_uid == "owner_sub"
    assert auth.actor_uid is None
    assert auth.frodi_cap_per_cycle is None


@pytest.mark.asyncio
async def test_each_pays_own_keeps_collaborator_billing(monkeypatch):
    owner = _user("owner_sub")
    collab = _user("collab_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="each_pays_own")

    auth_db = _fake_auth_db(
        {
            "users": {str(owner.id): owner, str(collab.id): collab},
            "project": project,
            "collaborators": {
                (str(project.id), str(collab.id)): SimpleNamespace(
                    project_id=project.id, user_id=collab.id, frodi_cap_per_cycle=500
                )
            },
        }
    )
    resolved = RodiumGenerationAuth(mode="secret", billing_uid=collab.rodium_sub)
    _install(monkeypatch, auth_db=auth_db, resolved_auth=resolved)

    auth = await chats_mod._generation_auth_resolver(collab.id, "en", project.id)()

    # each_pays_own → the collaborator pays with their own FRODI; no switch/cap.
    assert auth.billing_uid == "collab_sub"
    assert auth.actor_uid is None
    assert auth.frodi_cap_per_cycle is None


# ── llm: lane payload context ────────────────────────────────────────────────


def test_forge_billing_context_for_capped_collaborator():
    auth = RodiumGenerationAuth(
        mode="secret",
        billing_uid="owner_sub",
        actor_uid="collab_sub",
        project_id="proj_9",
        frodi_cap_per_cycle=2000,
    )
    ctx = llm_mod._forge_billing_context(auth)
    assert ctx is not None
    assert ctx["project_id"] == "proj_9"
    assert ctx["cap_per_cycle"] == 2000
    assert ctx["cycle_key"] == llm_mod._current_frodi_cycle_key()


def test_forge_billing_context_none_for_owner():
    auth = RodiumGenerationAuth(mode="secret", billing_uid="owner_sub", actor_uid="owner_sub")
    assert llm_mod._forge_billing_context(auth) is None
    # No actor at all (owner's own project) → also None.
    assert llm_mod._forge_billing_context(
        RodiumGenerationAuth(mode="secret", billing_uid="owner_sub")
    ) is None


def test_cycle_key_is_iso_week_shaped():
    key = llm_mod._current_frodi_cycle_key()
    year, _, week = key.partition("-W")
    assert year.isdigit() and len(year) == 4
    assert week.isdigit() and 1 <= int(week) <= 53
    now = datetime.now(UTC).isocalendar()
    assert key == f"{now.year}-W{now.week:02d}"


# ── share_project: default cap guardrail (b) ─────────────────────────────────

_EN = {"Accept-Language": "en"}


def _share_client(monkeypatch, *, owner, project, invitee, existing_collab=None, cloud=False, unknown=False):
    """Minimal projects-router client wired for share + list_collaborators."""
    captured = {"rows": []}

    class Q:
        def __init__(self, model):
            self.model = model

        def filter(self, *_a, **_k):
            return self

        def join(self, *_a, **_k):
            return self

        def order_by(self, *_a, **_k):
            return self

        def one_or_none(self):
            if self.model is projects_mod.User:
                return None if unknown else invitee
            if self.model is Project:
                return invitee
            return existing_collab  # ProjectCollaborator

        def all(self):
            return captured["rows"]

    db = SimpleNamespace()
    db.query = lambda model, *rest: Q(model)
    db.get = lambda model, key: project if model is Project and str(key) == str(project.id) else None
    db.add = lambda row: captured["rows"].append(row)
    db.commit = lambda: None

    monkeypatch.setattr(
        projects_mod,
        "get_settings",
        lambda: SimpleNamespace(forge_default_collab_frodi_cap=2000, forge_cloud_enabled=cloud),
    )
    monkeypatch.setattr(projects_mod, "_notify_project_invite", lambda *_a, **_k: True)

    app = FastAPI()
    app.include_router(projects_mod.router)
    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app), captured


def test_share_unknown_email_stays_pending(monkeypatch):
    from app.models import ProjectInvite

    owner = SimpleNamespace(id=uuid.uuid4(), email="owner@example.com", name="Awa", rodium_sub="owner_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, name="Studio", billing_policy="owner_pays", visibility="private")
    client, captured = _share_client(
        monkeypatch, owner=owner, project=project, invitee=None, unknown=True
    )
    sent: list[str] = []
    monkeypatch.setattr(
        projects_mod,
        "_notify_project_invite",
        lambda *_a, **_k: sent.append("mail") or True,
    )

    r = client.post(
        f"/projects/{project.id}/share",
        json={"email": "new.person@example.com", "billing_policy": "owner_pays"},
        headers=_EN,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["shared_with"] is None
    assert body["pending"] is True
    assert body["mail_sent"] is True
    assert sent == ["mail"]
    assert any(isinstance(row, ProjectInvite) and row.email == "new.person@example.com" for row in captured["rows"])
    assert not any(getattr(row, "user_id", None) for row in captured["rows"])


def test_share_applies_default_cap_when_blank(monkeypatch):
    owner = SimpleNamespace(id=uuid.uuid4(), rodium_sub="owner_sub")
    invitee = SimpleNamespace(id=uuid.uuid4(), email="guest@example.com", rodium_sub="guest_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays", visibility="private")
    client, captured = _share_client(monkeypatch, owner=owner, project=project, invitee=invitee)

    r = client.post(f"/projects/{project.id}/share", json={"email": invitee.email, "billing_policy": "owner_pays"}, headers=_EN)
    assert r.status_code == 200
    assert r.json()["frodi_cap_per_cycle"] == 2000
    assert captured["rows"][0].frodi_cap_per_cycle == 2000


def test_share_explicit_cap_is_respected(monkeypatch):
    owner = SimpleNamespace(id=uuid.uuid4(), rodium_sub="owner_sub")
    invitee = SimpleNamespace(id=uuid.uuid4(), email="guest@example.com", rodium_sub="guest_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays", visibility="private")
    client, _captured = _share_client(monkeypatch, owner=owner, project=project, invitee=invitee)

    r = client.post(f"/projects/{project.id}/share", json={"email": invitee.email, "billing_policy": "owner_pays", "frodi_cap_per_cycle": 500}, headers=_EN)
    assert r.json()["frodi_cap_per_cycle"] == 500


def test_share_zero_means_unlimited(monkeypatch):
    owner = SimpleNamespace(id=uuid.uuid4(), rodium_sub="owner_sub")
    invitee = SimpleNamespace(id=uuid.uuid4(), email="guest@example.com", rodium_sub="guest_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays", visibility="private")
    client, _captured = _share_client(monkeypatch, owner=owner, project=project, invitee=invitee)

    r = client.post(f"/projects/{project.id}/share", json={"email": invitee.email, "billing_policy": "owner_pays", "frodi_cap_per_cycle": 0}, headers=_EN)
    assert r.json()["frodi_cap_per_cycle"] == 0


def test_share_each_pays_own_ignores_cap(monkeypatch):
    owner = SimpleNamespace(id=uuid.uuid4(), rodium_sub="owner_sub")
    invitee = SimpleNamespace(id=uuid.uuid4(), email="guest@example.com", rodium_sub="guest_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays", visibility="private")
    client, captured = _share_client(monkeypatch, owner=owner, project=project, invitee=invitee)

    r = client.post(f"/projects/{project.id}/share", json={"email": invitee.email, "billing_policy": "each_pays_own"}, headers=_EN)
    assert r.json()["billing_policy"] == "each_pays_own"
    assert captured["rows"][0].frodi_cap_per_cycle is None


def test_list_collaborators_includes_cycle_usage(monkeypatch):
    owner = SimpleNamespace(id=uuid.uuid4(), rodium_sub="owner_sub")
    member = SimpleNamespace(id=uuid.uuid4(), email="guest@example.com", name="Guest", rodium_sub="guest_sub")
    project = SimpleNamespace(id=uuid.uuid4(), user_id=owner.id, billing_policy="owner_pays", visibility="shared")
    collab = SimpleNamespace(role="editor", frodi_cap_per_cycle=2000, invited_at=None, accepted_at=None)

    client, _ = _share_client(monkeypatch, owner=owner, project=project, invitee=member)
    # Patch the gateway usage fetch (avoid real httpx) → 12.5 FRODI for the member.
    monkeypatch.setattr(projects_mod, "_fetch_collab_usage", lambda *_a, **_k: {"guest_sub": 12.5})

    # The Q.all() returns captured["rows"]; seed it with (collab, member).
    # Re-wire db.query to yield our row for the 2-arg list query.
    db = client.app.dependency_overrides[get_db]()
    db_all_rows = [(collab, member)]

    class Q2:
        def __init__(self, *models):
            self.models = models
        def filter(self, *_a, **_k): return self
        def join(self, *_a, **_k): return self
        def order_by(self, *_a, **_k): return self
        def all(self): return db_all_rows
        def one_or_none(self): return None
    db.query = lambda *models: Q2(*models)

    r = client.get(f"/projects/{project.id}/collaborators", headers=_EN)
    assert r.status_code == 200
    body = r.json()
    assert body[0]["frodi_used_this_cycle"] == 12.5
    assert body[0]["frodi_cap_per_cycle"] == 2000
