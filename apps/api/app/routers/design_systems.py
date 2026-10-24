"""Design systems: the list (mine and my teams'), defaults, team sharing,
the link from a project to the design system that dresses it, and exports.

Ownership and team rules live in ``services/design_system/registry.py``. A
linked project never changes on its own when its design system moves on: the
link reports the newer version with the list of changes, and only an explicit
resync (``POST .../design-system-link/resync`` with the proposed version)
writes them.
"""

from __future__ import annotations

import contextlib
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.contracts.forge_design import dump_document, validate_design_system
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale
from app.kinds import kind_enabled, resolve_kind
from app.models import Project, User
from app.services import history
from app.services.design_system import registry, sync
from app.services.design_system.exports import FORMATS, pdf_export, require_export, show_badge, text_export
from app.services.project_access import accessible_project

router = APIRouter(tags=["design-systems"])
KIND = "design_system"


def _require_enabled() -> None:
    if not kind_enabled(KIND):
        raise SitesError(404, "KIND_DISABLED", "This project type is not available yet.")


def _document(project: Project) -> dict:
    raw = registry.read_document(project.id)
    if raw is None:
        raise SitesError(404, "DOCUMENT_MISSING", "design-system.json does not exist.")
    try:
        return dump_document(validate_design_system(raw))
    except Exception as exc:
        raise SitesError(422, "INVALID_DOCUMENT", "design-system.json does not match its contract.") from exc


class DefaultBody(BaseModel):
    scope: Literal["user", "team"] = "user"
    value: bool = True


class LinkBody(BaseModel):
    design_system_id: UUID
    #: Apply the design system now (the user chose it); False only records the link.
    apply: bool = True


class ResyncBody(BaseModel):
    #: The version the proposal was made for; a newer one means "look again".
    version: int = Field(ge=1)


# ── list, defaults, sharing ────────────────────────────────────────────────


@router.get("/design-systems")
def list_design_systems(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> JSONResponse:
    """Mine and my teams', the default first (personal, then team)."""
    _require_enabled()
    items = registry.list_for_user(db, user)
    default = next((item["id"] for item in items if item["is_default_user"] or item["is_default_team"]), None)
    return JSONResponse({"items": items, "default_id": default}, headers={"Cache-Control": "no-store"})


@router.get("/design-systems/{project_id}")
def get_design_system_item(
    project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> JSONResponse:
    _require_enabled()
    project = registry.design_system_project(db, user, project_id)
    item = registry.item_for(db, user, project)
    db.commit()
    return JSONResponse(item, headers={"Cache-Control": "no-store"})


@router.put("/design-systems/{project_id}/default")
def set_default(
    project_id: UUID,
    body: DefaultBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _require_enabled()
    project = registry.design_system_project(db, user, project_id)
    registry.set_default(db, user, project, scope=body.scope, value=body.value)
    return JSONResponse(registry.item_for(db, user, project))


@router.post("/design-systems/{project_id}/share")
def share(
    project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> JSONResponse:
    """Share with my team (``design_system_sharing`` on Forge Cloud)."""
    _require_enabled()
    project = registry.design_system_project(db, user, project_id)
    registry.share(db, user, project)
    return JSONResponse(registry.item_for(db, user, project))


@router.delete("/design-systems/{project_id}/share")
def unshare(
    project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> JSONResponse:
    _require_enabled()
    project = registry.design_system_project(db, user, project_id)
    registry.unshare(db, user, project)
    return JSONResponse(registry.item_for(db, user, project))


# ── link from a project to its design system ───────────────────────────────


def _link_status(db: Session, user: User, project: Project) -> dict:
    source_id = getattr(project, "design_system_project_id", None)
    synced = getattr(project, "design_system_version", None)
    if source_id is None:
        return {
            "design_system": None,
            "synced_version": None,
            "outdated": False,
            "available": False,
            "changes": [],
        }
    source = db.get(Project, source_id)
    readable = source is not None and registry.access(db, user, source)[0]
    if not readable or source is None:
        return {
            "design_system": {"id": str(source_id), "name": None, "version": None},
            "synced_version": synced,
            "outdated": False,
            "available": False,
            "changes": [],
        }
    row = registry.ensure_record(db, source)
    version = registry.refresh_version(row)
    db.commit()
    document = registry.read_document(source.id)
    changes: list = []
    if document is not None and (synced is None or synced < version):
        try:
            changes = sync.plan(
                str(project.id), resolve_kind(project.platform), _document(source), str(source.id)
            )
        except SitesError:
            changes = []
    return {
        "design_system": {"id": str(source.id), "name": source.name, "version": version},
        "synced_version": synced,
        "outdated": synced is None or synced < version,
        "available": document is not None,
        "changes": changes,
    }


def _target(db: Session, user: User, project_id: UUID, request: Request, *, edit: bool) -> Project:
    project = accessible_project(db, user, project_id, resolve_locale(request), require_edit=edit)
    if resolve_kind(project.platform) == KIND:
        raise SitesError(400, "IS_A_DESIGN_SYSTEM", "A design system cannot be dressed by another one.")
    return project


@router.get("/projects/{project_id}/design-system-link")
def get_link(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """The linked design system, whether a newer version exists, and what a resync would change."""
    _require_enabled()
    project = _target(db, user, project_id, request, edit=False)
    return JSONResponse(_link_status(db, user, project), headers={"Cache-Control": "no-store"})


def _apply(db: Session, project: Project, source: Project, version: int) -> list[str]:
    document = _document(source)
    with contextlib.suppress(Exception):  # history is best effort
        history.snapshot(str(project.id), "before design system sync")
    written = sync.apply(str(project.id), resolve_kind(project.platform), document, str(source.id))
    project.design_system_project_id = source.id
    project.design_system_version = version
    db.commit()
    return written


@router.put("/projects/{project_id}/design-system-link")
def attach(
    project_id: UUID,
    body: LinkBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    _require_enabled()
    project = _target(db, user, project_id, request, edit=True)
    source = registry.design_system_project(db, user, body.design_system_id)
    row = registry.ensure_record(db, source)
    version = registry.refresh_version(row)
    written: list[str] = []
    if body.apply:
        written = _apply(db, project, source, version)
    else:
        project.design_system_project_id = source.id
        # Not applied yet: the next status proposes the whole design system.
        project.design_system_version = None
        db.commit()
    return JSONResponse({**_link_status(db, user, project), "written": written})


@router.delete("/projects/{project_id}/design-system-link")
def detach(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Forget the link; the files the design system wrote stay as they are."""
    _require_enabled()
    project = _target(db, user, project_id, request, edit=True)
    project.design_system_project_id = None
    project.design_system_version = None
    db.commit()
    return JSONResponse(_link_status(db, user, project))


@router.post("/projects/{project_id}/design-system-link/resync")
def resync(
    project_id: UUID,
    body: ResyncBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Apply the proposed version. 409 when the design system moved on since."""
    _require_enabled()
    project = _target(db, user, project_id, request, edit=True)
    source_id = getattr(project, "design_system_project_id", None)
    if source_id is None:
        raise SitesError(409, "NO_DESIGN_SYSTEM", "This project has no design system.")
    source = registry.design_system_project(db, user, source_id)
    row = registry.ensure_record(db, source)
    version = registry.refresh_version(row)
    if body.version != version:
        db.commit()
        raise SitesError(
            409, "DESIGN_SYSTEM_CHANGED", "The design system changed: review the proposal again."
        )
    written = _apply(db, project, source, version)
    return JSONResponse({**_link_status(db, user, project), "written": written})


# ── exports ────────────────────────────────────────────────────────────────


@router.get("/projects/{project_id}/design-system/export/{fmt}")
async def export(
    project_id: UUID,
    fmt: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """tokens.json, CSS variables, Tailwind config, DESIGN.md or the guidelines PDF."""
    _require_enabled()
    if fmt not in FORMATS:
        raise SitesError(400, "INVALID_FORMAT", f"Export format must be one of {', '.join(FORMATS)}.")
    project = registry.design_system_project(db, user, project_id)
    require_export(db, user, fmt)
    document = _document(project)
    if fmt == "pdf":
        badge = show_badge(db, user)
        pid = str(project.id)
        db.close()
        file = await pdf_export(pid, document, lang=resolve_locale(request), badge=badge)
    else:
        file = text_export(document, fmt)
    return Response(
        content=file.body,
        media_type=file.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file.filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── logo and brand assets ──────────────────────────────────────────────────

MAX_LOGO_BYTES = 4 * 1024 * 1024
_BRAND_DIR = "public/brand/"
_ASSET_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


@router.post("/projects/{project_id}/design-system/logo")
async def upload_logo(
    project_id: UUID,
    variant: Literal["light", "dark"] = "light",
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Store a raster logo under public/brand/ and point the design system at it.

    The bytes are sniffed (never the name or the declared type); SVG uploads
    are refused because an SVG can carry script.
    """
    from app.services.asset_storage import sniff_raster
    from app.services.design_system.flow import write_document
    from app.services.filesystem import write_bytes

    _require_enabled()
    project = registry.design_system_project(db, user, project_id, require_edit=True)
    body = await file.read(MAX_LOGO_BYTES + 1)
    if len(body) > MAX_LOGO_BYTES:
        raise SitesError(400, "LOGO_TOO_LARGE", "The logo must be 4 MB at most.")
    verified = sniff_raster(body)
    if verified is None or verified[1] not in (".png", ".jpg", ".jpeg", ".webp"):
        raise SitesError(400, "LOGO_TYPE", "The logo must be a PNG, JPEG or WebP image.")
    pid = str(project.id)
    relative = f"{_BRAND_DIR}logo-{variant}{verified[1]}"
    document = _document(project)
    write_bytes(pid, relative, body)
    logo = dict(document.get("logo") or {})
    if variant == "dark":
        if not logo.get("src"):
            raise SitesError(409, "LOGO_MISSING", "Upload the main logo first.")
        logo["darkSrc"] = relative
    else:
        logo["src"] = relative
    document["logo"] = logo
    document = dump_document(validate_design_system(document))
    with contextlib.suppress(Exception):
        history.snapshot(pid, "before logo upload")
    write_document(pid, document)
    return JSONResponse(document)


@router.get("/projects/{project_id}/design-system/asset")
def brand_asset(
    project_id: UUID,
    path: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """A file under public/brand/ (the logo), for the editor."""
    from app.services.filesystem import safe_resolve

    _require_enabled()
    project = registry.design_system_project(db, user, project_id)
    if not path.startswith(_BRAND_DIR) or ".." in path:
        raise SitesError(400, "INVALID_PATH", "Only brand assets can be read here.")
    try:
        file_path = safe_resolve(str(project.id), path)
    except ValueError as exc:
        raise SitesError(400, "INVALID_PATH", "Only brand assets can be read here.") from exc
    ctype = _ASSET_TYPES.get(file_path.suffix.lower())
    if ctype is None or not file_path.is_file():
        raise SitesError(404, "ASSET_NOT_FOUND", "Asset not found.")
    return Response(
        content=file_path.read_bytes(),
        media_type=ctype,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
    )
