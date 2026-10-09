"""Publish: production build, pre-render, SEO files, upload with cache headers.

1. `runtime/cli.mjs` builds the site (same Babel transform as the preview,
   bundled/minified/hashed by esbuild, dependencies embedded).
2. `public/` and the assets the code imports are copied; oversized raster
   images are resized and recompressed (paths unchanged).
3. Every route is pre-rendered (`prerender.py`) and gets its own head
   (canonical, og:url, language, structured data); `404.html` is written for
   unknown paths; `sitemap.xml` / `robots.txt` are generated unless the project
   ships its own.
4. Files are uploaded with long-lived caching for hashed assets and
   revalidation for HTML, then keys from older builds are removed.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import mimetypes
import shutil
import tempfile
from pathlib import Path

from app.config import get_settings
from app.providers.objects import get_object_store
from app.services.filesystem import project_dir
from app.services.preview_babel import collect_project_source_files

logger = logging.getLogger("publish_esm")

_UPLOAD_CONCURRENCY = 12
_SOURCE_SUFFIXES = (".tsx", ".ts", ".jsx", ".js", ".css")
_BINARY_ASSET_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
)
_RASTER_OPTIMIZE = (".png", ".jpg", ".jpeg", ".webp")
_MAX_IMAGE_WIDTH = 2400
_OPTIMIZE_MIN_BYTES = 120_000
CACHE_IMMUTABLE = "public, max-age=31536000, immutable"
CACHE_HTML = "public, max-age=0, must-revalidate"
CACHE_DEFAULT = "public, max-age=86400"
CACHE_SHORT = "public, max-age=3600"


def runtime_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "runtime"


def _asset_paths(project_id: str) -> list[str]:
    """Non-text files under src/ that code may import (`import logo from "./logo.png"`)."""
    src = project_dir(project_id) / "src"
    if not src.is_dir():
        return []
    root = project_dir(project_id)
    return sorted(
        p.relative_to(root).as_posix()
        for p in src.rglob("*")
        if p.is_file() and p.suffix.lower() in _BINARY_ASSET_SUFFIXES
    )


def optimize_images(out_dir: Path) -> int:
    """Resize oversized rasters to 2400px wide and recompress, in place.

    Paths and formats are kept (the code references them), and a result that
    is not smaller is discarded. Returns the number of files rewritten.
    """
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - Pillow ships with the API
        return 0
    changed = 0
    for path in out_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in _RASTER_OPTIMIZE:
            continue
        try:
            original = path.read_bytes()
            if len(original) < _OPTIMIZE_MIN_BYTES:
                continue
            with Image.open(io.BytesIO(original)) as img:
                img.load()
                fmt = (img.format or "").upper()
                if getattr(img, "is_animated", False):
                    continue
                if img.width > _MAX_IMAGE_WIDTH:
                    ratio = _MAX_IMAGE_WIDTH / img.width
                    img = img.resize((_MAX_IMAGE_WIDTH, max(1, round(img.height * ratio))), Image.LANCZOS)
                buf = io.BytesIO()
                if fmt in ("JPEG", "JPG"):
                    img.convert("RGB").save(buf, format="JPEG", quality=82, optimize=True, progressive=True)
                elif fmt == "WEBP":
                    img.save(buf, format="WEBP", quality=82, method=5)
                else:
                    img.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
            if data and len(data) < len(original):
                path.write_bytes(data)
                changed += 1
        except Exception:
            logger.info("image optimisation skipped for %s", path.name, exc_info=True)
    return changed


async def transform_project_to_dir(
    project_id: str,
    out_dir: Path,
    *,
    title: str = "Forge app",
    lang: str = "en",
) -> dict:
    """Production build of the project into `out_dir` (no pre-render, no upload)."""
    from app.services.project_packages import extra_import_map

    files = collect_project_source_files(project_id)
    source = {k: v for k, v in files.items() if k.endswith(_SOURCE_SUFFIXES)}
    payload = json.dumps(
        {
            "files": source,
            "entry": "src/main.tsx",
            "title": title,
            "lang": lang,
            # SEO source of truth: the published head inherits title/metas/
            # favicon/structured data from the project's index.html.
            "indexHtml": files.get("index.html", ""),
            # Project-declared dependencies ride into the build.
            "extraImports": extra_import_map(project_id),
            "assetPaths": _asset_paths(project_id),
        },
        ensure_ascii=False,
    )
    cli = runtime_dir() / "cli.mjs"
    if not cli.is_file():
        raise RuntimeError(f"Build CLI missing at {cli}")

    proc = await asyncio.create_subprocess_exec(
        "node",
        str(cli),
        "--out-dir",
        str(out_dir),
        cwd=str(runtime_dir()),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(payload.encode("utf-8"))
    try:
        result = json.loads(stdout.decode("utf-8") or "{}")
    except Exception as exc:
        err = (stderr or stdout or b"").decode("utf-8", errors="replace")[-4000:]
        raise RuntimeError(f"build failed:\n{err}") from exc
    if proc.returncode != 0 or not result.get("ok"):
        raise RuntimeError(
            f"build errors: {result.get('errors') or stderr.decode('utf-8', 'replace')[-2000:]}"
        )

    root = project_dir(project_id)
    # Assets imported from code keep their project path (`/src/assets/x.png`).
    for rel in result.get("assets") or []:
        source_file = root / rel
        if source_file.is_file():
            dest = out_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, dest)

    public = root / "public"
    if public.is_dir():
        for path in public.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(public).as_posix()
            if rel == "index.html":  # never shadow the built page
                continue
            dest = out_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
    # Projects created before the manifest moved under public/.
    legacy_manifest = root / "manifest.webmanifest"
    if legacy_manifest.is_file() and not (out_dir / "manifest.webmanifest").exists():
        shutil.copy2(legacy_manifest, out_dir / "manifest.webmanifest")

    await asyncio.to_thread(optimize_images, out_dir)
    return result


async def finalize_site(out_dir: Path, *, site_url: str, site_name: str, fallback_lang: str) -> dict:
    """Pre-render routes, write per-page SEO, 404, sitemap and robots."""
    from app.services import site_seo
    from app.services.prerender import NOT_FOUND_PROBE, compose_page, prerender_site, route_target

    settings = get_settings()
    index_path = out_dir / "index.html"
    template = index_path.read_text(encoding="utf-8")
    description = site_seo.meta_description(template)
    rendered = await prerender_site(out_dir) if settings.forge_prerender_enabled else None

    pages = rendered.pages if rendered else {}
    home_text = pages["/"].html if "/" in pages else template
    lang = site_seo.detect_language(home_text, fallback=fallback_lang)

    def finish(doc: str, route: str) -> str:
        doc = site_seo.finalize_page_head(
            doc,
            site_url=site_url,
            route=route,
            lang=lang,
            site_name=site_name,
            description=description,
            indexable=route != NOT_FOUND_PROBE,
        )
        # Injection points of the build template, not needed once the page is final.
        return doc.replace("<!--forge:head-->\n", "").replace("<!--forge:body-->\n", "")

    # Compose every page before writing any, so a failure leaves the plain
    # build intact rather than half the routes rewritten.
    composed: dict[Path, str] = {}
    for route, page in pages.items():
        target = route_target(out_dir, route)
        if target is None:
            logger.warning("prerender route refused: %r", route)
            continue
        composed[target] = finish(compose_page(template, page), route)
    routes = sorted(r for r in pages if route_target(out_dir, r) in composed) or ["/"]
    if composed:
        for target, doc in composed.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(doc, encoding="utf-8")
        if not (out_dir / "404.html").exists():
            not_found = rendered.not_found if rendered else None
            doc = compose_page(template, not_found) if not_found else template
            doc = finish(doc, NOT_FOUND_PROBE).replace(
                "<head>", '<head>\n<meta name="robots" content="noindex" />', 1
            )
            (out_dir / "404.html").write_text(doc, encoding="utf-8")
    else:
        index_path.write_text(finish(template, "/"), encoding="utf-8")

    noindex = site_seo.is_noindex(template)
    if not (out_dir / "sitemap.xml").exists() and not noindex:
        (out_dir / "sitemap.xml").write_text(site_seo.sitemap_xml(site_url, routes), encoding="utf-8")
    if not (out_dir / "robots.txt").exists():
        (out_dir / "robots.txt").write_text(site_seo.robots_txt(site_url, noindex=noindex), encoding="utf-8")
    return {
        "routes": routes,
        "prerendered": bool(composed),
        "prerender_error": rendered.error if rendered else None,
        "lang": lang,
    }


def _guess_content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".webmanifest", ".manifest"}:
        return "application/manifest+json"
    if suffix in {".js", ".mjs"}:
        return "text/javascript; charset=utf-8"
    if suffix in {".html", ".css", ".txt", ".xml"}:
        base = {".html": "text/html", ".css": "text/css", ".txt": "text/plain", ".xml": "application/xml"}
        return f"{base[suffix]}; charset=utf-8"
    ctype, _ = mimetypes.guess_type(str(path))
    return ctype or "application/octet-stream"


def cache_control_for(rel: str) -> str:
    """Hashed build output never changes; pages must always revalidate."""
    if rel.startswith("assets/"):
        return CACHE_IMMUTABLE
    if rel.endswith(".html"):
        return CACHE_HTML
    if rel in ("sitemap.xml", "robots.txt", "manifest.webmanifest"):
        return CACHE_SHORT
    return CACHE_DEFAULT


def _put(store, bucket: str, key: str, body: bytes, content_type: str, cache_control: str) -> None:
    try:
        store.put(bucket, key, body, content_type, cache_control=cache_control)
    except TypeError:
        # Stores without cache metadata support (tests, legacy adapters).
        store.put(bucket, key, body, content_type)


async def publish_project_esm(
    project_id: str,
    slug: str,
    *,
    owner_user_id: str | None = None,
    title: str = "Forge app",
    site_url: str | None = None,
    lang: str = "en",
) -> dict:
    settings = get_settings()
    public_url = site_url or settings.sites_url_for_slug(slug)

    with tempfile.TemporaryDirectory(prefix="forge-esm-") as tmp:
        out = Path(tmp) / "dist"
        out.mkdir(parents=True, exist_ok=True)
        build = await transform_project_to_dir(project_id, out, title=title, lang=lang)
        site = {"routes": ["/"], "prerendered": False}
        if (out / "index.html").is_file():
            try:
                site = await finalize_site(out, site_url=public_url, site_name=title, fallback_lang=lang)
            except Exception:
                logger.exception("site finalization failed for %s; publishing the plain build", slug)

        store = get_object_store()
        bucket = store.bucket_site_assets or settings.bucket_site_assets
        if not bucket:
            raise RuntimeError("Site assets bucket is not configured")
        prefix = f"{slug}/"
        uploaded = 0
        sem = asyncio.Semaphore(_UPLOAD_CONCURRENCY)
        paths = [p for p in out.rglob("*") if p.is_file()]
        new_keys = {prefix + p.relative_to(out).as_posix() for p in paths}

        async def upload_one(path: Path) -> None:
            nonlocal uploaded
            rel = path.relative_to(out).as_posix()
            key = prefix + rel
            body = await asyncio.to_thread(path.read_bytes)
            async with sem:
                await asyncio.to_thread(
                    _put, store, bucket, key, body, _guess_content_type(path), cache_control_for(rel)
                )
            uploaded += 1

        # Upload first so the live site never goes empty mid-publish, then drop
        # keys that are no longer in this build (stale files / cross-tenant leftovers).
        # Pages last: an HTML file never points at an asset not uploaded yet.
        await asyncio.gather(*(upload_one(p) for p in paths if p.suffix.lower() != ".html"))
        await asyncio.gather(*(upload_one(p) for p in paths if p.suffix.lower() == ".html"))
        orphans = 0
        try:
            existing = await asyncio.to_thread(store.list_prefix, bucket, prefix)
            stale = [k for k in existing if k not in new_keys]
            if stale:
                orphans = await asyncio.to_thread(store.delete_keys, bucket, stale, under_prefix=prefix)
                logger.info("publish purged %s orphan key(s) under %s", orphans, prefix)
        except Exception:
            logger.exception("Failed to purge orphan published keys prefix=%s", prefix)

    return {
        "public_url": public_url,
        "files_uploaded": uploaded,
        "orphans_deleted": orphans,
        "build_mode": build.get("mode"),
        "routes": site.get("routes"),
        "prerendered": site.get("prerendered"),
        "lang": site.get("lang", lang),
    }
