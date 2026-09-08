"""Outbound URL guard: only fetch user-supplied URLs whose resolved address is a
public host, refusing private / loopback / link-local / reserved / cloud-metadata
targets.

Used by every path that fetches a URL the user controls (website screenshot
capture, image markers). Validation happens *after* DNS resolution, and is
repeated on every redirect/hop, so a public hostname that later resolves or
redirects to an internal address is refused too.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

from app.config import get_settings
from app.services.llm import RodiumError

# Cloud-metadata endpoints (defence in depth on top of the range checks below,
# which already cover 169.254.0.0/16 as link-local). Kept explicit so the intent
# is obvious and so oddballs outside the ranges are still caught.
_METADATA_IPS = frozenset(
    {
        "169.254.169.254",  # AWS / GCP / Azure IMDS
        "100.100.100.200",  # Alibaba Cloud
        "192.0.0.192",  # Oracle Cloud
        "fd00:ec2::254",  # AWS IMDS over IPv6
    }
)

_ALLOWED_SCHEMES = frozenset({"http", "https"})


class BlockedURLError(RodiumError):
    """A user-supplied URL was refused by the outbound URL guard."""

    def __init__(self, message: str = "This URL is not allowed."):
        super().__init__(message, None, "blocked_url")


def _ip_is_blocked(ip: ipaddress._BaseAddress) -> bool:
    """True if `ip` points at a non-public / metadata destination."""
    # Normalise IPv4-mapped IPv6 (::ffff:a.b.c.d) to the underlying IPv4 so a
    # mapped private/metadata address can't slip through the v6 checks.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped

    if str(ip) in _METADATA_IPS:
        return True

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return True

    # IPv6 site-local (fec0::/10, deprecated) is covered by is_reserved on some
    # Python versions but not all; check explicitly.
    return bool(isinstance(ip, ipaddress.IPv6Address) and ip.is_site_local)


def _resolve_ips(host: str, port: int) -> list[str]:
    """All IPs `host` resolves to. Raises on failure (caller fails closed)."""
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    return [info[4][0] for info in infos]


def validate_public_url(url: str) -> None:
    """Raise BlockedURLError unless `url` is a public http(s) destination.

    Rejects: non-http(s) schemes, missing host, embedded credentials (userinfo),
    and any host that resolves (or literally is) a private/loopback/link-local/
    reserved/multicast/unspecified IP or a known cloud-metadata endpoint.

    Fails closed: DNS resolution failure is treated as blocked.
    """
    settings = None
    try:
        settings = get_settings()
    except Exception:  # pragma: no cover - config must load, but never open up on error
        settings = None
    if settings is not None and getattr(settings, "url_fetch_allow_private", False):
        return

    parsed = urlparse(url or "")

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise BlockedURLError("Only http(s) URLs are allowed.")

    if parsed.username or parsed.password:
        raise BlockedURLError("URLs with embedded credentials are not allowed.")

    host = parsed.hostname
    if not host:
        raise BlockedURLError("URL has no host.")

    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)

    # A literal IP in the URL is validated directly (getaddrinfo would echo it
    # back, but this avoids relying on resolver behaviour for literals).
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if _ip_is_blocked(literal):
            raise BlockedURLError()
        return

    try:
        resolved = _resolve_ips(host, port)
    except Exception as exc:
        raise BlockedURLError("Could not resolve host.") from exc

    if not resolved:
        raise BlockedURLError("Could not resolve host.")

    for raw in resolved:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            # An address the stdlib can't parse is not something we'll trust.
            raise BlockedURLError() from None
        if _ip_is_blocked(ip):
            raise BlockedURLError()


async def validate_public_url_async(url: str) -> None:
    """Async wrapper — getaddrinfo is blocking, so run it off the event loop."""
    await asyncio.to_thread(validate_public_url, url)
