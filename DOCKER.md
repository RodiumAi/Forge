# Docker — Forge Web

```sh
cp .env.example .env
docker compose up -d --build
```

- UI : http://localhost:3100  
- API : http://localhost:8100/docs  
- Adminer : http://localhost:8089 (server `postgres`, user/db `forge`)  
- Postgres host : `127.0.0.1:5434`

```sh
docker compose logs -f api
docker compose down
```

**Note preview** : le process Vite tourne dans le conteneur `api`. Pour un confort max en local Windows, préfère API sur l’hôte (`uvicorn`) + `docker compose up -d postgres` seulement — ainsi `npm`/`node` du host démarrent la preview.
