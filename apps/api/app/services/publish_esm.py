"""Publish via shared Babel CLI (no vite build)."""

from __future__ import annotations

import asyncio
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


def runtime_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "runtime"


async def transform_project_to_dir(project_id: str, out_dir: Path, *, title: str = "Forge app") -> dict:
    files = collect_project_source_files(project_id)
    # Drop DESIGN.md / AI_RULES from transform input (not JS)
    source = {k: v for k, v in files.items() if k.endswith((".tsx", ".ts", ".jsx", ".js", ".css"))}
    payload = json.dumps(
        {"files": source, "entry": "src/main.tsx", "title": title},
        ensure_ascii=False,
    )
    cli = runtime_dir() / "cli.mjs"
    if not cli.is_file():
        raise RuntimeError(f"Babel CLI missing at {cli}")

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
    if proc.returncode != 0:
        err = (stderr or stdout or b"").decode("utf-8", errors="replace")[-4000:]
        raise RuntimeError(f"babel transform failed:\n{err}")

    try:
        result = json.loads(stdout.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"babel CLI invalid JSON: {stdout[:500]!r}") from exc
    if not result.get("ok"):
        raise RuntimeError(f"babel transform errors: {result.get('errors')}")

    # Copy public/ assets into out_dir
    public = project_dir(project_id) / "public"
    if public.is_dir():
        for path in public.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(public).as_posix()
            dest = out_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

    return result


def _guess_content_type(path: Path) -> str:
    ctype, _ = mimetypes.guess_type(str(path))
    return ctype or "application/octet-stream"


async def publish_project_esm(
    project_id: str,
    slug: str,
    *,
    owner_user_id: str | None = None,
    title: str = "Forge app",
) -> dict:
    from app.services import firestore_live

    settings = get_settings()
    firestore_live.set_publish(
        project_id,
        phase="build",
        owner_user_id=owner_user_id,
    )

    with tempfile.TemporaryDirectory(prefix="forge-esm-") as tmp:
        out = Path(tmp) / "dist"
        out.mkdir(parents=True, exist_ok=True)
        await transform_project_to_dir(project_id, out, title=title)

        firestore_live.set_publish(
            project_id,
            phase="upload",
            owner_user_id=owner_user_id,
        )
        store = get_object_store()
        bucket = store.bucket_site_assets or settings.bucket_site_assets
        if not bucket:
            raise RuntimeError("Site assets bucket is not configured")
        prefix = f"{slug}/"
        uploaded = 0
        sem = asyncio.Semaphore(_UPLOAD_CONCURRENCY)

        async def upload_one(path: Path) -> None:
            nonlocal uploaded
            rel = path.relative_to(out).as_posix()
            key = prefix + rel
            body = await asyncio.to_thread(path.read_bytes)
            async with sem:
                await asyncio.to_thread(
                    store.put,
                    bucket,
                    key,
                    body,
                    _guess_content_type(path),
                )
            uploaded += 1

        paths = [p for p in out.rglob("*") if p.is_file()]
        await asyncio.gather(*(upload_one(p) for p in paths))

    public_url = settings.sites_url_for_slug(slug)
    firestore_live.set_publish(
        project_id,
        phase="done",
        owner_user_id=owner_user_id,
    )
    return {"public_url": public_url, "files_uploaded": uploaded}
