# GitHub repository configuration (maintainers)

Repo : [Rodium-AI/Forge](https://github.com/Rodium-AI/Forge.git)

Set these **before** the first production deploy.

## GitHub Environments

Create an environment named `production` with optional protection rules (required reviewers).

## Repository variables (`Settings → Secrets and variables → Actions → Variables`)

| Variable | Example | Used by |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | deploy-api |
| `ECR_REPOSITORY` | `forge/api` | deploy-api |
| `ECS_CLUSTER` | `rodiumai-cluster` | deploy-api |
| `ECS_SERVICE` | `forge-api` | deploy-api |
| `ECS_TASK_DEFINITION` | `forge-api` | deploy-api |
| `CONTAINER_NAME` | `api` | deploy-api |

`ECR_REGISTRY` is resolved automatically at login time (`steps.ecr.outputs.registry`).

Defaults are also hardcoded in `.github/workflows/deploy-api.yml` — override via variables if your AWS names differ.

## Repository secrets

| Secret | Description |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role assumed by GitHub OIDC (`deploy-api` workflow) |

### Alternative : clés IAM (sans OIDC)

Replace the OIDC credential steps in `deploy-api.yml` with:

```yaml
aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

Required IAM permissions : ECR push + `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`, `iam:PassRole`.

## IAM (OIDC)

Bootstrap script (idempotent) :

```powershell
./infra/aws/github/bootstrap-github-oidc.ps1
```

Then set the GitHub secret (environment `production`) :

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --env production --repo Rodium-AI/Forge \
  --body "arn:aws:iam::330990434320:role/github-actions-forge-api-deploy"
```

### Trust policy (classic + immutable `sub`)

Repos created after 2026-07-15 use immutable subject claims, e.g.
`repo:Rodium-AI@282585446/Forge@1344172064:environment:production`.
The role trust policy in `trust-policy.json` allows **both** name-based and ID-based subjects.

Manual sketch :

1. GitHub OIDC provider `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
2. Role `github-actions-forge-api-deploy` scoped to `repo:Rodium-AI/Forge:*` **and** `repo:Rodium-AI@282585446/Forge@1344172064:*`.
3. Inline policy `deploy-policy.json` : ECR push `forge/api`, ECS deploy `forge-api`, `iam:PassRole` on task roles.

## ECR bootstrap

```bash
./infra/aws/ecs/setup-ecr.sh
```

See [infra/aws/ecs/README.md](../ecs/README.md) for ECS cluster, ALB, and task definition setup.

## Legacy EC2 deploy

The previous workflow used `EC2_INSTANCE_ID` + SSM. That path is retired in favour of ECS — see [infra/aws/ec2/README.md](../ec2/README.md) for reference only.
