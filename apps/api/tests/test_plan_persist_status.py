"""How a run ends, and what it leaves behind.

Two production defects motivate this file:

* `plan_meta_json` was NULL on every failed run, so an incident left nothing to
  diagnose from — no cause, no failing step, not even the model.
* `persist_plan_error` forced `status = "error"` unconditionally. The dispatcher
  signals cancellation through the same `error` frame, so a run the user stopped
  on purpose overwrote the `cancelled` status the endpoint had just written and
  was reported back to them as broken.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.orchestration import plan_persist


class _FakeDb:
    """Just enough Session for these functions: get + add + commit."""

    def __init__(self, row=None):
        self.row = row
        self.added: list = []
        self.commits = 0

    def get(self, model, key):
        if getattr(model, "__name__", "") == "AgentRun":
            return self.row
        return None

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.commits += 1


def _run(**overrides):
    row = SimpleNamespace(
        id=uuid4(),
        chat_id=uuid4(),
        project_id=uuid4(),
        user_id=uuid4(),
        status="running",
        plan_json=None,
        plan_meta_json=None,
        cursor_task_index=2,
        task_class="code.scaffold",
        model_slug="google/gemini-3.7-flash",
    )
    for key, value in overrides.items():
        setattr(row, key, value)
    return row


@pytest.fixture
def quiet_analytics(monkeypatch):
    monkeypatch.setattr(plan_persist, "capture_event", lambda *a, **k: None)
    monkeypatch.setattr(plan_persist, "distinct_id_for_user", lambda _u: "anon")


class TestCancellationIsNotAFailure:
    def test_a_cancelled_run_stays_cancelled(self):
        row = _run(status="cancelled")
        db = _FakeDb(row)

        plan_persist.persist_plan_error(
            db, row.id, {"type": "error", "code": "cancelled", "message": "cancelled"}
        )

        assert row.status == "cancelled"

    def test_it_recognises_cancellation_by_code_not_only_by_wording(self):
        # The message is translated; the code is not.
        row = _run()
        db = _FakeDb(row)

        plan_persist.persist_plan_error(
            db, row.id, {"type": "error", "code": "cancelled", "message": "Génération annulée"}
        )

        assert row.status == "cancelled"

    def test_a_cancellation_writes_no_failure_message_to_the_chat(self):
        row = _run()
        db = _FakeDb(row)

        plan_persist.persist_plan_error(
            db,
            row.id,
            {"type": "error", "code": "cancelled", "message": "cancelled", "plan": [{"id": "a"}]},
        )

        assert db.added == []

    def test_a_real_failure_is_still_an_error(self):
        row = _run()
        db = _FakeDb(row)

        plan_persist.persist_plan_error(
            db, row.id, {"type": "error", "code": "quota", "message": "no credit"}
        )

        assert row.status == "error"


class TestTheCauseIsRecorded:
    def test_a_failure_records_its_code_and_message(self):
        row = _run()
        db = _FakeDb(row)

        plan_persist.persist_plan_error(
            db, row.id, {"type": "error", "code": "upstream", "message": "model refused"}
        )

        meta = json.loads(row.plan_meta_json)
        assert meta["code"] == "upstream"
        assert meta["message"] == "model refused"
        assert meta["model"] == "google/gemini-3.7-flash"
        assert meta["cursor"] == 2
        assert meta["finished_at"]

    def test_it_does_not_discard_what_the_planner_wrote_there(self):
        # plan_meta_json carries the plan's title/summary; the outcome is
        # merged into it, not written over it.
        row = _run(plan_meta_json=json.dumps({"title": "Landing page", "summary": "…"}))
        db = _FakeDb(row)

        plan_persist.persist_plan_error(db, row.id, {"type": "error", "code": "network"})

        meta = json.loads(row.plan_meta_json)
        assert meta["title"] == "Landing page"
        assert meta["code"] == "network"

    def test_unparseable_existing_meta_does_not_lose_the_outcome(self):
        row = _run(plan_meta_json="{not json")
        db = _FakeDb(row)

        plan_persist.persist_plan_error(db, row.id, {"type": "error", "code": "internal"})

        assert json.loads(row.plan_meta_json)["code"] == "internal"


class TestPartialCompletion:
    def test_a_run_that_skipped_steps_is_partial_not_done(self, quiet_analytics):
        row = _run()
        db = _FakeDb(row)

        plan_persist.handle_plan_stream_payload(
            db,
            row.id,
            {
                "type": "done",
                "summary": "built most of it",
                "plan": [{"id": "a", "status": "done"}, {"id": "b", "status": "error"}],
                "failed": [{"task_id": "b", "title": "Pages", "code": "quota"}],
            },
            plan=[],
            locale="en",
        )

        # "done" would hide it; "error" would deny the work that did land.
        assert row.status == "partial"

    def test_the_skipped_steps_are_recorded_for_later(self, quiet_analytics):
        row = _run()
        db = _FakeDb(row)

        plan_persist.handle_plan_stream_payload(
            db,
            row.id,
            {
                "type": "done",
                "summary": "s",
                "plan": [],
                "failed": [{"task_id": "b", "title": "Pages", "code": "quota", "attempts": 3}],
            },
            plan=[],
            locale="en",
        )

        meta = json.loads(row.plan_meta_json)
        assert meta["failures"][0]["task_id"] == "b"
        assert meta["failures"][0]["attempts"] == 3

    def test_a_clean_run_is_still_done(self, quiet_analytics):
        row = _run()
        db = _FakeDb(row)

        plan_persist.handle_plan_stream_payload(
            db,
            row.id,
            {"type": "done", "summary": "s", "plan": [{"id": "a", "status": "done"}], "failed": []},
            plan=[],
            locale="en",
        )

        assert row.status == "done"

    def test_a_step_mode_pause_is_untouched_by_any_of_this(self, quiet_analytics):
        row = _run()
        db = _FakeDb(row)

        plan_persist.handle_plan_stream_payload(
            db,
            row.id,
            {"type": "done", "paused": True, "summary": "s", "plan": [], "failed": []},
            plan=[],
            locale="en",
        )

        assert row.status == "awaiting_plan_confirm"
