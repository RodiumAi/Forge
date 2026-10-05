"""House typography: no long dashes in plans, questions, briefs, SEO or sites."""

from __future__ import annotations

import json

import pytest

from app.services import typography as ty
from app.services.orchestration import planner


@pytest.mark.parametrize(
    "text,label,expected",
    [
        ("Home page — hero, CTA, video preview strip", True, "Home page: hero, CTA, video preview strip"),
        ("Global polish — animations, confetti accents & scroll", True, "Global polish: animations, confetti accents & scroll"),
        ("Un club — le meilleur de Lomé — chaque vendredi.", False, "Un club, le meilleur de Lomé, chaque vendredi."),
        ("Ouvert 10–20h, lundi–vendredi, Paris–Lomé", False, "Ouvert 10-20h, lundi-vendredi, Paris-Lomé"),
        ("<p>— Marie, fondatrice</p>", False, "<p>Marie, fondatrice</p>"),
        ('"Rire ensemble —"', False, '"Rire ensemble"'),
        ("Rien à changer, déjà propre.", False, "Rien à changer, déjà propre."),
    ],
)
def test_strip_long_dashes(text, label, expected):
    assert ty.strip_long_dashes(text, label=label) == expected


def test_generated_source_file_stays_valid_and_dash_free():
    tsx = 'export const Hero = () => <h1 title="Rire — Scène">Le rire — enfin</h1>;\n// note — ok\n'
    out = ty.strip_long_dashes_in_file("src/components/Hero.tsx", tsx)
    assert "\u2014" not in out and "\u2013" not in out
    assert out.startswith("export const Hero = () => <h1 title=")
    # Binary / unknown files are never touched.
    assert ty.strip_long_dashes_in_file("public/logo.png", "a — b") == "a — b"


@pytest.mark.asyncio
async def test_plan_titles_and_summary_have_no_long_dash(monkeypatch):
    async def fake(**_kw):
        return json.dumps(
            {
                "title": "Comedy site — v1",
                "summary": "A showcase — videos, about and contact.",
                "tasks": [
                    {"id": "home", "title": "Home page — hero, CTA, video preview strip", "acceptance": "Hero — CTA visible"},
                    {"id": "videos", "title": "Videos page — gallery grid, filter tabs & lightbox", "acceptance": "Grid renders"},
                ],
            }
        )

    monkeypatch.setattr(planner, "complete_chat", fake)
    tasks, meta = await planner.build_plan(
        prompt="site comédie", answers=None, task_class="code.scaffold", auth=None, model="m", locale="en"
    )
    blob = json.dumps({"tasks": tasks, "meta": meta}, ensure_ascii=False)
    assert "\u2014" not in blob and "\u2013" not in blob
    assert tasks[0]["title"] == "Home page: hero, CTA, video preview strip"
    assert meta["title"] == "Comedy site: v1"


def test_questions_are_cleaned():
    qs = planner.sanitize_clarify_questions(
        [{"id": "tone", "prompt": "Quel ton — drôle ou chic ?", "options": ["Drôle — punchy", "Chic — élégant"]}]
    )
    blob = json.dumps(qs, ensure_ascii=False)
    assert "\u2014" not in blob


def test_rule_is_in_every_prompt():
    from app.prompts.system import system_prompt_with_design
    from app.routers.seo import COPY_SYSTEM

    assert ty.NO_LONG_DASH_RULE in system_prompt_with_design(False)
    assert ty.NO_LONG_DASH_RULE in system_prompt_with_design(True, platform="mobile")
    assert ty.NO_LONG_DASH_RULE in COPY_SYSTEM
