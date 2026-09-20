"""Template catalog integrity.

The keyword router and the catalog both reference template ids by string; a
renamed or deleted kit used to leave dangling ids behind (the old router still
pointed at removed templates).
"""

import json
import re

from app.services.templates import list_templates, templates_root

EXPECTED_IDS = {
    "astroship-startup",
    "atelier-mode",
    "aurora-ai",
    "ava-assistant",
    "bloom-wellness",
    "brutalist-studio",
    "calm-space",
    "echo-music",
    "fern-plants",
    "forge-devtools",
    "frame-social",
    "gallery-photos",
    "glacier-travel",
    "holo-portfolio",
    "kinetic-conf",
    "kobo-budget",
    "logsfolio-portfolio",
    "loop-habit",
    "lumen-architecture",
    "mono-journal",
    "nexora-agency",
    "nova-bank",
    "orbit-dashboard",
    "origami-3d",
    "podux-podcast",
    "pulse-fitness",
    "quantum-consult",
    "rida-ride",
    "sabor-recipes",
    "synthwave-music",
    "tailnext-saas",
    "tailstore-shop",
    "tempo-run",
    "terra-eco",
    "trove-market",
    "vertex-crypto",
}

EXPECTED_MOBILE_IDS = {
    "ava-assistant",
    "calm-space",
    "echo-music",
    "fern-plants",
    "frame-social",
    "kobo-budget",
    "loop-habit",
    "nova-bank",
    "rida-ride",
    "sabor-recipes",
    "tempo-run",
    "trove-market",
}

EXPECTED_WEB_IDS = EXPECTED_IDS - EXPECTED_MOBILE_IDS


class TestCatalog:
    def test_all_kits_are_listed(self):
        assert {t.id for t in list_templates()} == EXPECTED_IDS

    def test_prompt_creation_never_auto_forks_a_template(self):
        # A "portfolio for a painter" prompt used to silently fork the
        # portfolio kit. Templates apply only on explicit user choice.
        from app.services import templates

        assert not hasattr(templates, "suggest_template")
        assert not hasattr(templates, "_TEMPLATE_KEYWORDS")

    def test_every_kit_ships_the_full_contract(self):
        required = [
            "template.json",
            "DESIGN.md",
            "index.html",
            "package.json",
            "preview.html",
            "src/main.tsx",
            "src/App.tsx",
            "src/index.css",
        ]
        for template in list_templates():
            for rel in required:
                assert (template.path / rel).is_file(), f"{template.id} misses {rel}"

    def test_metadata_is_bilingual_with_a_palette(self):
        for folder in templates_root().iterdir():
            meta_file = folder / "template.json"
            if not meta_file.is_file():
                continue
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            assert meta["title"]["en"] and meta["title"]["fr"], meta["id"]
            assert meta["description"]["en"] and meta["description"]["fr"], meta["id"]
            for key in ("accent", "bg", "fg", "muted"):
                assert re.fullmatch(r"#[0-9a-fA-F]{6}", meta[key]), f"{meta['id']}.{key}"
            assert meta.get("kind") in ("web", "mobile"), f"{meta['id']}.kind"

    def test_catalog_kind_filter(self):
        webs = list_templates(kind="web")
        mobiles = list_templates(kind="mobile")
        assert {t.id for t in webs} == EXPECTED_WEB_IDS
        assert {t.id for t in mobiles} == EXPECTED_MOBILE_IDS
        assert all(t.kind == "web" for t in webs)
        assert all(t.kind == "mobile" for t in mobiles)

    def test_app_only_imports_react(self):
        # Kits must run in the Babel runner with zero install: React only.
        for template in list_templates():
            source = (template.path / "src" / "App.tsx").read_text(encoding="utf-8")
            imports = re.findall(r'from\s+["\']([^"\']+)["\']', source)
            unexpected = [i for i in imports if i != "react"]
            assert unexpected == [], f"{template.id} imports {unexpected}"

    def test_previews_are_static_and_single_origin(self):
        # Card thumbnails must stay script-free; the only allowed remote
        # dependency is the Unsplash CDN already used by the kits themselves.
        for template in list_templates():
            preview = (template.path / "preview.html").read_text(encoding="utf-8")
            assert "<script" not in preview.lower(), template.id
            urls = re.findall(r"https?://[^\s\"')]+", preview)
            offsite = [u for u in urls if not u.startswith("https://images.unsplash.com/")]
            assert offsite == [], f"{template.id} references {offsite}"
