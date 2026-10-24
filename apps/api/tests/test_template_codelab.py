"""Codelab kits (``kind: "codelab"``): documents rendered by the codelab player.

Every kit must validate against the contract, list exactly its step files,
keep its duration in sync with its steps, ship the downloads it declares, use
only the Markdown extensions the player knows, stay small and in French, and
fork into a valid codelab project.
"""

from __future__ import annotations

import json
import re

import pytest

from app.config import clear_settings_cache, get_settings
from app.contracts.forge_design import validate_codelab
from app.services.codelab.files import BLOCKED_EXTENSIONS, list_files, normalize_path
from app.services.templates import fork_template, get_template, list_templates

MAX_KIT_BYTES = 512 * 1024
LONG_DASH = chr(0x2014)
REQUIRED_FILES = ("template.json", "DESIGN.md", "codelab.json", "preview.html")
KNOWN_CONTAINERS = {"tabs", "info", "note", "tip", "success", "warning", "caution", "danger", "error"}


def _kits():
    return list_templates(kind="codelab")


def _codelab(kit) -> dict:
    return json.loads((kit.path / "codelab.json").read_text(encoding="utf-8"))


def test_eight_codelab_kits_are_listed():
    assert len(_kits()) == 8


@pytest.mark.parametrize("kit", _kits(), ids=lambda kit: kit.id)
class TestCodelabKit:
    def test_ships_the_document_files(self, kit):
        assert kit.id.startswith("codelab-")
        for rel in REQUIRED_FILES:
            assert (kit.path / rel).is_file(), f"{kit.id} misses {rel}"
        assert not (kit.path / "package.json").exists()

    def test_codelab_validates_and_lists_its_steps(self, kit):
        data = _codelab(kit)
        codelab = validate_codelab(data)
        assert 5 <= len(codelab.steps) <= 12
        listed = {step.file for step in codelab.steps}
        on_disk = {p.relative_to(kit.path).as_posix() for p in (kit.path / "steps").glob("*.md")}
        assert listed == on_disk
        assert codelab.durationMinutes == sum(step.minutes for step in codelab.steps)
        assert codelab.summary and codelab.learn and codelab.prerequisites

    def test_declared_downloads_exist(self, kit):
        for item in _codelab(kit).get("downloads") or []:
            path = kit.path / item["path"]
            assert path.exists(), f"{kit.id}: {item['path']}"
            if item.get("zip"):
                assert path.is_dir() and any(path.rglob("*"))

    def test_files_follow_the_upload_policy(self, kit):
        root = kit.path / "files"
        for path in root.rglob("*") if root.is_dir() else []:
            if path.is_file():
                rel = path.relative_to(kit.path).as_posix()
                assert normalize_path(rel) == rel
                assert path.suffix.lower() not in BLOCKED_EXTENSIONS

    def test_markdown_uses_known_blocks_and_links(self, kit):
        codelab = _codelab(kit)
        ids = {item["id"] for item in codelab.get("downloads") or []}
        for step in codelab["steps"]:
            text = (kit.path / step["file"]).read_text(encoding="utf-8")
            assert text.startswith("# "), step["file"]
            fences = re.findall(r"^ {0,3}```", text, re.M)
            assert len(fences) % 2 == 0, f"{step['file']}: unbalanced fences"
            for name in re.findall(r"^ {0,3}:{3,}[ \t]*([A-Za-z][\w-]*)", text, re.M):
                assert name.lower() in KNOWN_CONTAINERS, f"{step['file']}: :::{name}"
            opened = len(re.findall(r"^ {0,3}:{3,}[ \t]*[A-Za-z]", text, re.M))
            closed = len(re.findall(r"^ {0,3}:{3,}[ \t]*$", text, re.M))
            assert opened == closed, f"{step['file']}: unclosed container"
            for block in re.findall(r"```download\n(.*?)```", text, re.S):
                for line in filter(None, (line.strip() for line in block.splitlines())):
                    assert line in ids or (kit.path / line).exists(), f"{step['file']}: {line}"
            for path in re.findall(r'download="([^"]+)"', text):
                assert (kit.path / path).is_file(), f"{step['file']}: {path}"
            assert "<" not in re.sub(r"```.*?```", "", text, flags=re.S).replace("<-", ""), step["file"]

    def test_french_typography_and_size(self, kit):
        total = 0
        for path in kit.path.rglob("*"):
            if path.is_file():
                total += path.stat().st_size
                assert LONG_DASH not in path.read_text(encoding="utf-8"), path
        assert total <= MAX_KIT_BYTES
        meta = json.loads((kit.path / "template.json").read_text(encoding="utf-8"))
        assert meta["kind"] == "codelab"
        assert meta["title"]["fr"] and meta["description"]["fr"]

    def test_charter_has_tokens_and_fonts(self, kit):
        md = (kit.path / "DESIGN.md").read_text(encoding="utf-8")
        for token in ("--bg", "--fg", "--accent", "--surface", "--border", "--muted"):
            assert f"`{token}`" in md
        assert "Mono font:" in md


def test_fork_gives_a_valid_codelab_titled_after_the_project(monkeypatch, tmp_path):
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path))
    clear_settings_cache()
    try:
        meta = fork_template("codelab-rest-api", "p1", "Mon API")
        assert meta.kind == "codelab"
        dest = get_settings().projects_path / "p1"
        codelab = validate_codelab(json.loads((dest / "codelab.json").read_text(encoding="utf-8")))
        assert codelab.title == "Mon API"
        assert not (dest / "template.json").exists()
        assert (
            json.loads((dest / ".forge" / "template.json").read_text(encoding="utf-8"))["kind"] == "codelab"
        )
        assert "files/starter/main.py" in {item.path for item in list_files("p1")}
    finally:
        clear_settings_cache()


def test_a_kit_with_a_missing_step_fails_the_fork(monkeypatch, tmp_path):
    import shutil

    from app.services import templates as templates_mod

    root = tmp_path / "templates"
    shutil.copytree(get_template("codelab-data").path, root / "codelab-data")
    (root / "codelab-data" / "steps" / "02-load.md").unlink()
    monkeypatch.setattr(templates_mod, "templates_root", lambda: root)
    monkeypatch.setenv("PROJECTS_ROOT", str(tmp_path / "projects"))
    clear_settings_cache()
    try:
        with pytest.raises(FileNotFoundError):
            fork_template("codelab-data", "p2")
    finally:
        clear_settings_cache()
