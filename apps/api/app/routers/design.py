from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_media_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services import history
from app.services.attachments import ResolvedImage, resolve_image_part
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.design_colors import apply_brand_color, merge_palettes, parse_palette
from app.services.filesystem import project_dir, read_file, write_bytes, write_file
from app.services.llm import RodiumError, complete_chat
from app.services.orchestration.context import DESIGN_PATH
from app.services.rodium_generation import resolve_generation_auth

router = APIRouter(prefix="/projects", tags=["design"])

CHARTER_SYSTEM = """You write DESIGN.md graphic charters for Forge web apps.
Output ONLY valid markdown for a DESIGN.md file (no fences, no preamble).
Include complete sections:
# Brand
# Colors (CSS variables with hex — derive a full palette from the logo when an image is attached)
# Typography
# Spacing & radius
# Tone of voice
# Logo (path, usage, clear space, do/don't on the mark)
# Do / Don't
Use concrete token names like --color-bg, --color-accent, --font-sans.
When a logo image is attached: analyze its colors, shapes, style and mood; build the whole charter around that identity.
If a project logo path is provided (e.g. /logo.png), reference that exact path in the Logo section and recommend using it in the app header.
"""

LOGO_VISION_HINT = (
    "The attached image is the brand logo. Analyze it carefully (colors, contrast, "
    "geometry, style, mood) and produce a complete, coherent graphic charter derived from it."
)


class DesignCharterRequest(BaseModel):
    brief: str = Field(default="", max_length=8000)
    logo_object_id: str | None = Field(default=None, max_length=64)
    logo_url: str | None = Field(default=None, max_length=2000)
    logo_path: str | None = Field(default=None, max_length=200)


class DesignCharterSaveRequest(BaseModel):
    markdown: str = Field(min_length=20, max_length=100_000)
    brief: str | None = Field(default=None, max_length=8000)


class DesignCharterResponse(BaseModel):
    ok: bool = True
    path: str = DESIGN_PATH
    markdown: str
    brief: str
    logo_path: str | None = None


class DesignPaletteColor(BaseModel):
    name: str
    hex: str


class DesignCharterOut(BaseModel):
    path: str = DESIGN_PATH
    markdown: str | None = None
    brief: str | None = None
    exists: bool = False
    logo_path: str | None = None
    palette: list[DesignPaletteColor] = Field(default_factory=list)


class DesignColorUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    hex: str = Field(min_length=4, max_length=9)


class DesignColorUpdateResponse(BaseModel):
    ok: bool = True
    markdown: str
    css_updated: bool = False
    palette: list[DesignPaletteColor] = Field(default_factory=list)


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t("project_not_found", locale))
    return project


def _detect_logo_ext(content_type: str | None, name: str | None) -> str:
    ctype = (content_type or "").lower()
    if "jpeg" in ctype or "jpg" in ctype:
        return ".jpg"
    if "webp" in ctype:
        return ".webp"
    if "gif" in ctype:
        return ".gif"
    if "svg" in ctype:
        return ".svg"
    if name:
        lower = name.lower()
        for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
            if lower.endswith(ext):
                return ".jpg" if ext == ".jpeg" else ext
    return ".png"


def _persist_logo_from_data_url(
    project_id: str,
    image_part: dict[str, Any],
    *,
    preferred_name: str | None = None,
) -> str | None:
    """Write logo bytes into public/logo.* and return the public path."""
    image_url = ""
    nested = image_part.get("image_url")
    if isinstance(nested, dict):
        image_url = str(nested.get("url") or "")
    if not image_url.startswith("data:") or ";base64," not in image_url:
        return None
    header, b64 = image_url.split(";base64,", 1)
    ctype = header[5:] if header.startswith("data:") else "image/png"
    import base64

    try:
        body = base64.b64decode(b64, validate=False)
    except Exception:
        return None
    if not body:
        return None
    ext = _detect_logo_ext(ctype, preferred_name)
    relative = f"public/logo{ext}"
    write_bytes(project_id, relative, body)
    return f"/logo{ext}"


def _existing_logo_path(project_id: str) -> str | None:
    public = project_dir(project_id) / "public"
    for name in ("logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "logo.svg"):
        if (public / name).is_file():
            return f"/{name if name != 'logo.jpeg' else 'logo.jpg'}"
    return None


def _existing_logo_disk(project_id: str):
    public = project_dir(project_id) / "public"
    for name in ("logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "logo.svg"):
        path = public / name
        if path.is_file():
            return path
    return None


@router.get("/{project_id}/design-charter/logo")
def get_design_logo(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_media_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """Serve the locked project logo for the Design panel preview."""
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    disk = _existing_logo_disk(str(project.id))
    if disk is None:
        raise HTTPException(status_code=404, detail="Logo not found")
    media = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    }.get(disk.suffix.lower(), "application/octet-stream")
    return FileResponse(
        disk,
        media_type=media,
        headers={"Cache-Control": "private, max-age=60"},
    )


@router.get("/{project_id}/design-charter", response_model=DesignCharterOut)
def get_design_charter(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DesignCharterOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    logo_path = _existing_logo_path(str(project.id))
    css_text = ""
    try:
        css_text = read_file(str(project.id), "src/index.css")
    except FileNotFoundError:
        css_text = ""
    try:
        md = read_file(str(project.id), DESIGN_PATH)
        palette = [
            DesignPaletteColor(name=e.name, hex=e.hex)
            for e in merge_palettes(parse_palette(md), parse_palette(css_text))
        ]
        return DesignCharterOut(
            markdown=md,
            brief=project.design_brief,
            exists=True,
            logo_path=logo_path,
            palette=palette,
        )
    except FileNotFoundError:
        palette = [DesignPaletteColor(name=e.name, hex=e.hex) for e in parse_palette(css_text)]
        return DesignCharterOut(
            brief=project.design_brief,
            exists=False,
            logo_path=logo_path,
            palette=palette,
        )


@router.patch("/{project_id}/design-charter/colors", response_model=DesignColorUpdateResponse)
def patch_design_color(
    project_id: UUID,
    body: DesignColorUpdateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DesignColorUpdateResponse:
    """Update one brand token in DESIGN.md and src/index.css, then refreshable in preview."""
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    history.snapshot(str(project.id), f"before brand color: --{body.name}")
    try:
        result = apply_brand_color(str(project.id), body.name, body.hex)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="DESIGN.md not found") from exc
    except ValueError as exc:
        code = str(exc)
        detail = "Invalid color" if code in {"invalid_hex", "invalid_token"} else code
        raise HTTPException(status_code=400, detail=detail) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Color token not found in charter or CSS") from exc
    return DesignColorUpdateResponse(
        markdown=result.markdown,
        css_updated=result.css_updated,
        palette=[DesignPaletteColor(name=e.name, hex=e.hex) for e in result.palette],
    )


@router.post("/{project_id}/design-charter", response_model=DesignCharterResponse)
async def generate_design_charter(
    project_id: UUID,
    body: DesignCharterRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DesignCharterResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    require_rodi_for_paid_capability(user, db)
    try:
        gen_auth = await resolve_generation_auth(db, user)
    except HTTPException as exc:
        raise exc

    settings = get_settings()
    has_logo = bool(
        (body.logo_object_id or "").strip() or (body.logo_url or "").strip() or (body.logo_path or "").strip()
    )
    brief_text = (body.brief or "").strip()
    if not has_logo:
        has_logo = bool(_existing_logo_path(str(project.id)))
    if len(brief_text) < 8 and not has_logo:
        raise HTTPException(
            status_code=400,
            detail="Provide a brief (min 8 chars) and/or a logo to generate the charter",
        )
    if len(brief_text) < 8:
        brief_text = "Generate a complete graphic charter from the brand logo."

    user_prompt = f"Project name: {project.name}\n\nBrief:\n{brief_text}"

    logo_public_path = (body.logo_path or "").strip() or _existing_logo_path(str(project.id))
    image_part: dict[str, Any] | None = None

    if body.logo_object_id or body.logo_url:
        resolved = ResolvedImage(
            url=(body.logo_url or "").strip(),
            name="brand-logo",
            object_id=(body.logo_object_id or "").strip() or None,
        )
        image_part = await resolve_image_part(db, str(project.id), resolved)
    elif logo_public_path:
        # Re-use logo already stored under public/ for regenerate-without-reupload.
        image_part = await resolve_image_part(
            db,
            str(project.id),
            ResolvedImage(url=logo_public_path, name="brand-logo"),
        )

    if image_part and image_part.get("type") == "image_url":
        if body.logo_object_id or body.logo_url:
            persisted = _persist_logo_from_data_url(
                str(project.id),
                image_part,
                preferred_name="logo",
            )
            if persisted:
                logo_public_path = persisted
        user_prompt += f"\n\n{LOGO_VISION_HINT}"
        if logo_public_path:
            user_prompt += f"\nProject logo path to reference in DESIGN.md: {logo_public_path}"
        if body.logo_url:
            user_prompt += f"\nCDN / public URL (optional fallback): {body.logo_url.strip()}"
    elif body.logo_url:
        user_prompt += f"\n\nLogo URL: {body.logo_url.strip()}"
        if logo_public_path:
            user_prompt += f"\nProject logo path: {logo_public_path}"

    user_content: str | list[dict[str, Any]] = user_prompt
    if image_part and image_part.get("type") == "image_url":
        user_content = [
            {"type": "text", "text": user_prompt},
            image_part,
        ]

    try:
        markdown = await complete_chat(
            auth=gen_auth,
            model=settings.effective_default_model,
            messages=[
                {"role": "system", "content": CHARTER_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            locale=locale,
            temperature=0.5,
        )
    except RodiumError as exc:
        raise HTTPException(status_code=exc.status_code or 502, detail=str(exc)) from exc

    markdown = markdown.strip()
    if markdown.startswith("```"):
        lines = markdown.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        markdown = "\n".join(lines).strip()

    write_file(str(project.id), DESIGN_PATH, markdown + "\n")
    project.design_brief = brief_text
    db.commit()
    return DesignCharterResponse(
        markdown=markdown,
        brief=project.design_brief or brief_text,
        logo_path=logo_public_path,
    )


@router.put("/{project_id}/design-charter", response_model=DesignCharterResponse)
def save_design_charter(
    project_id: UUID,
    body: DesignCharterSaveRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DesignCharterResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    markdown = body.markdown.strip()
    if not markdown.startswith("#"):
        raise HTTPException(status_code=400, detail="DESIGN.md must start with a markdown heading")
    write_file(str(project.id), DESIGN_PATH, markdown + "\n")
    if body.brief:
        project.design_brief = body.brief.strip()
    elif project.design_brief is None:
        project.design_brief = "Manual DESIGN.md edit"
    db.commit()
    return DesignCharterResponse(
        markdown=markdown,
        brief=project.design_brief or "",
        logo_path=_existing_logo_path(str(project.id)),
    )
