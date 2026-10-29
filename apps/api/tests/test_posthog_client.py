from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import posthog_client


@pytest.fixture
def fake_client(monkeypatch):
    client = MagicMock()
    monkeypatch.setattr(posthog_client, "_get_client", lambda: client)
    return client


def _settings(**overrides):
    base = {"environment": "staging", "posthog_environment": ""}
    base.update(overrides)
    return SimpleNamespace(**base)


def test_environment_label_defaults_to_the_deployment_environment(monkeypatch, fake_client):
    monkeypatch.setattr(posthog_client, "get_settings", lambda: _settings())
    posthog_client.capture_event("user-1", "forge_project_created", {"platform": "web"})
    call = fake_client.capture.call_args
    (event,) = call.args
    payload = call.kwargs["properties"]
    assert event == "forge_project_created"
    assert call.kwargs["distinct_id"] == "user-1"
    assert payload["environment"] == "staging"
    assert payload["app"] == "forge"
    assert payload["platform"] == "web"


def test_posthog_environment_overrides_the_label(monkeypatch, fake_client):
    monkeypatch.setattr(posthog_client, "get_settings", lambda: _settings(posthog_environment="production"))
    posthog_client.capture_event("user-1", "forge_generation_completed")
    payload = fake_client.capture.call_args.kwargs["properties"]
    assert payload["environment"] == "production"


def test_nothing_is_sent_without_a_distinct_id(monkeypatch, fake_client):
    monkeypatch.setattr(posthog_client, "get_settings", lambda: _settings())
    posthog_client.capture_event("", "forge_project_created")
    fake_client.capture.assert_not_called()
