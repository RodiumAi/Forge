"""Image models come from the database catalogue role, the seed list is a fallback."""

import pytest

from app.services import platform_settings
from app.services.orchestration import catalog


@pytest.fixture(autouse=True)
def fresh_cache(monkeypatch):
    monkeypatch.setattr(platform_settings, "get_platform_overrides", dict)
    catalog.invalidate_image_model_cache()
    yield
    catalog.invalidate_image_model_cache()


def test_an_admin_added_image_model_is_recognised(monkeypatch):
    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", lambda: frozenset({"acme/pixels-9"}))
    assert catalog.is_image_model("acme/pixels-9")
    # The database is the source of truth: a seed slug it does not list as an
    # image model is not one.
    assert not catalog.is_image_model("google/gemini-3-pro-image")
    assert not catalog.is_image_model("google/gemini-3.7-flash")


def test_the_platform_default_image_model_always_counts(monkeypatch):
    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", lambda: frozenset({"acme/pixels-9"}))
    monkeypatch.setattr(
        platform_settings, "get_platform_overrides", lambda: {"default_image_model": "acme/pixels-1"}
    )
    assert catalog.is_image_model("acme/pixels-1")


def test_the_seed_list_is_the_fallback_when_the_database_fails(monkeypatch):
    def broken():
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", broken)
    assert catalog.is_image_model("openai/gpt-image-2")
    assert not catalog.is_image_model("acme/pixels-9")


def test_an_empty_catalogue_falls_back_to_the_seed_list(monkeypatch):
    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", frozenset)
    assert catalog.image_model_slugs() == catalog.IMAGE_MODEL_SLUGS


def test_the_answer_is_cached_for_a_minute(monkeypatch):
    calls: list[int] = []
    clock = [1000.0]

    def load():
        calls.append(1)
        return frozenset({f"acme/pixels-{len(calls)}"})

    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", load)
    monkeypatch.setattr(catalog.time, "monotonic", lambda: clock[0])
    assert catalog.is_image_model("acme/pixels-1")
    clock[0] += 59
    assert catalog.is_image_model("acme/pixels-1")
    assert len(calls) == 1
    clock[0] += 2
    assert catalog.is_image_model("acme/pixels-2")
    assert len(calls) == 2


def test_a_failed_refresh_keeps_the_last_good_answer(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(catalog.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", lambda: frozenset({"acme/pixels-9"}))
    assert catalog.is_image_model("acme/pixels-9")

    def broken():
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(catalog, "_load_image_slugs_from_db", broken)
    clock[0] += 120
    assert catalog.is_image_model("acme/pixels-9")
