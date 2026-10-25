"""Exports of the Forge Design document kinds.

``POST /projects/{id}/exports/{format}`` answers with the file itself (same
style as the project ZIP export): ``Content-Disposition`` names it and
``X-Forge-Export-Warnings`` carries the warnings (base64url JSON list, e.g.
fonts to install for a PPTX). Gated by plan (``services/exports/gating``):
a refused format answers 403 ``EXPORT_NOT_IN_PLAN`` with ``requiredPlan``.
"""

from __future__ import annotations

import base64
import json
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.errors import SitesError
from app.i18n import resolve_locale
from app.kinds import get_kind, kind_enabled
from app.models import User
from app.services import rate_limit
from app.services.exports.deck_exports import FORMATS, export_deck
from app.services.exports.gating import require_export, show_badge
from app.services.project_access import accessible_project

router = APIRouter(prefix="/projects", tags=["exports"])

EXPORT_LIMIT_PER_HOUR = 40
EXPORT_IP_LIMIT_PER_HOUR = 120


def enforce_export_limits(request: Request, user: User) -> None:
    """Hourly ceilings shared by every export that renders in Chromium."""
    rate_limit.enforce(request, "project-export-ip", limit=EXPORT_IP_LIMIT_PER_HOUR, window_seconds=3600)
    rate_limit.enforce(
        request, "project-export", limit=EXPORT_LIMIT_PER_HOUR, window_seconds=3600, subject=str(user.id)
    )
WARNINGS_HEADER = "X-Forge-Export-Warnings"
_MAX_WARNINGS_HEADER = 6000


class ExportOptions(BaseModel):
    #: PDF only: one page per animation step instead of one per slide.
    steps: bool = False
    #: HTML and PPTX: include speaker notes (the file stays with the owner).
    notes: bool = True
    #: HTML: keep the "Made with Forge" badge (only plans that may remove it can say no).
    badge: bool | None = None


def encode_warnings(warnings: list[dict]) -> str:
    """base64url JSON, trimmed to fit a header."""
    kept = list(warnings)
    while kept:
        raw = base64.urlsafe_b64encode(json.dumps(kept, ensure_ascii=False).encode("utf-8")).decode("ascii")
        if len(raw) <= _MAX_WARNINGS_HEADER:
            return raw
        kept.pop()
    return ""


@router.post("/{project_id}/exports/{fmt}")
async def export_document(
    project_id: UUID,
    fmt: str,
    request: Request,
    options: ExportOptions | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    locale = resolve_locale(request)
    fmt = fmt.strip().lower()
    project = accessible_project(db, user, project_id, locale)
    kind = get_kind(project.platform)
    if kind is None or fmt not in kind.exports or fmt not in FORMATS or kind.publish != "deck_player":
        raise SitesError(404, "EXPORT_FORMAT_UNKNOWN", f"{fmt} is not an export of this project type.")
    if not kind_enabled(kind.id):
        raise SitesError(404, "KIND_DISABLED", "This project type is not available yet.")
    require_export(db, user, fmt)
    enforce_export_limits(request, user)
    opts = options or ExportOptions()
    result = await export_deck(
        str(project.id),
        fmt,
        name=project.name or project.slug or "presentation",
        lang=locale,
        steps=opts.steps,
        notes=opts.notes,
        badge=show_badge(db, user, opts.badge),
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{result.filename}"',
        "Cache-Control": "no-store",
    }
    if result.warnings:
        encoded = encode_warnings(result.warnings)
        if encoded:
            headers[WARNINGS_HEADER] = encoded
    return Response(content=result.data, media_type=result.media_type, headers=headers)
