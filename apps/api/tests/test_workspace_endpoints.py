"""Dashboard read models (activity, usage) and POST /projects/{id}/duplicate."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import sqlalchemy.orm as sa_orm
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_project_journey import EN, _project, _user

import app.services.entitlements as ent_mod
from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.db import get_db
from app.models import AgentRun, Project
from app.routers import workspace as ws

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)  # a Wednesday


def _run(project_id, status="running", minutes_ago=5, plan=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        chat_id=uuid.uuid4(),
        project_id=project_id,
        status=status,
        updated_at=NOW - timedelta(minutes=minutes_ago),
        plan_json=json.dumps(plan) if plan is not None else None,
    )


def test_plan_steps_reads_titles_and_states():
    raw = json.dumps(
        [
            {"title": "Pages", "status": "done"},
            {"title": "Pricing", "status": "running"},
            {"title": ""},
            "junk",
            {"title": "Check", "status": "pending"},
        ]
    )
    assert ws.plan_steps(raw) == [
        {"title": "Pages", "status": "done"},
        {"title": "Pricing", "status": "running"},
        {"title": "Check", "status": "pending"},
    ]
    assert ws.plan_steps(None) == []
    assert ws.plan_steps("{not json") == []
    assert ws.plan_steps(json.dumps({"title": "x"})) == []


def test_summarize_runs_keeps_the_latest_run_per_project():
    p1, p2, p3 = (SimpleNamespace(id=uuid.uuid4(), name=n, platform="web") for n in ("A", "B", "C"))
    projects = {str(p.id): p for p in (p1, p2, p3)}
    runs = [
        _run(
            p1.id,
            "running",
            2,
            plan=[{"title": "One", "status": "done"}, {"title": "Two", "status": "running"}],
        ),
        _run(p2.id, "error", 10),
        _run(p1.id, "done", 60),  # older run of p1: ignored
        _run(p3.id, "running", 60 * 5),  # stale: state kept, not active
        _run(uuid.uuid4(), "running", 1),  # not the user's project
    ]
    out = ws.summarize_runs(runs, projects, now=NOW)
    assert out["states"] == {str(p1.id): "running", str(p2.id): "error", str(p3.id): "running"}
    assert len(out["active"]) == 1
    card = out["active"][0]
    assert card["project_id"] == str(p1.id)
    assert card["project_name"] == "A"
    assert card["done"] == 1
    assert [s["title"] for s in card["steps"]] == ["One", "Two"]


def test_bucket_usage_groups_by_week_and_kind():
    first = ws.week_start(NOW) - timedelta(weeks=2)
    rows = [
        (NOW, "web"),
        (NOW - timedelta(days=1), "slides"),
        (NOW - timedelta(weeks=1), "web"),
        (NOW - timedelta(weeks=2), "unknown-kind"),  # falls back to web
        (NOW - timedelta(weeks=5), "web"),  # before the window
    ]
    weeks = ws.bucket_usage(rows, first, 3)
    assert [w["start"] for w in weeks] == ["2026-10-05", "2026-10-12", "2026-10-19"]
    assert weeks[2]["counts"]["web"] == 1 and weeks[2]["counts"]["slides"] == 1
    assert weeks[1]["counts"]["web"] == 1
    assert weeks[0]["counts"]["web"] == 1
    assert set(weeks[0]["counts"]) >= {"web", "mobile", "slides", "codelab", "design_system"}


def test_week_start_is_monday_utc():
    assert ws.week_start(NOW) == datetime(2026, 10, 19, tzinfo=UTC)


# ---------------------------------------------------------------- endpoints


class _Query:
    def __init__(self, rows=(), scalar=0):
        self._rows = list(rows)
        self._scalar = scalar

    def filter(self, *_a, **_k):
        return self

    def join(self, *_a, **_k):
        return self

    def order_by(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def with_for_update(self, *_a, **_k):
        return self

    def one(self):
        return SimpleNamespace()

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows

    def first(self):
        return None


def _client(monkeypatch, tmp_path_factory, *, user, owned=(), runs=(), used=0, limit=None):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()
    monkeypatch.setattr(ws.rate_limit, "enforce", lambda *_a, **_k: None)
    monkeypatch.setattr(ws, "capture_for_user", lambda *_a, **_k: None)
    monkeypatch.setattr(sa_orm.Session, "object_session", staticmethod(lambda _obj: None))
    monkeypatch.setattr(ent_mod, "max_projects_for", lambda _db, _u, _fallback: limit)
    monkeypatch.setattr(ent_mod, "get_entitlements", lambda _db, _u: SimpleNamespace(plan_slug="free"))
    added: list = []

    def query(*entities, **_k):
        first = entities[0] if entities else None
        if first is Project:
            return _Query(owned)
        if first is AgentRun:
            return _Query(runs)
        return _Query(scalar=used)

    def get(model, key):
        if model is Project:
            return next((p for p in owned if str(p.id) == str(key)), None)
        return None

    def refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        obj.created_at = obj.updated_at = datetime.now(UTC)
        obj.preview_running = False
        obj.preview_port = None

    db = SimpleNamespace(
        query=query,
        get=get,
        add=added.append,
        delete=lambda *_a: None,
        commit=lambda: None,
        refresh=refresh,
        added=added,
    )
    app = FastAPI()
    app.include_router(ws.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app), db


def test_activity_endpoint(monkeypatch, tmp_path_factory):
    user = _user()
    project = _project(user.id)
    runs = [_run(project.id, "running", 0, plan=[{"title": "Pages", "status": "running"}])]
    for run in runs:
        run.updated_at = datetime.now(UTC)
    client, _db = _client(monkeypatch, tmp_path_factory, user=user, owned=[project], runs=runs)
    r = client.get("/workspace/activity")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["states"] == {str(project.id): "running"}
    assert body["active"][0]["steps"] == [{"title": "Pages", "status": "running"}]


def test_usage_endpoint_rejects_bad_weeks(monkeypatch, tmp_path_factory):
    client, _db = _client(monkeypatch, tmp_path_factory, user=_user())
    assert client.get("/workspace/usage?weeks=0").status_code == 422
    r = client.get("/workspace/usage?weeks=4")
    assert r.status_code == 200
    assert len(r.json()["weeks"]) == 4
    assert r.json()["unit"] == "generations"


def test_duplicate_copies_the_files(monkeypatch, tmp_path_factory):
    user = _user()
    source = _project(user.id)
    source.design_brief = "Bakery"
    client, db = _client(monkeypatch, tmp_path_factory, user=user, owned=[source], limit=5, used=1)
    root = get_settings().projects_path / str(source.id)
    (root / "src").mkdir(parents=True)
    (root / "src" / "App.tsx").write_text("export default 1", encoding="utf-8")
    (root / "node_modules" / "x").mkdir(parents=True)
    r = client.post(f"/projects/{source.id}/duplicate", headers=EN)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "My Site (copy)"
    assert body["platform"] == "web"
    copy_root = get_settings().projects_path / body["id"]
    assert (copy_root / "src" / "App.tsx").read_text(encoding="utf-8") == "export default 1"
    assert not (copy_root / "node_modules").exists()
    assert any(getattr(obj, "title", None) == "Main" for obj in db.added)


def test_duplicate_respects_the_plan_quota(monkeypatch, tmp_path_factory):
    user = _user()
    source = _project(user.id)
    client, _db = _client(monkeypatch, tmp_path_factory, user=user, owned=[source], limit=1, used=1)
    r = client.post(f"/projects/{source.id}/duplicate", headers=EN)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "project_quota_exceeded"


def test_duplicate_of_someone_elses_project_is_404(monkeypatch, tmp_path_factory):
    user = _user()
    other = _project(uuid.uuid4())
    client, _db = _client(monkeypatch, tmp_path_factory, user=user, owned=[other], limit=5)
    r = client.post(f"/projects/{other.id}/duplicate", headers=EN)
    assert r.status_code == 404
