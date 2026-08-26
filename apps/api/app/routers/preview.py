from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.schemas import PreviewStatus
from app.services import preview as preview_service
from app.services import preview_babel
from app.services.preview_bridge import FORGE_EDIT_BRIDGE

router = APIRouter(tags=["preview"])


class SourceBundle(BaseModel):
    entry: str = "src/main.tsx"
    files: dict[str, str]
    mode: str = "babel_runner"
    runner_url: str


def _owned(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


def _babel_status(project: Project, *, running: bool) -> PreviewStatus:
    settings = get_settings()
    public_url = settings.preview_url_for_slug(project.slug)
    runner = preview_babel.runner_url()
    return PreviewStatus(
        running=running,
        port=0 if running else project.preview_port,
        url=runner if running else None,
        public_url=public_url,
        mode="babel_runner",
        runner_url=runner,
        entry="src/main.tsx",
    )


@router.get("/projects/{project_id}/preview", response_model=PreviewStatus)
def preview_status(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    settings = get_settings()
    if settings.preview_mode == "babel_runner":
        running = preview_babel.is_babel_preview_ready(str(project_id))
        return _babel_status(project, running=running)

    public_url = settings.preview_url_for_slug(project.slug)
    running = preview_service.get_preview(str(project_id), owner_user_id=str(user.id))
    if running:
        if not project.preview_running or project.preview_port != running.port:
            project.preview_running = True
            project.preview_port = running.port
            db.commit()
        from app.services import firestore_live

        firestore_live.set_preview(
            str(project_id),
            status="ready",
            owner_user_id=str(user.id),
            port=running.port,
            url=f"/preview/{project_id}/",
            public_url=public_url,
            name=project.name,
        )
        return PreviewStatus(
            running=True,
            port=running.port,
            url=f"/preview/{project_id}/",
            public_url=public_url,
            mode="vite",
        )
    if project.preview_running:
        project.preview_running = False
        db.commit()
        from app.services import firestore_live

        firestore_live.set_preview(
            str(project_id),
            status="dead",
            owner_user_id=str(user.id),
            port=project.preview_port,
            public_url=public_url,
            name=project.name,
        )
    return PreviewStatus(
        running=False,
        port=project.preview_port,
        url=None,
        public_url=public_url,
        mode="vite",
    )


@router.get("/projects/{project_id}/source-bundle", response_model=SourceBundle)
def source_bundle(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SourceBundle:
    _owned(db, user, project_id, resolve_locale(request))
    files = preview_babel.collect_project_source_files(str(project_id))
    return SourceBundle(
        entry="src/main.tsx",
        files=files,
        mode=get_settings().preview_mode,
        runner_url=preview_babel.runner_url(),
    )


@router.post("/projects/{project_id}/preview/start", response_model=PreviewStatus)
async def preview_start(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    settings = get_settings()
    public_url = settings.preview_url_for_slug(project.slug)

    if settings.preview_mode == "babel_runner":
        preview_babel.ensure_babel_project_layout(str(project_id))
        preview_babel.mark_babel_preview_ready(str(project_id))
        project.preview_running = True
        project.preview_port = 0
        db.commit()
        from app.services import firestore_live

        firestore_live.set_preview(
            str(project_id),
            status="ready",
            owner_user_id=str(user.id),
            port=0,
            url=preview_babel.runner_url(),
            public_url=public_url,
            name=project.name,
        )
        return _babel_status(project, running=True)

    try:
        proc = await preview_service.start_preview(
            str(project_id),
            project.preview_port,
            owner_user_id=str(user.id),
            public_url=public_url,
            project_name=project.name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc) or t("preview_failed", locale)) from exc
    project.preview_port = proc.port
    project.preview_running = True
    db.commit()
    return PreviewStatus(
        running=True,
        port=proc.port,
        url=f"/preview/{project_id}/",
        public_url=public_url,
        mode="vite",
    )


@router.post("/projects/{project_id}/preview/restart", response_model=PreviewStatus)
async def preview_restart(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    settings = get_settings()
    if settings.preview_mode == "babel_runner":
        preview_babel.stop_babel_preview(str(project_id))
        return await preview_start(project_id, request, user, db)

    public_url = settings.preview_url_for_slug(project.slug)
    try:
        proc = await preview_service.restart_preview_clean(
            str(project_id),
            owner_user_id=str(user.id),
            public_url=public_url,
            project_name=project.name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc) or t("preview_failed", locale)) from exc
    project.preview_port = proc.port
    project.preview_running = True
    db.commit()
    return PreviewStatus(
        running=True,
        port=proc.port,
        url=f"/preview/{project_id}/",
        public_url=public_url,
        mode="vite",
    )


@router.post("/projects/{project_id}/preview/stop", response_model=PreviewStatus)
def preview_stop(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    settings = get_settings()
    if settings.preview_mode == "babel_runner":
        preview_babel.stop_babel_preview(str(project_id))
        project.preview_running = False
        db.commit()
        return _babel_status(project, running=False)

    preview_service.stop_preview(
        str(project_id),
        owner_user_id=str(user.id),
        project_name=project.name,
    )
    project.preview_running = False
    db.commit()
    return PreviewStatus(
        running=False,
        port=project.preview_port,
        url=None,
        public_url=settings.preview_url_for_slug(project.slug),
        mode="vite",
    )


@router.api_route(
    "/preview/{project_id}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
@router.api_route(
    "/preview/{project_id}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def preview_proxy(project_id: UUID, request: Request, path: str = "") -> Response:
    locale = resolve_locale(request)
    settings = get_settings()
    if settings.preview_mode == "babel_runner":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Vite preview proxy disabled (PREVIEW_MODE=babel_runner). Use /runner/.",
        )

    proc = preview_service.get_preview(str(project_id))
    if proc is None:
        from app.db import SessionLocal
        from app.models import Project as ProjectModel

        db = SessionLocal()
        try:
            row = db.get(ProjectModel, project_id)
            port = getattr(row, "preview_port", None) if row else None
        finally:
            db.close()
        if port:
            adopt = getattr(preview_service, "adopt_preview", None)
            if callable(adopt):
                proc = adopt(str(project_id), int(port))
        if proc is None:
            raise HTTPException(status_code=404, detail=t("preview_not_running", locale))

    target_path = path.lstrip("/")
    upstream_path = (
        f"/preview/{project_id}/{target_path}" if target_path else f"/preview/{project_id}/"
    )
    url = f"http://127.0.0.1:{proc.port}{upstream_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}
    }
    body = await request.body()
    async with httpx.AsyncClient(timeout=60.0) as client:
        upstream = await client.request(request.method, url, headers=headers, content=body)
    content = upstream.content
    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in {"content-encoding", "transfer-encoding", "content-length"}
    }
    ctype = upstream.headers.get("content-type", "")
    if "text/html" in ctype and b"</body>" in content:
        if FORGE_EDIT_BRIDGE.encode() not in content:
            content = content.replace(b"</body>", FORGE_EDIT_BRIDGE.encode() + b"</body>", 1)
    return Response(content=content, status_code=upstream.status_code, headers=resp_headers)
