"""The image panel: free image bank, import into a project, AI generation.

Free images come from Pixabay (``services/image_bank``); an image the user
picks is downloaded into the project, converted to WebP with variants and
credited in ``.forge/media.json``. AI images go through the RodiumAi gateway
like every other generation: Forge computes no price, the gateway bills FRODI
then RODI, and an empty balance is reported as ``INSUFFICIENT_CREDITS``.
"""

from __future__ import annotations

import asyncio
import re
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale
from app.models import ModelCatalog, User
from app.services import image_bank, rate_limit
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.llm import ERR_QUOTA, RodiumError
from app.services.orchestration.images import generate_project_image
from app.services.project_access import accessible_project
from app.services.project_media import record_media, save_webp_with_variants
from app.services.rodium_generation import resolve_generation_auth

router = APIRouter(tags=["images"])

STOCK_FOLDER = "public/images"
SEARCHES_PER_USER_PER_MINUTE = 30
IMPORTS_PER_USER_PER_MINUTE = 20

# Aspect ratios the panel offers, mapped to the sizes the image models accept.
ASPECT_SIZES: dict[str, str] = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "4:3": "1536x1024",
    "3:2": "1536x1024",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
    "2:3": "1024x1536",
}
Aspect = Literal["1:1", "16:9", "4:3", "3:2", "9:16", "3:4", "2:3"]


class StockImageOut(BaseModel):
    id: str
    previewUrl: str
    width: int
    height: int
    author: str
    pageUrl: str
    tags: str = ""
    source: Literal["pixabay"] = "pixabay"


class ImageSearchOut(BaseModel):
    hits: list[StockImageOut]
    total: int
    page: int
    hasMore: bool
    source: Literal["pixabay"] = "pixabay"


class ImageImportRequest(BaseModel):
    source: Literal["pixabay"]
    id: str = Field(min_length=1, max_length=20, pattern=r"^[0-9]+$")


class ImageCredit(BaseModel):
    source: str
    author: str = ""
    pageUrl: str = ""


class ProjectImageOut(BaseModel):
    #: Path inside the project, e.g. public/images/pixabay-123.webp.
    path: str
    #: The same file as the site serves it, e.g. /images/pixabay-123.webp.
    public_path: str
    width: int
    height: int
    srcset: list[tuple[str, int]] = Field(default_factory=list)
    credit: ImageCredit | None = None
    model: str | None = None
    target: str | None = None


class ImageGenerateRequest(BaseModel):
    model: str | None = Field(default=None, max_length=128)
    prompt: str = Field(min_length=1, max_length=4000)
    aspect: Aspect = "1:1"
    #: Where the image goes (a slide element id, an img src...). Echoed back.
    target: str | None = Field(default=None, max_length=200)


class ImageModelOut(BaseModel):
    slug: str
    label: str
    default: bool = False


def _model_label(slug: str) -> str:
    name = slug.split("/")[-1].replace("-", " ")
    return name[:1].upper() + name[1:] if name else slug


def image_models(db: Session) -> list[ImageModelOut]:
    """Image models of the catalogue, the platform default first."""
    default = get_settings().effective_default_image_model
    slugs = [default]
    try:
        rows = (
            db.query(ModelCatalog)
            .filter(ModelCatalog.status == "active", ModelCatalog.role == "image")
            .order_by(ModelCatalog.slug.asc())
            .all()
        )
        slugs += [row.slug for row in rows if row.slug != default]
    except Exception:
        # No catalogue (open-source clone without the table filled): default only.
        pass
    return [ImageModelOut(slug=slug, label=_model_label(slug), default=slug == default) for slug in slugs]


def _insufficient_credits() -> SitesError:
    return SitesError(
        402,
        "INSUFFICIENT_CREDITS",
        "Not enough credits to generate this image.",
        {"actions": ["upgrade", "recharge"]},
    )


@router.get("/images/search", response_model=ImageSearchOut)
async def search_images(
    request: Request,
    q: str = Query(min_length=1, max_length=100),
    orientation: image_bank.Orientation = "all",
    lang: str | None = Query(default=None, max_length=5),
    type: image_bank.ImageType = "photo",
    page: int = Query(default=1, ge=1, le=20),
    user: User = Depends(get_current_user),
) -> ImageSearchOut:
    """Free images (Pixabay, safe search on), cached 24 hours."""
    rate_limit.enforce(request, "image_search", SEARCHES_PER_USER_PER_MINUTE, 60, subject=str(user.id))
    result = await asyncio.to_thread(
        image_bank.search,
        q,
        image_type=type,
        orientation=orientation,
        lang=(lang or resolve_locale(request)),
        page=page,
    )
    return ImageSearchOut.model_validate(result)


@router.get("/images/models", response_model=list[ImageModelOut])
def list_image_models(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ImageModelOut]:
    return image_models(db)


@router.post("/projects/{project_id}/images/import", response_model=ProjectImageOut)
async def import_image(
    project_id: UUID,
    body: ImageImportRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectImageOut:
    """Copy one free image into the project (Pixabay forbids permanent hotlinks)."""
    project = accessible_project(db, user, project_id, resolve_locale(request), require_edit=True)
    rate_limit.enforce(request, "image_import", IMPORTS_PER_USER_PER_MINUTE, 60, subject=str(user.id))
    raw, meta = await asyncio.to_thread(image_bank.fetch_for_import, body.id)
    pid = str(project.id)
    try:
        entry = await asyncio.to_thread(
            save_webp_with_variants, pid, raw, stem=f"pixabay-{meta.id}", folder=STOCK_FOLDER
        )
    except Exception as exc:
        raise SitesError(422, "IMAGE_UNREADABLE", "The downloaded image could not be read.") from exc
    entry.kind = "stock"
    entry.alt = re.sub(r"\s+", " ", meta.tags).strip()[:140]
    credit = ImageCredit(source="pixabay", author=meta.author, pageUrl=meta.pageUrl)
    record_media(pid, entry, extra={"credit": credit.model_dump()})
    return ProjectImageOut(
        path="public" + entry.path,
        public_path=entry.path,
        width=entry.width,
        height=entry.height,
        srcset=entry.srcset,
        credit=credit,
    )


@router.post("/projects/{project_id}/images/generate", response_model=ProjectImageOut)
async def generate_image(
    project_id: UUID,
    body: ImageGenerateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectImageOut:
    """One AI image with the chosen model, billed by the gateway (FRODI, then RODI)."""
    locale = resolve_locale(request)
    project = accessible_project(db, user, project_id, locale, require_edit=True)
    allowed = {item.slug for item in image_models(db)}
    model = (body.model or "").strip() or get_settings().effective_default_image_model
    if model not in allowed:
        raise SitesError(400, "IMAGE_MODEL_NOT_ALLOWED", "This image model is not available.")
    # Refuse before calling the gateway when both balances are known to be empty.
    try:
        require_rodi_for_paid_capability(user, db)
    except SitesError as exc:
        if exc.code == "INSUFFICIENT_RODI":
            raise _insufficient_credits() from exc
        raise
    gen_auth = await resolve_generation_auth(db, user)
    try:
        info = await generate_project_image(
            auth=gen_auth,
            project_id=str(project.id),
            prompt=body.prompt,
            model=model,
            locale=locale,
            size=ASPECT_SIZES[body.aspect],
        )
    except RodiumError as exc:
        if exc.code == ERR_QUOTA or exc.status_code == 402:
            raise _insufficient_credits() from exc
        status = exc.status_code if exc.status_code and 400 <= exc.status_code < 600 else 502
        raise SitesError(status, "IMAGE_GENERATION_FAILED", str(exc)[:300]) from exc
    return ProjectImageOut(
        path=info["path"],
        public_path=info["public_path"],
        width=info["width"],
        height=info["height"],
        srcset=info["srcset"],
        credit=ImageCredit(source="generated"),
        model=info["model"],
        target=body.target,
    )
