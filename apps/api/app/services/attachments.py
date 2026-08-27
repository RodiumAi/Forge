"""Resolve user attachment markers into multimodal LLM message parts."""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.models import StoredObject
from app.services.asset_storage import asset_display_name
from app.services.filesystem import project_dir

_IMAGE_MARKER_RE = re.compile(
    r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe):\s*"
    r"[^\]]+\]",
    re.I,
)
_URL_IN_MARKER_RE = re.compile(r"\|\s*url:([^\|\]]+)", re.I)
_PUBLIC_IN_MARKER_RE = re.compile(r"\|\s*public:([^\|\]]+)", re.I)
_OBJECT_IN_MARKER_RE = re.compile(r"\|\s*object:([^\|\]]+)", re.I)
_INTENT_IN_MARKER_RE = re.compile(r"\|\s*intent:(asset|reference)\b", re.I)
_ASSET_FILENAME_RE = re.compile(
    r"(?:^|[/_.-])(?:logo|favicon|icon|icone|icône|brand|marque|banner|bannière)"
    r"(?:[._-]|\.[a-z0-9]+$)",
    re.I,
)
_REFERENCE_FILENAME_RE = re.compile(
    r"(?:screenshot|screen-?shot|capture|mockup|maquette|wireframe|reference|référence|"
    r"ref-?design|design-?ref)",
    re.I,
)

REFERENCE_VISION_INSTRUCTION = (
    "This is a REFERENCE screenshot/mockup for visual inspiration. "
    "Match its layout, hierarchy and style in the app. "
    "Do NOT call image generation / do NOT invent a new stock photo — implement UI in code."
)

ASSET_VISION_INSTRUCTION = (
    "This is an uploaded site asset (logo/icon/image). "
    "Use the exact CDN url: from the markers in generated code "
    '(<img src="..."> or CSS background-image). '
    "Do NOT generate a new image. Do NOT use a placeholder path."
)

MAX_VISION_IMAGES = 5
MAX_IMAGE_BYTES = 8 * 1024 * 1024


@dataclass
class ResolvedImage:
    url: str
    name: str
    object_id: str | None = None


def extract_image_urls(user_text: str) -> list[ResolvedImage]:
    text = user_text or ""
    found: list[ResolvedImage] = []
    seen: set[str] = set()

    for match in _IMAGE_MARKER_RE.finditer(text):
        marker = match.group(0)
        name_match = re.search(
            r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe):\s*([^\|\]]+)",
            marker,
            re.I,
        )
        name = (name_match.group(1) if name_match else "image").strip()
        url = ""
        object_id = None
        obj_m = _OBJECT_IN_MARKER_RE.search(marker)
        if obj_m:
            object_id = obj_m.group(1).strip() or None
        url_m = _URL_IN_MARKER_RE.search(marker)
        pub_m = _PUBLIC_IN_MARKER_RE.search(marker)
        if url_m:
            url = url_m.group(1).strip()
        elif pub_m:
            url = pub_m.group(1).strip()
        key = object_id or url
        if key and key not in seen:
            seen.add(key)
            found.append(ResolvedImage(url=url, name=name, object_id=object_id))

    # Also scan bare https URLs in asset instruction blocks
    for url in re.findall(r"https?://[^\s`'\"<>]+", text):
        if url not in seen and any(
            url.lower().endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif")
        ):
            seen.add(url)
            found.append(ResolvedImage(url=url, name=url.rsplit("/", 1)[-1]))

    return found[:MAX_VISION_IMAGES]


def _read_local_public(project_id: str, web_path: str) -> tuple[bytes, str] | None:
    rel = web_path.lstrip("/")
    if not rel:
        return None
    disk = project_dir(project_id) / "public" / rel
    if not disk.is_file():
        disk = project_dir(project_id) / rel
    if not disk.is_file():
        return None
    body = disk.read_bytes()
    if len(body) > MAX_IMAGE_BYTES:
        # A truncated binary is a corrupt image; skip vision rather than send garbage.
        return None
    ext = disk.suffix.lower()
    ctype = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    }.get(ext, "image/png")
    return body, ctype


async def _fetch_url(url: str) -> tuple[bytes, str] | None:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url)
        if resp.status_code >= 400:
            return None
        body = resp.content
        if len(body) > MAX_IMAGE_BYTES:
            # A truncated binary is a corrupt image; skip vision rather than send garbage.
            return None
        ctype = (resp.headers.get("content-type") or "image/png").split(";")[0].strip()
        return body, ctype
    except Exception:
        return None


def _stored_object_url(db: Session, project_id: str, url: str) -> StoredObject | None:
    try:
        pid = UUID(project_id)
    except ValueError:
        return None
    row = (
        db.query(StoredObject).filter(StoredObject.project_id == pid, StoredObject.public_url == url).first()
    )
    return row


def _read_stored_object(db: Session, project_id: str, object_id: str) -> tuple[bytes, str, str] | None:
    """Return (body, content_type, display_name) from StoredObject via S3."""
    try:
        pid = UUID(project_id)
        oid = UUID(object_id)
    except ValueError:
        return None
    row = db.query(StoredObject).filter(StoredObject.project_id == pid, StoredObject.id == oid).first()
    if row is None:
        return None
    try:
        from app.config import get_settings
        from app.providers.objects import get_object_store

        store = get_object_store()
        bucket = store.bucket_uploads or get_settings().aws_s3_bucket
        if not bucket:
            return None
        obj = store.internal.get_object(Bucket=bucket, Key=row.object_key)
        body = obj["Body"].read()
        if len(body) > MAX_IMAGE_BYTES:
            # A truncated binary is a corrupt image; skip vision rather than send garbage.
            return None
        ctype = row.content_type or "image/png"
        return body, ctype, asset_display_name(row.object_key)
    except Exception:
        return None


async def resolve_image_part(
    db: Session | None,
    project_id: str,
    resolved: ResolvedImage,
) -> dict[str, Any] | None:
    if resolved.object_id and db is not None:
        stored = _read_stored_object(db, project_id, resolved.object_id)
        if stored:
            body, ctype, name = stored
            if "svg" in ctype:
                return {"type": "text", "text": f"[Attached image {name}]"}
            b64 = base64.b64encode(body).decode("ascii")
            return {
                "type": "image_url",
                "image_url": {"url": f"data:{ctype};base64,{b64}"},
            }

    url = (resolved.url or "").strip()
    if not url:
        return None

    if url.startswith(("http://", "https://")):
        fetched = await _fetch_url(url)
        if fetched:
            body, ctype = fetched
            if "svg" in ctype:
                return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}
            b64 = base64.b64encode(body).decode("ascii")
            return {
                "type": "image_url",
                "image_url": {"url": f"data:{ctype};base64,{b64}"},
            }
        return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}

    if url.startswith("/") and db is not None:
        local = _read_local_public(project_id, url)
        if local:
            body, ctype = local
            if "svg" in ctype:
                return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}
            b64 = base64.b64encode(body).decode("ascii")
            return {
                "type": "image_url",
                "image_url": {"url": f"data:{ctype};base64,{b64}"},
            }

    if db is not None:
        row = _stored_object_url(db, project_id, url)
        if row:
            return await resolve_image_part(
                db,
                project_id,
                ResolvedImage(
                    url=row.public_url, name=asset_display_name(row.object_key), object_id=str(row.id)
                ),
            )

    return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}


def _marker_intents(user_text: str) -> list[str]:
    return [m.group(1).lower() for m in _INTENT_IN_MARKER_RE.finditer(user_text or "")]


def vision_instruction_for_message(user_text: str) -> str | None:
    """Background-only instructions for attached images (never shown in chat UI)."""
    if not _IMAGE_MARKER_RE.search(user_text or ""):
        return None
    intents = _marker_intents(user_text)
    if "asset" in intents and "reference" not in intents:
        return ASSET_VISION_INSTRUCTION
    if "reference" in intents:
        return REFERENCE_VISION_INSTRUCTION
    # Legacy markers without intent: — infer from filenames.
    names = []
    for match in _IMAGE_MARKER_RE.finditer(user_text or ""):
        body = match.group(0)
        name = re.split(r"\s*\|\s*", body.split(":", 1)[-1], maxsplit=1)[0].strip(" []")
        names.append(name)
    if names and all(_REFERENCE_FILENAME_RE.search(n) for n in names):
        return REFERENCE_VISION_INSTRUCTION
    if (
        names
        and any(_ASSET_FILENAME_RE.search(n) for n in names)
        and not any(_REFERENCE_FILENAME_RE.search(n) for n in names)
    ):
        return ASSET_VISION_INSTRUCTION
    return REFERENCE_VISION_INSTRUCTION


async def enrich_user_message_with_vision(
    db: Session | None,
    project_id: str,
    user_text: str,
) -> list[dict[str, Any]] | str:
    """Return multimodal content list or original string if no images resolved.

    Vision/asset instructions are injected here (LLM-only), not stored in chat UI text.
    """
    instruction = vision_instruction_for_message(user_text)
    text_for_llm = user_text
    if instruction and instruction not in (user_text or ""):
        text_for_llm = f"{user_text}\n\n{instruction}"

    images = extract_image_urls(user_text)
    if not images:
        return text_for_llm

    parts: list[dict[str, Any]] = [{"type": "text", "text": text_for_llm}]
    added = 0
    for img in images:
        part = await resolve_image_part(db, project_id, img)
        if part and part.get("type") == "image_url":
            parts.append(part)
            added += 1
    if added == 0:
        return text_for_llm
    return parts


def user_message_has_vision_images(content: str | list[Any]) -> bool:
    if isinstance(content, list):
        return any(isinstance(p, dict) and p.get("type") == "image_url" for p in content)
    return bool(_IMAGE_MARKER_RE.search(content or ""))
