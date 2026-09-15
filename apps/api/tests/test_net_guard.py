"""Outbound URL guard: user-supplied URLs must not reach private / metadata targets.

DNS is monkeypatched so tests are hermetic (no real resolution) and so we can
model a public hostname that resolves to an internal IP — and a DNS-rebinding
attacker that answers differently on the second lookup.
"""

from __future__ import annotations

import asyncio
import socket

import httpx
import pytest

from app.config import clear_settings_cache
from app.services import attachments
from app.services.net_guard import (
    BlockedURLError,
    ValidatedTarget,
    resolve_and_validate,
    validate_public_url,
)


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


def test_resolve_and_validate_pins_first_public_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    target = resolve_and_validate("https://example.com:8443/a/b?q=1")
    assert isinstance(target, ValidatedTarget)
    assert target.ip == "93.184.216.34"
    assert target.host == "example.com"
    assert target.port == 8443
    assert target.host_header == "example.com:8443"
    assert target.pinned_url.startswith("https://93.184.216.34:8443/")
    assert "example.com" not in target.pinned_url.split("/")[2]


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


def test_fetch_url_connects_to_pinned_ip_not_hostname(monkeypatch):
    """The GET URL must use the validated IP — never the original hostname."""
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    seen: list[tuple[str, dict | None, dict | None]] = []

    async def fake_get(self, url, **kwargs):
        seen.append((str(url), kwargs.get("headers"), kwargs.get("extensions")))
        return httpx.Response(
            status_code=200,
            content=b"\x89PNG",
            headers={"content-type": "image/png"},
            request=httpx.Request("GET", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    result = asyncio.run(attachments._fetch_url("http://example.com/img.png"))
    assert result is not None
    assert result[0] == b"\x89PNG"
    assert len(seen) == 1
    get_url, headers, _ext = seen[0]
    assert "93.184.216.34" in get_url
    assert "example.com" not in get_url.split("/")[2]
    assert headers is not None
    assert headers.get("Host") == "example.com"


def test_fetch_url_immune_to_dns_rebinding(monkeypatch):
    """Second DNS answer must not affect the TCP target (classic rebinding)."""
    calls = {"n": 0}

    def rebind(host, port, *args, **kwargs):
        calls["n"] += 1
        # First answer (guard): public. Later answers would be loopback —
        # production httpx would have used those without pinning.
        ip = "93.184.216.34" if calls["n"] == 1 else "127.0.0.1"
        family = socket.AF_INET
        return [(family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (ip, port))]

    monkeypatch.setattr(socket, "getaddrinfo", rebind)
    seen_urls: list[str] = []

    async def fake_get(self, url, **kwargs):
        seen_urls.append(str(url))
        return httpx.Response(
            status_code=200,
            content=b"SSRF-INTERNAL-PROOF",
            headers={"content-type": "image/png"},
            request=httpx.Request("GET", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    result = asyncio.run(attachments._fetch_url("http://rebind.attacker.example/x.png"))
    assert result is not None
    assert result[0] == b"SSRF-INTERNAL-PROOF"
    assert calls["n"] == 1, "DNS must be consulted once per hop, then pinned"
    assert "93.184.216.34" in seen_urls[0]
    assert "127.0.0.1" not in seen_urls[0]


def test_fetch_url_https_sets_sni_hostname_extension(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    seen_ext: list[dict | None] = []

    async def fake_get(self, url, **kwargs):
        seen_ext.append(kwargs.get("extensions"))
        return httpx.Response(
            status_code=200,
            content=b"x",
            headers={"content-type": "image/png"},
            request=httpx.Request("GET", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert asyncio.run(attachments._fetch_url("https://example.com/a.png")) is not None
    assert seen_ext[0] == {"sni_hostname": "example.com"}
