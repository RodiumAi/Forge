"""Codelab exports and their plan gating (docs/plans/forge-design-plan.md, section 8).

| Export          | Free | Starter | Builder and up | Open source |
|-----------------|------|---------|----------------|-------------|
| Markdown, ZIP   | no   | yes     | yes            | yes         |
| PDF             | no   | ``export_pdf`` right (Starter and up) | | yes |

Open-source and BYOK installs have no entitlement cache: nothing is gated.
A Forge Cloud account with no synced plan counts as Free.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.errors import SitesError
from app.models import User
from app.services.codelab.files import zip_all_files
from app.services.codelab.markdown_io import export_markdown
from app.services.codelab.store import read_all_steps, read_codelab, slugify
from app.services.entitlements import entitlements_apply, get_entitlements
from app.services.filesystem import read_file, write_file

ExportFormat = Literal["md", "zip", "pdf"]
SETTINGS_PATH = ".forge/codelab-settings.json"


def require_codelab_export(db: Session, user: User, fmt: ExportFormat) -> None:
    if not entitlements_apply(user):
        return
    row = get_entitlements(db, user)
    slug = (row.plan_slug if row is not None else "free").strip().lower()
    if row is None or slug == "free":
        raise SitesError(403, "FEATURE_NOT_IN_PLAN", "Codelab exports start with the Starter plan.")
    if fmt == "pdf" and not bool(row.export_pdf):
        raise SitesError(403, "FEATURE_NOT_IN_PLAN", "PDF export is not included in the current Forge plan.")


def read_settings(project_id: str) -> dict[str, Any]:
    """Publication settings kept beside the codelab (not part of the contract)."""
    try:
        data = json.loads(read_file(project_id, SETTINGS_PATH))
    except (FileNotFoundError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, Any] = {}
    url = data.get("feedbackUrl")
    if isinstance(url, str) and url.startswith("https://") and len(url) <= 2000:
        out["feedbackUrl"] = url
    return out


def write_settings(project_id: str, settings: dict[str, Any]) -> dict[str, Any]:
    url = settings.get("feedbackUrl")
    clean: dict[str, Any] = {}
    if isinstance(url, str) and url.strip():
        url = url.strip()
        if not url.startswith("https://") or len(url) > 2000:
            raise SitesError(400, "INVALID_URL", "The feedback link must be an https:// URL.")
        clean["feedbackUrl"] = url
    write_file(project_id, SETTINGS_PATH, json.dumps(clean, ensure_ascii=False, indent=2) + "\n")
    return clean


def markdown_export(project_id: str, locale: str = "fr") -> tuple[bytes, str]:
    codelab = read_codelab(project_id)
    steps = read_all_steps(project_id, codelab)
    text = export_markdown(
        codelab, steps, feedback_url=read_settings(project_id).get("feedbackUrl"), locale=locale
    )
    return text.encode("utf-8"), f"{slugify(codelab.get('title') or 'codelab', 'codelab', 60)}.md"


def sources_export(project_id: str) -> tuple[bytes, str]:
    codelab = read_codelab(project_id)
    name = slugify(codelab.get("title") or "codelab", "codelab", 60)
    return zip_all_files(project_id, prefix=f"{name}/"), f"{name}-sources.zip"
