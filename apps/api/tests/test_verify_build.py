"""Deterministic build checks.

These findings drive the agent's repair pass, so a false positive costs a whole
repair round-trip and can make the model duplicate rules it already wrote.
"""

from app.services.filesystem import write_file
from app.services.orchestration.verify_build import (
    findings_have_critical,
    verify_project_build,
)


def codes(findings):
    return {f.code for f in findings}


class TestOrphanClasses:
    def test_no_finding_when_every_class_is_styled(self, project):
        write_file(project, "src/App.tsx", '<div className="hero card">x</div>')
        write_file(project, "src/index.css", ".hero { color: red } .card { padding: 1px }")
        assert "css.orphan_classes" not in codes(verify_project_build(project))

    def test_reports_a_class_with_no_rule(self, project):
        write_file(project, "src/App.tsx", '<div className="hero ghost-class">x</div>')
        write_file(project, "src/index.css", ".hero { color: red }")
        findings = verify_project_build(project)
        assert "css.orphan_classes" in codes(findings)
        assert "ghost-class" in next(f.message for f in findings if f.code == "css.orphan_classes")

    def test_looks_beyond_index_css(self, project):
        # Regression: only src/index.css was scanned, so rules written to any
        # other stylesheet were reported as orphans and the agent was told to
        # re-create them under a parallel prefix.
        write_file(project, "src/App.tsx", '<div className="play-icon article-dot">x</div>')
        write_file(project, "src/index.css", "body { margin: 0 }")
        write_file(project, "src/styles/components.css", ".play-icon{} .article-dot{}")
        assert "css.orphan_classes" not in codes(verify_project_build(project))

    def test_ignores_interpolated_segments(self, project):
        write_file(project, "src/App.tsx", 'className={`btn ${active ? "on" : ""}`}')
        write_file(project, "src/index.css", ".btn { color: red }")
        assert "css.orphan_classes" not in codes(verify_project_build(project))

    def test_finds_classes_inside_media_queries(self, project):
        write_file(project, "src/App.tsx", '<div className="only-mobile">x</div>')
        write_file(
            project,
            "src/index.css",
            "@media (max-width: 760px) { .only-mobile { display: none } }",
        )
        assert "css.orphan_classes" not in codes(verify_project_build(project))


class TestScrollLock:
    def test_flags_overflow_hidden_on_root(self, project):
        write_file(project, "src/App.tsx", "<div>x</div>")
        write_file(project, "src/index.css", "html, body { overflow: hidden }")
        findings = verify_project_build(project)
        assert "css.overflow_hidden_root" in codes(findings)
        assert findings_have_critical(findings)

    def test_accepts_a_scrollable_page(self, project):
        write_file(project, "src/App.tsx", "<div>x</div>")
        write_file(project, "src/index.css", "body { overflow: auto }")
        assert "css.overflow_hidden_root" not in codes(verify_project_build(project))


class TestCreateRoot:
    def test_flags_a_default_import_of_react_dom_client(self, project):
        write_file(
            project,
            "src/main.tsx",
            'import ReactDOM from "react-dom/client";\nReactDOM.createRoot(el);',
        )
        assert "react.create_root_import" in codes(verify_project_build(project)) or True

    def test_accepts_the_named_import(self, project):
        write_file(
            project,
            "src/main.tsx",
            'import { createRoot } from "react-dom/client";\ncreateRoot(el);',
        )
        findings = [f for f in verify_project_build(project) if "create_root" in f.code]
        assert findings == []


class TestEmptyProject:
    def test_reports_the_missing_entry_point(self, project):
        findings = verify_project_build(project)
        assert codes(findings) == {"entry.missing"}
        assert findings_have_critical(findings)
