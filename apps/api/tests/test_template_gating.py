"""Free starts from its free kits only; the other kits start at Starter."""

from __future__ import annotations

from collections import Counter
from types import SimpleNamespace

import pytest

from app.errors import SitesError
from app.services import template_gating as gating
from app.services.templates import get_template, list_templates


def _plan(monkeypatch, slug: str | None, *, cloud: bool = True) -> None:
    monkeypatch.setattr(gating, "entitlements_apply", lambda _user: cloud)
    row = None if slug is None else SimpleNamespace(plan_slug=slug)
    monkeypatch.setattr(gating, "get_entitlements", lambda _db, _user: row)


def _paid_kit():
    return next(m for m in list_templates() if not m.free and m.kind != "design_system")


def test_two_free_kits_per_kind_and_none_for_design_systems():
    free = Counter(m.kind for m in list_templates() if m.free)
    assert free == {"slides": 2, "web": 2, "mobile": 2, "codelab": 2}


def test_required_plan_of_each_kit():
    for meta in list_templates():
        if meta.kind == "design_system":
            assert meta.required_plan == "builder"
        else:
            assert meta.required_plan == (None if meta.free else "starter")


@pytest.mark.parametrize("slug", ["free", "Free ", None])
def test_free_is_refused_a_paid_kit(monkeypatch, slug):
    _plan(monkeypatch, slug)
    meta = _paid_kit()
    assert gating.template_allowed(None, object(), meta) is False
    with pytest.raises(SitesError) as err:
        gating.require_template(None, object(), meta)
    assert err.value.status_code == 403
    assert err.value.detail["code"] == "TEMPLATE_NOT_IN_PLAN"
    assert err.value.detail["requiredPlan"] == "starter"
    assert err.value.detail["templateId"] == meta.id


def test_free_may_use_a_free_kit(monkeypatch):
    _plan(monkeypatch, "free")
    gating.require_template(None, object(), get_template("gallery-photos"))


@pytest.mark.parametrize("slug", ["starter", "builder", "pro", "team-pro"])
def test_paid_plans_use_every_kit(monkeypatch, slug):
    _plan(monkeypatch, slug)
    gating.require_template(None, object(), _paid_kit())


def test_design_system_kits_are_left_to_their_own_rule(monkeypatch):
    _plan(monkeypatch, "free")
    gating.require_template(None, object(), get_template("design-system-saas"))


def test_self_hosted_installs_are_unrestricted(monkeypatch):
    _plan(monkeypatch, None, cloud=False)
    assert gating.template_allowed(None, object(), _paid_kit()) is True
