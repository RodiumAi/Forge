"""The closed package manifest is the single source shared by three consumers.

The AST allowlist, the browser import map served in the runner shell, and the
JS import-map builder all derive from `runtime/packages.json`. When they drifted,
a package passed write-time validation and still failed to resolve at runtime.
"""

from app.runtime_manifest import (
    FORBIDDEN_BACKEND_PACKAGES,
    allowed_packages,
    browser_import_map,
    browser_packages,
    is_relative_or_alias,
    package_version,
)
from app.services.import_validator import validate_write_content


class TestManifest:
    def test_browser_packages_are_a_subset_of_the_allowlist(self):
        assert browser_packages() <= set(allowed_packages())

    def test_every_browser_package_is_in_the_import_map(self):
        mapped = {
            k.split("/")[0] if not k.startswith("@") else "/".join(k.split("/")[:2])
            for k in browser_import_map()
        }
        assert browser_packages() <= mapped

    def test_versions_are_caret_pinned(self):
        assert all(v.startswith("^") for v in allowed_packages().values())

    def test_import_map_urls_carry_the_pinned_version(self):
        url = browser_import_map()["react"]
        assert f"react@{package_version('react').lstrip('^')}" in url

    def test_react_dependent_packages_pin_their_peer(self):
        # esm.sh otherwise resolves a second React copy and hooks explode.
        assert "deps=react@" in browser_import_map()["lucide-react"]

    def test_subpaths_are_exposed(self):
        assert "react-dom/client" in browser_import_map()

    def test_unknown_package_has_no_version(self):
        assert package_version("left-pad") is None


class TestRelativeDetection:
    def test_recognises_relative_and_aliased_specifiers(self):
        for spec in ["./a", "../a", "/a", "@/lib/a"]:
            assert is_relative_or_alias(spec)

    def test_bare_packages_are_not_relative(self):
        assert not is_relative_or_alias("react")


class TestImportValidation:
    def test_accepts_allowed_packages(self):
        source = 'import { motion } from "framer-motion";\nimport Chart from "recharts";'
        assert validate_write_content("src/App.tsx", source) == []

    def test_accepts_relative_imports(self):
        assert validate_write_content("src/App.tsx", 'import x from "./x";') == []

    def test_rejects_node_builtins(self):
        violations = validate_write_content("src/App.tsx", 'import fs from "fs";')
        assert [v.specifier for v in violations] == ["fs"]

    def test_rejects_unknown_packages(self):
        violations = validate_write_content("src/App.tsx", 'import x from "left-pad-9000";')
        assert violations[0].code == "BUILD_FORBIDDEN_IMPORT"

    def test_names_backend_sdks_explicitly(self):
        # A generic "unknown package" gave the repair pass nothing to act on.
        source = 'import { createClient } from "@supabase/supabase-js";'
        violations = validate_write_content("src/App.tsx", source)
        assert violations[0].code == "BACKEND_SDK_FORBIDDEN"
        assert "frontend-only" in violations[0].as_dict()["message"]

    def test_backend_sdks_are_absent_from_the_allowlist(self):
        allowed = set(allowed_packages())
        assert not (allowed & set(FORBIDDEN_BACKEND_PACKAGES))


class TestRunnerShell:
    def test_shell_embeds_the_generated_import_map_and_the_bridge(self):
        from app.services.preview_babel import render_runner_shell

        html = render_runner_shell()
        assert "./bridge.js" in html
        assert "./runner.js" in html
        assert "__FORGE_PARENT_ORIGINS" in html
        # A hand-written copy of this map used to live in a static index.html.
        for package in ("recharts", "framer-motion", "react-hook-form"):
            assert package in html
