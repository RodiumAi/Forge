"""Codelab files, import, export and publication settings.

``codelab.json`` and the steps themselves go through ``routers/documents.py``;
this router covers what only a codelab has: the downloadable files under
``files/``, the Google Codelabs (claat) import, the Markdown, sources ZIP and
PDF exports (plan gated), and the feedback link shown on the end page.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale
from app.models import User
from app.routers.documents import _document_project
from app.services.codelab import exports, files, markdown_io, store

router = APIRouter(prefix="/projects", tags=["codelab"])


class ClaatImport(BaseModel):
    markdown: str = Field(min_length=1, max_length=markdown_io.MAX_IMPORT_CHARS)


class CodelabSettings(BaseModel):
    feedbackUrl: str | None = Field(default=None, max_length=2000)


def _attachment(data: bytes, filename: str, media_type: str) -> Response:
    safe = "".join(c if c.isascii() and (c.isalnum() or c in "-_.") else "-" for c in filename) or "codelab"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── files ──────────────────────────────────────────────────────────────────


@router.get("/{project_id}/codelab/files")
def list_codelab_files(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _document_project(db, user, project_id, request, "codelab")
    items = files.list_files(str(project_id))
    return {
        "files": [{"path": item.path, "size": item.size} for item in items],
        "limits": {
            "maxFileBytes": files.MAX_FILE_BYTES,
            "maxTotalBytes": files.MAX_TOTAL_BYTES,
            "maxFiles": files.MAX_FILES,
        },
    }


@router.post("/{project_id}/codelab/files")
async def upload_codelab_file(
    project_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form(default=""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    name = (file.filename or "").replace("\\", "/").split("/")[-1]
    # One byte past the limit is enough to refuse without buffering more.
    body = await file.read(files.MAX_FILE_BYTES + 1)
    path = "/".join(part for part in (folder.strip().strip("/"), name) if part)
    saved = files.save_file(str(project_id), path, body)
    return {"path": saved.path, "size": saved.size}


@router.delete("/{project_id}/codelab/files")
def delete_codelab_file(
    project_id: UUID,
    request: Request,
    path: str = Query(..., max_length=files.MAX_PATH_LENGTH),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    return {"deleted": files.remove_file(str(project_id), path)}


@router.get("/{project_id}/codelab/files/raw")
def download_codelab_file(
    project_id: UUID,
    request: Request,
    path: str = Query(..., max_length=files.MAX_PATH_LENGTH),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """One file, always as a download (never rendered by the browser)."""
    _document_project(db, user, project_id, request, "codelab")
    target = files.file_path_on_disk(str(project_id), path)
    return FileResponse(
        target,
        media_type="application/octet-stream",
        filename=target.name,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


# ── import ─────────────────────────────────────────────────────────────────


@router.post("/{project_id}/codelab/import/claat")
def import_claat(
    project_id: UUID,
    request: Request,
    body: ClaatImport,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Replace the steps with a Google Codelabs (claat) Markdown document."""
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    pid = str(project_id)
    imported = markdown_io.parse_claat(body.markdown)
    if not imported.steps:
        raise SitesError(422, "IMPORT_EMPTY", "No step found: claat steps start with '## '.")
    previous = store.read_codelab_or_default(pid)
    document, step_files = markdown_io.imported_document(imported, previous)
    store.begin_run(pid, "before codelab import")
    old_files = {step["file"] for step in previous.get("steps") or []}
    written = store.write_codelab(pid, document)
    for relative, markdown in step_files.items():
        store.write_step(pid, relative, markdown)
    for relative in old_files - set(step_files):
        store.remove_step_file(pid, relative)
    if imported.feedback_url:
        exports.write_settings(pid, {**exports.read_settings(pid), "feedbackUrl": imported.feedback_url})
    return JSONResponse({"codelab": written, "warnings": imported.warnings})


# ── exports ────────────────────────────────────────────────────────────────


@router.get("/{project_id}/codelab/export/markdown")
def export_codelab_markdown(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _document_project(db, user, project_id, request, "codelab")
    exports.require_codelab_export(db, user, "md")
    data, filename = exports.markdown_export(str(project_id), resolve_locale(request))
    return _attachment(data, filename, "text/markdown; charset=utf-8")


@router.get("/{project_id}/codelab/export/sources")
def export_codelab_sources(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _document_project(db, user, project_id, request, "codelab")
    exports.require_codelab_export(db, user, "zip")
    data, filename = exports.sources_export(str(project_id))
    return _attachment(data, filename, "application/zip")


@router.get("/{project_id}/codelab/export/pdf")
async def export_codelab_pdf(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    from app.services.codelab.pdf import render_pdf
    from app.services.codelab.publish import CodelabBundleMissing, build_codelab_site

    _document_project(db, user, project_id, request, "codelab")
    exports.require_codelab_export(db, user, "pdf")
    pid = str(project_id)
    title = store.read_codelab(pid).get("title") or "codelab"
    db.close()  # rendering takes seconds; release the connection
    with tempfile.TemporaryDirectory(prefix="forge-codelab-site-") as tmp:
        site = Path(tmp) / "site"
        site.mkdir()
        try:
            build_codelab_site(
                pid, site, site_url="https://localhost/", lang=resolve_locale(request), badge=False
            )
        except CodelabBundleMissing as exc:
            raise SitesError(503, "PLAYER_BUNDLE_MISSING", str(exc)) from exc
        data = await render_pdf(site)
    return _attachment(data, f"{store.slugify(title, 'codelab', 60)}.pdf", "application/pdf")


# ── settings ───────────────────────────────────────────────────────────────


@router.get("/{project_id}/codelab/settings")
def get_codelab_settings(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _document_project(db, user, project_id, request, "codelab")
    return exports.read_settings(str(project_id))


@router.put("/{project_id}/codelab/settings")
def put_codelab_settings(
    project_id: UUID,
    request: Request,
    body: CodelabSettings,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _document_project(db, user, project_id, request, "codelab", require_edit=True)
    return exports.write_settings(str(project_id), body.model_dump(exclude_none=True))
