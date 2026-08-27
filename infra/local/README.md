# Environnement local Forge / Sites

Stack Docker sans compte AWS. Le code applicatif est identique en local et en production ; seuls les providers et le `.env` changent.

| Production | Local | Mécanisme |
|---|---|---|
| AWS S3 | MinIO `:9000` (console `:9001`) | boto3 + `OBJECT_STORE_ENDPOINT` |
| AWS KMS | `LocalKeyProvider` | `KEY_PROVIDER=local` + `DEV_MASTER_KEY` |
| Secrets Manager | `.env` | `SECRET_PROVIDER=env` |
| Valkey / Redis managé | Valkey `:6380` (hôte) | même implémentation Redis |
| CDN / hébergeur statique | Caddy `:8080` | Host `*.lvh.me` |

## Démarrage

```sh
cd forge-web
cp .env.example .env
cp apps/api/.env.example apps/api/.env   # si l'API tourne hors Compose
make up
make seed
```

## Écarts de parité

### MinIO contre S3

Path-style en local (`OBJECT_STORE_ADDRESSING=path`). En production, passer en `virtual`. Ne pas s’appuyer sur les ACL objet ni sur les classes de stockage. Le cache dépend des en-têtes `Cache-Control` écrits à l’upload.

Les URL présignées doivent être signées avec `OBJECT_STORE_PUBLIC_ENDPOINT=http://localhost:9000` (hostname joignable depuis le navigateur), pas `http://minio:9000`.

### Caddy contre le CDN / hébergeur statique

Caddy reproduit le contrat de routage (`/_rodium/*` → API, le reste → MinIO), pas le cache CDN, le WAF ni le rate limit de bord.

### Valkey local contre Valkey/Redis managé

Aucun écart : la même implémentation Redis Streams tourne en local et en production.

### Build worker (Node)

Le service Compose `build-worker` consomme la file Valkey `sites:builds`. L’API enqueue (`BUILD_WORKER_ENABLED=true`) et n’exécute plus `vite build` dans le process FastAPI. Partage du volume `./data/projects`.

### SSE et idle timeout ALB

Les streams agent émettent des commentaires SSE (`: hb …`) toutes les `SSE_HEARTBEAT_SECONDS` (15s). **Avant le premier run streamé derrière un ALB**, configurer :

```text
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn <ALB_ARN> \
  --attributes Key=idle_timeout.timeout_seconds,Value=600
```

Cible documentée : `ALB_IDLE_TIMEOUT_SECONDS=600`.

### Preview Vite

Le live preview dashboard reste sur `{slug}.lvh.me:3100` (middleware Next). Caddy `:8080` sert le contrat Sites Gateway (assets publiés + `/_rodium`).

### Templates forkables

Les starters vivent dans `data/templates/` (monté en lecture seule dans l’API Docker). Voir `data/templates/README.md`. Régénérer les 10 kits :

```sh
python scripts/generate_templates.py
```
