"""Published-site intake: form submissions and visit counting.

Pure helpers run everywhere. The SQL paths need Postgres: they run when
FORGE_TEST_DATABASE_URL points at a disposable database (never a real one:
the test creates and drops its own rows and tables).
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import pytest

from app.services import site_events


class TestHelpers:
    def test_submission_is_normalised_and_bounded(self):
        name, fields = site_events.clean_submission(
            "Contact Form!", {"email": "a@b.co", "tags": ["x", "y"], "ok": True, "n": None}
        )
        assert name == "contact-form"
        assert fields == {"email": "a@b.co", "tags": "x, y", "ok": "yes", "n": ""}
        assert site_events.clean_submission("x", {}) is None
        assert site_events.clean_submission("x", "not a dict") is None
        huge = {f"k{i}": "v" * 4000 for i in range(20)}
        assert site_events.clean_submission("x", huge) is None

    def test_honeypot_and_bots(self):
        assert site_events.is_honeypot_hit({"_gotcha": "spam"})
        assert not site_events.is_honeypot_hit({"_gotcha": "", "email": "a@b.co"})
        assert site_events.is_bot("Googlebot/2.1")
        assert site_events.is_bot("")
        assert not site_events.is_bot("Mozilla/5.0 (iPhone) Safari/605")

    def test_visitor_hash_rotates_daily_and_hides_the_address(self):
        a = site_events.visitor_hash("1.2.3.4", "ua", "2026-10-09")
        assert a == site_events.visitor_hash("1.2.3.4", "ua", "2026-10-09")
        assert a != site_events.visitor_hash("1.2.3.4", "ua", "2026-10-10")
        assert "1.2.3.4" not in a

    def test_slug_from_the_site_host(self, monkeypatch):
        from app.config import clear_settings_cache

        monkeypatch.setenv("SITES_BASE_DOMAIN", "forge.example:8080")
        clear_settings_cache()
        try:
            assert site_events.slug_for_host("fournil.forge.example") == "fournil"
            assert site_events.slug_for_host("a.b.forge.example") is None
            assert site_events.slug_for_host("") is None
        finally:
            clear_settings_cache()


class TestPublicCors:
    def test_intake_routes_answer_any_origin_others_do_not(self):
        from fastapi.testclient import TestClient

        from app.main import app

        client = TestClient(app)
        pre = client.options(
            "/v1/sites/forms",
            headers={"Origin": "https://exported.example", "Access-Control-Request-Method": "POST"},
        )
        assert pre.status_code == 204
        assert pre.headers["access-control-allow-origin"] == "*"
        other = client.options(
            "/projects",
            headers={"Origin": "https://exported.example", "Access-Control-Request-Method": "GET"},
        )
        assert other.headers.get("access-control-allow-origin") != "*"


DB_URL = os.environ.get("FORGE_TEST_DATABASE_URL")


@pytest.mark.skipif(not DB_URL, reason="FORGE_TEST_DATABASE_URL not set")
class TestWithPostgres:
    @pytest.fixture
    def db(self, monkeypatch):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from app.models import Base

        engine = create_engine(DB_URL)
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine)()
        yield session
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()

    def _project(self, db):
        from app.models import Project, User

        user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com", name="Owner")
        db.add(user)
        db.flush()
        project = Project(id=uuid.uuid4(), user_id=user.id, name="Fournil", slug=f"s{uuid.uuid4().hex[:8]}")
        project.published_at = datetime.now(UTC)
        db.add(project)
        db.commit()
        return project

    def test_visits_count_views_and_unique_visitors(self, db, monkeypatch):
        from app.models import SitePageDay, SiteUsageDay

        monkeypatch.setattr(site_events, "_first_visit_today", lambda _p, _d, v: v == "first")
        project = self._project(db)
        site_events.record_visit(db, project, path="/carte?x=1", visitor="first")
        site_events.record_visit(db, project, path="/carte", visitor="again")
        site_events.record_visit(db, project, path="/", visitor="again")
        row = db.query(SiteUsageDay).filter_by(project_id=project.id).one()
        assert (row.page_views, row.unique_visitors) == (3, 1)
        pages = {p.path: p.views for p in db.query(SitePageDay).filter_by(project_id=project.id)}
        assert pages == {"/carte": 2, "/": 1}

    def test_submission_is_stored_without_honeypot_fields(self, db):
        import json

        project = self._project(db)
        row = site_events.store_submission(
            db,
            project,
            form="contact",
            fields={"email": "a@b.co", "_gotcha": ""},
            page="/contact",
            visitor="h",
        )
        assert json.loads(row.data_json) == {"email": "a@b.co"}
        assert site_events.published_project(db, project.slug).id == project.id
