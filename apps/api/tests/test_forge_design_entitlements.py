"""Forge Design rights cached from the plan (no Nest change yet)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.models import ForgeEntitlementCache
from app.schemas import ForgeEntitlementsOut
from app.services.entitlements import upsert_entitlements

NEW_RIGHTS = ("export_pdf", "export_html", "export_pptx", "remove_badge", "design_system_sharing")


class FakeDb:
    def __init__(self):
        self.rows = {}

    def get(self, _model, key):
        return self.rows.get(key)

    def add(self, row):
        self.rows[row.user_id] = row

    def flush(self):
        pass


def _upsert(entitlements: dict) -> ForgeEntitlementCache:
    user = SimpleNamespace(id=uuid.uuid4())
    return upsert_entitlements(FakeDb(), user, {"plan": "builder", "entitlements": entitlements})


def test_rights_default_to_false_when_the_plan_does_not_send_them():
    row = _upsert({"export": True})
    for name in NEW_RIGHTS:
        assert getattr(row, name) is False, name


def test_rights_are_cached_from_the_plan():
    row = _upsert({name: True for name in NEW_RIGHTS})
    for name in NEW_RIGHTS:
        assert getattr(row, name) is True, name
    assert row.export_enabled is False


def test_rights_are_exposed_in_the_status_payload():
    fields = ForgeEntitlementsOut.model_fields
    for name in NEW_RIGHTS:
        assert name in fields and fields[name].default is False
