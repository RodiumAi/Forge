# Forge

<p align="center">
  <img src="sc/home.png" alt="Forge by RodiumAI — landing" width="900" />
</p>

<p align="center">
  <a href="https://github.com/RodiumAi/Forge/actions/workflows/ci.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/RodiumAi/Forge/ci.yml?branch=main&label=Tests&logo=github&style=for-the-badge" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" /></a>
</p>

> 🇫🇷 [Version française](README.fr.md)

Forge is an open-source, AI-powered website and app builder. Describe what you want in a chat and the agent generates a frontend-only React app, previewed instantly in the browser — no node_modules, no Vite — and published as a static ESM site.

## Two modes

| | **Self-host (this repo)** | **Forge Cloud** ([forge.rodiumai.io](https://forge.rodiumai.io)) |
| --- | --- | --- |
| **Accounts** | Local email/password (+ optional Google) | RodiumAi SSO (OIDC) |
| **Credits** | Paste your own RodiumAi API key (`rd_sk_…`) | **FRODI** first (plan allotment), **RODI** wallet as fallback |
| **Free tier** | Bring your own key | **500 FRODI / month** on Free |
| **Plans / billing** | N/A in OSS | Free → Starter → Builder → Pro → Scale → Team (see below) |

Self-host never depends on a service you cannot run. Cloud entitlements and plan grants live in the Nest control plane; this repo consumes them via `/auth/forge/status` and `internal/forge/balance`.

## Architecture

```
forge-web/
├── apps/
│   ├── web/            # Next.js 15 + TypeScript — builder UI
│   └── api/            # FastAPI + SQLAlchemy + Postgres — API, agent, orchestration
│       └── runtime/    # In-browser Babel runner (pure JS) + packages.json manifest
├── data/
│   ├── templates/      # 36 starter kits — Web + Appli (see docs/TEMPLATES.md)
│   └── integrations/   # Embed catalog (see docs/INTEGRATIONS.md)
└── infra/              # Docker local + CI helpers
```

Supporting services: **MinIO** (S3 uploads), **Valkey** (run queue / cancellation), **Caddy** (published sites at `*.lvh.me:8080`), **Adminer** (DB console). LLM calls go through the **RodiumAI** gateway.

## Key features

- **Chat-to-site**: describe a site or app; the agent generates a frontend-only React project.
- **Web vs Appli**: gallery kits for marketing sites and mobile-style shells.
- **Instant preview**: in-browser Babel/ESM runner — CDN import map (esm.sh). No node_modules, no Vite.
- **Publishing**: production build (bundled, minified, hashed, dependencies embedded), every route pre-rendered with its own title/meta, `404.html`, sitemap, robots, structured data and cache headers, served by Caddy.
- **Brand charter on the first build**: palette, Google Fonts pairing and imagery from the brief, plus the first generated images (WebP + srcset).
- **Visual editing**: text and images, directly on the preview.
- **History / rollback**: per-project git snapshots.
- **ZIP export**: a real, runnable Vite project.
- **36 templates**: see [docs/TEMPLATES.md](docs/TEMPLATES.md).
- **Integrations catalog**: drop-in embeds — [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
- **FRODI badge (Cloud)**: plan + weekly/monthly allotment in the sidebar; RODI when FRODI is exhausted or unset.
- **Runtime manifest**: `packages.json` is the single source of truth for the import map, AST allowlist, and Monaco types.
- **Asset vs reference attachments**: logos land in `public/`; screenshots guide layout. Paste a site URL to auto-capture desktop/mobile references (Playwright).

<p align="center">
  <img src="sc/preview.png" alt="Forge builder — chat and live preview" width="900" />
</p>

## Plans (Forge Cloud)

Six plans. **FRODI first**, RODI when you need more. FRODI are Forge credits (weekly on paid plans, monthly on Free) and expire; RODI stay in the RodiumAi wallet.

<p align="center">
  <img src="sc/plan.png" alt="Forge pricing — Free, Starter, Builder, Pro, Scale, Team" width="900" />
</p>

| Plan | Cadence | Typical allotment |
| --- | --- | --- |
| Free | monthly | 500 FRODI |
| Starter / Builder / Pro / Scale | weekly | 2k → 30k FRODI |
| Team | weekly / seat | from 5 seats |

Plan catalog and grants are owned by Nest admin; the builder only displays entitlements and spends them.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Docker + Compose v2 | any current release | the quick start below |
| Node.js | **22** (`.nvmrc`) | running `apps/web` on the host |
| Python | **3.12** (`.python-version`) | running `apps/api` on the host |

CI runs on exactly these versions. Older runtimes may build locally and still
fail CI — `ruff` targets `py312` and several dependencies are version-sensitive.

> **Self-host sign-in works out of the box.** Create a local account at
> `/register` (email/password). Optional Google needs Firebase env vars.
> **"Continue with RodiumAI"** appears only when `RODIUM_OIDC_CLIENT_ID` is set;
> leave it empty and the button stays hidden. On Forge Cloud, OIDC SSO is the
> primary path and Free+500 FRODI is granted from Nest.

## Quick start (Docker)

```bash
cp .env.example .env
make up          # docker compose up -d --build, then applies the schema
```

Without `make`, run the two steps yourself — a fresh volume has no tables until
the second one:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec -T api python -c "from app.db import init_db; init_db()"
```

| Service | URL |
| --- | --- |
| Builder UI | http://localhost:3100 |
| API docs | http://localhost:8100/docs |
| Published sites | http://\<slug\>.lvh.me:8080 |
| MinIO console | http://localhost:9001 |
| Adminer | http://localhost:8089 |
| Mail (Mailpit) | http://localhost:8026 |

## First run: account and generation key

**1. Create an account.** Open http://localhost:3100/register and sign up. You
are signed in immediately.

**2. Confirm your email.** The stack ships a Mailpit container, so mail is
real — it just never leaves your machine. Open **http://localhost:8026** and
the confirmation message is waiting, link included. Password reset works the
same way.

Running the API on the host instead of in Docker? `mailpit` does not resolve
there, so set `MAIL_TRANSPORT=console` and the links are printed in the API
log. Set `MAIL_TRANSPORT=ses` (plus the `AWS_*` credentials) for real delivery.

**3. Add a generation key (self-host).** Forge does not ship a model — you bring
the credentials for one. Create a free account on
[rodiumai.io](https://rodiumai.io), copy an API key (`rd_sk_prod_…`), and paste
it in Forge under **Settings → Generation**. The **Test** button next to the
field confirms it before you rely on it.

On **Forge Cloud**, linked accounts use Nest entitlements (FRODI) instead of a
pasted key; the sidebar shows your plan balance.

`RODIUM_BASE_URL` must match where that key is valid. The shipped default,
`https://api.rodiumai.io/v1`, is right for a key from rodiumai.io; change it
only if you run your own gateway.

Google sign-in is optional: fill in the `FIREBASE_*` (API) and
`NEXT_PUBLIC_FIREBASE_*` (web build) values to enable the Google button on
`/login` and `/register`. Leave them empty and the button is not rendered.
Reuse the same Firebase web app as the RodiumAI user dashboard; enable
**Google** only in the Firebase console and add `forge.rodiumai.io` under
Authorized domains. GitHub is not offered in the Forge UI.

## Hybrid development (Docker infra + local api/web)

Run infra with Docker, then run the API and/or web app locally.

**API**

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --require-hashes -r requirements-dev.txt # runtime deps + ruff + pytest
cp .env.example .env
uvicorn app.main:app --reload --port 8100
```

**Web**

```bash
cd apps/web
npm install
npm run dev   # port 3100
```

## Tests and checks

These are exactly what CI runs, so a green local run means a green pipeline.

```bash
# apps/web
npm run lint && npm run typecheck && npm test
FORGE_FONT_MODE=fallback npm run build

# apps/api  (TEMPLATES_ROOT → data/templates, INTEGRATIONS_ROOT → data/integrations; see CONTRIBUTING)
ruff check app tests && ruff format --check app tests
pytest -q

# apps/api/runtime
npm ci && npm test
```

## Environment variables

Copy `.env.example` to `.env` and adjust as needed — it documents every essential
variable (database, MinIO, Valkey, RodiumAI gateway, OIDC, etc.). `apps/api` and
`apps/web` each carry their own `.env.example` for host-run development.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the dev
setup, the checks to run before pushing, the PR process, and how to submit a
template or integration kit. Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing, you agree that your contributions are licensed under the MIT
License that covers this project.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a run, the preview and publishing actually work
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, checks, PR guide, **templates** & **integrations**
- [docs/TEMPLATES.md](docs/TEMPLATES.md) — full template authoring contract
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — embed catalog contract
- [docs/OPEN_PR_TRIAGE.md](docs/OPEN_PR_TRIAGE.md) — current open-PR maintainer triage
- [DOCKER.md](DOCKER.md) — local stack, ports, preview notes
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [LICENSE](LICENSE) — MIT
