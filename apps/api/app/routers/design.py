from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.filesystem import read_file, write_file
from app.services.llm import RodiumError, complete_chat
from app.services.orchestration.context import DESIGN_PATH
from app.services.rodium_generation import resolve_generation_auth

router = APIRouter(prefix="/projects", tags=["design"])

CHARTER_SYSTEM = """You write DESIGN.md graphic charters for Forge web apps.
Output ONLY valid markdown for a DESIGN.md file (no fences, no preamble).
Include sections:
# Brand
# Colors (CSS variables with hex)
# Typography
# Spacing & radius
# Tone of voice
# Logo
# Do / Don't
Use concrete token names like --color-bg, --color-accent, --font-sans.
If a logo URL is provided, reference it as /logo.svg or the given path.
"""


class DesignCharterRequest(BaseModel):
    brief: str = Field(min_length=8, max_length=8000)
    logo_url: str | None = Field(default=None, max_length=2000)


class DesignCharterSaveRequest(BaseModel):
    markdown: str = Field(min_length=20, max_length=100_000)
    brief: str | None = Field(default=None, max_length=8000)


class DesignCharterResponse(BaseModel):
    ok: bool = True
    path: str = DESIGN_PATH
    markdown: str
    brief: str


class DesignCharterOut(BaseModel):
    path: str = DESIGN_PATH
    markdown: str | None = None
    brief: str | None = None
    exists: bool = False


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=t("project_not_found", locale))
    return project


@router.get("/{project_id}/design-charter", response_model=DesignCharterOut)
def get_design_charter(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DesignCharterOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    try:
        md = read_file(str(project.id), DESIGN_PATH)
        return DesignCharterOut(markdown=md, brief=project.design_brief, exists=True)
    except FileNotFoundError:
        return DesignCharterOut(brief=project.design_brief, exists=False)


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
    user_prompt = f"Project name: {project.name}\n\nBrief:\n{body.brief.strip()}"
    if body.logo_url:
        user_prompt += f"\n\nLogo URL: {body.logo_url.strip()}"

    try:
        markdown = await complete_chat(
            auth=gen_auth,
            model=settings.default_model,
            messages=[
                {"role": "system", "content": CHARTER_SYSTEM},
                {"role": "user", "content": user_prompt},
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
    project.design_brief = body.brief.strip()
    db.commit()
    return DesignCharterResponse(markdown=markdown, brief=project.design_brief or body.brief)


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
    return DesignCharterResponse(markdown=markdown, brief=project.design_brief or "")
