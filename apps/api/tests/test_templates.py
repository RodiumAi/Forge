"""Template catalog integrity.

The keyword router and the catalog both reference template ids by string; a
renamed or deleted kit used to leave dangling ids behind (the old router still
pointed at removed templates).
"""

import json
import re

from app.services.templates import list_templates, templates_root

EXPECTED_SLIDES_IDS = {
    "slides-agency-portfolio",
    "slides-annual-report",
    "slides-brand-presentation",
    "slides-campaign",
    "slides-case-studies",
    "slides-course-lesson",
    "slides-fundraising",
    "slides-market-research",
    "slides-media-kit",
    "slides-minimal-dark",
    "slides-pitch-startup",
    "slides-portfolio",
    "slides-product-demo",
    "slides-product-launch",
    "slides-product-roadmap",
    "slides-quarterly-review",
    "slides-sales-proposal",
    "slides-school-presentation",
    "slides-strategic-plan",
    "slides-thesis-defense",
    "slides-workshop",
    # wave 2, agent F2
    "slides-science-conference",
    "slides-internal-training",
    "slides-architecture",
    "slides-sprint-review",
    "slides-dev-keynote",
    "slides-dev-onboarding",
    "slides-post-mortem",
    "slides-visual-resume",
    "slides-wedding-event",
    "slides-travel",
    "slides-moodboard",
    "slides-personal-review",
    "slides-minimal-light",
    "slides-editorial",
    "slides-monochrome",
}

EXPECTED_DESIGN_SYSTEM_IDS = {
    "design-system-creatif",
    "design-system-education",
    "design-system-fintech",
    "design-system-luxe",
    "design-system-saas",
    "design-system-sante",
}

EXPECTED_IDS = (
    EXPECTED_SLIDES_IDS
    | EXPECTED_DESIGN_SYSTEM_IDS
    | {
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
)

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

EXPECTED_WEB_IDS = EXPECTED_IDS - EXPECTED_MOBILE_IDS - EXPECTED_SLIDES_IDS - EXPECTED_DESIGN_SYSTEM_IDS
DOCUMENT_KINDS = ("slides", "design_system")


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
            if template.kind in DOCUMENT_KINDS:
                continue  # document kits: test_template_slides.py, test_template_design_systems.py
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
            assert meta.get("kind") in ("web", "mobile", *DOCUMENT_KINDS), f"{meta['id']}.kind"

    def test_catalog_kind_filter(self):
        webs = list_templates(kind="web")
        mobiles = list_templates(kind="mobile")
        decks = list_templates(kind="slides")
        assert {t.id for t in webs} == EXPECTED_WEB_IDS
        assert {t.id for t in mobiles} == EXPECTED_MOBILE_IDS
        assert {t.id for t in decks} == EXPECTED_SLIDES_IDS
        assert {t.id for t in list_templates(kind="design_system")} == EXPECTED_DESIGN_SYSTEM_IDS
        assert all(t.kind == "web" for t in webs)
        assert all(t.kind == "mobile" for t in mobiles)

    def test_kits_follow_the_agent_contract(self):
        # A forked kit is the first code the agent edits: it must already follow
        # the rules the agent is held to (named createRoot, lucide icons,
        # mobile-first CSS, foundation + scoped page stylesheets, split files).
        from app.services.template_contract import kit_violations

        problems = {
            template.id: kit_violations(template.path, kind=template.kind)
            for template in list_templates()
            if template.kind not in DOCUMENT_KINDS
        }
        problems = {k: v for k, v in problems.items() if v}
        assert problems == {}, problems

    def test_previews_are_static_and_single_origin(self):
        # Card thumbnails must stay script-free; the only allowed remote
        # dependency is the Unsplash CDN already used by the kits themselves.
        for template in list_templates():
            preview = (template.path / "preview.html").read_text(encoding="utf-8")
            assert "<script" not in preview.lower(), template.id
            urls = re.findall(r"https?://[^\s\"')]+", preview)
            offsite = [u for u in urls if not u.startswith("https://images.unsplash.com/")]
            assert offsite == [], f"{template.id} references {offsite}"
