"""Sampling and effort fields sent to the gateway, per model family."""

import pytest

from app.services.llm import _generation_params, claude_rejects_sampling


def test_new_claude_gets_effort_and_no_temperature() -> None:
    params = _generation_params(0.4, 8000, model="anthropic/claude-sonnet-5-5", reasoning_effort="medium")
    assert params == {"max_tokens": 8000, "reasoning_effort": "medium"}


def test_older_claude_keeps_temperature_and_gets_effort() -> None:
    params = _generation_params(0.4, None, model="anthropic/claude-sonnet-4-6", reasoning_effort="low")
    assert params == {"temperature": 0.4, "reasoning_effort": "low"}


def test_a_flagged_gemini_keeps_temperature_and_gets_effort() -> None:
    params = _generation_params(0.4, 100, model="google/gemini-3.7-flash", reasoning_effort="medium")
    assert params == {"temperature": 0.4, "max_tokens": 100, "reasoning_effort": "medium"}


def test_an_unflagged_model_keeps_temperature_and_gets_no_effort() -> None:
    params = _generation_params(0.4, 100, model="google/gemini-3.1-flash-lite", reasoning_effort="medium")
    assert params == {"temperature": 0.4, "max_tokens": 100}


def test_unknown_effort_is_dropped() -> None:
    assert "reasoning_effort" not in _generation_params(
        None, None, model="anthropic/claude-opus-5-5", reasoning_effort="turbo"
    )


@pytest.mark.parametrize(
    "model",
    [
        "anthropic/claude-3-5-sonnet",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-7-sonnet-20250219",
        "anthropic/claude-3-haiku@20240307",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-sonnet-4-20250514",
        "anthropic/claude-sonnet-4@20250514",
        "anthropic/claude-opus-4-1",
        "anthropic/claude-opus-4.1",
        "anthropic/claude-sonnet-4-5",
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-haiku-4-5@20251001",
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-opus-4.6",
    ],
)
def test_legacy_claude_keeps_temperature(model: str) -> None:
    assert not claude_rejects_sampling(model)
    assert _generation_params(0.4, None, model=model)["temperature"] == 0.4


@pytest.mark.parametrize(
    "model",
    [
        "anthropic/claude-opus-4-7",
        "anthropic/claude-opus-4.7",
        "anthropic/claude-sonnet-4-7",
        "anthropic/claude-sonnet-4.8",
        "anthropic/claude-haiku-4-7",
        "anthropic/claude-haiku-4.9",
        "anthropic/claude-opus-5",
        "anthropic/claude-opus-5-5",
        "anthropic/claude-sonnet-5.5",
        "anthropic/claude-haiku-5-5",
        "us.anthropic.claude-sonnet-5-5-v1:0",
        "anthropic/claude-fable-5",
        "anthropic/claude-mythos",
        "claude-opus-4-7",
    ],
)
def test_recent_claude_drops_temperature(model: str) -> None:
    assert claude_rejects_sampling(model)
    assert "temperature" not in _generation_params(0.4, None, model=model)


@pytest.mark.parametrize("model", ["google/gemini-3.7-flash", "openai/gpt-5.6-terra", ""])
def test_non_claude_keeps_temperature(model: str) -> None:
    assert not claude_rejects_sampling(model)
