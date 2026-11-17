"""Per-plan model defaults (entitlements.default_models)."""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.models import ForgeEntitlementCache, ModelCatalog
from app.services import plan_models
from app.services.entitlements import upsert_entitlements
from app.services.plan_models import (
    RoleModels,
    clean_default_models,
    reset_active_plan_models,
    resolve_for_entitlements,
    set_active_plan_models,
)

GLOBAL = RoleModels(
    default_model="global/main",
    escalation_model="global/escalation",
    lite_model="global/lite",
    default_image_model="global/image",
)

CATALOG = {
    "google/gemini-3.7-flash": ("primary", "text", "active"),
    "google/gemini-lite": ("lite", "text", "active"),
    "anthropic/claude-sonnet-5-5": ("escalation", "text", "active"),
    "openai/gpt-image-2": ("image", "image", "active"),
    "old/retired": ("primary", "text", "disabled"),
}


class CatalogDb:
    def get(self, model, key):
        if model is ModelCatalog and key in CATALOG:
            tier, role, status = CATALOG[key]
            return SimpleNamespace(slug=key, tier=tier, role=role, status=status)
        return None


@pytest.fixture(autouse=True)
def fixed_globals(monkeypatch):
    monkeypatch.setattr(plan_models, "global_models", lambda: GLOBAL)
    plan_models.invalidate_plan_models_cache()
    yield
    plan_models.invalidate_plan_models_cache()


def _cache(plan: str, tiers: list[str] | None, defaults: dict | None, model_selection: bool = False):
    return SimpleNamespace(
        plan_slug=plan,
        allowed_model_tiers=json.dumps(tiers) if tiers is not None else None,
        default_models=json.dumps(defaults) if defaults else None,
        model_selection=model_selection,
        priority_generation=True,
    )


FREE_TIERS = ["lite", "primary"]
PRO_TIERS = ["lite", "primary", "escalation", "image"]


def test_clean_keeps_only_known_non_empty_keys():
    raw = {
        "default_model": " google/gemini-3.7-flash ",
        "lite_model": "",
        "escalation_model": 42,
        "unknown": "x/y",
    }
    assert clean_default_models(raw) == {"default_model": "google/gemini-3.7-flash"}
    assert clean_default_models(None) == {}
    assert clean_default_models(["default_model"]) == {}


def test_upsert_caches_default_models_from_the_plan():
    class FakeDb:
        def __init__(self):
            self.rows = {}

        def get(self, _model, key):
            return self.rows.get(key)

        def add(self, row):
            self.rows[row.user_id] = row

        def flush(self):
            pass

    user = SimpleNamespace(id=uuid.uuid4())
    row: ForgeEntitlementCache = upsert_entitlements(
        FakeDb(),
        user,
        {"plan": "pro", "entitlements": {"default_models": {"default_model": "a/b", "bogus": "c/d"}}},
    )
    assert json.loads(row.default_models) == {"default_model": "a/b"}
    empty = upsert_entitlements(FakeDb(), user, {"plan": "free", "entitlements": {}})
    assert empty.default_models is None


def test_no_cached_plan_uses_globals():
    assert resolve_for_entitlements(CatalogDb(), None) == GLOBAL


def test_plan_without_overrides_uses_globals():
    assert resolve_for_entitlements(CatalogDb(), _cache("free", FREE_TIERS, None)) == GLOBAL


def test_plan_override_wins_over_global():
    cached = _cache(
        "free",
        FREE_TIERS,
        {"default_model": "google/gemini-3.7-flash", "lite_model": "google/gemini-lite"},
    )
    models = resolve_for_entitlements(CatalogDb(), cached)
    assert models.default_model == "google/gemini-3.7-flash"
    assert models.lite_model == "google/gemini-lite"
    assert models.escalation_model == GLOBAL.escalation_model
    assert models.default_image_model == GLOBAL.default_image_model


def test_override_outside_plan_tiers_falls_back_on_free_but_not_on_pro():
    defaults = {"default_model": "anthropic/claude-sonnet-5-5"}
    free = resolve_for_entitlements(CatalogDb(), _cache("free", FREE_TIERS, defaults))
    pro = resolve_for_entitlements(CatalogDb(), _cache("pro", PRO_TIERS, defaults))
    assert free.default_model == GLOBAL.default_model
    assert pro.default_model == "anthropic/claude-sonnet-5-5"


def test_inactive_unknown_or_wrong_role_override_falls_back():
    cached = _cache(
        "pro",
        PRO_TIERS,
        {
            "default_model": "old/retired",
            "lite_model": "nope/missing",
            "escalation_model": "openai/gpt-image-2",
            "default_image_model": "google/gemini-3.7-flash",
        },
    )
    assert resolve_for_entitlements(CatalogDb(), cached) == GLOBAL


def test_image_override_is_not_tier_gated():
    cached = _cache("free", FREE_TIERS, {"default_image_model": "openai/gpt-image-2"})
    assert resolve_for_entitlements(CatalogDb(), cached).default_image_model == "openai/gpt-image-2"


def test_bound_plan_models_drive_effective_settings():
    settings = get_settings()
    bound = RoleModels("plan/main", "plan/escalation", "plan/lite", "plan/image")
    token = set_active_plan_models(bound)
    try:
        assert settings.effective_default_model == "plan/main"
        assert settings.effective_escalation_model == "plan/escalation"
        assert settings.effective_lite_model == "plan/lite"
        assert settings.effective_default_image_model == "plan/image"
    finally:
        reset_active_plan_models(token)
    assert settings.effective_default_model != "plan/main"


def test_route_task_uses_the_bound_plan_default():
    from app.services.orchestration.router import route_task

    token = set_active_plan_models(RoleModels("plan/main", "plan/escalation", "plan/lite", "plan/image"))
    try:
        assert route_task("code.edit.medium").model == "plan/main"
        assert route_task("code.edit.small").model == "plan/lite"
        assert route_task("image.generate").model == "plan/image"
    finally:
        reset_active_plan_models(token)


def _route_with(monkeypatch, cached, requested):
    from app.routers import chats
    from app.services import entitlements
    from app.services.orchestration.router import route_task

    monkeypatch.setattr(entitlements, "get_entitlements", lambda _db, _user: cached)
    token = set_active_plan_models(resolve_for_entitlements(CatalogDb(), cached))
    try:
        route = route_task("code.edit.medium")
        return chats._route_for_request(route, CatalogDb(), SimpleNamespace(id=uuid.uuid4()), requested)
    finally:
        reset_active_plan_models(token)


def test_auto_on_a_plan_uses_the_plan_default(monkeypatch):
    cached = _cache("builder", FREE_TIERS, {"default_model": "google/gemini-3.7-flash"})
    assert _route_with(monkeypatch, cached, "auto").model == "google/gemini-3.7-flash"


def test_user_pick_beats_plan_default_when_the_plan_allows_selection(monkeypatch):
    cached = _cache("pro", PRO_TIERS, {"default_model": "google/gemini-3.7-flash"}, model_selection=True)
    assert (
        _route_with(monkeypatch, cached, "anthropic/claude-sonnet-5-5").model == "anthropic/claude-sonnet-5-5"
    )


def test_user_pick_ignored_without_model_selection(monkeypatch):
    cached = _cache("builder", PRO_TIERS, {"default_model": "google/gemini-3.7-flash"})
    assert _route_with(monkeypatch, cached, "anthropic/claude-sonnet-5-5").model == "google/gemini-3.7-flash"


def test_pick_outside_plan_tiers_falls_back_to_plan_default(monkeypatch):
    cached = _cache("pro", FREE_TIERS, {"default_model": "google/gemini-3.7-flash"}, model_selection=True)
    route = _route_with(monkeypatch, cached, "anthropic/claude-sonnet-5-5")
    assert route.model == "google/gemini-3.7-flash"
    assert route.tier == "primary"


async def test_bind_dependency_sets_the_request_models(monkeypatch):
    bound = RoleModels("dep/main", "dep/escalation", "dep/lite", "dep/image")
    monkeypatch.setattr(plan_models, "resolve_plan_models", lambda _db, _user: bound)
    result = await plan_models.bind_plan_models(user=SimpleNamespace(), db=None)
    assert result == bound
    assert get_settings().effective_default_model == "dep/main"
    set_active_plan_models(None)
