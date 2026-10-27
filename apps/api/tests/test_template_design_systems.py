"""The six design system starter kits: valid, contrast-checked, forkable."""

from __future__ import annotations

import json

import pytest

from app.config import get_settings
from app.contracts.forge_design import validate_design_system
from app.services.design_system.tokens import colors_of, contrast_pairs
from app.services.templates import fork_template, get_template, list_templates


def _kits():
    return list_templates(kind="design_system")


def test_six_kits():
    assert len(_kits()) == 6


@pytest.mark.parametrize("kit", _kits(), ids=lambda k: k.id)
def test_kit_is_a_valid_design_system_with_passing_contrast(kit):
    document = json.loads((kit.path / "design-system.json").read_text(encoding="utf-8"))
    validate_design_system(document)
    assert all(row["pass"] for row in contrast_pairs(colors_of(document))), kit.id
    assert (kit.path / document["logo"]["src"]).is_file()
    assert (kit.path / "preview.html").is_file() and (kit.path / "DESIGN.md").is_file()
    for path in kit.path.rglob("*"):
        if path.is_file() and path.suffix in (".json", ".md", ".html", ".svg"):
            assert "—" not in path.read_text(encoding="utf-8"), path


def test_fork_names_the_design_system_after_the_project(project):
    meta = fork_template("design-system-luxe", project, "Atelier Nour")
    assert meta.kind == "design_system"
    root = get_settings().projects_path / project
    document = json.loads((root / "design-system.json").read_text(encoding="utf-8"))
    assert document["name"] == "Atelier Nour"
    assert "Atelier Nour" in (root / "DESIGN.md").read_text(encoding="utf-8")
    assert "Atelier Nour" in (root / "public/brand/logo.svg").read_text(encoding="utf-8")
    assert not (root / "template.json").exists() and not (root / "preview.html").exists()
    assert json.loads((root / ".forge/template.json").read_text(encoding="utf-8"))["kind"] == "design_system"


def test_catalogue_entry():
    meta = get_template("design-system-sante")
    assert meta is not None and meta.title_fr == "Santé" and meta.accent and meta.bg
