from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from app.i18n import resolve_locale
from app.schemas import TemplateOut
from app.services.templates import get_template, list_templates, preview_path

router = APIRouter(prefix="/templates", tags=["templates"])


def _to_out(meta, locale: str) -> TemplateOut:
    return TemplateOut(
        id=meta.id,
        title=meta.title_fr if locale == "fr" else meta.title_en,
        description=meta.description_fr if locale == "fr" else meta.description_en,
        tags=list(meta.tags),
        boot_hint=meta.boot_hint_fr if locale == "fr" else meta.boot_hint_en,
        accent=meta.accent,
        bg=meta.bg,
        preview_url=f"/templates/{meta.id}/preview",
    )


@router.get("", response_model=list[TemplateOut])
def get_templates(request: Request) -> JSONResponse:
    """Public catalogue — used on landing + dashboard."""
    locale = resolve_locale(request)
    payload = [_to_out(meta, locale).model_dump() for meta in list_templates()]
    return JSONResponse(
        content=payload,
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=300"},
    )


@router.get("/{template_id}/preview")
def template_preview(template_id: str) -> FileResponse:
    meta = get_template(template_id)
    if meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown template")
    path = preview_path(template_id)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview missing")
    return FileResponse(
        path,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/{template_id}/media/{asset_path:path}")
def template_media(template_id: str, asset_path: str) -> FileResponse:
    """Serve template public/ assets for gallery srcDoc previews."""
    meta = get_template(template_id)
    if meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown template")
    # Prevent path traversal
    clean = asset_path.replace("\\", "/").lstrip("/")
    if ".." in clean.split("/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
    file_path = (meta.path / "public" / clean).resolve()
    public_root = (meta.path / "public").resolve()
    if not str(file_path).startswith(str(public_root)) or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset missing")
    return FileResponse(file_path, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/{template_id}/preview-html", response_class=HTMLResponse, include_in_schema=False)
def template_preview_html(template_id: str) -> HTMLResponse:
    """Alias used by some iframes."""
    path = preview_path(template_id)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview missing")
    return HTMLResponse(path.read_text(encoding="utf-8"))
