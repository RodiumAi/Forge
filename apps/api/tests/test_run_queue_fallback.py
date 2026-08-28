"""Run events must survive a Valkey outage.

`redis.from_url` builds a client without connecting: with Valkey down every
queue call failed inside a suppress, published events vanished, and the UI
polled an empty list forever — plan task 1 "spinning" with zero feedback.
The plan job runs in the API process itself, so an in-memory mirror always
holds the events; Valkey stays authoritative when reachable.
"""

import pytest

from app.services.orchestration import run_queue


@pytest.fixture
def no_valkey(monkeypatch):
    """Simulate an unreachable/unconfigured Valkey."""
    monkeypatch.setattr(run_queue, "_redis", lambda: None)
    run_queue._MEM_EVENTS.clear()
    run_queue._MEM_ORDER.clear()
    yield
    run_queue._MEM_EVENTS.clear()
    run_queue._MEM_ORDER.clear()


class TestMemoryFallback:
    def test_events_survive_without_valkey(self, no_valkey):
        run_queue.publish_run_event("r1", {"type": "step", "id": "a"})
        run_queue.publish_run_event("r1", {"type": "done"})
        events = run_queue.list_run_events("r1")
        assert [e["type"] for e in events] == ["step", "done"]
        assert run_queue.event_count("r1") == 2

    def test_after_cursor_applies_to_the_mirror(self, no_valkey):
        for i in range(4):
            run_queue.publish_run_event("r1", {"type": "token", "i": i})
        assert [e["i"] for e in run_queue.list_run_events("r1", after=2)] == [2, 3]

    def test_clear_drops_the_mirror(self, no_valkey):
        run_queue.publish_run_event("r1", {"type": "step"})
        run_queue.clear_run_events("r1")
        assert run_queue.list_run_events("r1") == []

    def test_mirror_is_bounded(self, no_valkey):
        for i in range(run_queue._MEM_MAX_RUNS + 10):
            run_queue.publish_run_event(f"run-{i}", {"type": "done"})
        assert len(run_queue._MEM_EVENTS) <= run_queue._MEM_MAX_RUNS
        # Oldest runs evicted, newest kept.
        assert run_queue.list_run_events(f"run-{run_queue._MEM_MAX_RUNS + 9}")


class TestBrokenClientFallback:
    def test_a_client_that_raises_still_serves_events(self, monkeypatch):
        """The real-world case: client built, server unreachable, calls raise."""

        class _Boom:
            def __getattr__(self, name):
                def _fail(*a, **k):
                    raise ConnectionError("valkey down")

                return _fail

        run_queue._MEM_EVENTS.clear()
        run_queue._MEM_ORDER.clear()
        monkeypatch.setattr(run_queue, "_redis", lambda: _Boom())
        run_queue.publish_run_event("r2", {"type": "step"})
        run_queue.publish_run_event("r2", {"type": "done"})
        assert [e["type"] for e in run_queue.list_run_events("r2")] == ["step", "done"]
        run_queue._MEM_EVENTS.clear()
        run_queue._MEM_ORDER.clear()
