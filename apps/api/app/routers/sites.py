from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.errors import recipient_not_allowed
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.providers.mail import build_mail_provider
from app.services.asset_storage import upload_project_asset
from app.services.capabilities import (
    assert_managed_email_quota,
    assert_managed_storage_quota,
    email_provider,
    require_rodi_for_paid_capability,
    storage_provider,
)
from app.services.resend import send_resend_email

router = APIRouter(prefix="/v1", tags=["sites-gateway"])


class EmailSendRequest(BaseModel):
    project_id: UUID
    to: list[EmailStr] = Field(min_length=1, max_length=10)
    subject: str = Field(min_length=1, max_length=200)
    html: str = Field(min_length=1, max_length=100_000)
    template: str | None = None


class EmailSendResponse(BaseModel):
    ok: bool = True
    adapter: str
    message_id: str
    from_email: str


class StorageUploadResponse(BaseModel):
    ok: bool = True
    adapter: str
    object_key: str
    public_url: str
    byte_size: int
    warning: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "forge-sites-gateway"
    forwarded_host: str | None = None


def _owned_project(db: Session, user: User, project_id: UUID, locale: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("project_not_found", locale))
    return project


@router.get("/health", response_model=HealthResponse)
def sites_health(request: Request) -> HealthResponse:
    forwarded = request.headers.get("x-rodium-forwarded-host") or request.headers.get("host")
    return HealthResponse(forwarded_host=forwarded)


@router.post("/email/send", response_model=EmailSendResponse)
async def send_site_email(
    body: EmailSendRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmailSendResponse:
    locale = resolve_locale(request)
    require_rodi_for_paid_capability(user, db)
    project = _owned_project(db, user, body.project_id, locale)
    settings = get_settings()

    owner_email = (user.email or "").lower()
    allowed = {owner_email}
    if any(addr.lower() not in allowed for addr in body.to):
        raise recipient_not_allowed()

    adapter, creds = email_provider(db, user)
    from_name = project.name or settings.ses_from_name

    if adapter == "resend" and creds:
        from_email = creds.get("from_email") or settings.mail_from or settings.ses_from_email
        from_name = creds.get("from_name") or from_name
        message_id = await send_resend_email(
            api_key=creds["api_key"],
            from_email=from_email,
            from_name=from_name,
            to=[str(addr) for addr in body.to],
            subject=body.subject,
            html=body.html,
            reply_to=creds.get("reply_to"),
        )
        return EmailSendResponse(adapter="resend", message_id=message_id, from_email=from_email)

    row = assert_managed_email_quota(db, user, project.id)
    mail = build_mail_provider()
    from_email = settings.mail_from or settings.ses_from_email
    message_id = await mail.send(
        to=[str(addr) for addr in body.to],
        subject=body.subject,
        html=body.html,
        text=" ",
        from_name=from_name,
    )
    row.emails_sent += 1
    db.commit()
    return EmailSendResponse(
        adapter=settings.mail_provider,
        message_id=message_id,
        from_email=from_email,
    )


@router.post("/storage/upload", response_model=StorageUploadResponse)
async def upload_site_file(
    request: Request,
    project_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StorageUploadResponse:
    locale = resolve_locale(request)
    project = _owned_project(db, user, project_id, locale)
    body = await file.read()
    filename = file.filename or "file.bin"
    content_type = file.content_type or "application/octet-stream"

    adapter, _creds = storage_provider(db, user)
    warning = None
    if adapter != "cloudinary":
        assert_managed_storage_quota(db, user, len(body))
        warning = (
            "Using Forge managed object storage (500 MB cap). "
            "Connect Cloudinary to remove this limit."
        )

    try:
        row = upload_project_asset(
            db,
            user=user,
            project=project,
            body=body,
            filename=filename,
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:300]) from exc
    return StorageUploadResponse(
        adapter=row.adapter,
        object_key=row.object_key,
        public_url=row.public_url,
        byte_size=int(row.byte_size or 0),
        warning=warning,
    )
