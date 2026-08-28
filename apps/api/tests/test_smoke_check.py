"""Post-plan smoke transform: compile exactly what the runner would mount.

curl-ing /draft always answers 200 (it is the shell HTML); the app itself
mounts client-side. The only server-side truth about a blank preview is the
transform pipeline itself — same Babel, same resolution, same import map.
"""

import shutil

import pytest

from app.services.filesystem import write_file
from app.services.orchestration.smoke_check import smoke_transform_findings
from app.services.scaffold import scaffold_vite_react

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node not available")


def _run(coro):
    import asyncio

    return asyncio.run(coro)


@needs_node
class TestSmokeTransform:
    def test_a_healthy_scaffold_compiles_clean(self, project):
        scaffold_vite_react(project, "Demo")
        assert _run(smoke_transform_findings(project)) == []

    def test_a_syntax_error_is_a_critical_finding(self, project):
        scaffold_vite_react(project, "Demo")
        write_file(project, "src/App.tsx", "export default function App( { return <div>; }")
        findings = _run(smoke_transform_findings(project))
        assert findings and findings[0].severity == "critical"
        assert findings[0].code == "transform.error"

    def test_a_missing_local_module_is_reported(self, project):
        scaffold_vite_react(project, "Demo")
        write_file(
            project,
            "src/App.tsx",
            'import Ghost from "./components/Ghost";\nexport default function App() { return <Ghost />; }',
        )
        findings = _run(smoke_transform_findings(project))
        assert findings
        assert "MODULE_NOT_FOUND" in findings[0].message

    def test_an_undeclared_package_is_reported(self, project):
        scaffold_vite_react(project, "Demo")
        # The import must be USED: Babel's TypeScript preset elides unused
        # imports (possibly type-only), and an elided import cannot break
        # the preview — so only used imports are validated.
        write_file(
            project,
            "src/App.tsx",
            'import confetti from "canvas-confetti";\n'
            "export default function App() { confetti(); return null; }",
        )
        findings = _run(smoke_transform_findings(project))
        assert findings
        assert "IMPORT_NOT_IN_MANIFEST" in findings[0].message

    def test_a_declared_project_dependency_compiles(self, project):
        import json

        scaffold_vite_react(project, "Demo")
        write_file(
            project,
            "package.json",
            json.dumps({"name": "demo", "dependencies": {"canvas-confetti": "^1.9.0"}}),
        )
        write_file(
            project,
            "src/App.tsx",
            'import confetti from "canvas-confetti";\n'
            "export default function App() { confetti(); return null; }",
        )
        assert _run(smoke_transform_findings(project)) == []


class TestMissingEntry:
    def test_no_entry_defers_to_verify_build(self, project):
        write_file(project, "src/index.css", "body{}")
        assert _run(smoke_transform_findings(project)) == []
