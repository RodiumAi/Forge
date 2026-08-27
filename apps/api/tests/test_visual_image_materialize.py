"""Replacing an image visually must reference a file the site can actually serve.

The upload flow used to write the raw object-store URL into the JSX. That
bucket is private: the preview iframe got a 403 (broken image), and the
hardcoded host would have broken the same image on the published site and in
exports. The endpoint now materializes the chosen asset into the project's
`public/images/` and writes a relative `/images/...` src — the same contract
publish and export already honour for `public/`.
"""

import io
import uuid
from types import SimpleNamespace

import pytest

from app.services import asset_storage
from app.services.filesystem import project_dir
from app.services.visual_image import apply_visual_image_replace


class _FakeStore:
    bucket_uploads = "forge-uploads"

    class internal:
        @staticmethod
        def get_object(Bucket: str, Key: str) -> dict:
            return {"Body": io.BytesIO(b"\x89PNG fake bytes")}


@pytest.fixture
def materialized(project, monkeypatch):
    object_id = uuid.uuid4()
    row = SimpleNamespace(id=object_id, object_key=f"forge/u/p/{uuid.uuid4()}-photo.png")
    monkeypatch.setattr(asset_storage, "get_project_asset", lambda db, pid, oid: row)
    monkeypatch.setattr("app.providers.objects.get_object_store", lambda: _FakeStore())
    web_path = asset_storage.materialize_asset_to_public(None, project, object_id)
    return project, object_id, web_path


class TestMaterialize:
    def test_writes_the_bytes_under_public_images(self, materialized):
        project, _, web_path = materialized
        on_disk = project_dir(project) / "public" / "images" / web_path.rsplit("/", 1)[-1]
        assert on_disk.is_file()
        assert on_disk.read_bytes() == b"\x89PNG fake bytes"

    def test_returns_a_relative_web_path(self, materialized):
        _, object_id, web_path = materialized
        assert web_path.startswith("/images/")
        assert "http" not in web_path, "an absolute object-store URL breaks preview, publish and export"
        assert web_path.endswith("photo.png")
        # Object-id prefix: re-picking the same asset overwrites instead of
        # accumulating copies, and same-named uploads never collide.
        assert str(object_id)[:8] in web_path

    def test_unknown_asset_raises(self, project, monkeypatch):
        monkeypatch.setattr(asset_storage, "get_project_asset", lambda db, pid, oid: None)
        with pytest.raises(FileNotFoundError):
            asset_storage.materialize_asset_to_public(None, project, uuid.uuid4())


class TestSourceRewrite:
    def test_replacement_src_is_the_relative_path(self, materialized):
        project, _, web_path = materialized
        from app.services.filesystem import write_file

        write_file(project, "src/App.tsx", 'export default () => <img src="/photo.jpg" alt="me" />;')
        result = apply_visual_image_replace(project, "/photo.jpg", web_path)
        assert result.path == "src/App.tsx"
        content = (project_dir(project) / "src" / "App.tsx").read_text(encoding="utf-8")
        assert f'src="{web_path}"' in content
        assert "9000" not in content
