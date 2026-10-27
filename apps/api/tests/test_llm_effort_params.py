"""Sampling and effort fields sent to the gateway, per model family."""

from app.services.llm import _generation_params


def test_new_claude_gets_effort_and_no_temperature() -> None:
    params = _generation_params(0.4, 8000, model="anthropic/claude-sonnet-5-5", reasoning_effort="medium")
    assert params == {"max_tokens": 8000, "reasoning_effort": "medium"}


def test_older_claude_keeps_temperature_and_gets_effort() -> None:
    params = _generation_params(0.4, None, model="anthropic/claude-sonnet-4-6", reasoning_effort="low")
    assert params == {"temperature": 0.4, "reasoning_effort": "low"}


def test_other_models_keep_temperature_and_get_no_effort() -> None:
    params = _generation_params(0.4, 100, model="google/gemini-3.7-flash", reasoning_effort="medium")
    assert params == {"temperature": 0.4, "max_tokens": 100}


def test_unknown_effort_is_dropped() -> None:
    assert "reasoning_effort" not in _generation_params(
        None, None, model="anthropic/claude-opus-5-5", reasoning_effort="turbo"
    )
