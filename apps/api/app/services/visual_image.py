"""Replace image src paths in project source files (visual image tool)."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from app.config import get_settings
from app.services.edit_target import element_span, parse_forge_id
from app.services.filesystem import read_file, write_file
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


def _replacement_for(literal: str, source_path: str, web_path: str) -> str:
    """The new src, written in the same form as the literal it replaces."""
    if source_path.startswith(("http://", "https://")):
        return source_path
    if literal.startswith(("/", "http")):
        return web_path
    if literal.startswith("public/"):
        return source_path
    return web_path.lstrip("/")


def _replace_inside_element(
    project_id: str,
    forge_id: str | None,
    needles: list[SourceVariant],
    source_path: str,
    web_path: str,
) -> VisualImageResult | None:
    """Swap the src of the exact `<img>` the preview pointed at.

    None (fall back to the project-wide search) when the id is stale or the
    element does not hold one of the src forms exactly once (a src coming from
    a variable, for instance).
    """
    loc = parse_forge_id(forge_id)
    if loc is None or not loc.path.endswith(_SOURCE_EXTS):
        return None
    try:
        content = read_file(project_id, loc.path)
    except (OSError, ValueError):
        return None
    span = element_span(content, loc)
    if span is None:
        return None
    start, end = span
    region = content[start:end]
    for variant in needles:
        count = region.count(variant.literal)
        if count > 1:
            return None
        if count == 1:
            index = start + region.index(variant.literal)
            replacement = _replacement_for(variant.literal, source_path, web_path)
            updated = content[:index] + replacement + content[index + len(variant.literal) :]
            if updated == content:
                return None
            write_file(project_id, loc.path, updated)
            return VisualImageResult(path=loc.path, occurrences=1)
    return None


def apply_visual_image_replace(
    project_id: str,
    old_src: str,
    new_public_path: str,
    forge_id: str | None = None,
) -> VisualImageResult:
    """Point an image at a new file.

    ``forge_id`` (the `<img>` element's ``data-forge-id``) pins the change to
    that element; the project-wide unique-literal search is the fallback.
    """
    source_path, web_path = _resolve_target(new_public_path)

    needles = _normalize_src(old_src)
    if not needles:
        raise ValueError("Missing old image src")

    pinned = _replace_inside_element(project_id, forge_id, needles, source_path, web_path)
    if pinned is not None:
        return pinned

    matches = collect_matches(project_id, needles, _SOURCE_EXTS)
    if not matches:
        raise FileNotFoundError("image_src_not_found")

    match = select_unique(matches, "This image")

    literal = match.variant.literal
    replacement = _replacement_for(literal, source_path, web_path)

    updated = match.content.replace(literal, replacement, 1)
    if updated == match.content:
        raise FileNotFoundError("image_src_not_found")

    write_file(project_id, match.path, updated)
    return VisualImageResult(path=match.path, occurrences=1)


# Kept for callers that still import the module-level helper.
__all__ = ["VisualImageResult", "apply_visual_image_replace"]
