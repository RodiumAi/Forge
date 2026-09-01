#!/usr/bin/env bash
# Create ECR repository forge/api + lifecycle policy (keep last 10 images).
# Run once from a machine with AWS CLI configured (account 330990434320).
#
# Usage:
#   AWS_REGION=eu-west-1 ./infra/aws/ecs/setup-ecr.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-west-1}"
REPOSITORY_NAME="${REPOSITORY_NAME:-forge/api}"

echo "==> Creating ECR repository ${REPOSITORY_NAME} (${AWS_REGION})"
aws ecr create-repository \
  --repository-name "${REPOSITORY_NAME}" \
  --region "${AWS_REGION}" \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE \
  2>/dev/null || echo "Repository may already exist — continuing."

echo "==> Applying lifecycle policy (keep 10 images)"
aws ecr put-lifecycle-policy \
  --repository-name "${REPOSITORY_NAME}" \
  --region "${AWS_REGION}" \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Keep only the 10 most recent images",
        "selection": {
          "tagStatus": "any",
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": { "type": "expire" }
      }
    ]
  }'

echo "==> Repository URI:"
aws ecr describe-repositories \
  --repository-names "${REPOSITORY_NAME}" \
  --region "${AWS_REGION}" \
  --query 'repositories[0].repositoryUri' \
  --output text
