> 🇫🇷 [Version française](DOCKER.fr.md)

# Docker — Forge Web

```sh
cp .env.example .env
docker compose up -d --build
make migrate          # create the schema on a fresh volume
```

`make up` runs both steps for you.

| Service | URL |
|---------|-----|
| UI | http://localhost:3100 |
| API (OpenAPI) | http://localhost:8100/docs |
| Published sites | http://&lt;slug&gt;.lvh.me:8080 |
| MinIO console | http://localhost:9001 |
| Adminer | http://localhost:8089 (server `postgres`, user/db `forge`) |
| Postgres (host) | `127.0.0.1:5434` |

```sh
docker compose logs -f api
docker compose down
```

**SSE / ALB** — SSE heartbeats every ~15s. Before the first streamed run in
production, raise the ALB idle timeout to **600 seconds**
(`ALB_IDLE_TIMEOUT_SECONDS`).

**Preview** — previews run in the browser through the Babel/ESM runner; the API
starts no Vite or npm process. Generated projects are Vite-shaped *source*, but
nothing builds them server-side. The only subprocess the API spawns is `git`,
for per-project snapshots.

**Windows** — for a smoother local loop, run the API on the host
(`uvicorn app.main:app --reload --port 8100`) with just the backing services in
Docker: `docker compose up -d postgres valkey minio`.

## API image extras

The API Dockerfile installs **Playwright Chromium** (`playwright install --with-deps chromium`) so pasted site URLs can be captured as reference screenshots during generation (`apps/api/app/services/url_capture.py`). Rebuild the `api` service after pulling changes that touch that dependency.
