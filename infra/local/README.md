# Environnement local Forge / Sites

Stack Docker sans compte cloud. Le code applicatif est identique en local et en production ; seuls les providers et le `.env` changent.

| Production | Local | Mécanisme |
|---|---|---|
| Object storage (S3) | MinIO `:9000` (console `:9001`) | boto3 + `OBJECT_STORE_ENDPOINT` |
| KMS | `LocalKeyProvider` | `KEY_PROVIDER=local` + `DEV_MASTER_KEY` |
| Secrets | `.env` | `SECRET_PROVIDER=env` |
| Valkey / Redis | Valkey `:6380` (hôte) | même implémentation Redis |
| Hébergement statique | Caddy `:8080` | Host `*.lvh.me` |

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

Path-style en local (`OBJECT_STORE_ADDRESSING=path`). En production, passer en `virtual`. Ne pas s'appuyer sur les ACL objet ni sur les classes de stockage. Le cache dépend des en-têtes `Cache-Control` écrits à l'upload.

Les URL présignées doivent être signées avec `OBJECT_STORE_PUBLIC_ENDPOINT=http://localhost:9000` (hostname joignable depuis le navigateur), pas `http://minio:9000`.

### Caddy contre le CDN / hébergeur statique

Caddy reproduit le contrat de routage (`/_rodium/*` → API, le reste → MinIO), pas le cache CDN, le WAF ni le rate limit de bord.

### Valkey local contre Valkey/Redis managé

Aucun écart : la même implémentation Redis Streams tourne en local et en production.

### Preview

Le live preview dashboard reste sur `{slug}.lvh.me:3100` (middleware Next). Caddy `:8080` sert le contrat Sites Gateway (assets publiés + `/_rodium`).

Les aperçus s'exécutent dans le navigateur via le runner Babel/ESM : l'API ne lance ni Vite ni npm. Le seul sous-processus est `git`, pour les snapshots par projet.

### Templates forkables

Les starters vivent dans `data/templates/`. Guide contributeur : [docs/TEMPLATES.fr.md](../../docs/TEMPLATES.fr.md).
