import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import (
    auth,
    chats,
    comments,
    design,
    files,
    history,
    plugins,
    preview,
    projects,
    publish,
    seo,
    templates,
)
from app.routers import settings as settings_router
from app.services.preview_babel import runtime_public_dir

logger = logging.getLogger(__name__)

config = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.projects_path.mkdir(parents=True, exist_ok=True)
    config.templates_path.mkdir(parents=True, exist_ok=True)
    init_db()
    yield
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
app.include_router(preview.router)

_runner_dir = runtime_public_dir()
if _runner_dir.is_dir():
    app.mount("/runner", StaticFiles(directory=str(_runner_dir), html=True), name="runner")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "forge-web-api",
        "preview_mode": config.preview_mode,
        "publish_mode": config.publish_mode,
    }
