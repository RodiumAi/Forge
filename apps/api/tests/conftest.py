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


@pytest.fixture(autouse=True)
def isolated_rate_limits(monkeypatch):
    """Keep rate limiting deterministic and per-test.

    Two problems otherwise: a developer with the stack running has Redis on
    localhost, so counters survive between runs and tests start failing on the
    second invocation; and within one run every test shares the same client IP,
    so unrelated tests eat each other's budget. Force the in-process counter and
    clear it around each test.
    """
    from app.services import rate_limit

    monkeypatch.setattr(rate_limit, "_incr_redis", lambda *_a, **_k: None)
    rate_limit._local_hits.clear()
    yield
    rate_limit._local_hits.clear()


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
