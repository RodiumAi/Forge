"""`reasoning_effort` follows the catalogue flag; the Claude rule is only a fallback."""

import asyncio

import pytest

from app.services import llm
from app.services.orchestration import catalog


@pytest.fixture(autouse=True)
def fresh_cache():
    catalog.invalidate_reasoning_model_cache()
    yield
    catalog.invalidate_reasoning_model_cache()


def _broken():
    raise RuntimeError("database unreachable")


def test_a_flagged_model_gets_effort_whatever_its_family(monkeypatch):
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", lambda: frozenset({"deepseek/deepseek-r2"}))
    params = llm._generation_params(None, None, model="deepseek/deepseek-r2", reasoning_effort="high")
    assert params == {"reasoning_effort": "high"}


def test_an_unflagged_claude_gets_no_effort(monkeypatch):
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", frozenset)
    params = llm._generation_params(None, None, model="anthropic/claude-opus-5-5", reasoning_effort="high")
    assert "reasoning_effort" not in params


def test_the_claude_rule_is_the_fallback_when_the_database_fails(monkeypatch):
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", _broken)
    assert catalog.reasoning_model_slugs() is None
    assert llm.model_supports_reasoning("anthropic/claude-opus-5-5")
    assert not llm.model_supports_reasoning("google/gemini-3.7-flash")


def test_a_failed_refresh_keeps_the_last_good_answer(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(catalog.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", lambda: frozenset({"openai/o9"}))
    assert llm.model_supports_reasoning("openai/o9")
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", _broken)
    clock[0] += 120
    assert llm.model_supports_reasoning("openai/o9")
    assert not llm.model_supports_reasoning("anthropic/claude-opus-5-5")


def test_the_answer_is_cached_for_a_minute(monkeypatch):
    calls: list[int] = []
    clock = [1000.0]

    def load():
        calls.append(1)
        return frozenset({f"acme/think-{len(calls)}"})

    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", load)
    monkeypatch.setattr(catalog.time, "monotonic", lambda: clock[0])
    assert llm.model_supports_reasoning("acme/think-1")
    clock[0] += 59
    assert llm.model_supports_reasoning("acme/think-1")
    assert len(calls) == 1
    clock[0] += 2
    assert llm.model_supports_reasoning("acme/think-2")
    assert len(calls) == 2


def test_no_lookup_when_no_effort_is_asked(monkeypatch):
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", _broken)
    assert asyncio.run(llm._reasoning_flag("anthropic/claude-opus-5-5", None)) is False
    assert llm._generation_params(0.2, None, model="google/gemini-3.7-flash") == {"temperature": 0.2}


def test_an_async_caller_passes_the_flag_it_looked_up(monkeypatch):
    monkeypatch.setattr(catalog, "_load_reasoning_slugs_from_db", lambda: frozenset({"openai/gpt-5.6-terra"}))
    flag = asyncio.run(llm._reasoning_flag("openai/gpt-5.6-terra", "low"))
    assert flag is True
    params = llm._generation_params(
        None, None, model="openai/gpt-5.6-terra", reasoning_effort="low", supports_reasoning=flag
    )
    assert params == {"reasoning_effort": "low"}


def test_the_seed_flags_the_reasoning_models():
    flagged = {row["slug"] for row in catalog.CATALOG_SEED if row["supports_reasoning"]}
    assert flagged == {
        "google/gemini-3.7-flash",
        "google/gemini-3.1-pro",
        "anthropic/claude-sonnet-5-5",
        "anthropic/claude-sonnet-4-6",
        "openai/gpt-5.6-terra",
    }
    assert all("supports_reasoning" in row for row in catalog.CATALOG_SEED)


def test_the_one_shot_backfill_names_the_seed_reasoning_models():
    import inspect
    import re

    from app import db

    source = inspect.getsource(db.init_db)
    block = source[source.index("model-catalog-reasoning-v1") :]
    block = block[block.index("WHERE slug IN (") :]
    block = block[: block.index(");")]
    named = set(re.findall(r"'([^']+)'", block))
    flagged = {row["slug"] for row in catalog.CATALOG_SEED if row["supports_reasoning"]}
    assert named == flagged
