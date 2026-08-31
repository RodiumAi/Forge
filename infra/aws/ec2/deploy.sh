#!/usr/bin/env bash
# Deploy / roll out a new API image on EC2.
# Called by GitHub Actions (SSM) or manually by maintainers.
#
# Prerequisites on the instance:
#   - Docker + Docker Compose plugin
#   - AWS CLI (for ECR login)
#   - Repo cloned at FORGE_ROOT (default /opt/forge)
#   - infra/aws/ec2/.env configured (see .env.example)
#
# Usage:
#   ./infra/aws/ec2/deploy.sh [image-tag]
#   FORGE_API_IMAGE=... ./infra/aws/ec2/deploy.sh

set -euo pipefail

FORGE_ROOT="${FORGE_ROOT:-/opt/forge}"
COMPOSE_FILE="${FORGE_ROOT}/infra/aws/ec2/docker-compose.prod.yml"
DEPLOY_DIR="${FORGE_ROOT}/infra/aws/ec2"
IMAGE_TAG="${1:-latest}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:?Set ECR_REPOSITORY (e.g. forge-web-api)}"
ECR_REGISTRY="${ECR_REGISTRY:?Set ECR_REGISTRY (account).dkr.ecr.REGION.amazonaws.com}"

export FORGE_API_IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

cd "${FORGE_ROOT}"

echo "==> Logging in to ECR (${ECR_REGISTRY})"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "==> Pulling ${FORGE_API_IMAGE}"
docker compose -f "${COMPOSE_FILE}" --project-directory "${DEPLOY_DIR}" pull api

echo "==> Starting API"
docker compose -f "${COMPOSE_FILE}" --project-directory "${DEPLOY_DIR}" up -d --remove-orphans api

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    echo "API healthy"
    docker compose -f "${COMPOSE_FILE}" --project-directory "${DEPLOY_DIR}" ps
    exit 0
  fi
  sleep 2
done

echo "ERROR: API did not become healthy in time" >&2
docker compose -f "${COMPOSE_FILE}" --project-directory "${DEPLOY_DIR}" logs --tail=80 api || true
exit 1
