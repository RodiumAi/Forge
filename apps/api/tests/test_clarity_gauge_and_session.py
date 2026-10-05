"""Clarity gauge (AI decides whether to ask) + session continuity (screenshot
follow-ups keep the reference image)."""

from __future__ import annotations

import json
import uuid

import pytest

from app.routers import chats as chats_mod
from app.services import attachments as att
from app.services.orchestration import planner

SHOT = (
    "[Reference screenshot: design.jpg | url:http://localhost:9000/forge-uploads/p/design.jpg "
    "| object:uploads/p/design.jpg | intent:reference]"
)
LOGO = "[Site asset: logo.png | url:http://localhost:9000/u/logo.png | intent:asset]"


# ── Gauge eligibility ────────────────────────────────────────────────────────


def test_vague_first_build_is_gauged():
    # The exact prompt that used to go straight to planning.
    assert planner.clarity_gauge_eligible(
        "Je veyx creer uen plateforme vitrine de comedie",
        force_scaffold=True,
        task_class="code.scaffold",
    )


@pytest.mark.parametrize(
    "prompt,force,task_class",
    [
        (f"reproduis ce design {SHOT}", True, "code.scaffold.with_vision"),  # image = spec
        ("Crée une vitrine de comédie, construis directement sans questions", True, "code.scaffold"),
        ("change le titre du hero en bleu", False, "code.edit.small"),
        ("modifie le bouton du header", False, "code.edit.medium"),
    ],
)
def test_gauge_skipped(prompt, force, task_class):
    assert not planner.clarity_gauge_eligible(prompt, force_scaffold=force, task_class=task_class)


# ── Gauge decision (LLM mocked) ──────────────────────────────────────────────


def _mock_llm(monkeypatch, payload):
    async def fake(**_kw):
        return payload if isinstance(payload, str) else json.dumps(payload)

    monkeypatch.setattr(planner, "complete_chat", fake)


QUESTION = {
    "id": "name",
    "prompt": "Quel est le nom de ta plateforme ?",
    "options": [{"id": "rire", "label": "Le Rire"}, {"id": "scene", "label": "Scène Ouverte"}],
}


@pytest.mark.asyncio
async def test_unclear_request_asks_questions(monkeypatch):
    _mock_llm(monkeypatch, {"score": 35, "missing": ["nom", "public"], "questions": [QUESTION]})
    res = await planner.assess_prompt_clarity("plateforme vitrine de comédie", "fr", auth=None, model="m")
    assert res.score == 35
    assert res.needs_questions(70)
    assert res.questions and res.questions[0]["id"] == "name"


@pytest.mark.asyncio
async def test_clear_request_builds_directly(monkeypatch):
    _mock_llm(monkeypatch, {"score": 86, "missing": [], "questions": []})
    res = await planner.assess_prompt_clarity("detailed brief", "fr", auth=None, model="m")
    assert res.score == 86
    assert not res.needs_questions(70)


@pytest.mark.asyncio
async def test_gauge_tolerates_prose_around_json(monkeypatch):
    _mock_llm(monkeypatch, 'Voici: {"score": 150, "missing": [], "questions": []} fin')
    res = await planner.assess_prompt_clarity("x", "fr", auth=None, model="m")
    assert res.score == 100  # clamped


@pytest.mark.asyncio
async def test_gauge_failure_never_blocks(monkeypatch):
    _mock_llm(monkeypatch, "not json at all")
    res = await planner.assess_prompt_clarity("x", "fr", auth=None, model="m")
    assert res.score is None
    assert not res.needs_questions(70)


# ── Final brief ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_final_brief_merges_answers(monkeypatch):
    seen = {}

    async def fake(**kw):
        seen["user"] = kw["messages"][1]["content"]
        return "Nom : Le Rire\nPublic : amateurs de stand-up"

    monkeypatch.setattr(planner, "complete_chat", fake)
    brief = await planner.build_final_brief(
        "plateforme vitrine de comédie",
        questions=[QUESTION],
        answers={"name": "rire"},
        locale="fr",
        auth=None,
        model="m",
    )
    assert "Le Rire" in brief
    # The LLM received the human question + chosen label, not raw ids.
    assert "Quel est le nom de ta plateforme ?" in seen["user"]
    assert "→ Le Rire" in seen["user"]


@pytest.mark.asyncio
async def test_final_brief_falls_back(monkeypatch):
    async def boom(**_kw):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(planner, "complete_chat", boom)
    brief = await planner.build_final_brief(
        "vitrine", questions=[QUESTION], answers={"name": "rire"}, locale="fr", auth=None, model="m"
    )
    assert "vitrine" in brief and "Le Rire" in brief


# ── Clarity gate SSE (pause vs continue) ─────────────────────────────────────


class _Run:
    def __init__(self):
        self.clarity_score = None
        self.clarify_json = None
        self.status = "running"


def _fake_session(run):
    class S:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, _model, _pk):
            return run

        def commit(self):
            pass

    return S


async def _collect(gen):
    return [json.loads(line[len("data: "):]) for chunk in [c async for c in gen] for line in chunk.splitlines() if line.startswith("data: ")]


@pytest.mark.asyncio
async def test_gate_pauses_with_ai_questions(monkeypatch):
    run = _Run()
    monkeypatch.setattr(chats_mod, "SessionLocal", _fake_session(run))

    async def assess(*_a, **_k):
        return planner.ClarityAssessment(35, ["nom"], [QUESTION])

    monkeypatch.setattr(chats_mod, "assess_prompt_clarity", assess)
    outcome = {"paused": False}
    events = await _collect(
        chats_mod._clarity_gate(
            run_pk=uuid.uuid4(), prompt="vitrine comédie", locale="fr", auth=None,
            build_model="m", force_scaffold=True, outcome=outcome,
        )
    )
    assert outcome["paused"] is True
    assert run.status == "awaiting_clarify" and run.clarity_score == 35
    clarify = next(e for e in events if e["type"] == "clarify")
    assert clarify["questions"][0]["id"] == "name"
    assert clarify["clarity"]["score"] == 35
    assert any(e.get("id") == "clarity" and "35" in e.get("label", "") for e in events)


@pytest.mark.asyncio
async def test_gate_continues_when_clear(monkeypatch):
    run = _Run()
    monkeypatch.setattr(chats_mod, "SessionLocal", _fake_session(run))

    async def assess(*_a, **_k):
        return planner.ClarityAssessment(88, [], [])

    monkeypatch.setattr(chats_mod, "assess_prompt_clarity", assess)
    outcome = {"paused": False}
    events = await _collect(
        chats_mod._clarity_gate(
            run_pk=uuid.uuid4(), prompt="brief complet", locale="fr", auth=None,
            build_model="m", force_scaffold=True, outcome=outcome,
        )
    )
    assert outcome["paused"] is False
    assert run.status == "running" and run.clarity_score == 88
    assert not any(e["type"] == "clarify" for e in events)


# ── Session continuity: the screenshot follows the follow-up ─────────────────


def test_followup_carries_previous_screenshot():
    history = [
        ("user", f"je veux que tu reproduises ça exactement {SHOT}"),
        ("assistant", "Design reproduit."),
        ("user", "j'ai demandé le design, pas le mockup — enlève les mockups mobile"),
    ]
    assert att.carried_reference_markers(history) == [SHOT]
    out = att.with_carried_references(history[-1][1], [SHOT], "fr")
    assert SHOT in out and "ne réinvente pas" in out


def test_new_screenshot_is_not_doubled():
    history = [("user", f"v1 {SHOT}"), ("assistant", "ok"), ("user", f"v2 {SHOT}")]
    assert att.carried_reference_markers(history) == []


def test_assets_are_not_carried():
    history = [("user", f"mets mon logo {LOGO}"), ("assistant", "ok"), ("user", "agrandis-le")]
    assert att.carried_reference_markers(history) == []


def test_reference_expires_after_window():
    history = [("user", f"repro {SHOT}"), ("assistant", "ok")]
    for i in range(att.CARRY_REFERENCE_WINDOW):
        history += [("user", f"edit {i}"), ("assistant", "ok")]
    history.append(("user", "encore une retouche"))
    assert att.carried_reference_markers(history) == []


# ── Single vs multiple choice ────────────────────────────────────────────────


def test_sanitize_keeps_question_type():
    raw = [
        {"id": "name", "prompt": "Nom ?", "options": ["A", "B"]},
        {"id": "sections", "prompt": "Sections ?", "type": "multiple", "options": ["Agenda", "Vidéos"]},
        {"id": "nets", "prompt": "Réseaux ?", "type": "checkbox", "options": ["IG", "TikTok"]},
        {"id": "tone", "prompt": "Ton ?", "type": "weird", "options": ["Drôle", "Chic"]},
    ]
    types = {q["id"]: q["type"] for q in planner.sanitize_clarify_questions(raw)}
    assert types == {"name": "single", "sections": "multiple", "nets": "multiple", "tone": "single"}


MULTI_Q = {
    "id": "sections",
    "prompt": "Quelles sections ?",
    "type": "multiple",
    "options": [{"id": "agenda", "label": "Agenda"}, {"id": "tickets", "label": "Billetterie"}],
}


def test_format_answers_lists_every_selection():
    block = planner.format_answers_for_prompt(
        {"name": "rire", "sections": ["agenda", "tickets", "Boutique"]}, [QUESTION, MULTI_Q]
    )
    assert "- name: Le Rire" in block
    assert "- sections: Agenda, Billetterie, Boutique" in block


@pytest.mark.asyncio
async def test_final_brief_receives_all_selections(monkeypatch):
    seen = {}

    async def fake(**kw):
        seen["user"] = kw["messages"][1]["content"]
        return "brief"

    monkeypatch.setattr(planner, "complete_chat", fake)
    await planner.build_final_brief(
        "vitrine", questions=[QUESTION, MULTI_Q], answers={"sections": ["agenda", "tickets"]},
        locale="fr", auth=None, model="m",
    )
    assert "Quelles sections ? → Agenda + Billetterie" in seen["user"]


def test_answer_schema_accepts_lists_and_bounds_them():
    from pydantic import ValidationError

    from app.schemas import ClarifyAnswersRequest

    ok = ClarifyAnswersRequest(answers={"name": " Le Rire ", "sections": ["agenda", " ", "tickets"]})
    assert ok.answers == {"name": "Le Rire", "sections": ["agenda", "tickets"]}
    with pytest.raises(ValidationError):
        ClarifyAnswersRequest(answers={"s": [str(i) for i in range(11)]})
    with pytest.raises(ValidationError):
        ClarifyAnswersRequest(answers={f"q{i}": "x" for i in range(13)})
