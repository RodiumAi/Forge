"""Redis must never be able to stall the API.

The API runs a single uvicorn worker and the plan job lives on that same event
loop. `run_queue` used to build a fresh SYNCHRONOUS `redis.Redis` on every call
with no `socket_timeout` — redis-py blocks indefinitely by default — and
`iter_run_event_sse` called it four times a second per open stream. A Valkey
that hung rather than refused froze every request in the process. From the
browser that looked like "the prompt spins for minutes and nothing happens".

Three properties are covered here: the client is built once with real timeouts,
repeated failures stop us asking for a while, and a reader is woken by the
publish instead of polling for it.
"""

from __future__ import annotations

import asyncio
from typing import ClassVar

import pytest

from app.services.orchestration import run_queue


@pytest.fixture(autouse=True)
def clean_queue_state():
    run_queue.reset_client_for_tests()
    run_queue._MEM_EVENTS.clear()
    run_queue._MEM_ORDER.clear()
    run_queue._SIGNALS.clear()
    yield
    run_queue.reset_client_for_tests()
    run_queue._MEM_EVENTS.clear()
    run_queue._MEM_ORDER.clear()
    run_queue._SIGNALS.clear()


class _FakeRedis:
    """Records how it was constructed and lets calls be made to fail."""

    # Shared across instances on purpose: the point of half these tests is how
    # MANY clients got built.
    instances: ClassVar[list[dict]] = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.fail = False
        _FakeRedis.instances.append(kwargs)

    def __getattr__(self, _name):
        def _call(*_a, **_k):
            if self.fail:
                raise ConnectionError("valkey unreachable")
            return 0

        return _call


@pytest.fixture
def fake_redis(monkeypatch):
    _FakeRedis.instances = []
    holder: dict[str, _FakeRedis] = {}

    def _factory(**kwargs):
        client = _FakeRedis(**kwargs)
        holder["client"] = client
        return client

    module = type(
        "redis",
        (),
        {
            "Redis": type(
                "Redis", (), {"from_url": staticmethod(lambda url, **kwargs: _factory(url=url, **kwargs))}
            )
        },
    )
    monkeypatch.setitem(__import__("sys").modules, "redis", module)
    monkeypatch.setattr(run_queue, "get_settings", lambda: type("S", (), {"redis_url": "redis://x"})())
    return holder


class TestClientConstruction:
    def test_the_client_is_built_with_socket_timeouts(self, fake_redis):
        # Without these, a hung (not refused) Valkey blocks the event loop for
        # as long as the TCP stack takes to notice — which can be minutes.
        run_queue.is_run_claimed("r1")
        kwargs = _FakeRedis.instances[0]
        assert kwargs["socket_timeout"] == run_queue._SOCKET_TIMEOUT_S
        assert kwargs["socket_connect_timeout"] == run_queue._SOCKET_TIMEOUT_S
        assert kwargs["socket_timeout"] <= 1.0

    def test_the_client_is_reused_across_calls(self, fake_redis):
        # One connection pool, not one per call: this was opening and
        # authenticating a connection four times a second per open stream.
        for _ in range(5):
            run_queue.is_run_claimed("r1")
        assert len(_FakeRedis.instances) == 1


class TestBreaker:
    def test_repeated_failures_stop_us_asking(self, fake_redis):
        run_queue.is_run_claimed("r1")  # builds the client
        fake_redis["client"].fail = True

        for _ in range(run_queue._BREAKER_THRESHOLD):
            run_queue.is_run_claimed("r1")

        # Open: no further calls are attempted at all.
        assert run_queue._redis() is None

    def test_a_success_resets_the_failure_count(self, fake_redis):
        run_queue.is_run_claimed("r1")
        fake_redis["client"].fail = True
        run_queue.is_run_claimed("r1")
        fake_redis["client"].fail = False
        run_queue.is_run_claimed("r1")
        assert run_queue._fail_count == 0

    def test_events_still_flow_while_the_breaker_is_open(self, fake_redis):
        run_queue.is_run_claimed("r1")
        fake_redis["client"].fail = True
        for _ in range(run_queue._BREAKER_THRESHOLD):
            run_queue.is_run_claimed("r1")

        run_queue.publish_run_event("r1", {"type": "step"})
        run_queue.publish_run_event("r1", {"type": "done"})
        assert [e["type"] for e in run_queue.list_run_events("r1")] == ["step", "done"]


class TestWakeups:
    """The reader waits to be told, instead of asking 4x/second."""

    def test_a_publish_wakes_a_waiting_reader(self):
        async def scenario():
            waiter = asyncio.create_task(run_queue.wait_for_run_event("r1", after=0, timeout=5.0))
            await asyncio.sleep(0)  # let it start waiting
            run_queue.publish_run_event("r1", {"type": "token"})
            return await waiter

        assert asyncio.run(scenario()) is True

    def test_an_event_published_before_the_wait_is_not_missed(self):
        # The lost-wakeup race: a publish landing between "nothing new" and
        # "now waiting" must not cost the reader a full timeout.
        async def scenario():
            run_queue.publish_run_event("r1", {"type": "token"})
            return await run_queue.wait_for_run_event("r1", after=0, timeout=0.05)

        assert asyncio.run(scenario()) is True

    def test_it_gives_up_after_the_timeout(self):
        async def scenario():
            return await run_queue.wait_for_run_event("quiet", after=0, timeout=0.05)

        assert asyncio.run(scenario()) is False

    def test_a_cursor_past_the_events_still_waits(self):
        async def scenario():
            run_queue.publish_run_event("r1", {"type": "token"})
            # Reader already consumed that one.
            return await run_queue.wait_for_run_event("r1", after=1, timeout=0.05)

        assert asyncio.run(scenario()) is False

    def test_cancelling_wakes_readers_immediately(self):
        # Cancellation is the one signal a user is actively waiting to see land.
        async def scenario():
            waiter = asyncio.create_task(run_queue.wait_for_run_event("r1", after=0, timeout=5.0))
            await asyncio.sleep(0)
            run_queue.mark_cancelled("r1")
            return await waiter

        assert asyncio.run(scenario()) is True
