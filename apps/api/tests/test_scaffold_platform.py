"""Mobile platform scaffold: PWA manifest-only (no service worker)."""

from __future__ import annotations

from pathlib import Path

from app.config import get_settings
from app.services.publish_esm import _guess_content_type
from app.services.scaffold import scaffold_vite_react


def test_mobile_scaffold_writes_manifest_without_service_worker(project):
    scaffold_vite_react(project, "MaPoche", "mobile")
    root = get_settings().projects_path / project
    assert (root / "manifest.webmanifest").is_file()
    html = (root / "index.html").read_text(encoding="utf-8")
    assert 'rel="manifest"' in html
    assert "serviceWorker" not in html
    assert "service-worker" not in html.lower()
    app = (root / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "app-shell" in app
    assert "onboard" in app
    assert "app-navbar" in app
    assert "app-tabbar" in app
    assert not (root / "sw.js").exists()
    assert not (root / "service-worker.js").exists()
    assert not list(root.rglob("*service*worker*"))
    import json

    manifest = json.loads((root / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert "serviceworker" not in json.dumps(manifest).lower()
    assert manifest.get("display") == "standalone"


def test_web_scaffold_has_no_manifest(project):
    scaffold_vite_react(project, "Site", "web")
    root = get_settings().projects_path / project
    assert not (root / "manifest.webmanifest").exists()
    html = (root / "index.html").read_text(encoding="utf-8")
    assert "manifest.webmanifest" not in html


def test_webmanifest_publish_content_type():
    assert _guess_content_type(Path("manifest.webmanifest")) == "application/manifest+json"
    assert _guess_content_type(Path("app.manifest")) == "application/manifest+json"
