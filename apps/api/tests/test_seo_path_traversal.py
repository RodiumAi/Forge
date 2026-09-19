"""SEO favicon paths must stay inside the project sandbox (no existence oracle)."""

from __future__ import annotations

from app.services import seo_meta
from app.services.filesystem import write_bytes, write_file


def test_public_to_disk_rejects_traversal():
    evils = [
        "/" + "../" * 9 + "etc/passwd",
        "/" + "../" * 9 + "etc/hostname",
        "/..\\..\\..\\etc\\passwd",
        "public/../../etc/passwd",
    ]
    for evil in evils:
        assert seo_meta._public_to_disk(evil) is None, evil


def test_asset_exists_false_for_traversal(project: str):
    assert seo_meta._asset_exists(project, "public/../../etc/passwd") is False
    assert seo_meta._asset_exists(project, "../etc/passwd") is False


def test_read_seo_meta_falls_back_instead_of_echoing_traversal(project: str):
    write_bytes(project, "public/favicon.png", b"\x89PNG\r\n\x1a\n")
    evil = "/" + "../" * 9 + "etc/passwd"
    write_file(
        project,
        "index.html",
        (
            "<!doctype html><html><head>"
            f'<link rel="icon" href="{evil}">'
            "</head><body></body></html>\n"
        ),
    )
    meta = seo_meta.read_seo_meta(project)
    assert "etc/" not in (meta["favicon_path"] or "")
    assert meta["favicon_path"] in ("/favicon.png", "/seo/favicon.png", "")


def test_write_seo_meta_ignores_traversal_favicon(project: str):
    write_file(
        project,
        "index.html",
        '<!doctype html><html><head></head><body><div id="root"></div></body></html>\n',
    )
    evil = "/" + "../" * 9 + "etc/passwd"
    out = seo_meta.write_seo_meta(project, {"favicon_path": evil, "title": "Safe"})
    assert "etc/" not in (out.get("favicon_path") or "")
    assert out.get("title") == "Safe"
