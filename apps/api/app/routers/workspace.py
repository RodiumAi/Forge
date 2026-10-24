"""Read models of the logged-in dashboard, plus project duplication.

- ``GET /workspace/activity``: the latest generation of each project the user
  can open (for the state badges) and the runs still in progress, with their
  plan steps (the overview's "resume" card).
- ``GET /workspace/usage``: generations per week and per project kind (the
  billing page's usage chart). Counted from ``agent_runs``; FRODI amounts live
  on the gateway and are not broken down by kind.
- ``POST /projects/{id}/duplicate``: copies an owned project (files, history,
  thumbnail) into a new project under the same plan quota as a create.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale, t
from app.kinds import KIND_IDS, kind_enabled, resolve_kind
from app.models import AgentRun, Chat, Project, ProjectCollaborator, User
from app.schemas import ProjectOut
from app.services import rate_limit
from app.services.posthog_client import capture_for_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["workspace"])

#: Run states that mean Forge is still on it (or waiting on the user).
ACTIVE_STATES = frozenset({"running", "awaiting_clarify", "awaiting_plan_confirm"})
#: A run left "running" longer than this is shown as idle, not as building.
ACTIVE_WINDOW = timedelta(hours=3)
MAX_STEPS = 8
#: Never copied into a duplicate: build output and installed packages.
_SKIP_ON_COPY = ("node_modules", "dist", ".vite", "__pycache__", ".turbo")


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def plan_steps(raw: str | None) -> list[dict[str, str]]:
    """Titles and states of a run's plan (``plan_json``), at most MAX_STEPS."""
    if not raw:
        return []
    try:
        plan = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(plan, list):
        return []
    steps: list[dict[str, str]] = []
    for item in plan:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        state = str(item.get("status") or "pending")
        steps.append({"title": title[:140], "status": state})
    return steps[:MAX_STEPS]


def summarize_runs(
    runs: list[Any],
    projects: dict[str, Any],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Latest run state per project and the runs still in progress.

    ``runs`` must be ordered newest first (``updated_at`` descending).
    """
    now = now or datetime.now(UTC)
    states: dict[str, str] = {}
    active: list[dict[str, Any]] = []
    for run in runs:
        pid = str(run.project_id)
        if pid in states or pid not in projects:
            continue
        states[pid] = str(run.status)
        updated = _aware(getattr(run, "updated_at", None)) or now
        if run.status not in ACTIVE_STATES or now - updated > ACTIVE_WINDOW:
            continue
        project = projects[pid]
        steps = plan_steps(getattr(run, "plan_json", None))
        active.append(
            {
                "project_id": pid,
                "project_name": project.name,
                "platform": resolve_kind(getattr(project, "platform", None)),
                "run_id": str(run.id),
                "chat_id": str(run.chat_id),
                "status": str(run.status),
                "steps": steps,
                "done": sum(1 for s in steps if s["status"] == "done"),
                "updated_at": updated.isoformat(),
            }
        )
    return {"states": states, "active": active[:3]}


def week_start(day: datetime) -> datetime:
    """Monday 00:00 UTC of the week holding ``day``."""
    day = _aware(day) or datetime.now(UTC)
    monday = day.astimezone(UTC) - timedelta(days=day.astimezone(UTC).weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def bucket_usage(rows: list[tuple[datetime, str | None]], first_week: datetime, weeks: int) -> list[dict]:
    """Counts of runs per week (oldest first) and per kind."""
    buckets = [
        {"start": (first_week + timedelta(weeks=i)).date().isoformat(), "counts": {k: 0 for k in KIND_IDS}}
        for i in range(weeks)
    ]
    for created, platform in rows:
        stamp = _aware(created)
        if stamp is None:
            continue
        index = (week_start(stamp) - first_week).days // 7
        if 0 <= index < weeks:
            kind = resolve_kind(platform)
            buckets[index]["counts"][kind] = buckets[index]["counts"].get(kind, 0) + 1
    return buckets


def _visible_projects(db: Session, user: User) -> dict[str, Any]:
    """Projects the user owns or accepted an invite to, by id."""
    rows = db.query(Project).filter(Project.user_id == user.id).all()
    out = {str(row.id): row for row in rows}
    links = (
        db.query(ProjectCollaborator)
        .filter(ProjectCollaborator.user_id == user.id, ProjectCollaborator.accepted_at.isnot(None))
        .all()
    )
    for link in links:
        pid = str(getattr(link, "project_id", ""))
        if pid and pid not in out:
            shared = db.get(Project, link.project_id)
            if shared is not None:
                out[pid] = shared
    return out


@router.get("/workspace/activity")
def workspace_activity(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    projects = _visible_projects(db, user)
    if not projects:
        return {"states": {}, "active": []}
    ids = [p.id for p in projects.values()]
    runs = (
        db.query(AgentRun)
        .filter(AgentRun.project_id.in_(ids))
        .order_by(AgentRun.updated_at.desc())
        .limit(400)
        .all()
    )
    return summarize_runs(list(runs), projects)


@router.get("/workspace/usage")
def workspace_usage(
    weeks: int = Query(6, ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    first = week_start(datetime.now(UTC)) - timedelta(weeks=weeks - 1)
    rows = (
        db.query(AgentRun.created_at, Project.platform)
        .join(Project, Project.id == AgentRun.project_id)
        .filter(AgentRun.user_id == user.id, AgentRun.created_at >= first)
        .all()
    )
    return {"unit": "generations", "weeks": bucket_usage([(r[0], r[1]) for r in rows], first, weeks)}


def _copy_tree(source_id: str, dest_id: str) -> None:
    root = get_settings().projects_path
    source = root / source_id
    dest = root / dest_id
    if dest.exists() and any(dest.iterdir()):
        raise FileExistsError(f"Project directory already exists: {dest_id}")
    if not source.is_dir():
        dest.mkdir(parents=True, exist_ok=True)
        return
    shutil.copytree(source, dest, ignore=shutil.ignore_patterns(*_SKIP_ON_COPY), dirs_exist_ok=True)


@router.post("/projects/{project_id}/duplicate", response_model=ProjectOut, status_code=201)
async def duplicate_project(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    # Shared helpers of the projects router (slug, quota, response shape).
    from app.routers.projects import (
        MAX_PROJECTS_PER_USER,
        PROJECT_CREATION_LIMIT_PER_HOUR,
        _owned_project,
        _project_out,
        _unique_slug,
    )
    from app.services.entitlements import get_entitlements, max_projects_for

    locale = resolve_locale(request)
    if user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=t("email_not_verified", locale))
    source = _owned_project(db, user, project_id, locale)
    rate_limit.enforce(
        request,
        "project-create",
        limit=PROJECT_CREATION_LIMIT_PER_HOUR,
        window_seconds=3600,
        subject=str(user.id),
    )
    platform = resolve_kind(getattr(source, "platform", None))
    if not kind_enabled(platform):
        raise SitesError(400, "KIND_DISABLED", "This project type is not available yet.")

    db.query(User.id).filter(User.id == user.id).with_for_update().one()
    used = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id, Project.status != "locked")
        .scalar()
        or 0
    )
    limit = max_projects_for(db, user, MAX_PROJECTS_PER_USER)
    if limit is not None and used >= limit:
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
                "used": used,
                "plan": ent.plan_slug if ent is not None else None,
                "actions": ["upgrade"],
            },
        )

    name = t("project_copy_name", locale, name=source.name)[:200]
    copy = Project(
        user_id=user.id,
        name=name,
        slug=_unique_slug(db, name),
        status="ready",
        template_id=source.template_id,
        platform=platform,
        design_brief=getattr(source, "design_brief", None),
        design_system_project_id=getattr(source, "design_system_project_id", None),
        design_system_version=getattr(source, "design_system_version", None),
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    try:
        await asyncio.to_thread(_copy_tree, str(source.id), str(copy.id))
    except Exception as exc:
        logger.warning("duplicate of %s failed", source.id, exc_info=True)
        db.delete(copy)
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    db.add(Chat(project_id=copy.id, title=t("main_chat", locale)))
    db.commit()
    capture_for_user(user, "forge_project_duplicated", {"project_id": str(copy.id), "platform": platform})
    return _project_out(copy)
