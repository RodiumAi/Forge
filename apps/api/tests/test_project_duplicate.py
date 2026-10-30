"""POST /projects/{id}/duplicate: a private copy of a project."""

from __future__ import annotations

import uuid

from test_project_journey import EN, _build_client, _project, _user
from test_project_kinds import flags  # noqa: F401  (fixture)

from app.config import get_settings

FR = {"Accept-Language": "fr"}


def _seed(project) -> None:
    root = get_settings().projects_path / str(project.id)
    (root / "slides").mkdir(parents=True)
    (root / "deck.json").write_text('{"title": "Pitch"}', encoding="utf-8")
    (root / "slides" / "s1.json").write_text('{"id": "s1"}', encoding="utf-8")
    (root / "node_modules").mkdir()
    (root / "node_modules" / "x.js").write_text("x", encoding="utf-8")


def _files(project_id: str) -> dict[str, str]:
    root = get_settings().projects_path / project_id
    return {
        p.relative_to(root).as_posix(): p.read_text(encoding="utf-8")
        for p in root.rglob("*")
        if p.is_file() and ".git" not in p.relative_to(root).parts and p.name != ".gitignore"
    }


def _source(user):
    project = _project(user.id)
    project.name = "Pitch"
    project.platform = "slides"
    project.design_brief = "Bold"
    project.design_system_project_id = None
    project.design_system_version = None
    return project


def test_duplicate_copies_files_and_adds_copie(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    source = _source(user)
    client = _build_client(monkeypatch, tmp_path_factory, user=user, project=source, limit=3, plan="starter")
    _seed(source)
    flags("slides")

    r = client.post(f"/projects/{source.id}/duplicate", headers=FR)
    assert r.status_code == 201, r.text
    copy = r.json()
    assert copy["id"] != str(source.id)
    assert copy["name"] == "Pitch - copie"
    assert copy["platform"] == "slides"
    assert _files(copy["id"]) == {"deck.json": '{"title": "Pitch"}', "slides/s1.json": '{"id": "s1"}'}


def test_duplicate_name_in_english(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    source = _source(user)
    client = _build_client(monkeypatch, tmp_path_factory, user=user, project=source, limit=3, plan="starter")
    _seed(source)
    flags("slides")
    r = client.post(f"/projects/{source.id}/duplicate", headers=EN)
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Pitch - copy"


def test_duplicate_respects_the_project_quota(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    user = _user()
    source = _source(user)
    client = _build_client(monkeypatch, tmp_path_factory, user=user, project=source, limit=1, used=1)
    _seed(source)
    flags("slides")
    r = client.post(f"/projects/{source.id}/duplicate", headers=EN)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "project_quota_exceeded"


def test_only_the_owner_can_duplicate(monkeypatch, tmp_path_factory, flags):  # noqa: F811
    source = _source(_user())
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), project=source, limit=3)
    _seed(source)
    flags("slides")
    r = client.post(f"/projects/{source.id}/duplicate", headers=EN)
    assert r.status_code == 404


def test_duplicate_unknown_project_is_404(monkeypatch, tmp_path_factory):
    client = _build_client(monkeypatch, tmp_path_factory, user=_user(), limit=3)
    r = client.post(f"/projects/{uuid.uuid4()}/duplicate", headers=EN)
    assert r.status_code == 404
