"""Read / write SEO meta tags in project index.html and crop SEO assets."""

from __future__ import annotations

import io
import json
from typing import Any

from bs4 import BeautifulSoup
from PIL import Image

from app.services.filesystem import project_dir, read_file, write_bytes, write_file

INDEX_PATH = "index.html"
SEO_DIR = "public/seo"
FAVICON_REL = "public/seo/favicon.png"
APPLE_TOUCH_REL = "public/seo/apple-touch-icon.png"
OG_IMAGE_REL = "public/seo/og-image.png"

PUBLIC_FAVICON = "/seo/favicon.png"
PUBLIC_APPLE = "/seo/apple-touch-icon.png"
PUBLIC_OG = "/seo/og-image.png"

OG_SIZE = (1200, 630)
FAVICON_SIZE = (32, 32)
APPLE_SIZE = (180, 180)

EMPTY_META: dict[str, Any] = {
    "title": "",
    "description": "",
    "keywords": "",
    "canonical": "",
    "robots": "index, follow",
    "favicon_path": None,
    "apple_touch_path": None,
    "og_image_path": None,
    "og_title": "",
    "og_description": "",
    "og_type": "website",
    "twitter_card": "summary_large_image",
    "twitter_title": "",
    "twitter_description": "",
    "twitter_image_path": None,
}


def _attr(tag: Any, *keys: str) -> str:
    if tag is None:
        return ""
    for key in keys:
        val = tag.get(key)
        if val:
            return str(val).strip()
    return ""


def _rel_parts(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(x).lower() for x in value]
    return str(value).lower().replace(",", " ").split()


def _meta_content(soup: BeautifulSoup, *, name: str | None = None, prop: str | None = None) -> str:
    if name:
        tag = soup.find("meta", attrs={"name": name})
        if tag:
            return _attr(tag, "content")
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
        if tag:
            return _attr(tag, "content")
    return ""


def _link_href(soup: BeautifulSoup, rel: str) -> str | None:
    tag = soup.find("link", rel=lambda v: rel.lower() in _rel_parts(v))
    href = _attr(tag, "href") if tag else ""
    return href or None


def _public_to_disk(path: str | None) -> str | None:
    if not path:
        return None
    p = path.strip()
    if p.startswith("http://") or p.startswith("https://"):
        return None
    if p.startswith("/"):
        return f"public{p}"
    if p.startswith("public/"):
        return p
    return f"public/{p.lstrip('/')}"


def _disk_to_public(path: str | None) -> str | None:
    if not path:
        return None
    p = path.strip().replace("\\", "/")
    if p.startswith("public/"):
        return "/" + p[len("public/") :]
    if p.startswith("/"):
        return p
    return f"/{p}"


def _asset_exists(project_id: str, disk_path: str | None) -> bool:
    if not disk_path:
        return False
    return (project_dir(project_id) / disk_path).is_file()


def read_seo_meta(project_id: str) -> dict[str, Any]:
    out = dict(EMPTY_META)
    try:
        html = read_file(project_id, INDEX_PATH)
    except FileNotFoundError:
        return out

    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    out["title"] = title_tag.get_text(strip=True) if title_tag else ""
    out["description"] = _meta_content(soup, name="description")
    out["keywords"] = _meta_content(soup, name="keywords")
    out["robots"] = _meta_content(soup, name="robots") or "index, follow"
    out["canonical"] = _link_href(soup, "canonical") or ""

    fav = _link_href(soup, "icon")
    apple = _link_href(soup, "apple-touch-icon")
    out["favicon_path"] = fav if fav and _asset_exists(project_id, _public_to_disk(fav)) else fav
    out["apple_touch_path"] = apple

    out["og_title"] = _meta_content(soup, prop="og:title")
    out["og_description"] = _meta_content(soup, prop="og:description")
    out["og_type"] = _meta_content(soup, prop="og:type") or "website"
    og_img = _meta_content(soup, prop="og:image")
    out["og_image_path"] = og_img or None

    out["twitter_card"] = _meta_content(soup, name="twitter:card") or "summary_large_image"
    out["twitter_title"] = _meta_content(soup, name="twitter:title")
    out["twitter_description"] = _meta_content(soup, name="twitter:description")
    tw_img = _meta_content(soup, name="twitter:image")
    out["twitter_image_path"] = tw_img or None

    # Prefer on-disk defaults when files exist but tags are empty
    if _asset_exists(project_id, FAVICON_REL) and not out["favicon_path"]:
        out["favicon_path"] = PUBLIC_FAVICON
    elif _asset_exists(project_id, "public/favicon.png") and not out["favicon_path"]:
        out["favicon_path"] = "/favicon.png"
    if _asset_exists(project_id, APPLE_TOUCH_REL) and not out["apple_touch_path"]:
        out["apple_touch_path"] = PUBLIC_APPLE
    if _asset_exists(project_id, OG_IMAGE_REL):
        if not out["og_image_path"]:
            out["og_image_path"] = PUBLIC_OG
        if not out["twitter_image_path"]:
            out["twitter_image_path"] = PUBLIC_OG

    return out


def _ensure_head(soup: BeautifulSoup) -> Any:
    head = soup.find("head")
    if head:
        return head
    if not soup.html:
        html = soup.new_tag("html")
        soup.append(html)
    head = soup.new_tag("head")
    soup.html.insert(0, head)
    return head


def _set_title(soup: BeautifulSoup, head: Any, title: str) -> None:
    tag = soup.find("title")
    if tag is None:
        tag = soup.new_tag("title")
        head.append(tag)
    tag.string = title


def _upsert_meta(
    soup: BeautifulSoup,
    head: Any,
    *,
    name: str | None = None,
    prop: str | None = None,
    content: str,
) -> None:
    attrs: dict[str, str] = {}
    if name:
        attrs["name"] = name
    if prop:
        attrs["property"] = prop
    tag = soup.find("meta", attrs=attrs)
    if not content.strip():
        if tag:
            tag.decompose()
        return
    if tag is None:
        tag = soup.new_tag("meta", attrs=attrs)
        head.append(tag)
    tag["content"] = content.strip()


def _upsert_link(soup: BeautifulSoup, head: Any, *, rel: str, href: str, **extra: str) -> None:
    existing = soup.find("link", rel=lambda v: rel.lower() in _rel_parts(v))
    if not href.strip():
        if existing:
            existing.decompose()
        return
    if existing is None:
        existing = soup.new_tag("link", rel=rel)
        head.append(existing)
    existing["href"] = href.strip()
    for k, v in extra.items():
        if v:
            existing[k] = v


def write_seo_meta(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    try:
        html = read_file(project_id, INDEX_PATH)
    except FileNotFoundError:
        html = (
            "<!doctype html>\n<html lang=\"en\">\n  <head></head>\n"
            "  <body><div id=\"root\"></div></body>\n</html>\n"
        )

    soup = BeautifulSoup(html, "html.parser")
    head = _ensure_head(soup)

    title = str(data.get("title") or "").strip()
    description = str(data.get("description") or "").strip()
    keywords = str(data.get("keywords") or "").strip()
    canonical = str(data.get("canonical") or "").strip()
    robots = str(data.get("robots") or "index, follow").strip()

    favicon = _disk_to_public(str(data.get("favicon_path") or "").strip() or None) or ""
    apple = _disk_to_public(str(data.get("apple_touch_path") or "").strip() or None) or ""
    og_image = _disk_to_public(str(data.get("og_image_path") or "").strip() or None) or ""
    twitter_image = (
        _disk_to_public(str(data.get("twitter_image_path") or "").strip() or None) or og_image
    )

    og_title = str(data.get("og_title") or "").strip() or title
    og_description = str(data.get("og_description") or "").strip() or description
    og_type = str(data.get("og_type") or "website").strip() or "website"
    twitter_card = str(data.get("twitter_card") or "summary_large_image").strip() or "summary_large_image"
    twitter_title = str(data.get("twitter_title") or "").strip() or og_title
    twitter_description = str(data.get("twitter_description") or "").strip() or og_description

    _set_title(soup, head, title)
    _upsert_meta(soup, head, name="description", content=description)
    _upsert_meta(soup, head, name="keywords", content=keywords)
    _upsert_meta(soup, head, name="robots", content=robots)
    _upsert_link(soup, head, rel="canonical", href=canonical)

    _upsert_link(soup, head, rel="icon", href=favicon, type="image/png")
    _upsert_link(soup, head, rel="apple-touch-icon", href=apple)

    _upsert_meta(soup, head, prop="og:title", content=og_title)
    _upsert_meta(soup, head, prop="og:description", content=og_description)
    _upsert_meta(soup, head, prop="og:type", content=og_type)
    _upsert_meta(soup, head, prop="og:image", content=og_image)

    _upsert_meta(soup, head, name="twitter:card", content=twitter_card)
    _upsert_meta(soup, head, name="twitter:title", content=twitter_title)
    _upsert_meta(soup, head, name="twitter:description", content=twitter_description)
    _upsert_meta(soup, head, name="twitter:image", content=twitter_image)

    # Prefer pretty HTML close to Vite scaffold style
    out_html = str(soup)
    if not out_html.lstrip().lower().startswith("<!doctype"):
        out_html = "<!doctype html>\n" + out_html
    write_file(project_id, INDEX_PATH, out_html if out_html.endswith("\n") else out_html + "\n")
    return read_seo_meta(project_id)


def _open_image(raw: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(raw))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    return img


def _save_png(project_id: str, rel: str, img: Image.Image) -> str:
    buf = io.BytesIO()
    rgb = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")
    rgb.save(buf, format="PNG", optimize=True)
    write_bytes(project_id, rel, buf.getvalue())
    return _disk_to_public(rel) or f"/{rel.removeprefix('public/')}"


def save_favicon_asset(project_id: str, raw: bytes) -> dict[str, str]:
    img = _open_image(raw)
    # Center-crop to square then resize
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    square = img.crop((left, top, left + side, top + side))
    fav = square.resize(FAVICON_SIZE, Image.Resampling.LANCZOS)
    apple = square.resize(APPLE_SIZE, Image.Resampling.LANCZOS)
    favicon_path = _save_png(project_id, FAVICON_REL, fav)
    apple_path = _save_png(project_id, APPLE_TOUCH_REL, apple)
    return {"favicon_path": favicon_path, "apple_touch_path": apple_path}


def save_og_asset(project_id: str, raw: bytes) -> dict[str, str]:
    img = _open_image(raw)
    target_w, target_h = OG_SIZE
    target_ratio = target_w / target_h
    w, h = img.size
    ratio = w / h if h else target_ratio
    if abs(ratio - target_ratio) < 0.01:
        cropped = img
    elif ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        cropped = img.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        cropped = img.crop((0, top, w, top + new_h))
    resized = cropped.resize(OG_SIZE, Image.Resampling.LANCZOS)
    path = _save_png(project_id, OG_IMAGE_REL, resized)
    return {"og_image_path": path, "twitter_image_path": path}


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object in model response")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    return data


def gather_seo_context(project_id: str, project_name: str) -> str:
    chunks: list[str] = [f"Project name: {project_name}"]
    try:
        design = read_file(project_id, "DESIGN.md")
        chunks.append("DESIGN.md:\n" + design[:8000])
    except FileNotFoundError:
        pass

    from app.services.filesystem import list_files
    from app.services.orchestration.context import select_files

    files = list_files(project_id)
    picked = select_files("seo meta title description hero landing about", files, k=3)
    for path in picked[:3]:
        content = files.get(path) or ""
        chunks.append(f"{path}:\n{content[:4000]}")
    return "\n\n".join(chunks)
