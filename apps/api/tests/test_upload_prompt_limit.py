"""Images attached to a chat prompt are capped at 6 MB; site assets keep 8 MB."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import files as files_mod

MB = 1024 * 1024


class _Upload:
    def __init__(self, total: int):
        self.filename = "maquette.png"
        self.content_type = "image/png"
        self._total = total
        self.served = 0

    async def read(self, size: int = -1) -> bytes:
        n = self._total if size < 0 else min(size, self._total)
        self.served += n
        return b"\x00" * n


def _call(upload: _Upload, monkeypatch, **kwargs):
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
            **kwargs,
        )
    )


def test_prompt_image_over_6_mb_is_rejected_without_full_read(monkeypatch):
    upload = _Upload(total=11 * MB)
    with pytest.raises(HTTPException) as exc:
        _call(upload, monkeypatch, purpose="prompt")
    assert exc.value.status_code == 400
    assert "max 6 MB" in str(exc.value.detail)
    assert upload.served <= 6 * MB + 1


def test_prompt_image_at_6_mb_passes_the_size_check(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        _call(_Upload(total=6 * MB), monkeypatch, purpose="prompt")
    # Zero bytes are not an image: it fails later, on content, not on size.
    assert "too large" not in str(exc.value.detail)


def test_site_asset_keeps_the_8_mb_limit(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        _call(_Upload(total=7 * MB), monkeypatch)
    assert "too large" not in str(exc.value.detail)
    with pytest.raises(HTTPException) as exc:
        _call(_Upload(total=8 * MB + 1), monkeypatch)
    assert "max 8 MB" in str(exc.value.detail)
