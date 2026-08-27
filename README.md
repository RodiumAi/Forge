> 🇫🇷 [Version française](README.fr.md)

# Forge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Forge is an open-source, AI-powered website builder. Describe your site in a chat and the agent generates a frontend-only React app, previewed instantly in the browser — no node_modules, no Vite — and published as a static ESM site.

## Architecture

```
forge-web/
├── apps/
│   ├── web/            # Next.js 15 + TypeScript — builder UI
│   └── api/            # FastAPI + SQLAlchemy + Postgres — API, agent, orchestration
│       └── runtime/    # In-browser Babel runner (pure JS) + packages.json manifest
├── data/
│   └── templates/      # 24 starter templates (see docs/TEMPLATES.md)
└── infra/              # Docker / Caddy configuration
```

Supporting services: **MinIO** (S3 uploads), **Valkey** (run queue / cancellation), **Caddy** (published sites at `*.lvh.me:8080`), **Adminer** (DB console). LLM calls go through the **RodiumAI** gateway (API key supplied by the user in settings).

## Key features

- **Chat-to-site**: describe a site, the agent generates a frontend-only React app.
- **Instant preview**: in-browser Babel/ESM runner — transforms code in the browser with a CDN import map (esm.sh). No node_modules, no Vite.
- **Publishing**: static ESM site served by Caddy.
- **Visual editing**: text and images, directly on the preview.
- **History / rollback**: per-project git snapshots.
- **ZIP export**: a real, runnable Vite project.
- **24 templates**: see [docs/TEMPLATES.md](docs/TEMPLATES.md).
- **Runtime manifest**: `packages.json` is the single source of truth for the import map, the AST allowlist, and Monaco types.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d --build   # or: make up
```

| Service | URL |
| --- | --- |
| Builder UI | http://localhost:3100 |
| API docs | http://localhost:8100/docs |
| Published sites | http://\<slug\>.lvh.me:8080 |
| MinIO console | http://localhost:9001 |
| Adminer | http://localhost:8089 |

## Hybrid development (Docker infra + local api/web)

Run infra with Docker, then run the API and/or web app locally.

**API**

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

**Web**

```bash
cd apps/web
npm install
npm run dev   # port 3100
```

## Environment variables

Copy `.env.example` to `.env` and adjust as needed — it documents every essential variable (database, MinIO, Valkey, RodiumAI gateway key, etc.).

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, checks, PR guide
- [docs/TEMPLATES.md](docs/TEMPLATES.md) — template authoring
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [LICENSE](LICENSE) — MIT
