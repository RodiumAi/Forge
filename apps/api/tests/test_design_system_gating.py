"""Design systems start at the Builder plan on Forge Cloud."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.errors import SitesError
from app.services.design_system import gating


def _plan(monkeypatch, slug: str | None, *, cloud: bool = True) -> None:
    monkeypatch.setattr(gating, "entitlements_apply", lambda _user: cloud)
    row = None if slug is None else SimpleNamespace(plan_slug=slug)
    monkeypatch.setattr(gating, "get_entitlements", lambda _db, _user: row)


@pytest.mark.parametrize("slug", ["builder", "pro", "scale", "team-pro", "team-scale"])
def test_builder_and_above_are_allowed(monkeypatch, slug):
    _plan(monkeypatch, slug)
    assert gating.design_systems_allowed(None, object()) is True
    gating.require_design_systems(None, object())


@pytest.mark.parametrize("slug", ["free", "starter", "Starter ", None])
def test_below_builder_is_refused_with_the_plan_to_reach(monkeypatch, slug):
    _plan(monkeypatch, slug)
    assert gating.design_systems_allowed(None, object()) is False
    with pytest.raises(SitesError) as err:
        gating.require_design_systems(None, object())
    assert err.value.status_code == 403
    assert err.value.detail["code"] == "DESIGN_SYSTEM_NOT_IN_PLAN"
    assert err.value.detail["requiredPlan"] == "builder"


def test_self_hosted_installs_are_unrestricted(monkeypatch):
    _plan(monkeypatch, None, cloud=False)
    assert gating.design_systems_allowed(None, object()) is True
