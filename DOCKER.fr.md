> 🇬🇧 [English version](DOCKER.md)

# Docker : la stack Forge locale

```sh
cp .env.example .env
make up               # docker compose up -d --build, puis make migrate
```

L'API applique le schéma à chaque démarrage (`init_db()` dans
`apps/api/app/db.py`) : `docker compose up -d --build` seul suffit aussi.
`make migrate` relance cette étape à la main.

## Services et ports

Tous les services sont définis dans `docker-compose.yml`. Les ports de l'hôte
se changent avec les variables `FORGE_WEB_*_PORT` de la dernière colonne.

| Service | Rôle | Adresse sur l'hôte | Variable de port |
| --- | --- | --- | --- |
| `web` | UI du builder (Next.js) | http://localhost:3100 | `FORGE_WEB_UI_PORT` |
| `api` | FastAPI, docs OpenAPI sur `/docs` | http://localhost:8100/docs | `FORGE_WEB_API_PORT` |
| `caddy` | Sites publiés | http://&lt;slug&gt;.lvh.me:8080 | `FORGE_WEB_CADDY_PORT` |
| `postgres` | Base de données (utilisateur `forge`, base `rodium_forge`) | `127.0.0.1:5434` | `FORGE_WEB_POSTGRES_PORT` |
| `valkey` | File des runs et annulation | `127.0.0.1:6380` | `FORGE_WEB_VALKEY_PORT` |
| `minio` | Stockage S3 (API sur 9000, console sur 9001) | http://localhost:9001 | |
| `minio-init` | Crée les buckets, puis s'arrête | | |
| `mailpit` | Intercepte tous les mails sortants (UI, SMTP sur 1026) | http://localhost:8026 | `FORGE_WEB_MAILPIT_UI_PORT`, `FORGE_WEB_MAILPIT_SMTP_PORT` |
| `adminer` | Console DB (serveur `postgres`) | http://localhost:8089 | `FORGE_WEB_ADMINER_PORT` |

Postgres, Valkey, MinIO, Mailpit et Adminer écoutent sur `127.0.0.1` : ils
servent uniquement au développement local.

## Cibles make

| Cible | Ce qu'elle lance |
| --- | --- |
| `make up` | `docker compose up -d --build`, puis `make migrate` |
| `make down` | `docker compose down` |
| `make reset` | Supprime les volumes, reconstruit, puis `make migrate seed` |
| `make logs` | Suit les logs de l'API |
| `make migrate` | Applique le schéma SQLAlchemy dans le conteneur `api` |
| `make seed` | Affiche le bandeau de l'environnement local (`infra/local/seed.py`) |
| `make shell` | Shell Python dans le conteneur `api` |
| `make psql` | Console PostgreSQL |
| `make redis` | Console Valkey |
| `make test` | Tests de l'API sur l'hôte (venv requis, voir CONTRIBUTING) |
| `make lock` | Régénère les fichiers de dépendances Python avec leurs hashes (`uv` requis) |

```sh
docker compose logs -f api
docker compose down
```

## Activer les types de projet

Web et Appli sont toujours actifs. Slides, Codelab et Design system restent
désactivés tant que leurs variables ne sont pas définies dans `.env` (le
service `api` lit `.env` via `env_file`) :

```sh
FORGE_KIND_SLIDES_ENABLED=true
FORGE_KIND_CODELAB_ENABLED=true
FORGE_KIND_DESIGN_SYSTEM_ENABLED=true
```

Recréez ensuite le conteneur de l'API pour qu'il les lise :

```sh
docker compose up -d api
```

L'app web lit la liste des types actifs auprès de l'API (`GET /kinds`) :
l'image `web` n'a pas besoin d'être reconstruite.

`PIXABAY_API_KEY` (optionnelle, côté serveur uniquement) active la recherche
d'images libres dans le panneau d'images. Vide, cette recherche répond `503`.

## Contenu de l'image de l'API

`apps/api/Dockerfile` se construit depuis la racine du dépôt. En plus de
Python 3.12 et des dépendances hashées, elle installe :

- **Node.js 22**, utilisé par l'API pour la publication et les exports de
  documents.
- **Playwright Chromium**, pour capturer les URLs de sites collées
  (`apps/api/app/services/url_capture.py`), pré-rendre les routes à la
  publication et produire les exports PDF.
- **`git`**, pour les snapshots d'historique par projet.
- **`apps/api/runtime/`** : le runtime de preview, plus `babel.min.js` copié
  depuis le paquet `@babel/standalone` épinglé.
- **`apps/api/runtime/deck/`** : le runtime des présentations et ses
  dépendances, avec les sources du player de `apps/web/components/deck-player`.
  Il bundle le player quand une présentation est publiée ou exportée, et
  construit l'export PPTX.
- **Le player de codelabs**, construit une fois pendant le build de l'image
  par `apps/api/runtime/codelab/build.mjs` à partir de
  `apps/web/components/codelab-player`. Chaque publication de codelab copie ce
  build.
- **`data/templates/`** et **`data/integrations/`**.

Dans `docker-compose.yml`, `apps/api/app` et `apps/api/runtime/public` sont
montés depuis votre checkout et l'API tourne avec `--reload` : les changements
Python s'appliquent sans rebuild. Un changement du Dockerfile, des
dépendances, des runtimes ou des composants des players demande un rebuild :

```sh
docker compose up -d --build api
```

## Notes

**Preview.** Les aperçus s'exécutent dans le navigateur via le runner
Babel/ESM ; l'API ne lance aucun serveur de dev Vite ou npm. Les projets
générés sont des *sources* au format Vite, mais rien ne les compile côté
serveur pour la preview.

**SSE et load balancers.** Heartbeat SSE toutes les 15 secondes
(`SSE_HEARTBEAT_SECONDS`). Derrière un ALB AWS, portez l'idle timeout à
**600 secondes** (`ALB_IDLE_TIMEOUT_SECONDS`) avant le premier run streamé.

**Windows.** Pour une boucle locale plus confortable, lancez l'API sur l'hôte
(`uvicorn app.main:app --reload --port 8100`) avec seulement les services
d'appui dans Docker : `docker compose up -d postgres valkey minio`.
