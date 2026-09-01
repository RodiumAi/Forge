"""Shared fixtures.

Every test runs against a throwaway projects root so the real workspace under
`data/projects` is never touched.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# `apps/api` on the path so `import app...` works without an installed package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENVIRONMENT", "test")


@pytest.fixture
def project(tmp_path_factory, monkeypatch):
    """An isolated project id whose files live in a temp directory."""
    root = tmp_path_factory.mktemp("projects")
    monkeypatch.setenv("PROJECTS_ROOT", str(root))

    from app.config import clear_settings_cache

    clear_settings_cache()
    # `filesystem` binds settings lazily through get_settings(), so clearing the
    # cache is enough for the new root to take effect.
    yield "proj"
    clear_settings_cache()


@pytest.fixture
def object_store_host(monkeypatch):
    """Pretend the instance serves its object store on a known host."""
    monkeypatch.setenv("OBJECT_STORE_PUBLIC_ENDPOINT", "http://localhost:9000")

    from app.config import clear_settings_cache

    clear_settings_cache()
    yield "http://localhost:9000"
    clear_settings_cache()


@pytest.fixture
def tmp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)
