# Déploiement production — Forge

> 🇬🇧 [English version](DEPLOYMENT.md)

Guide pour les **mainteneurs** : héberger Forge en open source avec **AWS Amplify** (frontend) et **EC2** (API), déployé automatiquement à chaque merge sur `main`.

## Vue d’ensemble

| Composant | Hébergement | Déploiement |
| --- | --- | --- |
| `apps/web` (Next.js) | **Amplify Hosting** | Auto sur push `main` (monorepo `apps/web`) |
| `apps/api` (FastAPI) | **EC2** + Docker | GitHub Actions → ECR → SSM → `deploy.sh` |
| Postgres | **RDS** | Hors compose prod |
| Valkey / Redis | **ElastiCache** | Hors compose prod |
| Fichiers / assets | **S3** | Remplace MinIO local |
| Projets utilisateurs | Volume EBS sur EC2 | `/data/projects` |

```text
Contributeur → PR → CI (tests)
                ↓ merge main
         ┌──────┴──────┐
         ▼             ▼
    Amplify         deploy-api.yml
    (apps/web)      → ECR → EC2
```

## Prérequis AWS

1. **Aurora PostgreSQL** (cluster existant `rodiumai-db-prod` — **même instance** que `rodium_platform` / `rodium_gateway`, base dédiée `rodium_forge`)
2. **ElastiCache Valkey** ou Redis (file Forge — peut être un cluster séparé ou DB Redis logique dédiée)
3. **S3** — buckets uploads, assets sites, runtime (voir `.env.example`)
4. **ECR** — repository `forge-web-api`
5. **EC2** — Ubuntu 22.04+, Docker, AWS CLI, SSM Agent
6. **ALB** (recommandé) devant l’API — idle timeout **600 s** ([infra/alb-idle-timeout.md](../infra/alb-idle-timeout.md))
7. **Amplify** — app connectée au repo GitHub

### Base `rodium_forge` sur Aurora (une fois)

Depuis la racine du monorepo RodiumAi (accès TCP 5432 au Writer Aurora) :

```powershell
.\scripts\aws-prod-db.ps1 create-forge-db      # CREATE DATABASE rodium_forge
.\scripts\aws-prod-db.ps1 migrate-forge        # schéma SQLAlchemy (init_db)
```

Détails : [rodiumai_docs/ECR/database-ops.md](../../rodiumai_docs/ECR/database-ops.md)

`DATABASE_URL` Forge (EC2) :

```env
postgresql+psycopg://USER:PASS@rodiumai-db-prod.cluster-xxxx.eu-west-1.rds.amazonaws.com:5432/rodium_forge?sslmode=require
```

Utilisez le **même Writer endpoint** que dans `rodiumai_nestjs/.env.aurora`. Le security group RDS doit autoriser l’EC2 Forge sur le port **5432**.

## 1. Frontend — Amplify

### Création de l’app

1. Amplify Console → **New app** → Host web app → GitHub
2. Branche : `main`
3. **Monorepo** : racine d’application = `apps/web`
4. Le build utilise [`apps/web/amplify.yml`](../apps/web/amplify.yml)

### Variables d’environnement (branche `main`)

Copier depuis [`infra/aws/amplify/env.example`](../infra/aws/amplify/env.example) :

| Variable | Exemple |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.forge.example.com` |
| `FORGE_FONT_MODE` | `fallback` |

**Important :** ne pas définir `DOCKER_BUILD=1` sur Amplify (casse le routing SSR — voir `apps/web/next.config.ts`).

### Domaine & OIDC

- Domaine custom : `app.forge.example.com`
- Mettre à jour `RODIUM_OIDC_REDIRECT_URI` côté API et fournisseur OIDC :  
  `https://app.forge.example.com/auth/callback`

Chaque merge sur `main` qui touche `apps/web/` déclenche un build Amplify.

## 2. Backend — EC2

### Bootstrap instance (une fois)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git awscli
sudo usermod -aG docker ubuntu

sudo mkdir -p /opt/forge
sudo chown ubuntu:ubuntu /opt/forge
git clone https://github.com/VOTRE_ORG/forge.git /opt/forge
cd /opt/forge

cp infra/aws/ec2/.env.example infra/aws/ec2/.env
# Éditer infra/aws/ec2/.env (RDS, S3, secrets, CORS Amplify…)
```

Créer le repository ECR et accorder à l’instance le droit `ecr:GetAuthorizationToken` + pull.

### Compose production

Fichier : [`infra/aws/ec2/docker-compose.prod.yml`](../infra/aws/ec2/docker-compose.prod.yml)

```bash
export AWS_REGION=eu-west-1
export ECR_REGISTRY=123456789012.dkr.ecr.eu-west-1.amazonaws.com
export ECR_REPOSITORY=forge-web-api
./infra/aws/ec2/deploy.sh latest
curl -fsS http://127.0.0.1:8000/health
```

### ALB / TLS

- Target group → port `8000` sur l’instance (ou Caddy local si décommenté dans le compose)
- Health check : `GET /health`
- Idle timeout : **600 s** minimum pour les streams SSE agent

## 3. GitHub Actions — `deploy-api.yml`

Déclenché sur **push `main`** si changements dans :

- `apps/api/**`
- `infra/aws/ec2/**`

Étapes : tests API → build Docker → push ECR → commande SSM sur EC2.

### Configuration GitHub

Voir [`infra/aws/github/README.md`](../infra/aws/github/README.md) :

- Variables : `AWS_REGION`, `ECR_REGISTRY`, `ECR_REPOSITORY`, `FORGE_ROOT`
- Secrets : `AWS_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`
- Environment `production` (optionnel : approbation manuelle)

Déploiement manuel : **Actions → Deploy API → Run workflow**.

## 4. Flux contributeur (OSS)

1. Fork + branche feature
2. PR vers `main` → **CI** obligatoire (`.github/workflows/ci.yml`)
3. Review + merge
4. **Front** : Amplify rebuild si `apps/web` modifié
5. **API** : `deploy-api` si `apps/api` modifié

Les contributeurs n’ont pas besoin d’accès AWS — seuls les maintainers configurent Amplify / EC2.

## 5. CORS & preview

Dans `infra/aws/ec2/.env` :

```env
CORS_ORIGINS=https://app.forge.example.com
RUNNER_PARENT_ORIGINS=https://app.forge.example.com
```

## 6. Checklist post-déploiement

- [ ] `GET https://api…/health` → `{"status":"ok"}`
- [ ] UI Amplify charge et appelle l’API
- [ ] Login OIDC (callback prod)
- [ ] Création projet + preview + stream agent (ALB 600 s)
- [ ] Upload S3 / publication site

## 7. Rollback API

```bash
cd /opt/forge
./infra/aws/ec2/deploy.sh <ancien-sha-git>
```

Ou re-run le workflow GitHub Actions avec le tag d’image souhaité.

## Fichiers de référence

| Fichier | Rôle |
| --- | --- |
| `apps/web/amplify.yml` | Build Amplify |
| `infra/aws/ec2/docker-compose.prod.yml` | Stack API sur EC2 |
| `infra/aws/ec2/deploy.sh` | Pull ECR + restart |
| `infra/aws/ec2/.env.example` | Variables prod API |
| `.github/workflows/deploy-api.yml` | CD backend |
| `.github/workflows/ci.yml` | CI PR / main |
