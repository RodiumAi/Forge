"""
Dedicated Node build worker — MUST run as its own process/service.

Never call npm/vite from the FastAPI request path when BUILD_WORKER_ENABLED=1.
Consumes Redis list `sites:builds` (settings.build_queue).

  python -m app.workers.build_worker
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [build-worker] %(message)s",
)
logger = logging.getLogger("build_worker")

_running = True


def _handle_signal(signum, _frame) -> None:
    global _running
    logger.info("signal %s — shutting down", signum)
    _running = False


async def _handle_job(job: dict) -> None:
    from app.services.build_queue import set_job_status
    from app.services.preview import ensure_dependencies, start_preview, stop_preview
    from app.services.publish import run_vite_build_only

    job_id = str(job.get("job_id") or "")
    kind = str(job.get("kind") or "")
    project_id = str(job.get("project_id") or "")
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}

    if not job_id or not kind or not project_id:
        logger.warning("invalid job payload: %s", job)
        return

    set_job_status(job_id, "running")
    t0 = time.time()
    try:
        if kind == "npm_install":
            await ensure_dependencies(project_id, sync_imports=bool(payload.get("sync_imports", True)))
            set_job_status(job_id, "done", {"ok": True, "elapsed_s": time.time() - t0})
        elif kind == "vite_build":
            await ensure_dependencies(project_id, sync_imports=False)
            log = await run_vite_build_only(project_id)
            set_job_status(
                job_id,
                "done",
                {"ok": True, "elapsed_s": time.time() - t0, "log_tail": log[-2000:]},
            )
        elif kind == "preview_start":
            port = payload.get("port")
            preferred = int(port) if port is not None else None
            proc = await start_preview(project_id, preferred_port=preferred)
            set_job_status(
                job_id,
                "done",
                {"ok": True, "port": proc.port, "elapsed_s": time.time() - t0},
            )
        elif kind == "preview_stop":
            stop_preview(project_id)
            set_job_status(job_id, "done", {"ok": True, "elapsed_s": time.time() - t0})
        else:
            set_job_status(job_id, "error", {"error": f"Unknown kind: {kind}"})
    except Exception as exc:
        logger.exception("job failed job_id=%s kind=%s", job_id, kind)
        set_job_status(job_id, "error", {"error": str(exc)[:2000]})


def main() -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    from app.services.build_queue import pop_build_job

    logger.info("Build worker started queue=%s", os.environ.get("BUILD_QUEUE", "sites:builds"))
    while _running:
        job = pop_build_job(timeout_s=5)
        if not job:
            continue
        logger.info("picked job=%s kind=%s project=%s", job.get("job_id"), job.get("kind"), job.get("project_id"))
        asyncio.run(_handle_job(job))
    logger.info("Build worker stopped")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
