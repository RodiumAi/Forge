> 🇬🇧 [English version](CONTRIBUTING.md)

# Contribuer à Forge

Merci de votre intérêt ! Ce guide couvre le setup de dev par domaine, les vérifications exactes à lancer et la marche à suivre pour une pull request.

## Setup de développement

Lancez d'abord l'infra avec Docker :

```bash
cp .env.example .env
docker compose up -d --build   # ou : make up
```

### Frontend (`apps/web`)

Next.js 15 + TypeScript.

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3100
```

Vérifications avant soumission :

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
python -m venv .venv && .venv/Scripts/activate   # ou source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

Vérifications avant soumission :

```bash
ruff format app tests
ruff check app tests
pytest -q   # 119 tests
```

### Runtime (`apps/api/runtime`)

Runner Babel navigateur, JS pur. `packages.json` est la source unique de l'import map, de l'allowlist AST et des types Monaco.

```bash
cd apps/api/runtime
node --test tests/   # tests du transform Babel
```

### Templates (`data/templates`)

Voir [docs/TEMPLATES.md](docs/TEMPLATES.md) pour le guide de création.

## Guide pull request

1. Forkez le repo et créez une branche depuis la branche principale.
2. Gardez les PR petites et ciblées — un sujet par PR.
3. Ajoutez des tests pour tout changement de comportement (obligatoire).
4. Lancez les vérifications des domaines touchés (voir ci-dessus).
5. Messages de commit au style `fix(scope): résumé` (français ou anglais acceptés).
6. Ouvrez la PR — la CI doit être verte avant merge.

## CI

`.github/workflows/ci.yml` exécute 4 jobs :

- **api** : ruff + pytest
- **web** : lint + tsc + vitest + build
- **runtime** : node --test
- **compose** : docker compose config

## Style de code

- Python : `ruff` (format + check)
- TypeScript : `eslint` + `tsc`

## Où demander de l'aide

Posez vos questions via GitHub Issues ou GitHub Discussions.
