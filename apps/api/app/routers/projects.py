import asyncio
import logging
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_media_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import AgentRun, Chat, Message, PreviewComment, Project, SiteUsageDay, User
from app.schemas import (
    ChatCreate,
    ChatOut,
    ProjectCreate,
    ProjectOut,
    ProjectStatsOut,
    ProjectUpdate,
)
from app.services import preview_babel
from app.services.filesystem import list_files, project_dir, write_bytes
from app.services.posthog_client import capture_for_user
from app.services.project_delete import delete_project_full
from app.services.project_naming import suggest_project_name
from app.services.scaffold import scaffold_vite_react
from app.services.templates import fork_template, get_template, preview_path

logger = logging.getLogger("projects")

router = APIRouter(prefix="/projects", tags=["projects"])

THUMBNAIL_FILENAME = "thumbnail.jpg"
THUMBNAIL_MAX_BYTES = 800_000
# Minimal valid 1x1 JPEG (JFIF) used only as a size/type reference in tests.
_JPEG_MAGIC = b"\xff\xd8\xff"


def _thumbnail_path(project_id: str | UUID) -> Path:
    return project_dir(str(project_id)) / THUMBNAIL_FILENAME


def _has_thumbnail(project_id: str | UUID) -> bool:
    return _thumbnail_path(project_id).is_file()


def _project_out(project: Project) -> ProjectOut:
    settings = get_settings()
    domain = None
    session = Session.object_session(project)
    if session is not None:
        from app.services.domains import get_project_domain

        domain = get_project_domain(session, project.id)
    from app.services.domains import sites_url_for_project

    return ProjectOut(
        id=project.id,
        name=project.name,
        slug=project.slug,
        status=project.status,
        preview_port=project.preview_port,
        preview_running=project.preview_running,
        public_url=settings.preview_url_for_slug(project.slug),
        sites_url=sites_url_for_project(settings, project, domain),
        custom_domain=domain.hostname if domain else None,
        custom_domain_status=domain.status if domain else None,
        template_id=project.template_id,
        published_at=getattr(project, "published_at", None),
        created_at=project.created_at,
        updated_at=project.updated_at,
        has_thumbnail=_has_thumbnail(project.id),
    )


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80] or "project"


def _owned_project(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectOut]:
    rows = db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()
    return [_project_out(row) for row in rows]


def _unique_slug(db: Session, base: str) -> str:
    return _unique_slug_excluding(db, base, None)


def _unique_slug_excluding(db: Session, base: str, exclude_id: UUID | None) -> str:
    """Pick a globally unique project slug (required for {slug}.lvh.me routing)."""
    base_slug = _slugify(base)
    slug = base_slug
    i = 2
    while True:
        q = db.query(Project).filter(Project.slug == slug)
        if exclude_id is not None:
            q = q.filter(Project.id != exclude_id)
        if q.first() is None:
            return slug
        slug = f"{base_slug}-{i}"
        i += 1


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    locale = resolve_locale(request)
    template_id = (body.template_id or "").strip() or None
    prompt = (body.prompt or "").strip()
    # Templates apply ONLY when the user explicitly picks one. The old keyword
    # router silently forked a kit from prompt words ("portfolio", "shop"…),
    # hijacking the user's intent — a bespoke design request landed on a
    # prebuilt template nobody asked for.
    if template_id and get_template(template_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("template_not_found", locale),
        )

    fallback = t("new_project", locale)  # type: ignore[arg-type]
    if prompt:
        display_name = await suggest_project_name(
            prompt,
            locale=locale,  # type: ignore[arg-type]
            db=db,
            user=user,
            fallback=(body.name or "").strip() or fallback,
        )
    elif template_id:
        display_name = (body.name or "").strip() or fallback
    else:
        display_name = (body.name or "").strip()
        if not display_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=t("project_name_required", locale),  # type: ignore[arg-type]
            )
        # Still shorten a pasted long name when no prompt field was sent.
        if len(display_name) > 40:
            display_name = await suggest_project_name(
                display_name,
                locale=locale,  # type: ignore[arg-type]
                db=db,
                user=user,
                fallback=fallback,
            )

    slug = _unique_slug(db, display_name)

    project = Project(
        user_id=user.id,
        name=display_name,
        slug=slug,
        status="ready",
        template_id=template_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    try:
        # to_thread: forking copies files and runs a git snapshot subprocess;
        # inline it would stall the event loop inside this async endpoint.
        if template_id:
            await asyncio.to_thread(fork_template, template_id, str(project.id), project.name)
            # The kit ships a DESIGN.md; seed the design brief from the template
            # description so the charter panel never opens on an empty form.
            meta = get_template(template_id)
            if meta is not None:
                desc = meta.description_fr if str(locale).startswith("fr") else meta.description_en
                if desc:
                    project.design_brief = desc
                    db.commit()
        else:
            await asyncio.to_thread(scaffold_vite_react, str(project.id), project.name)
    except Exception as exc:
        db.delete(project)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    chat = Chat(project_id=project.id, title=t("main_chat", locale))
    db.add(chat)
    db.commit()
    capture_for_user(
        user,
        "forge_project_created",
        {
            "project_id": str(project.id),
            "template_id": template_id,
            "has_prompt": bool(prompt),
        },
    )
    return _project_out(project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    return _project_out(_owned_project(db, user, project_id, resolve_locale(request)))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    name_changed = False
    if body.name is not None:
        next_name = body.name.strip()
        if not next_name:
            raise HTTPException(status_code=400, detail=t("project_name_required", locale))  # type: ignore[arg-type]
        if next_name != project.name:
            project.name = next_name
            name_changed = True
    if body.slug is not None:
        next_slug = _slugify(body.slug)
        if not next_slug:
            raise HTTPException(status_code=400, detail=t("invalid_slug", locale))  # type: ignore[arg-type]
        clash = db.query(Project).filter(Project.slug == next_slug, Project.id != project.id).first()
        if clash is not None:
            raise HTTPException(status_code=409, detail=t("slug_taken", locale))  # type: ignore[arg-type]
        project.slug = next_slug
    elif name_changed and getattr(project, "published_at", None) is None:
        # Keep unpublished site URL in sync with the display name.
        candidate = _slugify(project.name)
        if candidate and candidate != project.slug:
            project.slug = _unique_slug_excluding(db, candidate, project.id)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("/{project_id}/stats", response_model=ProjectStatsOut)
def project_stats(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectStatsOut:
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    settings = get_settings()

    chat_ids = [row.id for row in db.query(Chat.id).filter(Chat.project_id == project.id).all()]
    messages_count = 0
    if chat_ids:
        messages_count = db.query(func.count(Message.id)).filter(Message.chat_id.in_(chat_ids)).scalar() or 0
    agent_runs_count = (
        db.query(func.count(AgentRun.id)).filter(AgentRun.project_id == project.id).scalar() or 0
    )
    comments_count = (
        db.query(func.count(PreviewComment.id)).filter(PreviewComment.project_id == project.id).scalar() or 0
    )

    try:
        files_count = len(list_files(str(project.id)))
    except Exception:
        files_count = 0

    storage_bytes = 0
    root = project_dir(str(project.id))
    skip = {"node_modules", ".git", "dist", ".vite"}
    try:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for name in filenames:
                try:
                    storage_bytes += (Path(dirpath) / name).stat().st_size
                except OSError:
                    continue
    except OSError:
        storage_bytes = 0

    usage_rows = db.query(SiteUsageDay).filter(SiteUsageDay.project_id == project.id).all()
    visitors_total = sum(int(getattr(row, "page_views", 0) or 0) for row in usage_rows)
    cutoff = (datetime.now(UTC) - timedelta(days=7)).strftime("%Y-%m-%d")
    visitors_7d = sum(
        int(getattr(row, "page_views", 0) or 0) for row in usage_rows if (row.day or "") >= cutoff
    )
    published = getattr(project, "published_at", None) is not None
    from app.services.domains import get_project_domain, sites_url_for_project

    stats_domain = get_project_domain(db, project.id)

    return ProjectStatsOut(
        slug=project.slug,
        status=project.status,
        preview_running=preview_babel.is_babel_preview_ready(str(project.id)),
        published=published,
        published_at=getattr(project, "published_at", None),
        sites_url=sites_url_for_project(settings, project, stats_domain) if published else None,
        created_at=project.created_at,
        updated_at=project.updated_at,
        visitors_total=visitors_total,
        visitors_7d=visitors_7d,
        files_count=files_count,
        messages_count=int(messages_count),
        agent_runs_count=int(agent_runs_count),
        comments_count=int(comments_count),
        storage_bytes=storage_bytes,
        tracking_ready=published,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_project(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    delete_project_full(db, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/card-preview", response_model=None)
def project_card_preview(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Static homepage thumbnail for project cards (iframe)."""
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    settings = get_settings()
    headers = {"Cache-Control": "private, max-age=120"}
    local = settings.projects_path / str(project.id) / "preview.html"
    if local.is_file():
        return FileResponse(local, media_type="text/html; charset=utf-8", headers=headers)
    if project.template_id:
        tpl = preview_path(project.template_id)
        if tpl is not None:
            return FileResponse(tpl, media_type="text/html; charset=utf-8", headers=headers)
    return HTMLResponse(
        """<!doctype html><html><head><meta charset="utf-8"/><style>
body{margin:0;min-height:100vh;display:grid;place-content:center;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif}
h1{margin:0;font-size:2rem} .a{color:#f2620a}
</style></head><body><h1><span class="a">F</span>orge</h1></body></html>""",
        headers=headers,
    )


@router.get("/{project_id}/thumbnail", include_in_schema=False)
def get_project_thumbnail(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_media_user),
    db: Session = Depends(get_db),
):
    """Persisted JPEG card thumb — browser loads via media `?access_token=`."""
    locale = resolve_locale(request)
    _owned_project(db, user, project_id, locale)
    path = _thumbnail_path(project_id)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="thumbnail_missing")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.put("/{project_id}/thumbnail", include_in_schema=False)
async def put_project_thumbnail(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the dashboard JPEG thumbnail (builder / dashboard backfill)."""
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)

    data = await request.body()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail_empty")
    if len(data) > THUMBNAIL_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail_too_large")
    if not data.startswith(_JPEG_MAGIC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail_not_jpeg")

    write_bytes(str(project.id), THUMBNAIL_FILENAME, data)
    project.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(project)
    return {"ok": True, "has_thumbnail": True, "updated_at": project.updated_at.isoformat()}


@router.post("/{project_id}/security-review")
async def security_review_project(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Optional Forge-style security review of generated site code (no auto-apply)."""
    locale = resolve_locale(request)
    _owned_project(db, user, project_id, locale)
    from app.services.orchestration.security_review import run_security_review
    from app.services.rodium_generation import resolve_generation_auth

    auth = await resolve_generation_auth(db, user)
    settings = get_settings()
    report = await run_security_review(
        project_id=str(project_id),
        auth=auth,
        model=settings.effective_default_model or "google/gemini-3.7-flash",
        locale=locale,  # type: ignore[arg-type]
    )
    return {"report": report}


@router.get("/{project_id}/chats", response_model=list[ChatOut])
def list_chats(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Chat]:
    _owned_project(db, user, project_id, resolve_locale(request))
    return db.query(Chat).filter(Chat.project_id == project_id).order_by(Chat.created_at.asc()).all()


@router.post("/{project_id}/chats", response_model=ChatOut, status_code=201)
def create_chat(
    project_id: UUID,
    body: ChatCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chat:
    locale = resolve_locale(request)
    _owned_project(db, user, project_id, locale)
    chat = Chat(project_id=project_id, title=body.title or t("main_chat", locale))
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat
