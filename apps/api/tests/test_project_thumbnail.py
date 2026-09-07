"""Persisted project JPEG thumbnails."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user, get_media_user, media_token_for_user, token_for_user
from app.db import get_db
from app.routers import projects as projects_router
from app.services.filesystem import project_dir, write_bytes

# Tiny valid JPEG (1x1).
_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x7f\xbf\xff\xd9"
)


@pytest.fixture
def thumb_app(tmp_path_factory, monkeypatch):
    root = tmp_path_factory.mktemp("projects")
    monkeypatch.setenv("PROJECTS_ROOT", str(root))
    from app.config import clear_settings_cache

    clear_settings_cache()

    user = SimpleNamespace(
        id=uuid.uuid4(),
        token_version=0,
        email="thumb@example.com",
        password_hash=None,
        email_verified_at=datetime.now(UTC),
    )
    project = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Thumb",
        slug="thumb",
        status="ready",
        preview_port=None,
        preview_running=False,
        template_id=None,
        published_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db = MagicMock()
    db.get.side_effect = lambda model, key: project if str(key) == str(project.id) else user

    # Session.object_session used by _project_out — pretend no domain session.
    import sqlalchemy.orm as sa_orm

    monkeypatch.setattr(sa_orm.Session, "object_session", staticmethod(lambda _obj: None))

    app = FastAPI()
    app.include_router(projects_router.router)

    def _user():
        return user

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_media_user] = _user
    app.dependency_overrides[get_db] = lambda: db

    # _owned_project uses db.get(Project, id)
    def _get(model, key):
        if str(key) == str(project.id):
            return project
        if str(key) == str(user.id):
            return user
        return None

    db.get.side_effect = _get

    client = TestClient(app)
    yield client, user, project, db
    clear_settings_cache()


class TestProjectThumbnail:
    def test_put_then_get_jpeg(self, thumb_app):
        client, user, project, _db = thumb_app
        pid = str(project.id)

        put = client.put(
            f"/projects/{pid}/thumbnail",
            content=_JPEG,
            headers={"Content-Type": "image/jpeg"},
        )
        assert put.status_code == 200
        assert put.json()["has_thumbnail"] is True
        assert (project_dir(pid) / "thumbnail.jpg").is_file()

        media = media_token_for_user(user)
        got = client.get(f"/projects/{pid}/thumbnail?access_token={media}")
        assert got.status_code == 200
        assert got.headers["content-type"].startswith("image/jpeg")
        assert got.content.startswith(b"\xff\xd8\xff")

    def test_get_missing_is_404(self, thumb_app):
        client, user, project, _db = thumb_app
        media = media_token_for_user(user)
        res = client.get(f"/projects/{project.id}/thumbnail?access_token={media}")
        assert res.status_code == 404

    def test_put_rejects_non_jpeg(self, thumb_app):
        client, _user, project, _db = thumb_app
        res = client.put(
            f"/projects/{project.id}/thumbnail",
            content=b"not-a-jpeg",
            headers={"Content-Type": "image/jpeg"},
        )
        assert res.status_code == 400

    def test_has_thumbnail_helper(self, thumb_app):
        _client, _user, project, _db = thumb_app
        pid = str(project.id)
        assert projects_router._has_thumbnail(pid) is False
        write_bytes(pid, "thumbnail.jpg", _JPEG)
        assert projects_router._has_thumbnail(pid) is True

    def test_session_token_in_query_still_refused_on_get(self, thumb_app, monkeypatch):
        # GET uses get_media_user — session JWT in query must not work.
        client, user, project, _db = thumb_app
        # Drop override so real get_media_user runs for this check.
        app = client.app
        app.dependency_overrides.pop(get_media_user, None)

        # Need a real db.get for user resolve — keep override for get_db
        session = token_for_user(user)
        res = client.get(f"/projects/{project.id}/thumbnail?access_token={session}")
        assert res.status_code == 401
