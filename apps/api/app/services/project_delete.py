"""Full project teardown — preview, filesystem, object store, DB row."""

from __future__ import annotations

import logging
import shutil
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Project
from app.services import preview_babel
from app.services.filesystem import project_dir

logger = logging.getLogger("project_delete")


def delete_project_full(db: Session, project: Project) -> None:
    """Stop preview, remove workspace files, purge published assets, delete row."""
    pid = str(project.id)
    slug = project.slug

    try:
        preview_babel.stop_babel_preview(pid)
    except Exception:
        logger.exception("Failed to stop preview before delete project=%s", pid)

    try:
        root = project_dir(pid)
        if root.exists():
            shutil.rmtree(root, ignore_errors=True)
    except Exception:
        logger.exception("Failed to remove project files project=%s", pid)

    try:
        settings = get_settings()
        from app.providers.objects import get_object_store

        store = get_object_store()
        bucket = store.bucket_site_assets or settings.bucket_site_assets
        if bucket and slug:
            store.delete_prefix(bucket, f"{slug}/")
    except Exception:
        logger.exception("Failed to cleanup published assets slug=%s", slug)

    db.delete(project)
    db.commit()


def delete_project_by_id(db: Session, project_id: UUID) -> bool:
    project = db.get(Project, project_id)
    if project is None:
        return False
    delete_project_full(db, project)
    return True
