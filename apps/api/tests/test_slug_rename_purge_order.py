"""Slug rename must purge object-store prefix BEFORE freeing the slug in Postgres.

Regression for the cross-tenant TOCTOU where commit() released uniqueness first,
then delete_prefix() listed+deleted whatever lived under the prefix — including a
stranger's freshly published site (CWE-367 / CWE-284).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import sqlalchemy.orm as sa_orm
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache
from app.db import get_db
from app.routers import projects as projects_mod


@pytest.fixture
def rename_api(tmp_path_factory, monkeypatch):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()
    monkeypatch.setattr(sa_orm.Session, "object_session", staticmethod(lambda _obj: None))

    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="owner@example.com",
        email_verified_at=datetime.now(UTC),
        rodium_sub=None,
    )
    project = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Race Site",
        slug="raceslug-poc",
        status="ready",
        preview_port=None,
        preview_running=False,
        template_id=None,
        platform="web",
        published_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db = MagicMock()
    db.get.side_effect = lambda _model, key: project if str(key) == str(project.id) else None
    # No slug clash for the new name.
    db.query.return_value.filter.return_value.first.return_value = None
    db.refresh.side_effect = lambda obj: None

    order: list[str] = []

    def fake_purge(slug: str) -> int:
        order.append(f"purge:{slug}")
        # Slug must still be reserved in DB while we purge.
        assert project.slug == "raceslug-poc-moved"
        assert "commit" not in order
        return 3

    def fake_commit():
        order.append("commit")

    db.commit.side_effect = fake_commit
    monkeypatch.setattr(projects_mod, "purge_site_prefix", fake_purge)

    app = FastAPI()
    app.include_router(projects_mod.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    yield TestClient(app), project, db, order
    clear_settings_cache()


def test_slug_rename_purges_before_commit(rename_api):
    client, project, _db, order = rename_api

    response = client.patch(
        f"/projects/{project.id}",
        json={"slug": "raceslug-poc-moved"},
        headers={"Accept-Language": "en"},
    )

    assert response.status_code == 200, response.text
    assert project.slug == "raceslug-poc-moved"
    assert order == ["purge:raceslug-poc", "commit"]
    assert response.json()["slug"] == "raceslug-poc-moved"


def test_slug_rename_aborts_when_purge_fails(rename_api, monkeypatch):
    client, project, _db, order = rename_api

    def boom(slug: str) -> int:
        order.append(f"purge:{slug}")
        raise RuntimeError("minio down")

    monkeypatch.setattr(projects_mod, "purge_site_prefix", boom)

    response = client.patch(
        f"/projects/{project.id}",
        json={"slug": "raceslug-poc-moved"},
        headers={"Accept-Language": "en"},
    )

    assert response.status_code == 503
    assert "commit" not in order
    # Session rolled back — rename must not stick as committed.
    assert order == ["purge:raceslug-poc"]
