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


async def run_vite_build_only(project_id: str) -> str:
    """Run `vite build --base=/` for a project. Used by the build worker."""
    root = project_dir(project_id)
    return await _run_npm(
        ["exec", "--", "vite", "build", "--base", "/"],
        str(root),
    )


async def publish_project(
    project_id: str,
    slug: str,
    *,
    owner_user_id: str | None = None,
) -> dict:
    """Build and sync site assets. Uses ESM Babel publish when PUBLISH_MODE=esm."""
    settings = get_settings()
    if settings.publish_mode == "esm":
        from app.services.publish_esm import publish_project_esm

        return await publish_project_esm(
            project_id,
            slug,
            owner_user_id=owner_user_id,
        )

    from app.services import firestore_live

    firestore_live.set_publish(
        project_id,
        phase="deps",
        owner_user_id=owner_user_id,
    )
    if settings.build_worker_enabled:
        from app.services.build_queue import enqueue_build_job, wait_for_job

        job_id = enqueue_build_job(
            kind="vite_build",
            project_id=project_id,
            owner_user_id=owner_user_id,
        )
        firestore_live.set_publish(
            project_id,
            phase="build",
            owner_user_id=owner_user_id,
            job_id=job_id,
        )
        await asyncio.to_thread(wait_for_job, job_id, timeout_s=600.0)
    else:
        # Dev fallback: keep build in-process when worker is disabled.
        firestore_live.set_publish(
            project_id,
            phase="build",
            owner_user_id=owner_user_id,
        )
        await ensure_dependencies(project_id, sync_imports=False)
        await run_vite_build_only(project_id)

    root = project_dir(project_id)
    dist = root / "dist"
    if not dist.is_dir():
        firestore_live.set_publish(
            project_id,
            phase="error",
            owner_user_id=owner_user_id,
            message="Build succeeded but dist/ is missing",
        )
        raise RuntimeError("Build succeeded but dist/ is missing")

    firestore_live.set_publish(
        project_id,
        phase="upload",
        owner_user_id=owner_user_id,
    )

    store = get_object_store()
    bucket = store.bucket_site_assets or settings.bucket_site_assets
    if not bucket:
        firestore_live.set_publish(
            project_id,
            phase="error",
            owner_user_id=owner_user_id,
            message="Site assets bucket is not configured",
        )
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

    try:
        await asyncio.gather(*(upload_one(path) for path in files))
    except Exception as exc:
        firestore_live.set_publish(
            project_id,
            phase="error",
            owner_user_id=owner_user_id,
            message=str(exc)[:500],
        )
        raise

    public_url = settings.sites_url_for_slug(slug)
    logger.info("Published project=%s slug=%s files=%s url=%s", project_id, slug, uploaded, public_url)
    return {
        "ok": True,
        "public_url": public_url,
        "files_uploaded": uploaded,
        "slug": slug,
    }
