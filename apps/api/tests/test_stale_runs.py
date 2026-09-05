"""Abandoned runs have to be closed by something.

Production had one run sitting in `awaiting_plan_confirm` for thirty hours and
one `interrupted` that nothing ever cleared. Neither state self-heals, and the
builder keeps offering a Resume button for a plan whose conversation context is
long gone — so the sweep exists, and so does the single-row check on the read
path, for the window before the timer next comes round.

The one thing it must never do is kill a run that is still working.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.orchestration import plan_worker, run_queue, stale_runs


class _FakeDb:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


def _run(status: str, *, age_seconds: float):
    return SimpleNamespace(
        id=uuid4(),
        status=status,
        created_at=datetime.now(UTC) - timedelta(seconds=age_seconds),
        updated_at=datetime.now(UTC) - timedelta(seconds=age_seconds),
    )


@pytest.fixture(autouse=True)
def unclaimed(monkeypatch):
    """No Valkey, no local task: the plain "nobody is working on it" case."""
    monkeypatch.setattr(run_queue, "_redis", lambda: None)
    plan_worker._running_tasks.clear()
    yield
    plan_worker._running_tasks.clear()


class TestRunningRuns:
    def test_an_orphaned_run_becomes_interrupted(self):
        row = _run("running", age_seconds=7200)
        db = _FakeDb()

        assert stale_runs.expire_if_stale(db, row) is True
        assert row.status == "interrupted"
        assert db.commits == 1

    def test_a_young_run_is_left_alone(self):
        row = _run("running", age_seconds=30)
        db = _FakeDb()

        assert stale_runs.expire_if_stale(db, row) is False
        assert row.status == "running"

    def test_a_run_with_a_live_local_worker_is_left_alone(self):
        # The whole point of the age check is that it must not fire on work in
        # progress. A long scaffold legitimately runs for a while.
        row = _run("running", age_seconds=7200)

        async def scenario():
            task = asyncio.create_task(asyncio.sleep(5))
            plan_worker._running_tasks[str(row.id)] = task
            try:
                return stale_runs.expire_if_stale(_FakeDb(), row)
            finally:
                task.cancel()

        assert asyncio.run(scenario()) is False
        assert row.status == "running"

    def test_a_run_claimed_by_another_process_is_left_alone(self, monkeypatch):
        monkeypatch.setattr(stale_runs, "_age_seconds", lambda _r: 99999.0)
        monkeypatch.setattr(run_queue, "is_run_claimed", lambda _rid: True)
        row = _run("running", age_seconds=99999)

        assert stale_runs.expire_if_stale(_FakeDb(), row) is False
        assert row.status == "running"


class TestAwaitingRuns:
    @pytest.mark.parametrize("status", ["awaiting_clarify", "awaiting_plan_confirm"])
    def test_an_abandoned_prompt_expires(self, status):
        # The 30-hour row, exactly.
        row = _run(status, age_seconds=30 * 3600)

        assert stale_runs.expire_if_stale(_FakeDb(), row) is True
        assert row.status == "expired"

    def test_a_prompt_from_this_morning_is_still_answerable(self):
        row = _run("awaiting_plan_confirm", age_seconds=3 * 3600)

        assert stale_runs.expire_if_stale(_FakeDb(), row) is False
        assert row.status == "awaiting_plan_confirm"


class TestTerminalRuns:
    @pytest.mark.parametrize("status", ["done", "error", "partial", "cancelled", "expired"])
    def test_a_finished_run_is_never_touched(self, status):
        row = _run(status, age_seconds=10 * 86400)

        assert stale_runs.expire_if_stale(_FakeDb(), row) is False
        assert row.status == status


class TestClockHandling:
    def test_a_naive_timestamp_does_not_crash_the_sweep(self):
        # SQLite hands back naive datetimes; Postgres does not.
        row = SimpleNamespace(
            id=uuid4(),
            status="running",
            created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=5),
            updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=5),
        )

        assert stale_runs.expire_if_stale(_FakeDb(), row) is True

    def test_a_row_with_no_timestamps_is_treated_as_new(self):
        row = SimpleNamespace(id=uuid4(), status="running", created_at=None, updated_at=None)

        assert stale_runs.expire_if_stale(_FakeDb(), row) is False
