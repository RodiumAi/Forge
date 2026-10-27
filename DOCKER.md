> 🇫🇷 [Version française](DOCKER.fr.md)

# Docker: the local Forge stack

```sh
cp .env.example .env
make up               # docker compose up -d --build, then make migrate
```

The API applies the schema each time it starts (`init_db()` in
`apps/api/app/db.py`), so `docker compose up -d --build` alone also works.
`make migrate` runs that step again by hand.

## Services and ports

Every service is defined in `docker-compose.yml`. Host ports can be changed
with the `FORGE_WEB_*_PORT` variables shown in the last column.

| Service | What it does | Host address | Port variable |
| --- | --- | --- | --- |
| `web` | Builder UI (Next.js) | http://localhost:3100 | `FORGE_WEB_UI_PORT` |
| `api` | FastAPI, OpenAPI docs at `/docs` | http://localhost:8100/docs | `FORGE_WEB_API_PORT` |
| `caddy` | Published sites | http://&lt;slug&gt;.lvh.me:8080 | `FORGE_WEB_CADDY_PORT` |
| `postgres` | Database (user `forge`, database `rodium_forge`) | `127.0.0.1:5434` | `FORGE_WEB_POSTGRES_PORT` |
| `valkey` | Run queue and cancellation | `127.0.0.1:6380` | `FORGE_WEB_VALKEY_PORT` |
| `minio` | S3 storage (API on 9000, console on 9001) | http://localhost:9001 | |
| `minio-init` | Creates the buckets, then exits | | |
| `mailpit` | Catches every outgoing mail (UI, SMTP on 1026) | http://localhost:8026 | `FORGE_WEB_MAILPIT_UI_PORT`, `FORGE_WEB_MAILPIT_SMTP_PORT` |
| `adminer` | DB console (server `postgres`) | http://localhost:8089 | `FORGE_WEB_ADMINER_PORT` |

Postgres, Valkey, MinIO, Mailpit and Adminer are bound to `127.0.0.1`: they are
for local development only.

## Make targets

| Target | What it runs |
| --- | --- |
| `make up` | `docker compose up -d --build`, then `make migrate` |
| `make down` | `docker compose down` |
| `make reset` | Deletes the volumes, rebuilds, then `make migrate seed` |
| `make logs` | Follows the API logs |
| `make migrate` | Applies the SQLAlchemy schema in the `api` container |
| `make seed` | Prints the local environment banner (`infra/local/seed.py`) |
| `make shell` | Python shell in the `api` container |
| `make psql` | PostgreSQL console |
| `make redis` | Valkey console |
| `make test` | API tests on the host (needs the venv, see CONTRIBUTING) |
| `make lock` | Regenerates the hashed Python lock files (needs `uv`) |

```sh
docker compose logs -f api
docker compose down
```

## Turning on the project kinds

Web and App are always on. Slides, Codelab and Design system are off until you
set their flags in `.env` (the `api` service reads `.env` through `env_file`):

```sh
FORGE_KIND_SLIDES_ENABLED=true
FORGE_KIND_CODELAB_ENABLED=true
FORGE_KIND_DESIGN_SYSTEM_ENABLED=true
```

Then recreate the API container so it reads them:

```sh
docker compose up -d api
```

The web app reads the list of active kinds from the API (`GET /kinds`), so the
`web` image needs no rebuild.

`PIXABAY_API_KEY` (optional, server side only) turns on the free image search
in the image panel. Empty, that search answers `503`.

## What the API image contains

`apps/api/Dockerfile` is built from the repository root. On top of Python 3.12
and the hashed requirements, it installs:

- **Node.js 22**, used by the API for publishing and document exports.
- **Playwright Chromium**, for pasted site URL captures
  (`apps/api/app/services/url_capture.py`), route pre-rendering on publish and
  PDF exports.
- **`git`**, for per-project history snapshots.
- **`apps/api/runtime/`**: the preview runtime, plus `babel.min.js` copied from
  the pinned `@babel/standalone` package.
- **`apps/api/runtime/deck/`**: the deck runtime and its dependencies, with the
  deck player source from `apps/web/components/deck-player`. It bundles the
  player when a deck is published or exported, and builds the PPTX export.
- **The codelab player**, built once during the image build by
  `apps/api/runtime/codelab/build.mjs` from `apps/web/components/codelab-player`.
  Every codelab publish copies that build.
- **`data/templates/`** and **`data/integrations/`**.

In `docker-compose.yml`, `apps/api/app` and `apps/api/runtime/public` are
mounted from your checkout and the API runs with `--reload`, so Python changes
apply without a rebuild. Changes to the Dockerfile, the requirements, the
runtimes or the player components need one:

```sh
docker compose up -d --build api
```

## Notes

**Preview.** Previews run in the browser through the Babel/ESM runner; the API
starts no Vite or npm dev server. Generated projects are Vite-shaped *source*,
but nothing builds them server-side for the preview.

**SSE and load balancers.** SSE heartbeats every 15 seconds
(`SSE_HEARTBEAT_SECONDS`). Behind an AWS ALB, raise the idle timeout to
**600 seconds** (`ALB_IDLE_TIMEOUT_SECONDS`) before the first streamed run.

**Windows.** For a smoother local loop, run the API on the host
(`uvicorn app.main:app --reload --port 8100`) with only the backing services
in Docker: `docker compose up -d postgres valkey minio`.
