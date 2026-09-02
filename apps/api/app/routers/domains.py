"""Custom domain endpoints (Options → Publishing → Custom domain)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, ProjectDomain, User
from app.routers.sites_v1 import clear_resolve_cache
from app.services.domains import (
    STATUS_PENDING_DNS,
    STATUS_VALIDATED,
    DomainValidationError,
    advance_verification,
    cleanup_aws,
    dns_records_for,
    get_project_domain,
    normalize_hostname,
    public_url_for_domain,
    request_certificate,
    verify_rate_limited,
)

router = APIRouter(prefix="/projects", tags=["domains"])


class DnsRecordOut(BaseModel):
    purpose: str
    type: str
    name: str
    full_name: str
    value: str


class DomainOut(BaseModel):
    hostname: str
    status: str
    cname_target: str
    dns_records: list[DnsRecordOut]
    public_url: str | None = None
    last_error: str | None = None
    verified_at: datetime | None = None


class DomainPutRequest(BaseModel):
    hostname: str = Field(min_length=3, max_length=253)


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))  # type: ignore[arg-type]
    return project


def _to_out(domain: ProjectDomain) -> DomainOut:
    return DomainOut(
        hostname=domain.hostname,
        status=domain.status,
        cname_target=domain.cname_target,
        dns_records=[DnsRecordOut(**r) for r in dns_records_for(domain)],
        public_url=public_url_for_domain(domain),
        last_error=domain.last_error,
        verified_at=domain.verified_at,
    )


@router.get("/{project_id}/domain", response_model=DomainOut | None)
def get_domain(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DomainOut | None:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    domain = get_project_domain(db, project.id)
    return _to_out(domain) if domain else None


@router.put("/{project_id}/domain", response_model=DomainOut)
def put_domain(
    project_id: UUID,
    body: DomainPutRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DomainOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    settings = get_settings()

    try:
        hostname = normalize_hostname(body.hostname, settings)
    except DomainValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Global uniqueness — a hostname belongs to exactly one project.
    taken = (
        db.query(ProjectDomain)
        .filter(ProjectDomain.hostname == hostname, ProjectDomain.project_id != project.id)
        .first()
    )
    if taken is not None:
        raise HTTPException(status_code=409, detail="hostname_taken")

    existing = get_project_domain(db, project.id)
    if existing is not None and existing.hostname == hostname:
        return _to_out(existing)
    if existing is not None:
        # Replacement: tear down the old cert/rule before dropping the row.
        cleanup_aws(existing, settings)
        db.delete(existing)
        db.flush()

    domain = ProjectDomain(
        project_id=project.id,
        hostname=hostname,
        status=STATUS_PENDING_DNS,
        cname_target=settings.effective_custom_domain_cname_target,
    )
    db.add(domain)
    if settings.custom_domain_aws_enabled:
        try:
            request_certificate(domain)
        except Exception as exc:
            # Cert request failure is not fatal at PUT time — verify retries.
            domain.last_error = f"acm_request_failed: {str(exc)[:200]}"
    db.commit()
    db.refresh(domain)
    return _to_out(domain)


@router.post("/{project_id}/domain/verify", response_model=DomainOut)
def verify_domain(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DomainOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    domain = get_project_domain(db, project.id)
    if domain is None:
        raise HTTPException(status_code=404, detail="no_domain")
    if verify_rate_limited(str(project.id)):
        raise HTTPException(status_code=429, detail="verify_rate_limited")

    advance_verification(domain, get_settings())
    db.commit()
    db.refresh(domain)
    if domain.status == STATUS_VALIDATED:
        clear_resolve_cache(domain.hostname)
    return _to_out(domain)


@router.delete("/{project_id}/domain")
def delete_domain(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    domain = get_project_domain(db, project.id)
    if domain is None:
        return {"ok": True}
    hostname = domain.hostname
    cleanup_aws(domain, get_settings())
    db.delete(domain)
    db.commit()
    clear_resolve_cache(hostname)
    return {"ok": True}
