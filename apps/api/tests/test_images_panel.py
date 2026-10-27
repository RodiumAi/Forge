"""Image panel backend: Pixabay search and import, AI generation gate."""

from __future__ import annotations

import io
import json
import logging
import uuid
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.db import get_db
from app.errors import SitesError
from app.models import Project
from app.routers import images as images_mod
from app.services import image_bank
from app.services.llm import ERR_QUOTA, RodiumError

KEY = "test-pixabay-key-0000"


def _hit(image_id: int = 42) -> dict:
    return {
        "id": image_id,
        "pageURL": f"https://pixabay.com/photos/sunset-{image_id}/",
        "type": "photo",
        "tags": "sunset, sea,  beach",
        "previewURL": "https://cdn.pixabay.com/photo/preview_150.jpg",
        "webformatURL": "https://pixabay.com/get/web_640.jpg",
        "largeImageURL": "https://pixabay.com/get/large_1280.jpg",
        "imageWidth": 4000,
        "imageHeight": 3000,
        "user": "JaneDoe",
    }


def _png(width: int = 1600, height: int = 900) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (200, 80, 20)).save(buf, format="PNG")
    return buf.getvalue()


class FakeStream:
    def __init__(self, body: bytes, content_type: str = "image/png", status: int = 200):
        self.body, self.status_code = body, status
        self.headers = {"content-type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def iter_bytes(self):
        yield self.body


@pytest.fixture
def bank(monkeypatch, tmp_path_factory):
    """Pixabay faked at the HTTP layer; Valkey unavailable so the local cache runs."""
    monkeypatch.setenv("PIXABAY_API_KEY", KEY)
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()
    monkeypatch.setattr(image_bank, "_redis", lambda: (_ for _ in ()).throw(ConnectionError("no valkey")))
    image_bank._local_cache.clear()
    image_bank._local_hits.clear()
    calls: list[dict] = []

    def fake_get(url, params=None, timeout=None):
        calls.append(dict(params or {}))
        if "id" in (params or {}):
            body = {"totalHits": 1, "hits": [_hit(int(params["id"]))]}
        else:
            body = {"total": 500, "totalHits": 60, "hits": [_hit(1), _hit(2), {"bad": True}]}
        return httpx.Response(200, json=body, request=httpx.Request("GET", url))

    monkeypatch.setattr(image_bank.httpx, "get", fake_get)
    monkeypatch.setattr(image_bank.httpx, "stream", lambda *_a, **_k: FakeStream(_png()))
    yield calls
    clear_settings_cache()


def _client(monkeypatch, *, project_id: uuid.UUID | None = None) -> TestClient:
    user = SimpleNamespace(id=uuid.uuid4())
    project = SimpleNamespace(id=project_id or uuid.uuid4(), user_id=user.id, platform="web")

    def db_get(model, key):
        return project if model is Project and str(key) == str(project.id) else None

    def db_query(*_a, **_k):
        raise RuntimeError("no catalogue in tests")

    monkeypatch.setattr(images_mod.rate_limit, "enforce", lambda *_a, **_k: None)
    app = FastAPI()
    app.include_router(images_mod.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: SimpleNamespace(get=db_get, query=db_query)
    client = TestClient(app)
    client.project_id = str(project.id)  # type: ignore[attr-defined]
    return client


# ── Search ──────────────────────────────────────────────────────────────────


def test_search_normalizes_hits_and_hides_the_key(bank, monkeypatch):
    client = _client(monkeypatch)
    r = client.get("/images/search", params={"q": "coucher de soleil", "lang": "fr", "type": "photo"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "pixabay"
    assert body["total"] == 60 and body["hasMore"] is True
    assert body["hits"][0] == {
        "id": "1",
        "previewUrl": "https://pixabay.com/get/web_640.jpg",
        "width": 4000,
        "height": 3000,
        "author": "JaneDoe",
        "pageUrl": "https://pixabay.com/photos/sunset-1/",
        "tags": "sunset, sea,  beach",
        "source": "pixabay",
    }
    assert len(body["hits"]) == 2  # the malformed hit is dropped
    assert KEY not in r.text
    sent = bank[0]
    assert sent["key"] == KEY and sent["safesearch"] == "true" and sent["lang"] == "fr"


def test_search_is_cached(bank, monkeypatch):
    client = _client(monkeypatch)
    for _ in range(3):
        assert client.get("/images/search", params={"q": "forest"}).status_code == 200
    assert len(bank) == 1


def test_unknown_language_searches_in_english(bank):
    image_bank.search("arbre", lang="xx")
    assert bank[0]["lang"] == "en"


def test_search_without_key_is_unavailable(bank, monkeypatch):
    monkeypatch.setenv("PIXABAY_API_KEY", "")
    clear_settings_cache()
    r = _client(monkeypatch).get("/images/search", params={"q": "forest"})
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "IMAGE_SEARCH_UNAVAILABLE"


def test_key_rate_limit_is_respected(bank, monkeypatch):
    monkeypatch.setattr(image_bank, "RATE_LIMIT_PER_MINUTE", 2)
    image_bank.search("one")
    image_bank.search("two")
    with pytest.raises(SitesError) as exc:
        image_bank.search("three")
    assert exc.value.code == "IMAGE_SEARCH_BUSY"
    # A cached query does not count.
    image_bank.search("one")


def test_httpx_request_logs_do_not_leak_the_key():
    record = logging.LogRecord(
        "httpx",
        logging.INFO,
        __file__,
        1,
        "HTTP Request: %s %s",
        ("GET", f"https://pixabay.com/api/?key={KEY}&q=a"),
        None,
    )
    for log_filter in logging.getLogger("httpx").filters:
        log_filter.filter(record)
    assert KEY not in record.getMessage()
    assert "key=***" in record.getMessage()


# ── Import ──────────────────────────────────────────────────────────────────


def test_import_downloads_into_the_project_with_credit(bank, monkeypatch):
    client = _client(monkeypatch)
    r = client.post(f"/projects/{client.project_id}/images/import", json={"source": "pixabay", "id": "77"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["path"] == "public/images/pixabay-77.webp"
    assert body["public_path"] == "/images/pixabay-77.webp"
    assert (body["width"], body["height"]) == (1600, 900)
    assert body["credit"] == {
        "source": "pixabay",
        "author": "JaneDoe",
        "pageUrl": "https://pixabay.com/photos/sunset-77/",
    }
    root = get_settings().projects_path / client.project_id
    assert (root / "public/images/pixabay-77.webp").is_file()
    assert (root / "public/images/pixabay-77-640.webp").is_file()
    media = json.loads((root / ".forge/media.json").read_text(encoding="utf-8"))
    entry = media["/images/pixabay-77.webp"]
    assert entry["credit"]["author"] == "JaneDoe"
    assert entry["kind"] == "stock"
    assert entry["alt"] == "sunset, sea, beach"


def test_uploaded_image_is_copied_into_the_project_as_webp(bank, monkeypatch):
    client = _client(monkeypatch)
    object_id = uuid.uuid4()
    seen: list[str] = []

    def fake_bytes(_db, project_id, oid):
        seen.append(str(oid))
        return _png(800, 600)

    monkeypatch.setattr(images_mod, "_stored_asset_bytes", fake_bytes)
    r = client.post(f"/projects/{client.project_id}/images/from-upload", json={"object_id": str(object_id)})
    assert r.status_code == 200, r.text
    body = r.json()
    stem = f"upload-{str(object_id)[:8]}"
    assert body["path"] == f"public/images/{stem}.webp"
    assert (body["width"], body["height"]) == (800, 600)
    assert body["credit"]["source"] == "upload"
    assert seen == [str(object_id)]
    root = get_settings().projects_path / client.project_id
    assert (root / f"public/images/{stem}.webp").is_file()


def test_uploaded_image_refuses_unreadable_bytes(bank, monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(images_mod, "_stored_asset_bytes", lambda *_a: b"not an image")
    r = client.post(
        f"/projects/{client.project_id}/images/from-upload", json={"object_id": str(uuid.uuid4())}
    )
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "IMAGE_UNREADABLE"


def test_import_refuses_foreign_download_hosts(bank, monkeypatch):
    def fake_get(url, params=None, timeout=None):
        hit = {**_hit(5), "largeImageURL": "https://evil.example.com/x.jpg"}
        return httpx.Response(200, json={"hits": [hit]}, request=httpx.Request("GET", url))

    monkeypatch.setattr(image_bank.httpx, "get", fake_get)
    with pytest.raises(SitesError) as exc:
        image_bank.fetch_for_import("5")
    assert exc.value.status_code == 502


def test_import_refuses_non_images_and_bad_ids(bank, monkeypatch):
    monkeypatch.setattr(image_bank.httpx, "stream", lambda *_a, **_k: FakeStream(b"<html>", "text/html"))
    with pytest.raises(SitesError):
        image_bank.fetch_for_import("6")
    client = _client(monkeypatch)
    r = client.post(f"/projects/{client.project_id}/images/import", json={"source": "pixabay", "id": "../x"})
    assert r.status_code == 422


def test_import_needs_edit_access(bank, monkeypatch):
    client = _client(monkeypatch)
    r = client.post(f"/projects/{uuid.uuid4()}/images/import", json={"source": "pixabay", "id": "1"})
    assert r.status_code == 404


# ── Generation ──────────────────────────────────────────────────────────────


@pytest.fixture
def gen(monkeypatch, tmp_path_factory):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    clear_settings_cache()
    calls: list[dict] = []

    async def fake_auth(_db, _user):
        return SimpleNamespace()

    async def fake_generate(**kwargs):
        calls.append(kwargs)
        return {
            "path": "public/generated/hero-1.webp",
            "public_path": "/generated/hero-1.webp",
            "width": 1536,
            "height": 1024,
            "srcset": [["/generated/hero-1.webp", 1536]],
            "model": kwargs["model"],
        }

    monkeypatch.setattr(images_mod, "require_rodi_for_paid_capability", lambda *_a: None)
    monkeypatch.setattr(images_mod, "resolve_generation_auth", fake_auth)
    monkeypatch.setattr(images_mod, "generate_project_image", fake_generate)
    yield calls
    clear_settings_cache()


def test_generate_uses_the_default_model_and_aspect(gen, monkeypatch):
    client = _client(monkeypatch)
    r = client.post(
        f"/projects/{client.project_id}/images/generate",
        json={"prompt": "A lighthouse at dusk", "aspect": "16:9", "target": "slide:s1/e2"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["target"] == "slide:s1/e2"
    assert r.json()["credit"] == {"source": "generated", "author": "", "pageUrl": ""}
    assert gen[0]["size"] == "1536x1024"
    assert gen[0]["model"] == get_settings().effective_default_image_model


def test_generate_refuses_models_outside_the_catalogue(gen, monkeypatch):
    client = _client(monkeypatch)
    r = client.post(
        f"/projects/{client.project_id}/images/generate", json={"prompt": "x", "model": "acme/free-gpu"}
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "IMAGE_MODEL_NOT_ALLOWED"
    assert not gen


def test_empty_balance_is_refused_before_the_gateway(gen, monkeypatch):
    def broke(*_a):
        raise SitesError(402, "INSUFFICIENT_RODI", "Insufficient RODI credits.")

    monkeypatch.setattr(images_mod, "require_rodi_for_paid_capability", broke)
    client = _client(monkeypatch)
    r = client.post(f"/projects/{client.project_id}/images/generate", json={"prompt": "x"})
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "INSUFFICIENT_CREDITS"
    assert not gen


def test_gateway_402_becomes_insufficient_credits(gen, monkeypatch):
    async def no_credit(**_kwargs):
        raise RodiumError("quota", 402, ERR_QUOTA)

    monkeypatch.setattr(images_mod, "generate_project_image", no_credit)
    client = _client(monkeypatch)
    r = client.post(f"/projects/{client.project_id}/images/generate", json={"prompt": "x"})
    assert r.status_code == 402
    detail = r.json()["detail"]
    assert detail["code"] == "INSUFFICIENT_CREDITS"
    assert detail["actions"] == ["upgrade", "recharge"]


def test_image_models_lists_the_default(gen, monkeypatch):
    r = _client(monkeypatch).get("/images/models")
    assert r.status_code == 200
    assert r.json()[0]["default"] is True
