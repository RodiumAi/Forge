# Forge API — ECR + ECS Fargate

Déploiement cible :

| Composant | Hébergement |
| --- | --- |
| `apps/web` | **Amplify** (SSR Next.js) — domaine ex. `https://forge.rodiumai.io` |
| `apps/api` | **ECR** `forge/api` + **ECS Fargate** sur `rodiumai-cluster` derrière **ALB** `rodiumai-alb` |

**URL API prod** : `https://api-forge.rodiumai.io` (cert `*.rodiumai.io` — pas `api.forge.rodiumai.io`).

**URL web Amplify** : `https://forge.rodiumai.io`

Repo GitHub : [Rodium-AI/Forge](https://github.com/Rodium-AI/Forge.git)

Le workflow [`.github/workflows/deploy-api.yml`](../../../.github/workflows/deploy-api.yml) build `apps/api`, push l’image sur ECR, puis met à jour **uniquement** l’image dans la task definition ECS existante (les variables d’environnement restent dans AWS).

---

## 1. Créer le dépôt ECR

```bash
chmod +x infra/aws/ecs/setup-ecr.sh
AWS_REGION=eu-west-1 ./infra/aws/ecs/setup-ecr.sh
```

Ou manuellement :

```bash
aws ecr create-repository \
  --repository-name forge/api \
  --region eu-west-1 \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE
```

URI attendue :

```text
330990434320.dkr.ecr.eu-west-1.amazonaws.com/forge/api
```

> **Tags IMMUTABLE** : le workflow ne pousse que `:${GITHUB_SHA}` (pas de tag `latest` réécrit).

---

## 2. Infra ECS (une fois)

Checklist minimale :

1. **Cluster** ECS : `rodiumai-cluster` (partagé avec Nest/FastAPI).
2. **CloudWatch** log group : `/ecs/forge-api`.
3. **Task definition** `forge-api` — voir [`task-definition.example.json`](./task-definition.example.json) comme point de départ.
   - Port container **8000**
   - Health check ALB → `GET /health`
   - **ALB idle timeout ≥ 600 s** avant le premier run agent en streaming (voir `ALB_IDLE_TIMEOUT_SECONDS` dans l’API).
4. **Service** ECS Fargate `forge-api` (desired count ≥ 1) attaché à un target group ALB.
5. **RDS** : base `rodium_forge` (même cluster Aurora que la plateforme si partagé).
6. **ElastiCache / Valkey** : `REDIS_URL` pour la file de build.
7. **S3** : buckets `forge-uploads`, `forge-assets`, `forge-runtime` (remplace MinIO).
8. **EFS** (recommandé) : volume `/data/projects` monté sur le container (les templates sont dans l’image ; `data/templates` est copié au build — voir Dockerfile).

Variables d’environnement prod (task definition ou Secrets Manager) — reprendre [`../ec2/.env.example`](../ec2/.env.example) :

| Variable | Exemple prod |
| --- | --- |
| `CORS_ORIGINS` | `https://forge.rodiumai.io` |
| `RUNNER_PARENT_ORIGINS` | `https://forge.rodiumai.io` |
| `RODIUM_OIDC_REDIRECT_URI` | `https://forge.rodiumai.io/auth/callback` |
| `API_BASE_URL` | `https://api-forge.rodiumai.io` |

Le CORS est déjà géré dans `app/main.py` via `CORS_ORIGINS` (pas de changement code si l’origine Amplify est dans cette liste).

---

## 3. GitHub Actions

Configurer [infra/aws/github/README.md](../github/README.md) :

- Variables : `AWS_REGION`, `ECR_REPOSITORY=forge/api`, `ECS_CLUSTER`, `ECS_SERVICE`, `ECS_TASK_DEFINITION`, `CONTAINER_NAME=api`
- Secret OIDC : `AWS_DEPLOY_ROLE_ARN` (trust policy sur `repo:Rodium-AI/Forge:ref:refs/heads/main`)

Alternative (clés IAM, comme RodiumAI Nest/FastAPI) : secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — décommenter la section credentials dans le workflow.

---

## 4. Premier déploiement

1. Enregistrer la task definition initiale dans AWS (Console ou CLI) avec une image placeholder ou un premier push manuel.
2. Créer le service ECS + ALB + DNS `api.forge.rodiumai.io`.
3. Push sur `main` (changement sous `apps/api/**`) ou `workflow_dispatch` sur **Deploy API**.

Build manuel de test :

```bash
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin 330990434320.dkr.ecr.eu-west-1.amazonaws.com

docker build --platform linux/amd64 -t forge-api:local apps/api
docker tag forge-api:local 330990434320.dkr.ecr.eu-west-1.amazonaws.com/forge/api:test
docker push 330990434320.dkr.ecr.eu-west-1.amazonaws.com/forge/api:test
```

---

## 5. Ancien déploiement EC2

Le dossier [`../ec2/`](../ec2/) reste pour référence. Le workflow GitHub ne déploie plus via SSM/EC2 — uniquement ECS.
