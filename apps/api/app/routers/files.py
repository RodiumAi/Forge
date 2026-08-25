from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.i18n import resolve_locale, t
from app.models import Project, User
from app.schemas import FileContent, FileNode
from app.services.filesystem import delete_file, file_tree, read_file, write_bytes, write_file
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
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


class FileWriteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    content: str = Field(default="", max_length=2_000_000)


class FileUploadResponse(BaseModel):
    ok: bool = True
    path: str
    public_path: str


class VisualEditRequest(BaseModel):
    old_text: str = Field(min_length=1, max_length=4000)
    new_text: str = Field(default="", max_length=4000)


class VisualEditResponse(BaseModel):
    ok: bool = True
    path: str
    occurrences: int = 1


class VisualImageRequest(BaseModel):
    old_src: str = Field(min_length=1, max_length=2000)
    new_public_path: str = Field(min_length=1, max_length=500)


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
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=t("file_not_found", locale)) from exc
    return FileContent(path=path, content=content)


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
    try:
        write_file(str(project_id), path, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileContent(path=path, content=body.content)


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
        delete_file(str(project_id), rel)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "path": rel}


@router.post("/{project_id}/files/upload", response_model=FileUploadResponse)
async def upload_project_image(
    project_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileUploadResponse:
    locale = resolve_locale(request)
    _owned(db, user, project_id, locale)
    filename = (file.filename or "image.png").replace("\\", "/").split("/")[-1]
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    content_type = (file.content_type or "").lower()
    if content_type not in IMAGE_TYPES and ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    body = await file.read()
    if len(body) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8 MB)")
    # Sanitize name
    safe = "".join(c if c.isalnum() or c in ".-_" else "-" for c in filename).strip("-") or "image.png"
    if "." not in safe and ext:
        safe = safe + ext
    rel = f"public/{safe}"
    try:
        write_bytes(str(project_id), rel, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileUploadResponse(path=rel, public_path=f"/{safe}")


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
    try:
        result = apply_visual_text_edit(str(project_id), body.old_text, body.new_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=t("visual_edit_invalid", locale)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=t("visual_edit_not_found", locale)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=t("visual_edit_ambiguous", locale)) from exc
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
    try:
        result = apply_visual_image_replace(
            str(project_id),
            body.old_src,
            body.new_public_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)[:200]) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=t("visual_image_not_found", locale)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=t("visual_image_ambiguous", locale)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:300]) from exc
    return VisualImageResponse(ok=True, path=result.path, occurrences=result.occurrences)
