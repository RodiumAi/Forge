import asyncio
import logging
import mimetypes
from pathlib import Path

from app.config import get_settings
from app.providers.objects import get_object_store
from app.services.filesystem import project_dir
from app.services.preview import _npm_executable, ensure_dependencies

logger = logging.getLogger("publish")

_UPLOAD_CONCURRENCY = 12


async def _run_npm(args: list[str], cwd: str) -> str:
    npm = _npm_executable()
    proc = await asyncio.create_subprocess_exec(
        npm,
        *args,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    text = stdout.decode("utf-8", errors="replace") if stdout else ""
    if proc.returncode != 0:
        raise RuntimeError(f"npm {' '.join(args)} failed:\n{text[-4000:]}")
    return text


def _guess_content_type(path: Path) -> str:
    ctype, _ = mimetypes.guess_type(str(path))
    return ctype or "application/octet-stream"


async def publish_project(project_id: str, slug: str) -> dict:
    """Build with base=/ and sync dist/ to forge-assets/{slug}/."""
    root = project_dir(project_id)
    # Skip import scan on publish — deps should already be installed from preview/agent.
    await ensure_dependencies(project_id, sync_imports=False)

    # Publish must use base=/ (preview vite.config uses /preview/{id}/).
    await _run_npm(
        ["exec", "--", "vite", "build", "--base", "/"],
        str(root),
    )

    dist = root / "dist"
    if not dist.is_dir():
        raise RuntimeError("Build succeeded but dist/ is missing")

    settings = get_settings()
    store = get_object_store()
    bucket = store.bucket_site_assets or settings.bucket_site_assets
    if not bucket:
        raise RuntimeError("Site assets bucket is not configured")

    files = [p for p in dist.rglob("*") if p.is_file()]
    # Upload assets first, index.html last so the site root goes live when ready.
    files.sort(key=lambda p: 1 if p.name.lower() == "index.html" else 0)

    sem = asyncio.Semaphore(_UPLOAD_CONCURRENCY)
    uploaded = 0
    lock = asyncio.Lock()

    async def upload_one(path: Path) -> None:
        nonlocal uploaded
        rel = path.relative_to(dist).as_posix()
        key = f"{slug}/{rel}"
        body = await asyncio.to_thread(path.read_bytes)
        ctype = _guess_content_type(path)

        async with sem:
            await asyncio.to_thread(store.put, bucket, key, body, ctype)

        async with lock:
            uploaded += 1

    await asyncio.gather(*(upload_one(path) for path in files))

    public_url = settings.sites_url_for_slug(slug)
    logger.info("Published project=%s slug=%s files=%s url=%s", project_id, slug, uploaded, public_url)
    return {
        "ok": True,
        "public_url": public_url,
        "files_uploaded": uploaded,
        "slug": slug,
    }
