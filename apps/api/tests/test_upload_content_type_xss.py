"""Stored XSS via upload Content-Type (CWE-79 / CWE-434).

The upload path used to trust the filename extension OR the client-supplied
Content-Type, never the bytes — so a text/html body named `evil.png` was stored
and re-served as text/html, and the browser rendered its embedded <script>.

The fix validates the actual bytes with Pillow and derives the stored type from
them; the asset endpoint only serves a strict raster allowlist inline, anything
else as a download.
"""

from __future__ import annotations

import asyncio
import uuid
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.responses import RedirectResponse, Response
from PIL import Image

from app.models import Project
from app.providers import objects as objects_provider
from app.routers import files as files_mod
from app.services import asset_storage


def _png(color=(255, 0, 0)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (4, 4), color).save(buf, format="PNG")
    return buf.getvalue()


def _gif() -> bytes:
    buf = BytesIO()
    Image.new("P", (4, 4)).save(buf, format="GIF")
    return buf.getvalue()


HTML_BYTES = b'<html><script>document.title="XSS-VIA-UPLOAD"</script></html>'
SVG_BYTES = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


# ── Byte sniffing is authoritative ─────────────────────────────────────────


class TestSniffRasterContentType:
    def test_a_real_png_is_accepted_as_image_png(self):
        assert files_mod._sniff_raster_content_type(_png()) == "image/png"

    def test_a_real_gif_is_accepted_as_image_gif(self):
        assert files_mod._sniff_raster_content_type(_gif()) == "image/gif"

    def test_html_bytes_are_rejected(self):
        assert files_mod._sniff_raster_content_type(HTML_BYTES) is None

    def test_svg_bytes_are_rejected(self):
        assert files_mod._sniff_raster_content_type(SVG_BYTES) is None

    def test_a_truncated_image_is_rejected(self):
        assert files_mod._sniff_raster_content_type(_png()[:12]) is None

    def test_empty_body_is_rejected(self):
        assert files_mod._sniff_raster_content_type(b"") is None


def test_inline_safe_types_exclude_dangerous_types():
    assert "text/html" not in files_mod._INLINE_SAFE_TYPES
    assert "image/svg+xml" not in files_mod._INLINE_SAFE_TYPES
    assert "application/octet-stream" not in files_mod._INLINE_SAFE_TYPES
    # Raster formats we do serve inline.
    assert "image/png" in files_mod._INLINE_SAFE_TYPES
    assert "image/x-icon" in files_mod._INLINE_SAFE_TYPES


# ── Upload route derives the stored type from the bytes ────────────────────


class _Upload:
    """Minimal stand-in for Starlette's UploadFile (the fields the route uses)."""

    def __init__(self, body: bytes, filename: str, content_type: str):
        self._body = body
        self.filename = filename
        self.content_type = content_type

    async def read(self, size: int = -1) -> bytes:
        # Same contract as UploadFile.read: a negative size means "everything".
        return self._body if size < 0 else self._body[:size]


def _project_and_db():
    user = SimpleNamespace(id=uuid.uuid4())
    project = SimpleNamespace(id=uuid.uuid4(), user_id=user.id, slug="proj")

    db = MagicMock()

    def fake_get(model, key):
        if model is Project:
            return project
        return None

    db.get.side_effect = fake_get
    return user, project, db


def _run_upload(monkeypatch, upload: _Upload):
    user, project, db = _project_and_db()
    captured: dict[str, object] = {}

    def fake_upload_asset(_db, *, user, project, body, filename, content_type):
        captured["content_type"] = content_type
        captured["filename"] = filename
        return SimpleNamespace(
            id=uuid.uuid4(),
            object_key=f"uploads/{uuid.uuid4()}-{filename}",
            public_url="http://store/obj",
            content_type=content_type,
        )

    monkeypatch.setattr(files_mod, "upload_project_asset", fake_upload_asset)

    request = MagicMock()
    request.headers = {}

    result = asyncio.run(
        files_mod.upload_project_image(
            project_id=project.id,
            request=request,
            file=upload,
            user=user,
            db=db,
        )
    )
    return result, captured


class TestUploadRouteValidatesBytes:
    def test_a_png_with_svg_name_and_html_mime_is_canonicalized(self, monkeypatch):
        upload = _Upload(_png(), filename="evil.svg", content_type="text/html")
        result, captured = _run_upload(monkeypatch, upload)

        assert captured["content_type"] == "image/png"
        assert captured["filename"] == "evil.png"
        assert result.content_type == "image/png"

    def test_an_html_body_dressed_as_png_is_rejected(self, monkeypatch):
        upload = _Upload(HTML_BYTES, filename="evil.png", content_type="image/png")
        with pytest.raises(HTTPException) as exc:
            _run_upload(monkeypatch, upload)
        assert exc.value.status_code == 400

    def test_svg_bytes_with_png_name_and_mime_are_rejected(self, monkeypatch):
        upload = _Upload(SVG_BYTES, filename="evil.png", content_type="image/png")
        with pytest.raises(HTTPException) as exc:
            _run_upload(monkeypatch, upload)
        assert exc.value.status_code == 400

    def test_a_genuine_png_is_accepted(self, monkeypatch):
        upload = _Upload(_png(), filename="photo.png", content_type="image/png")
        result, captured = _run_upload(monkeypatch, upload)
        assert captured["content_type"] == "image/png"
        assert result.object_id


class TestPublicAssetSafety:
    def test_legacy_html_file_is_forced_to_download(self, monkeypatch, tmp_path):
        legacy = tmp_path / "legacy.html"
        legacy.write_bytes(HTML_BYTES)
        monkeypatch.setattr(files_mod, "_owned", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(files_mod, "safe_resolve", lambda *_args: legacy)

        response = files_mod.get_public_asset(
            project_id=uuid.uuid4(),
            asset_path="legacy.html",
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert response.headers["content-type"].startswith("application/octet-stream")
        assert response.headers["content-disposition"].startswith("attachment;")
        assert response.headers["x-content-type-options"] == "nosniff"

    def test_real_png_uses_canonical_mime_despite_html_extension(self, monkeypatch, tmp_path):
        misleading = tmp_path / "photo.html"
        misleading.write_bytes(_png())
        monkeypatch.setattr(files_mod, "_owned", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(files_mod, "safe_resolve", lambda *_args: misleading)

        response = files_mod.get_public_asset(
            project_id=uuid.uuid4(),
            asset_path="photo.html",
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert response.headers["content-type"].startswith("image/png")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "content-disposition" not in response.headers


def _stored_row(*, content_type: str, name: str = "image.png"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        object_key=f"users/project/prefix-{name}",
        public_url="https://store.invalid/object",
        content_type=content_type,
    )


def _asset_route_setup(monkeypatch, row, *, body: bytes | None):
    store = SimpleNamespace(
        bucket_uploads="uploads",
        internal=MagicMock(),
        presign_get=MagicMock(return_value="https://signed.invalid/object"),
    )
    if body is None:
        store.internal.get_object.side_effect = OSError("store unavailable")
    else:
        store.internal.get_object.return_value = {"Body": BytesIO(body)}
    monkeypatch.setattr(files_mod, "_owned", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(files_mod, "get_project_asset", lambda *_args: row)
    monkeypatch.setattr(files_mod, "get_object_store", lambda: store)
    return store


class TestAssetServingSafety:
    def test_signed_download_overrides_object_metadata(self):
        store = object.__new__(objects_provider.ObjectStore)
        store.public = MagicMock()
        store.public.generate_presigned_url.return_value = "https://signed.invalid/object"

        store.presign_get(
            "uploads",
            "legacy-object",
            download_name='legacy"\r\n.html',
        )

        params = store.public.generate_presigned_url.call_args.kwargs["Params"]
        assert params["ResponseContentType"] == "application/octet-stream"
        assert params["ResponseContentDisposition"] == 'attachment; filename="legacy.html"'

    def test_redirect_for_legacy_html_metadata_forces_download(self, monkeypatch):
        row = _stored_row(content_type="text/html", name="legacy.html")
        store = _asset_route_setup(monkeypatch, row, body=HTML_BYTES)

        response = files_mod.redirect_asset(
            project_id=uuid.uuid4(),
            object_id=row.id,
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert isinstance(response, RedirectResponse)
        store.presign_get.assert_called_once_with(
            "uploads",
            row.object_key,
            expires=3600,
            download_name="legacy.html",
        )

    def test_redirect_with_safe_metadata_still_forces_download(self, monkeypatch):
        row = _stored_row(content_type="image/png")
        store = _asset_route_setup(monkeypatch, row, body=_png())

        files_mod.redirect_asset(
            project_id=uuid.uuid4(),
            object_id=row.id,
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert store.presign_get.call_args.kwargs["download_name"] == "image.png"

    def test_stream_fallback_always_forces_a_signed_download(self, monkeypatch):
        row = _stored_row(content_type="image/png")
        store = _asset_route_setup(monkeypatch, row, body=None)

        response = files_mod.stream_asset_content(
            project_id=uuid.uuid4(),
            object_id=row.id,
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert isinstance(response, RedirectResponse)
        assert store.presign_get.call_args.kwargs["download_name"] == "image.png"

    def test_legacy_dangerous_metadata_is_never_served_inline(self, monkeypatch):
        row = _stored_row(content_type="text/html", name="legacy.html")
        _asset_route_setup(monkeypatch, row, body=_png())

        response = files_mod.stream_asset_content(
            project_id=uuid.uuid4(),
            object_id=row.id,
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert isinstance(response, Response)
        assert response.headers["content-type"].startswith("application/octet-stream")
        assert response.headers["content-disposition"].startswith("attachment;")
        assert response.headers["x-content-type-options"] == "nosniff"

    def test_safe_metadata_with_html_bytes_is_downloaded(self, monkeypatch):
        row = _stored_row(content_type="image/png")
        _asset_route_setup(monkeypatch, row, body=HTML_BYTES)

        response = files_mod.stream_asset_content(
            project_id=uuid.uuid4(),
            object_id=row.id,
            request=MagicMock(),
            user=SimpleNamespace(),
            db=MagicMock(),
        )

        assert response.headers["content-disposition"].startswith("attachment;")
        assert response.headers["content-type"].startswith("application/octet-stream")


class TestMaterializeAssetSafety:
    def test_png_polyglot_named_html_gets_a_canonical_png_path(self, monkeypatch):
        project_id = uuid.uuid4()
        row = _stored_row(content_type="text/html", name="avatar.html")
        polyglot = _png() + HTML_BYTES
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = row
        store = SimpleNamespace(
            bucket_uploads="uploads",
            internal=MagicMock(get_object=MagicMock(return_value={"Body": BytesIO(polyglot)})),
        )
        written: dict[str, object] = {}

        monkeypatch.setattr(objects_provider, "get_object_store", lambda: store)
        monkeypatch.setattr(
            "app.services.filesystem.write_bytes",
            lambda project, path, body: written.update(
                project=project,
                path=path,
                body=body,
            ),
        )

        public_path = asset_storage.materialize_asset_to_public(db, project_id, row.id)

        assert public_path.endswith("-avatar.png")
        assert ".html" not in public_path
        assert written["body"] == polyglot

    def test_non_image_bytes_cannot_be_materialized(self, monkeypatch):
        project_id = uuid.uuid4()
        row = _stored_row(content_type="text/html", name="attack.html")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = row
        store = SimpleNamespace(
            bucket_uploads="uploads",
            internal=MagicMock(get_object=MagicMock(return_value={"Body": BytesIO(HTML_BYTES)})),
        )
        monkeypatch.setattr(objects_provider, "get_object_store", lambda: store)

        with pytest.raises(ValueError, match="not a valid raster"):
            asset_storage.materialize_asset_to_public(db, project_id, row.id)
