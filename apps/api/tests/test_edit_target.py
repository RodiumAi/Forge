"""Targeted edits of React projects (Forge Design plan 4.2).

The preview tags host elements with ``data-forge-id="<file>:<line>:<col>"``; a
chat message carries ``target: {route, forgeId, filePath, restrict}``. These
tests pin the mapping to files, the instruction, the write allowlist (and its
widen flow), the forgeId-pinned visual edits, and that the slides target
payload is unchanged.
"""

from __future__ import annotations

import asyncio
import json
import uuid

import pytest

from app.schemas import BranchMessagesRequest, MessageTarget, SendMessageRequest
from app.services.edit_target import (
    ForgeLocation,
    element_span,
    parse_forge_id,
    resolve_target,
    target_instruction,
)
from app.services.filesystem import list_files, read_file, write_file
from app.services.orchestration.page_routes import page_file_for_route
from app.services.source_edit import AmbiguousMatch
from app.services.tags import DeleteOp, EditOp, WriteOp

HERO = (
    'import "./Hero.css";\n'
    "export function Hero() {\n"
    "  return (\n"
    '    <section className="hero">\n'
    "      <h1>Bienvenue</h1>\n"
    '      <img src="/images/hero.webp" alt="" />\n'
    "    </section>\n"
    "  );\n"
    "}\n"
)


@pytest.fixture(autouse=True)
def _no_git_snapshot(monkeypatch):
    from app.services import apply_writes

    monkeypatch.setattr(apply_writes.history, "snapshot", lambda *_a, **_k: None)


def _site(project: str) -> None:
    write_file(project, "src/components/Hero.tsx", HERO)
    write_file(project, "src/components/Hero.css", ".hero { padding: 2rem; }\n")
    write_file(
        project,
        "src/App.tsx",
        'import { Routes, Route } from "react-router-dom";\n'
        'import { Home } from "./pages/Home";\n'
        'import { About } from "./pages/About";\n'
        "export default function App() {\n"
        '  return <Routes><Route path="/" element={<Home />} /><Route path="/a-propos" element={<About />} /></Routes>;\n'
        "}\n",
    )
    write_file(
        project,
        "src/pages/Home.tsx",
        'import "../styles/home.css";\nimport { Hero } from "../components/Hero";\n'
        "export function Home() { return <main><Hero /></main>; }\n",
    )
    write_file(project, "src/pages/About.tsx", "export function About() { return <main>About</main>; }\n")
    write_file(project, "src/styles/home.css", ".home { color: red; }\n")
    write_file(project, "src/index.css", ":root { --bg: #fff; }\n")


class TestForgeId:
    def test_parses_file_line_col(self):
        assert parse_forge_id("src/components/Hero.tsx:5:7") == ForgeLocation("src/components/Hero.tsx", 5, 7)

    @pytest.mark.parametrize(
        "raw",
        ["", "src/App.tsx", "src/App.tsx:0:1", "../etc/passwd.ts:1:1", "/abs/App.tsx:1:1", "src/a.css:1:1", None],
    )
    def test_rejects_malformed_or_escaping_ids(self, raw):
        assert parse_forge_id(raw) is None

    def test_element_span_covers_the_whole_element(self):
        span = element_span(HERO, ForgeLocation("x.tsx", 4, 5))
        assert span is not None
        text = HERO[span[0] : span[1]]
        assert text.startswith('<section className="hero">') and text.endswith("</section>")

    def test_self_closing_element(self):
        span = element_span(HERO, ForgeLocation("x.tsx", 6, 7))
        assert span is not None
        assert HERO[span[0] : span[1]] == '<img src="/images/hero.webp" alt="" />'

    def test_stale_location_gives_no_span(self):
        assert element_span(HERO, ForgeLocation("x.tsx", 5, 2)) is None
        assert element_span(HERO, ForgeLocation("x.tsx", 99, 1)) is None


class TestRouteMapping:
    def test_route_pairs_then_pages_then_app(self, project):
        _site(project)
        files = list_files(project)
        assert page_file_for_route("/", files) == "src/pages/Home.tsx"
        assert page_file_for_route("/a-propos", files) == "src/pages/About.tsx"
        assert page_file_for_route("/missing", files) is None

    def test_state_based_page_file(self):
        files = {"src/pages/PricingPage.tsx": "", "src/App.tsx": ""}
        assert page_file_for_route("/pricing", files) == "src/pages/PricingPage.tsx"
        assert page_file_for_route("/", files) == "src/App.tsx"


class TestResolveTarget:
    def test_forge_id_maps_to_its_file_with_scope_and_snippet(self, project):
        _site(project)
        target = MessageTarget(route="/", forgeId="src/components/Hero.tsx:5:7", restrict=True)
        resolved = resolve_target(target, list_files(project))
        assert resolved is not None
        assert resolved.element == ForgeLocation("src/components/Hero.tsx", 5, 7)
        assert resolved.page_file == "src/pages/Home.tsx"
        assert resolved.scoped
        # The element's file, its stylesheet and the page stylesheet; never the foundation.
        assert resolved.allowed_paths == [
            "src/components/Hero.tsx",
            "src/components/Hero.css",
            "src/styles/home.css",
        ]
        assert resolved.focus_paths[0] == "src/components/Hero.tsx"
        assert "<h1>Bienvenue</h1>" in (resolved.snippet or "")

        hint = target_instruction(resolved) or ""
        assert "src/components/Hero.tsx` line 5, column 7" in hint
        assert "LIMITED" in hint and "`src/components/Hero.css`" in hint
        assert "data-forge-id" in hint

    def test_without_restrict_there_is_no_allowlist(self, project):
        _site(project)
        resolved = resolve_target(MessageTarget(forgeId="src/components/Hero.tsx:5:7"), list_files(project))
        assert resolved is not None and not resolved.scoped and resolved.allowed_paths == []
        assert "LIMITED" not in (target_instruction(resolved) or "")

    def test_route_only_never_restricts(self, project):
        _site(project)
        resolved = resolve_target(MessageTarget(route="/a-propos", restrict=True), list_files(project))
        assert resolved is not None and not resolved.scoped
        assert resolved.focus_paths == ["src/pages/About.tsx"]

    def test_unknown_file_and_slide_targets_are_ignored(self, project):
        _site(project)
        files = list_files(project)
        stale = resolve_target(MessageTarget(forgeId="src/Gone.tsx:1:1", restrict=True), files)
        assert stale is not None and stale.element is None and not stale.scoped
        assert resolve_target(MessageTarget(slideId="s2", elementId="body"), files) is None
        assert resolve_target(None, files) is None

    def test_explicit_file_path(self, project):
        _site(project)
        resolved = resolve_target(MessageTarget(filePath="src/pages/About.tsx", restrict=True), list_files(project))
        assert resolved is not None and resolved.allowed_paths == ["src/pages/About.tsx"]


class TestTargetPayload:
    def test_slides_payload_is_unchanged(self):
        body = SendMessageRequest.model_validate(
            {
                "content": "Raccourcir",
                "mode": "agent",
                "target": {"slideId": "s2", "elementId": "body"},
                "action": "shorten",
            }
        )
        assert body.target is not None
        assert (body.target.slideId, body.target.elementId) == ("s2", "body")
        assert body.target.route is None and body.target.forgeId is None and body.target.restrict is False

    def test_site_fields_and_unknown_keys(self):
        body = BranchMessagesRequest.model_validate(
            {
                "from_message_id": str(uuid.uuid4()),
                "content": "x",
                "target": {
                    "route": "/",
                    "forgeId": "src/App.tsx:3:5",
                    "filePath": "src/App.tsx",
                    "restrict": True,
                    "somethingNew": 1,
                },
            }
        )
        assert body.target is not None
        assert body.target.forgeId == "src/App.tsx:3:5" and body.target.restrict is True
        assert not hasattr(body.target, "somethingNew")


class TestWriteScope:
    def test_writes_outside_the_scope_are_refused(self, project):
        from app.services.apply_writes import apply_validated_writes

        _site(project)
        applied, violations = apply_validated_writes(
            project,
            [
                EditOp(path="src/components/Hero.tsx", hunks=[("Bienvenue", "Bonjour")]),
                WriteOp(path="src/index.css", content=":root { --bg: #000; }\n"),
            ],
            allowed_paths=["src/components/Hero.tsx"],
        )
        assert applied == [{"op": "write", "path": "src/components/Hero.tsx"}]
        assert len(violations) == 1
        v = violations[0]
        assert v["code"] == "TARGET_SCOPE" and v["path"] == "src/index.css"
        assert v["widen"] is True and v["scope"] == ["src/components/Hero.tsx"]
        assert read_file(project, "src/index.css") == ":root { --bg: #fff; }\n"
        assert "Bonjour" in read_file(project, "src/components/Hero.tsx")

    def test_no_scope_means_the_whole_project(self, project):
        from app.services.apply_writes import apply_validated_writes

        _site(project)
        applied, violations = apply_validated_writes(
            project, [WriteOp(path="src/index.css", content=":root { --bg: #000; }\n")]
        )
        assert violations == [] and applied == [{"op": "write", "path": "src/index.css"}]

    def test_deletes_outside_the_scope_are_refused(self):
        from app.services.apply_writes import split_deletes_in_scope

        ops = [DeleteOp(path="src/a.tsx"), DeleteOp(path="src/b.tsx")]
        keep, refused = split_deletes_in_scope(ops, ["src/a.tsx"])
        assert [op.path for op in keep] == ["src/a.tsx"]
        assert refused[0]["code"] == "TARGET_SCOPE" and refused[0]["path"] == "src/b.tsx"
        assert split_deletes_in_scope(ops, None) == (ops, [])

    def test_preview_ids_never_reach_the_sources(self, project):
        from app.services.apply_writes import apply_validated_writes

        content = 'export const A = () => <p data-forge-id="src/A.tsx:1:24" className="x">Hi</p>;\n'
        apply_validated_writes(project, [WriteOp(path="src/A.tsx", content=content)])
        assert read_file(project, "src/A.tsx") == 'export const A = () => <p className="x">Hi</p>;\n'


class TestVisualEditByForgeId:
    SRC = "export const P = () => (\n  <div>\n    <h2>Prix</h2>\n    <span>Prix</span>\n  </div>\n);\n"

    def test_text_edit_targets_the_exact_element(self, project):
        from app.services.visual_edit import apply_visual_text_edit

        write_file(project, "src/P.tsx", self.SRC)
        result = apply_visual_text_edit(project, "Prix", "Tarif", forge_id="src/P.tsx:4:5")
        assert result.path == "src/P.tsx"
        assert read_file(project, "src/P.tsx") == self.SRC.replace("<span>Prix</span>", "<span>Tarif</span>")

    def test_stale_or_missing_id_keeps_the_literal_rules(self, project):
        from app.services.visual_edit import apply_visual_text_edit

        write_file(project, "src/P.tsx", self.SRC)
        with pytest.raises(AmbiguousMatch):
            apply_visual_text_edit(project, "Prix", "Tarif", forge_id="src/P.tsx:9:9")
        with pytest.raises(AmbiguousMatch):
            apply_visual_text_edit(project, "Prix", "Tarif")
        assert read_file(project, "src/P.tsx") == self.SRC

    def test_text_from_props_falls_back_to_the_literal_search(self, project):
        from app.services.visual_edit import apply_visual_text_edit

        write_file(project, "src/Card.tsx", "export const Card = ({ t }) => <h3>{t}</h3>;\n")
        write_file(project, "src/data.ts", 'export const items = [{ t: "Offre unique" }];\n')
        result = apply_visual_text_edit(project, "Offre unique", "Offre spéciale", forge_id="src/Card.tsx:1:32")
        assert result.path == "src/data.ts"

    def test_multiline_text_inside_the_element(self, project):
        from app.services.visual_edit import apply_visual_text_edit

        src = "const A = () => <p>\n    Une phrase\n    longue\n  </p>;\nconst B = () => <p>Une phrase longue</p>;\n"
        write_file(project, "src/A.tsx", src)
        apply_visual_text_edit(project, "Une phrase longue", "Courte", forge_id="src/A.tsx:1:17")
        assert read_file(project, "src/A.tsx") == "const A = () => <p>\n    Courte\n  </p>;\n" + src.split("\n", 4)[4]

    def test_image_replace_targets_the_exact_img(self, project):
        from app.services.visual_image import apply_visual_image_replace

        src = '<div>\n  <img src="/images/a.webp" />\n  <img src="/images/a.webp" />\n</div>\n'
        write_file(project, "src/G.tsx", src)
        with pytest.raises(AmbiguousMatch):
            apply_visual_image_replace(project, "/images/a.webp", "/images/b.webp")
        result = apply_visual_image_replace(project, "/images/a.webp", "/images/b.webp", forge_id="src/G.tsx:3:3")
        assert result.path == "src/G.tsx"
        assert read_file(project, "src/G.tsx") == src.replace(
            '  <img src="/images/a.webp" />\n</div>', '  <img src="/images/b.webp" />\n</div>'
        )


class _FakeDb:
    def commit(self):
        pass

    def get(self, *_a, **_k):
        return None


def _run_single_pass(monkeypatch, project, target, answer: str):
    from app.routers import chats
    from app.services.llm import StreamChunk

    seen: dict = {}

    async def fake_messages(**kwargs):
        seen.setdefault("calls", []).append(kwargs)
        return [{"role": "user", "content": "x"}]

    async def fake_stream(**_kwargs):
        yield StreamChunk("token", answer)

    monkeypatch.setattr(chats, "build_llm_messages", fake_messages)
    monkeypatch.setattr(chats, "stream_with_continuation", fake_stream)
    monkeypatch.setattr(chats, "_history", lambda _db, _cid: [("user", "x")])
    monkeypatch.setattr(chats, "is_cancelled", lambda _rid: False)

    async def collect():
        frames = []
        async for chunk in chats._iter_single_pass(
            db=_FakeDb(),
            run_pk=uuid.uuid4(),
            project_id_str=project,
            chat_id_pk=uuid.uuid4(),
            user_content="[Sélection: h1 | text:\"Bienvenue\"]\n\nmets Bonjour",
            model="m",
            auth=None,
            locale="fr",
            route_effort="",
            surgical_edit=True,
            target=target,
        ):
            frames.append(json.loads(chunk.split("data: ", 1)[1]))
        return frames

    return asyncio.run(collect()), seen


ANSWER = (
    '<forge-edit path="src/components/Hero.tsx">\n<<<<<<< SEARCH\n<h1>Bienvenue</h1>\n=======\n'
    "<h1>Bonjour</h1>\n>>>>>>> REPLACE\n</forge-edit>\n"
    '<forge-write path="src/index.css">\n:root { --bg: #000; }\n</forge-write>\n'
    '<forge-delete path="src/pages/About.tsx" />\n'
)


class TestSinglePassScope:
    def test_restricted_selection_refuses_other_files(self, monkeypatch, project):
        _site(project)
        target = resolve_target(
            MessageTarget(route="/", forgeId="src/components/Hero.tsx:5:7", restrict=True), list_files(project)
        )
        frames, seen = _run_single_pass(monkeypatch, project, target, ANSWER)

        first = seen["calls"][0]
        assert first["focus_paths"][0] == "src/components/Hero.tsx"
        assert "line 5, column 7" in first["target_hint"]

        target_frame = next(f for f in frames if f["type"] == "target")
        assert target_frame["forge_id"] == "src/components/Hero.tsx:5:7"
        assert target_frame["restrict"] is True and "src/components/Hero.tsx" in target_frame["scope"]

        assert [f["path"] for f in frames if f["type"] == "file_write"] == ["src/components/Hero.tsx"]
        assert not [f for f in frames if f["type"] == "file_delete"]
        refused = sorted(f["violation"]["path"] for f in frames if f["type"] == "warning")
        assert refused == ["src/index.css", "src/pages/About.tsx"]
        assert all(f["violation"]["code"] == "TARGET_SCOPE" for f in frames if f["type"] == "warning")
        assert read_file(project, "src/index.css") == ":root { --bg: #fff; }\n"
        assert "src/pages/About.tsx" in list_files(project)
        assert frames[-1]["type"] == "done"

    def test_widened_resend_applies_everything(self, monkeypatch, project):
        _site(project)
        target = resolve_target(
            MessageTarget(route="/", forgeId="src/components/Hero.tsx:5:7", restrict=False), list_files(project)
        )
        frames, _ = _run_single_pass(monkeypatch, project, target, ANSWER)
        assert not [f for f in frames if f["type"] == "warning"]
        assert sorted(f["path"] for f in frames if f["type"] == "file_write") == [
            "src/components/Hero.tsx",
            "src/index.css",
        ]
        assert [f["path"] for f in frames if f["type"] == "file_delete"] == ["src/pages/About.tsx"]

    def test_only_a_scoped_agent_message_skips_clarify_and_plan(self, project):
        from app.routers.chats import _forces_single_pass

        _site(project)
        files = list_files(project)
        scoped = resolve_target(MessageTarget(forgeId="src/components/Hero.tsx:5:7", restrict=True), files)
        loose = resolve_target(MessageTarget(forgeId="src/components/Hero.tsx:5:7"), files)
        assert _forces_single_pass(scoped, "agent")
        assert not _forces_single_pass(scoped, "plan")
        assert not _forces_single_pass(loose, "agent")
        assert not _forces_single_pass(None, "agent")
