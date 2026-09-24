from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse

from app.i18n import resolve_locale
from app.schemas import IntegrationDetailOut, IntegrationOut
from app.services.integrations import (
    get_integration,
    guide_path,
    list_integrations,
    logo_path,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])

# Localized JSON/markdown — browsers/CDNs must not reuse a FR body for EN.
_LOCALE_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "Vary": "Accept-Language",
}


def _to_out(meta, locale: str) -> IntegrationOut:
    fr = locale == "fr"
    return IntegrationOut(
        id=meta.id,
        name=meta.name,
        title=meta.title_fr if fr else meta.title_en,
        blurb=meta.blurb_fr if fr else meta.blurb_en,
        categories=list(meta.categories),
        access=meta.access,  # type: ignore[arg-type]
        methods=list(meta.methods),
        docs_url=meta.docs_url or None,
        badge=meta.badge,
        enabled_hint=meta.enabled_hint,
        logo_url=f"/integrations/{meta.id}/logo",
    )


@router.get("", response_model=list[IntegrationOut])
def get_integrations(
    request: Request,
    category: str | None = None,
    q: str | None = None,
    access: str | None = None,
) -> JSONResponse:
    """Public catalogue — Integrations page."""
    locale = resolve_locale(request)
    if access and access.strip().lower() != "yes":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid access")
    payload = [
        _to_out(meta, locale).model_dump()
        for meta in list_integrations(category=category, q=q, access=access)
    ]
    return JSONResponse(content=payload, headers=_LOCALE_CACHE_HEADERS)


@router.get("/{integration_id}", response_model=IntegrationDetailOut)
def get_integration_detail(request: Request, integration_id: str) -> JSONResponse:
    locale = resolve_locale(request)
    meta = get_integration(integration_id)
    if meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown integration")
    base = _to_out(meta, locale)
    gpath = guide_path(integration_id, locale)
    guide_md = gpath.read_text(encoding="utf-8") if gpath else ""
    detail = IntegrationDetailOut(
        **base.model_dump(),
        guide_md=guide_md,
        guide_url=f"/integrations/{meta.id}/guide",
    )
    return JSONResponse(content=detail.model_dump(), headers=_LOCALE_CACHE_HEADERS)


@router.get("/{integration_id}/logo")
def integration_logo(integration_id: str) -> FileResponse:
    path = logo_path(integration_id)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo missing")
    suffix = path.suffix.lower()
    media = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".gif": "image/gif",
    }.get(suffix)
    return FileResponse(
        path,
        media_type=media,
        headers={"Cache-Control": "public, max-age=300, must-revalidate"},
    )


@router.get("/{integration_id}/guide")
def integration_guide(request: Request, integration_id: str) -> PlainTextResponse:
    locale = resolve_locale(request)
    path = guide_path(integration_id, locale)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide missing")
    return PlainTextResponse(
        path.read_text(encoding="utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers=_LOCALE_CACHE_HEADERS,
    )
