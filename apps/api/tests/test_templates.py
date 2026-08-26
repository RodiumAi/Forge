"""Template catalog integrity.

The keyword router and the catalog both reference template ids by string; a
renamed or deleted kit used to leave dangling ids behind (the old router still
pointed at removed templates).
"""

import json
import re

from app.services.templates import _TEMPLATE_KEYWORDS, list_templates, templates_root

EXPECTED_IDS = {
    "astroship-startup",
    "nexora-agency",
    "gallery-photos",
    "logsfolio-portfolio",
    "tailstore-shop",
    "podux-podcast",
    "tailnext-saas",
    "orbit-dashboard",
}


class TestCatalog:
    def test_all_kits_are_listed(self):
        assert {t.id for t in list_templates()} == EXPECTED_IDS

    def test_every_keyword_target_exists(self):
        ids = {t.id for t in list_templates()}
        for tid, _keywords in _TEMPLATE_KEYWORDS:
            assert tid in ids, f"keyword router points at missing template {tid}"

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

    def test_app_only_imports_react(self):
        # Kits must run in the Babel runner with zero install: React only.
        for template in list_templates():
            source = (template.path / "src" / "App.tsx").read_text(encoding="utf-8")
            imports = re.findall(r'from\s+["\']([^"\']+)["\']', source)
            unexpected = [i for i in imports if i != "react"]
            assert unexpected == [], f"{template.id} imports {unexpected}"

    def test_previews_are_self_contained(self):
        for template in list_templates():
            preview = (template.path / "preview.html").read_text(encoding="utf-8")
            assert "<script" not in preview.lower(), template.id
            assert "http://" not in preview and "https://" not in preview, template.id
