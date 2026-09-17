"""Capture public website screenshots for vision-based cloning."""

from __future__ import annotations

import contextlib
import logging
import re
from urllib.parse import urlparse

import httpx

from app.services.attachments import count_markers_by_intent
from app.services.filesystem import write_bytes
from app.services.llm import RodiumError
from app.services.net_guard import (
    BlockedURLError,
    httpx_get_pinned_sync,
    resolve_and_validate,
    resolve_and_validate_async,
)

logger = logging.getLogger("url_capture")

_SITE_URL_RE = re.compile(r"https?://[^\s<>\"'`\]]+", re.I)
_IMAGE_EXT = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".bmp",
    ".avif",
)
_VIEWPORTS = (
    ("desktop", 1440, 900),
    ("mobile", 390, 844),
)
_NAV_TIMEOUT_MS = 45_000
_RESPONSE_HEADERS_TO_DROP = {
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


def extract_site_urls(text: str) -> list[str]:
    """Return http(s) URLs that look like pages (not bare image files)."""
    found: list[str] = []
    seen: set[str] = set()
    for raw in _SITE_URL_RE.findall(text or ""):
        url = raw.rstrip(").,;]")
        lower = url.lower()
        if any(lower.split("?", 1)[0].endswith(ext) for ext in _IMAGE_EXT):
            continue
        if url in seen:
            continue
        seen.add(url)
        found.append(url)
    return found


def site_url_needing_capture(user_text: str) -> str | None:
    """First site URL to capture, or None if enough reference shots already exist."""
    if count_markers_by_intent(user_text or "", "reference") >= 2:
        return None
    urls = extract_site_urls(user_text or "")
    return urls[0] if urls else None


def _slug_from_url(url: str) -> str:
    host = urlparse(url).netloc or "site"
    host = re.sub(r"[^a-zA-Z0-9.-]+", "-", host).strip("-.").lower() or "site"
    return host[:48]


def _capture_sync(url: str) -> list[tuple[str, bytes]]:
    """Blocking Playwright capture — run via asyncio.to_thread."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RodiumError(
            "URL capture requires Playwright on the Forge API. Install playwright and Chromium, then retry.",
            None,
            "upstream",
        ) from exc

    def _guard_route(route) -> None:
        # Resolve once, fetch through the pinned transport (which preserves
        # the original TLS SNI), then give Chromium the verified response.
        # Rewriting Chromium's URL to an IP would lose SNI and break virtual
        # hosts even when certificate errors are ignored.
        try:
            if route.request.method != "GET":
                route.abort()
                return
            target = resolve_and_validate(route.request.url)
            response = httpx_get_pinned_sync(
                fetch_client,
                target,
                headers=route.request.headers,
            )
            response_headers = {
                key: value
                for key, value in response.headers.items()
                if key.lower() not in _RESPONSE_HEADERS_TO_DROP
            }
            route.fulfill(
                status=response.status_code,
                headers=response_headers,
                body=response.content,
            )
        except (BlockedURLError, httpx.HTTPError):
            with contextlib.suppress(Exception):
                route.abort()

    def _close_popup(page) -> None:
        # Context routing protects popup requests too. Closing renderer-created
        # pages is defence in depth and must not affect our own top-level pages.
        with contextlib.suppress(Exception):
            if page.opener() is not None:
                page.close()

    def _block_websocket(websocket_route) -> None:
        with contextlib.suppress(Exception):
            websocket_route.close(code=1008, reason="WebSockets are disabled during URL capture")

    # Reject an invalid initial URL before starting Chromium. The context route
    # below performs the authoritative validation and pinning for every request.
    try:
        resolve_and_validate(url)
    except BlockedURLError as exc:
        raise RodiumError(f"Could not capture screenshots for {url}", None, "upstream") from exc

    shots: list[tuple[str, bytes]] = []
    with httpx.Client(
        follow_redirects=False,
        timeout=httpx.Timeout(20.0),
        trust_env=False,
        verify=False,
    ) as fetch_client:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    ignore_https_errors=True,
                    service_workers="block",
                    accept_downloads=False,
                )
                try:
                    # Install all context-wide controls before any page exists,
                    # so popups and workers inherit the same network policy.
                    context.route("**/*", _guard_route)
                    route_web_socket = getattr(context, "route_web_socket", None)
                    if callable(route_web_socket):
                        route_web_socket("**/*", _block_websocket)
                    context.on("page", _close_popup)

                    for label, width, height in _VIEWPORTS:
                        page = context.new_page()
                        page.set_viewport_size({"width": width, "height": height})
                        try:
                            page.goto(
                                url,
                                wait_until="domcontentloaded",
                                timeout=_NAV_TIMEOUT_MS,
                            )
                            with contextlib.suppress(Exception):
                                page.wait_for_load_state("networkidle", timeout=12_000)
                            # Prefer full page when short enough; otherwise viewport.
                            png = page.screenshot(full_page=True, type="png")
                            if len(png) > 4_500_000:
                                png = page.screenshot(full_page=False, type="png")
                            shots.append((label, png))
                        finally:
                            page.close()
                finally:
                    context.close()
            finally:
                browser.close()
    if not shots:
        raise RodiumError(f"Could not capture screenshots for {url}", None, "upstream")
    return shots


async def capture_site_screenshots(
    *,
    project_id: str,
    url: str,
    locale: str = "en",
) -> list[dict[str, str]]:
    """Write desktop+mobile PNGs under public/images/; return marker metadata."""
    import asyncio

    try:
        await resolve_and_validate_async(url)
    except BlockedURLError as exc:
        # Don't leak *why* (internal host, metadata, etc.) — same message as an
        # unreachable public site.
        msg = (
            f"Impossible de capturer {url}. Vérifie que le site est public et réessaie."
            if locale == "fr"
            else f"Could not capture {url}. Check the site is public and try again."
        )
        raise RodiumError(msg, None, "upstream") from exc

    try:
        shots = await asyncio.to_thread(_capture_sync, url)
    except RodiumError:
        raise
    except Exception as exc:
        logger.warning("url capture failed for %s: %s", url, exc)
        msg = (
            f"Impossible de capturer {url}. Vérifie que le site est public et réessaie."
            if locale == "fr"
            else f"Could not capture {url}. Check the site is public and try again."
        )
        raise RodiumError(msg, None, "upstream") from exc

    slug = _slug_from_url(url)
    out: list[dict[str, str]] = []
    for label, png in shots:
        filename = f"url-capture-{slug}-{label}.png"
        rel = f"public/images/{filename}"
        write_bytes(project_id, rel, png)
        web_path = f"/images/{filename}"
        out.append({"name": filename, "web_path": web_path, "viewport": label})
    return out


def append_capture_markers(user_content: str, captures: list[dict[str, str]], *, locale: str = "en") -> str:
    """Append Files + Reference screenshot markers for captured shots."""
    if not captures:
        return user_content
    files_label = "Fichiers" if locale == "fr" else "Files"
    shot_label = "Capture de référence" if locale == "fr" else "Reference screenshot"
    names = ", ".join(c["name"] for c in captures)
    lines = [user_content.rstrip(), "", f"[{files_label}: {names}]"]
    for c in captures:
        lines.append(f"[{shot_label}: {c['name']} | url:{c['web_path']} | intent:reference]")
    return "\n".join(lines).strip()


async def enrich_prompt_with_site_url_captures(
    *,
    project_id: str,
    user_content: str,
    locale: str = "en",
) -> str:
    """If the prompt has a site URL and few references, capture and inject markers."""
    url = site_url_needing_capture(user_content)
    if not url:
        return user_content
    captures = await capture_site_screenshots(project_id=project_id, url=url, locale=locale)
    return append_capture_markers(user_content, captures, locale=locale)
