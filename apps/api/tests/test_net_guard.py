"""Outbound URL guard: user-supplied URLs must not reach private / metadata targets.

DNS is monkeypatched so tests are hermetic (no real resolution) and so we can
model a public hostname that resolves to an internal IP.
"""

from __future__ import annotations

import asyncio
import socket

import httpx
import pytest

from app.config import clear_settings_cache
from app.services import attachments
from app.services.net_guard import BlockedURLError, validate_public_url


def _fake_getaddrinfo(ip: str):
    """Return a getaddrinfo stub that resolves every host to `ip`."""

    def _resolver(host, port, *args, **kwargs):
        family = socket.AF_INET6 if ":" in ip else socket.AF_INET
        sockaddr = (ip, port, 0, 0) if family == socket.AF_INET6 else (ip, port)
        return [(family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", sockaddr)]

    return _resolver


@pytest.fixture(autouse=True)
def _guard_enabled(monkeypatch):
    # Guard is default-on; make sure no env leaves it disabled during tests.
    monkeypatch.setenv("URL_FETCH_ALLOW_PRIVATE", "false")
    clear_settings_cache()
    yield
    clear_settings_cache()


BLOCKED_LITERALS = [
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::ffff:169.254.169.254]/",
    "http://0.0.0.0/",
    "http://100.100.100.200/",
]


@pytest.mark.parametrize("url", BLOCKED_LITERALS)
def test_blocks_private_and_metadata_literals(url):
    with pytest.raises(BlockedURLError):
        validate_public_url(url)


def test_blocks_non_http_schemes():
    for url in ("file:///etc/passwd", "gopher://x/", "ftp://host/x"):
        with pytest.raises(BlockedURLError):
            validate_public_url(url)


def test_blocks_userinfo():
    with pytest.raises(BlockedURLError):
        validate_public_url("http://user:pass@example.com/")


def test_blocks_missing_host():
    with pytest.raises(BlockedURLError):
        validate_public_url("http:///path")


def test_blocks_public_host_resolving_to_private(monkeypatch):
    # Public-looking hostname that resolves to an internal IP.
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("10.1.2.3"))
    with pytest.raises(BlockedURLError):
        validate_public_url("http://totally-legit.example.com/")


def test_blocks_when_resolution_fails(monkeypatch):
    def _boom(*args, **kwargs):
        raise socket.gaierror("nope")

    monkeypatch.setattr(socket, "getaddrinfo", _boom)
    with pytest.raises(BlockedURLError):
        validate_public_url("http://example.com/")


def test_allows_public_host(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    # Should not raise.
    validate_public_url("https://example.com/page")


def test_allow_private_setting_bypasses(monkeypatch):
    monkeypatch.setenv("URL_FETCH_ALLOW_PRIVATE", "true")
    clear_settings_cache()
    try:
        validate_public_url("http://127.0.0.1:8000/")  # should not raise
    finally:
        clear_settings_cache()


# --- sink: attachments._fetch_url --------------------------------------------


def test_fetch_url_refuses_private(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("10.0.0.9"))

    async def _no_get(self, url, **kwargs):  # pragma: no cover - must never run
        raise AssertionError("network was reached for a blocked URL")

    monkeypatch.setattr(httpx.AsyncClient, "get", _no_get)
    assert asyncio.run(attachments._fetch_url("http://internal.example.com/img.png")) is None


def test_fetch_url_refuses_redirect_to_metadata(monkeypatch):
    # Initial host is public; it 302s to the metadata IP, which must be refused.
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            status_code=302,
            headers={"location": "http://169.254.169.254/latest/meta-data/"},
            request=httpx.Request("GET", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert asyncio.run(attachments._fetch_url("http://example.com/img.png")) is None
