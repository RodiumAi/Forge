"""Published-site intake (forms, visits) and the owner's inbox / analytics.

Public routes (`/v1/sites/*`) are called by published sites, through the
gateway on the site's own origin; they are rate-limited per visitor and per
site and accept only small JSON bodies. Owner routes live under
`/projects/{id}/...` and use the usual project access rules.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import SessionLocal, get_db
from app.i18n import resolve_locale, t
from app.models import FormSubmission, Project, SitePageDay, SiteUsageDay, User
from app.services import rate_limit, site_events
from app.services.project_access import accessible_project

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/v1/sites", tags=["sites"])
router = APIRouter(prefix="/projects", tags=["site-events"])

FORMS_PER_VISITOR_PER_10MIN = 8
FORMS_PER_SITE_PER_DAY = 300
HITS_PER_VISITOR_PER_MIN = 120
NOTIFY_PER_SITE_PER_DAY = 30


class FormIn(BaseModel):
    form: str = Field(default="form", max_length=64)
    data: dict = Field(default_factory=dict)
    page: str = Field(default="", max_length=300)


class HitIn(BaseModel):
    """Beacon payload; oversized values are cut, not rejected (the visit still counts)."""

    p: str = "/"
    r: str = ""

    @field_validator("p", "r", mode="before")
    @classmethod
    def _cut(cls, value: object) -> str:
        return str(value or "")[:500]


def _site_project(db: Session, forwarded_host: str, key: str | None) -> Project:
    """The site a request is for: the gateway host (published sites) or a form key (exports)."""
    project = None
    if forwarded_host:
        project = site_events.published_project(db, site_events.slug_for_host(forwarded_host))
    if project is None and key:
        project = site_events.project_from_form_key(db, key)
    if project is None:
        raise HTTPException(status_code=404, detail="unknown_site")
    return project


def _notify_owner(project_id: UUID, submission_id: UUID) -> None:
    """Mail the owner a summary of the submission (best effort, capped per day)."""
    from app.config import get_settings
    from app.services import mail

    try:
        with SessionLocal() as db:
            project = db.get(Project, project_id)
            row = db.get(FormSubmission, submission_id)
            owner = db.get(User, project.user_id) if project else None
            if not project or not row or not owner or not owner.email:
                return
            locale = "fr"
            fields = json.loads(row.data_json or "{}")
            url = get_settings().web_url(f"/projects/{project.id}?view=more&subview=forms")
            message = mail.build_form_submission(
                owner.email,
                project_name=project.name,
                form_name=row.form_name,
                fields=fields,
                url=url,
                locale=locale,  # type: ignore[arg-type]
            )
        mail.send(message)
    except Exception:
        logger.exception("form notification failed for %s", submission_id)


@public_router.post("/forms", status_code=200)
def submit_form(
    body: FormIn,
    request: Request,
    background: BackgroundTasks,
    key: str | None = Query(default=None, max_length=64),
    x_rodium_forwarded_host: str = Header(default=""),
    user_agent: str = Header(default=""),
    db: Session = Depends(get_db),
) -> dict:
    ip = site_events.visitor_ip(request)
    rate_limit.enforce(
        request, "site-form-visitor", FORMS_PER_VISITOR_PER_10MIN, 600, subject=site_events.rate_subject(ip)
    )
    project = _site_project(db, x_rodium_forwarded_host, key)
    cleaned = site_events.clean_submission(body.form, body.data)
    if cleaned is None:
        raise HTTPException(status_code=422, detail=t("form_invalid", resolve_locale(request)))
    form_name, fields = cleaned
    if site_events.is_honeypot_hit(fields):
        return {"ok": True}  # silently dropped, without using the site's daily quota
    # Counted only for submissions that are about to be stored, so junk cannot
    # use up the site's day.
    rate_limit.enforce(request, "site-form-site", FORMS_PER_SITE_PER_DAY, 86_400, subject=str(project.id))
    day = datetime.now(UTC).date().isoformat()
    visitor = site_events.visitor_hash(ip, user_agent, day)
    row = site_events.store_submission(
        db, project, form=form_name, fields=fields, page=body.page, visitor=visitor
    )
    try:
        rate_limit.enforce(
            request, "site-form-notify", NOTIFY_PER_SITE_PER_DAY, 86_400, subject=str(project.id)
        )
        background.add_task(_notify_owner, project.id, row.id)
    except HTTPException:
        pass  # past the daily mail cap: the submission is still in the inbox
    return {"ok": True}


def _record_hit(forwarded_host: str, key: str | None, path: str, ip: str, user_agent: str) -> None:
    with SessionLocal() as db:
        try:
            project = _site_project(db, forwarded_host, key)
        except HTTPException:
            return
        day = datetime.now(UTC).date().isoformat()
        try:
            site_events.record_visit(
                db, project, path=path, visitor=site_events.visitor_hash(ip, user_agent, day)
            )
        except Exception:
            logger.exception("visit not recorded for %s", project.slug)
            db.rollback()


@public_router.post("/hit", status_code=204)
async def record_hit(
    request: Request,
    key: str | None = Query(default=None, max_length=64),
    x_rodium_forwarded_host: str = Header(default=""),
    user_agent: str = Header(default=""),
) -> Response:
    # sendBeacon posts a Blob: parse the body leniently, whatever its type.
    try:
        raw = await request.body()
        payload = HitIn.model_validate(json.loads(raw[:2000] or b"{}"))
    except Exception:
        return Response(status_code=204)
    if site_events.is_bot(user_agent):
        return Response(status_code=204)
    ip = site_events.visitor_ip(request)
    rate_limit.enforce(
        request, "site-hit", HITS_PER_VISITOR_PER_MIN, 60, subject=site_events.rate_subject(ip)
    )
    # Database and Redis work is blocking: off the event loop, so page views
    # from every published site never stall chat streams.
    await run_in_threadpool(_record_hit, x_rodium_forwarded_host, key, payload.p, ip, user_agent)
    return Response(status_code=204)


# ── Owner side ──────────────────────────────────────────────────────────────


class SubmissionOut(BaseModel):
    id: UUID
    form: str
    data: dict
    page: str
    read: bool
    created_at: datetime


class SubmissionsOut(BaseModel):
    items: list[SubmissionOut]
    unread: int
    total: int


class ReadIn(BaseModel):
    read: bool = True


def _submission_out(row: FormSubmission) -> SubmissionOut:
    try:
        data = json.loads(row.data_json or "{}")
    except ValueError:
        data = {}
    return SubmissionOut(
        id=row.id,
        form=row.form_name,
        data=data if isinstance(data, dict) else {},
        page=row.page or "",
        read=row.read_at is not None,
        created_at=row.created_at,
    )


@router.get("/{project_id}/forms", response_model=SubmissionsOut)
def list_submissions(
    project_id: UUID,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    form: str | None = Query(default=None, max_length=64),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionsOut:
    project = accessible_project(db, user, project_id, resolve_locale(request))
    query = db.query(FormSubmission).filter(FormSubmission.project_id == project.id)
    if form:
        query = query.filter(FormSubmission.form_name == form)
    total = query.count()
    unread = query.filter(FormSubmission.read_at.is_(None)).count()
    rows = query.order_by(FormSubmission.created_at.desc()).limit(limit).all()
    return SubmissionsOut(items=[_submission_out(r) for r in rows], unread=unread, total=total)


@router.patch("/{project_id}/forms/{submission_id}", response_model=SubmissionOut)
def mark_submission(
    project_id: UUID,
    submission_id: UUID,
    body: ReadIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    project = accessible_project(db, user, project_id, resolve_locale(request))
    row = db.get(FormSubmission, submission_id)
    if row is None or row.project_id != project.id:
        raise HTTPException(status_code=404, detail="not_found")
    row.read_at = datetime.now(UTC) if body.read else None
    db.commit()
    return _submission_out(row)


@router.delete("/{project_id}/forms/{submission_id}", status_code=204)
def delete_submission(
    project_id: UUID,
    submission_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    project = accessible_project(db, user, project_id, resolve_locale(request), require_edit=True)
    row = db.get(FormSubmission, submission_id)
    if row is None or row.project_id != project.id:
        raise HTTPException(status_code=404, detail="not_found")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


def _csv_cell(value: object) -> str:
    text_value = str(value or "")
    # Spreadsheet apps evaluate cells starting with these characters.
    return "'" + text_value if text_value[:1] in ("=", "+", "-", "@", "\t", "\r") else text_value


@router.get("/{project_id}/forms.csv")
def export_submissions(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    project = accessible_project(db, user, project_id, resolve_locale(request))
    rows = (
        db.query(FormSubmission)
        .filter(FormSubmission.project_id == project.id)
        .order_by(FormSubmission.created_at.desc())
        .limit(5000)
        .all()
    )
    keys: list[str] = []
    parsed = []
    for row in rows:
        out = _submission_out(row)
        parsed.append(out)
        for key in out.data:
            if key not in keys:
                keys.append(key)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "form", "page", *(_csv_cell(k) for k in keys)])
    for out in parsed:
        writer.writerow(
            [out.created_at.isoformat(), _csv_cell(out.form), _csv_cell(out.page)]
            + [_csv_cell(out.data.get(k, "")) for k in keys]
        )
    filename = f"{project.slug or 'site'}-forms.csv"
    return StreamingResponse(
        iter(["﻿" + buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class DayOut(BaseModel):
    day: str
    page_views: int
    unique_visitors: int


class PageOut(BaseModel):
    path: str
    views: int


class AnalyticsOut(BaseModel):
    days: list[DayOut]
    page_views: int
    unique_visitors: int
    top_pages: list[PageOut]


@router.get("/{project_id}/analytics", response_model=AnalyticsOut)
def site_analytics(
    project_id: UUID,
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsOut:
    project = accessible_project(db, user, project_id, resolve_locale(request))
    today = datetime.now(UTC).date()
    start = (today - timedelta(days=days - 1)).isoformat()
    rows = (
        db.query(SiteUsageDay).filter(SiteUsageDay.project_id == project.id, SiteUsageDay.day >= start).all()
    )
    by_day: dict[str, tuple[int, int]] = {}
    for row in rows:
        views, uniques = by_day.get(row.day, (0, 0))
        by_day[row.day] = (views + int(row.page_views or 0), uniques + int(row.unique_visitors or 0))
    series = []
    for offset in range(days):
        day = (today - timedelta(days=days - 1 - offset)).isoformat()
        views, uniques = by_day.get(day, (0, 0))
        series.append(DayOut(day=day, page_views=views, unique_visitors=uniques))
    top = (
        db.query(SitePageDay.path, func.sum(SitePageDay.views))
        .filter(SitePageDay.project_id == project.id, SitePageDay.day >= start)
        .group_by(SitePageDay.path)
        .order_by(func.sum(SitePageDay.views).desc())
        .limit(10)
        .all()
    )
    return AnalyticsOut(
        days=series,
        page_views=sum(d.page_views for d in series),
        unique_visitors=sum(d.unique_visitors for d in series),
        top_pages=[PageOut(path=p, views=int(v or 0)) for p, v in top],
    )
