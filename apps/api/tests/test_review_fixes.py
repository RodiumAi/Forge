"""Regressions found in review of the static-site pipeline.

Each test pins one failure: pre-render writing outside the build, a page that
blocks rendering forever, forge-edit edge cases, the brand lock opening on a
negation, a continuation corrupting a file, and the visitor intake.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import pytest

from app.services.filesystem import read_file, write_file
from app.services.prerender import RenderedPage, _route_of, compose_page, route_target
from app.services.tags import EditOp, WriteOp, op_text, parse_forge_output


class TestPrerenderRoutes:
    @pytest.mark.parametrize(
        "href",
        [
            "/a/../../../evil",
            "/..",
            "/%2e%2e/x",
            "/a\\b",
            "/x\x00y",
            "/" + "/".join(["d"] * 12),
            "/assets/app.js",
            "https://elsewhere.example/page",
        ],
    )
    def test_unsafe_or_foreign_links_are_not_routes(self, href):
        assert _route_of(href) is None

    def test_dotted_routes_are_pages(self):
        assert _route_of("/blog/v1.2") == "/blog/v1.2"
        assert _route_of("/u/jane.doe/") == "/u/jane.doe"
        assert _route_of("//double//slash") is None or _route_of("/double//slash") == "/double/slash"

    def test_route_target_stays_inside_the_build(self, tmp_path):
        assert route_target(tmp_path, "/") == tmp_path.resolve() / "index.html"
        assert route_target(tmp_path, "/carte") == tmp_path.resolve() / "carte" / "index.html"
        assert route_target(tmp_path, "/../../escape") is None

    def test_a_backslash_in_the_title_is_text(self):
        page = RenderedPage(route="/", html="<p>x</p>", title="AC\\DC Tribute", managed=[])
        doc = compose_page(
            '<html><head><title>T</title></head><body><div id="root"></div></body></html>', page
        )
        assert "<title>AC\\DC Tribute</title>" in doc


def _chromium() -> bool:
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            for kwargs in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
                try:
                    p.chromium.launch(headless=True, **kwargs).close()
                    return True
                except Exception:
                    continue
    except Exception:
        return False
    return False


class TestPrerenderIsolation:
    def test_a_page_that_blocks_its_main_thread_cannot_hold_the_publish(self, tmp_path):
        if not _chromium():
            pytest.skip("no Chromium build")
        from app.services.prerender import prerender_site

        (tmp_path / "index.html").write_text(
            '<html><head><title>x</title></head><body><div id="root"><p>hi</p></div>'
            "<script>setTimeout(function () { for (;;) {} }, 50)</script></body></html>",
            encoding="utf-8",
        )
        started = time.monotonic()
        result = asyncio.run(prerender_site(tmp_path, budget_s=2))
        assert time.monotonic() - started < 30
        assert result.error, "the stuck render is reported, not waited for"


class TestEdits:
    def test_empty_search_is_reported_not_merged_into_the_next_block(self):
        from app.services.edit_apply import apply_hunks

        text = (
            '<forge-edit path="a">\n<<<<<<< SEARCH\n=======\nnew\n>>>>>>> REPLACE\n'
            "<<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE\n</forge-edit>"
        )
        hunks = parse_forge_output(text).writes[0].hunks
        assert hunks == [("", "new"), ("foo", "bar")]
        _, failure = apply_hunks("foo\n", hunks, path="a")
        assert failure.code == "EDIT_EMPTY"

    def test_op_text_covers_edits(self):
        assert op_text(WriteOp(path="a", content="x")) == "x"
        assert "https://cdn/img.png" in op_text(
            EditOp(path="a", hunks=[("old", '<img src="https://cdn/img.png" />')])
        )

    def test_package_json_edit_extends_the_allowlist_of_its_batch(self, project):
        from app.services.apply_writes import apply_validated_writes

        write_file(project, "package.json", '{\n  "dependencies": {\n    "react": "^18.3.1"\n  }\n}\n')
        ops = [
            EditOp(
                path="package.json",
                hunks=[
                    ('    "react": "^18.3.1"', '    "react": "^18.3.1",\n    "canvas-confetti": "^1.9.0"')
                ],
            ),
            WriteOp(
                path="src/App.tsx",
                content='import confetti from "canvas-confetti";\nexport default confetti;\n',
            ),
        ]
        applied, violations = apply_validated_writes(project, ops)
        assert violations == [], violations
        assert {a["path"] for a in applied} == {"package.json", "src/App.tsx"}

    def test_edit_on_a_binary_file_is_a_violation_not_a_crash(self, project):
        from app.services.apply_writes import apply_validated_writes
        from app.services.filesystem import write_bytes

        write_bytes(project, "public/logo.bin", b"\xff\xfe\x00\x81")
        applied, violations = apply_validated_writes(
            project, [EditOp(path="public/logo.bin", hunks=[("a", "b")])]
        )
        assert applied == [] and violations[0]["code"] == "EDIT_TARGET_INVALID"

    def test_the_scaffold_placeholder_css_is_not_merged_into_the_foundation(self, project):
        from app.services.apply_writes import apply_validated_writes
        from app.services.scaffold import INDEX_CSS

        write_file(project, "src/index.css", INDEX_CSS)
        apply_validated_writes(project, [WriteOp(path="src/index.css", content=":root { --bg: #fff; }\n")])
        css = read_file(project, "src/index.css")
        assert ".page" not in css and "max-width: 28rem" not in css


class TestBrandLock:
    @pytest.mark.parametrize(
        ("text", "unlocked"),
        [
            ("Change the brand to something warmer", True),
            ("regenerate DESIGN.md please", True),
            ("nouvelle charte graphique", True),
            ("follow DESIGN.md", False),
            ("update the hero but don't change the logo", False),
            ("ne change pas la marque", False),
            ("keep the logo, change the title", False),
        ],
    )
    def test_only_an_explicit_request_unlocks_the_brand(self, text, unlocked):
        from app.services.apply_writes import brand_change_requested

        assert brand_change_requested(text) is unlocked


class TestContinuationJoin:
    def _run(self, rounds):
        from app.services.llm import StreamChunk, stream_with_continuation
        from app.services.rodium_generation import RodiumGenerationAuth

        calls = []

        def fake_stream(**kwargs):
            idx = len(calls)
            calls.append(kwargs)
            chunks, finish = rounds[idx]

            async def gen():
                for c in chunks:
                    yield StreamChunk("token", c)
                kwargs["meta"]["finish_reason"] = finish

            return gen()

        async def drive():
            out = []
            async for chunk in stream_with_continuation(
                auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
                model="m",
                messages=[{"role": "user", "content": "x"}],
                stream_fn=fake_stream,
            ):
                if chunk.kind == "token":
                    out.append(chunk.content)
            return "".join(out)

        return asyncio.run(drive())

    def test_a_resumed_text_is_joined_without_a_newline(self):
        text = self._run(
            [(['<forge-write path="a.txt">hel'], "length"), (["lo world</forge-write>"], "stop")]
        )
        assert {op.path: op.content for op in parse_forge_output(text).writes} == {"a.txt": "hello world"}

    def test_a_reopened_tag_starts_on_its_own_line_even_when_split(self):
        text = self._run(
            [
                (['<forge-write path="a.txt">hal'], "length"),
                (["<", 'forge-write path="a.txt">full</forge-write>'], "stop"),
            ]
        )
        assert '\n<forge-write path="a.txt">full' in text
        assert {op.path: op.content for op in parse_forge_output(text).writes} == {"a.txt": "full"}


class TestVisitorIntake:
    def test_form_key_round_trip_and_tampering(self, monkeypatch):
        import uuid

        from app.services import site_events

        project_id = uuid.uuid4()
        key = site_events.project_form_key(project_id)

        class DB:
            def get(self, _model, pid):
                return {"id": pid}

        assert site_events.project_from_form_key(DB(), key) == {"id": project_id}
        tampered = ("A" if key[0] != "A" else "B") + key[1:]
        assert site_events.project_from_form_key(DB(), tampered) is None
        assert site_events.project_from_form_key(DB(), "not-a-key") is None

    def test_visitor_ip_trusts_the_gateway_only_with_its_secret(self, monkeypatch):
        from types import SimpleNamespace

        from app.config import clear_settings_cache
        from app.services import site_events

        monkeypatch.setenv("SITES_GATEWAY_SECRET", "s3cr3t")
        clear_settings_cache()
        try:

            def req(headers):
                return SimpleNamespace(headers=headers, client=SimpleNamespace(host="10.0.0.5"))

            good = req({"x-forge-gateway-secret": "s3cr3t", "x-forge-visitor-ip": "203.0.113.7"})
            assert site_events.visitor_ip(good) == "203.0.113.7"
            forged = req({"x-forge-gateway-secret": "nope", "x-forge-visitor-ip": "203.0.113.7"})
            assert site_events.visitor_ip(forged) != "203.0.113.7"
        finally:
            clear_settings_cache()

    def test_ipv6_rate_buckets_are_per_64(self):
        from app.services.site_events import rate_subject

        assert rate_subject("2001:db8:1:2:aaaa::1") == rate_subject("2001:db8:1:2:bbbb::9")
        assert rate_subject("203.0.113.7") == "203.0.113.7"

    def test_control_characters_never_reach_the_database(self):
        from app.services.site_events import clean_path, clean_submission

        _, fields = clean_submission("contact", {"msg\x00": "a\x00b"})
        assert fields == {"msg": "ab"}
        assert "\x00" not in clean_path("/a\x00b")

    def test_long_referrers_are_cut_not_rejected(self):
        from app.routers.site_events import HitIn

        assert len(HitIn.model_validate({"p": "/", "r": "x" * 5000}).r) == 500

    def test_csv_header_cells_are_escaped_too(self):
        import inspect

        from app.routers import site_events

        assert "_csv_cell(k) for k in keys" in inspect.getsource(site_events.export_submissions)


class TestVerifyImages:
    def test_protocol_relative_urls_are_not_missing_files(self, project):
        from app.services.orchestration.verify_build import missing_image_findings

        files = {"src/App.tsx": 'export default () => <img src="//cdn.example/x.png" />;'}
        assert missing_image_findings(project, files) == []
        files = {"src/App.tsx": 'export default () => <img src="/nope.png" />;'}
        assert missing_image_findings(project, files)[0].code == "media.missing_image"


def test_timeout_keeps_the_files_already_closed(monkeypatch):
    from app.services.orchestration import dispatcher
    from app.services.rodium_generation import RodiumGenerationAuth

    class Chunk:
        def __init__(self, content):
            self.kind = "token"
            self.content = content

    def make_stream(**_kwargs):
        async def gen():
            yield Chunk('<forge-write path="src/done.tsx">export const a = 1;</forge-write>')
            yield Chunk('<forge-write path="src/cut.tsx">export const')
            await asyncio.sleep(5)

        return gen()

    written: list[str] = []

    async def fake_apply(project_id, writes, snapshot_label=None, **_kw):
        written.extend(w.path for w in writes)
        return [{"op": "write", "path": w.path} for w in writes], []

    async def fake_messages(**kwargs):
        return [{"role": "user", "content": kwargs.get("user_query", "")}]

    import app.services.orchestration.page_visit_check as page_visit_check
    import app.services.orchestration.smoke_check as smoke_check
    import app.services.orchestration.verify_build as verify_build

    async def no_smoke(_p):
        return []

    monkeypatch.setattr(dispatcher, "_TASK_BUDGET_S", 0.3)
    monkeypatch.setattr(dispatcher, "stream_chat_completion", make_stream)
    monkeypatch.setattr(dispatcher, "build_llm_messages", fake_messages)
    monkeypatch.setattr(dispatcher, "apply_validated_writes_async", fake_apply)
    monkeypatch.setattr(dispatcher, "fallback_model", lambda _m: None)
    monkeypatch.setattr(verify_build, "verify_project_build", lambda _p: [])
    monkeypatch.setattr(verify_build, "remaining_stub_paths", lambda _p: [])
    monkeypatch.setattr(page_visit_check, "page_route_findings", lambda _p: [])
    monkeypatch.setattr(smoke_check, "smoke_transform_findings", no_smoke)
    monkeypatch.setattr("app.services.brand_charter.needs_brand_bootstrap", lambda *_a: False)

    async def drive():
        events = []
        async for chunk in dispatcher.run_plan_tasks(
            project_id="p1",
            history=[],
            user_prompt="x",
            answers_block="",
            tasks=[{"id": "edit", "title": "Edit", "acceptance": "", "files": [], "status": "pending"}],
            model="m",
            auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
            locale="en",
            run_id=None,
            db=None,
        ):
            if chunk.startswith("data: "):
                events.append(json.loads(chunk[6:]))
        return events

    events = asyncio.run(drive())
    assert written == ["src/done.tsx"]
    assert any(e.get("type") == "warning" and "src/cut.tsx" in e.get("message", "") for e in events)
    assert not [e for e in events if e.get("type") == "task_failed"]


def test_prerender_child_entry_is_importable_without_settings():
    # The child runs with a scrubbed environment: importing it must not need
    # the API configuration (secrets are not passed down).
    source = Path(__file__).resolve().parents[1] / "app" / "services" / "prerender.py"
    head = source.read_text(encoding="utf-8").split("def ", 1)[0]
    assert "app.config" not in head and "get_settings" not in head
