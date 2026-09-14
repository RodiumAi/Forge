"""Stored XSS via SVG (CWE-79) — upload blocked, serve as attachment."""

from app.routers.files import (
    IMAGE_EXTS,
    IMAGE_TYPES,
    _is_svg_payload,
    _svg_safe_response_headers,
)


def test_image_allowlists_exclude_svg():
    assert "image/svg+xml" not in IMAGE_TYPES
    assert ".svg" not in IMAGE_EXTS


def test_is_svg_payload_detects_extension_and_mime():
    assert _is_svg_payload(name="evil.svg", content_type="")
    assert _is_svg_payload(name="photo.png", content_type="image/svg+xml")
    assert _is_svg_payload(name="x", content_type="image/svg+xml; charset=utf-8")
    assert not _is_svg_payload(name="photo.png", content_type="image/png")
    assert not _is_svg_payload(name="icon.ico", content_type="image/x-icon")


def test_svg_safe_headers_force_attachment_and_nosniff():
    headers = _svg_safe_response_headers("evil.svg", cache_control="no-cache")
    assert headers["Content-Disposition"].startswith("attachment;")
    assert 'filename="evil.svg"' in headers["Content-Disposition"]
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Cache-Control"] == "no-cache"


def test_svg_safe_headers_strip_quotes_from_filename():
    headers = _svg_safe_response_headers('evil"x.svg', cache_control="private")
    # Quotes stripped from the name, then re-wrapped once for the header value.
    assert headers["Content-Disposition"] == 'attachment; filename="evilx.svg"'
