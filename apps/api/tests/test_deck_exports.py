"""Forge Design deck exports and publishing: gating, sites, HTML inlining, PPTX images, routes.

The Chromium and node pipeline runs in ``test_deck_exports_render.py``
(skipped when Chromium or the deck runtime is missing).
"""

from __future__ import annotations

import base64
import hashlib
import html as htmllib
import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from deck_fixture import build_deck_project
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache
from app.db import get_db
from app.errors import SitesError
from app.models import Project
from app.routers import exports as exports_router
from app.routers import publish as publish_router
from app.services.exports import gating
from app.services.exports.deck_exports import ExportResult, safe_filename
from app.services.exports.deck_site import (
    bundle_path,
    deck_csp,
    inline_script_text,
    json_for_script,
    single_file_html,
    write_published_site,
)
from app.services.exports.deck_source import load_deck
from app.services.exports.pptx import crop_rect, fit_box, prepare_image

FAKE_BUNDLE = b'(function(){var s="</script><!-- x";console.log(s)})();'


@pytest.fixture
def deck_project(project, tmp_path_factory, monkeypatch):
    """The fixture deck under the isolated projects root, slides flag on."""
    from app.config import get_settings

    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
    clear_settings_cache()
    build_deck_project(get_settings().projects_path / project)
    yield project
    clear_settings_cache()


# ── gating ──────────────────────────────────────────────────────────────────


def _cloud(monkeypatch, plan: str | None, **flags):
    row = None
    if plan is not None:
        values = {"export_pdf": False, "export_html": False, "export_pptx": False, "remove_badge": False}
        row = SimpleNamespace(plan_slug=plan, **{**values, **flags})
    monkeypatch.setattr(gating, "entitlements_apply", lambda _u: True)
    monkeypatch.setattr(gating, "get_entitlements", lambda _db, _u: row)


def test_open_source_installs_export_everything(monkeypatch):
    monkeypatch.setattr(gating, "entitlements_apply", lambda _u: False)
    for fmt in ("pdf", "png", "html", "pptx"):
        gating.require_export(None, SimpleNamespace(), fmt)
    assert gating.can_remove_badge(None, SimpleNamespace()) is True
    assert gating.show_badge(None, SimpleNamespace(), None) is False


@pytest.mark.parametrize("fmt", ["pdf", "png", "html", "pptx"])
def test_free_never_exports_even_with_a_stale_row(monkeypatch, fmt):
    _cloud(monkeypatch, "free", export_pdf=True, export_html=True, export_pptx=True)
    with pytest.raises(SitesError) as err:
        gating.require_export(None, SimpleNamespace(), fmt)
    assert err.value.status_code == 403
    assert err.value.detail["code"] == "EXPORT_NOT_IN_PLAN"
    assert err.value.detail["format"] == fmt
    assert err.value.detail["requiredPlan"] == ("starter" if fmt in ("pdf", "png") else "builder")


def test_no_synced_plan_is_free(monkeypatch):
    _cloud(monkeypatch, None)
    with pytest.raises(SitesError):
        gating.require_export(None, SimpleNamespace(), "pdf")


def test_starter_gets_pdf_and_png_only(monkeypatch):
    _cloud(monkeypatch, "starter", export_pdf=True, export_html=True, export_pptx=True)
    gating.require_export(None, SimpleNamespace(), "pdf")
    gating.require_export(None, SimpleNamespace(), "png")
    for fmt in ("html", "pptx"):
        with pytest.raises(SitesError) as err:
            gating.require_export(None, SimpleNamespace(), fmt)
        assert err.value.detail["requiredPlan"] == "builder"


def test_builder_needs_the_flags_it_was_sold(monkeypatch):
    _cloud(monkeypatch, "builder", export_pdf=True, export_html=True, export_pptx=False)
    gating.require_export(None, SimpleNamespace(), "html")
    with pytest.raises(SitesError):
        gating.require_export(None, SimpleNamespace(), "pptx")


def test_badge_rules(monkeypatch):
    _cloud(monkeypatch, "free", remove_badge=True)
    assert gating.show_badge(None, SimpleNamespace(), False) is True
    _cloud(monkeypatch, "starter", remove_badge=True)
    assert gating.show_badge(None, SimpleNamespace(), None) is False
    assert gating.show_badge(None, SimpleNamespace(), True) is True
    _cloud(monkeypatch, "starter", remove_badge=False)
    assert gating.show_badge(None, SimpleNamespace(), False) is True


# ── deck source ─────────────────────────────────────────────────────────────


def test_load_deck_lists_icons_assets_and_notes(deck_project):
    src = load_deck(deck_project, include_notes=True)
    assert src.visible_ids == ["s1", "s2", "s3", "s4"]
    assert src.size == (1440, 1080)
    assert "trending-up" in src.icons()
    assert {"public/images/hero.webp", "public/images/poster.webp", "public/images/bg.webp"} <= set(
        src.asset_paths()
    )
    assert src.notes["s1"] == "Saluer le public."
    assert src.has_animations()
    assert load_deck(deck_project).notes == {}


def test_load_deck_refuses_a_broken_slide(deck_project):
    from app.config import get_settings

    path = get_settings().projects_path / deck_project / "slides" / "s2.json"
    slide = json.loads(path.read_text(encoding="utf-8"))
    slide["elements"][0]["w"] = 0
    path.write_text(json.dumps(slide), encoding="utf-8")
    with pytest.raises(SitesError) as err:
        load_deck(deck_project)
    assert err.value.status_code == 422
    assert err.value.detail["file"] == "slides/s2.json"


# ── published site and HTML ─────────────────────────────────────────────────


def test_published_site_layout_and_csp(deck_project, tmp_path):
    src = load_deck(deck_project, include_notes=True)
    out = tmp_path / "dist"
    info = write_published_site(
        deck_project, src, out, FAKE_BUNDLE, title="Deck", lang="fr", badge=True, notes=False
    )
    assert info["bundle"] == bundle_path(FAKE_BUNDLE) and (out / info["bundle"]).read_bytes() == FAKE_BUNDLE
    assert re.fullmatch(r"assets/deck-[0-9a-f]{12}\.js", info["bundle"])
    for rel in (
        "index.html",
        "presenter/index.html",
        "deck.json",
        "theme.json",
        "slides/s1.json",
        "slides/s4.json",
    ):
        assert (out / rel).is_file(), rel
    assert not (out / "slides" / "s5.json").exists()  # hidden slide
    assert not (out / "notes.json").exists()  # notes stay private by default
    assert (out / "public" / "images" / "hero.webp").is_file()
    index = htmllib.unescape((out / "index.html").read_text(encoding="utf-8"))
    config = json.loads(re.search(r'id="forge-deck-config">(.*?)</script>', index).group(1))
    assert config == {
        "mode": "present",
        "badge": True,
        "notes": False,
        "base": "./",
        "presenter": "presenter/",
        "locale": "fr",
    }
    assert "frame-src https://www.youtube-nocookie.com https://player.vimeo.com" in index
    assert "script-src 'self'" in index
    presenter = (out / "presenter" / "index.html").read_text(encoding="utf-8")
    assert '"mode":"presenter"' in presenter and f'src="../{info["bundle"]}"' in presenter
    assert 'name="robots" content="noindex"' in presenter


def test_published_site_shares_notes_when_asked(deck_project, tmp_path):
    src = load_deck(deck_project, include_notes=True)
    write_published_site(
        deck_project, src, tmp_path, FAKE_BUNDLE, title="Deck", lang="en", badge=False, notes=True
    )
    notes = json.loads((tmp_path / "notes.json").read_text(encoding="utf-8"))
    assert notes == {"s1": "Saluer le public.", "s2": "Montrer le graphique."}


def test_json_and_script_escaping():
    text = json_for_script({"a": "</script><!-- &  "})
    assert "<" not in text and ">" not in text and "&" not in text and " " not in text
    assert json.loads(text) == {"a": "</script><!-- &  "}
    assert "</script" not in inline_script_text(FAKE_BUNDLE).lower()


def test_single_file_html_is_self_contained(deck_project):
    src = load_deck(deck_project, include_notes=True)
    html = single_file_html(deck_project, src, FAKE_BUNDLE, title="Deck", lang="en", badge=False, notes=False)
    # One inline script, allowed by its hash; nothing loaded from a server.
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    assert len(scripts) == 1
    digest = base64.b64encode(hashlib.sha256(scripts[0].encode("utf-8")).digest()).decode()
    assert f"'sha256-{digest}'" in htmllib.unescape(html)
    assert "src=" not in html.split("<body>")[1].split("forge-deck-data")[0]
    raw = re.search(r'id="forge-deck-data">(.*?)</script>', html, re.S).group(1)
    data = json.loads(raw)
    assert set(data["slides"]) == {"s1", "s2", "s3", "s4"}
    assert "notes" not in data
    assert data["assets"]["public/images/hero.webp"].startswith("data:image/webp;base64,")
    assert "connect-src 'none'" in htmllib.unescape(html)


def test_single_file_html_carries_notes_on_request(deck_project):
    src = load_deck(deck_project, include_notes=True)
    html = single_file_html(deck_project, src, FAKE_BUNDLE, title="Deck", lang="en", badge=True, notes=True)
    data = json.loads(re.search(r'id="forge-deck-data">(.*?)</script>', html, re.S).group(1))
    assert data["notes"]["s2"] == "Montrer le graphique."
    assert '"badge":true' in html


def test_csp_offline_has_no_self():
    csp = deck_csp(inline_script=b"x", offline=True)
    assert "'self'" not in csp and "img-src data: blob:" in csp


# ── PPTX image preparation ──────────────────────────────────────────────────


def test_cover_crops_the_center_to_the_box_ratio():
    box = {"x": 0, "y": 0, "w": 400, "h": 400}
    assert crop_rect((800, 400), box, "cover", None) == (200, 0, 600, 400)
    assert crop_rect((400, 800), box, "cover", None) == (0, 200, 400, 600)
    assert crop_rect((800, 400), box, "fill", None) == (0, 0, 800, 400)


def test_crop_then_cover():
    box = {"x": 0, "y": 0, "w": 100, "h": 100}
    # Right half of a 400 x 200 image is 200 x 200, already square.
    assert crop_rect((400, 200), box, "cover", {"x": 0.5, "y": 0, "w": 0.5, "h": 1}) == (200, 0, 400, 200)


def test_contain_centers_the_picture():
    box = {"x": 100, "y": 100, "w": 400, "h": 400}
    assert fit_box(box, (800, 400), "contain") == {"x": 100, "y": 200, "w": 400, "h": 200}
    assert fit_box(box, (800, 400), "cover") == box


def test_prepare_image_writes_jpeg_or_png(tmp_path):
    from PIL import Image

    src = tmp_path / "a.webp"
    Image.new("RGB", (800, 400), (10, 20, 30)).save(src, format="WEBP")
    item = {"box": {"x": 0, "y": 0, "w": 100, "h": 100}, "fit": "cover"}
    out = prepare_image(src, item, tmp_path, "img")
    assert out["path"].endswith(".jpg")
    with Image.open(out["path"]) as img:
        assert img.size == (400, 400)
    rgba = tmp_path / "b.png"
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(rgba)
    assert prepare_image(rgba, {"box": item["box"], "fit": "fill"}, tmp_path, "img2")["path"].endswith(".png")


def test_safe_filename():
    assert safe_filename("Rapport annuel / 2026", "pdf") == "Rapport-annuel-2026.pdf"
    assert safe_filename("...", "pptx") == "presentation.pptx"


# ── routes ──────────────────────────────────────────────────────────────────


def _client(router, project, *, user=None, **overrides):
    app = FastAPI()
    app.include_router(router)
    user = user or SimpleNamespace(id=project.user_id, rodium_sub=None, email_verified_at=datetime.now(UTC))

    def db_get(model, key):
        if model is Project and str(key) == str(project.id):
            return project
        return None

    db = SimpleNamespace(get=db_get, commit=lambda: None, refresh=lambda _p: None, **overrides)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _project(kind: str, pid: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.UUID(pid) if len(pid) == 36 else uuid.uuid4(),
        user_id=uuid.uuid4(),
        platform=kind,
        name="Rapport",
        slug="rapport",
        published_at=None,
        status="draft",
    )


def test_export_route_answers_the_file_with_warnings(deck_project, monkeypatch):
    project = _project("slides", deck_project)
    calls = {}

    async def fake_export(pid, fmt, **kwargs):
        calls.update(pid=pid, fmt=fmt, **kwargs)
        return ExportResult(b"%PDF-1.7", "Rapport.pdf", "application/pdf", [{"code": "X", "message": "é"}])

    monkeypatch.setattr(exports_router, "export_deck", fake_export)
    monkeypatch.setattr(gating, "entitlements_apply", lambda _u: False)
    client = _client(exports_router.router, project)
    r = client.post(f"/projects/{project.id}/exports/PDF", json={"steps": True})
    assert r.status_code == 200, r.text
    assert r.content == b"%PDF-1.7"
    assert r.headers["content-disposition"] == 'attachment; filename="Rapport.pdf"'
    warnings = json.loads(base64.urlsafe_b64decode(r.headers["x-forge-export-warnings"]))
    assert warnings == [{"code": "X", "message": "é"}]
    assert calls["fmt"] == "pdf" and calls["steps"] is True and calls["badge"] is False


def test_export_route_gates_by_plan(deck_project, monkeypatch):
    project = _project("slides", deck_project)
    _cloud(monkeypatch, "starter", export_pdf=True)

    async def boom(*_a, **_k):  # pragma: no cover - must not run
        raise AssertionError("export ran")

    monkeypatch.setattr(exports_router, "export_deck", boom)
    client = _client(exports_router.router, project)
    r = client.post(f"/projects/{project.id}/exports/pptx")
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "EXPORT_NOT_IN_PLAN"
    assert r.json()["detail"]["requiredPlan"] == "builder"


def test_export_route_refuses_other_kinds_and_formats(deck_project, monkeypatch):
    monkeypatch.setattr(gating, "entitlements_apply", lambda _u: False)
    web = _project("web", deck_project)
    assert _client(exports_router.router, web).post(f"/projects/{web.id}/exports/pdf").status_code == 404
    slides = _project("slides", deck_project)
    r = _client(exports_router.router, slides).post(f"/projects/{slides.id}/exports/docx")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "EXPORT_FORMAT_UNKNOWN"


def test_publish_route_sends_slides_to_the_player(deck_project, monkeypatch):
    project = _project("slides", deck_project)
    seen = {}

    async def fake_publish_deck(pid, slug, **kwargs):
        seen.update(pid=pid, slug=slug, **kwargs)
        return {"files_uploaded": 7}

    async def no_site(*_a, **_k):  # pragma: no cover - must not run
        raise AssertionError("React build ran for a deck")

    monkeypatch.setattr(publish_router, "publish_deck", fake_publish_deck)
    monkeypatch.setattr(publish_router, "publish_project_esm", no_site)
    monkeypatch.setattr(publish_router, "get_project_domain", lambda _db, _pid: None)
    monkeypatch.setattr(gating, "entitlements_apply", lambda _u: False)
    user = SimpleNamespace(id=project.user_id, rodium_sub=None, email_verified_at=datetime.now(UTC))
    client = _client(publish_router.router, project, user=user)
    r = client.post(f"/projects/{project.id}/publish", json={"notes": True})
    assert r.status_code == 200, r.text
    assert r.json()["files_uploaded"] == 7
    assert seen["slug"] == "rapport" and seen["notes"] is True and seen["badge"] is False


def test_publish_route_refuses_document_kinds_without_a_player(deck_project, monkeypatch):
    project = _project("codelab", deck_project)
    monkeypatch.setattr(publish_router, "get_project_domain", lambda _db, _pid: None)
    client = _client(publish_router.router, project)
    r = client.post(f"/projects/{project.id}/publish")
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "PUBLISH_NOT_AVAILABLE"


def test_fixture_images_exist(deck_project):
    from app.config import get_settings

    root: Path = get_settings().projects_path / deck_project
    assert (root / "public" / "images" / "bg.webp").stat().st_size > 0
