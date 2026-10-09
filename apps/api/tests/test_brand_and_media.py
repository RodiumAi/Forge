"""Project charter bootstrap, web fonts, generated media and quality references."""

from __future__ import annotations

import io

from app.services.filesystem import write_bytes, write_file

CHARTER = """# Fournil

## Brand
- Artisan bakery in Lyon.

## Colors
- `--bg`: #fbf6ee (page)
- `--surface`: #ffffff
- `--fg`: #2a1d12
- `--muted`: #7a6656
- `--accent`: #c2410c
- `--accent-contrast`: #ffffff
- `--border`: #eadfce

## Typography
- Display font: Fraunces
- Body font: "Inter", sans-serif
- Google Fonts: https://fonts.googleapis.com/css2?family=Wrong&display=swap

## Imagery
- Style: warm natural light, close-up, crusty textures
- Hero image prompt: golden croissants on a wooden counter at dawn
- Hero image alt: Croissants dorés sur le comptoir
- Section image prompt: a baker shaping dough by hand
- Section image alt: Boulanger façonnant la pâte
"""


class TestCharter:
    def test_fonts_are_validated_and_the_import_is_built_here(self):
        from app.services.brand_charter import finalize_charter, parse_font_pair

        md = finalize_charter(CHARTER)
        pair = parse_font_pair(md)
        assert (pair.display, pair.body) == ("Fraunces", "Inter")
        assert "family=Wrong" not in md, "a model-written font URL is never trusted"
        assert "family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" in md
        assert '`--font-display`: "Fraunces", Georgia' in md
        assert '@import url("https://fonts.googleapis.com/css2?' in md

    def test_unknown_fonts_fall_back_to_a_safe_pair(self):
        from app.services.brand_charter import finalize_charter, parse_font_pair

        md = finalize_charter("# X\n\n## Typography\n- Display font: Comic Neue Ultra\n")
        assert parse_font_pair(md) is not None
        assert "Space+Grotesk" in md and "Inter" in md

    def test_usable_charter_needs_core_tokens(self):
        from app.services.brand_charter import charter_is_usable

        assert charter_is_usable(CHARTER)
        assert not charter_is_usable("# X\n- `--accent`: #ff0000\n")

    def test_image_plan_reads_the_imagery_section(self):
        from app.services.brand_charter import image_plan

        plan = image_plan(CHARTER, 2)
        assert [p["role"] for p in plan] == ["hero", "section"]
        assert "croissants" in plan[0]["prompt"] and "No text" in plan[0]["prompt"]
        assert plan[0]["alt"] == "Croissants dorés sur le comptoir"
        assert image_plan(CHARTER, 0) == []

    def test_placeholder_charter_detection(self):
        from app.services.brand_charter import is_default_charter
        from app.services.scaffold import DESIGN_MD, DESIGN_MD_MOBILE

        assert is_default_charter(DESIGN_MD) and is_default_charter(DESIGN_MD_MOBILE)
        legacy = DESIGN_MD.replace("<!-- forge:default-charter -->\n", "")
        assert is_default_charter(legacy), "projects scaffolded before the marker"
        assert not is_default_charter(CHARTER)

    def test_bootstrap_runs_only_on_a_blank_build(self, project):
        from app.services.brand_charter import needs_brand_bootstrap
        from app.services.scaffold import DESIGN_MD

        tasks = [{"id": "architecture", "status": "pending"}, {"id": "home", "status": "pending"}]
        write_file(project, "DESIGN.md", DESIGN_MD)
        assert needs_brand_bootstrap(project, tasks, "Crée un site pour ma boulangerie")
        assert not needs_brand_bootstrap(project, [{"id": "edit", "status": "pending"}], "x")
        assert not needs_brand_bootstrap(
            project, tasks, "[Reference screenshot: home.png | intent:reference | url: /x.png]"
        )
        write_file(project, "DESIGN.md", CHARTER)
        assert not needs_brand_bootstrap(project, tasks, "Crée un site")

    def test_bootstrap_writes_charter_and_images(self, project, monkeypatch):
        import asyncio

        from PIL import Image

        from app.services import brand_charter, llm
        from app.services.orchestration import images
        from app.services.project_media import list_project_images

        async def fake_complete(**_kwargs):
            return CHARTER

        def png() -> bytes:
            buf = io.BytesIO()
            Image.new("RGB", (1536, 1024), (200, 120, 40)).save(buf, format="PNG")
            return buf.getvalue()

        async def fake_image(**_kwargs):
            return png()

        monkeypatch.setattr(llm, "complete_chat", fake_complete)
        monkeypatch.setattr(images, "request_image_bytes", fake_image)

        async def drive():
            return [
                e
                async for e in brand_charter.bootstrap_project_brand(
                    project_id=project, brief="bakery", auth=None, model="m", locale="en"
                )
            ]

        events = asyncio.run(drive())
        assert {"type": "file_write", "path": "DESIGN.md"} in events
        listed = {m.role: m for m in list_project_images(project)}
        assert set(listed) == {"hero", "section"}
        hero = listed["hero"]
        assert hero.path.endswith(".webp") and (hero.width, hero.height) == (1536, 1024)
        assert [w for _, w in hero.srcset] == [640, 1024, 1536]
        assert hero.alt == "Croissants dorés sur le comptoir"


class TestMedia:
    def test_media_layer_lists_real_files_with_dimensions(self, project):
        from PIL import Image

        from app.services.project_media import format_project_media_layer, public_asset_exists

        buf = io.BytesIO()
        Image.new("RGB", (800, 600)).save(buf, format="JPEG")
        write_bytes(project, "public/images/team.jpg", buf.getvalue())
        write_bytes(project, "public/favicon.png", b"\x89PNG")
        layer = format_project_media_layer(project)
        assert "/images/team.jpg 800x600" in layer
        assert "/favicon.png" not in layer
        assert public_asset_exists(project, "/images/team.jpg")
        assert not public_asset_exists(project, "/images/missing.jpg")
        assert not public_asset_exists(project, "/../../etc/passwd")


class TestQualityReference:
    def test_a_young_build_gets_a_kit_excerpt(self, project):
        from app.services.template_examples import format_template_example_layer

        files = {"src/App.tsx": "x", "src/main.tsx": "x", "src/index.css": "x"}
        query = "User request:\nlanding for an AI startup\n\nCurrent plan task (3/6): Build the home page"
        layer = format_template_example_layer(project, files, query)
        assert "QUALITY REFERENCE" in layer and "Do NOT" in layer

    def test_coherence_and_edits_get_none(self, project):
        from app.services.template_examples import format_template_example_layer

        files = {"src/App.tsx": "x"}
        query = "Current plan task (6/6): Final coherence pass"
        assert format_template_example_layer(project, files, query) == ""
        assert format_template_example_layer(project, files, "change the title") == ""

    def test_a_forked_project_gets_its_kit_tone(self, project):
        from app.services.template_examples import format_template_example_layer

        write_file(project, ".forge/template.json", '{"id": "aurora-ai", "tone": "visionary, sleek"}')
        layer = format_template_example_layer(project, {}, "anything")
        assert "aurora-ai" in layer and "visionary, sleek" in layer


class TestCatalogPrompt:
    def test_every_preloaded_library_is_advertised(self):
        from app.plugins_catalog import format_plugins_system_block

        block = format_plugins_system_block("en")
        for package in (
            "recharts",
            "embla-carousel-react",
            "sonner",
            "cmdk",
            "gsap",
            "lenis",
            "swiper",
            "@react-three/fiber",
            "react-i18next",
            "react-helmet-async",
        ):
            assert package in block, package
        assert "css-only hacks" not in block

    def test_integrations_are_in_the_agent_context(self):
        from app.services.prototype_mode import format_prototype_plugins_layer

        layer = format_prototype_plugins_layer(locale="en")
        assert "Integrations catalog" in layer and "Calendly" in layer
