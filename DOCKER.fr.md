> 🇬🇧 [English version](DOCKER.md)

# Docker — Forge Web

```sh
cp .env.example .env
docker compose up -d --build
make migrate          # crée le schéma sur un volume neuf
```

`make up` enchaîne les deux étapes pour vous.

| Service | URL |
|---------|-----|
| UI | http://localhost:3100 |
| API (OpenAPI) | http://localhost:8100/docs |
| Sites publiés | http://&lt;slug&gt;.lvh.me:8080 |
| Console MinIO | http://localhost:9001 |
| Adminer | http://localhost:8089 (serveur `postgres`, user/db `forge`) |
| Postgres (hôte) | `127.0.0.1:5434` |

```sh
docker compose logs -f api
docker compose down
```

**SSE / ALB** — heartbeats SSE toutes les ~15 s. Avant le premier run streamé en
production, porter l'idle timeout ALB à **600 secondes**
(`ALB_IDLE_TIMEOUT_SECONDS`).

**Preview** — les aperçus s'exécutent dans le navigateur via le runner
Babel/ESM ; l'API ne lance aucun process Vite ni npm. Les projets générés sont
des *sources* au format Vite, mais rien ne les compile côté serveur. Le seul
sous-processus lancé par l'API est `git`, pour les snapshots par projet.

**Windows** — pour une boucle locale plus confortable, lancez l'API sur l'hôte
(`uvicorn app.main:app --reload --port 8100`) avec seulement les services
d'infrastructure dans Docker : `docker compose up -d postgres valkey minio`.

## Extras image API

Le Dockerfile API installe **Playwright Chromium** (`playwright install --with-deps chromium`) pour capturer les URLs de sites collées comme screenshots de référence pendant la génération (`apps/api/app/services/url_capture.py`). Reconstruisez le service `api` après un pull qui touche cette dépendance.
