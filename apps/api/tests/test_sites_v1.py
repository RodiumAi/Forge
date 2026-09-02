"""Sites gateway host resolution."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.sites_v1 import clear_resolve_cache

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_resolve_cache()
    yield
    clear_resolve_cache()


def test_resolve_host_json():
    with patch("app.routers.sites_v1._lookup_slug", return_value="acme"):
        res = client.get(
            "/v1/resolve-host",
            headers={"X-Rodium-Forwarded-Host": "www.client.com"},
        )
    assert res.status_code == 200
    assert res.json() == {"slug": "acme", "bucket_prefix": "acme/"}


def test_resolve_host_unknown():
    with patch("app.routers.sites_v1._lookup_slug", return_value=None):
        res = client.get(
            "/v1/resolve-host",
            headers={"X-Rodium-Forwarded-Host": "unknown.example.com"},
        )
    assert res.status_code == 404


def test_authorize_host_sets_slug_header():
    with patch("app.routers.sites_v1._lookup_slug", return_value="acme"):
        res = client.get(
            "/v1/authorize-host",
            headers={"X-Rodium-Forwarded-Host": "www.client.com"},
        )
    assert res.status_code == 200
    assert res.headers.get("x-site-slug") == "acme"


def test_authorize_host_unknown_404():
    with patch("app.routers.sites_v1._lookup_slug", return_value=None):
        res = client.get(
            "/v1/authorize-host",
            headers={"X-Rodium-Forwarded-Host": "nope.example.com"},
        )
    assert res.status_code == 404


def test_resolve_host_missing_header():
    res = client.get("/v1/resolve-host")
    assert res.status_code == 400
