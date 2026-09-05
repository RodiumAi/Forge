"""A prototype that only works at 1440px is not finished.

The builder previews in a phone frame as often as a desktop one, so the two
things that most reliably break there — a missing viewport meta and a fixed
pixel width on a container — are checked deterministically and handed to the
existing repair pass.

Warnings, not criticals, on purpose: a fixed width is ugly, a missing createRoot
is a black screen. Promoting these would spend a repair pass on cosmetics ahead
of a crash.
"""

from __future__ import annotations

from app.services.orchestration.verify_build import (
    findings_have_critical,
    repair_focus_paths,
    responsive_findings,
)


def _codes(findings) -> list[str]:
    return [f.code for f in findings]


class TestViewportMeta:
    def test_it_is_flagged_when_missing(self):
        findings = responsive_findings({"index.html": "<html><body></body></html>"})
        assert _codes(findings) == ["responsive.missing_viewport_meta"]

    def test_a_present_tag_passes(self):
        html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head></html>'
        assert responsive_findings({"index.html": html}) == []

    def test_quoting_and_case_do_not_matter(self):
        html = "<META NAME='viewport' CONTENT='width=device-width'>"
        assert responsive_findings({"index.html": html}) == []

    def test_a_project_without_index_html_is_not_flagged(self):
        # Nothing to fix, and a phantom finding would burn a repair pass.
        assert responsive_findings({"src/App.tsx": "export default () => null;"}) == []


class TestFixedWidths:
    def test_a_wide_container_is_flagged(self):
        findings = responsive_findings({"src/index.css": ".container { width: 1200px; }"})
        assert _codes(findings) == ["responsive.fixed_width_container"]
        assert "1200px" in findings[0].message
        assert ".container" in findings[0].message

    def test_min_width_counts_too(self):
        # `min-width` is worse than `width`: it cannot even shrink.
        findings = responsive_findings({"src/index.css": ".hero { min-width: 900px; }"})
        assert _codes(findings) == ["responsive.fixed_width_container"]

    def test_small_pixel_widths_are_left_alone(self):
        # Icons, avatars, borders — a pixel width is right there.
        css = ".icon { width: 24px; } .avatar { width: 48px; } .rule { width: 120px; }"
        assert responsive_findings({"src/index.css": css}) == []

    def test_fluid_declarations_pass(self):
        css = """
        .container { max-width: 1200px; width: 100%; }
        .hero { width: min(90vw, 1100px); }
        .grid { width: clamp(320px, 90vw, 1200px); }
        """
        assert responsive_findings({"src/index.css": css}) == []

    def test_it_reports_each_stylesheet_separately(self):
        findings = responsive_findings(
            {
                "src/index.css": ".a { width: 1200px; }",
                "src/styles/products.css": ".b { width: 980px; }",
            }
        )
        assert sorted(f.path for f in findings) == ["src/index.css", "src/styles/products.css"]

    def test_it_does_not_read_tsx_as_css(self):
        # A width in a JS object literal is not a stylesheet rule.
        tsx = "const s = { width: 1200 };"
        assert responsive_findings({"src/App.tsx": tsx}) == []

    def test_the_message_names_at_most_a_handful(self):
        css = "".join(f".c{i} {{ width: {900 + i}px; }}" for i in range(20))
        findings = responsive_findings({"src/index.css": css})
        assert findings[0].message.count("→") <= 6


class TestSeverityAndRepair:
    def test_they_never_block_a_run(self):
        findings = responsive_findings(
            {"index.html": "<html></html>", "src/index.css": ".a { width: 1200px; }"}
        )
        assert findings
        assert not findings_have_critical(findings)

    def test_the_repair_pass_is_pointed_at_the_offending_file(self):
        findings = responsive_findings({"src/styles/products.css": ".b { width: 980px; }"})
        assert repair_focus_paths(findings) == ["src/styles/products.css"]
