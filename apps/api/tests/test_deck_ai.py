"""Slides AI: routing by kind, outline and confirm, slide repair, targets, visuals, notes.

The LLM is mocked at ``deck_ai.llm.complete_chat``: each test scripts the
answers the model gives, in order.
"""

from __future__ import annotations

import io
import json
import uuid
from types import SimpleNamespace

import pytest

from app.config import clear_settings_cache
from app.contracts.forge_design import validate_deck, validate_slide
from app.services.deck_ai import chat_entry, flow, store
from app.services.deck_ai import llm as deck_llm
from app.services.deck_ai.layouts import VISUAL_PLACEHOLDER, fallback_slide
from app.services.deck_ai.outline import check_outline, outline_from_plan, plan_tasks
from app.services.deck_ai.theme import DeckTheme, clean_colors
from app.services.document_scaffold import scaffold_slides
from app.services.filesystem import read_file


@pytest.fixture
def deck(project, monkeypatch):
    """A scaffolded slides project; history checkpoints are recorded, not committed."""
    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
    clear_settings_cache()
    monkeypatch.setattr(store.history, "snapshot", lambda *_a, **_k: None)
    scaffold_slides(project, "Rapport")
    return project


@pytest.fixture
def run_log(monkeypatch):
    """Record what the flows write on the AgentRun instead of a database."""
    log: dict = {"updates": [], "finished": None, "failed": None}
    monkeypatch.setattr(flow, "_update_run", lambda _pk, **fields: log["updates"].append(fields))
    monkeypatch.setattr(flow, "_finish_run", lambda _pk, payload, _l: log.__setitem__("finished", payload))
    monkeypatch.setattr(flow, "_fail_run", lambda _pk, code, msg: log.__setitem__("failed", (code, msg)))
    return log


def script(monkeypatch, *answers):
    """The model answers ``answers`` in order (dicts are sent as JSON)."""
    queue = [a if isinstance(a, str) else json.dumps(a) for a in answers]
    calls: list[list[dict]] = []

    async def fake(*, messages, **_kwargs):
        calls.append(messages)
        if not queue:
            raise AssertionError("the model was called more often than scripted")
        return queue.pop(0)

    monkeypatch.setattr(deck_llm, "complete_chat", fake)
    return calls


async def _auth():
    return SimpleNamespace()


def ctx(project_id: str, **kw) -> flow.DeckContext:
    base = dict(
        project_id=project_id,
        run_pk=uuid.uuid4(),
        user_id=uuid.uuid4(),
        user_msg_id="m1",
        prompt="Présentation sur le rapport annuel",
        locale="fr",
        gen_model="writer",
        edit_model="editor",
        route_effort="Approfondi",
        tier="escalation",
        resolve_auth=_auth,
    )
    base.update(kw)
    return flow.DeckContext(**base)


async def events_of(stream) -> list[dict]:
    out = []
    async for chunk in stream:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


async def collect(source) -> list[dict]:
    return [event async for event in source]


def text_slide(sid: str, title: str, *, extra: list | None = None) -> dict:
    return {
        "id": sid,
        "background": {"type": "color", "token": "--bg"},
        "elements": [
            {
                "id": "title",
                "type": "text",
                "role": "title",
                "x": 120,
                "y": 100,
                "w": 1680,
                "h": 160,
                "content": [{"type": "paragraph", "text": title}],
                "style": {"font": "display", "size": 72, "weight": 700, "color": "--fg"},
            },
            *(extra or []),
        ],
    }


OUTLINE = {
    "title": "Rapport annuel 2026",
    "summary": "Pour le conseil",
    "format": "16:9",
    "slides": [
        {"title": "Rapport annuel 2026", "idea": "Ouverture", "layout": "title", "visual": False},
        {"title": "Chiffres clés", "idea": "+32 % de CA", "layout": "key_numbers", "visual": False},
        {"title": "Merci", "idea": "Contact", "layout": "nope", "visual": True},
    ],
}


# ── routing by kind ────────────────────────────────────────────────────────


class TestRouting:
    def test_react_kinds_never_reach_the_deck_flows(self):
        assert not chat_entry.is_document_project(SimpleNamespace(platform="web"))
        assert not chat_entry.is_document_project(SimpleNamespace(platform="mobile"))
        assert not chat_entry.is_document_project(SimpleNamespace(platform=None))
        for kind in ("slides", "codelab", "design_system"):
            assert chat_entry.is_document_project(SimpleNamespace(platform=kind))

    def test_send_message_dispatches_documents_before_the_site_pipeline(self):
        import inspect

        from app.routers import chats

        source = inspect.getsource(chats.send_message)
        dispatch = source.index("deck_chat.is_document_project(project)")
        assert dispatch < source.index("classify_and_route(")
        assert "deck_chat.is_document_project(project)" in inspect.getsource(chats.branch_messages)
        assert "deck_chat.is_deck_outline_run(run)" in inspect.getsource(chats.confirm_plan)

    @pytest.mark.parametrize("kind", ["codelab", "design_system"])
    async def test_codelab_and_design_system_are_not_available_yet(self, kind):
        response = chat_entry.start_document_message(
            db=None,
            user=None,
            project=SimpleNamespace(id=uuid.uuid4(), platform=kind),
            chat=None,
            body=SimpleNamespace(),
            content="hello",
            mode="agent",
            locale="en",
            route_for_request=None,
            effort_label=None,
            resolve_gen_auth=None,
            event_stream=lambda source: source,
        )
        events = await events_of(response)
        assert events == [
            {
                "type": "error",
                "code": "kind_not_available",
                "kind": kind,
                "message": "AI generation is not available for this project type yet.",
            }
        ]

    async def test_slides_flag_off_is_not_available(self, project, monkeypatch):
        monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "false")
        clear_settings_cache()
        response = chat_entry.start_document_message(
            db=None,
            user=None,
            project=SimpleNamespace(id=uuid.uuid4(), platform="slides"),
            chat=None,
            body=SimpleNamespace(),
            content="hello",
            mode="agent",
            locale="fr",
            route_for_request=None,
            effort_label=None,
            resolve_gen_auth=None,
            event_stream=lambda source: source,
        )
        assert (await events_of(response))[0]["code"] == "kind_not_available"

    def test_models_honour_tier_entitlements(self, monkeypatch):
        from app.routers.chats import _apply_tier_entitlements
        from app.services.deck_ai.routing import deck_routes

        writing, editing = deck_routes()
        assert writing.tier == "escalation" and editing.tier == "primary"
        cached = SimpleNamespace(
            allowed_model_tiers=json.dumps(["lite", "primary"]), priority_generation=True
        )
        downgraded = _apply_tier_entitlements(writing, cached)
        assert downgraded.tier == "primary" and downgraded.model != writing.model


# ── outline and confirmation ───────────────────────────────────────────────


class TestOutline:
    def test_outline_gets_ids_and_known_layouts(self):
        outline = check_outline(json.loads(json.dumps(OUTLINE)))
        assert [s.id for s in outline.slides] == ["s1", "s2", "s3"]
        assert [s.layout for s in outline.slides] == ["title", "key-numbers", "text"]

    async def test_fresh_deck_proposes_an_outline_and_waits(self, deck, monkeypatch, run_log):
        script(monkeypatch, "Voici le plan :\n```json\n" + json.dumps(OUTLINE) + "\n```")
        assert store.is_blank_deck(deck)
        events = await events_of(flow.document_stream(ctx(deck, fresh=True)))
        types = [e["type"] for e in events]
        assert types[:2] == ["user_message", "route"]
        outline = next(e for e in events if e["type"] == "deck.outline")["outline"]
        assert len(outline["slides"]) == 3
        plan = next(e for e in events if e["type"] == "plan")
        assert plan["needs_confirm"] is True
        assert [t["id"] for t in plan["tasks"]] == ["s1", "s2", "s3"]
        assert plan["meta"] == {"title": "Rapport annuel 2026", "summary": "Pour le conseil"}
        update = run_log["updates"][0]
        assert update["status"] == "awaiting_plan_confirm" and update["task_class"] == "deck.outline"
        assert json.loads(update["plan_meta_json"])["deck"]["title"] == "Rapport annuel 2026"
        # Nothing written before confirmation.
        assert len(store.read_deck(deck)["slides"]) == 1

    async def test_outline_prompt_gets_the_imported_powerpoint_in_its_own_section(
        self, deck, monkeypatch, run_log
    ):
        calls = script(monkeypatch, json.dumps(OUTLINE))
        prompt = (
            "Recrée cette présentation\n\n[Document: ancien.pptx | pptx]\n"
            "--- Slide 1 ---\nTitle: Rapport annuel\n- Chiffre clé\n[/Document]"
        )
        await events_of(flow.document_stream(ctx(deck, fresh=True, prompt=prompt)))
        user = calls[0][-1]["content"]
        assert "Request:\nRecrée cette présentation\n\n" in user
        assert "[Document:" not in user
        assert 'PowerPoint "ancien.pptx"' in user
        assert "<document>\n--- Slide 1 ---\nTitle: Rapport annuel" in user

    def test_confirmed_plan_keeps_order_titles_and_ids(self):
        stored = check_outline(json.loads(json.dumps(OUTLINE))).model_dump()
        tasks = plan_tasks(check_outline(json.loads(json.dumps(OUTLINE))))
        edited = [dict(tasks[2], title="Questions ?"), tasks[0], {"id": "x", "title": "Nouvelle slide"}]
        outline = outline_from_plan(stored, edited)
        assert [(s.id, s.title) for s in outline.slides] == [
            ("s3", "Questions ?"),
            ("s1", "Rapport annuel 2026"),
            ("x", "Nouvelle slide"),
        ]
        with pytest.raises(ValueError):
            outline_from_plan(stored, [{"id": "zz", "title": ""}])

    async def test_confirm_spawns_the_writer_with_the_confirmed_outline(self, monkeypatch):
        spawned = {}
        monkeypatch.setattr(chat_entry, "spawn_deck_write_job", lambda **kw: spawned.update(kw))

        async def no_events(_rid, **_kw):
            if False:
                yield ""

        monkeypatch.setattr(chat_entry, "iter_run_event_sse", no_events)
        monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
        clear_settings_cache()
        stored = check_outline(json.loads(json.dumps(OUTLINE)))
        run = SimpleNamespace(
            id=uuid.uuid4(),
            status="awaiting_plan_confirm",
            plan_meta_json=json.dumps({"title": "T", "deck": stored.model_dump()}),
            plan_json=None,
            prompt="deck",
            model_slug="writer",
            task_class="deck.outline",
        )
        db = SimpleNamespace(commit=lambda: None, close=lambda: None)
        response = chat_entry.confirm_deck_outline(
            db=db,
            run=run,
            project=SimpleNamespace(id=uuid.uuid4(), platform="slides"),
            plan=[{"id": "s2", "title": "Chiffres"}],
            locale="fr",
            resolve_gen_auth=_auth,
            event_stream=lambda source: source,
        )
        await events_of(response)
        assert run.status == "running"
        assert [s.title for s in spawned["outline"].slides] == ["Chiffres"]
        assert spawned["model"] == "writer"
        clear_settings_cache()


# ── writing, repair, fallback, visuals ─────────────────────────────────────


def png_bytes() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (64, 36), (200, 80, 10)).save(buf, format="PNG")
    return buf.getvalue()


class TestWriting:
    async def test_slides_are_written_repaired_or_replaced(self, deck, monkeypatch, run_log):
        outline = check_outline(json.loads(json.dumps(OUTLINE)))
        script(
            monkeypatch,
            # s1: valid at once, with a raw hex color the theme maps to a token.
            {"slide": text_slide("whatever", "Rapport annuel 2026"), "notes": "Bonjour à tous."},
            # s2: invalid (negative width), then repaired.
            {
                "slide": {
                    "id": "s2",
                    "elements": [{"id": "t", "type": "text", "x": 0, "y": 0, "w": -1, "h": 1}],
                }
            },
            {"slide": text_slide("s2", "Chiffres clés"), "notes": "Le CA progresse."},
            # s3: never valid, so the plain layout replaces it.
            "pas du json",
            "toujours pas",
            "encore non",
        )
        events = await collect(
            flow.deck_write_events(
                project_id=deck,
                run_pk=uuid.uuid4(),
                prompt="Rapport annuel",
                outline=outline,
                model="writer",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        written = validate_deck(json.loads(read_file(deck, "deck.json")))
        assert [ref.id for ref in written.slides] == ["s1", "s2", "s3"]
        slides = [e for e in events if e["type"] == "deck.slide"]
        assert [(e["slide_id"], e["repaired"], e["fallback"]) for e in slides] == [
            ("s1", False, False),
            ("s2", True, False),
            ("s3", False, True),
        ]
        for sid in ("s1", "s2", "s3"):
            validate_slide(json.loads(read_file(deck, f"slides/{sid}.json")))
        assert read_file(deck, "notes/s1.md") == "Bonjour à tous."
        assert read_file(deck, "notes/s3.md") == "Contact"
        assert any(e["type"] == "warning" and "SLIDE_FALLBACK" in e["message"] for e in events)
        assert [e["id"] for e in events if e["type"] == "step" and e["status"] == "done"][:1] == ["task:s1"]
        assert events[-1]["type"] == "done" and run_log["finished"]["plan"][2]["status"] == "done"
        assert any(e["type"] == "deck.done" for e in events)

    async def test_a_visual_is_imported_from_pixabay(self, deck, monkeypatch, run_log):
        from app.services import image_bank

        outline = check_outline(
            {
                "title": "T",
                "slides": [{"title": "Équipe", "idea": "Une équipe soudée", "layout": "image-text"}],
            }
        )
        image = {
            "id": "photo",
            "type": "image",
            "x": 1040,
            "y": 0,
            "w": 880,
            "h": 1080,
            "src": VISUAL_PLACEHOLDER,
        }
        script(
            monkeypatch,
            {
                "slide": text_slide("s1", "Équipe", extra=[image]),
                "notes": "n",
                "visual": {"query": "team meeting office", "elementId": "photo"},
            },
        )
        searched = {}
        monkeypatch.setattr(image_bank, "is_configured", lambda: True)

        def search(query, **kw):
            searched.update(query=query, **kw)
            return {
                "hits": [
                    {"id": "77", "width": 1200, "height": 800},
                    {"id": "78", "width": 600, "height": 900},
                ]
            }

        monkeypatch.setattr(image_bank, "search", search)
        meta = image_bank.StockImage(
            id="78",
            previewUrl="",
            width=600,
            height=900,
            author="Jane",
            pageUrl="https://pixabay.com/x",
            tags="team",
        )
        monkeypatch.setattr(image_bank, "fetch_for_import", lambda image_id: (png_bytes(), meta))
        events = await collect(
            flow.deck_write_events(
                project_id=deck,
                run_pk=uuid.uuid4(),
                prompt="Notre équipe",
                outline=outline,
                model="writer",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        assert searched["query"] == "team meeting office" and searched["orientation"] == "vertical"
        slide = json.loads(read_file(deck, "slides/s1.json"))
        photo = next(e for e in slide["elements"] if e["id"] == "photo")
        assert photo["src"] == "public/images/pixabay-78.webp"
        assert photo["credit"] == {"source": "pixabay", "author": "Jane", "url": "https://pixabay.com/x"}
        assert any(e["type"] == "file_write" and e["path"] == "public/images/pixabay-78.webp" for e in events)

    async def test_without_an_image_bank_the_placeholder_is_dropped(self, deck, monkeypatch, run_log):
        from app.services import image_bank

        monkeypatch.setattr(image_bank, "is_configured", lambda: False)
        outline = check_outline({"title": "T", "slides": [{"title": "A", "layout": "image-text"}]})
        image = {"id": "photo", "type": "image", "x": 0, "y": 0, "w": 10, "h": 10, "src": VISUAL_PLACEHOLDER}
        script(monkeypatch, {"slide": text_slide("s1", "A", extra=[image]), "visual": {"query": "x"}})
        await collect(
            flow.deck_write_events(
                project_id=deck,
                run_pk=uuid.uuid4(),
                prompt="x",
                outline=outline,
                model="writer",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        slide = json.loads(read_file(deck, "slides/s1.json"))
        assert [e["id"] for e in slide["elements"]] == ["title"]

    def test_fallback_slides_are_valid_on_every_format(self):
        from app.services.deck_ai.layouts import LAYOUT_NAMES

        for ratio in ("16:9", "4:3", "1:1"):
            for layout in LAYOUT_NAMES:
                validate_slide(fallback_slide("s1", layout, ratio, title="Titre", idea="Idée"))

    def test_hex_and_unknown_tokens_map_to_theme_tokens(self):
        theme = DeckTheme(colors={"--accent": "#F2620A"})
        cleaned = clean_colors(
            {"style": {"color": "#f2620a"}, "fill": "#123456", "x": {"color": "--nope"}, "token": "--zzz"},
            theme,
        )
        assert cleaned == {
            "style": {"color": "--accent"},
            "fill": "--accent",
            "x": {"color": "--fg"},
            "token": "--bg",
        }


# ── targeted edits ─────────────────────────────────────────────────────────


@pytest.fixture
def two_slides(deck):
    d = store.read_deck(deck)
    d["slides"].append({"id": "s2", "layout": "text"})
    store.write_deck(deck, d)
    store.write_slide(
        deck,
        text_slide(
            "s2",
            "Avant",
            extra=[
                {
                    "id": "body",
                    "type": "text",
                    "role": "body",
                    "x": 120,
                    "y": 320,
                    "w": 1680,
                    "h": 600,
                    "content": [{"type": "paragraph", "text": "Corps"}],
                }
            ],
        ),
    )
    return deck


class TestTargets:
    async def test_a_slide_target_only_writes_that_slide(self, two_slides, monkeypatch, run_log):
        before_s1 = read_file(two_slides, "slides/s1.json")
        before_deck = read_file(two_slides, "deck.json")
        calls = script(
            monkeypatch,
            {
                "slide": text_slide("s9", "Après"),
                "notes": "Nouvelles notes",
                "deck": {"slides": []},
                "other": {"id": "s1"},
            },
        )
        events = await events_of(flow.document_stream(ctx(two_slides, target_slide="s2")))
        assert calls and "Avant" in calls[0][1]["content"]
        assert read_file(two_slides, "slides/s1.json") == before_s1
        assert read_file(two_slides, "deck.json") == before_deck
        s2 = json.loads(read_file(two_slides, "slides/s2.json"))
        assert s2["id"] == "s2" and s2["elements"][0]["content"][0]["text"] == "Après"
        assert read_file(two_slides, "notes/s2.md") == "Nouvelles notes"
        warning = next(e for e in events if e["type"] == "warning")
        assert warning["violation"]["code"] == "TARGET_SCOPE"
        slide_event = next(e for e in events if e["type"] == "deck.slide")
        assert slide_event["target"] == {"slideId": "s2"} and slide_event["index"] == 1
        assert events[-1]["type"] == "done"

    async def test_an_element_target_only_changes_that_element(self, two_slides, monkeypatch, run_log):
        # The model answers a whole slide that also rewrites the title: only "body" is kept.
        changed = text_slide("s2", "Titre piraté")
        changed["elements"].append(
            {
                "id": "body",
                "type": "text",
                "role": "body",
                "x": 120,
                "y": 320,
                "w": 1680,
                "h": 600,
                "content": [{"type": "paragraph", "text": "Corps raccourci"}],
            }
        )
        script(monkeypatch, {"slide": changed})
        events = await events_of(
            flow.document_stream(ctx(two_slides, target_slide="s2", target_element="body", action="shorten"))
        )
        s2 = json.loads(read_file(two_slides, "slides/s2.json"))
        texts = {e["id"]: e["content"][0]["text"] for e in s2["elements"]}
        assert texts == {"title": "Avant", "body": "Corps raccourci"}
        assert next(e for e in events if e["type"] == "deck.slide")["target"] == {
            "slideId": "s2",
            "elementId": "body",
        }

    async def test_an_element_target_is_found_without_its_slide(self, two_slides, monkeypatch, run_log):
        script(
            monkeypatch,
            {"element": {"id": "other", "type": "text", "x": 1, "y": 1, "w": 5, "h": 5, "content": []}},
        )
        await events_of(flow.document_stream(ctx(two_slides, target_element="body")))
        s2 = json.loads(read_file(two_slides, "slides/s2.json"))
        assert [e["id"] for e in s2["elements"]] == ["title", "body"]
        assert s2["elements"][1]["w"] == 5

    async def test_quick_action_needs_a_target(self, two_slides, monkeypatch, run_log):
        script(monkeypatch)
        events = await events_of(flow.document_stream(ctx(two_slides, action="shorten")))
        assert events[-1]["code"] == "target_required"
        assert run_log["failed"][0] == "target_required"

    async def test_unknown_target_is_refused(self, two_slides, monkeypatch, run_log):
        script(monkeypatch)
        events = await events_of(flow.document_stream(ctx(two_slides, target_slide="s7")))
        assert events[-1]["code"] == "target_not_found"

    async def test_change_layout_updates_only_that_slide_ref(self, two_slides, monkeypatch, run_log):
        calls = script(monkeypatch, {"slide": text_slide("s2", "Avant"), "layout": "two_columns"})
        await events_of(
            flow.document_stream(
                ctx(two_slides, target_slide="s2", action="change_layout", action_input="two-columns")
            )
        )
        assert "two-columns" in calls[0][1]["content"]
        refs = store.read_deck(two_slides)["slides"]
        assert [(r["id"], r["layout"]) for r in refs] == [("s1", "title"), ("s2", "two-columns")]

    async def test_invalid_answers_end_in_a_clear_error(self, two_slides, monkeypatch, run_log):
        before = read_file(two_slides, "slides/s2.json")
        script(monkeypatch, "nope", "nope", "nope")
        events = await events_of(flow.document_stream(ctx(two_slides, target_slide="s2")))
        assert events[-1] == {
            "type": "error",
            "code": "invalid_model_output",
            "message": "L'IA n'a pas produit une slide valide. Réessayez.",
        }
        assert read_file(two_slides, "slides/s2.json") == before
        assert run_log["failed"][0] == "invalid_model_output"

    async def test_deck_level_edit_reorders_adds_and_removes(self, two_slides, monkeypatch, run_log):
        script(
            monkeypatch,
            {
                "order": ["s2", "new1"],
                "slides": [{"slide": text_slide("new1", "Nouvelle"), "layout": "text", "notes": "n"}],
                "transition": {"type": "push", "direction": "left"},
            },
        )
        events = await events_of(flow.document_stream(ctx(two_slides)))
        refs = store.read_deck(two_slides)["slides"]
        assert [r["id"] for r in refs] == ["s2", "new1"]
        assert all(r["transition"] == {"type": "push", "direction": "left"} for r in refs)
        assert any(e["type"] == "deck.slide_removed" and e["slide_id"] == "s1" for e in events)
        with pytest.raises(FileNotFoundError):
            read_file(two_slides, "slides/s1.json")
        assert read_file(two_slides, "notes/new1.md") == "n"


# ── background job ─────────────────────────────────────────────────────────


async def test_background_job_publishes_replayable_events(deck, monkeypatch, run_log):
    from app.services.orchestration import plan_worker, run_queue

    monkeypatch.setattr(run_queue, "_redis", lambda: None)
    script(monkeypatch, {"slide": text_slide("s1", "Seule"), "notes": "x"})
    outline = check_outline({"title": "T", "slides": [{"title": "Seule"}]})
    run_pk = uuid.uuid4()
    flow.spawn_deck_write_job(
        project_id=deck,
        run_pk=run_pk,
        prompt="x",
        outline=outline,
        model="w",
        locale="en",
        resolve_auth=_auth,
    )
    events = await events_of(plan_worker.iter_run_event_sse(str(run_pk)))
    assert [e["type"] for e in events if e["type"].startswith("deck.")] == [
        "deck.deck",
        "deck.slide",
        "deck.done",
    ]
    assert events[-1]["type"] == "done"
    replay = await events_of(plan_worker.iter_run_event_sse(str(run_pk), start_after=0))
    assert replay == events


# ── speaker notes routes ───────────────────────────────────────────────────


def test_notes_routes(monkeypatch, tmp_path_factory):
    from datetime import UTC, datetime

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.auth import get_current_user
    from app.db import get_db
    from app.models import Project, ProjectCollaborator
    from app.routers import documents as documents_mod

    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path_factory.mktemp("projects")))
    monkeypatch.setenv("FORGE_KIND_SLIDES_ENABLED", "true")
    clear_settings_cache()
    user_id = uuid.uuid4()
    project = SimpleNamespace(id=uuid.uuid4(), user_id=uuid.uuid4(), platform="slides")
    scaffold_slides(str(project.id), "Deck")
    monkeypatch.setattr(documents_mod.history, "snapshot", lambda *_a, **_k: None)
    role = {"value": "editor"}

    def db_get(model, key):
        if model is Project:
            return project if str(key) == str(project.id) else None
        if model is ProjectCollaborator:
            return SimpleNamespace(role=role["value"], accepted_at=datetime.now(UTC))
        return None

    app = FastAPI()
    app.include_router(documents_mod.router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    app.dependency_overrides[get_db] = lambda: SimpleNamespace(get=db_get)
    client = TestClient(app)
    pid = project.id

    r = client.get(f"/projects/{pid}/notes/s1")
    assert r.status_code == 200 and r.json() == {"id": "s1", "file": "notes/s1.md", "markdown": ""}
    etag = r.headers["etag"]
    r = client.put(f"/projects/{pid}/notes/s1", json={"markdown": "Dire bonjour"}, headers={"If-Match": etag})
    assert r.status_code == 200 and r.json()["markdown"] == "Dire bonjour"
    r = client.put(f"/projects/{pid}/notes/s1", json={"markdown": "x"}, headers={"If-Match": etag})
    assert r.status_code == 409
    assert client.get(f"/projects/{pid}/notes/s1").json()["markdown"] == "Dire bonjour"
    assert client.get(f"/projects/{pid}/notes/s9").status_code == 404
    assert client.get(f"/projects/{pid}/notes/..%2Fdeck").status_code in (400, 404)
    role["value"] = "viewer"
    assert client.put(f"/projects/{pid}/notes/s1", json={"markdown": "y"}).status_code == 404
    clear_settings_cache()
