"""`build_run_summary` only claims the work that was actually done."""

from __future__ import annotations

from app.services.text_plain import build_run_summary


def _plan(*statuses: str) -> list[dict]:
    return [{"id": f"t{i}", "title": f"Step {i}", "status": s} for i, s in enumerate(statuses, 1)]


def test_lists_only_completed_tasks() -> None:
    out = build_run_summary(tasks=_plan("done", "error", "pending"), applied=None, locale="en")
    assert out.startswith("Here is what was put in place.")
    assert "- Step 1" in out
    assert "Step 2" not in out
    assert "Step 3" not in out


def test_plan_stopped_on_first_task_says_nothing_was_built() -> None:
    out = build_run_summary(tasks=_plan("error", "pending", "pending"), applied=None, locale="fr")
    assert out == "Aucune étape du plan n'a abouti, rien n'a été construit."


def test_files_written_outside_the_plan_are_still_counted() -> None:
    applied = [{"path": "DESIGN.md"}, {"path": "public/generated/hero.webp"}]
    out = build_run_summary(tasks=_plan("error", "pending"), applied=applied, locale="en")
    assert out.splitlines() == ["No plan step completed.", "2 file(s) updated."]


def test_plan_without_statuses_keeps_its_titles() -> None:
    tasks = [{"id": "a", "title": "Home"}, {"id": "b", "title": "About"}]
    out = build_run_summary(tasks=tasks, applied=None, locale="en")
    assert "- Home" in out and "- About" in out


def test_single_turn_run_without_plan() -> None:
    out = build_run_summary(tasks=None, applied=[{"path": "src/App.tsx"}], locale="fr")
    assert out.splitlines() == ["Voici ce qui a été mis en place.", "1 fichier(s) mis à jour."]
