> 🇬🇧 [English version](README.md)

# Forge

[![Licence : MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Forge est un builder de sites web par IA, open source. Décrivez votre site dans un chat : l'agent génère une app React frontend-only, prévisualisée instantanément dans le navigateur — sans node_modules ni Vite — et publiée en site statique ESM.

## Architecture

```
forge-web/
├── apps/
│   ├── web/            # Next.js 15 + TypeScript — UI du builder
│   └── api/            # FastAPI + SQLAlchemy + Postgres — API, agent, orchestration
│       └── runtime/    # Runner Babel navigateur (JS pur) + manifest packages.json
├── data/
│   └── templates/      # 24 templates de départ (voir docs/TEMPLATES.md)
└── infra/              # Docker local + AWS prod (Amplify / EC2)
```

Services d'appui : **MinIO** (uploads S3), **Valkey** (file de runs / annulation), **Caddy** (sites publiés sur `*.lvh.me:8080`), **Adminer** (console DB). Les appels LLM passent par le gateway **RodiumAI** (clé API fournie par l'utilisateur dans les réglages).

## Fonctionnalités clés

- **Du chat au site** : décrivez un site, l'agent génère une app React frontend-only.
- **Preview instantanée** : runner Babel/ESM dans le navigateur — transformation du code côté navigateur avec import map CDN (esm.sh). Ni node_modules, ni Vite.
- **Publication** : site statique ESM servi par Caddy.
- **Édition visuelle** : texte et images, directement sur la preview.
- **Historique / rollback** : snapshots git par projet.
- **Export ZIP** : un vrai projet Vite exécutable.
- **24 templates** : voir [docs/TEMPLATES.md](docs/TEMPLATES.md).
- **Manifest du runtime** : `packages.json` est la source unique de l'import map, de l'allowlist AST et des types Monaco.

## Démarrage rapide (Docker)

```bash
cp .env.example .env
docker compose up -d --build   # ou : make up
```

| Service | URL |
| --- | --- |
| UI du builder | http://localhost:3100 |
| Docs API | http://localhost:8100/docs |
| Sites publiés | http://\<slug\>.lvh.me:8080 |
| Console MinIO | http://localhost:9001 |
| Adminer | http://localhost:8089 |

## Développement hybride (infra Docker + api/web en local)

Lancez l'infra avec Docker, puis l'API et/ou le web en local.

**API**

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # ou source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

**Web**

```bash
cd apps/web
npm install
npm run dev   # port 3100
```

## Variables d'environnement

Copiez `.env.example` vers `.env` et ajustez au besoin — il documente toutes les variables essentielles (base de données, MinIO, Valkey, clé du gateway RodiumAI, etc.).

## Documentation

- [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) — setup dev, vérifications, guide PR
- [docs/DEPLOYMENT.fr.md](docs/DEPLOYMENT.fr.md) — déploiement prod (Amplify + EC2, maintainers)
- [docs/TEMPLATES.md](docs/TEMPLATES.md) — création de templates
- [SECURITY.fr.md](SECURITY.fr.md) — signalement de vulnérabilités
- [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md)
- [LICENSE](LICENSE) — MIT
