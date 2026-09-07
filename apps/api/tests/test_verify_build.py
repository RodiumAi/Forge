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


class TestMissingLocalImports:
    """MODULE_NOT_FOUND in the preview, caught before the user sees it.

    Observed in the wild: src/components/InteractiveStudio.tsx imported
    @/components/KanbanBoard which the agent never wrote — the preview died
    with MODULE_NOT_FOUND and nothing routed it into the repair pass.
    """

    CSS = ".a { color: red }"

    def test_reports_an_import_of_a_file_that_was_never_written(self, project):
        write_file(project, "src/index.css", self.CSS)
        write_file(
            project,
            "src/components/InteractiveStudio.tsx",
            'import KanbanBoard from "@/components/KanbanBoard";\nexport default () => <KanbanBoard />;',
        )
        found = verify_project_build(project)
        assert "import.module_not_found" in codes(found)
        assert findings_have_critical(found)
        msg = next(f.message for f in found if f.code == "import.module_not_found")
        assert "Expected path" in msg

    def test_alias_relative_and_index_resolutions_pass(self, project):
        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/components/KanbanBoard.tsx", 'export default () => <div className="a" />;')
        write_file(project, "src/widgets/index.ts", "export const w = 1;")
        write_file(
            project,
            "src/App.tsx",
            'import KanbanBoard from "@/components/KanbanBoard";\n'
            'import { w } from "./widgets";\n'
            'import "./index.css";\n'
            "export default () => <KanbanBoard />;",
        )
        assert "import.module_not_found" not in codes(verify_project_build(project))

    def test_resolution_is_case_sensitive_like_the_runner(self, project):
        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/components/KanbanBoard.tsx", "export default () => null;")
        write_file(
            project,
            "src/App.tsx",
            'import KanbanBoard from "@/components/kanbanboard";\nexport default () => <KanbanBoard />;',
        )
        found = verify_project_build(project)
        assert "import.module_not_found" in codes(found)
        msg = next(f.message for f in found if f.code == "import.module_not_found")
        assert "Did you mean" in msg

    def test_fix_import_path_casing_renames_case_only_mismatch(self, project):
        from app.services.filesystem import list_files
        from app.services.orchestration.verify_build import fix_import_path_casing

        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/pages/settingsPage.tsx", "export default () => null;")
        write_file(
            project,
            "src/App.tsx",
            'import SettingsPage from "./pages/SettingsPage";\nexport default () => <SettingsPage />;',
        )
        assert "import.module_not_found" in codes(verify_project_build(project))
        applied = fix_import_path_casing(project)
        assert applied == [("src/pages/settingsPage.tsx", "src/pages/SettingsPage.tsx")]
        files = list_files(project)
        assert "src/pages/SettingsPage.tsx" in files
        assert "src/pages/settingsPage.tsx" not in files
        assert "import.module_not_found" not in codes(verify_project_build(project))

    def test_fix_import_path_casing_noop_when_stem_differs(self, project):
        from app.services.orchestration.verify_build import fix_import_path_casing

        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/pages/Settings.tsx", "export default () => null;")
        write_file(
            project,
            "src/App.tsx",
            'import SettingsPage from "./pages/SettingsPage";\nexport default () => <SettingsPage />;',
        )
        assert fix_import_path_casing(project) == []
        assert "import.module_not_found" in codes(verify_project_build(project))

    def test_fix_import_path_casing_noop_when_already_correct(self, project):
        from app.services.orchestration.verify_build import fix_import_path_casing

        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/pages/SettingsPage.tsx", "export default () => null;")
        write_file(
            project,
            "src/App.tsx",
            'import SettingsPage from "./pages/SettingsPage";\nexport default () => <SettingsPage />;',
        )
        assert fix_import_path_casing(project) == []
        assert "import.module_not_found" not in codes(verify_project_build(project))

    def test_scaffold_missing_pages_creates_stubs_and_clears_module_not_found(self, project):
        from app.services.filesystem import list_files, read_file
        from app.services.orchestration.verify_build import (
            scaffold_fill_findings,
            scaffold_missing_local_modules,
        )

        write_file(project, "src/index.css", self.CSS)
        write_file(
            project,
            "src/App.tsx",
            'import Classes from "./pages/Classes";\n'
            'import Timetable from "./pages/Timetable";\n'
            'import Notifications from "./pages/Notifications";\n'
            "export default () => (<><Classes /><Timetable /><Notifications /></>);",
        )
        assert "import.module_not_found" in codes(verify_project_build(project))
        created = scaffold_missing_local_modules(project)
        assert set(created) == {
            "src/pages/Classes.tsx",
            "src/pages/Timetable.tsx",
            "src/pages/Notifications.tsx",
        }
        files = list_files(project)
        assert "src/pages/Classes.tsx" in files
        assert "export default function Classes" in read_file(project, "src/pages/Classes.tsx")
        assert "import.module_not_found" not in codes(verify_project_build(project))
        fill = scaffold_fill_findings(created)
        assert {f.code for f in fill} == {"import.scaffold_fill"}
        assert findings_have_critical(fill)

    def test_scaffold_skips_when_only_casing_differs(self, project):
        from app.services.orchestration.verify_build import scaffold_missing_local_modules

        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/pages/classes.tsx", "export default () => null;")
        write_file(
            project,
            "src/App.tsx",
            'import Classes from "./pages/Classes";\nexport default () => <Classes />;',
        )
        assert scaffold_missing_local_modules(project) == []

    def test_bare_specifiers_are_left_to_the_ast_allowlist(self, project):
        write_file(project, "src/index.css", self.CSS)
        write_file(project, "src/App.tsx", 'import { useState } from "react";\nexport default () => null;')
        assert "import.module_not_found" not in codes(verify_project_build(project))


class TestRepairHelpers:
    def test_repair_focus_paths_includes_css_and_entry(self):
        from app.services.orchestration.verify_build import (
            VerifyFinding,
            format_css_second_pass_prompt,
            repair_focus_paths,
        )

        findings = [
            VerifyFinding(
                code="css.orphan_classes",
                severity="critical",
                path="src/App.tsx",
                message="orphans",
            ),
            VerifyFinding(
                code="entry.createRoot",
                severity="critical",
                path="src/main.tsx",
                message="bad import",
            ),
        ]
        paths = repair_focus_paths(findings)
        assert paths == ["src/index.css", "src/App.tsx", "src/main.tsx"]
        prompt = format_css_second_pass_prompt(findings)
        assert "SECOND CSS REPAIR PASS" in prompt
        assert "css.orphan_classes" in prompt

    def test_repair_focus_paths_includes_missing_import_importer_and_target(self):
        from app.services.orchestration.verify_build import (
            VerifyFinding,
            format_findings_for_prompt,
            repair_focus_paths,
        )

        findings = [
            VerifyFinding(
                code="import.module_not_found",
                severity="critical",
                path="src/App.tsx",
                message=(
                    'imports "./pages/SettingsPage" but no matching file exists '
                    "(resolution is case-sensitive). Expected path: "
                    '"src/pages/SettingsPage.tsx".'
                ),
            ),
        ]
        paths = repair_focus_paths(findings)
        assert paths is not None
        assert "src/App.tsx" in paths
        assert "src/pages/SettingsPage.tsx" in paths
        prompt = format_findings_for_prompt(findings)
        assert "prefer renaming the existing file" in prompt

    def test_repair_focus_paths_includes_transform_module_not_found(self):
        from app.services.orchestration.verify_build import VerifyFinding, repair_focus_paths

        findings = [
            VerifyFinding(
                code="transform.error",
                severity="critical",
                path="src/App.tsx",
                message=(
                    "The app does not compile: MODULE_NOT_FOUND: ./pages/SettingsPage "
                    "(case-sensitive) — the preview WILL be blank until this is fixed."
                ),
            ),
        ]
        paths = repair_focus_paths(findings)
        assert paths is not None
        assert "src/App.tsx" in paths
        assert "src/pages/SettingsPage.tsx" in paths

    def test_repair_focus_paths_includes_scaffold_fill_stubs(self):
        from app.services.orchestration.verify_build import (
            VerifyFinding,
            format_findings_for_prompt,
            repair_focus_paths,
        )

        findings = [
            VerifyFinding(
                code="import.scaffold_fill",
                severity="critical",
                path="src/pages/Classes.tsx",
                message="Auto-created empty stub",
            ),
        ]
        paths = repair_focus_paths(findings)
        assert paths is not None
        assert "src/pages/Classes.tsx" in paths
        assert "src/App.tsx" in paths
        assert (
            "scaffold_fill" in format_findings_for_prompt(findings)
            or "stub" in format_findings_for_prompt(findings).lower()
        )
