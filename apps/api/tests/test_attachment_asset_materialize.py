"""Asset-intent markers must materialize to /images/... — never raw private S3 URLs."""

import io
import uuid
from types import SimpleNamespace

import pytest

from app.services import asset_storage
from app.services.attachments import materialize_asset_markers


class _FakeStore:
    bucket_uploads = "rodiumai-forge-uploads-prod"

    class internal:
        @staticmethod
        def get_object(Bucket: str, Key: str) -> dict:
            return {"Body": io.BytesIO(b"\x89PNG fake")}


@pytest.fixture
def materialize_setup(project, monkeypatch):
    object_id = uuid.uuid4()
    project_id = str(uuid.uuid4())
    row = SimpleNamespace(id=object_id, object_key=f"forge/u/p/{uuid.uuid4()}-logo.png")
    monkeypatch.setattr(asset_storage, "get_project_asset", lambda db, pid, oid: row)
    monkeypatch.setattr("app.providers.objects.get_object_store", lambda: _FakeStore())
    return project_id, object_id


def test_materialize_asset_markers_rewrites_private_s3_url(materialize_setup):
    project, object_id = materialize_setup
    s3 = "https://rodiumai-forge-uploads-prod.s3.eu-west-1.amazonaws.com/forge/u/p/x-logo.png"
    text = f"[Image attached: logo.png | url:{s3} | object:{object_id} | intent:asset]"
    out = materialize_asset_markers(object(), project, text)
    assert s3 not in out
    assert "/images/" in out
    assert f"object:{object_id}" in out


def test_reference_marker_with_private_url_is_also_materialized(materialize_setup):
    """A raw private-bucket URL is broken whatever the intent — always rewrite it."""
    project, object_id = materialize_setup
    s3 = "https://rodiumai-forge-uploads-prod.s3.eu-west-1.amazonaws.com/forge/u/p/x.png"
    text = f"[Reference screenshot: mock.png | url:{s3} | object:{object_id} | intent:reference]"
    out = materialize_asset_markers(object(), project, text)
    assert s3 not in out
    assert "/images/" in out


def test_reference_marker_with_public_url_is_unchanged(materialize_setup):
    project, object_id = materialize_setup
    cdn = "https://cdn.example.com/mock.png"
    text = f"[Reference screenshot: mock.png | url:{cdn} | object:{object_id} | intent:reference]"
    assert materialize_asset_markers(object(), project, text) == text


def test_is_private_upload_url_detects_prod_bucket():
    url = "https://rodiumai-forge-uploads-prod.s3.eu-west-1.amazonaws.com/forge/a/b.png"
    assert asset_storage.is_private_upload_url(url)
    assert not asset_storage.is_private_upload_url("https://cdn.example.com/a.png")
