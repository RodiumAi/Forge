"""Resolve user attachment markers into multimodal LLM message parts."""

from __future__ import annotations

import base64
import contextlib
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from uuid import UUID

import httpx
from PIL import Image
from sqlalchemy.orm import Session

from app.models import StoredObject
from app.services.asset_storage import (
    asset_display_name,
    is_private_upload_url,
    materialize_asset_to_public,
    repair_private_upload_urls_in_project,
)
from app.services.filesystem import project_dir
from app.services.net_guard import BlockedURLError, validate_public_url_async

_IMAGE_MARKER_RE = re.compile(
    r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe|"
    r"Site asset|Asset joint):\s*"
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
    "Do NOT call image generation / do NOT invent a new stock photo — implement UI in code. "
    "Each reference screenshot maps to one screen/route when several are attached; "
    "derive route names from filenames when possible (home, pricing, about). "
    "Do NOT collapse multiple screenshots into one long scrolling page unless the user asks."
)

ASSET_VISION_INSTRUCTION = (
    "This is an uploaded site asset (logo/icon/image). "
    "Use the relative path from the markers (e.g. /images/...) in generated code "
    '(<img src="/images/..."> or CSS url(/images/...)). '
    "Never use raw S3 or object-store URLs — they are private and return AccessDenied. "
    "Do NOT generate a new image. Do NOT use a placeholder path. "
    "Do NOT recreate the logo/mark as SVG paths, CSS shapes, emoji, Lucide/icon fonts, "
    "or stylized text — always reference the uploaded file via <img> / url()."
)

MAX_VISION_IMAGES = 5
MAX_IMAGE_BYTES = 8 * 1024 * 1024
# Rodium Nest JSON body limit is ~12 MB; base64 adds ~33%. Keep each vision
# frame under ~1 MB binary so chat/completions stays well below the cap.
MAX_VISION_BINARY_BYTES = 900_000
MAX_VISION_DIMENSION_PX = 1920


def normalize_vision_image(body: bytes, ctype: str) -> tuple[bytes, str]:
    """Downscale/compress reference mockups before embedding as data: URLs."""
    if not body or "svg" in (ctype or "").lower():
        return body, ctype
    if len(body) <= MAX_VISION_BINARY_BYTES:
        try:
            with Image.open(BytesIO(body)) as probe:
                w, h = probe.size
            if max(w, h) <= MAX_VISION_DIMENSION_PX:
                return body, ctype
        except Exception:
            return body, ctype

    try:
        img = Image.open(BytesIO(body))
        img.load()
    except Exception:
        return body, ctype

    w, h = img.size
    scale = min(1.0, MAX_VISION_DIMENSION_PX / max(w, h, 1))
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    if img.mode in ("RGBA", "LA", "P"):
        base = Image.new("RGB", img.size, (255, 255, 255))
        layer = img.convert("RGBA") if img.mode == "P" else img
        base.paste(layer, mask=layer.split()[-1])
        img = base
    elif img.mode != "RGB":
        img = img.convert("RGB")

    quality = 85
    while quality >= 55:
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        out = buf.getvalue()
        if len(out) <= MAX_VISION_BINARY_BYTES:
            return out, "image/jpeg"
        quality -= 10

    smaller = img.resize((max(1, img.width * 3 // 4), max(1, img.height * 3 // 4)), Image.Resampling.LANCZOS)
    buf = BytesIO()
    smaller.save(buf, format="JPEG", quality=68, optimize=True)
    return buf.getvalue(), "image/jpeg"


def _vision_data_url(body: bytes, ctype: str) -> str:
    normalized, norm_type = normalize_vision_image(body, ctype)
    b64 = base64.b64encode(normalized).decode("ascii")
    return f"data:{norm_type};base64,{b64}"


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
            r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe|"
            r"Site asset|Asset joint):\s*([^\|\]]+)",
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


_MAX_FETCH_REDIRECTS = 5


async def _fetch_url(url: str) -> tuple[bytes, str] | None:
    # Validate every hop ourselves instead of letting httpx follow redirects
    # blindly — a public URL can 3xx to an internal host.
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            current = url
            for _ in range(_MAX_FETCH_REDIRECTS + 1):
                await validate_public_url_async(current)
                resp = await client.get(current)
                if resp.is_redirect:
                    location = resp.headers.get("location")
                    if not location:
                        return None
                    current = str(httpx.URL(str(resp.url)).join(location))
                    continue
                if resp.status_code >= 400:
                    return None
                body = resp.content
                if len(body) > MAX_IMAGE_BYTES:
                    # A truncated binary is a corrupt image; skip vision rather than send garbage.
                    return None
                ctype = (resp.headers.get("content-type") or "image/png").split(";")[0].strip()
                return body, ctype
            # Too many redirects.
            return None
    except BlockedURLError:
        return None
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
            return {
                "type": "image_url",
                "image_url": {"url": _vision_data_url(body, ctype)},
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
            return {
                "type": "image_url",
                "image_url": {"url": _vision_data_url(body, ctype)},
            }
        return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}

    if url.startswith("/") and db is not None:
        local = _read_local_public(project_id, url)
        if local:
            body, ctype = local
            if "svg" in ctype:
                return {"type": "text", "text": f"[Attached image {resolved.name}: {url}]"}
            return {
                "type": "image_url",
                "image_url": {"url": _vision_data_url(body, ctype)},
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


def _intent_for_marker(marker: str) -> str:
    intent_m = _INTENT_IN_MARKER_RE.search(marker)
    return intent_m.group(1).lower() if intent_m else "reference"


def materialize_asset_markers(db: Session, project_id: str, user_text: str) -> str:
    """For asset-intent uploads, copy bytes into public/images/ and rewrite marker URLs."""
    text = user_text or ""
    if not db or not _IMAGE_MARKER_RE.search(text):
        return text

    try:
        pid = UUID(project_id)
    except ValueError:
        return text

    from app.services.filesystem import write_bytes

    def replacer(match: re.Match[str]) -> str:
        marker = match.group(0)
        obj_m = _OBJECT_IN_MARKER_RE.search(marker)
        if not obj_m:
            return marker
        # Materialize when the marker is asset-intent OR when its URL points at
        # the private uploads bucket: a raw private S3 URL written into JSX is
        # always broken (AccessDenied), whatever the declared intent. Copying a
        # reference screenshot into public/images/ is harmless by comparison.
        intent = _intent_for_marker(marker)
        if intent != "asset":
            url_m = _URL_IN_MARKER_RE.search(marker) or _PUBLIC_IN_MARKER_RE.search(marker)
            if not url_m or not is_private_upload_url(url_m.group(1).strip()):
                return marker
        try:
            oid = UUID(obj_m.group(1).strip())
        except ValueError:
            return marker
        try:
            web_path = materialize_asset_to_public(db, pid, oid)
        except Exception:
            return marker

        # Align brand lock path: logo-like assets also land at /logo.{ext}.
        name_match = re.search(
            r"\[(?:Reference screenshot|Capture de référence|Image attached|Image jointe|"
            r"Site asset|Asset joint):\s*([^\|\]]+)",
            marker,
            re.I,
        )
        display_name = (name_match.group(1) if name_match else "").strip()
        if intent == "asset" and (
            _ASSET_FILENAME_RE.search(display_name) or re.search(r"logo", display_name, re.I)
        ):
            try:
                disk = project_dir(project_id) / "public" / web_path.lstrip("/")
                if disk.is_file():
                    ext = disk.suffix.lower() or ".png"
                    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"):
                        ext = ".png"
                    write_bytes(project_id, f"public/logo{ext}", disk.read_bytes())
            except Exception:
                pass

        updated = marker
        replaced = False
        for pat in (_URL_IN_MARKER_RE, _PUBLIC_IN_MARKER_RE):
            m = pat.search(updated)
            if m and is_private_upload_url(m.group(1).strip()):
                updated = pat.sub(f"| url:{web_path}", updated, count=1)
                replaced = True
                break
        if not replaced:
            # Prefer rewriting any existing url: to the public path for assets.
            if intent == "asset" and _URL_IN_MARKER_RE.search(updated):
                updated = _URL_IN_MARKER_RE.sub(f"| url:{web_path}", updated, count=1)
            else:
                updated = updated[:-1] + f" | url:{web_path}]"
        return updated

    return _IMAGE_MARKER_RE.sub(replacer, text)


def count_markers_by_intent(user_text: str, intent: str) -> int:
    """How many image markers declare the given intent (asset|reference)."""
    want = (intent or "").lower().strip()
    if not want:
        return 0
    n = 0
    for match in _IMAGE_MARKER_RE.finditer(user_text or ""):
        if _intent_for_marker(match.group(0)) == want:
            n += 1
    return n


def list_materialized_asset_paths(user_text: str) -> list[str]:
    """Relative /images/... paths from asset-intent markers (after materialize)."""
    paths: list[str] = []
    for match in _IMAGE_MARKER_RE.finditer(user_text or ""):
        marker = match.group(0)
        if _intent_for_marker(marker) != "asset":
            continue
        url_m = _URL_IN_MARKER_RE.search(marker) or _PUBLIC_IN_MARKER_RE.search(marker)
        if not url_m:
            continue
        url = url_m.group(1).strip()
        if url.startswith(("/images/", "/logo")) and url not in paths:
            paths.append(url)
    return paths


def vision_instruction_for_message(user_text: str) -> str | None:
    """Background-only instructions for attached images (never shown in chat UI)."""
    if not _IMAGE_MARKER_RE.search(user_text or ""):
        return None
    intents = _marker_intents(user_text)
    blocks: list[str] = []

    # Infer when markers lack intent: —
    if not intents:
        names = []
        for match in _IMAGE_MARKER_RE.finditer(user_text or ""):
            body = match.group(0)
            name = re.split(r"\s*\|\s*", body.split(":", 1)[-1], maxsplit=1)[0].strip(" []")
            names.append(name)
        if names and all(_REFERENCE_FILENAME_RE.search(n) for n in names):
            intents = ["reference"]
        elif (
            names
            and any(_ASSET_FILENAME_RE.search(n) for n in names)
            and not any(_REFERENCE_FILENAME_RE.search(n) for n in names)
        ):
            intents = ["asset"]
        else:
            intents = ["reference"]

    # Both can apply in one message (screenshot + logo) — never let reference wipe asset.
    if "reference" in intents:
        blocks.append(REFERENCE_VISION_INSTRUCTION)
    if "asset" in intents:
        blocks.append(ASSET_VISION_INSTRUCTION)
        asset_paths = list_materialized_asset_paths(user_text)
        if asset_paths:
            blocks.append("Must use these asset paths exactly (do not redraw): " + ", ".join(asset_paths))
    if not blocks:
        return REFERENCE_VISION_INSTRUCTION
    return "\n\n".join(blocks)


async def enrich_user_message_with_vision(
    db: Session | None,
    project_id: str,
    user_text: str,
) -> list[dict[str, Any]] | str:
    """Return multimodal content list or original string if no images resolved.

    Vision/asset instructions are injected here (LLM-only), not stored in chat UI text.
    """
    if db is not None:
        with contextlib.suppress(Exception):
            repair_private_upload_urls_in_project(db, UUID(project_id))
        user_text = materialize_asset_markers(db, project_id, user_text)

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
