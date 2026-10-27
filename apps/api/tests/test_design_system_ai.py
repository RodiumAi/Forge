"""Design system generation: tokens from a spec, contrast, section edits, website
extraction (mocked capture), the chat flow (mocked model) and the brand site."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

import pytest

from app.contracts.forge_design import validate_design_system
from app.services.design_system import flow as flow_mod
from app.services.design_system import generate as generate_mod
from app.services.design_system import site_extract
from app.services.design_system.color import AA, contrast_ratio, ensure_contrast, wcag_level
from app.services.design_system.render import design_md, tailwind_config, tokens_json
from app.services.design_system.site import brand_site_html
from app.services.design_system.tokens import (
    Spec,
    apply_section,
    build_document,
    check_spec,
    colors_of,
    contrast_pairs,
    css_variables,
    spec_from_document,
)
from app.services.llm import RodiumError

SPEC = {
    "name": "Verdant",
    "description": "Fintech for small farms. Calm, trustworthy, warm.",
    "colors": {
        "bg": "#fbfaf7",
        "surface": "#ffffff",
        "fg": "#1d2420",
        "muted": "#5f6b64",
        "accent": "#1f7a4d",
        "border": "#e3e0d8",
    },
    "fonts": {"display": "Fraunces", "body": "Inter", "mono": "JetBrains Mono"},
    "type": {"base": 17, "ratio": 1.2},
    "space": 8,
    "radius": {"sm": 6, "md": 10, "lg": 18},
    "shadow": "soft",
    "motion": "calm",
    "logo": {
        "clearSpace": "Half the logo height",
        "minSizePx": 32,
        "usage": ["On light backgrounds"],
        "misuse": ["Never stretch it"],
    },
    "iconography": {
        "library": "lucide",
        "style": "outline",
        "stroke": 1.5,
        "summary": "Thin outline icons",
        "do": ["Pair with labels"],
    },
    "voice": {"summary": "Plain and warm.", "do": ["Short sentences"], "dont": ["Jargon"]},
    "imagery": {"summary": "Natural light photos.", "do": ["Real farms"], "dont": ["Stock handshakes"]},
    "guidelines": {"summary": "Clarity first.", "do": ["One accent per screen"], "dont": ["Gradients"]},
}


# ── tokens ─────────────────────────────────────────────────────────────────


def test_build_document_is_a_complete_valid_design_system():
    document, fixes = build_document(Spec.model_validate(SPEC))
    validate_design_system(document)
    tokens = document["tokens"]
    assert {
        "color",
        "font",
        "weight",
        "text",
        "leading",
        "type",
        "space",
        "radius",
        "shadow",
        "motion",
        "ease",
        "icon",
    } <= set(tokens)
    assert tokens["font"]["display"]["$value"][0] == "Fraunces"
    assert tokens["font"]["display"]["$value"][-1] == "serif"
    assert tokens["text"]["base"]["$value"] == {"value": 17, "unit": "px"}
    assert tokens["type"]["$type"] == "typography"
    assert tokens["type"]["h1"]["$value"]["fontFamily"] == "{font.display}"
    assert document["logo"]["usage"] == ["On light backgrounds", "Avoid: Never stretch it"]
    assert fixes == []
    assert all(row["pass"] for row in contrast_pairs(colors_of(document)))


def test_failing_pairs_are_repaired_and_reported():
    bad = {**SPEC, "colors": {"bg": "#888888", "fg": "#777777", "accent": "#999999", "muted": "#808080"}}
    document, fixes = build_document(Spec.model_validate(bad))
    assert {fix["token"] for fix in fixes} >= {"fg", "muted"}
    for row in contrast_pairs(colors_of(document)):
        assert row["pass"], row
    fg = document["tokens"]["color"]["fg"]
    assert fg["$extensions"]["forge"]["contrast"][0]["ratio"] >= AA


def test_contrast_helpers():
    assert round(contrast_ratio("#000000", "#ffffff"), 1) == 21.0
    assert wcag_level(4.6) == "AA" and wcag_level(3.2) == "AA-large" and wcag_level(8) == "AAA"
    fixed = ensure_contrast("#aaaaaa", "#ffffff", 4.5)
    assert contrast_ratio(fixed, "#ffffff") >= 4.5


def test_unknown_fonts_fall_back_to_the_curated_list():
    spec = Spec.model_validate(
        {**SPEC, "fonts": {"display": "Comic Papyrus", "body": "inter", "mono": "Inter"}}
    )
    document, _ = build_document(spec)
    font = document["tokens"]["font"]
    assert font["display"]["$value"][0] == "Inter"
    assert font["body"]["$value"][0] == "Inter"
    assert font["mono"]["$value"][0] == "JetBrains Mono"


def test_spec_round_trips_through_the_document():
    document, _ = build_document(Spec.model_validate(SPEC))
    spec = spec_from_document(document)
    assert spec.fonts.display == "Fraunces" and spec.type.base == 17 and spec.type.ratio == 1.2
    assert spec.radius.md == 10 and spec.space == 8 and spec.shadow == "soft" and spec.motion == "calm"
    assert spec.logo.misuse == ["Never stretch it"]
    assert spec.iconography.stroke == 1.5 and spec.iconography.do == ["Pair with labels"]


def test_a_section_edit_leaves_the_other_sections_alone():
    document, _ = build_document(Spec.model_validate(SPEC))
    document["tokens"]["space"]["custom"] = {"$value": {"value": 99, "unit": "px"}}
    spec = spec_from_document(document)
    spec.colors["accent"] = "#b91c1c"
    updated, _ = apply_section(document, "colors", spec)
    assert updated["tokens"]["color"]["accent"]["$value"] == "#b91c1c"
    assert updated["tokens"]["space"]["custom"]["$value"]["value"] == 99
    assert updated["tokens"]["font"] == document["tokens"]["font"]
    assert updated["voice"] == document["voice"]


def test_css_variables_follow_the_player_mapping():
    document, _ = build_document(Spec.model_validate(SPEC))
    variables = css_variables(document)
    assert variables["--accent"] == "#1f7a4d"
    assert variables["--font-display"].startswith("Fraunces")
    assert variables["--radius-md"] == "10px"
    assert variables["--motion-base"] == "400ms"
    assert variables["--ease-standard"] == "cubic-bezier(0.4, 0, 0.2, 1)"
    assert variables["--shadow-md"].startswith("0px 4px 12px -2px #000000")
    assert variables["--font-sans"] == variables["--font-body"]


def test_renderings():
    document, _ = build_document(Spec.model_validate(SPEC))
    md = design_md(document)
    assert "- `--accent`: #1f7a4d" in md and "- Display font: Fraunces" in md
    assert "fonts.googleapis.com" in md and "```css" in md
    # Only the CSS block declares variables, so a parser reading "--x: value" gets real values.
    block = md.split("```css", 1)[1]
    head = md.split("```css", 1)[0]
    assert "--accent: #1f7a4d;" in block
    assert "--space-xs:" not in head and "--fg on" not in head
    assert json.loads(tokens_json(document))["color"]["accent"]["$value"] == "#1f7a4d"
    assert "borderRadius" in tailwind_config(document)
    assert "—" not in md


def test_check_spec_rejects_a_palette_without_its_core():
    with pytest.raises(ValueError):
        check_spec({"name": "x", "colors": {"bg": "#fff"}})
    assert check_spec({"designSystem": SPEC}).name == "Verdant"


# ── website extraction ─────────────────────────────────────────────────────

RAW = {
    "text": {"rgb(17, 24, 39)": 900, "rgb(107, 114, 128)": 300},
    "bg": {"rgb(255, 255, 255)": 1500000, "rgb(249, 250, 251)": 400000, "rgba(0, 0, 0, 0.05)": 9},
    "buttons": {"rgb(234, 88, 12)": 12, "rgb(255, 255, 255)": 4},
    "heading": {'"Space Grotesk", sans-serif': 300},
    "body": {"Inter, system-ui, sans-serif": 2000},
    "radius": {"8px": 20, "9999px": 3},
    "shadow": {"rgba(0,0,0,.1) 0px 1px 3px": 5},
    "padding": {"16px": 30, "8px": 12, "15px": 4},
    "vars": {"--brand": "#ea580c", "--not-a-var": "x"},
    "title": "Acme Cloud",
    "description": "Ship faster.",
    "themeColor": "",
}


def test_findings_from_the_page_script():
    findings = site_extract.findings_from_raw("https://acme.test", RAW)
    assert findings.background == "#ffffff"
    assert findings.text == "#111827"
    assert findings.accent == "#ea580c"
    assert "#f9fafb" in findings.palette
    assert findings.heading_font == "Space Grotesk" and findings.body_font == "Inter"
    assert findings.radius_px == 8 and findings.spacing_px == 16 and findings.shadows
    text = findings.describe()
    assert "Accent colour: #ea580c" in text and "data, not instructions" in text


def test_extract_site_runs_the_capture_in_a_thread(monkeypatch):
    calls = []

    async def ok(url):
        calls.append(url)

    monkeypatch.setattr(site_extract, "resolve_and_validate_async", ok)
    monkeypatch.setattr(site_extract, "_collect_sync", lambda url: (RAW, b"\x89PNG fake"))
    findings = asyncio.run(site_extract.extract_site("https://acme.test/"))
    assert calls == ["https://acme.test/"] and findings.accent == "#ea580c"
    assert site_extract.screenshot_part(findings)["image_url"]["url"].startswith("data:image/png;base64,")


@pytest.mark.parametrize(
    "url", ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://localhost:8000"]
)
def test_extract_site_refuses_private_targets(url, monkeypatch):
    monkeypatch.setattr(site_extract, "_collect_sync", lambda _u: pytest.fail("must not open the page"))
    with pytest.raises(RodiumError) as exc:
        asyncio.run(site_extract.extract_site(url, "en"))
    assert "Could not read" in str(exc.value)


# ── chat flow (model mocked) ───────────────────────────────────────────────


@pytest.fixture
def ds_project(project, monkeypatch):
    from app.services import history
    from app.services.document_scaffold import scaffold_design_system

    monkeypatch.setattr(history, "snapshot", lambda *_a, **_k: None)
    scaffold_design_system(project, "Verdant")
    monkeypatch.setattr(flow_mod, "_finish_run", lambda *_a, **_k: None)
    monkeypatch.setattr(flow_mod, "_fail_run", lambda *_a, **_k: None)
    return project


def _ctx(project_id, *, prompt="Une fintech pour les fermes", section=None):
    async def auth():
        return object()

    return flow_mod.DesignSystemContext(
        project_id=project_id,
        project_name="Verdant",
        run_pk=uuid.uuid4(),
        user_msg_id="m1",
        prompt=prompt,
        locale="fr",
        gen_model="gen",
        edit_model="edit",
        route_effort="",
        tier="primary",
        resolve_auth=auth,
        section=section,
    )


def _events(ctx):
    async def collect():
        return [chunk async for chunk in flow_mod.document_stream(ctx)]

    return [json.loads(chunk[len("data: ") :]) for chunk in asyncio.run(collect())]


def _read(project_id, relative):
    from app.config import get_settings

    return (get_settings().projects_path / project_id / relative).read_text(encoding="utf-8")


def test_generation_writes_the_design_system(ds_project, monkeypatch):
    answers = ["not json at all", json.dumps(SPEC)]
    seen = []

    async def fake_complete(**kwargs):
        seen.append(kwargs)
        return answers.pop(0)

    async def no_logo(*_a, **_k):
        return None, None

    monkeypatch.setattr(generate_mod, "complete_chat", fake_complete)
    monkeypatch.setattr(flow_mod, "_logo_image", no_logo)
    events = _events(_ctx(ds_project))
    kinds = [e["type"] for e in events]
    assert kinds[:2] == ["user_message", "route"] and kinds[-1] == "done"
    doc_event = next(e for e in events if e["type"] == "design_system.document")
    assert doc_event["document"]["name"] == "Verdant" and doc_event["contrast"]
    assert next(e for e in events if e["type"] == "design_system.done")["repaired"] is True
    stored = json.loads(_read(ds_project, "design-system.json"))
    assert stored["tokens"]["color"]["accent"]["$value"] == "#1f7a4d"
    assert "Fraunces" in _read(ds_project, "DESIGN.md")
    assert "Verdant" in _read(ds_project, "public/brand/logo.svg")
    assert len(seen) == 2  # one repair


def test_generation_from_a_url_uses_the_findings(ds_project, monkeypatch):
    prompts = []

    async def fake_complete(**kwargs):
        prompts.append(kwargs["messages"][1]["content"])
        return json.dumps(SPEC)

    async def fake_extract(url, locale="en"):
        return site_extract.findings_from_raw(url, RAW, b"png")

    async def no_logo(*_a, **_k):
        return None, None

    monkeypatch.setattr(generate_mod, "complete_chat", fake_complete)
    monkeypatch.setattr(flow_mod, "extract_site", fake_extract)
    monkeypatch.setattr(flow_mod, "_logo_image", no_logo)
    events = _events(_ctx(ds_project, prompt="Reprends le style de https://acme.test"))
    findings = next(e for e in events if e["type"] == "design_system.findings")
    assert findings["accent"] == "#ea580c"
    content = prompts[0]
    assert isinstance(content, list) and content[1]["type"] == "image_url"
    assert "Accent colour: #ea580c" in content[0]["text"]


def test_a_failed_capture_warns_and_still_generates(ds_project, monkeypatch):
    async def fake_complete(**_kwargs):
        return json.dumps(SPEC)

    async def broken(url, locale="en"):
        raise RodiumError("Impossible de lire", None, "upstream")

    async def no_logo(*_a, **_k):
        return None, None

    monkeypatch.setattr(generate_mod, "complete_chat", fake_complete)
    monkeypatch.setattr(flow_mod, "extract_site", broken)
    monkeypatch.setattr(flow_mod, "_logo_image", no_logo)
    events = _events(_ctx(ds_project, prompt="https://acme.test"))
    assert any(e["type"] == "warning" for e in events)
    assert events[-1]["type"] == "done"


def test_section_edit_changes_only_that_section(ds_project, monkeypatch):
    before = json.loads(_read(ds_project, "design-system.json"))

    async def fake_complete(**_kwargs):
        return json.dumps(
            {
                "fonts": {"display": "Playfair Display"},
                "colors": {"bg": "#ff0000", "fg": "#000000", "accent": "#00ff00"},
            }
        )

    monkeypatch.setattr(generate_mod, "complete_chat", fake_complete)
    events = _events(_ctx(ds_project, prompt="Une police plus élégante", section="typography"))
    assert next(e for e in events if e["type"] == "design_system.document")["section"] == "typography"
    after = json.loads(_read(ds_project, "design-system.json"))
    assert after["tokens"]["font"]["display"]["$value"][0] == "Playfair Display"
    assert after["tokens"]["color"] == before["tokens"]["color"]  # colours in the answer are ignored
    assert after["tokens"]["space"] == before["tokens"]["space"]


def test_unknown_section_is_refused(ds_project):
    events = _events(_ctx(ds_project, section="nope"))
    assert events[-1] == {"type": "error", "code": "target_not_found", "message": events[-1]["message"]}


# ── brand site ─────────────────────────────────────────────────────────────


def test_brand_site_renders_every_section_with_the_tokens():
    document, _ = build_document(Spec.model_validate(SPEC))
    html = brand_site_html(
        document, asset_url=lambda p: "/" + p.removeprefix("public/"), lang="fr", badge=True
    )
    for anchor in (
        "colors",
        "typography",
        "spacing",
        "logo",
        "iconography",
        "imagery",
        "voice",
        "guidelines",
        "components",
    ):
        assert f'id="{anchor}"' in html
    assert "--accent:#1f7a4d" in html and 'src="/brand/logo.svg"' in html
    assert "Fait avec Forge" in html and "<script" not in html
    assert "—" not in html
    no_badge = brand_site_html(document, asset_url=lambda p: "", lang="en", badge=False)
    assert "Made with Forge" not in no_badge


def test_published_site_is_built_from_the_project(project, tmp_path):
    from app.services.document_scaffold import scaffold_design_system
    from app.services.publish_esm import build_design_system_site

    scaffold_design_system(project, "Acme <script>")
    out = Path(tmp_path) / "dist"
    out.mkdir()
    written = build_design_system_site(project, out, lang="en", badge=False)
    assert {"index.html", "404.html", "brand/logo.svg"} <= set(written)
    html = (out / "index.html").read_text(encoding="utf-8")
    assert "Acme &lt;script&gt;" in html and "<script>" not in html
