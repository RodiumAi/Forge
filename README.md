# Forge Web

Produit web MVP inspiré de Forge (Electron) : **Next.js + FastAPI + PostgreSQL**, avec **RodiumAi** comme unique provider LLM (clé API utilisateur).

## Liens locaux

| Service | URL |
|---------|-----|
| UI Next.js (landing) | http://localhost:3100 |
| Dashboard projets | http://localhost:3100/dashboard |
| API FastAPI | http://localhost:8100 |
| API docs | http://localhost:8100/docs |
| Sites Gateway (Caddy) | http://`<slug>`.lvh.me:8080 |
| MinIO console | http://localhost:9001 (`rodiumdev` / `rodiumdev123`) |
| Mailpit | http://localhost:18025 (SMTP `:11025`) |
| Valkey | `127.0.0.1:6380` |
| Adminer | http://localhost:8089 |
| Postgres | `127.0.0.1:5434` |

## Démarrage rapide (Docker)

Un seul compose couvre Postgres, API, Web, **MinIO**, **Mailpit**, **Valkey** et **Caddy** — sans compte AWS ni Cloudinary plateforme.

```sh
cd forge-web
cp .env.example .env
make up
make seed
```

Ou : `docker compose up -d --build`

Voir aussi [infra/local/README.md](infra/local/README.md) (écarts de parité local / prod).

## Démarrage local (dev hybride)

```sh
# 1) Infra Docker (DB + object store + mail + cache)
docker compose up -d postgres adminer minio minio-init mailpit valkey

# 2) API (hôte) — utilise apps/api/.env avec endpoints localhost
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100

# 3) Web
cd apps/web
npm install
npm run dev
```

## Flow MVP

1. Sign in with RodiumAi
2. Settings → clé / wallet RodiumAi
3. Créer un projet (scaffold Vite/React)
4. Chatter → stream SSE → écriture fichiers via tags `<forge-write>`
5. Start preview → `{slug}.lvh.me:3100` (Vite) ; Sites Gateway → Caddy `:8080`

## Stack

- **Web** : Next.js 15 (App Router), branding orange `#F2620A`
- **API** : FastAPI, SQLAlchemy, JWT, Fernet pour la clé
- **DB** : PostgreSQL 17 (port **5434**)
- **Object store local** : MinIO (S3-compatible) — prod : S3 / R2
- **Email local** : Mailpit — prod : SES (fallback) ou Resend (connecteur)
- **Cache / files** : Valkey (Redis Streams)
- **Routage Sites** : Caddy (`*.lvh.me`)
- **LLM** : roster Gemini (`google/gemini-3.7-flash` par défaut) via gateway RodiumAi ; images de test via `openai/gpt-image-2`
- Thinking / étapes visibles dans le builder ; charte graphique `DESIGN.md` injectée à chaque appel

Cloudinary / Resend / FedaPay / Supabase / Firebase restent des **connecteurs utilisateur** optionnels.
