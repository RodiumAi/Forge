"""Platform default model overrides (admin DB over .env)."""

from unittest.mock import patch

from app.config import clear_settings_cache, get_settings
from app.services.platform_settings import effective_model, get_platform_overrides


def _empty_overrides():
    return {
        "default_model": None,
        "default_image_model": None,
        "lite_model": None,
        "escalation_model": None,
    }


class TestPlatformSettings:
    def test_effective_model_uses_env_when_db_empty(self, monkeypatch):
        monkeypatch.setenv("DEFAULT_MODEL", "env/default-model")
        clear_settings_cache()
        with patch(
            "app.services.platform_settings.get_platform_overrides",
            return_value=_empty_overrides(),
        ):
            settings = get_settings()
            assert effective_model("default_model", settings.default_model) == "env/default-model"

    def test_effective_model_prefers_valid_db_override(self, monkeypatch):
        monkeypatch.setenv("DEFAULT_MODEL", "env/default-model")
        clear_settings_cache()
        overrides = _empty_overrides()
        overrides["default_model"] = "google/gemini-3.7-flash"
        with patch(
            "app.services.platform_settings.get_platform_overrides",
            return_value=overrides,
        ):
            settings = get_settings()
            assert effective_model("default_model", settings.default_model) == "google/gemini-3.7-flash"

    def test_ignores_db_override_when_none(self):
        with patch(
            "app.services.platform_settings.get_platform_overrides",
            return_value=_empty_overrides(),
        ):
            assert effective_model("lite_model", "env/lite") == "env/lite"

    def test_get_platform_overrides_returns_all_keys(self):
        with patch(
            "app.services.platform_settings._load_overrides_from_db",
            return_value=_empty_overrides(),
        ):
            overrides = get_platform_overrides()
            assert set(overrides.keys()) == {
                "default_model",
                "default_image_model",
                "lite_model",
                "escalation_model",
            }
