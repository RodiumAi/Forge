"""Replace image src paths in project source files (visual image tool)."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from app.config import get_settings
from app.services.filesystem import write_file
from app.services.source_edit import SourceVariant, collect_matches, select_unique

_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css", ".html", ".svg")


@dataclass
class VisualImageResult:
    path: str
    occurrences: int


def _allowed_absolute_url(url: str) -> bool:
    """Only accept absolute URLs we serve ourselves.

    `new_public_path` comes from the client. Without this check any caller could
    have an arbitrary third-party URL written verbatim into the project source.
    """
    settings = get_settings()
    allowed_bases = [
        settings.object_store_public_endpoint or "",
        settings.object_store_endpoint or "",
        settings.api_base_url or "",
    ]
    try:
        host = urlparse(url).netloc
    except ValueError:
        return False
    if not host:
        return False
    for base in allowed_bases:
        if not base:
            continue
        try:
            if urlparse(base).netloc == host:
                return True
        except ValueError:
            continue
    return False


def _normalize_src(src: str) -> list[SourceVariant]:
    """Literal forms under which `src` may appear in source.

    Deliberately does NOT include the bare filename: using `logo.png` as a
    needle matched comments, variable names and unrelated URLs, and combined
    with a single-occurrence replace it could corrupt an arbitrary file.
    """
    raw = (src or "").strip()
    if not raw:
        return []

    forms: list[str] = [raw]
    parsed = urlparse(raw)
    path = unquote(parsed.path or raw)
    if path and path != raw:
        forms.append(path)
    if path.startswith("/"):
        forms.append(path.lstrip("/"))
        forms.append("public/" + path.lstrip("/"))

    seen: set[str] = set()
    out: list[SourceVariant] = []
    for form in forms:
        if form and form not in seen:
            seen.add(form)
            out.append(SourceVariant(form, "raw"))
    return out


def _resolve_target(new_public_path: str) -> tuple[str, str]:
    """Return (source_path, web_path) for the replacement image."""
    value = (new_public_path or "").strip().replace("\\", "/")
    if not value:
        raise ValueError("Missing new image path")

    if value.startswith(("http://", "https://")):
        # Private uploads bucket URLs must never be written into project source:
        # browsers get AccessDenied, and publish/export would hardcode MinIO.
        from app.services.asset_storage import is_private_upload_url

        if is_private_upload_url(value):
            raise ValueError("Private upload URL cannot be used as image src — pass object_id to materialize")
        if not _allowed_absolute_url(value):
            raise ValueError("Image URL is not served by this instance")
        return value, value
    if value.startswith("public/"):
        return value, "/" + value[len("public/") :]
    if value.startswith("/"):
        return "public/" + value.lstrip("/"), value
    return "public/" + value, "/" + value


def apply_visual_image_replace(
    project_id: str,
    old_src: str,
    new_public_path: str,
) -> VisualImageResult:
    source_path, web_path = _resolve_target(new_public_path)

    needles = _normalize_src(old_src)
    if not needles:
        raise ValueError("Missing old image src")

    matches = collect_matches(project_id, needles, _SOURCE_EXTS)
    if not matches:
        raise FileNotFoundError("image_src_not_found")

    match = select_unique(matches, "This image")

    literal = match.variant.literal
    if source_path.startswith(("http://", "https://")):
        replacement = source_path
    elif literal.startswith(("/", "http")):
        replacement = web_path
    elif literal.startswith("public/"):
        replacement = source_path
    else:
        replacement = web_path.lstrip("/")

    updated = match.content.replace(literal, replacement, 1)
    if updated == match.content:
        raise FileNotFoundError("image_src_not_found")

    write_file(project_id, match.path, updated)
    return VisualImageResult(path=match.path, occurrences=1)


# Kept for callers that still import the module-level helper.
__all__ = ["VisualImageResult", "apply_visual_image_replace"]
