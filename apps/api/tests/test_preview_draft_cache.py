"""Draft thumbnail HTML cache is scoped per viewer."""

from __future__ import annotations

import pytest

from app.routers import preview


@pytest.fixture(autouse=True)
def _clear_cache():
    preview._DRAFT_THUMB_CACHE.clear()
    yield
    preview._DRAFT_THUMB_CACHE.clear()


def test_cached_html_is_not_shared_between_viewers():
    preview._draft_thumb_cache_set("p1", "viewer-a", "<html>a</html>")

    assert preview._draft_thumb_cache_get("p1", "viewer-a") == "<html>a</html>"
    assert preview._draft_thumb_cache_get("p1", "viewer-b") is None


def test_expired_entry_is_dropped(monkeypatch):
    preview._draft_thumb_cache_set("p1", "viewer-a", "<html>a</html>")
    real_time = preview.time.time
    monkeypatch.setattr(preview.time, "time", lambda: real_time() + preview._DRAFT_THUMB_TTL_S + 1)

    assert preview._draft_thumb_cache_get("p1", "viewer-a") is None
    assert preview._DRAFT_THUMB_CACHE == {}
