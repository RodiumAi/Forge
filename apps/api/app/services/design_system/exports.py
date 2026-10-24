"""Design system exports: tokens.json (W3C), CSS variables, Tailwind, DESIGN.md, PDF.

Rights follow the Forge Design plan (section 8): Free exports nothing; the
text exports open from Starter; the PDF needs ``export_pdf``. Open-source and
BYOK installs have no plan and stay unrestricted.

The PDF is the brand guidelines page printed by Chromium. The page is built
from the tokens with every asset inlined, and the browser may only fetch the
Google Fonts stylesheet and font files: any other request is aborted, so the
export cannot be turned into a way to reach the network.
"""

from __future__ import annotations

import asyncio
import contextlib
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.errors import SitesError
from app.models import User
from app.services.design_system.render import design_md, tailwind_config, tokens_json
from app.services.design_system.site import brand_site_html, local_asset_url
from app.services.design_system.tokens import css_text

FORMATS = ("tokens", "css", "tailwind", "md", "pdf")
_FONT_HOSTS = ("https://fonts.googleapis.com/", "https://fonts.gstatic.com/")
_PDF_TIMEOUT_S = 60


@dataclass
class ExportFile:
    filename: str
    media_type: str
    body: bytes


def require_export(db: Session, user: User, fmt: str) -> None:
    """403 FEATURE_NOT_IN_PLAN when the acting user's plan does not include ``fmt``."""
    from app.services.entitlements import entitlements_apply, get_entitlements, require_feature

    if not entitlements_apply(user):
        return
    if fmt == "pdf":
        require_feature(db, user, "export_pdf")
        return
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    if slug == "free":
        raise SitesError(403, "FEATURE_NOT_IN_PLAN", "Exports are not included in the Free plan.")


def show_badge(db: Session, user: User) -> bool:
    """The "Made with Forge" badge stays unless the plan has ``remove_badge``."""
    from app.services.entitlements import entitlements_apply, get_entitlements

    if not entitlements_apply(user):
        return False
    row = get_entitlements(db, user)
    return not bool(row is not None and row.remove_badge)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (name or "design-system").lower()).strip("-")[:60] or "design-system"


def text_export(document: dict[str, Any], fmt: str) -> ExportFile:
    base = _slug(str(document.get("name") or ""))
    if fmt == "tokens":
        return ExportFile(f"{base}.tokens.json", "application/json", tokens_json(document).encode("utf-8"))
    if fmt == "css":
        return ExportFile(f"{base}.tokens.css", "text/css; charset=utf-8", css_text(document).encode("utf-8"))
    if fmt == "tailwind":
        return ExportFile(
            "tailwind.config.js", "text/javascript; charset=utf-8", tailwind_config(document).encode("utf-8")
        )
    if fmt == "md":
        return ExportFile("DESIGN.md", "text/markdown; charset=utf-8", design_md(document).encode("utf-8"))
    raise SitesError(400, "INVALID_FORMAT", f"Unknown export format {fmt!r}.")


def _print_pdf(html: str) -> bytes:
    from playwright.sync_api import sync_playwright

    def guard(route) -> None:
        url = route.request.url
        if url.startswith("data:") or (route.request.method == "GET" and url.startswith(_FONT_HOSTS)):
            route.continue_()
        else:
            with contextlib.suppress(Exception):
                route.abort()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                service_workers="block", accept_downloads=False, java_script_enabled=False
            )
            try:
                context.route("**/*", guard)
                page = context.new_page()
                page.set_content(html, wait_until="load", timeout=30_000)
                with contextlib.suppress(Exception):
                    page.wait_for_load_state("networkidle", timeout=8_000)
                return page.pdf(format="A4", print_background=True, margin={"top": "12mm", "bottom": "12mm"})
            finally:
                context.close()
        finally:
            browser.close()


async def pdf_export(project_id: str, document: dict[str, Any], *, lang: str, badge: bool) -> ExportFile:
    html = brand_site_html(document, asset_url=local_asset_url(project_id), lang=lang, badge=badge)
    try:
        body = await asyncio.wait_for(asyncio.to_thread(_print_pdf, html), timeout=_PDF_TIMEOUT_S)
    except ImportError as exc:
        raise SitesError(503, "PDF_UNAVAILABLE", "PDF export needs Playwright on the Forge API.") from exc
    except TimeoutError as exc:
        raise SitesError(504, "PDF_TIMEOUT", "The PDF took too long to render.") from exc
    return ExportFile(f"{_slug(str(document.get('name') or ''))}-guidelines.pdf", "application/pdf", body)
