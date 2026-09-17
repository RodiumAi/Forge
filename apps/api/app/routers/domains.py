"""Custom domain endpoints (Options → Publishing → Custom domain)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, ProjectDomain, ProjectDomainClaim, User
from app.routers.sites_v1 import clear_resolve_cache
from app.services import rate_limit
from app.services.domains import (
    STATUS_FAILED,
    STATUS_PENDING_DNS,
    STATUS_PROCESSING,
    STATUS_VALIDATED,
    DomainClaimConflictError,
    DomainClaimStaleError,
    DomainValidationError,
    advance_verification,
    claim_dns_proven,
    cleanup_aws,
    dns_records_for,
    get_project_domain,
    get_project_domain_claim,
    new_domain_claim,
    normalize_hostname,
    promote_domain_claim,
    public_url_for_domain,
    request_certificate,
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
    challenge_expires_at: datetime | None = None


class DomainPutRequest(BaseModel):
    hostname: str = Field(min_length=3, max_length=253)


def _owned(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))  # type: ignore[arg-type]
    return project


def _to_out(domain: ProjectDomain | ProjectDomainClaim) -> DomainOut:
    return DomainOut(
        hostname=domain.hostname,
        status=domain.status if isinstance(domain, ProjectDomain) else STATUS_PENDING_DNS,
        cname_target=domain.cname_target,
        dns_records=[DnsRecordOut(**r) for r in dns_records_for(domain)],
        public_url=public_url_for_domain(domain) if isinstance(domain, ProjectDomain) else None,
        last_error=domain.last_error,
        verified_at=domain.verified_at if isinstance(domain, ProjectDomain) else None,
        challenge_expires_at=domain.expires_at if isinstance(domain, ProjectDomainClaim) else None,
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
    claim = get_project_domain_claim(db, project.id)
    if claim is not None:
        return _to_out(claim)
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
    rate_limit.enforce(
        request,
        "custom-domain-create",
        limit=10,
        window_seconds=3600,
        subject=f"{user.id}:{project.id}",
    )

    try:
        hostname = normalize_hostname(body.hostname, settings)
    except DomainValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Serialize replacements for one project. Without this lock, concurrent
    # PUTs can each mint a different challenge and one response is stale as
    # soon as it reaches the client.
    locked_project = db.query(Project).filter(Project.id == project.id).with_for_update().first()
    if locked_project is None or locked_project.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))  # type: ignore[arg-type]
    project = locked_project
    active = get_project_domain(db, project.id)
    pending = get_project_domain_claim(db, project.id)
    if active is not None and active.hostname == hostname and pending is None:
        return _to_out(active)
    if pending is not None:
        if pending.hostname == hostname and pending.expires_at > datetime.now(UTC):
            return _to_out(pending)
        # Every replacement is a fresh generation. A TXT value from the prior
        # generation remains public DNS data but can no longer be replayed.
        db.delete(pending)
        db.flush()

    claim = new_domain_claim(
        project,
        user.id,
        hostname,
        settings.effective_custom_domain_cname_target,
    )
    db.add(claim)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="domain_claim_conflict") from exc
    db.refresh(claim)
    return _to_out(claim)


@router.post("/{project_id}/domain/verify", response_model=DomainOut)
def verify_domain(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DomainOut:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    rate_limit.enforce(
        request,
        "custom-domain-verify",
        limit=12,
        window_seconds=60,
        subject=f"{user.id}:{project.id}",
    )
    settings = get_settings()
    claim = get_project_domain_claim(db, project.id)
    if claim is not None:
        if not claim_dns_proven(claim):
            db.commit()
            db.refresh(claim)
            return _to_out(claim)

        claim_id = claim.id
        # End the DNS-read transaction before taking the short promotion lock.
        db.commit()
        try:
            domain, replaced = promote_domain_claim(db, claim_id, settings)
            db.commit()
        except DomainClaimConflictError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail="hostname_taken") from exc
        except (DomainClaimStaleError, IntegrityError) as exc:
            db.rollback()
            detail = "ownership_challenge_expired"
            if isinstance(exc, IntegrityError):
                detail = "hostname_taken"
            raise HTTPException(status_code=409, detail=detail) from exc

        if replaced is not None:
            cleanup_aws(replaced, settings)
            clear_resolve_cache(replaced.hostname)

        if settings.custom_domain_aws_enabled:
            try:
                request_certificate(domain)
                domain.status = (
                    STATUS_PENDING_DNS
                    if domain.acm_validation_name and domain.acm_validation_value
                    else STATUS_PROCESSING
                )
                domain.last_error = (
                    "acm_cname_missing" if domain.status == STATUS_PENDING_DNS else "acm_record_pending"
                )
            except Exception as exc:
                domain.status = STATUS_FAILED
                domain.last_error = f"acm_request_failed: {str(exc)[:200]}"
            db.commit()
            db.refresh(domain)

        if domain.status == STATUS_VALIDATED:
            clear_resolve_cache(domain.hostname)
        return _to_out(domain)

    domain = get_project_domain(db, project.id)
    if domain is None:
        raise HTTPException(status_code=404, detail="no_domain")

    advance_verification(domain, settings)
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
    claim = get_project_domain_claim(db, project.id)
    domain = get_project_domain(db, project.id)
    if claim is None and domain is None:
        return {"ok": True}
    hostname = domain.hostname if domain is not None else None
    if claim is not None:
        db.delete(claim)
    if domain is not None:
        cleanup_aws(domain, get_settings())
        db.delete(domain)
    db.commit()
    if hostname is not None:
        clear_resolve_cache(hostname)
    return {"ok": True}
