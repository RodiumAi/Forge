from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.filesystem import project_dir
from app.services.llm import RodiumError, complete_chat
from app.services.orchestration.images import generate_project_image
from app.services.rodium_generation import resolve_generation_auth
from app.services.seo_meta import (
    extract_json_object,
    gather_seo_context,
    read_seo_meta,
    save_favicon_asset,
    save_og_asset,
    write_seo_meta,
)

router = APIRouter(prefix="/projects", tags=["seo"])

IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

COPY_SYSTEM = """You write SEO metadata for a website.
Output ONLY a valid JSON object (no markdown fences, no preamble) with these string keys:
title, description, keywords, og_title, og_description, twitter_title, twitter_description, robots.
Rules:
- EVERY key MUST be present with a non-empty string value — never omit a field, never return ""
- title: 50-60 characters ideal
- description: 140-160 characters ideal
- keywords: comma-separated, 5-12 phrases
- og_* and twitter_* can refine title/description for social; keep them close
- robots: usually "index, follow"
- Write in the language requested by the user message
- Do not invent absolute URLs
"""


class SeoMetaOut(BaseModel):
    title: str = ""
    description: str = ""
    keywords: str = ""
    canonical: str = ""
    robots: str = "index, follow"
    favicon_path: str | None = None
    apple_touch_path: str | None = None
    og_image_path: str | None = None
    og_title: str = ""
    og_description: str = ""
    og_type: str = "website"
    twitter_card: str = "summary_large_image"
    twitter_title: str = ""
    twitter_description: str = ""
    twitter_image_path: str | None = None


class SeoMetaUpdate(BaseModel):
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    keywords: str = Field(default="", max_length=1000)
    canonical: str = Field(default="", max_length=2000)
    robots: str = Field(default="index, follow", max_length=120)
    favicon_path: str | None = Field(default=None, max_length=500)
    apple_touch_path: str | None = Field(default=None, max_length=500)
    og_image_path: str | None = Field(default=None, max_length=500)
    og_title: str = Field(default="", max_length=200)
    og_description: str = Field(default="", max_length=2000)
    og_type: str = Field(default="website", max_length=60)
    twitter_card: str = Field(default="summary_large_image", max_length=60)
    twitter_title: str = Field(default="", max_length=200)
    twitter_description: str = Field(default="", max_length=2000)
    twitter_image_path: str | None = Field(default=None, max_length=500)


class SeoGenerateCopyRequest(BaseModel):
    locale: str | None = Field(default=None, max_length=8)


class SeoGenerateImageRequest(BaseModel):
    prompt: str | None = Field(default=None, max_length=2000)


class SeoAssetResponse(BaseModel):
    ok: bool = True
    kind: str
    favicon_path: str | None = None
    apple_touch_path: str | None = None
    og_image_path: str | None = None
    twitter_image_path: str | None = None
    meta: SeoMetaOut | None = None


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t("project_not_found", locale))
    return project


def _to_out(data: dict) -> SeoMetaOut:
    return SeoMetaOut(**{k: data.get(k) for k in SeoMetaOut.model_fields})


@router.get("/{project_id}/seo", response_model=SeoMetaOut)
def get_seo(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SeoMetaOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    return _to_out(read_seo_meta(str(project.id)))


@router.put("/{project_id}/seo", response_model=SeoMetaOut)
def put_seo(
    project_id: UUID,
    body: SeoMetaUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SeoMetaOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    saved = write_seo_meta(str(project.id), body.model_dump())
    return _to_out(saved)


@router.post("/{project_id}/seo/assets", response_model=SeoAssetResponse)
async def upload_seo_asset(
    project_id: UUID,
    request: Request,
    kind: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SeoAssetResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    kind_norm = kind.strip().lower()
    if kind_norm not in {"favicon", "og"}:
        raise HTTPException(status_code=400, detail="kind must be favicon or og")

    filename = (file.filename or "image.png").replace("\\", "/").split("/")[-1]
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    content_type = (file.content_type or "").lower()
    if content_type not in IMAGE_TYPES and ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Only PNG/JPEG/WebP images are allowed")

    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8 MB)")

    try:
        if kind_norm == "favicon":
            paths = save_favicon_asset(str(project.id), raw)
        else:
            paths = save_og_asset(str(project.id), raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    current = read_seo_meta(str(project.id))
    current.update(paths)
    meta = write_seo_meta(str(project.id), current)

    return SeoAssetResponse(
        kind=kind_norm,
        favicon_path=paths.get("favicon_path"),
        apple_touch_path=paths.get("apple_touch_path"),
        og_image_path=paths.get("og_image_path"),
        twitter_image_path=paths.get("twitter_image_path"),
        meta=_to_out(meta),
    )


@router.post("/{project_id}/seo/generate-copy", response_model=SeoMetaOut)
async def generate_seo_copy(
    project_id: UUID,
    request: Request,
    body: SeoGenerateCopyRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SeoMetaOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    require_rodi_for_paid_capability(user, db)
    gen_auth = await resolve_generation_auth(db, user)

    lang = (body.locale if body else None) or locale
    lang_label = "French" if str(lang).lower().startswith("fr") else "English"
    context = gather_seo_context(str(project.id), project.name)
    settings = get_settings()

    try:
        raw = await complete_chat(
            auth=gen_auth,
            model=settings.effective_default_model,
            messages=[
                {"role": "system", "content": COPY_SYSTEM},
                {
                    "role": "user",
                    "content": f"Write SEO fields in {lang_label}.\n\n{context}",
                },
            ],
            locale=locale,
            temperature=0.5,
        )
        parsed = extract_json_object(raw)
    except RodiumError as exc:
        raise HTTPException(status_code=exc.status_code or 502, detail=str(exc)) from exc
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid SEO copy response: {exc}") from exc

    current = read_seo_meta(str(project.id))
    for key in (
        "title",
        "description",
        "keywords",
        "og_title",
        "og_description",
        "twitter_title",
        "twitter_description",
        "robots",
    ):
        val = parsed.get(key)
        if isinstance(val, str) and val.strip():
            current[key] = val.strip()

    # Never leave core fields empty after an AI fill — deterministic fallbacks.
    is_fr = lang_label == "French"
    title = (current.get("title") or "").strip() or (project.name or "").strip() or "Site"
    current["title"] = title
    desc = (current.get("description") or "").strip()
    if not desc:
        desc = (current.get("og_description") or current.get("twitter_description") or "").strip()
    if not desc:
        desc = (
            f"Découvrez {title} : fonctionnalités, contenus et informations essentielles, le tout au même endroit."
            if is_fr
            else f"Discover {title}: features, content and key information, all in one place."
        )
    current["description"] = desc
    for src, dst in (
        ("title", "og_title"),
        ("title", "twitter_title"),
        ("description", "og_description"),
        ("description", "twitter_description"),
    ):
        if not (current.get(dst) or "").strip():
            current[dst] = current[src]
    if not (current.get("robots") or "").strip():
        current["robots"] = "index, follow"

    return _to_out(current)


@router.post("/{project_id}/seo/generate-image", response_model=SeoAssetResponse)
async def generate_seo_image(
    project_id: UUID,
    request: Request,
    body: SeoGenerateImageRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SeoAssetResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    require_rodi_for_paid_capability(user, db)
    gen_auth = await resolve_generation_auth(db, user)

    current = read_seo_meta(str(project.id))
    brief = ((body.prompt if body else None) or "").strip()
    if not brief:
        title = current.get("title") or project.name
        desc = current.get("description") or current.get("og_description") or ""
        brief = (
            f"Social preview image for website « {title} ». "
            f"{desc} Clean modern OG banner, wide landscape composition, no text overlay."
        )

    settings = get_settings()
    try:
        result = await generate_project_image(
            auth=gen_auth,
            project_id=str(project.id),
            prompt=brief,
            model=settings.effective_default_image_model,
            locale=locale,
        )
    except RodiumError as exc:
        raise HTTPException(status_code=exc.status_code or 502, detail=str(exc)) from exc

    try:
        gen_path = project_dir(str(project.id)) / result["path"]
        raw = gen_path.read_bytes()
        paths = save_og_asset(str(project.id), raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to prepare OG image: {exc}") from exc

    current.update(paths)
    meta = write_seo_meta(str(project.id), current)
    return SeoAssetResponse(
        kind="og",
        og_image_path=paths.get("og_image_path"),
        twitter_image_path=paths.get("twitter_image_path"),
        meta=_to_out(meta),
    )
