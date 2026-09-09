import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import (
    auth,
    chats,
    comments,
    design,
    domains,
    files,
    history,
    internal_admin,
    plugins,
    preview,
    projects,
    publish,
    seo,
    sites_v1,
    templates,
)
from app.routers import settings as settings_router
from app.services.preview_babel import render_runner_shell, runtime_public_dir

logger = logging.getLogger(__name__)

config = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.projects_path.mkdir(parents=True, exist_ok=True)
    config.templates_path.mkdir(parents=True, exist_ok=True)
    init_db()

    # Any run still marked `running` at boot lost its worker when the process
    # died: nothing else will ever close it, and the builder would keep
    # offering to resume a plan whose context is gone.
    from app.services.orchestration.stale_runs import stale_run_sweeper

    sweeper = asyncio.create_task(stale_run_sweeper(), name="forge-stale-run-sweeper")

    yield

    sweeper.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await sweeper

    # Shutdown: never leak child processes / thread pools across restarts.
    try:
        from app.services.cpu_pool import shutdown_cpu_pool

        shutdown_cpu_pool()
    except Exception:  # pragma: no cover - best effort
        logger.warning("cpu pool shutdown failed", exc_info=True)


app = FastAPI(title="Forge Web API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origin_list,
    allow_origin_regex=config.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in config.cors_origin_list:
        return True
    regex = config.cors_origin_regex
    if not regex:
        return False
    import re

    return re.fullmatch(regex, origin) is not None


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ensure browsers still see CORS headers on unexpected 500s.

    Starlette's ServerErrorMiddleware sits outside CORSMiddleware, so an
    unhandled crash otherwise looks like a CORS failure in DevTools
    (`No Access-Control-Allow-Origin`) and hides the real 500.
    """
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    response = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
    origin = request.headers.get("origin")
    if _cors_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin or ""
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(plugins.router)
app.include_router(templates.router)
app.include_router(projects.router)
app.include_router(design.router)
app.include_router(seo.router)
app.include_router(chats.router)
app.include_router(files.router)
app.include_router(history.router)
app.include_router(comments.router)
app.include_router(publish.router)
app.include_router(domains.router)
app.include_router(sites_v1.router)
app.include_router(preview.router)
app.include_router(internal_admin.router)


@app.get("/runner/", include_in_schema=False)
@app.get("/runner", include_in_schema=False)
def runner_shell(p: str | None = None) -> HTMLResponse:
    """Preview shell: import map + parent origins + visual-edit bridge.

    `?p=<project uuid>` extends the import map with the project's declared
    package.json dependencies (esm.sh). Unauthenticated by design — project
    ids are unguessable UUIDs and the only disclosure is dependency names.
    """
    extra: dict[str, str] = {}
    if p:
        try:
            import uuid as _uuid

            from app.services.project_packages import extra_import_map

            extra = extra_import_map(str(_uuid.UUID(p)))
        except Exception:
            extra = {}
    return HTMLResponse(render_runner_shell(extra_imports=extra), headers={"Cache-Control": "no-store"})


# Declared after the route above so `/runner/` resolves to the generated shell
# and the mount only serves sibling assets (runner.js, bridge.js).
_runner_dir = runtime_public_dir()
if _runner_dir.is_dir():
    app.mount("/runner", StaticFiles(directory=str(_runner_dir)), name="runner")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "forge-web-api",
        "runtime": "babel_esm",
    }
