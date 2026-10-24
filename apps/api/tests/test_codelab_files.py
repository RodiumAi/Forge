"""Codelab files, ZIPs, claat import, Markdown export, gating and the published site."""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.config import clear_settings_cache, get_settings
from app.db import get_db
from app.errors import SitesError
from app.models import ForgeEntitlementCache, Project, ProjectCollaborator
from app.routers import codelab as codelab_router
from app.routers import documents as documents_mod
from app.services.codelab import exports, files, markdown_io, publish, store
from app.services.document_scaffold import scaffold_codelab


@pytest.fixture
def project(monkeypatch, tmp_path_factory):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "true")
    clear_settings_cache()
    pid = str(uuid.uuid4())
    scaffold_codelab(pid, "Mon codelab")
    monkeypatch.setattr(store.history, "snapshot", lambda *_a, **_k: None)
    yield pid
    clear_settings_cache()


def _disk(pid: str, relative: str) -> bytes:
    return (get_settings().projects_path / pid / relative).read_bytes()


# ── files ──────────────────────────────────────────────────────────────────


class TestFilePolicy:
    def test_paths_stay_under_files(self):
        assert files.normalize_path("starter/main.py") == "files/starter/main.py"
        assert files.normalize_path("files/a.txt") == "files/a.txt"
        for bad in ("../x.py", "files/../../etc/passwd", ".env", "a/.git/config", "a b.py", ""):
            with pytest.raises(SitesError):
                files.normalize_path(bad)

    def test_executables_are_blocked_by_name_and_bytes(self, project):
        for name, body in (
            ("tool.exe", b"anything"),
            ("setup.msi", b"x"),
            ("run.sh", b"MZ\x90\x00 pretend PE"),
            ("lib.py", b"\x7fELF\x02\x01"),
            ("app", b"\xcf\xfa\xed\xfe macho"),
        ):
            with pytest.raises(SitesError) as exc:
                files.save_file(project, name, body)
            assert exc.value.code == "FILE_TYPE_BLOCKED"
        # Scripts and sources are fine.
        saved = files.save_file(project, "starter/run.sh", b"#!/bin/sh\necho ok\n")
        assert saved.path == "files/starter/run.sh"

    def test_size_and_quota(self, project, monkeypatch):
        with pytest.raises(SitesError) as exc:
            files.save_file(project, "big.bin.txt", b"x" * (files.MAX_FILE_BYTES + 1))
        assert exc.value.code == "FILE_TOO_LARGE"
        monkeypatch.setattr(files, "MAX_TOTAL_BYTES", 10)
        files.save_file(project, "a.txt", b"12345")
        with pytest.raises(SitesError) as exc:
            files.save_file(project, "b.txt", b"123456")
        assert exc.value.code == "FILES_QUOTA"
        # Replacing a file counts its new size only.
        files.save_file(project, "a.txt", b"1234567890")

    def test_list_remove_and_zip(self, project):
        files.save_file(project, "starter/main.py", b"print(1)\n")
        files.save_file(project, "starter/requirements.txt", b"fastapi\n")
        files.save_file(project, "solution/main.py", b"print(2)\n")
        assert [f.path for f in files.list_files(project)] == [
            "files/solution/main.py",
            "files/starter/main.py",
            "files/starter/requirements.txt",
        ]
        archive = zipfile.ZipFile(io.BytesIO(files.zip_folder(project, "files/starter")))
        assert sorted(archive.namelist()) == ["main.py", "requirements.txt"]
        assert archive.read("main.py") == b"print(1)\n"
        everything = zipfile.ZipFile(io.BytesIO(files.zip_all_files(project, prefix="lab/")))
        assert "lab/solution/main.py" in everything.namelist()
        files.remove_file(project, "files/solution/main.py")
        assert not (get_settings().projects_path / project / "files" / "solution").exists()


# ── claat import and Markdown export ───────────────────────────────────────

CLAAT = """author: Jane Doe
summary: Construire une API
id: build-api
feedback link: https://example.com/issues
duration: 30

# Construire une API

## Mise en place
Duration: 0:05:00

Installez les dépendances.

```console
pip install fastapi
```

Positive
: Pensez à activer l'environnement virtuel.

### Vérifier

<aside class="negative">Ne lancez pas en <b>root</b>.</aside>

## Première route
Duration: 10:00

```python
@app.get("/")
def home():
    return {"ok": True}
```

<button>[Télécharger](https://example.com/starter.zip)</button>
"""


class TestClaat:
    def test_parse_metadata_steps_and_durations(self):
        imported = markdown_io.parse_claat(CLAAT)
        assert imported.title == "Construire une API"
        assert imported.author == "Jane Doe"
        assert imported.summary == "Construire une API"
        assert imported.feedback_url == "https://example.com/issues"
        assert imported.duration == 30
        assert [(s.title, s.minutes) for s in imported.steps] == [
            ("Mise en place", 5),
            ("Première route", 10),
        ]

    def test_body_is_converted_to_forge_markdown(self):
        first = markdown_io.parse_claat(CLAAT).steps[0].markdown
        assert first.startswith("# Mise en place\n")
        assert "```terminal" in first
        assert ":::tip\nPensez à activer l'environnement virtuel.\n:::" in first
        assert ":::warning\nNe lancez pas en root.\n:::" in first
        assert "## Vérifier" in first  # ### becomes ## under the step title
        assert "Duration" not in first
        second = markdown_io.parse_claat(CLAAT).steps[1].markdown
        assert "[Télécharger](https://example.com/starter.zip)" in second
        assert "<button>" not in second
        # Code stays untouched.
        assert '@app.get("/")' in second

    def test_parse_duration(self):
        assert markdown_io.parse_duration("0:05:00") == 5
        assert markdown_io.parse_duration("05:30") == 6
        assert markdown_io.parse_duration("12") == 12
        assert markdown_io.parse_duration("") == 0
        assert markdown_io.parse_duration("abc") == 0

    def test_import_route_replaces_steps(self, project, monkeypatch):
        client = _client(project, monkeypatch)
        r = client.post(f"/projects/{project}/codelab/import/claat", json={"markdown": CLAAT})
        assert r.status_code == 200, r.text
        codelab = r.json()["codelab"]
        assert [s["file"] for s in codelab["steps"]] == [
            "steps/01-mise-en-place.md",
            "steps/02-premiere-route.md",
        ]
        assert codelab["author"] == {"name": "Jane Doe"}
        # The scaffold's step file is gone, the new ones exist.
        assert not (get_settings().projects_path / project / "steps" / "01-intro.md").exists()
        assert _disk(project, "steps/02-premiere-route.md").startswith(b"# Premi")
        assert exports.read_settings(project) == {"feedbackUrl": "https://example.com/issues"}

    def test_import_without_steps_is_refused(self, project, monkeypatch):
        client = _client(project, monkeypatch)
        r = client.post(f"/projects/{project}/codelab/import/claat", json={"markdown": "rien"})
        assert r.status_code == 422

    def test_export_round_trips_through_import(self):
        imported = markdown_io.parse_claat(CLAAT)
        document, step_files = markdown_io.imported_document(imported, None)
        steps = {s["id"]: step_files[s["file"]] for s in document["steps"]}
        exported = markdown_io.export_markdown(document, steps, feedback_url="https://example.com/issues")
        assert exported.startswith("author: Jane Doe\n")
        assert "## Mise en place\nDuration: 0:05:00" in exported
        again = markdown_io.parse_claat(exported)
        assert [(s.title, s.minutes) for s in again.steps] == [("Mise en place", 5), ("Première route", 10)]
        assert ":::tip" in again.steps[0].markdown


# ── routes and gating ──────────────────────────────────────────────────────


def _client(pid: str, monkeypatch, *, entitlements=None, cloud: bool = False, role: str = "owner"):
    user_id = uuid.uuid4()
    project = SimpleNamespace(
        id=uuid.UUID(pid), user_id=user_id if role == "owner" else uuid.uuid4(), platform="codelab"
    )

    def db_get(model, key):
        if model is Project:
            return project if str(key) == pid else None
        if model is ProjectCollaborator and role in ("editor", "viewer"):
            return SimpleNamespace(role=role, accepted_at=datetime.now(UTC))
        if model is ForgeEntitlementCache:
            return entitlements
        return None

    monkeypatch.setattr(exports, "entitlements_apply", lambda _user: cloud)
    monkeypatch.setattr(exports, "get_entitlements", lambda _db, _user: entitlements)
    monkeypatch.setattr(documents_mod.history, "snapshot", lambda *_a, **_k: None)
    app = FastAPI()
    app.include_router(codelab_router.router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    app.dependency_overrides[get_db] = lambda: SimpleNamespace(get=db_get, close=lambda: None)
    return TestClient(app)


class TestRoutes:
    def test_upload_list_download_delete(self, project, monkeypatch):
        client = _client(project, monkeypatch)
        r = client.post(
            f"/projects/{project}/codelab/files",
            files={"file": ("main.py", b"print('hi')\n", "text/x-python")},
            data={"folder": "starter"},
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"path": "files/starter/main.py", "size": 12}
        listed = client.get(f"/projects/{project}/codelab/files").json()
        assert listed["files"] == [{"path": "files/starter/main.py", "size": 12}]
        raw = client.get(f"/projects/{project}/codelab/files/raw", params={"path": "files/starter/main.py"})
        assert raw.status_code == 200
        assert raw.headers["content-type"] == "application/octet-stream"
        assert "attachment" in raw.headers["content-disposition"]
        assert (
            client.delete(
                f"/projects/{project}/codelab/files", params={"path": "files/starter/main.py"}
            ).status_code
            == 200
        )
        assert client.get(f"/projects/{project}/codelab/files").json()["files"] == []

    def test_upload_refuses_executables_and_traversal(self, project, monkeypatch):
        client = _client(project, monkeypatch)
        r = client.post(
            f"/projects/{project}/codelab/files", files={"file": ("x.exe", b"MZ", "application/octet-stream")}
        )
        assert r.status_code == 400
        r = client.post(
            f"/projects/{project}/codelab/files",
            files={"file": ("ok.py", b"x", "text/plain")},
            data={"folder": "../.."},
        )
        assert r.status_code == 400

    def test_viewer_cannot_upload(self, project, monkeypatch):
        client = _client(project, monkeypatch, role="viewer")
        r = client.post(f"/projects/{project}/codelab/files", files={"file": ("a.py", b"x", "text/plain")})
        assert r.status_code in (403, 404)

    def test_open_source_exports_everything(self, project, monkeypatch):
        files.save_file(project, "starter/main.py", b"print(1)\n")
        client = _client(project, monkeypatch)
        md = client.get(f"/projects/{project}/codelab/export/markdown")
        assert md.status_code == 200
        assert md.text.startswith("summary:")
        assert "# Mon codelab" in md.text
        zipped = client.get(f"/projects/{project}/codelab/export/sources")
        assert zipped.status_code == 200
        assert "mon-codelab/starter/main.py" in zipfile.ZipFile(io.BytesIO(zipped.content)).namelist()

    def test_free_plan_exports_nothing(self, project, monkeypatch):
        free = SimpleNamespace(plan_slug="free", export_pdf=False)
        client = _client(project, monkeypatch, cloud=True, entitlements=free)
        for path in ("markdown", "sources", "pdf"):
            r = client.get(f"/projects/{project}/codelab/export/{path}")
            assert r.status_code == 403, path
            assert r.json()["detail"]["code"] == "FEATURE_NOT_IN_PLAN"

    def test_starter_exports_markdown_and_zip_pdf_needs_the_right(self, project, monkeypatch):
        starter = SimpleNamespace(plan_slug="starter", export_pdf=False)
        client = _client(project, monkeypatch, cloud=True, entitlements=starter)
        assert client.get(f"/projects/{project}/codelab/export/markdown").status_code == 200
        assert client.get(f"/projects/{project}/codelab/export/sources").status_code == 200
        assert client.get(f"/projects/{project}/codelab/export/pdf").status_code == 403

    def test_cloud_account_without_plan_counts_as_free(self, project, monkeypatch):
        client = _client(project, monkeypatch, cloud=True, entitlements=None)
        assert client.get(f"/projects/{project}/codelab/export/markdown").status_code == 403

    def test_settings_accept_https_only(self, project, monkeypatch):
        client = _client(project, monkeypatch)
        assert (
            client.put(f"/projects/{project}/codelab/settings", json={"feedbackUrl": "http://x"}).status_code
            == 400
        )
        r = client.put(
            f"/projects/{project}/codelab/settings", json={"feedbackUrl": "https://forms.example/a"}
        )
        assert r.json() == {"feedbackUrl": "https://forms.example/a"}
        assert client.get(f"/projects/{project}/codelab/settings").json() == {
            "feedbackUrl": "https://forms.example/a"
        }


# ── published site ─────────────────────────────────────────────────────────


@pytest.fixture
def fake_bundle(monkeypatch, tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "player-ABC123.js").write_text("console.log('player')", encoding="utf-8")
    (dist / "chunk-python-XYZ.js").write_text("export default 1", encoding="utf-8")
    (dist / "manifest.json").write_text(json.dumps({"entry": "player-ABC123.js"}), encoding="utf-8")
    monkeypatch.setattr(publish, "bundle_dir", lambda: dist)
    return dist


def test_site_build_packs_downloads_and_data(project, fake_bundle, tmp_path):
    files.save_file(project, "starter/main.py", b"print(1)\n")
    files.save_file(project, "data.csv", b"a,b\n1,2\n")
    codelab = store.read_codelab(project)
    codelab["downloads"] = [
        {"id": "starter", "label": "Projet de départ", "path": "files/starter", "zip": True},
        {"id": "data", "label": "Données", "path": "files/data.csv"},
        {"id": "gone", "label": "Disparu", "path": "files/nothing", "zip": True},
    ]
    store.write_codelab(project, codelab)
    exports.write_settings(project, {"feedbackUrl": "https://forms.example/avis"})
    out = tmp_path / "site"
    out.mkdir()
    summary = publish.build_codelab_site(project, out, site_url="https://lab.example/", lang="fr", badge=True)
    assert summary["mode"] == "codelab_player"
    html = (out / "index.html").read_text(encoding="utf-8")
    assert '<script type="module" src="assets/codelab/player-ABC123.js"></script>' in html
    assert "<title>Mon codelab</title>" in html
    assert "Content-Security-Policy" in html
    assert (out / "assets/codelab/chunk-python-XYZ.js").is_file()
    assert (out / "files/starter/main.py").is_file()
    data = json.loads((out / "codelab-data.json").read_text(encoding="utf-8"))
    assert data["badge"] is True
    assert data["feedbackUrl"] == "https://forms.example/avis"
    assert set(data["steps"]) == {"intro"}
    downloads = {d["id"]: d for d in data["downloads"]}
    assert downloads["starter"]["url"] == "downloads/starter.zip"
    assert zipfile.ZipFile(out / "downloads/starter.zip").namelist() == ["main.py"]
    assert downloads["data"] == {
        "id": "data",
        "label": "Données",
        "path": "files/data.csv",
        "url": "files/data.csv",
        "size": 8,
        "name": "data.csv",
    }
    assert "url" not in downloads["gone"]


def test_site_build_without_bundle_says_how_to_build_it(project, monkeypatch, tmp_path):
    monkeypatch.setattr(publish, "bundle_dir", lambda: tmp_path / "missing")
    with pytest.raises(publish.CodelabBundleMissing, match="build:codelab-player"):
        publish.build_codelab_site(project, tmp_path, site_url="https://x/")


def test_fonts_of_the_charter_are_linked():
    md = "## Typography\n- display: Fraunces\n- body: Nunito Sans, sans-serif\n- mono: JetBrains Mono\n"
    assert publish.font_families(md) == ["Fraunces", "Nunito Sans", "JetBrains Mono"]
    assert "family=Nunito+Sans" in publish.fonts_link(["Nunito Sans"])
    assert publish.font_families("- body: system-ui, sans-serif") == []


@pytest.mark.asyncio
async def test_publish_uploads_the_codelab_site(project, fake_bundle, monkeypatch):
    from app.services import publish_esm

    stored: dict[str, bytes] = {}

    class Store:
        bucket_site_assets = "sites"

        def put(self, bucket, key, body, content_type, cache_control=None):
            stored[key] = body

        def list_prefix(self, bucket, prefix):
            return [*stored, f"{prefix}old.js"]

        def delete_keys(self, bucket, keys, under_prefix):
            return len(keys)

    monkeypatch.setattr(publish_esm, "get_object_store", lambda: Store())
    result = await publish.publish_codelab_player(
        project, "mon-lab", site_url="https://mon-lab.example/", lang="fr", badge=False
    )
    assert result["build_mode"] == "codelab_player"
    assert "mon-lab/index.html" in stored
    assert "mon-lab/codelab-data.json" in stored
    assert result["orphans_deleted"] == 1
