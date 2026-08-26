"""Redis queue for Node build jobs — consumed by the dedicated build-worker service."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Literal

from redis import Redis

from app.config import get_settings

logger = logging.getLogger("build_queue")

JobKind = Literal["npm_install", "vite_build", "preview_start", "preview_stop"]

STATUS_KEY = "forge:build:status:{job_id}"
RESULT_KEY = "forge:build:result:{job_id}"
META_KEY = "forge:build:meta:{job_id}"


def _redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


def enqueue_build_job(
    *,
    kind: JobKind,
    project_id: str,
    payload: dict[str, Any] | None = None,
    owner_user_id: str | None = None,
) -> str:
    settings = get_settings()
    job_id = str(uuid.uuid4())
    body = {
        "job_id": job_id,
        "kind": kind,
        "project_id": project_id,
        "payload": payload or {},
        "owner_user_id": owner_user_id,
        "created_at": time.time(),
    }
    r = _redis()
    r.setex(STATUS_KEY.format(job_id=job_id), 3600, "queued")
    r.setex(
        META_KEY.format(job_id=job_id),
        3600,
        json.dumps(
            {
                "project_id": project_id,
                "kind": kind,
                "owner_user_id": owner_user_id,
            }
        ),
    )
    r.lpush(settings.build_queue, json.dumps(body))
    logger.info("Enqueued build job=%s kind=%s project=%s", job_id, kind, project_id)
    if kind == "vite_build":
        from app.services import firestore_live

        firestore_live.set_publish(
            project_id,
            phase="queued",
            owner_user_id=owner_user_id,
            job_id=job_id,
        )
    return job_id


def _mirror_publish_from_job(
    job_id: str,
    status: str,
    result: dict[str, Any] | None,
) -> None:
    from app.services import firestore_live

    raw = _redis().get(META_KEY.format(job_id=job_id))
    if not raw:
        return
    try:
        meta = json.loads(raw)
    except json.JSONDecodeError:
        return
    if not isinstance(meta, dict):
        return
    project_id = str(meta.get("project_id") or "")
    kind = str(meta.get("kind") or "")
    owner_user_id = meta.get("owner_user_id")
    if not project_id or kind != "vite_build":
        return
    phase = "build"
    message = None
    if status == "queued":
        phase = "queued"
    elif status == "running":
        phase = "build"
    elif status == "done":
        phase = "upload"  # publish_project continues with upload after wait
    elif status == "error":
        phase = "error"
        if result:
            message = str(result.get("error") or "")[:500]
    firestore_live.set_publish(
        project_id,
        phase=phase,
        owner_user_id=str(owner_user_id) if owner_user_id else None,
        job_id=job_id,
        message=message,
    )


def set_job_status(job_id: str, status: str, result: dict[str, Any] | None = None) -> None:
    r = _redis()
    r.setex(STATUS_KEY.format(job_id=job_id), 3600, status)
    if result is not None:
        r.setex(RESULT_KEY.format(job_id=job_id), 3600, json.dumps(result))
    try:
        _mirror_publish_from_job(job_id, status, result)
    except Exception:
        logger.exception("firestore publish mirror failed job=%s", job_id)


def get_job_status(job_id: str) -> str | None:
    return _redis().get(STATUS_KEY.format(job_id=job_id))


def get_job_result(job_id: str) -> dict[str, Any] | None:
    raw = _redis().get(RESULT_KEY.format(job_id=job_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def wait_for_job(job_id: str, *, timeout_s: float = 600.0, poll_s: float = 0.5) -> dict[str, Any]:
    """Block until job is done/error or timeout. Returns result dict."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        status = get_job_status(job_id)
        if status in ("done", "error"):
            result = get_job_result(job_id) or {}
            if status == "error":
                raise RuntimeError(result.get("error") or f"Build job {job_id} failed")
            return result
        time.sleep(poll_s)
    raise TimeoutError(f"Build job {job_id} timed out after {timeout_s}s")


def pop_build_job(timeout_s: int = 5) -> dict[str, Any] | None:
    """Blocking pop for the build worker."""
    settings = get_settings()
    r = _redis()
    item = r.brpop(settings.build_queue, timeout=timeout_s)
    if not item:
        return None
    _key, raw = item
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
