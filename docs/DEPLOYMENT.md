# Production deployment — Forge

> 🇫🇷 [Version française](DEPLOYMENT.fr.md)

Runbook for **maintainers**: host Forge as open source with **AWS Amplify** (frontend) and **EC2** (API), auto-deployed on every merge to `main`.

## Overview

| Component | Hosting | Deploy trigger |
| --- | --- | --- |
| `apps/web` (Next.js) | **Amplify Hosting** | Auto on `main` push (monorepo root `apps/web`) |
| `apps/api` (FastAPI) | **EC2** + Docker | GitHub Actions → ECR → SSM → `deploy.sh` |
| Postgres | **RDS** | Outside prod compose |
| Valkey / Redis | **ElastiCache** | Outside prod compose |
| File storage | **S3** | Replaces local MinIO |
| User projects | EBS volume on EC2 | `/data/projects` |

```text
Contributor → PR → CI (tests)
                 ↓ merge main
          ┌──────┴──────┐
          ▼             ▼
     Amplify         deploy-api.yml
     (apps/web)      → ECR → EC2
```

## AWS prerequisites

1. **Aurora PostgreSQL** (existing `rodiumai-db-prod` cluster — **same instance** as `rodium_platform` / `rodium_gateway`, dedicated database `rodium_forge`)
2. **ElastiCache Valkey** or Redis
3. **S3** — upload, site assets, runtime buckets (see `.env.example`)
4. **ECR** — repository `forge-web-api`
5. **EC2** — Ubuntu 22.04+, Docker, AWS CLI, SSM Agent
6. **ALB** (recommended) in front of the API — idle timeout **600 s** ([infra/alb-idle-timeout.md](../infra/alb-idle-timeout.md))
7. **Amplify** — app linked to the GitHub repo

### `rodium_forge` database on Aurora (one-time)

From the RodiumAi monorepo root (TCP 5432 access to the Aurora Writer):

```powershell
.\scripts\aws-prod-db.ps1 create-forge-db
.\scripts\aws-prod-db.ps1 migrate-forge
```

See [rodiumai_docs/ECR/database-ops.md](../../rodiumai_docs/ECR/database-ops.md).

Forge `DATABASE_URL` on EC2:

```env
postgresql+psycopg://USER:PASS@rodiumai-db-prod.cluster-xxxx.eu-west-1.rds.amazonaws.com:5432/rodium_forge?sslmode=require
```

Use the **same Writer endpoint** as `rodiumai_nestjs/.env.aurora`. The RDS security group must allow the Forge EC2 instance on port **5432**.

## 1. Frontend — Amplify

### Create the app

1. Amplify Console → **New app** → Host web app → GitHub
2. Branch: `main`
3. **Monorepo** app root: `apps/web`
4. Build spec: [`apps/web/amplify.yml`](../apps/web/amplify.yml)

### Environment variables (`main` branch)

Copy from [`infra/aws/amplify/env.example`](../infra/aws/amplify/env.example):

| Variable | Example |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.forge.example.com` |
| `FORGE_FONT_MODE` | `fallback` |

**Do not** set `DOCKER_BUILD=1` on Amplify (breaks SSR routing — see `apps/web/next.config.ts`).

### Custom domain & OIDC

- Custom domain: `app.forge.example.com`
- Update `RODIUM_OIDC_REDIRECT_URI` on the API and IdP:  
  `https://app.forge.example.com/auth/callback`

Every merge to `main` that touches `apps/web/` triggers an Amplify build.

## 2. Backend — EC2

### One-time instance bootstrap

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git awscli
sudo usermod -aG docker ubuntu

sudo mkdir -p /opt/forge
sudo chown ubuntu:ubuntu /opt/forge
git clone https://github.com/YOUR_ORG/forge.git /opt/forge
cd /opt/forge

cp infra/aws/ec2/.env.example infra/aws/ec2/.env
# Edit infra/aws/ec2/.env (RDS, S3, secrets, Amplify CORS…)
```

Create the ECR repository and grant the instance `ecr:GetAuthorizationToken` + pull access.

### Production compose

File: [`infra/aws/ec2/docker-compose.prod.yml`](../infra/aws/ec2/docker-compose.prod.yml)

```bash
export AWS_REGION=eu-west-1
export ECR_REGISTRY=123456789012.dkr.ecr.eu-west-1.amazonaws.com
export ECR_REPOSITORY=forge-web-api
./infra/aws/ec2/deploy.sh latest
curl -fsS http://127.0.0.1:8000/health
```

### ALB / TLS

- Target group → instance port `8000` (or local Caddy if enabled in compose)
- Health check: `GET /health`
- Idle timeout: **600 s** minimum for agent SSE streams

## 3. GitHub Actions — `deploy-api.yml`

Runs on **push to `main`** when these paths change:

- `apps/api/**`
- `infra/aws/ec2/**`

Pipeline: API tests → Docker build → ECR push → SSM command on EC2.

### GitHub configuration

See [`infra/aws/github/README.md`](../infra/aws/github/README.md):

- Variables: `AWS_REGION`, `ECR_REGISTRY`, `ECR_REPOSITORY`, `FORGE_ROOT`
- Secrets: `AWS_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`
- Optional `production` environment with required reviewers

Manual deploy: **Actions → Deploy API → Run workflow**.

## 4. Contributor flow (OSS)

1. Fork + feature branch
2. PR to `main` → **CI** required (`.github/workflows/ci.yml`)
3. Review + merge
4. **Frontend**: Amplify rebuild if `apps/web` changed
5. **API**: `deploy-api` if `apps/api` changed

Contributors do not need AWS access — only maintainers configure Amplify / EC2.

## 5. CORS & preview

In `infra/aws/ec2/.env`:

```env
CORS_ORIGINS=https://app.forge.example.com
RUNNER_PARENT_ORIGINS=https://app.forge.example.com
```

## 6. Post-deploy checklist

- [ ] `GET https://api…/health` → `{"status":"ok"}`
- [ ] Amplify UI loads and calls the API
- [ ] OIDC login (prod callback)
- [ ] Project creation + preview + agent stream (ALB 600 s)
- [ ] S3 upload / site publish

## 7. API rollback

```bash
cd /opt/forge
./infra/aws/ec2/deploy.sh <previous-git-sha>
```

Or re-run the GitHub Actions workflow with a specific image tag.

## Reference files

| File | Role |
| --- | --- |
| `apps/web/amplify.yml` | Amplify build |
| `infra/aws/ec2/docker-compose.prod.yml` | API stack on EC2 |
| `infra/aws/ec2/deploy.sh` | ECR pull + restart |
| `infra/aws/ec2/.env.example` | Prod API env vars |
| `.github/workflows/deploy-api.yml` | Backend CD |
| `.github/workflows/ci.yml` | PR / main CI |
