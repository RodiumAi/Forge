"""Images a project can use, and how the agent learns about them.

Generated images are stored as WebP with responsive variants (``-640``,
``-1024`` suffixes) and described in ``.forge/media.json`` (outside ``public/``
so prompts and alt texts are not published). Every code prompt lists the
project's images with their real dimensions, so the model references files that
exist and writes ``width``/``height``/``srcset`` instead of guessing.
"""

from __future__ import annotations

import io
import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.services.filesystem import project_dir, read_file, write_bytes, write_file

logger = logging.getLogger(__name__)

MEDIA_INDEX = ".forge/media.json"
RASTER_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")
IMAGE_EXTS = (*RASTER_EXTS, ".svg")
VARIANT_WIDTHS = (640, 1024)
_MAX_LISTED = 40
# Brand plumbing the agent should not pick as content imagery.
_HIDDEN = {"/favicon.png", "/forge-logo.png", "/apple-touch-icon.png"}
_VARIANT_RE = re.compile(r"-(\d{3,4})\.webp$")


@dataclass
class MediaEntry:
    path: str  # public URL path, e.g. /generated/hero-1a2b.webp
    width: int
    height: int
    alt: str = ""
    kind: str = "upload"  # generated | upload
    role: str = ""  # hero | section | ...
    srcset: list[tuple[str, int]] = field(default_factory=list)


def _load_index(project_id: str) -> dict[str, dict]:
    try:
        data = json.loads(read_file(project_id, MEDIA_INDEX))
    except (FileNotFoundError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_index(project_id: str, index: dict[str, dict]) -> None:
    write_file(project_id, MEDIA_INDEX, json.dumps(index, ensure_ascii=False, indent=2) + "\n")


def record_media(project_id: str, entry: MediaEntry) -> None:
    index = _load_index(project_id)
    index[entry.path] = asdict(entry)
    _save_index(project_id, index)


def save_webp_with_variants(
    project_id: str,
    raw: bytes,
    *,
    stem: str,
    folder: str = "public/generated",
    quality: int = 82,
) -> MediaEntry:
    """Encode ``raw`` as WebP plus narrower variants; return the media entry."""
    from PIL import Image

    with Image.open(io.BytesIO(raw)) as img:
        img.load()
        has_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
        base = img.convert("RGBA" if has_alpha else "RGB")
    width, height = base.size

    def encode(im) -> bytes:
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=quality, method=5)
        return buf.getvalue()

    rel_main = f"{folder}/{stem}.webp"
    write_bytes(project_id, rel_main, encode(base))
    srcset: list[tuple[str, int]] = []
    for target in VARIANT_WIDTHS:
        if target >= width:
            continue
        ratio = target / width
        variant = base.resize((target, max(1, round(height * ratio))), Image.LANCZOS)
        rel = f"{folder}/{stem}-{target}.webp"
        write_bytes(project_id, rel, encode(variant))
        srcset.append(("/" + rel.removeprefix("public/"), target))
    public_main = "/" + rel_main.removeprefix("public/")
    srcset.append((public_main, width))
    return MediaEntry(path=public_main, width=width, height=height, srcset=srcset)


def _image_size(path: Path) -> tuple[int, int] | None:
    if path.suffix.lower() == ".svg":
        return None
    try:
        from PIL import Image

        with Image.open(path) as img:
            return img.size
    except Exception:
        return None


def list_project_images(project_id: str) -> list[MediaEntry]:
    """Images under public/ (variants folded into their main entry)."""
    root = project_dir(project_id) / "public"
    if not root.is_dir():
        return []
    index = _load_index(project_id)
    out: list[MediaEntry] = []
    for disk in sorted(root.rglob("*")):
        if not disk.is_file() or disk.suffix.lower() not in IMAGE_EXTS:
            continue
        public_path = "/" + disk.relative_to(root).as_posix()
        if public_path in _HIDDEN or _VARIANT_RE.search(public_path):
            continue
        meta = index.get(public_path)
        if meta:
            entry = MediaEntry(
                path=public_path,
                width=int(meta.get("width") or 0),
                height=int(meta.get("height") or 0),
                alt=str(meta.get("alt") or ""),
                kind=str(meta.get("kind") or "upload"),
                role=str(meta.get("role") or ""),
                srcset=[(str(p), int(w)) for p, w in (meta.get("srcset") or [])],
            )
        else:
            size = _image_size(disk)
            entry = MediaEntry(path=public_path, width=size[0] if size else 0, height=size[1] if size else 0)
        out.append(entry)
        if len(out) >= _MAX_LISTED:
            break
    return out


def public_asset_exists(project_id: str, public_path: str) -> bool:
    clean = (public_path or "").split("?")[0].split("#")[0].lstrip("/")
    if not clean:
        return False
    try:
        base = (project_dir(project_id) / "public").resolve()
        target = (base / clean).resolve()
    except OSError:
        return False
    return base in target.parents and target.is_file()


def format_project_media_layer(project_id: str) -> str:
    try:
        images = list_project_images(project_id)
    except Exception:
        logger.warning("media listing failed for %s", project_id, exc_info=True)
        return ""
    if not images:
        return ""
    lines = [
        "Project images (these files exist under public/; reference them by these exact "
        "paths, never invent image URLs or Unsplash ids):"
    ]
    for item in images:
        dims = f" {item.width}x{item.height}" if item.width and item.height else ""
        bits = [f"- {item.path}{dims}"]
        if item.role:
            bits.append(f"role: {item.role}")
        if item.alt:
            bits.append(f'alt: "{item.alt}"')
        if len(item.srcset) > 1:
            bits.append("srcset: " + ", ".join(f"{p} {w}w" for p, w in item.srcset))
        lines.append(" | ".join(bits))
    lines.append(
        "Use <img src width height alt> with the real dimensions above (srcset + sizes "
        'when listed); loading="lazy" decoding="async" below the fold, '
        'fetchpriority="high" on the hero image only.'
    )
    return "\n".join(lines)
