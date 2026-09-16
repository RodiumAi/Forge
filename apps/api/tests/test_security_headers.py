from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

GENERIC_HEADERS = {
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    ),
}


def test_api_adds_non_blocking_security_headers():
    response = client.get("/health")

    assert response.status_code == 200
    for name, value in GENERIC_HEADERS.items():
        assert response.headers[name] == value
    assert "content-security-policy" not in response.headers
    assert "x-frame-options" not in response.headers


def test_runner_csp_allows_only_configured_frontend_ancestors():
    response = client.get("/runner/")

    assert response.status_code == 200
    csp = response.headers["content-security-policy"]
    assert "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://esm.sh" in csp
    assert "connect-src * data: blob:" in csp
    assert "frame-ancestors http://localhost:3100 http://127.0.0.1:3100" in csp
    assert "x-frame-options" not in response.headers


def test_sites_gateway_uses_report_only_csp_and_non_blocking_headers():
    caddyfile = (
        Path(__file__).resolve().parents[3] / "infra" / "aws" / "sites-gateway" / "Caddyfile"
    ).read_text(encoding="utf-8")

    assert 'Strict-Transport-Security "max-age=31536000"' in caddyfile
    assert 'X-Content-Type-Options "nosniff"' in caddyfile
    assert 'Referrer-Policy "strict-origin-when-cross-origin"' in caddyfile
    assert "Content-Security-Policy-Report-Only" in caddyfile
    assert "\n\t\tContent-Security-Policy " not in caddyfile
    assert "object-src 'none'" in caddyfile
    assert "frame-ancestors 'self'" in caddyfile
