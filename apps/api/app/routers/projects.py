import asyncio
import logging
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from uuid import UUID, uuid4

import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
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
    ProjectCollaboratorOut,
    ProjectCreate,
    ProjectOut,
    ProjectPersonOut,
    ProjectStatsOut,
    ProjectUpdate,
)
from app.services import preview_babel, rate_limit
from app.services.capabilities import require_rodi_for_paid_capability
from app.services.frodi_cycle import current_frodi_cycle_key
from app.services.filesystem import list_files, project_dir, write_bytes
from app.services.project_access import accessible_project
from app.services.posthog_client import capture_for_user
from app.services.project_delete import delete_project_full, purge_site_prefix
from app.services.project_naming import suggest_project_name
from app.services.scaffold import (
    brand_placeholder_html,
    is_text_brand_placeholder,
    scaffold_vite_react,
)
from app.services.templates import fork_template, get_template, preview_path

logger = logging.getLogger("projects")

router = APIRouter(prefix="/projects", tags=["projects"])

THUMBNAIL_FILENAME = "thumbnail.jpg"
THUMBNAIL_MAX_BYTES = 800_000
# Empty/solid html2canvas fallbacks land around 1–2KB — reject so cards re-capture.
THUMBNAIL_MIN_BYTES = 2_500
MAX_PROJECTS_PER_USER = 50
PROJECT_CREATION_LIMIT_PER_HOUR = 10
PROJECT_CREATION_IP_LIMIT_PER_HOUR = 30
SECURITY_REVIEW_LIMIT_PER_HOUR = 5
SECURITY_REVIEW_USER_LIMIT_PER_HOUR = 10
SECURITY_REVIEW_IP_LIMIT_PER_HOUR = 30
# A project's slug becomes its public subdomain ({slug}.<sites domain>), so names
# the platform itself uses, or that visitors would read as ours (login., support.),
# must not be claimable. Mirrors the reserved-hostname check for custom domains
# in services/domains.py. A slug the user sets explicitly is refused; one derived
# from a project name gets an "-app" suffix instead (see _unique_slug_excluding).
RESERVED_SLUGS = frozenset(
    {
        "www", "api", "app", "mail", "smtp", "ftp", "ssh",
        "login", "auth", "oauth", "sso", "accounts", "signup",
        "admin", "adminer", "dashboard", "panel",
        "support", "help", "docs", "status", "billing",
        "sites", "forge", "cdn", "assets", "static",
        "security", "abuse", "noreply", "no-reply",
    }
)  # fmt: skip
# Minimal valid 1x1 JPEG (JFIF) used only as a size/type reference in tests.
_JPEG_MAGIC = b"\xff\xd8\xff"


def _thumbnail_path(project_id: str | UUID) -> Path:
    return project_dir(str(project_id)) / THUMBNAIL_FILENAME


def _has_thumbnail(project_id: str | UUID) -> bool:
    return _thumbnail_path(project_id).is_file()


def _project_out(
    project: Project,
    *,
    access_role: str = "owner",
    collaborators: list[ProjectPersonOut] | None = None,
) -> ProjectOut:
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
        platform=getattr(project, "platform", None) or "web",
        published_at=getattr(project, "published_at", None),
        created_at=project.created_at,
        updated_at=project.updated_at,
        has_thumbnail=_has_thumbnail(project.id),
        access_role=access_role,
        collaborators=collaborators or [],
    )


def _person_out(member: User) -> ProjectPersonOut | None:
    email = getattr(member, "email", None)
    if not email:
        return None
    return ProjectPersonOut(
        name=getattr(member, "name", None),
        email=email,
        avatar_url=getattr(member, "avatar_url", None),
    )


def _people_by_project(db: Session, project_ids: list[UUID]) -> dict[UUID, list[ProjectPersonOut]]:
    """Owner first, then accepted members, for the dashboard avatar stack.

    A shared project used to list only collaborators, so the invitee never saw
    the owner's face next to theirs.
    """
    from app.models import ProjectCollaborator

    if not project_ids:
        return {}
    grouped: dict[UUID, list[ProjectPersonOut]] = {}
    owners = (
        db.query(Project.id, User)
        .join(User, User.id == Project.user_id)
        .filter(Project.id.in_(project_ids))
        .all()
    )
    for pair in owners:
        try:
            project_id, owner = pair[0], pair[1]
        except (TypeError, IndexError, KeyError):
            continue
        person = _person_out(owner)
        if project_id is None or person is None:
            continue
        grouped.setdefault(project_id, []).append(person)

    rows = (
        db.query(ProjectCollaborator, User)
        .join(User, User.id == ProjectCollaborator.user_id)
        .filter(
            ProjectCollaborator.project_id.in_(project_ids),
            ProjectCollaborator.accepted_at.isnot(None),
        )
        .all()
    )
    for pair in rows:
        try:
            collab, member = pair[0], pair[1]
        except (TypeError, IndexError, KeyError):
            continue
        project_id = getattr(collab, "project_id", None)
        person = _person_out(member)
        if project_id is None or person is None:
            continue
        bucket = grouped.setdefault(project_id, [])
        if any(existing.email == person.email for existing in bucket):
            continue
        bucket.append(person)
    return grouped


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80] or "project"


def _reject_reserved_slug(slug: str, locale: str) -> None:
    if slug in RESERVED_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("slug_reserved", locale),  # type: ignore[arg-type]
        )


def _owned_project(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


def _authorized_project(
    db: Session,
    user: User,
    project_id: UUID,
    locale: str = "fr",
    *,
    require_edit: bool = False,
) -> Project:
    """Owner, or an invited collaborator (Canva-style share).

    Owner-only operations (rename, delete, share, stats) keep using
    ``_owned_project``. Read and generation paths use this so a shared project
    is actually usable by the people it was shared with.
    """
    return accessible_project(db, user, project_id, locale, require_edit=require_edit)


@router.get("", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectOut]:
    from app.models import ProjectCollaborator

    rows = db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()
    seen = {row.id for row in rows}
    shared: list[tuple[Project, str]] = []
    links = (
        db.query(ProjectCollaborator)
        .filter(
            ProjectCollaborator.user_id == user.id,
            ProjectCollaborator.accepted_at.isnot(None),
        )
        .all()
    )
    for link in links:
        if not isinstance(link, ProjectCollaborator) or link.project_id in seen:
            continue
        shared_project = db.get(Project, link.project_id)
        if shared_project is None or shared_project.user_id == user.id:
            continue
        seen.add(shared_project.id)
        role = "viewer" if link.role == "viewer" else "editor"
        shared.append((shared_project, role))
    people = _people_by_project(db, list(seen))
    out = [
        _project_out(row, collaborators=people.get(row.id, []))
        for row in rows
    ]
    out.extend(
        _project_out(project, access_role=role, collaborators=people.get(project.id, []))
        for project, role in shared
    )
    out.sort(key=lambda item: item.updated_at, reverse=True)
    return out


@router.get("/quota")
def project_quota(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Preflight for the create UI: how many projects the plan allows vs used.

    Lets Forge warn a Free user (1 project) BEFORE they pick a template or fire
    a prompt, instead of only failing the POST. `limit=None` means unlimited.
    """
    from app.services.entitlements import get_entitlements, max_projects_for

    used = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id, Project.status != "locked")
        .scalar()
        or 0
    )
    limit = max_projects_for(db, user, MAX_PROJECTS_PER_USER)
    ent = get_entitlements(db, user)
    return {
        "used": used,
        "limit": limit,
        "can_create": limit is None or used < limit,
        "plan": ent.plan_slug if ent is not None else None,
    }


def _unique_slug(db: Session, base: str) -> str:
    return _unique_slug_excluding(db, base, None)


def _unique_slug_excluding(db: Session, base: str, exclude_id: UUID | None) -> str:
    """Pick a globally unique project slug (required for {slug}.lvh.me routing).

    This is where a display name becomes a slug (creating a project, or renaming
    an unpublished one). The user never typed a slug there, so a name that lands
    on a reserved one is not refused: it falls back to "<name>-app" and then goes
    through the usual uniqueness loop. A slug the user sets explicitly is checked
    separately, in update_project.
    """
    base_slug = _slugify(base)
    if base_slug in RESERVED_SLUGS:
        base_slug = f"{base_slug}-app"
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
    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t("email_not_verified", locale),
        )
    # Linked Rodium accounts must have RODI before creating / forking projects
    # (templates included). Frontend preflights via GET /auth/rodium/account?fresh=1
    # which refreshes the wallet cache this gate reads.
    if user.rodium_sub:
        require_rodi_for_paid_capability(user, db)
    rate_limit.enforce(
        request,
        "project-create-ip",
        limit=PROJECT_CREATION_IP_LIMIT_PER_HOUR,
        window_seconds=3600,
    )
    rate_limit.enforce(
        request,
        "project-create",
        limit=PROJECT_CREATION_LIMIT_PER_HOUR,
        window_seconds=3600,
        subject=str(user.id),
    )
    # Serialize the count-and-create decision per account so concurrent
    # requests cannot all observe the last free quota slot.
    db.query(User.id).filter(User.id == user.id).with_for_update().one()
    project_count = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id, Project.status != "locked")
        .scalar()
        or 0
    )
    from app.services.entitlements import get_entitlements, max_projects_for

    limit = max_projects_for(db, user, MAX_PROJECTS_PER_USER)
    if limit is not None and project_count >= limit:
        ent = get_entitlements(db, user)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "project_quota_exceeded",
                "message": (
                    f"Votre plan permet de créer au maximum {limit} projet(s). "
                    "Passez à un plan supérieur pour en créer davantage."
                ),
                "limit": limit,
                "used": project_count,
                "plan": ent.plan_slug if ent is not None else None,
                "actions": ["upgrade"],
            },
        )

    template_id = (body.template_id or "").strip() or None
    prompt = (body.prompt or "").strip()
    platform = (body.platform or "web").strip().lower()
    if platform not in ("web", "mobile"):
        platform = "web"
    if template_id:
        meta_for_kind = get_template(template_id)
        if meta_for_kind is not None:
            platform = meta_for_kind.kind if meta_for_kind.kind in ("web", "mobile") else "web"
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
        platform=platform,
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
            await asyncio.to_thread(
                scaffold_vite_react,
                str(project.id),
                project.name,
                platform,
            )
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
            "platform": platform,
            "has_prompt": bool(prompt),
        },
    )
    return _project_out(project)


class InviteTokenBody(BaseModel):
    token: str = Field(min_length=20, max_length=256)


def _invite_or_404(db: Session, raw: str, locale: str):
    from app.models import ProjectInvite
    from app.services.project_invites import find_by_token, invite_status

    invite = find_by_token(db, raw)
    if not isinstance(invite, ProjectInvite):
        raise HTTPException(status_code=404, detail=t("invite_not_found", locale))
    state = invite_status(invite)
    if state == "expired":
        raise HTTPException(status_code=400, detail=t("invite_expired", locale))
    if state == "declined":
        raise HTTPException(status_code=400, detail=t("invite_declined", locale))
    return invite, state


@router.get("/invites/preview")
def preview_project_invite(
    token: str, request: Request, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Public summary of an invitation. The token is the secret; the page is open."""
    from app.services.project_invites import find_by_token, invite_status

    locale = resolve_locale(request)
    invite = find_by_token(db, token)
    if invite is None:
        raise HTTPException(status_code=404, detail=t("invite_not_found", locale))
    project = db.get(Project, invite.project_id)
    inviter = db.get(User, invite.invited_by) if invite.invited_by else None
    return {
        "status": invite_status(invite),
        "email": invite.email,
        "role": invite.role,
        "project_name": project.name if project is not None else "",
        "inviter_name": (inviter.name or inviter.email) if inviter is not None else "",
    }


@router.post("/invites/accept")
def accept_project_invite(
    body: InviteTokenBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Accept an invitation. Access opens only here."""
    from app.models import ProjectCollaborator

    locale = resolve_locale(request)
    invite, _state = _invite_or_404(db, body.token, locale)
    if user.email.strip().lower() != invite.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t("invite_email_mismatch", locale, email=invite.email),
        )
    project = db.get(Project, invite.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=t("invite_not_found", locale))
    row = db.get(ProjectCollaborator, (project.id, user.id))
    now = datetime.now(UTC)
    if row is None:
        row = ProjectCollaborator(
            project_id=project.id,
            user_id=user.id,
            role="viewer" if invite.role == "viewer" else "editor",
            invited_by=invite.invited_by,
            accepted_at=now,
            frodi_cap_per_cycle=invite.frodi_cap_per_cycle,
        )
        db.add(row)
    else:
        row.role = "viewer" if invite.role == "viewer" else "editor"
        row.frodi_cap_per_cycle = invite.frodi_cap_per_cycle
        if row.accepted_at is None:
            row.accepted_at = now
    if invite.accepted_at is None:
        invite.accepted_at = now
    invite.declined_at = None
    project.visibility = "shared"
    db.commit()
    return {"project_id": str(project.id), "status": "accepted"}


@router.post("/invites/decline")
def decline_project_invite(
    body: InviteTokenBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    from app.models import ProjectCollaborator

    locale = resolve_locale(request)
    invite, state = _invite_or_404(db, body.token, locale)
    if user.email.strip().lower() != invite.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t("invite_email_mismatch", locale, email=invite.email),
        )
    if state == "accepted":
        return {"status": "accepted"}
    invite.declined_at = datetime.now(UTC)
    row = db.get(ProjectCollaborator, (invite.project_id, user.id))
    if row is not None and row.accepted_at is None:
        db.delete(row)
    db.commit()
    return {"status": "declined"}


def _project_detail(db: Session, user: User, project: Project) -> ProjectOut:
    from app.models import ProjectCollaborator

    role = "owner"
    if project.user_id != user.id:
        row = db.get(ProjectCollaborator, (project.id, user.id))
        role = "viewer" if row is not None and row.role == "viewer" else "editor"
    people = _people_by_project(db, [project.id]).get(project.id, [])
    return _project_out(project, access_role=role, collaborators=people)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    project = _authorized_project(db, user, project_id, resolve_locale(request))
    return _project_detail(db, user, project)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    locale = resolve_locale(request)
    project = accessible_project(db, user, project_id, locale, require_edit=True)
    is_owner = project.user_id == user.id
    name_changed = False
    old_slug: str | None = None
    if body.name is not None:
        next_name = body.name.strip()
        if not next_name:
            raise HTTPException(status_code=400, detail=t("project_name_required", locale))  # type: ignore[arg-type]
        if next_name != project.name:
            project.name = next_name
            name_changed = True
    if body.slug is not None and not is_owner:
        raise HTTPException(status_code=403, detail=t("project_link_owner_only", locale))
    if body.slug is not None:
        next_slug = _slugify(body.slug)
        if not next_slug:
            raise HTTPException(status_code=400, detail=t("invalid_slug", locale))  # type: ignore[arg-type]
        _reject_reserved_slug(next_slug, locale)
        clash = db.query(Project).filter(Project.slug == next_slug, Project.id != project.id).first()
        if clash is not None:
            raise HTTPException(status_code=409, detail=t("slug_taken", locale))  # type: ignore[arg-type]
        if next_slug != project.slug:
            old_slug = project.slug
            project.slug = next_slug
    elif is_owner and name_changed and getattr(project, "published_at", None) is None:
        # Keep unpublished site URL in sync with the display name.
        candidate = _slugify(project.name)
        if candidate and candidate != project.slug:
            old_slug = project.slug
            project.slug = _unique_slug_excluding(db, candidate, project.id)

    # Drop the old public prefix BEFORE commit. Commit frees the uniqueness
    # constraint; purging after that races another tenant's claim+publish and
    # can delete their freshly uploaded objects under the same prefix (TOCTOU).
    if old_slug and old_slug != project.slug:
        try:
            purge_site_prefix(old_slug)
        except Exception:
            logger.exception(
                "Failed to cleanup old published assets slug=%s — aborting rename",
                old_slug,
            )
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=t("slug_purge_failed", locale),  # type: ignore[arg-type]
            )

    db.commit()
    db.refresh(project)

    return _project_detail(db, user, project)


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
    project = accessible_project(db, user, project_id, locale)
    settings = get_settings()
    headers = {"Cache-Control": "private, max-age=120"}
    local = settings.projects_path / str(project.id) / "preview.html"
    if local.is_file():
        try:
            html = local.read_text(encoding="utf-8")
        except OSError:
            html = ""
        if html and not is_text_brand_placeholder(html):
            return FileResponse(local, media_type="text/html; charset=utf-8", headers=headers)
        # Old orange-"F"orge watermark → real wordmark (also covers empty/corrupt files).
        return HTMLResponse(brand_placeholder_html(), headers=headers)
    if project.template_id:
        tpl = preview_path(project.template_id)
        if tpl is not None:
            return FileResponse(tpl, media_type="text/html; charset=utf-8", headers=headers)
    return HTMLResponse(brand_placeholder_html(), headers=headers)


@router.get("/{project_id}/thumbnail", include_in_schema=False)
def get_project_thumbnail(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_media_user),
    db: Session = Depends(get_db),
):
    """Persisted JPEG card thumb — browser loads via media `?access_token=`."""
    locale = resolve_locale(request)
    accessible_project(db, user, project_id, locale)
    path = _thumbnail_path(project_id)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="thumbnail_missing")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, max-age=300",
            # Allow <img> from the web app on localhost when the API is 127.0.0.1.
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
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
    project = accessible_project(db, user, project_id, locale, require_edit=True)

    data = await request.body()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail_empty")
    if len(data) < THUMBNAIL_MIN_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail_too_small")
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
    rate_limit.enforce(
        request,
        "security-review-user",
        limit=SECURITY_REVIEW_USER_LIMIT_PER_HOUR,
        window_seconds=3600,
        subject=str(user.id),
    )
    _owned_project(db, user, project_id, locale)
    rate_limit.enforce(
        request,
        "security-review-ip",
        limit=SECURITY_REVIEW_IP_LIMIT_PER_HOUR,
        window_seconds=3600,
    )
    rate_limit.enforce(
        request,
        "security-review-project",
        limit=SECURITY_REVIEW_LIMIT_PER_HOUR,
        window_seconds=3600,
        subject=str(project_id),
    )
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
    _authorized_project(db, user, project_id, resolve_locale(request))
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
    _authorized_project(db, user, project_id, locale, require_edit=True)
    chat = Chat(project_id=project_id, title=body.title or t("main_chat", locale))
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


class ShareProjectBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: str = "editor"
    billing_policy: str = "owner_pays"
    frodi_cap_per_cycle: int | None = Field(default=None, ge=0)


def _notify_project_invite(
    project: Project,
    inviter: User,
    email: str,
    role: str,
    raw_token: str,
    locale: str,
) -> bool:
    """Mail the invitation. Failure is logged inside ``mail.send`` and does not undo the row."""
    from app.services import mail

    role_key = "mail_invite_role_viewer" if role == "viewer" else "mail_invite_role_editor"
    inviter_name = (getattr(inviter, "name", None) or getattr(inviter, "email", None) or "Forge").strip()
    url = get_settings().web_url(f"/invite?token={quote(raw_token)}")
    return mail.send(
        mail.build_project_invite(
            email,
            url,
            inviter=inviter_name,
            project=getattr(project, "name", None) or "Forge",
            role=t(role_key, locale),  # type: ignore[arg-type]
            locale=locale,  # type: ignore[arg-type]
        )
    )


def _share_role(role: str) -> str:
    return "viewer" if role == "viewer" else "editor"


def _share_cap(policy: str, explicit: int | None) -> int | None:
    # owner_pays with no explicit cap → default guardrail so an invitee cannot
    # drain the owner's balance. `0` is an explicit "no cap". each_pays_own
    # ignores the cap (the invitee spends their own FRODI).
    if policy == "each_pays_own":
        return None
    if explicit is None:
        return get_settings().forge_default_collab_frodi_cap
    return explicit


_SHARE_SEATS: dict[str, int | None] = {
    "free": 0,
    "starter": 3,
    "builder": 10,
    "pro": None,
    "scale": None,
    "team-pro": None,
    "team-scale": None,
}


def _share_seat_limit(db: Session, user: User) -> int | None:
    """People this plan may invite. None means unlimited. No cache means unrestricted."""
    from app.services.entitlements import get_entitlements

    row = get_entitlements(db, user)
    if row is None or not row.plan_slug:
        return None
    if row.plan_slug not in _SHARE_SEATS:
        return 0
    return _SHARE_SEATS[row.plan_slug]


@router.post("/{project_id}/share")
def share_project(
    project_id: UUID,
    body: ShareProjectBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Invite by email. The project stays closed until the invitation is accepted."""
    from app.models import ProjectCollaborator, ProjectInvite
    from app.services.project_invites import INVITE_TTL, mint_token

    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@", 1)[-1]:
        raise HTTPException(status_code=422, detail=t("invite_invalid_email", locale))
    invitee = db.query(User).filter(User.email.ilike(email)).one_or_none()
    if invitee is not None and invitee.id == user.id:
        raise HTTPException(status_code=400, detail=t("invite_self", locale))

    limit = _share_seat_limit(db, user)
    if limit is not None and limit <= 0:
        raise HTTPException(status_code=422, detail=t("share_not_in_plan", locale))
    already_known = False
    if limit is not None:
        collab_emails = {
            str(member.email).lower()
            for member in (
                db.query(User)
                .join(ProjectCollaborator, ProjectCollaborator.user_id == User.id)
                .filter(ProjectCollaborator.project_id == project.id)
                .all()
            )
            if getattr(member, "email", None)
        }
        now_limit = datetime.now(UTC)
        pending_emails = {
            invite.email.lower()
            for invite in db.query(ProjectInvite)
            .filter(
                ProjectInvite.project_id == project.id,
                ProjectInvite.declined_at.is_(None),
                ProjectInvite.accepted_at.is_(None),
                ProjectInvite.expires_at > now_limit,
            )
            .all()
            if isinstance(invite, ProjectInvite)
        }
        occupied = collab_emails | pending_emails
        already_known = email in occupied
        if not already_known and len(occupied) >= limit:
            raise HTTPException(status_code=422, detail=t("share_limit", locale, n=limit))

    role = _share_role(body.role)
    policy = body.billing_policy if body.billing_policy in ("owner_pays", "each_pays_own") else project.billing_policy
    cap = _share_cap(policy, body.frodi_cap_per_cycle)

    row = None
    if invitee is not None:
        row = (
            db.query(ProjectCollaborator)
            .filter(
                ProjectCollaborator.project_id == project.id,
                ProjectCollaborator.user_id == invitee.id,
            )
            .one_or_none()
        )
        if not isinstance(row, ProjectCollaborator):
            row = None

    already = row is not None and row.accepted_at is not None
    if row is None and invitee is not None:
        row = ProjectCollaborator(
            project_id=project.id,
            user_id=invitee.id,
            role=role,
            invited_by=user.id,
            frodi_cap_per_cycle=cap,
        )
        db.add(row)
    elif row is not None:
        row.role = role
        row.frodi_cap_per_cycle = cap

    project.visibility = "shared"
    project.billing_policy = policy

    mail_sent = False
    if not already:
        found = (
            db.query(ProjectInvite)
            .filter(ProjectInvite.project_id == project.id, ProjectInvite.email == email)
            .one_or_none()
        )
        invite = found if isinstance(found, ProjectInvite) else None
        raw, token_hash = mint_token()
        now = datetime.now(UTC)
        if invite is None:
            invite = ProjectInvite(
                id=uuid4(),
                project_id=project.id,
                email=email,
                role=role,
                invited_by=user.id,
                invited_at=now,
                expires_at=now + INVITE_TTL,
                token_hash=token_hash,
                frodi_cap_per_cycle=cap,
            )
            db.add(invite)
        else:
            invite.role = role
            invite.invited_by = user.id
            invite.invited_at = now
            invite.expires_at = now + INVITE_TTL
            invite.token_hash = token_hash
            invite.accepted_at = None
            invite.declined_at = None
            invite.frodi_cap_per_cycle = cap
            db.add(invite)
        db.commit()
        mail_sent = _notify_project_invite(project, user, email, role, raw, locale)
    else:
        db.commit()

    return {
        "shared_with": str(invitee.id) if invitee is not None else None,
        "billing_policy": project.billing_policy,
        "frodi_cap_per_cycle": cap,
        "pending": not already,
        "mail_sent": mail_sent,
        "already_member": already,
    }


def _actor_uid_for(member: User) -> str:
    """The id the gateway cap counter is keyed by — mirrors chats.py."""
    return member.rodium_sub or str(member.id)


def _fetch_collab_usage(owner_sub: str, project_id: UUID, actor_uids: list[str]) -> dict[str, float]:
    """Ask the gateway how much each collaborator spent this cycle (owner_pays).

    Reads the F-1 cap counter (the exact consumption ledger). Best-effort: any
    error just yields an empty map, so the panel still renders caps.
    """
    settings = get_settings()
    if not settings.forge_cloud_enabled or not owner_sub or not actor_uids:
        return {}
    url = settings.rodium_gateway_internal_url.rstrip("/") + "/internal/forge/collab-usage"
    try:
        resp = httpx.post(
            url,
            headers={"X-Forge-Gateway-Token": settings.rodium_forge_gateway_token},
            json={
                "owner_uid": owner_sub,
                "project_id": str(project_id),
                "cycle_key": current_frodi_cycle_key(),
                "actor_uids": actor_uids,
            },
            timeout=8.0,
        )
    except httpx.HTTPError:
        return {}
    if resp.status_code != 200:
        return {}
    body = resp.json()
    usage = body.get("usage") if isinstance(body, dict) else None
    return usage if isinstance(usage, dict) else {}


@router.get("/{project_id}/collaborators", response_model=list[ProjectCollaboratorOut])
def list_collaborators(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectCollaboratorOut]:
    """Team members on a shared project (owner-only), for the Share/Team panel.

    Returns each collaborator's role, per-cycle FRODI cap, and — on an
    ``owner_pays`` project — how much of the owner's FRODI they have spent this
    cycle (read from the same cap counter that enforces the ceiling). Live wallet
    *balances* still live on the RodiumAi platform; this is cycle consumption.
    """
    from app.models import ProjectCollaborator, ProjectInvite

    project = _owned_project(db, user, project_id, resolve_locale(request))
    rows = (
        db.query(ProjectCollaborator, User)
        .join(User, User.id == ProjectCollaborator.user_id)
        .filter(ProjectCollaborator.project_id == project.id)
        .order_by(ProjectCollaborator.invited_at.asc())
        .all()
    )
    # SQLAlchemy Row is not a tuple (2.0), so a tuple-only filter hid every member.
    member_rows = []
    for pair in rows:
        try:
            collab, member = pair[0], pair[1]
        except (TypeError, IndexError, KeyError):
            continue
        if getattr(member, "email", None):
            member_rows.append((collab, member))

    usage: dict[str, float] = {}
    if project.billing_policy == "owner_pays" and user.rodium_sub:
        usage = _fetch_collab_usage(
            user.rodium_sub, project.id, [_actor_uid_for(m) for _c, m in member_rows]
        )

    known = {str(member.email).lower() for _collab, member in member_rows}
    listed = [
        ProjectCollaboratorOut(
            user_id=member.id,
            email=member.email,
            name=member.name,
            role=collab.role,
            status="accepted" if collab.accepted_at is not None else "pending",
            frodi_cap_per_cycle=collab.frodi_cap_per_cycle,
            frodi_used_this_cycle=usage.get(_actor_uid_for(member)),
            invited_at=collab.invited_at,
            accepted_at=collab.accepted_at,
        )
        for collab, member in member_rows
    ]
    pending = (
        db.query(ProjectInvite)
        .filter(ProjectInvite.project_id == project.id, ProjectInvite.declined_at.is_(None))
        .all()
    )
    for invite in pending:
        if not isinstance(invite, ProjectInvite) or invite.email.lower() in known:
            continue
        if invite.accepted_at is not None:
            continue
        listed.append(
            ProjectCollaboratorOut(
                email=invite.email,
                role=invite.role,
                status="pending",
                frodi_cap_per_cycle=invite.frodi_cap_per_cycle,
                invited_at=invite.invited_at,
            )
        )
    return listed


@router.delete("/{project_id}/collaborators", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_collaborator(
    project_id: UUID,
    request: Request,
    user_id: UUID | None = None,
    email: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Owner removes a member. Access ends immediately, including a pending invite."""
    from app.models import ProjectCollaborator, ProjectInvite

    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    target = (email or "").strip().lower()
    member = db.get(User, user_id) if user_id is not None else None
    if member is None and target:
        member = db.query(User).filter(User.email.ilike(target)).one_or_none()
    if member is None and not target:
        raise HTTPException(status_code=422, detail=t("invite_invalid_email", locale))
    deleted_member = False
    if member is not None:
        target = member.email.strip().lower()
        row = db.get(ProjectCollaborator, (project.id, member.id))
        if row is not None:
            db.delete(row)
            deleted_member = True
    removed_invite = False
    if target:
        invites = (
            db.query(ProjectInvite)
            .filter(ProjectInvite.project_id == project.id, ProjectInvite.email == target)
            .all()
        )
        for invite in invites:
            if isinstance(invite, ProjectInvite):
                db.delete(invite)
                removed_invite = True
    if not deleted_member and not removed_invite:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))
    db.flush()
    remaining = (
        db.query(ProjectCollaborator)
        .filter(ProjectCollaborator.project_id == project.id)
        .count()
    )
    if remaining == 0:
        project.visibility = "private"
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
