"""Upload endpoint error handling."""

import ast
from pathlib import Path


def test_upload_project_image_does_not_catch_provider_factory():
    source = Path(__file__).resolve().parents[1] / "app" / "routers" / "files.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        if isinstance(node.type, ast.Name) and node.type.id == "provider_not_configured":
            raise AssertionError("upload must catch SitesError, not provider_not_configured() factory")
