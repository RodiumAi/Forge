"""Outbound URL guard: only fetch user-supplied URLs whose resolved address is a
public host, refusing private / loopback / link-local / reserved / cloud-metadata
targets.

Used by every path that fetches a URL the user controls (website screenshot
capture, image markers).

DNS rebinding defence
---------------------
Validating a hostname and then letting httpx/Chromium resolve it again is not
safe: an attacker-controlled nameserver can answer the check with a public IP
and the connect with an internal one. Callers must therefore:

1. ``resolve_and_validate(url)`` — one DNS lookup, every returned IP checked;
2. connect to the **pinned** IP from that result (``ValidatedTarget.pinned_url``),
   keeping the original hostname in ``Host`` / TLS SNI.

``validate_public_url`` remains as a check-only helper for call sites that do
not fetch; fetch paths must use the pin APIs below.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import httpx

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


@dataclass(frozen=True, slots=True)
class ValidatedTarget:
    """A URL whose DNS (or literal IP) has been checked, ready for a pinned fetch.

    ``ip`` is the address the caller MUST connect to — never re-resolve
    ``host`` for the TCP connection.
    """

    url: str
    scheme: str
    host: str
    port: int
    ip: str

    @property
    def host_header(self) -> str:
        default = 443 if self.scheme == "https" else 80
        if self.port != default:
            return f"{self.host}:{self.port}"
        return self.host

    @property
    def pinned_url(self) -> str:
        """Same URL with the validated IP substituted as the authority host."""
        parsed = urlparse(self.url)
        netloc = f"[{self.ip}]:{self.port}" if ":" in self.ip else f"{self.ip}:{self.port}"
        path = parsed.path if parsed.path else "/"
        return urlunparse((self.scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))


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
    # Preserve order but drop duplicates (getaddrinfo often repeats per socktype).
    seen: set[str] = set()
    out: list[str] = []
    for info in infos:
        ip = info[4][0]
        if ip not in seen:
            seen.add(ip)
            out.append(ip)
    return out


def _allow_private() -> bool:
    try:
        settings = get_settings()
    except Exception:  # pragma: no cover - config must load, but never open up on error
        return False
    return bool(getattr(settings, "url_fetch_allow_private", False))


def resolve_and_validate(url: str) -> ValidatedTarget:
    """Resolve `url`, refuse non-public destinations, return a pin-ready target.

    Every address returned by DNS must be public (unless
    ``URL_FETCH_ALLOW_PRIVATE``). The returned ``ip`` is the first validated
    address — callers connect to that IP only.
    """
    allow_private = _allow_private()

    parsed = urlparse(url or "")
    scheme = parsed.scheme.lower()

    if scheme not in _ALLOWED_SCHEMES:
        raise BlockedURLError("Only http(s) URLs are allowed.")

    if parsed.username or parsed.password:
        raise BlockedURLError("URLs with embedded credentials are not allowed.")

    host = parsed.hostname
    if not host:
        raise BlockedURLError("URL has no host.")

    port = parsed.port or (443 if scheme == "https" else 80)

    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None

    if literal is not None:
        if not allow_private and _ip_is_blocked(literal):
            raise BlockedURLError()
        return ValidatedTarget(url=url, scheme=scheme, host=host, port=port, ip=str(literal))

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
            raise BlockedURLError() from None
        if not allow_private and _ip_is_blocked(ip):
            raise BlockedURLError()

    return ValidatedTarget(url=url, scheme=scheme, host=host, port=port, ip=resolved[0])


def validate_public_url(url: str) -> None:
    """Raise BlockedURLError unless `url` is a public http(s) destination.

    Check-only helper. Fetch paths must use ``resolve_and_validate`` + a pinned
    connect so DNS cannot be rebound between check and TCP.
    """
    if _allow_private():
        return
    resolve_and_validate(url)


async def validate_public_url_async(url: str) -> None:
    """Async wrapper — getaddrinfo is blocking, so run it off the event loop."""
    await asyncio.to_thread(validate_public_url, url)


async def resolve_and_validate_async(url: str) -> ValidatedTarget:
    """Async wrapper for ``resolve_and_validate``."""
    return await asyncio.to_thread(resolve_and_validate, url)


async def httpx_get_pinned(
    client: httpx.AsyncClient,
    target: ValidatedTarget,
) -> httpx.Response:
    """GET ``target`` by connecting to the pinned IP (Host + SNI keep ``host``)."""
    headers = {"Host": target.host_header}
    extensions: dict[str, str] = {}
    if target.scheme == "https":
        # httpcore reads this for TLS SNI / cert hostname when the URL host is an IP.
        extensions["sni_hostname"] = target.host
    return await client.get(
        target.pinned_url,
        headers=headers,
        extensions=extensions,
    )


def httpx_get_pinned_sync(
    client: httpx.Client,
    target: ValidatedTarget,
) -> httpx.Response:
    """Sync counterpart of ``httpx_get_pinned`` (Playwright route fulfill)."""
    headers = {"Host": target.host_header}
    extensions: dict[str, str] = {}
    if target.scheme == "https":
        extensions["sni_hostname"] = target.host
    return client.get(
        target.pinned_url,
        headers=headers,
        extensions=extensions,
    )
