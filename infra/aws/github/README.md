# GitHub repository configuration (maintainers)

Set these **before** the first production deploy.

## GitHub Environments

Create an environment named `production` with optional protection rules (required reviewers).

## Repository variables (`Settings → Secrets and variables → Actions → Variables`)

| Variable | Example | Used by |
| --- | --- | --- |
| `AWS_REGION` | `eu-west-1` | deploy-api |
| `ECR_REGISTRY` | `123456789012.dkr.ecr.eu-west-1.amazonaws.com` | deploy-api, EC2 deploy.sh |
| `ECR_REPOSITORY` | `forge-web-api` | deploy-api, EC2 deploy.sh |
| `FORGE_ROOT` | `/opt/forge` | SSM deploy commands |

## Repository secrets

| Secret | Description |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role assumed by GitHub OIDC (`deploy-api` workflow) |
| `EC2_INSTANCE_ID` | Target EC2 instance (`i-…`) with SSM agent |

## IAM (OIDC) sketch

1. GitHub OIDC provider in AWS IAM.
2. Role trust policy scoped to `repo:ORG/forge:ref:refs/heads/main`.
3. Role permissions: `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ssm:SendCommand` on the EC2 instance.

See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) for the full runbook.
