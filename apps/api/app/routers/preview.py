"""Preview endpoints — Babel/ESM runner only.

The legacy Vite preview (per-project `npm run dev` on ports 5200-5299) is gone.
It leaked child processes across API restarts, had no concurrency cap, and its
orphan reaper was a no-op on Windows. The runner needs no process at all: the
browser receives the source bundle over postMessage and transforms it in-page.
"""

import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.schemas import PreviewStatus
from app.services import preview_babel

router = APIRouter(tags=["preview"])

# Dashboard thumbs hit /draft?thumb=1 for every project card — cache the heavy
# HTML bundle briefly so scrolling the grid does not re-read 40+ files each time.
_DRAFT_THUMB_CACHE: dict[str, tuple[float, str]] = {}
_DRAFT_THUMB_TTL_S = 90.0
_DRAFT_THUMB_CACHE_MAX = 40


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


def _project_extra_imports(project_id: str) -> dict[str, str]:
    try:
        from app.services.project_packages import extra_import_map

        return extra_import_map(project_id)
    except Exception:
        return {}


def _draft_thumb_cache_get(project_id: str) -> str | None:
    row = _DRAFT_THUMB_CACHE.get(project_id)
    if not row:
        return None
    if time.time() - row[0] > _DRAFT_THUMB_TTL_S:
        _DRAFT_THUMB_CACHE.pop(project_id, None)
        return None
    return row[1]


def _draft_thumb_cache_set(project_id: str, html: str) -> None:
    if len(_DRAFT_THUMB_CACHE) >= _DRAFT_THUMB_CACHE_MAX:
        _DRAFT_THUMB_CACHE.pop(next(iter(_DRAFT_THUMB_CACHE)), None)
    _DRAFT_THUMB_CACHE[project_id] = (time.time(), html)


def _status(project: Project, *, running: bool) -> PreviewStatus:
    settings = get_settings()
    runner = preview_babel.runner_url(str(project.id))
    return PreviewStatus(
        running=running,
        port=0,
        url=runner if running else None,
        public_url=settings.preview_url_for_slug(project.slug),
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
    running = preview_babel.is_babel_preview_ready(str(project_id))
    return _status(project, running=running)


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
        mode="babel_runner",
        runner_url=preview_babel.runner_url(str(project_id)),
    )


@router.get("/projects/{project_id}/draft", include_in_schema=False)
def draft_page(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    """Standalone draft: the runner shell with the source bundle embedded.

    The plain runner waits for a builder parent to postMessage the bundle, so
    opening it in its own tab showed an empty page. This is the "open draft in
    a new tab" target; auth rides the `?access_token=` query support.
    """
    project = _owned(db, user, project_id, resolve_locale(request))
    is_thumb = request.query_params.get("thumb") in {"1", "true", "yes"}
    pid = str(project_id)
    if is_thumb:
        cached = _draft_thumb_cache_get(pid)
        if cached:
            return HTMLResponse(cached, headers={"Cache-Control": "private, max-age=60"})
    files = preview_babel.collect_project_source_files(pid)
    # Root-path images (/images/x.png) resolve through the authenticated
    # project-public endpoint; same-origin here, so a relative base works.
    assets: dict[str, str] = {
        "base": f"/projects/{project_id}/public",
        "routerBase": f"/projects/{project_id}/draft",
    }
    token = request.query_params.get("access_token")
    if token:
        assets["token"] = token
    html = preview_babel.render_runner_shell(
        bundle={"files": files, "entry": "src/main.tsx", "title": project.name, "assets": assets},
        extra_imports=_project_extra_imports(pid),
        thumb=is_thumb,
    )
    if is_thumb:
        _draft_thumb_cache_set(pid, html)
    return HTMLResponse(html, headers={"Cache-Control": "no-store" if not is_thumb else "private, max-age=60"})


@router.post("/projects/{project_id}/preview/start", response_model=PreviewStatus)
def preview_start(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    preview_babel.ensure_babel_project_layout(str(project_id))
    preview_babel.mark_babel_preview_ready(str(project_id))
    project.preview_running = True
    project.preview_port = 0
    db.commit()
    return _status(project, running=True)


@router.post("/projects/{project_id}/preview/restart", response_model=PreviewStatus)
def preview_restart(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    preview_babel.stop_babel_preview(str(project_id))
    return preview_start(project_id, request, user, db)


@router.post("/projects/{project_id}/preview/stop", response_model=PreviewStatus)
def preview_stop(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewStatus:
    project = _owned(db, user, project_id, resolve_locale(request))
    preview_babel.stop_babel_preview(str(project_id))
    project.preview_running = False
    project.preview_port = 0
    db.commit()
    return _status(project, running=False)
