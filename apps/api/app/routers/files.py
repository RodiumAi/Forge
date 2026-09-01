import mimetypes
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.errors import provider_not_configured
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.providers.objects import get_object_store
from app.schemas import FileContent, FileNode
from app.services import history
from app.services.asset_storage import (
    asset_display_name,
    get_project_asset,
    get_project_asset_by_public_url,
    is_private_upload_url,
    list_project_assets,
    materialize_asset_to_public,
    upload_project_asset,
)
from app.services.filesystem import (
    BinaryFileError,
    content_version,
    delete_file,
    file_tree,
    project_dir,
    read_file,
    rename_path,
    write_file,
)
from app.services.visual_edit import apply_visual_text_edit
from app.services.visual_image import apply_visual_image_replace

router = APIRouter(prefix="/projects", tags=["files"])

IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/ico",
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico"}


class FileWriteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    content: str = Field(default="", max_length=2_000_000)
    # Version loaded by the client; empty means "force write".
    version: str = Field(default="", max_length=64)


class FileUploadResponse(BaseModel):
    ok: bool = True
    object_id: str
    object_key: str
    public_url: str
    content_type: str
    name: str
    # Legacy fields for older clients
    path: str = ""
    public_path: str = ""


class ProjectAssetOut(BaseModel):
    id: str
    name: str
    public_url: str
    content_type: str
    byte_size: int
    object_key: str
    created_at: str


class VisualEditRequest(BaseModel):
    old_text: str = Field(min_length=1, max_length=4000)
    new_text: str = Field(default="", max_length=4000)


class VisualEditResponse(BaseModel):
    ok: bool = True
    path: str
    occurrences: int = 1


class VisualImageRequest(BaseModel):
    old_src: str = Field(min_length=1, max_length=2000)
    new_public_path: str = Field(min_length=1, max_length=2000)
    # Stored-upload id: the API copies the bytes into the project's public/
    # and writes a relative /images/... src instead of an object-store URL.
    object_id: UUID | None = None


class VisualImageResponse(BaseModel):
    ok: bool = True
    path: str
    occurrences: int = 1


def _owned(db: Session, user: User, project_id: UUID, locale: str = "fr") -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=t("project_not_found", locale),  # type: ignore[arg-type]
        )
    return project


@router.get("/{project_id}/files", response_model=list[FileNode])
def get_tree(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FileNode]:
    _owned(db, user, project_id, resolve_locale(request))
    return file_tree(str(project_id))


@router.get("/{project_id}/files/content", response_model=FileContent)
def get_file_content(
    project_id: UUID,
    path: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileContent:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    try:
        content = read_file(str(project_id), path)
    except BinaryFileError as exc:
        raise HTTPException(
            status_code=415,
            detail=t("file_binary", locale),  # type: ignore[arg-type]
        ) from exc
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=t("file_not_found", locale)) from exc
    return FileContent(
        path=path,
        content=content,
        version=content_version(str(project_id), path),
    )


@router.put("/{project_id}/files/content", response_model=FileContent)
def put_file_content(
    project_id: UUID,
    body: FileWriteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileContent:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    path = body.path.strip().lstrip("/")
    if not path or ".." in path.split("/"):
        raise HTTPException(status_code=400, detail=t("file_not_found", locale))

    # Optimistic concurrency: the agent writes to the same files, and the editor
    # holds an in-memory copy. Without this check a save silently discarded
    # whatever was written under it.
    if body.version:
        current = content_version(str(project_id), path)
        if current and current != body.version:
            raise HTTPException(
                status_code=409,
                detail=t("file_conflict", locale),  # type: ignore[arg-type]
            )

    try:
        history.snapshot(str(project_id), f"before manual edit: {path}")
        write_file(str(project_id), path, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileContent(
        path=path,
        content=body.content,
        version=content_version(str(project_id), path),
    )


class FileRenameRequest(BaseModel):
    from_path: str = Field(min_length=1, max_length=500)
    to_path: str = Field(min_length=1, max_length=500)


@router.post("/{project_id}/files/rename", response_model=dict)
def rename_file(
    project_id: UUID,
    body: FileRenameRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    src = body.from_path.strip().lstrip("/")
    dst = body.to_path.strip().lstrip("/")
    if not src or not dst or ".." in src.split("/") or ".." in dst.split("/"):
        raise HTTPException(status_code=400, detail=t("file_not_found", locale))
    if src == dst:
        return {"ok": True, "path": dst}
    try:
        history.snapshot(str(project_id), f"before rename: {src} -> {dst}")
        rename_path(str(project_id), src, dst)
    except FileExistsError as exc:
        raise HTTPException(
            status_code=409,
            detail=t("file_exists", locale),  # type: ignore[arg-type]
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=t("file_not_found", locale)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "path": dst}


@router.get("/{project_id}/public/{asset_path:path}", include_in_schema=False)
def get_public_asset(
    project_id: UUID,
    asset_path: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Serve a file from the project's `public/` folder (favicon, OG image...).

    These used to be reachable through the Vite preview proxy at
    /preview/{id}/<file>; that proxy is gone, so favicon and SEO previews in the
    builder pointed at a dead route. Auth rides the `?access_token=` support so
    the URL works directly in an <img src>.
    """
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)

    rel = asset_path.strip().lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=404, detail=t("file_not_found", locale))

    root = project_dir(str(project_id))
    candidates = [root / "public" / rel, root / rel]
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
            resolved.relative_to(root.resolve())
        except (OSError, ValueError):
            continue
        if resolved.is_file():
            media_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
            return Response(
                content=resolved.read_bytes(),
                media_type=media_type,
                headers={"Cache-Control": "no-cache"},
            )

    raise HTTPException(status_code=404, detail=t("file_not_found", locale))


@router.delete("/{project_id}/files")
def remove_file(
    project_id: UUID,
    path: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    rel = path.strip().lstrip("/")
    try:
        history.snapshot(str(project_id), f"before delete: {rel}")
        delete_file(str(project_id), rel)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "path": rel}


@router.get("/{project_id}/assets", response_model=list[ProjectAssetOut])
def list_assets(
    project_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectAssetOut]:
    _owned(db, user, project_id, resolve_locale(request))
    rows = list_project_assets(db, project_id)
    return [
        ProjectAssetOut(
            id=str(row.id),
            name=asset_display_name(row.object_key),
            public_url=row.public_url,
            content_type=row.content_type,
            byte_size=int(row.byte_size or 0),
            object_key=row.object_key,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


def _presigned_asset_url(row) -> str:
    store = get_object_store()
    bucket = store.bucket_uploads or get_settings().aws_s3_bucket
    if not bucket:
        return row.public_url
    try:
        return store.presign_get(bucket, row.object_key, expires=3600)
    except Exception:
        return row.public_url


@router.get("/{project_id}/assets/{object_id}")
def redirect_asset(
    project_id: UUID,
    object_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    _owned(db, user, project_id, resolve_locale(request))
    row = get_project_asset(db, project_id, object_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return RedirectResponse(url=_presigned_asset_url(row), status_code=302)


@router.get("/{project_id}/assets/{object_id}/content")
def stream_asset_content(
    project_id: UUID,
    object_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Authenticated asset body for <img src> (Bearer or ?access_token=)."""
    _owned(db, user, project_id, resolve_locale(request))
    row = get_project_asset(db, project_id, object_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    store = get_object_store()
    bucket = store.bucket_uploads or get_settings().aws_s3_bucket
    if not bucket:
        raise HTTPException(status_code=503, detail="Object store not configured")
    try:
        obj = store.internal.get_object(Bucket=bucket, Key=row.object_key)
        body = obj["Body"].read()
    except Exception:
        # Fallback: redirect to a short-lived signed URL.
        return RedirectResponse(url=_presigned_asset_url(row), status_code=302)
    return Response(
        content=body,
        media_type=row.content_type or "application/octet-stream",
        headers={
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": f'inline; filename="{asset_display_name(row.object_key)}"',
        },
    )


@router.post("/{project_id}/files/upload", response_model=FileUploadResponse)
async def upload_project_image(
    project_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileUploadResponse:
    locale = resolve_locale(request)
    project = _owned(db, user, project_id, locale)
    filename = (file.filename or "image.png").replace("\\", "/").split("/")[-1]
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    content_type = (file.content_type or "").lower()
    if content_type not in IMAGE_TYPES and ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    body = await file.read()
    if len(body) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8 MB)")
    safe = "".join(c if c.isalnum() or c in ".-_" else "-" for c in filename).strip("-") or "image.png"
    if "." not in safe and ext:
        safe = safe + ext
    try:
        row = upload_project_asset(
            db,
            user=user,
            project=project,
            body=body,
            filename=safe,
            content_type=content_type or "application/octet-stream",
        )
    except provider_not_configured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:300]) from exc
    name = asset_display_name(row.object_key)
    return FileUploadResponse(
        object_id=str(row.id),
        object_key=row.object_key,
        public_url=row.public_url,
        content_type=row.content_type,
        name=name,
        path=row.object_key,
        public_path=row.public_url,
    )


def _ambiguous_detail(base: str, exc: BaseException) -> str:
    """Append the concrete reason so the user knows why the edit was refused."""
    from app.services.source_edit import AmbiguousMatch

    if not isinstance(exc, AmbiguousMatch):
        return base
    where = ", ".join(exc.candidates[:3])
    if len(exc.candidates) > 3:
        where += f" (+{len(exc.candidates) - 3})"
    return f"{base} — {exc}. {where}" if where else f"{base} — {exc}."


@router.post("/{project_id}/visual-edit", response_model=VisualEditResponse)
def visual_edit_text(
    project_id: UUID,
    body: VisualEditRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VisualEditResponse:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    # Visual edits rewrite source files just like the agent does; without a
    # checkpoint they were the only irreversible mutation in the product.
    history.snapshot(str(project_id), "before visual text edit")
    try:
        result = apply_visual_text_edit(str(project_id), body.old_text, body.new_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=t("visual_edit_invalid", locale)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=t("visual_edit_not_found", locale)) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=409,
            detail=_ambiguous_detail(t("visual_edit_ambiguous", locale), exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:300]) from exc
    return VisualEditResponse(ok=True, path=result.path, occurrences=result.occurrences)


@router.post("/{project_id}/visual-image", response_model=VisualImageResponse)
def visual_edit_image(
    project_id: UUID,
    body: VisualImageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VisualImageResponse:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    history.snapshot(str(project_id), "before visual image replace")
    new_path = body.new_public_path
    # The uploads bucket is private: writing its URL into JSX gives AccessDenied
    # in the preview and breaks publish/export. Always materialize into
    # public/images/ and reference with a relative /images/... src.
    object_id = body.object_id
    if object_id is None and is_private_upload_url(body.new_public_path):
        row = get_project_asset_by_public_url(db, project_id, body.new_public_path)
        if row is not None:
            object_id = row.id
    if object_id is not None:
        try:
            new_path = materialize_asset_to_public(db, project_id, object_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Asset not found") from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)[:300]) from exc
    elif is_private_upload_url(body.new_public_path):
        raise HTTPException(
            status_code=400,
            detail="Private upload URL cannot be used as image src — re-upload or pass object_id",
        )
    try:
        result = apply_visual_image_replace(
            str(project_id),
            body.old_src,
            new_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)[:200]) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=t("visual_image_not_found", locale)) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=409,
            detail=_ambiguous_detail(t("visual_image_ambiguous", locale), exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:300]) from exc
    return VisualImageResponse(ok=True, path=result.path, occurrences=result.occurrences)
