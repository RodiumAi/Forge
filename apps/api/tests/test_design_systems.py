"""Design systems: the table, ownership, team sharing, defaults, attach and resync, exports.

Runs against an in-memory SQLite database with the real models, so the
ownership and team queries are the ones production runs.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.db import Base, get_db
from app.models import (
    DesignSystemRecord,
    ForgeEntitlementCache,
    Project,
    ProjectCollaborator,
    TeamSeat,
    User,
)
from app.routers import design_systems as ds_router
from app.routers import documents as documents_mod
from app.services.document_scaffold import scaffold_design_system, scaffold_slides
from app.services.scaffold import DESIGN_MD, INDEX_CSS

TABLES = [
    User.__table__,
    Project.__table__,
    TeamSeat.__table__,
    ProjectCollaborator.__table__,
    DesignSystemRecord.__table__,
    ForgeEntitlementCache.__table__,
]


@pytest.fixture
def env(monkeypatch, tmp_path_factory):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    monkeypatch.setenv("FORGE_KIND_DESIGN_SYSTEM_ENABLED", "true")
    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
    clear_settings_cache()
    from app.services import history

    monkeypatch.setattr(history, "snapshot", lambda *_a, **_k: None)
    documents_mod._last_checkpoint.clear()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=TABLES)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    db = Session()
    state = SimpleNamespace(user=None)

    app = FastAPI()
    app.include_router(ds_router.router)
    app.include_router(documents_mod.router)
    app.dependency_overrides[get_current_user] = lambda: state.user

    def session():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = session

    def user(name: str) -> User:
        row = User(id=uuid.uuid4(), email=f"{name}@example.com", name=name.title())
        db.add(row)
        db.commit()
        return row

    def project(owner: User, kind: str, name: str = "Brand") -> Project:
        row = Project(
            id=uuid.uuid4(),
            user_id=owner.id,
            name=name,
            slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
            platform=kind,
            status="ready",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(row)
        db.commit()
        pid = str(row.id)
        if kind == "design_system":
            scaffold_design_system(pid, name)
        elif kind == "slides":
            scaffold_slides(pid, name)
        else:
            root = get_settings().projects_path / pid
            (root / "src").mkdir(parents=True, exist_ok=True)
            (root / "src" / "index.css").write_text(INDEX_CSS, encoding="utf-8")
            (root / "DESIGN.md").write_text(DESIGN_MD, encoding="utf-8")
        return row

    def seat(owner: User, member: User, status: str = "accepted") -> None:
        db.add(TeamSeat(id=uuid.uuid4(), owner_user_id=owner.id, email=member.email, status=status))
        db.commit()

    def act(as_user: User) -> TestClient:
        state.user = as_user
        return TestClient(app)

    yield SimpleNamespace(db=db, user=user, project=project, seat=seat, act=act, Session=Session)
    db.close()
    clear_settings_cache()


def _disk(pid, relative):
    return (get_settings().projects_path / str(pid) / relative).read_text(encoding="utf-8")


def _set_accent(client, pid, hex_value):
    doc = client.get(f"/projects/{pid}/design-system").json()
    doc["tokens"]["color"]["accent"]["$value"] = hex_value
    r = client.put(f"/projects/{pid}/design-system", json=doc)
    assert r.status_code == 200, r.text
    return r.json()


# ── listing and defaults ───────────────────────────────────────────────────


def test_list_creates_rows_lazily_with_a_preview(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Rodium")
    env.project(alice, "web", "Site")
    body = env.act(alice).get("/design-systems").json()
    assert [item["id"] for item in body["items"]] == [str(ds.id)]
    item = body["items"][0]
    assert item["scope"] == "personal" and item["can_edit"] and item["can_share"]
    assert item["preview"]["colors"][0] == "#0a0a0a"
    assert item["preview"]["display"] == "Inter"
    assert env.db.get(DesignSystemRecord, ds.id) is not None


def test_list_is_closed_while_the_kind_is_off(env, monkeypatch):
    alice = env.user("alice")
    monkeypatch.setenv("FORGE_KIND_DESIGN_SYSTEM_ENABLED", "false")
    clear_settings_cache()
    assert env.act(alice).get("/design-systems").status_code == 404


def test_one_personal_default_listed_first(env):
    alice = env.user("alice")
    first = env.project(alice, "design_system", "First")
    second = env.project(alice, "design_system", "Second")
    client = env.act(alice)
    assert client.put(f"/design-systems/{first.id}/default", json={"scope": "user"}).status_code == 200
    assert client.put(f"/design-systems/{second.id}/default", json={"scope": "user"}).status_code == 200
    body = client.get("/design-systems").json()
    assert body["default_id"] == str(second.id)
    assert body["items"][0]["id"] == str(second.id)
    defaults = [item for item in body["items"] if item["is_default_user"]]
    assert len(defaults) == 1


def test_only_the_owner_sets_a_personal_default(env):
    alice, bob = env.user("alice"), env.user("bob")
    ds = env.project(alice, "design_system")
    env.seat(alice, bob)
    env.act(alice).post(f"/design-systems/{ds.id}/share")
    r = env.act(bob).put(f"/design-systems/{ds.id}/default", json={"scope": "user"})
    assert r.status_code == 403


# ── team sharing ───────────────────────────────────────────────────────────


def test_team_members_read_but_do_not_edit(env):
    alice, bob, carol = env.user("alice"), env.user("bob"), env.user("carol")
    env.seat(alice, bob)
    ds = env.project(alice, "design_system", "Team brand")
    assert env.act(bob).get(f"/projects/{ds.id}/design-system").status_code == 404
    r = env.act(alice).post(f"/design-systems/{ds.id}/share")
    assert r.status_code == 200 and r.json()["visibility"] == "team"

    bob_client = env.act(bob)
    items = bob_client.get("/design-systems").json()["items"]
    assert [(i["id"], i["scope"], i["can_edit"]) for i in items] == [(str(ds.id), "team", False)]
    doc = bob_client.get(f"/projects/{ds.id}/design-system")
    assert doc.status_code == 200
    assert bob_client.put(f"/projects/{ds.id}/design-system", json=doc.json()).status_code == 404
    assert env.act(carol).get(f"/projects/{ds.id}/design-system").status_code == 404
    assert env.act(carol).get("/design-systems").json()["items"] == []


def test_team_admin_edits_and_chooses_the_team_default(env):
    alice, bob = env.user("alice"), env.user("bob")
    env.seat(alice, bob)
    ds = env.project(bob, "design_system", "Member brand")
    r = env.act(bob).post(f"/design-systems/{ds.id}/share")
    assert r.json()["team_id"] == str(alice.id)
    assert env.act(bob).put(f"/design-systems/{ds.id}/default", json={"scope": "team"}).status_code == 403
    admin = env.act(alice)
    assert admin.put(f"/design-systems/{ds.id}/default", json={"scope": "team"}).status_code == 200
    _set_accent(admin, ds.id, "#123456")
    body = env.act(bob).get("/design-systems").json()
    assert body["items"][0]["is_default_team"] and body["default_id"] == str(ds.id)


def test_unshare_takes_it_back(env):
    alice, bob = env.user("alice"), env.user("bob")
    env.seat(alice, bob)
    ds = env.project(alice, "design_system")
    env.act(alice).post(f"/design-systems/{ds.id}/share")
    assert env.act(alice).delete(f"/design-systems/{ds.id}/share").json()["visibility"] == "private"
    assert env.act(bob).get(f"/projects/{ds.id}/design-system").status_code == 404


def test_sharing_needs_a_team(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system")
    r = env.act(alice).post(f"/design-systems/{ds.id}/share")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NO_TEAM"


@pytest.mark.parametrize(("granted", "status"), [(False, 403), (True, 200)])
def test_sharing_follows_the_cloud_right(env, monkeypatch, granted, status):
    from app.services import entitlements

    alice, bob = env.user("alice"), env.user("bob")
    env.seat(alice, bob)
    ds = env.project(alice, "design_system")
    monkeypatch.setattr(entitlements, "entitlements_apply", lambda _u: True)
    monkeypatch.setattr(
        entitlements,
        "get_entitlements",
        lambda _db, _u: SimpleNamespace(plan_slug="pro", design_system_sharing=granted),
    )
    r = env.act(alice).post(f"/design-systems/{ds.id}/share")
    assert r.status_code == status
    if not granted:
        assert r.json()["detail"]["code"] == "FEATURE_NOT_IN_PLAN"


# ── attach and resync ──────────────────────────────────────────────────────


def test_attach_dresses_a_site_and_resync_is_proposed_not_applied(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Acme")
    site = env.project(alice, "web", "Site")
    client = env.act(alice)
    _set_accent(client, ds.id, "#c2410c")

    r = client.put(f"/projects/{site.id}/design-system-link", json={"design_system_id": str(ds.id)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["outdated"] is False and set(body["written"]) == {"DESIGN.md", "src/index.css"}
    assert "--accent: #c2410c" in _disk(site.id, "src/index.css")
    assert "fonts.googleapis.com" in _disk(site.id, "src/index.css")
    assert "Acme" in _disk(site.id, "DESIGN.md")

    _set_accent(client, ds.id, "#15803d")
    status = client.get(f"/projects/{site.id}/design-system-link").json()
    assert status["outdated"] is True
    css_change = next(c for c in status["changes"] if c["path"] == "src/index.css")
    assert {"name": "--accent", "from": "#c2410c", "to": "#15803d"} in css_change["tokens"]
    # Proposed only: nothing written yet.
    assert "--accent: #c2410c" in _disk(site.id, "src/index.css")

    stale = client.post(f"/projects/{site.id}/design-system-link/resync", json={"version": 1})
    assert stale.status_code == 409
    applied = client.post(
        f"/projects/{site.id}/design-system-link/resync", json={"version": status["design_system"]["version"]}
    )
    assert applied.status_code == 200 and applied.json()["outdated"] is False
    assert "--accent: #15803d" in _disk(site.id, "src/index.css")


def test_attach_a_deck_points_its_theme_at_the_design_system(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Acme")
    deck = env.project(alice, "slides", "Pitch")
    r = env.act(alice).put(f"/projects/{deck.id}/design-system-link", json={"design_system_id": str(ds.id)})
    assert r.status_code == 200
    assert json.loads(_disk(deck.id, "deck.json"))["theme"]["designSystem"] == str(ds.id)
    assert "--font-display:" in _disk(deck.id, "DESIGN.md")


def test_attach_needs_access_to_both_sides(env):
    alice, mallory = env.user("alice"), env.user("mallory")
    ds = env.project(alice, "design_system")
    theirs = env.project(mallory, "web", "Theirs")
    mine = env.project(mallory, "web", "Mine")
    assert (
        env.act(mallory)
        .put(f"/projects/{mine.id}/design-system-link", json={"design_system_id": str(ds.id)})
        .status_code
        == 404
    )
    assert (
        env.act(alice)
        .put(f"/projects/{theirs.id}/design-system-link", json={"design_system_id": str(ds.id)})
        .status_code
        == 404
    )


def test_team_member_attaches_a_team_design_system(env):
    alice, bob = env.user("alice"), env.user("bob")
    env.seat(alice, bob)
    ds = env.project(alice, "design_system", "Team")
    env.act(alice).post(f"/design-systems/{ds.id}/share")
    site = env.project(bob, "web", "Bob site")
    r = env.act(bob).put(f"/projects/{site.id}/design-system-link", json={"design_system_id": str(ds.id)})
    assert r.status_code == 200 and r.json()["design_system"]["name"] == "Team"


def test_detach_keeps_the_files(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Acme")
    site = env.project(alice, "web", "Site")
    client = env.act(alice)
    client.put(f"/projects/{site.id}/design-system-link", json={"design_system_id": str(ds.id)})
    body = client.delete(f"/projects/{site.id}/design-system-link").json()
    assert body["design_system"] is None
    assert "Acme" in _disk(site.id, "DESIGN.md")


# ── exports ────────────────────────────────────────────────────────────────


def test_text_exports(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Acme Brand")
    client = env.act(alice)
    tokens = client.get(f"/projects/{ds.id}/design-system/export/tokens")
    assert tokens.status_code == 200
    assert 'filename="acme-brand.tokens.json"' in tokens.headers["content-disposition"]
    tree = tokens.json()
    assert tree["color"]["accent"]["$value"] == "#f2620a" and "font" in tree
    css = client.get(f"/projects/{ds.id}/design-system/export/css").text
    assert ":root {" in css and "--accent: #f2620a;" in css and "--font-display:" in css
    tailwind = client.get(f"/projects/{ds.id}/design-system/export/tailwind").text
    assert "module.exports" in tailwind and '"accent": "var(--accent)"' in tailwind
    assert client.get(f"/projects/{ds.id}/design-system/export/svg").status_code == 400


def test_exports_follow_the_plan(env, monkeypatch):
    from app.services import entitlements

    alice = env.user("alice")
    ds = env.project(alice, "design_system")
    plan = SimpleNamespace(plan_slug="free", export_pdf=False)
    monkeypatch.setattr(entitlements, "entitlements_apply", lambda _u: True)
    monkeypatch.setattr(entitlements, "get_entitlements", lambda _db, _u: plan)
    client = env.act(alice)
    assert client.get(f"/projects/{ds.id}/design-system/export/css").status_code == 403
    plan.plan_slug = "starter"
    assert client.get(f"/projects/{ds.id}/design-system/export/css").status_code == 200
    assert client.get(f"/projects/{ds.id}/design-system/export/pdf").status_code == 403


def test_pdf_export_prints_the_guidelines(env, monkeypatch):
    from app.services.design_system import exports

    seen = {}

    def fake_print(html: str) -> bytes:
        seen["html"] = html
        return b"%PDF-1.7 fake"

    monkeypatch.setattr(exports, "_print_pdf", fake_print)
    alice = env.user("alice")
    ds = env.project(alice, "design_system", "Acme")
    r = env.act(alice).get(f"/projects/{ds.id}/design-system/export/pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert "Acme" in seen["html"] and "data:image/svg+xml;base64," in seen["html"]


def test_put_refreshes_the_contrast_notes(env):
    alice = env.user("alice")
    ds = env.project(alice, "design_system")
    doc = _set_accent(env.act(alice), ds.id, "#111111")
    checks = doc["tokens"]["color"]["accent-contrast"]["$extensions"]["forge"]["contrast"]
    assert checks[0]["on"] == "accent"
    assert checks[0]["ratio"] < 4.5  # the note tells the truth about the saved colours
