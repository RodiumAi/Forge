"""Reserved project slugs.

A project's slug becomes its public subdomain ({slug}.<sites domain>), so a user
must not be able to claim names the platform uses, or that visitors would read
as ours (login., auth., support., ...). This is the slug-side counterpart of the
reserved-hostname check for custom domains (see test_domains.py).

Two kinds of input reach a slug:

- a slug the user sets explicitly (the `slug` field of PATCH): they chose that
  name on purpose, so a reserved one is refused with a 400;
- a slug derived from a project name (creating a project, or renaming an
  unpublished one): the user never typed a slug, so it falls back to
  "<name>-app" rather than failing.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import sqlalchemy.orm as sa_orm
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache
from app.db import get_db
from app.i18n import t
from app.routers import projects as projects_mod

EN = {"Accept-Language": "en"}
RESERVED_MESSAGE = t("slug_reserved", "en")

REPORTED_NAMES = ["login", "auth", "www", "api", "admin", "sites"]


@pytest.fixture
def api(tmp_path_factory, monkeypatch):
    """The projects router with a fake session; nothing touches a database."""
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()

    monkeypatch.setattr(projects_mod.rate_limit, "enforce", lambda *_a, **_k: None)
    monkeypatch.setattr(projects_mod, "scaffold_vite_react", lambda *_a, **_k: None)
    monkeypatch.setattr(projects_mod, "capture_for_user", lambda *_a, **_k: None)
    monkeypatch.setattr(projects_mod, "purge_site_prefix", lambda *_a, **_k: 0)
    # _project_out asks the ORM which session owns the project; there is none.
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
        name="My Site",
        slug="my-site",
        status="ready",
        preview_port=None,
        preview_running=False,
        template_id=None,
        published_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db = _free_slugs_db()
    db.get.side_effect = lambda _model, key: project if str(key) == str(project.id) else None

    def fake_refresh(obj):
        # What the database fills in on insert.
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        obj.created_at = obj.updated_at = datetime.now(UTC)
        obj.preview_running = False

    db.refresh.side_effect = fake_refresh

    app = FastAPI()
    app.include_router(projects_mod.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    yield TestClient(app), project, db
    clear_settings_cache()


def _free_slugs_db() -> MagicMock:
    """A session where no slug is taken and the user owns no projects yet.

    Every .filter() returns the same query, so the answers hold however many
    filters a route chains. (A bare MagicMock would report a clash forever, and
    the suffix loop in _unique_slug_excluding would never end.)
    """
    db = MagicMock()
    query = db.query.return_value
    query.filter.return_value = query
    query.scalar.return_value = 0
    query.first.return_value = None
    return db


def _created_slug(db: MagicMock) -> str:
    """The slug of the Project row the route added (the first add(); the second is the Chat)."""
    return db.add.call_args_list[0].args[0].slug


# ── The denylist itself ────────────────────────────────────────────────────


class TestDenylist:
    def test_entries_are_already_in_slug_form(self):
        # A slug is compared after _slugify(), so an entry that _slugify() would
        # rewrite (uppercase, underscores, spaces) could never match anything.
        assert all(projects_mod._slugify(name) == name for name in projects_mod.RESERVED_SLUGS)

    def test_the_fallback_never_lands_on_another_reserved_name(self):
        # The "-app" fallback is applied once; this keeps that sufficient.
        assert not any(f"{name}-app" in projects_mod.RESERVED_SLUGS for name in projects_mod.RESERVED_SLUGS)

    @pytest.mark.parametrize("name", REPORTED_NAMES)
    def test_the_names_from_the_report_are_reserved(self, name):
        assert name in projects_mod.RESERVED_SLUGS

    @pytest.mark.parametrize("name", sorted(projects_mod.RESERVED_SLUGS))
    def test_an_explicit_reserved_slug_is_refused(self, name):
        with pytest.raises(HTTPException) as exc:
            projects_mod._reject_reserved_slug(name, "en")
        assert exc.value.status_code == 400
        assert exc.value.detail == RESERVED_MESSAGE

    def test_a_normal_explicit_slug_is_not_refused(self):
        projects_mod._reject_reserved_slug("my-portfolio", "en")
        projects_mod._reject_reserved_slug("admin-app", "en")


class TestDerivedSlug:
    @pytest.mark.parametrize("name", sorted(projects_mod.RESERVED_SLUGS))
    def test_a_reserved_name_falls_back_to_the_app_suffix(self, name):
        assert projects_mod._unique_slug(_free_slugs_db(), name) == f"{name}-app"

    def test_the_fallback_still_goes_through_the_uniqueness_loop(self):
        db = _free_slugs_db()
        db.query.return_value.first.side_effect = [object(), object(), None]  # login-app, login-app-2 taken

        assert projects_mod._unique_slug(db, "login") == "login-app-3"

    def test_a_normal_name_is_untouched(self):
        assert projects_mod._unique_slug(_free_slugs_db(), "My Portfolio") == "my-portfolio"

    def test_a_reserved_word_inside_a_longer_name_is_left_alone(self):
        assert projects_mod._unique_slug(_free_slugs_db(), "Login Page") == "login-page"
        assert projects_mod._unique_slug(_free_slugs_db(), "admin-2") == "admin-2"


# ── POST /projects ─────────────────────────────────────────────────────────


class TestCreateProject:
    @pytest.mark.parametrize("name", REPORTED_NAMES)
    def test_a_reserved_name_is_created_under_the_app_suffix(self, api, name):
        client, _project, db = api

        response = client.post("/projects", json={"name": name}, headers=EN)

        assert response.status_code == 201
        assert response.json()["slug"] == f"{name}-app"
        assert response.json()["name"] == name  # the display name is what the user typed
        assert _created_slug(db) == f"{name}-app"

    @pytest.mark.parametrize(
        ("name", "slug"),
        [
            ("Admin", "admin-app"),
            ("  ADMIN  ", "admin-app"),
            ("Admin!", "admin-app"),
            ("No Reply", "no-reply-app"),
            ("no_reply", "no-reply-app"),
        ],
    )
    def test_it_is_the_slug_that_counts_not_the_spelling(self, api, name, slug):
        client, _project, db = api

        response = client.post("/projects", json={"name": name}, headers=EN)

        assert response.status_code == 201
        assert _created_slug(db) == slug

    @pytest.mark.parametrize(
        ("name", "slug"), [("My Portfolio", "my-portfolio"), ("Login Page", "login-page")]
    )
    def test_a_normal_name_is_created_as_is(self, api, name, slug):
        client, _project, db = api

        response = client.post("/projects", json={"name": name}, headers=EN)

        assert response.status_code == 201
        assert response.json()["slug"] == slug
        assert _created_slug(db) == slug


# ── PATCH /projects/{id} ───────────────────────────────────────────────────


class TestUpdateProject:
    @pytest.mark.parametrize("slug", ["admin", "Admin", "no reply"])
    def test_an_explicit_reserved_slug_is_refused(self, api, slug):
        client, project, db = api

        response = client.patch(f"/projects/{project.id}", json={"slug": slug}, headers=EN)

        assert response.status_code == 400
        assert response.json()["detail"] == RESERVED_MESSAGE
        assert project.slug == "my-site"
        db.commit.assert_not_called()

    def test_the_refusal_is_localized(self, api):
        client, project, _db = api

        response = client.patch(f"/projects/{project.id}", json={"slug": "admin"})  # default locale

        assert response.status_code == 400
        assert response.json()["detail"] == t("slug_reserved", "fr")

    def test_a_normal_explicit_slug_is_accepted(self, api):
        client, project, _db = api

        response = client.patch(f"/projects/{project.id}", json={"slug": "my-new-site"}, headers=EN)

        assert response.status_code == 200
        assert response.json()["slug"] == "my-new-site"

    def test_renaming_an_unpublished_project_derives_the_suffixed_slug(self, api):
        # The display name drives the slug while a project is unpublished. The
        # user did not type a slug, so "Admin" is renamed, not refused, and the
        # slug still cannot become "admin".
        client, project, db = api

        response = client.patch(f"/projects/{project.id}", json={"name": "Admin"}, headers=EN)

        assert response.status_code == 200
        assert response.json()["name"] == "Admin"
        assert response.json()["slug"] == "admin-app"
        assert project.slug == "admin-app"
        db.commit.assert_called()

    def test_a_published_project_keeps_its_slug_when_renamed(self, api):
        # Once published the slug is no longer derived from the name.
        client, project, _db = api
        project.published_at = datetime.now(UTC)

        response = client.patch(f"/projects/{project.id}", json={"name": "Admin"}, headers=EN)

        assert response.status_code == 200
        assert response.json()["slug"] == "my-site"
