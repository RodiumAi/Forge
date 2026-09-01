# Forge Sites Gateway (production)

Sert les sites publiés Forge à **`https://{slug}.forge.rodiumai.io`**.

| Composant | Rôle |
|-----------|------|
| **Amplify** | `forge.rodiumai.io` — builder web |
| **ECS `forge-api`** | `api-forge.rodiumai.io` — API |
| **ECS `forge-sites-gateway`** (Caddy) | `*.forge.rodiumai.io` — assets S3 + proxy `/_rodium/*` |

## Architecture

```
{slug}.forge.rodiumai.io
        │
        ▼
   rodiumai-alb (TLS SNI: *.forge.rodiumai.io)
        │
        ▼
   forge-sites-gateway (Caddy :80)
        ├─ /_rodium/*  →  https://api-forge.rodiumai.io
        └─ /*          →  s3://forge-assets-prod/{slug}/…
```

Le publish API écrit déjà dans `forge-assets-prod/{slug}/`. La gateway réécrit le host en préfixe S3, comme le Caddy local (`infra/local/Caddyfile`).

## DNS — domaine externe (pas Route53)

`rodiumai.io` est géré chez votre registrar, pas dans Route53. Créez ces enregistrements **chez le registrar** :

| Nom | Type | Cible |
|-----|------|--------|
| `forge` | CNAME ou alias Amplify | domaine Amplify de l'app Forge |
| `api-forge` | CNAME | `rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com` |
| `*.forge` | CNAME | même ALB |

> **Un seul wildcard** `*.forge.rodiumai.io` suffit pour tous les slugs. Pas de record par projet.

### TLS

- `*.rodiumai.io` (cert existant) couvre `api-forge.rodiumai.io` et `forge.rodiumai.io`
- **`*.forge.rodiumai.io` nécessite un certificat ACM séparé** (sous-domaine à 2 niveaux)

```powershell
# Depuis la racine forge-web
powershell -File infra/aws/sites-gateway/bootstrap-sites-gateway.ps1 -RequestCertificate -SkipBuild -SkipService
```

Ajoutez le CNAME de validation ACM affiché par le script chez votre registrar, attendez `ISSUED`, puis relancez le bootstrap complet.

## Bootstrap

```powershell
cd forge-web
powershell -File infra/aws/sites-gateway/bootstrap-sites-gateway.ps1 -RequestCertificate
```

Options :

- `-SkipBuild` — infra AWS seulement (image ECR déjà poussée)
- `-SkipService` — ECR + ALB + S3, sans ECS
- `-RequestCertificate` — demande `*.forge.rodiumai.io` dans ACM si absent

Met à jour aussi l'API Forge :

```powershell
powershell -File infra/aws/ecs/bootstrap-forge-ecs.ps1 -SkipBuild
```

Variable clé : `SITES_BASE_DOMAIN=forge.rodiumai.io` → URLs publiées `https://{slug}.forge.rodiumai.io`.

## S3

`forge-assets-prod` reçoit une policy **lecture publique** (`GetObject`) pour que Caddy puisse proxifier sans signature SigV4. Les uploads (`forge-uploads-prod`) restent privés.

## Fichiers

| Fichier | Description |
|---------|-------------|
| `Caddyfile` | Routage host → S3 + API |
| `Dockerfile` | Image `caddy:2.9-alpine` |
| `bootstrap-sites-gateway.ps1` | ECR, TG, règle ALB, ECS, cert SNI |
| `s3-assets-public-read.json` | Policy bucket assets |

## Vérification

```bash
# Gateway health (via ALB)
curl -s -o /dev/null -w "%{http_code}" https://health.forge.rodiumai.io/health
# → 200 (après DNS + cert)

# Site publié
curl -I -H "Host: mon-slug.forge.rodiumai.io" https://rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com/
```

## ECS

| Service | Task family | Port |
|---------|-------------|------|
| `forge-sites-gateway` | `forge-sites-gateway` | 80 |

ECR : `330990434320.dkr.ecr.eu-west-1.amazonaws.com/forge/sites-gateway`
