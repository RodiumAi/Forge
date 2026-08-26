# Docker — Forge Web

```sh
cp .env.example .env
docker compose up -d --build
```

- UI : http://localhost:3100  
- API : http://localhost:8100/docs  
- Adminer : http://localhost:8089 (server `postgres`, user/db `forge`)  
- Postgres host : `127.0.0.1:5434`
- Build worker : conteneur `forge-web-build-worker` (file Redis `sites:builds`)

```sh
docker compose logs -f api
docker compose logs -f build-worker
docker compose down
```

**Build Node** : avec `BUILD_WORKER_ENABLED=true` (défaut Compose), `vite build` / npm lourds passent par le worker — jamais dans le process uvicorn. En API hôte seule, laisse `BUILD_WORKER_ENABLED=false` ou lance `python -m app.workers.build_worker`.

**SSE / ALB** : heartbeats SSE toutes les ~15s. Avant le premier run streamé en prod, porter l’idle timeout ALB à **600 secondes** (`ALB_IDLE_TIMEOUT_SECONDS`).

**Firestore live** : démarrer les émulateurs Auth+Firestore (port **8085**, pas 8080) — voir `infra/local/firestore-emulator.md`. Puis `FIRESTORE_ENABLED=true` sur api/build-worker.

**Note preview** : le process Vite tourne encore dans le conteneur `api` (dev). Pour un confort max en local Windows, préfère API sur l’hôte (`uvicorn`) + `docker compose up -d postgres valkey` — ainsi `npm`/`node` du host démarrent la preview.
