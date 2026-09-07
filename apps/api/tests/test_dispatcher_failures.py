"""One bad step must not throw away the rest of the plan.

Production evidence for this file: a run failed at task 3 of 8 and lost 28
minutes of work, because the dispatcher's terminal `except` blocks did `return`.
Everything after the failure never ran, and `plan_meta_json` was NULL, so there
was no record of why.

The rule now: a task that exhausts its retry budget is recorded and skipped, the
tasks that follow are warned about the gap, and the run reports what it could
not do. Only cancellation still stops the plan.
"""

from __future__ import annotations

import asyncio
import json
import re

import pytest

from app.services.llm import RodiumError
from app.services.orchestration import dispatcher
from app.services.rodium_generation import RodiumGenerationAuth

# ── Harness ────────────────────────────────────────────────────────────────


class _Chunk:
    def __init__(self, content: str, kind: str = "token"):
        self.kind = kind
        self.content = content


def _write_tag(path: str) -> str:
    return f'<forge-write path="{path}">export const x = 1;</forge-write>'


def current_task(messages) -> str:
    """The task title the dispatcher is asking for, from its own prompt.

    Matching anywhere in the prompt is not enough: once a task fails, its title
    also appears in the "Skipped tasks" block of every prompt that follows.
    """
    match = re.search(r"Current plan task \(\d+/\d+\): (.+)", messages[0]["content"])
    return match.group(1).strip() if match else ""


@pytest.fixture
def stub_dispatcher(monkeypatch):
    """Replace everything around the loop, keep the loop itself real."""
    calls: dict = {"streams": [], "writes": []}

    async def fake_build_llm_messages(**kwargs):
        calls.setdefault("prompts", []).append(kwargs.get("user_query", ""))
        return [{"role": "user", "content": kwargs.get("user_query", "")}]

    async def fake_apply(project_id, writes, snapshot_label=None):
        applied = [{"op": "write", "path": w.path} for w in writes]
        calls["writes"].extend(applied)
        return applied, []

    monkeypatch.setattr(dispatcher, "build_llm_messages", fake_build_llm_messages)
    monkeypatch.setattr(dispatcher, "apply_validated_writes_async", fake_apply)
    monkeypatch.setattr(dispatcher, "delete_file", lambda *a, **k: None)
    # No fallback model: keeps the retry budget to the one under test. The
    # fallback path has its own test.
    monkeypatch.setattr(dispatcher, "fallback_model", lambda _m: None)

    # The verify/repair tail is a whole subsystem; it has its own tests.
    import app.services.orchestration.page_visit_check as page_visit_check
    import app.services.orchestration.smoke_check as smoke_check
    import app.services.orchestration.verify_build as verify_build

    monkeypatch.setattr(verify_build, "verify_project_build", lambda _p: [])
    monkeypatch.setattr(page_visit_check, "page_route_findings", lambda _p: [])

    async def _no_smoke(_project_id):
        return []

    monkeypatch.setattr(smoke_check, "smoke_transform_findings", _no_smoke)
    return calls


def _plan(*ids: str) -> list[dict]:
    return [
        {"id": tid, "title": tid.title(), "acceptance": "done", "files": [], "status": "pending"}
        for tid in ids
    ]


def _collect(tasks, responder, **overrides) -> tuple[list[dict], list[dict]]:
    """Run the dispatcher to completion; return (SSE payloads, final tasks)."""

    def make_stream(**_kwargs):
        async def gen():
            for item in responder(_kwargs["model"], _kwargs["messages"]):
                if isinstance(item, Exception):
                    raise item
                yield _Chunk(item)

        return gen()

    async def drive():
        events: list[dict] = []
        kwargs = dict(
            project_id="p1",
            history=[],
            user_prompt="build me a thing",
            answers_block="",
            tasks=tasks,
            model="test/model",
            auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
            locale="en",
            run_id="run-1",
            db=None,
        )
        kwargs.update(overrides)
        async for chunk in dispatcher.run_plan_tasks(**kwargs):
            if chunk.startswith("data: "):
                events.append(json.loads(chunk[6:].strip()))
        return events

    import app.services.orchestration.dispatcher as d

    original = d.stream_chat_completion
    d.stream_chat_completion = make_stream
    try:
        events = asyncio.run(drive())
    finally:
        d.stream_chat_completion = original
    return events, tasks


def _types(events: list[dict], kind: str) -> list[dict]:
    return [e for e in events if e.get("type") == kind]


# ── The rule ───────────────────────────────────────────────────────────────


class TestAFailedTaskDoesNotEndThePlan:
    def test_the_tasks_after_a_failure_still_run(self, stub_dispatcher):
        tasks = _plan("first", "second", "third")

        def responder(_model, messages):
            if current_task(messages) == "Second":
                return [RodiumError("model refused", 400, "upstream")]
            return [_write_tag("src/ok.tsx")]

        events, final = _collect(tasks, responder)

        by_id = {t["id"]: t["status"] for t in final}
        assert by_id["first"] == "done"
        assert by_id["second"] == "error"
        # The point of the whole change: task three ran anyway.
        assert by_id["third"] == "done"
        assert _types(events, "done"), "the run must still finish"

    def test_the_failure_is_announced_as_it_happens(self, stub_dispatcher):
        tasks = _plan("only", "next")

        def responder(_model, messages):
            if current_task(messages) == "Only":
                return [RodiumError("the model refused", 400, "upstream")]
            return [_write_tag("src/a.tsx")]

        events, _ = _collect(tasks, responder)

        failed = _types(events, "task_failed")
        assert len(failed) == 1
        assert failed[0]["id"] == "only"
        assert failed[0]["code"] == "upstream"
        # An ordinary failure is announced, not fatal: no `error` frame, so the
        # run carries on to "next".
        assert not _types(events, "error")

    def test_the_run_reports_what_it_skipped(self, stub_dispatcher):
        tasks = _plan("broken", "fine")

        def responder(_model, messages):
            if current_task(messages) == "Broken":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/a.tsx")]

        events, _ = _collect(tasks, responder)

        done = _types(events, "done")[-1]
        assert [f["task_id"] for f in done["failed"]] == ["broken"]
        assert done["failed"][0]["code"] == "upstream"
        # And in words, in the assistant message the user actually reads.
        assert "did not complete" in done["summary"]
        assert "Broken" in done["summary"]

    def test_later_tasks_are_told_what_was_skipped(self, stub_dispatcher):
        # A later task whose dependency never ran needs to know the ground
        # shifted. Non-structural id on purpose: a failed "architecture" or
        # "styles_foundation" task stops the plan instead (TestStructuralFailureStopsThePlan).
        tasks = _plan("setup", "pages")

        def responder(_model, messages):
            if current_task(messages) == "Setup":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/a.tsx")]

        _collect(tasks, responder)

        later = stub_dispatcher["prompts"][-1]
        assert "Skipped tasks" in later
        assert "Setup" in later
        assert "minimum needed" in later

    def test_work_done_before_the_failure_is_kept(self, stub_dispatcher):
        tasks = _plan("first", "boom")

        def responder(_model, messages):
            if current_task(messages) == "Boom":
                return [RodiumError("nope", 500, "upstream")]
            return [_write_tag("src/kept.tsx")]

        events, _ = _collect(tasks, responder)

        assert {w["path"] for w in stub_dispatcher["writes"]} >= {"src/kept.tsx"}
        assert _types(events, "done")[-1]["applied"]


class TestRetryBudget:
    def test_a_transient_drop_is_retried_before_giving_up(self, stub_dispatcher):
        tasks = _plan("flaky")
        attempts = {"n": 0}

        def responder(_model, _messages):
            attempts["n"] += 1
            if attempts["n"] == 1:
                return [RodiumError("connection reset by peer", None, "network")]
            return [_write_tag("src/a.tsx")]

        events, final = _collect(tasks, responder)

        assert attempts["n"] == 2
        assert final[0]["status"] == "done"
        # The browser is told to discard the partial answer before the retry.
        assert _types(events, "stream_reset")

    def test_it_stops_retrying_the_network_after_two_tries(self, stub_dispatcher):
        tasks = _plan("dead")

        def responder(_model, _messages):
            return [RodiumError("connection reset by peer", None, "network")]

        events, final = _collect(tasks, responder)

        assert final[0]["status"] == "error"
        failed = _types(events, "task_failed")[0]
        assert failed["code"] == "network"
        # 1 initial attempt + 2 network retries.
        assert _types(events, "done")[-1]["failed"][0]["attempts"] == 3

    def test_a_non_transient_error_is_tried_once_on_another_model(self, monkeypatch, stub_dispatcher):
        monkeypatch.setattr(
            dispatcher, "fallback_model", lambda m: None if m == "other/model" else "other/model"
        )
        tasks = _plan("refused")
        models: list[str] = []

        def responder(model, _messages):
            models.append(model)
            if model == "test/model":
                return [RodiumError("the model refused", 400, "upstream")]
            return [_write_tag("src/a.tsx")]

        _, final = _collect(tasks, responder)

        assert models == ["test/model", "other/model"]
        assert final[0]["status"] == "done"

    def test_an_empty_answer_is_re_rolled_then_failed(self, stub_dispatcher):
        tasks = _plan("silent")

        def responder(_model, _messages):
            return ["ok"]  # under 40 chars, no forge tags

        events, final = _collect(tasks, responder)

        assert final[0]["status"] == "error"
        assert _types(events, "task_failed")[0]["code"] == "empty_response"

    def test_a_bare_transport_exception_is_classified_not_swallowed(self, stub_dispatcher):
        # Anything that is not a RodiumError used to hit a generic `except` and
        # abort the run under the code `internal`, losing the retry hint.
        import httpx

        tasks = _plan("dropped")

        def responder(_model, _messages):
            return [httpx.RemoteProtocolError("peer closed connection")]

        events, final = _collect(tasks, responder)

        assert final[0]["status"] == "error"
        assert _types(events, "task_failed")[0]["code"] == "network"


class TestStructuralFailureStopsThePlan:
    """Everything after `architecture` / `styles_foundation` assumes it landed.

    Unlike an ordinary task failure, this one is not worth degrading past:
    continuing would import modules and reuse classes that were never
    written. The plan halts, leaving the rest `pending` for Resume, and skips
    the LLM repair passes rather than have them improvise the missing task.
    """

    def test_the_tasks_after_architecture_never_run(self, stub_dispatcher):
        tasks = _plan("architecture", "pages", "coherence")

        def responder(_model, messages):
            if current_task(messages) == "Architecture":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/ok.tsx")]

        events, final = _collect(tasks, responder)

        by_id = {t["id"]: t["status"] for t in final}
        assert by_id["architecture"] == "error"
        assert by_id["pages"] == "pending"
        assert by_id["coherence"] == "pending"
        # "pages" never got a chance to build a prompt at all.
        assert len(stub_dispatcher["prompts"]) == 1
        done = _types(events, "done")[-1]
        assert done["stopped"] is True
        assert [f["task_id"] for f in done["failed"]] == ["architecture"]

    def test_styles_foundation_also_stops_the_plan(self, stub_dispatcher):
        tasks = _plan("styles_foundation", "home")

        def responder(_model, messages):
            if current_task(messages) == "Styles_Foundation":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/ok.tsx")]

        events, final = _collect(tasks, responder)

        by_id = {t["id"]: t["status"] for t in final}
        assert by_id["styles_foundation"] == "error"
        assert by_id["home"] == "pending"
        assert _types(events, "done")[-1]["stopped"] is True

    def test_an_ordinary_task_failure_does_not_set_stopped(self, stub_dispatcher):
        tasks = _plan("first", "second")

        def responder(_model, messages):
            if current_task(messages) == "First":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/ok.tsx")]

        events, final = _collect(tasks, responder)

        assert final[0]["status"] == "error"
        assert final[1]["status"] == "done"
        assert _types(events, "done")[-1]["stopped"] is False

    def test_no_repair_pass_runs_after_a_structural_stop(self, stub_dispatcher, monkeypatch):
        # Critical findings would normally trigger a repair pass; on a
        # structural stop that pass must not run at all — the project is
        # deliberately half-built, and repair would try to improvise the
        # missing architecture instead of leaving it for Resume.
        import app.services.orchestration.verify_build as verify_build
        from app.services.orchestration.verify_build import VerifyFinding

        monkeypatch.setattr(
            verify_build,
            "verify_project_build",
            lambda _p: [
                VerifyFinding(
                    code="entry.createRoot", severity="critical", path="src/main.tsx", message="boom"
                )
            ],
        )
        tasks = _plan("architecture", "pages")

        def responder(_model, messages):
            if current_task(messages) == "Architecture":
                return [RodiumError("boom", 500, "upstream")]
            return [_write_tag("src/ok.tsx")]

        events, _ = _collect(tasks, responder)

        # Only the failed "architecture" task ever built a prompt: no repair
        # pass fired a second `build_llm_messages` call for it.
        assert len(stub_dispatcher["prompts"]) == 1
        steps = {s["id"]: s["status"] for s in _types(events, "step")}
        assert steps["verify_build"] == "error"


class TestFatalFailureAbortsThePlan:
    """Some failures doom every task after them, not just the current one.

    An empty RODI balance (`quota`) or a dead key (`invalid_key`) can't heal
    between tasks: skipping ahead just re-hits the same wall N times while the
    UI keeps spinning "Building…". These abort the run with a terminal `error`
    frame so the client stops immediately and offers the recharge action.
    """

    def test_an_empty_balance_ends_the_run_at_once(self, stub_dispatcher):
        tasks = _plan("first", "second", "third")

        def responder(_model, messages):
            if current_task(messages) == "First":
                return [RodiumError("no credit", 402, "quota")]
            return [_write_tag("src/ok.tsx")]

        events, final = _collect(tasks, responder)

        # The failed task is announced, then the run ends on an `error` frame.
        assert _types(events, "task_failed")[0]["code"] == "quota"
        errors = _types(events, "error")
        assert errors and errors[-1]["code"] == "quota"
        # No `done`: the client's error handler unlocks the composer instead.
        assert not _types(events, "done")
        # The tasks after the failure never even built a prompt.
        assert len(stub_dispatcher["prompts"]) == 1
        by_id = {t["id"]: t["status"] for t in final}
        assert by_id["first"] == "error"
        assert by_id["second"] == "pending"
        assert by_id["third"] == "pending"

    def test_a_dead_key_also_ends_the_run(self, stub_dispatcher):
        tasks = _plan("only", "next")

        def responder(_model, messages):
            if current_task(messages) == "Only":
                return [RodiumError("bad key", 401, "invalid_key")]
            return [_write_tag("src/ok.tsx")]

        events, _ = _collect(tasks, responder)

        errors = _types(events, "error")
        assert errors and errors[-1]["code"] == "invalid_key"
        assert not _types(events, "done")


class TestCancellation:
    def test_cancelling_still_stops_the_plan(self, stub_dispatcher, monkeypatch):
        # The one case that must NOT continue: the user asked it to stop.
        import app.services.orchestration.cancel as cancel

        monkeypatch.setattr(cancel, "is_cancelled", lambda _rid: True)
        tasks = _plan("a", "b")

        events, _ = _collect(tasks, lambda *_: [_write_tag("src/a.tsx")])

        errors = _types(events, "error")
        assert errors and errors[-1]["code"] == "cancelled"
        assert not _types(events, "done")


class TestBudget:
    def test_a_task_that_never_finishes_is_bounded(self, stub_dispatcher, monkeypatch):
        # httpx only bounds the wait for the NEXT chunk, so a model dribbling
        # one token a minute could hold a task open forever.
        monkeypatch.setattr(dispatcher, "_TASK_BUDGET_S", 0.15)
        tasks = _plan("slow", "after")

        def make_stream(**_kwargs):
            async def gen():
                yield _Chunk("start")
                await asyncio.sleep(5)
                yield _Chunk(_write_tag("src/never.tsx"))

            return gen()

        async def drive():
            events = []
            async for chunk in dispatcher.run_plan_tasks(
                project_id="p1",
                history=[],
                user_prompt="x",
                answers_block="",
                tasks=tasks,
                model="test/model",
                auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
                locale="en",
                run_id=None,
                db=None,
            ):
                if chunk.startswith("data: "):
                    events.append(json.loads(chunk[6:].strip()))
            return events

        monkeypatch.setattr(dispatcher, "stream_chat_completion", make_stream)
        events = asyncio.run(drive())

        failed = _types(events, "task_failed")
        assert failed and failed[0]["code"] == "timeout"
        assert _types(events, "done"), "the plan carried on past the stalled task"
