"""Dynamic per-project dependencies — declare in package.json, import instantly.

The manifest used to be a closed set: the agent could not use any package
outside it, and the hardcoded ALLOWED_BARE list in the runner had already
drifted from the manifest. Projects now extend the import map and the AST
allowlist with their own package.json dependencies; base pins win and backend
SDKs stay forbidden no matter what package.json claims.
"""

import json
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services.apply_writes import apply_validated_writes
from app.services.filesystem import write_file
from app.services.project_packages import (
    extra_import_map,
    project_allowed_packages,
    project_dependencies,
    sanitize_batch_dependencies,
)

client = TestClient(app)


def _pkg(project, deps: dict) -> None:
    write_file(project, "package.json", json.dumps({"name": "p", "dependencies": deps}))


class TestProjectDependencies:
    def test_declared_deps_are_picked_up(self, project):
        _pkg(project, {"canvas-confetti": "^1.9.0", "three": "0.160.0"})
        assert project_dependencies(project) == {"canvas-confetti": "^1.9.0", "three": "0.160.0"}

    def test_base_manifest_pins_win(self, project):
        _pkg(project, {"react": "^19.0.0", "canvas-confetti": "^1.9.0"})
        deps = project_dependencies(project)
        assert "react" not in deps, "a project must not downgrade/upgrade curated pins"

    def test_backend_sdks_are_dropped_regardless_of_declaration(self, project):
        _pkg(project, {"stripe": "^14.0.0", "firebase": "^11.0.0", "canvas-confetti": "^1.9.0"})
        deps = project_dependencies(project)
        assert set(deps) == {"canvas-confetti"}

    def test_unresolvable_specs_are_dropped(self, project):
        _pkg(project, {"leftpad": "git+https://evil.example/x.git", "ok": "file:../x", "clsx2": "^2.1.0"})
        assert set(project_dependencies(project)) == {"clsx2"}

    def test_missing_or_broken_package_json_is_empty(self, project):
        assert project_dependencies(project) == {}
        write_file(project, "package.json", "{not json")
        assert project_dependencies(project) == {}


class TestExtraImportMap:
    def test_exact_and_prefix_entries_with_react_pinned(self, project):
        _pkg(project, {"canvas-confetti": "^1.9.0"})
        imports = extra_import_map(project)
        assert imports["canvas-confetti"].startswith("https://esm.sh/canvas-confetti@^1.9.0?deps=react@")
        # Trailing-slash prefix: subpath imports resolve generically.
        assert imports["canvas-confetti/"].startswith("https://esm.sh/canvas-confetti@^1.9.0/")

    def test_allowed_packages_union(self, project):
        _pkg(project, {"three": "^0.160.0"})
        allow = project_allowed_packages(project)
        assert "react" in allow and "three" in allow


class TestBatchDeclaration:
    class _W:
        def __init__(self, path, content):
            self.path = path
            self.content = content

    def test_dep_declared_and_imported_in_the_same_batch_is_accepted(self, project):
        _pkg(project, {})
        writes = [
            self._W("package.json", json.dumps({"dependencies": {"canvas-confetti": "^1.9.0"}})),
            self._W("src/App.tsx", 'import confetti from "canvas-confetti";\nexport default () => null;'),
        ]
        applied, violations = apply_validated_writes(project, writes)
        assert violations == []
        assert {a["path"] for a in applied} == {"package.json", "src/App.tsx"}

    def test_undeclared_package_is_still_rejected(self, project):
        _pkg(project, {})
        writes = [
            self._W("src/App.tsx", 'import confetti from "canvas-confetti";\nexport default () => null;')
        ]
        applied, violations = apply_validated_writes(project, writes)
        assert applied == []
        assert violations and violations[0]["specifier"] == "canvas-confetti"

    def test_batch_package_json_cannot_smuggle_backend_sdks(self):
        deps = sanitize_batch_dependencies(json.dumps({"dependencies": {"stripe": "^14.0.0"}}))
        assert deps == {}


class TestCssShrinkGuard:
    class _W:
        def __init__(self, path, content):
            self.path = path
            self.content = content

    def test_rejects_mid_plan_css_rewrite_that_drops_most_rules(self, project):
        foundation = ".navbar { position: sticky; }\n.hero { min-height: 80vh; }\n" + (
            ".section { padding: 2rem; }\n" * 200
        )
        write_file(project, "src/index.css", foundation)
        writes = [self._W("src/index.css", ".new-section { color: red; }\n")]
        applied, violations = apply_validated_writes(project, writes)
        assert applied == []
        assert violations and violations[0]["code"] == "CSS_SHRINK_REJECTED"

    def test_allows_css_growth(self, project):
        write_file(project, "src/index.css", ".navbar { position: sticky; }\n" * 100)
        writes = [
            self._W(
                "src/index.css",
                ".navbar { position: sticky; }\n" * 100 + ".gallery { display: grid; }\n",
            )
        ]
        applied, violations = apply_validated_writes(project, writes)
        assert violations == []
        assert applied and applied[0]["path"] == "src/index.css"


class TestRunnerShellPerProject:
    def test_shell_import_map_carries_the_project_deps(self, project, monkeypatch):
        # The /runner/?p= route resolves a UUID project id under PROJECTS_ROOT.
        pid = str(uuid.uuid4())
        write_file(pid, "package.json", json.dumps({"dependencies": {"canvas-confetti": "^1.9.0"}}))
        html = client.get(f"/runner/?p={pid}").text
        assert "canvas-confetti" in html
        assert "esm.sh/canvas-confetti@^1.9.0" in html

    def test_shell_without_project_stays_base_only(self):
        html = client.get("/runner/").text
        assert "canvas-confetti" not in html

    def test_bad_project_id_falls_back_to_base(self):
        res = client.get("/runner/?p=not-a-uuid")
        assert res.status_code == 200
        assert "react" in res.text
