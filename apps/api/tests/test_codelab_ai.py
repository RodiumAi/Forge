"""Codelab AI: routing, outline and confirm, streamed steps, step targets, checks, files.

The LLM is mocked twice: ``deck_ai.llm.complete_chat`` answers the JSON calls
(outline, codelab edit, check, files) and ``codelab.flow.stream_chat_completion``
streams the Markdown of the steps, both from scripted answers.
"""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest

from app.config import clear_settings_cache
from app.contracts.forge_design import validate_codelab
from app.services.codelab import chat_entry, flow, store
from app.services.codelab.files import list_files
from app.services.codelab.outline import check_outline, outline_from_plan, plan_tasks
from app.services.deck_ai import chat_entry as deck_chat_entry
from app.services.deck_ai import flow as deck_flow
from app.services.deck_ai import llm as deck_llm
from app.services.document_scaffold import scaffold_codelab
from app.services.filesystem import read_file
from app.services.llm import StreamChunk


@pytest.fixture
def lab(project, monkeypatch):
    monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "true")
    clear_settings_cache()
    monkeypatch.setattr(store.history, "snapshot", lambda *_a, **_k: None)
    scaffold_codelab(project, "Atelier")
    return project


@pytest.fixture
def run_log(monkeypatch):
    log: dict = {"updates": [], "finished": None, "failed": None}
    for module in (flow, deck_flow):
        monkeypatch.setattr(module, "_update_run", lambda _pk, **fields: log["updates"].append(fields))
        monkeypatch.setattr(
            module, "_finish_run", lambda _pk, payload, _l: log.__setitem__("finished", payload)
        )
        monkeypatch.setattr(
            module, "_fail_run", lambda _pk, code, msg: log.__setitem__("failed", (code, msg))
        )
    return log


def script_json(monkeypatch, *answers):
    queue = [a if isinstance(a, str) else json.dumps(a) for a in answers]
    calls: list[list[dict]] = []

    async def fake(*, messages, **_kwargs):
        calls.append(messages)
        if not queue:
            raise AssertionError("the model was called more often than scripted")
        return queue.pop(0)

    monkeypatch.setattr(deck_llm, "complete_chat", fake)
    return calls


def script_stream(monkeypatch, *answers):
    """Each streamed call returns the next Markdown answer, in small chunks."""
    queue = list(answers)
    calls: list[list[dict]] = []

    async def fake(*, messages, **_kwargs):
        calls.append(messages)
        if not queue:
            raise AssertionError("streamed more often than scripted")
        text = queue.pop(0)
        for i in range(0, len(text), 50):
            yield StreamChunk(kind="token", content=text[i : i + 50])

    monkeypatch.setattr(flow, "stream_chat_completion", fake)
    return calls


async def _auth():
    return SimpleNamespace()


def ctx(project_id: str, **kw) -> flow.CodelabContext:
    base = dict(
        project_id=project_id,
        run_pk=uuid.uuid4(),
        user_id=uuid.uuid4(),
        user_msg_id="m1",
        prompt="Un codelab pour créer une API REST avec FastAPI",
        locale="fr",
        gen_model="writer",
        edit_model="editor",
        route_effort="Approfondi",
        tier="escalation",
        resolve_auth=_auth,
    )
    base.update(kw)
    return flow.CodelabContext(**base)


async def events_of(stream) -> list[dict]:
    out = []
    async for chunk in stream:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


async def collect(source) -> list[dict]:
    return [event async for event in source]


OUTLINE = {
    "title": "API REST avec FastAPI",
    "summary": "Construire une petite API.",
    "level": "beginner",
    "prerequisites": ["Python 3.12"],
    "learn": ["Créer des routes", "Valider les données"],
    "steps": [
        {"title": "Introduction", "idea": "Ce que l'on construit", "minutes": 3},
        {"title": "Installer FastAPI", "idea": "Environnement et dépendances", "minutes": "7"},
        {"title": "Première route", "idea": "GET /", "minutes": 10},
    ],
}


def two_steps(project_id: str) -> None:
    codelab = store.read_codelab(project_id)
    codelab["steps"] = [
        {"id": "intro", "title": "Introduction", "file": "steps/01-intro.md", "minutes": 3},
        {"id": "routes", "title": "Routes", "file": "steps/02-routes.md", "minutes": 8},
    ]
    store.write_codelab(project_id, codelab)
    store.write_step(project_id, "steps/01-intro.md", "# Introduction\n\nBienvenue.\n")
    store.write_step(project_id, "steps/02-routes.md", '# Routes\n\n```py title="main.py"\napp = 1\n```\n')


# ── routing ────────────────────────────────────────────────────────────────


class TestRouting:
    async def test_flag_off_is_not_available(self, project, monkeypatch):
        monkeypatch.setenv("FORGE_KIND_CODELAB_ENABLED", "false")
        clear_settings_cache()
        response = deck_chat_entry.start_document_message(
            db=None,
            user=None,
            project=SimpleNamespace(id=uuid.uuid4(), platform="codelab"),
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
        assert events[0]["code"] == "kind_not_available"
        assert events[0]["kind"] == "codelab"

    def test_confirm_plan_dispatches_codelab_outlines(self):
        import inspect

        from app.routers import chats

        source = inspect.getsource(chats.confirm_plan)
        assert source.index("codelab_chat.is_codelab_outline_run(run)") < source.index(
            "deck_chat.is_deck_outline_run"
        )
        assert chat_entry.is_codelab_outline_run(SimpleNamespace(task_class="codelab.outline"))
        assert not chat_entry.is_codelab_outline_run(SimpleNamespace(task_class="deck.outline"))

    def test_task_classes(self, lab):
        assert flow.task_class(ctx(lab, fresh=True)) == "codelab.outline"
        assert flow.task_class(ctx(lab, target_step="intro")) == "codelab.edit.target"
        assert flow.task_class(ctx(lab, action="check_code")) == "codelab.check"
        assert flow.task_class(ctx(lab, action="make_files")) == "codelab.files"
        assert flow.task_class(ctx(lab)) == "codelab.edit"

    def test_the_scaffold_counts_as_blank(self, lab):
        assert store.is_blank_codelab(lab)
        two_steps(lab)
        assert not store.is_blank_codelab(lab)

    def test_message_target_accepts_a_step(self):
        from app.schemas import SendMessageRequest

        body = SendMessageRequest(content="x", target={"stepId": "setup"}, action="check_code")
        assert body.target.stepId == "setup"
        with pytest.raises(ValueError):
            SendMessageRequest(content="x", target={"stepId": "../x"})


# ── outline and confirm ────────────────────────────────────────────────────


class TestOutline:
    def test_ids_come_from_titles_and_minutes_are_bounded(self):
        outline = check_outline(
            {**OUTLINE, "steps": [*OUTLINE["steps"], {"title": "Introduction", "minutes": 999}]}
        )
        assert [s.id for s in outline.steps] == [
            "introduction",
            "installer-fastapi",
            "premiere-route",
            "introduction-2",
        ]
        assert outline.steps[1].minutes == 7
        assert outline.steps[3].minutes == 60

    async def test_fresh_codelab_proposes_an_outline_and_waits(self, lab, monkeypatch, run_log):
        script_json(monkeypatch, OUTLINE)
        events = await collect(flow._outline(ctx(lab, fresh=True)))
        types = [e["type"] for e in events]
        assert types == ["step", "codelab.outline", "step", "plan"]
        plan = events[-1]
        assert plan["needs_confirm"] is True
        assert [t["id"] for t in plan["tasks"]] == ["introduction", "installer-fastapi", "premiere-route"]
        update = run_log["updates"][-1]
        assert update["status"] == "awaiting_plan_confirm"
        assert update["task_class"] == "codelab.outline"
        assert json.loads(update["plan_meta_json"])["codelab"]["title"] == "API REST avec FastAPI"
        # Nothing written yet.
        assert store.read_codelab(lab)["steps"][0]["id"] == "intro"

    async def test_files_are_planned_when_the_user_asks(self, lab, monkeypatch, run_log):
        script_json(monkeypatch, OUTLINE)
        events = await collect(flow._outline(ctx(lab, fresh=True, prompt="avec un projet de départ")))
        outline = events[1]["outline"]
        assert outline["files"] == {"starter": True, "solution": True}

    def test_confirmed_plan_keeps_order_titles_and_ids(self):
        stored = check_outline(OUTLINE).model_dump()
        tasks = plan_tasks(check_outline(OUTLINE))
        edited = [tasks[2], {**tasks[0], "title": "Bienvenue"}, {"id": "new", "title": "Aller plus loin"}]
        outline = outline_from_plan(stored, edited)
        assert [(s.id, s.title) for s in outline.steps] == [
            ("premiere-route", "Première route"),
            ("introduction", "Bienvenue"),
            ("aller-plus-loin", "Aller plus loin"),
        ]
        assert outline.learn == ["Créer des routes", "Valider les données"]


# ── writing ────────────────────────────────────────────────────────────────


class TestWriting:
    async def test_steps_are_streamed_written_and_valid(self, lab, monkeypatch, run_log):
        outline = check_outline(OUTLINE)
        long_step = (
            "# Installer FastAPI\n\n"
            + "Texte. " * 80
            + '\n\n```terminal\n$ pip install "fastapi[standard]"\n```\n'
        )
        calls = script_stream(
            monkeypatch,
            "# Introduction\n\nOn construit une API.",
            long_step,
            "```markdown\nCode de la route\n```",
        )
        events = await collect(
            flow.codelab_write_events(
                project_id=lab,
                run_pk=uuid.uuid4(),
                prompt="FastAPI",
                outline=outline,
                model="writer",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        types = [e["type"] for e in events]
        assert types.count("codelab.step") == 3
        assert types.index("codelab.codelab") < types.index("codelab.delta")
        assert types[-2:] == ["step", "done"]
        deltas = [e for e in events if e["type"] == "codelab.delta" and e["step_id"] == "installer-fastapi"]
        assert len(deltas) >= 2
        assert "".join(d["text"] for d in deltas) == long_step

        codelab = validate_codelab(json.loads(read_file(lab, "codelab.json")))
        assert [s.file for s in codelab.steps] == [
            "steps/01-introduction.md",
            "steps/02-installer-fastapi.md",
            "steps/03-premiere-route.md",
        ]
        assert codelab.durationMinutes == 20
        assert codelab.learn == ["Créer des routes", "Valider les données"]
        # The scaffold's step file is gone.
        with pytest.raises(FileNotFoundError):
            read_file(lab, "steps/01-intro.md")
        # A wrapped answer is unwrapped and gets its heading.
        assert read_file(lab, "steps/03-premiere-route.md") == "# Première route\n\nCode de la route\n"
        # Each later step sees the earlier steps as written.
        assert "On construit une API." in calls[1][1]["content"]
        assert run_log["finished"]["summary"].startswith("Codelab de 3")

    async def test_an_empty_step_falls_back_with_a_warning(self, lab, monkeypatch, run_log):
        outline = check_outline({**OUTLINE, "steps": OUTLINE["steps"][:1]})
        script_stream(monkeypatch, "   ")
        events = await collect(
            flow.codelab_write_events(
                project_id=lab,
                run_pk=uuid.uuid4(),
                prompt="x",
                outline=outline,
                model="w",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        warning = next(e for e in events if e["type"] == "warning")
        assert warning["message"] == "STEP_FALLBACK: introduction"
        step = next(e for e in events if e["type"] == "codelab.step")
        assert step["fallback"] is True
        assert step["markdown"] == "# Introduction\n\nCe que l'on construit\n"

    async def test_files_asked_in_the_outline_are_written_with_downloads(self, lab, monkeypatch, run_log):
        outline = check_outline({**OUTLINE, "steps": OUTLINE["steps"][:1], "files": {"starter": True}})
        script_stream(monkeypatch, "# Introduction\n\nTexte.")
        script_json(
            monkeypatch,
            {
                "files": [
                    {"path": "files/starter/main.py", "content": "print('hi')\n"},
                    {"path": "files/starter/requirements.txt", "content": "fastapi\n"},
                ]
            },
        )
        events = await collect(
            flow.codelab_write_events(
                project_id=lab,
                run_pk=uuid.uuid4(),
                prompt="x",
                outline=outline,
                model="w",
                locale="fr",
                resolve_auth=_auth,
            )
        )
        files_event = next(e for e in events if e["type"] == "codelab.files")
        assert files_event["files"] == ["files/starter/main.py", "files/starter/requirements.txt"]
        assert [f.path for f in list_files(lab)] == files_event["files"]
        downloads = store.read_codelab(lab)["downloads"]
        assert downloads == [
            {"id": "starter", "label": "Projet de départ", "path": "files/starter", "zip": True}
        ]

    async def test_background_job_publishes_replayable_events(self, lab, monkeypatch, run_log):
        from app.services.orchestration import plan_worker, run_queue

        monkeypatch.setattr(run_queue, "_redis", lambda: None)
        script_stream(monkeypatch, "# Seule\n\nTexte.")
        outline = check_outline({"title": "T", "steps": [{"title": "Seule"}]})
        run_pk = uuid.uuid4()
        flow.spawn_codelab_write_job(
            project_id=lab,
            run_pk=run_pk,
            prompt="x",
            outline=outline,
            model="w",
            locale="en",
            resolve_auth=_auth,
        )
        events = await events_of(plan_worker.iter_run_event_sse(str(run_pk)))
        kinds = [
            e["type"] for e in events if e["type"].startswith("codelab.") and e["type"] != "codelab.delta"
        ]
        assert kinds == ["codelab.codelab", "codelab.step", "codelab.done"]
        assert events[-1]["type"] == "done"


# ── step target ────────────────────────────────────────────────────────────


class TestTargets:
    async def test_a_step_target_only_writes_that_step(self, lab, monkeypatch, run_log):
        two_steps(lab)
        before_codelab = read_file(lab, "codelab.json")
        before_intro = read_file(lab, "steps/01-intro.md")
        calls = script_stream(monkeypatch, "# Routes\n\nNouvelle version.\n")
        events = await collect(
            flow._targeted_edit(ctx(lab, target_step="routes", prompt="Ajoute une route POST"))
        )
        assert read_file(lab, "steps/02-routes.md") == "# Routes\n\nNouvelle version.\n"
        assert read_file(lab, "steps/01-intro.md") == before_intro
        assert read_file(lab, "codelab.json") == before_codelab
        writes = [e["path"] for e in events if e["type"] == "file_write"]
        assert writes == ["steps/02-routes.md"]
        step = next(e for e in events if e["type"] == "codelab.step")
        assert step["target"] == {"stepId": "routes"}
        # The model saw the neighbour as read-only context and the request.
        prompt = calls[0][1]["content"]
        assert "Previous step (read-only)" in prompt
        assert "Ajoute une route POST" in prompt

    async def test_a_new_heading_renames_only_that_step(self, lab, monkeypatch, run_log):
        two_steps(lab)
        script_stream(monkeypatch, "# Les routes de l'API\n\nTexte.\n")
        events = await collect(flow._targeted_edit(ctx(lab, target_step="routes")))
        codelab = store.read_codelab(lab)
        assert [s["title"] for s in codelab["steps"]] == ["Introduction", "Les routes de l'API"]
        assert any(e["type"] == "codelab.codelab" for e in events)

    async def test_unknown_step_is_refused(self, lab, monkeypatch, run_log):
        two_steps(lab)
        script_stream(monkeypatch)
        events = await collect(flow._targeted_edit(ctx(lab, target_step="nope")))
        assert events[-1]["code"] == "target_not_found"
        assert run_log["failed"][0] == "target_not_found"

    async def test_step_action_without_target_is_refused(self, lab, monkeypatch, run_log):
        events = await collect(flow._targeted_edit(ctx(lab, action="shorten")))
        assert events[-1]["code"] == "target_required"

    async def test_empty_answer_writes_nothing(self, lab, monkeypatch, run_log):
        two_steps(lab)
        before = read_file(lab, "steps/02-routes.md")
        script_stream(monkeypatch, "")
        events = await collect(flow._targeted_edit(ctx(lab, target_step="routes")))
        assert events[-1]["code"] == "invalid_model_output"
        assert read_file(lab, "steps/02-routes.md") == before


# ── codelab-level edit ─────────────────────────────────────────────────────


async def test_codelab_edit_reorders_adds_and_removes(lab, monkeypatch, run_log):
    two_steps(lab)
    script_json(
        monkeypatch,
        {
            "order": ["routes", "deploy"],
            "steps": [
                {"id": "deploy", "title": "Déployer", "minutes": 6, "markdown": "# Déployer\n\nEn ligne."}
            ],
            "meta": {"level": "intermediate"},
        },
    )
    events = await collect(flow._codelab_edit(ctx(lab, prompt="Supprime l'intro, ajoute le déploiement")))
    codelab = store.read_codelab(lab)
    assert [s["id"] for s in codelab["steps"]] == ["routes", "deploy"]
    assert codelab["steps"][1]["file"] == "steps/03-deploy.md"
    assert codelab["level"] == "intermediate"
    assert codelab["durationMinutes"] == 14
    assert read_file(lab, "steps/03-deploy.md") == "# Déployer\n\nEn ligne.\n"
    with pytest.raises(FileNotFoundError):
        read_file(lab, "steps/01-intro.md")
    removed = [e for e in events if e["type"] == "codelab.step_removed"]
    assert [e["step_id"] for e in removed] == ["intro"]


async def test_codelab_edit_refuses_unknown_steps_without_markdown(lab, monkeypatch, run_log):
    two_steps(lab)
    with pytest.raises(ValueError):
        flow.check_codelab_edit({"order": ["intro", "ghost"]}, {"intro", "routes"})
    with pytest.raises(ValueError):
        flow.check_codelab_edit({"order": ["intro", "x"], "steps": [{"id": "x", "title": "X"}]}, {"intro"})


# ── check and files actions ────────────────────────────────────────────────


async def test_consistency_check_reports_and_writes_nothing(lab, monkeypatch, run_log):
    two_steps(lab)
    before = read_file(lab, "codelab.json")
    script_json(
        monkeypatch,
        {
            "summary": "Un fichier change de nom.",
            "issues": [
                {
                    "stepId": "routes",
                    "severity": "error",
                    "message": "main.py devient app.py",
                    "fix": "Garder main.py",
                },
                {"stepId": "ghost", "severity": "bizarre", "message": "Autre"},
                {"message": ""},
            ],
        },
    )
    events = await collect(flow._check(ctx(lab, action="check_code")))
    check = next(e for e in events if e["type"] == "codelab.check")
    assert check["issues"] == [
        {
            "stepId": "routes",
            "severity": "error",
            "message": "main.py devient app.py",
            "fix": "Garder main.py",
        },
        {"stepId": None, "severity": "warning", "message": "Autre", "fix": None},
    ]
    assert not any(e["type"] == "file_write" for e in events)
    assert read_file(lab, "codelab.json") == before
    assert run_log["finished"]["summary"] == "Un fichier change de nom."


async def test_make_files_keeps_paths_under_the_asked_kind(lab, monkeypatch, run_log):
    two_steps(lab)
    script_json(
        monkeypatch,
        {"files": [{"path": "files/../../evil.py", "content": "x"}]},
        {"files": [{"path": "files/starter/app.py", "content": "x"}]},
        {"files": [{"path": "files/solution/app.py", "content": "print(1)\n"}]},
    )
    events = await collect(flow._files_flow(ctx(lab, action="make_files", prompt="Génère la solution")))
    assert next(e for e in events if e["type"] == "codelab.files")["files"] == ["files/solution/app.py"]
    assert [f.path for f in list_files(lab)] == ["files/solution/app.py"]
    assert store.read_codelab(lab)["downloads"][0]["id"] == "solution"


# ── cover, presenter and setup pages ───────────────────────────────────────


def test_outline_keeps_valid_cover_sections_and_drops_invented_junk():
    outline = check_outline(
        {
            "title": "Atelier",
            "steps": [{"title": "Intro", "idea": "x", "minutes": 5}],
            "cover": {"eyebrow": "Google I/O Extended", "highlights": ["Gemini"]},
            "presenter": {"name": "Ada", "links": [{"label": "Site", "url": "http://not-https.example"}]},
            "setup": {"promo": {"code": "EXAMPLE10", "label": "300 RODI"}},
        }
    )
    assert outline.cover == {"eyebrow": "Google I/O Extended", "highlights": ["Gemini"]}
    assert outline.presenter is None  # an http link makes the section invalid: dropped, never guessed
    assert outline.setup == {"promo": {"code": "EXAMPLE10", "label": "300 RODI"}}
    kept = outline_from_plan(outline.model_dump(), plan_tasks(outline))
    assert kept.setup == outline.setup
    document = flow.new_codelab(kept, {"presenter": {"name": "Grace"}, "pages": {"setup": False}})
    assert document["cover"]["eyebrow"] == "Google I/O Extended"
    assert document["presenter"] == {"name": "Grace"}
    assert document["pages"] == {"setup": False}
    validate_codelab(document)


def test_codelab_edit_meta_sets_valid_sections_only():
    codelab = {"title": "T"}
    flow._apply_meta(
        codelab,
        {"presenter": {"name": "Ada", "role": "Dev"}, "setup": {"promo": {"label": "no code"}}},
    )
    assert codelab["presenter"] == {"name": "Ada", "role": "Dev"}
    assert "setup" not in codelab
