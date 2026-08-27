"""The exported ZIP must be a complete, runnable Vite project.

Inside Forge the app runs in the Babel/ESM runner: no scripts, no Vite, an
esm.sh import map in index.html and a `/src/main.js` entry that only exists
after publish. A raw copy therefore failed `npm run build` ("Missing script")
while the generated README promised it worked. The export now normalises the
frontend; these tests pin that contract.
"""

import io
import json
import zipfile

import pytest

from app.services.export_project import build_export_zip
from app.services.scaffold import scaffold_vite_react


@pytest.fixture
def exported(project):
    scaffold_vite_react(project, "Portfolio")
    data, filename = build_export_zip(project_id=project, project_name="Portfolio", locale="en")
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        yield {name: zf.read(name) for name in zf.namelist()}, filename


class TestPackageJson:
    def test_has_the_scripts_the_readme_promises(self, exported):
        files, _ = exported
        pkg = json.loads(files["package.json"])
        for script in ("dev", "build", "preview"):
            assert script in pkg["scripts"], f"README tells users to run `npm run {script}`"

    def test_ships_the_vite_toolchain(self, exported):
        files, _ = exported
        pkg = json.loads(files["package.json"])
        dev = pkg["devDependencies"]
        for name in ("vite", "@vitejs/plugin-react", "typescript"):
            assert name in dev
            assert dev[name] != "latest", "versions must come from the runtime manifest"

    def test_keeps_the_project_dependencies(self, exported):
        files, _ = exported
        pkg = json.loads(files["package.json"])
        assert "react" in pkg["dependencies"]
        assert "lucide-react" in pkg["dependencies"]


class TestIndexHtml:
    def test_no_esm_sh_import_map(self, exported):
        files, _ = exported
        html = files["index.html"].decode("utf-8")
        assert "importmap" not in html, "an import map would fight Vite's bundling (two React copies)"
        assert "esm.sh" not in html

    def test_entry_is_the_real_source_file(self, exported):
        files, _ = exported
        html = files["index.html"].decode("utf-8")
        assert 'src="/src/main.tsx"' in html
        assert "/src/main.js" not in html, "main.js only exists after the publish rewrite"

    def test_keeps_the_seo_metadata(self, exported):
        files, _ = exported
        html = files["index.html"].decode("utf-8")
        assert 'property="og:title"' in html


class TestCompleteness:
    def test_vite_config_and_tsconfig_present(self, exported):
        files, _ = exported
        assert "vite.config.ts" in files
        assert "tsconfig.json" in files

    def test_source_and_assets_are_included(self, exported):
        files, _ = exported
        assert "src/main.tsx" in files
        assert "src/App.tsx" in files
        assert "src/index.css" in files
        assert "public/favicon.png" in files
        assert "README.md" in files

    def test_forge_internals_are_excluded(self, exported):
        files, _ = exported
        for internal in ("forge.json", "AI_RULES.md", "preview.html"):
            assert internal not in files
