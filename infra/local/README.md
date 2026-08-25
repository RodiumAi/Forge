# Environnement local Forge / Sites

Stack Docker sans compte AWS et sans Cloudinary plateforme. Le code applicatif est identique en local et en production ; seuls les providers et le `.env` changent.

| Production | Local | Mécanisme |
|---|---|---|
| AWS S3 / R2 | MinIO `:9000` (console `:9001`) | boto3 + `OBJECT_STORE_ENDPOINT` |
| AWS SES | Mailpit SMTP `:11025` (UI `:18025`) | `MAIL_PROVIDER=smtp` |
| AWS KMS | `LocalKeyProvider` | `KEY_PROVIDER=local` + `DEV_MASTER_KEY` |
| Secrets Manager | `.env` | `SECRET_PROVIDER=env` |
| SQS | Valkey Streams `:6380` (hôte) | même implémentation Redis |
| Cloudflare Worker | Caddy `:8080` | Host `*.lvh.me` |

Cloudinary et Resend restent des **connecteurs utilisateur** optionnels, jamais le backend plateforme.

## Démarrage

```sh
cd forge-web
cp .env.example .env
cp apps/api/.env.example apps/api/.env   # si l'API tourne hors Compose
make up
make seed
```

## Écarts de parité

### MinIO contre R2 / S3

Path-style en local (`OBJECT_STORE_ADDRESSING=path`). En production, passer en `virtual`. Ne pas s’appuyer sur les ACL objet ni sur les classes de stockage. Le cache dépend des en-têtes `Cache-Control` écrits à l’upload.

Les URL présignées doivent être signées avec `OBJECT_STORE_PUBLIC_ENDPOINT=http://localhost:9000` (hostname joignable depuis le navigateur), pas `http://minio:9000`.

### Mailpit contre SES / Resend

Mailpit accepte tout : pas de SPF/DKIM, pas de rebonds, pas de plaintes, pas de quota SES. Ces chemins se testent en staging.

### Caddy contre le Worker Cloudflare

Caddy reproduit le contrat de routage (`/_rodium/*` → API, le reste → MinIO), pas le cache CDN, le WAF ni le rate limit de bord.

### Redis Streams contre SQS

Aucun écart : la même implémentation tourne en local et en production.

### Preview Vite

Le live preview dashboard reste sur `{slug}.lvh.me:3100` (middleware Next). Caddy `:8080` sert le contrat Sites Gateway (assets publiés + `/_rodium`).

### Templates forkables

Les starters vivent dans `data/templates/` (monté en lecture seule dans l’API Docker). Voir `data/templates/README.md`. Régénérer les 10 kits :

```sh
python scripts/generate_templates.py
```
