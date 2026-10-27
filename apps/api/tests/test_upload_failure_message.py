"""A storage failure on upload reads as a plain sentence, never the storage URL."""

from __future__ import annotations

import io
import struct
import uuid
import zlib
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routers import files as files_router


def _png() -> bytes:
    """A 1x1 PNG built from its chunks, so the byte sniffer accepts it."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    pixels = zlib.compress(bytes(5))
    signature = bytes([0x89]) + b"PNG" + bytes([13, 10, 26, 10])
    return signature + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")


def _client(monkeypatch, failure: Exception) -> TestClient:
    project = SimpleNamespace(id=uuid.uuid4())
    monkeypatch.setattr(files_router, "_owned", lambda *_a, **_k: project)

    def boom(*_a, **_k):
        raise failure

    monkeypatch.setattr(files_router, "upload_project_asset", boom)
    app = FastAPI()
    app.include_router(files_router.router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid.uuid4())
    app.dependency_overrides[get_db] = lambda: None
    return TestClient(app)


def test_storage_error_is_hidden_behind_a_clear_message(monkeypatch):
    leak = 'Could not connect to the endpoint URL: "http://127.0.0.1:9000/forge-uploads/secret-key.png"'
    client = _client(monkeypatch, RuntimeError(leak))
    res = client.post(
        f"/projects/{uuid.uuid4()}/files/upload",
        files={"file": ("logo.png", io.BytesIO(_png()), "image/png")},
        headers={"Accept-Language": "fr"},
    )
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert detail["code"] == "UPLOAD_FAILED"
    assert "envoyer le fichier" in detail["message"]
    assert "9000" not in res.text and "forge-uploads" not in res.text
