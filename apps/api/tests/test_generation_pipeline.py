"""Generation pipeline: output limits, forge-edit, CSS ownership, context, routing.

Each class pins one behaviour that used to fail silently:
- the gateway capped output at 4096 tokens and a cut <forge-write> vanished;
- prompts asked for minimal diffs but only whole-file rewrites existed;
- task and repair prompts told the model to APPEND to src/index.css while the
  system prompt forbade rewriting it;
- plan "files" naming a directory were dropped from the context;
- "build my site and generate an image" produced an image and no site.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.services.edit_apply import apply_hunks
from app.services.filesystem import read_file, write_file
from app.services.tags import EditOp, WriteOp, parse_forge_output, unclosed_paths


def _edit(path: str, *pairs: tuple[str, str]) -> str:
    blocks = "".join(f"<<<<<<< SEARCH\n{a}\n=======\n{b}\n>>>>>>> REPLACE\n" for a, b in pairs)
    return f'<forge-edit path="{path}">\n{blocks}</forge-edit>'


class TestTags:
    def test_writes_and_edits_keep_document_order(self):
        text = '<forge-write path="src/a.tsx">A</forge-write>\n' + _edit("src/a.tsx", ("A", "B"))
        out = parse_forge_output(text)
        assert [type(op) for op in out.writes] == [WriteOp, EditOp]
        assert out.writes[1].hunks == [("A", "B")]
        assert out.truncated == []

    def test_an_unclosed_write_is_reported_not_dropped_silently(self):
        text = '<forge-write path="src/a.tsx">ok</forge-write><forge-write path="src/b.tsx">half'
        out = parse_forge_output(text)
        assert [op.path for op in out.writes] == ["src/a.tsx"]
        assert out.truncated == ["src/b.tsx"]
        assert unclosed_paths(text) == ["src/b.tsx"]

    def test_a_re_emitted_file_wins_over_its_cut_version(self):
        # What a continuation produces: the cut tag, then the file again in full.
        text = '<forge-write path="src/b.tsx">half\n<forge-write path="src/b.tsx">full</forge-write>'
        out = parse_forge_output(text)
        assert [(op.path, op.content) for op in out.writes] == [("src/b.tsx", "full")]
        assert out.truncated == []

    def test_empty_replace_deletes_lines(self):
        out = parse_forge_output(_edit("src/a.css", (".x { color: red; }", "")))
        assert out.writes[0].hunks == [(".x { color: red; }", "")]


class TestEditApply:
    def test_exact_match(self):
        new, failure = apply_hunks("a\nb\nc\n", [("b", "B")])
        assert failure is None and new == "a\nB\nc\n"

    def test_trailing_whitespace_and_indent_drift_still_match_once(self):
        content = "function A() {\n    return 1;   \n}\n"
        new, failure = apply_hunks(
            content, [("function A() {\n  return 1;\n}", "function A() {\n  return 2;\n}")]
        )
        assert failure is None
        assert new == "function A() {\n  return 2;\n}\n"

    def test_first_line_indent_is_carried_over(self):
        content = "<div>\n    <p>old</p>\n</div>\n"
        new, failure = apply_hunks(content, [("<p>old</p>\n</div>", "<p>new</p>\n</div>")])
        assert failure is None and "<p>new</p>" in new

    def test_ambiguous_search_is_refused(self):
        new, failure = apply_hunks("x\nx\n", [("x", "y")])
        assert failure.code == "EDIT_AMBIGUOUS" and new == "x\nx\n"

    def test_missing_search_is_refused_without_partial_application(self):
        new, failure = apply_hunks("a\nb\n", [("a", "A"), ("zzz", "Z")])
        assert failure.code == "EDIT_NO_MATCH"
        assert new == "a\nb\n", "an edit is all-or-nothing"


class TestApplyWrites:
    def test_edit_applies_to_disk_content(self, project):
        from app.services.apply_writes import apply_validated_writes

        write_file(project, "src/App.tsx", "export default function App() {\n  return <h1>Hi</h1>;\n}\n")
        applied, violations = apply_validated_writes(
            project, [EditOp(path="src/App.tsx", hunks=[("<h1>Hi</h1>", "<h1>Hello</h1>")])]
        )
        assert violations == []
        assert applied == [{"op": "write", "path": "src/App.tsx"}]
        assert "<h1>Hello</h1>" in read_file(project, "src/App.tsx")

    def test_edit_can_target_a_file_written_earlier_in_the_batch(self, project):
        from app.services.apply_writes import apply_validated_writes

        ops = [
            WriteOp(path="src/New.tsx", content="export const A = 1;\n"),
            EditOp(path="src/New.tsx", hunks=[("A = 1", "A = 2")]),
        ]
        applied, violations = apply_validated_writes(project, ops)
        assert violations == [] and len(applied) == 1
        assert read_file(project, "src/New.tsx") == "export const A = 2;\n"

    def test_failed_edit_is_a_violation_and_touches_nothing(self, project):
        from app.services.apply_writes import apply_validated_writes

        write_file(project, "src/App.tsx", "const a = 1;\n")
        applied, violations = apply_validated_writes(
            project, [EditOp(path="src/App.tsx", hunks=[("nope", "x")])]
        )
        assert applied == []
        assert violations[0]["code"] == "EDIT_NO_MATCH"
        assert read_file(project, "src/App.tsx") == "const a = 1;\n"

    def test_page_stylesheets_may_drop_rules_but_the_foundation_keeps_them(self, project):
        from app.services.apply_writes import apply_validated_writes

        filler = "\n".join(f".rule-{i} {{ color: red; }}" for i in range(40))
        write_file(project, "src/styles/home.css", ".old { color: red; }\n" + filler)
        write_file(project, "src/index.css", ".navbar { display: flex; }\n" + filler)
        apply_validated_writes(
            project,
            [
                WriteOp(path="src/styles/home.css", content=".home-screen .new { color: blue; }\n"),
                WriteOp(path="src/index.css", content=":root { --bg: #fff; }\n"),
            ],
        )
        assert ".old" not in read_file(project, "src/styles/home.css")
        foundation = read_file(project, "src/index.css")
        assert ".navbar" in foundation and "--bg" in foundation
        assert "—" not in foundation, "the merge marker must follow the house typography"

    def test_brand_files_unlock_only_on_explicit_request(self):
        from app.services.apply_writes import brand_change_requested

        assert brand_change_requested("Change the brand to something warmer")
        assert brand_change_requested("refais la charte graphique")
        assert brand_change_requested("regenerate DESIGN.md please")
        assert not brand_change_requested("change the hero title")


class TestLLMParams:
    def test_output_limit_and_temperature_are_sent(self):
        from app.services.llm import _generation_params

        assert _generation_params(0.3, 32000) == {"temperature": 0.3, "max_tokens": 32000}
        assert _generation_params(None, None) == {}

    def test_finish_reason_is_captured(self):
        from app.services.llm import _parse_stream_line

        meta: dict = {}
        line = "data: " + json.dumps({"choices": [{"delta": {"content": "x"}, "finish_reason": "length"}]})
        chunk = _parse_stream_line(line, meta)
        assert chunk.content == "x"
        assert meta["finish_reason"] == "length"

    def test_a_cut_answer_is_continued_and_the_file_completed(self):
        from app.services.llm import StreamChunk, stream_with_continuation
        from app.services.rodium_generation import RodiumGenerationAuth

        calls: list[list[dict]] = []

        def fake_stream(**kwargs):
            calls.append(kwargs["messages"])
            round_idx = len(calls)

            async def gen():
                if round_idx == 1:
                    yield StreamChunk("token", '<forge-write path="src/a.tsx">ok</forge-write>')
                    yield StreamChunk("token", '<forge-write path="src/b.tsx">hal')
                    kwargs["meta"]["finish_reason"] = "length"
                else:
                    yield StreamChunk("token", '<forge-write path="src/b.tsx">full</forge-write>')
                    kwargs["meta"]["finish_reason"] = "stop"

            return gen()

        async def drive():
            text, notices = [], []
            async for chunk in stream_with_continuation(
                auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
                model="m",
                messages=[{"role": "user", "content": "build"}],
                stream_fn=fake_stream,
            ):
                (notices if chunk.kind == "notice" else text).append(chunk.content)
            return "".join(text), notices

        text, notices = asyncio.run(drive())
        assert len(calls) == 2
        assert "src/b.tsx" in calls[1][-1]["content"], "the continuation names the cut file"
        assert calls[1][-2]["role"] == "assistant"
        out = parse_forge_output(text)
        assert {op.path: op.content for op in out.writes} == {"src/a.tsx": "ok", "src/b.tsx": "full"}
        assert json.loads(notices[0])["event"] == "continue"

    def test_still_cut_after_the_last_round_is_announced(self):
        from app.services.llm import StreamChunk, stream_with_continuation
        from app.services.rodium_generation import RodiumGenerationAuth

        def fake_stream(**kwargs):
            async def gen():
                yield StreamChunk("token", '<forge-write path="src/c.tsx">never ends')
                kwargs["meta"]["finish_reason"] = "length"

            return gen()

        async def drive():
            notices = []
            async for chunk in stream_with_continuation(
                auth=RodiumGenerationAuth(mode="secret", api_key_secret="k"),
                model="m",
                messages=[{"role": "user", "content": "x"}],
                stream_fn=fake_stream,
                max_rounds=1,
            ):
                if chunk.kind == "notice":
                    notices.append(json.loads(chunk.content))
            return notices

        notices = asyncio.run(drive())
        assert notices[-1] == {"event": "truncated", "open": ["src/c.tsx"]}


class TestUserFacingNotices:
    def test_truncation_and_stubs_are_explained_in_words(self):
        from app.services.llm import StreamChunk
        from app.services.orchestration.dispatcher import notice_sse, stub_notice

        frame = notice_sse(
            StreamChunk("notice", json.dumps({"event": "truncated", "open": ["src/b.tsx"]})), "fr"
        )
        payload = json.loads(frame[6:])
        assert payload["type"] == "warning" and "src/b.tsx" in payload["message"]
        assert "coupée" in payload["message"]
        stub = stub_notice(["src/pages/About.tsx"], "en")
        assert "placeholder" in stub["message"].lower()

    def test_unfilled_stubs_are_listed(self, project):
        from app.services.orchestration.verify_build import (
            remaining_stub_paths,
            scaffold_missing_local_modules,
        )

        write_file(project, "src/App.tsx", 'import About from "./pages/About";\nexport default About;\n')
        assert scaffold_missing_local_modules(project) == ["src/pages/About.tsx"]
        assert remaining_stub_paths(project) == ["src/pages/About.tsx"]
        write_file(project, "src/pages/About.tsx", "export default function About() { return null; }\n")
        assert remaining_stub_paths(project) == []


class TestCssOwnership:
    def test_orphans_point_at_the_page_stylesheet(self, project):
        from app.services.orchestration.verify_build import repair_focus_paths, verify_project_build

        write_file(
            project, "src/main.tsx", 'import { createRoot } from "react-dom/client";\ncreateRoot(x);\n'
        )
        write_file(project, "src/index.css", ".container { margin: 0 auto; }\n")
        write_file(
            project,
            "src/pages/Pricing.tsx",
            'import "../styles/pricing.css";\nexport default () => <div className="pricing-screen container">'
            '<p className="plan-card">x</p></div>;\n',
        )
        write_file(project, "src/styles/pricing.css", ".pricing-screen { padding: 1rem; }\n")
        orphan = next(f for f in verify_project_build(project) if f.code == "css.orphan_classes")
        assert orphan.path == "src/pages/Pricing.tsx"
        assert orphan.related == ["src/styles/pricing.css"]
        assert "src/styles/pricing.css" in orphan.message and "plan-card" in orphan.message
        focus = repair_focus_paths([orphan])
        assert focus[:2] == ["src/pages/Pricing.tsx", "src/styles/pricing.css"]

    def test_no_prompt_asks_to_append_to_the_foundation(self):
        import inspect

        from app.services.orchestration import dispatcher, verify_build

        for module in (dispatcher, verify_build):
            source = inspect.getsource(module)
            assert "APPEND CSS only" not in source
            assert "CSS APPEND RULE" not in source


class TestContext:
    def test_directory_focus_expands_to_its_files(self):
        from app.services.orchestration.context import merge_context_paths

        files = {"src/components/A.tsx": "a", "src/components/B.tsx": "bb", "src/App.tsx": "x"}
        got = merge_context_paths([], ["src/components"], [], files)
        assert got == ["src/components/A.tsx", "src/components/B.tsx"]

    def test_charter_and_rules_are_not_sent_twice(self):
        from app.services.orchestration.context import _selected_file_blocks

        text = _selected_file_blocks(
            {"DESIGN.md": "# brand", "AI_RULES.md": "# rules", "src/App.tsx": "x"},
            ["DESIGN.md", "AI_RULES.md", "src/App.tsx"],
        )
        assert "--- DESIGN.md ---" not in text and "--- AI_RULES.md ---" not in text
        assert "--- src/App.tsx ---" in text

    def test_a_file_that_does_not_fit_is_skipped_not_the_rest(self, monkeypatch):
        from app.services.orchestration import context

        monkeypatch.setattr(context, "_budgets", lambda: (1000, 400))
        files = {"src/Big.tsx": "x" * 5000, "src/Small.tsx": "small"}
        text = context._selected_file_blocks(files, ["src/Big.tsx", "src/Small.tsx"])
        assert "--- src/Small.tsx ---" in text
        assert "Not shown in full" in text and "src/Big.tsx" in text

    def test_stylesheet_skeletons_list_their_classes(self):
        from app.services.orchestration.context import build_file_skeletons

        skel = build_file_skeletons({"src/index.css": ".btn-primary { } .card, .card-title { }"})
        assert ".btn-primary .card .card-title" in skel

    def test_the_scaffold_placeholder_charter_is_not_locked(self, project):
        from app.services.orchestration.context import load_design_md
        from app.services.scaffold import DESIGN_MD

        write_file(project, "DESIGN.md", DESIGN_MD)
        assert load_design_md(project) is None
        write_file(project, "DESIGN.md", "# Bakery\n\n## Colors\n- `--bg`: #fff8f0\n")
        assert load_design_md(project).startswith("# Bakery")


class TestRouting:
    def test_build_with_an_image_request_is_still_a_build(self):
        from app.services.orchestration.router import classify_and_route

        route = classify_and_route(
            "Crée mon site de boulangerie et génère une image de croissants", force_scaffold=True
        )
        assert route.task_class.startswith("code.scaffold")

    def test_a_pure_image_request_stays_an_image(self):
        from app.services.orchestration.router import classify_and_route

        assert classify_and_route("génère une image de croissants", force_scaffold=True).is_image

    def test_requested_images_are_extracted_from_the_build(self):
        from app.services.orchestration.router import requested_image_prompts

        prompts = requested_image_prompts(
            "Crée mon site de boulangerie et génère une image de croissants dorés"
        )
        assert prompts and "croissants" in prompts[0]

    def test_image_sentences_split_on_punctuation_and_conjunction(self):
        from app.services.orchestration.router import requested_image_prompts

        prompts = requested_image_prompts(
            "Build a bakery website. Use warm colours and generate an image of a baguette"
        )
        assert prompts == ["generate an image of a baguette"]
        assert requested_image_prompts("a" + " " * 50_000 + "b") == []

    def test_history_turns_drop_file_blocks(self):
        from app.services.orchestration.context import _sanitize_turn

        reply = 'Done.\n<forge-write path="a.tsx">x</forge-write>\n<forge-edit path="b.tsx">y</forge-edit>'
        assert _sanitize_turn("assistant", reply, limit=500) == (
            "Done.\n[file write omitted]\n[file edit omitted]"
        )
        unclosed = "<forge-edit" * 20_000
        assert _sanitize_turn("assistant", unclosed, limit=50) == unclosed[:50]

    def test_repairs_use_the_model_that_wrote_the_code(self):
        import inspect

        from app.services.orchestration import dispatcher

        assert "model=model," in inspect.getsource(dispatcher.run_plan_tasks)


class TestScaffoldAndRules:
    def test_mobile_scaffold_selectors_are_separate_rules(self):
        from app.services.scaffold import INDEX_CSS_MOBILE

        assert ".card p.onboard-body p" not in INDEX_CSS_MOBILE
        assert ".btn-primary.btn-ghost" not in INDEX_CSS_MOBILE
        assert ".btn-primary,\n.btn-ghost {" in INDEX_CSS_MOBILE

    def test_legacy_default_rules_are_upgraded_custom_ones_kept(self, project):
        import subprocess

        from app.services.ai_rules import AI_RULES_PATH, DEFAULT_AI_RULES, ensure_ai_rules_md

        old = subprocess.run(
            ["git", "show", "794c0a6:apps/api/app/services/ai_rules.py"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        ).stdout
        if 'DEFAULT_AI_RULES = """' not in old:
            pytest.skip("git history unavailable")
        legacy = old.split('DEFAULT_AI_RULES = """', 1)[1].split('"""', 1)[0]
        write_file(project, AI_RULES_PATH, legacy)
        ensure_ai_rules_md(project)
        assert read_file(project, AI_RULES_PATH) == DEFAULT_AI_RULES
        write_file(project, AI_RULES_PATH, "# AI_RULES\n- my own rule\n")
        ensure_ai_rules_md(project)
        assert read_file(project, AI_RULES_PATH) == "# AI_RULES\n- my own rule\n"

    def test_system_prompt_has_unique_rule_numbers(self):
        import re

        from app.prompts.system import SYSTEM_PROMPT

        numbers = [int(n) for n in re.findall(r"^(\d+)\. ", SYSTEM_PROMPT, re.M)]
        assert numbers == list(range(1, len(numbers) + 1))
        assert "forge-edit" in SYSTEM_PROMPT and "@forge/forms" not in SYSTEM_PROMPT
