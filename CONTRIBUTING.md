> 🇫🇷 [Version française](CONTRIBUTING.fr.md)

# Contributing to Forge

Thanks for your interest in contributing! This guide covers dev setup by domain, the exact checks to run, and how to submit a pull request.

## Development setup

Start the infra with Docker first:

```bash
cp .env.example .env
docker compose up -d --build   # or: make up
```

### Frontend (`apps/web`)

Next.js 15 + TypeScript.

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3100
```

Checks before submitting:

```bash
npm run typecheck
npm test                              # vitest, 142 tests
npm run lint
FORGE_FONT_MODE=fallback npm run build
```

### Backend (`apps/api`)

FastAPI + SQLAlchemy + Postgres.

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

Checks before submitting:

```bash
ruff format app tests
ruff check app tests
pytest -q   # 119 tests
```

### Runtime (`apps/api/runtime`)

In-browser Babel runner, pure JS. `packages.json` is the single source of truth for the import map, the AST allowlist and Monaco types.

```bash
cd apps/api/runtime
node --test tests/   # Babel transform tests
```

### Templates (`data/templates`)

See [docs/TEMPLATES.md](docs/TEMPLATES.md) for authoring guidelines.

## Pull request guide

1. Fork the repo and create a branch from the main branch.
2. Keep PRs small and focused — one topic per PR.
3. Add tests for any behavior change (mandatory).
4. Run the checks for the domains you touched (see above).
5. Use commit messages in the style `fix(scope): summary` (French or English are both accepted).
6. Open the PR — CI must be green before merge.

## CI

`.github/workflows/ci.yml` runs 4 jobs:

- **api**: ruff + pytest
- **web**: lint + tsc + vitest + build
- **runtime**: node --test
- **compose**: docker compose config

## Code style

- Python: `ruff` (format + check)
- TypeScript: `eslint` + `tsc`

## Getting help

Ask questions via GitHub Issues or GitHub Discussions.
