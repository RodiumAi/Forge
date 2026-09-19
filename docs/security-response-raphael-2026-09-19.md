# Correctifs vulnérabilités Forge — note de réponse

Date: 2026-09-19  
Build ciblé: stack `forge-web` (signalements Raphael L&_M@z4rt + Valkey anonyme)

## Synthèse

| # | Signalement | Verdict | Correctif |
|---|-------------|---------|-----------|
| 1 | ReDoS `_EMBED_SNIPPET_RE` (DoS event loop) | Confirmé (impact DoS mono-worker) | Scan linéaire borné, plus de regex greedy |
| 1b | `/auth/rodium/callback` sans rate-limit + state rejouable | Confirmé | Rate-limit 20/15min + nonce `n` one-shot Redis |
| 2 | Publish sans purge / reclaim slug cross-tenant | Confirmé | Purge orphelins à chaque publish + purge ancien slug au rename |
| 3 | Valkey sans `requirepass`, port 6380 exposé | Confirmé | `--requirepass` + bind `127.0.0.1` + `REDIS_URL` avec password |

## Détail des changements

### 1 — ReDoS embed detection
- Fichier: `apps/api/app/services/url_capture.py`
- `looks_like_third_party_embed_snippet` ne passe plus par `_EMBED_SNIPPET_RE`
- Scan O(n) avec fenêtre fixe de 512 caractères par balise
- Tests: `tests/test_url_capture_embeds.py` (payload ~50k &lt; 50ms)

### 1b — OIDC callback
- `apps/api/app/routers/auth.py`: `rate_limit.enforce(..., "oauth-rodium-callback", 20/900s)`
- `apps/api/app/services/rodium_oidc.py`: consommation one-shot du claim `n` via Redis `SET NX EX 600` (fallback mémoire processus)
- Tests: `tests/test_oauth_state_nonce.py`

### 2 — Publish stale / cross-tenant
- `apps/api/app/providers/objects.py`: `list_prefix` + `delete_keys`
- `apps/api/app/services/publish_esm.py`: après upload, supprimer les clés du préfixe `{slug}/` absentes du nouveau build
- `apps/api/app/routers/projects.py`: au changement de slug, `delete_prefix(old_slug/)`
- Tests: `tests/test_publish_orphan_purge.py`

### 3 — Valkey auth
- `docker-compose.yml`: `--requirepass`, healthcheck authentifié, ports `127.0.0.1:6380`
- `REDIS_URL=redis://:${VALKEY_PASSWORD}@valkey:6379/0`
- `.env.example` / `apps/api/.env.example` / défaut `config.py` / CI compose alignés

**Action ops locale:** recopier `VALKEY_PASSWORD` dans `.env` et `REDIS_URL` avec mot de passe, puis `docker compose up -d valkey` (recreate).

## Hors scope (comme prévu)
- Remap breaking `{user_id}/{slug}/` pour isolation long terme
- Preuve bout-en-bout épuisement pool Nest via replay callback (mitigé par 1b + session DB post-Nest + usedAt atomique)
- Listing bucket IAM prod (garde-fous applicatifs ajoutés sous `{slug}/`)

## Durcissement complémentaire (après correctifs HIGH)
- Callback Forge : plus de session DB pinnée pendant Nest (ouvre après token/userinfo)
- Nest : consommation atomique du code auth (`updateMany` où `usedAt` null)
- Nonce OAuth : Redis obligatoire hors local/test (pas de fallback mémoire multi-worker)
- Domaines custom : mode degraded (CNAME seul → VALIDATED) refusé en staging/production
- Object store : `list_prefix` / `delete_*` refusent préfixe vide, racine, traversal ; clés hors `{slug}/…` rejetées

## Message type pour Raphael

> Merci pour le rapport détaillé (commit 5670082 / v1.0.5). Nous avons confirmé les deux findings HIGH plus l’observation callback, ainsi qu’un troisième signalement Valkey sans auth en local.
>
> Correctifs déployés / en cours de merge :
> 1. Remplacement de la regex d’embeds par un scan linéaire borné (plus de blocage event-loop sur pastes ~50k).
> 2. Sync publish : purge des clés orphelines sous `{slug}/` à chaque publication ; purge de l’ancien préfixe au rename de slug.
> 3. Rate-limit sur `POST /auth/rodium/callback` + nonce d’état OAuth à usage unique.
> 4. (Local) Valkey avec `requirepass` et bind localhost.
>
> Merci encore — on reste dispo pour toute question de suivi.
