"""Upload routes must not buffer more than the size limit (CWE-770).

The image upload routes used to call `await file.read()` and only then compare
the length to the 8 MB limit, so a single oversized request was fully loaded
into memory before being rejected. They now read at most one byte past the
limit, which is enough to detect "too large" without allocating the body.
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import files as files_mod
from app.routers import seo as seo_mod

LIMIT = 8 * 1024 * 1024


class _RecordingUpload:
    """UploadFile stand-in that records what the route asked for and got."""

    def __init__(self, total: int):
        self.filename = "photo.png"
        self.content_type = "image/png"
        self._total = total
        self.requested: list[int] = []
        self.served = 0

    async def read(self, size: int = -1) -> bytes:
        self.requested.append(size)
        n = self._total if size < 0 else min(size, self._total)
        self.served += n
        return b"\x00" * n


def _call_files_route(upload: _RecordingUpload, monkeypatch):
    monkeypatch.setattr(files_mod, "_owned", lambda *_a, **_k: SimpleNamespace(id=uuid.uuid4()))
    request = MagicMock()
    request.headers = {}
    return asyncio.run(
        files_mod.upload_project_image(
            project_id=uuid.uuid4(),
            request=request,
            file=upload,
            user=SimpleNamespace(id=uuid.uuid4()),
            db=MagicMock(),
        )
    )


def _call_seo_route(upload: _RecordingUpload, monkeypatch):
    monkeypatch.setattr(seo_mod, "_owned", lambda *_a, **_k: SimpleNamespace(id=uuid.uuid4()))
    request = MagicMock()
    request.headers = {}
    return asyncio.run(
        seo_mod.upload_seo_asset(
            project_id=uuid.uuid4(),
            request=request,
            kind="favicon",
            file=upload,
            user=SimpleNamespace(id=uuid.uuid4()),
            db=MagicMock(),
        )
    )


ROUTES = pytest.mark.parametrize("call", [_call_files_route, _call_seo_route], ids=["files", "seo"])


@ROUTES
def test_oversized_body_is_rejected_without_being_fully_read(call, monkeypatch):
    upload = _RecordingUpload(total=LIMIT * 40)  # 320 MB claimed

    with pytest.raises(HTTPException) as exc:
        call(upload, monkeypatch)

    assert exc.value.status_code == 400
    assert "too large" in str(exc.value.detail)
    # Never an unbounded read, and never more than limit + 1 byte pulled in.
    assert all(size >= 0 for size in upload.requested)
    assert upload.served <= LIMIT + 1


@ROUTES
def test_one_byte_over_the_limit_is_rejected_as_too_large(call, monkeypatch):
    upload = _RecordingUpload(total=LIMIT + 1)

    with pytest.raises(HTTPException) as exc:
        call(upload, monkeypatch)

    assert exc.value.status_code == 400
    assert "too large" in str(exc.value.detail)


@ROUTES
def test_body_exactly_at_the_limit_passes_the_size_check(call, monkeypatch):
    upload = _RecordingUpload(total=LIMIT)

    # Zeros are not an image, so the request still fails later on content
    # validation — but with a different error than "too large".
    with pytest.raises(HTTPException) as exc:
        call(upload, monkeypatch)

    assert "too large" not in str(exc.value.detail)
