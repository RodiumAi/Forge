# Bootstrap GitHub Actions OIDC deploy role for Forge API (ECR + ECS).
# Requires: AWS CLI, permissions iam:* on account 330990434320.

$ErrorActionPreference = "Stop"
$AccountId = "330990434320"
$Region = "eu-west-1"
$RoleName = "github-actions-forge-api-deploy"
$ProviderUrl = "token.actions.githubusercontent.com"
$ProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/${ProviderUrl}"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> OIDC provider"
$existing = aws iam list-open-id-connect-providers --output json | ConvertFrom-Json
if (-not ($existing.OpenIDConnectProviderList.Arn -contains $ProviderArn)) {
    aws iam create-open-id-connect-provider `
        --url "https://${ProviderUrl}" `
        --client-id-list "sts.amazonaws.com" `
        --tags Key=Project,Value=Forge Key=ManagedBy,Value=github-actions | Out-Null
    Write-Host "    created $ProviderArn"
} else {
    Write-Host "    already exists"
}

Write-Host "==> IAM role $RoleName"
$getRole = aws iam get-role --role-name $RoleName 2>&1
if ($LASTEXITCODE -ne 0) {
    aws iam create-role `
        --role-name $RoleName `
        --assume-role-policy-document "file://$ScriptDir/trust-policy.json" `
        --description "GitHub Actions deploy Forge API to ECS (Rodium-AI/Forge)" `
        --tags Key=Project,Value=Forge Key=ManagedBy,Value=github-actions | Out-Null
    Write-Host "    created"
} else {
    aws iam update-assume-role-policy `
        --role-name $RoleName `
        --policy-document "file://$ScriptDir/trust-policy.json" | Out-Null
    Write-Host "    updated trust policy"
}

aws iam put-role-policy `
    --role-name $RoleName `
    --policy-name ForgeApiDeploy `
    --policy-document "file://$ScriptDir/deploy-policy.json" | Out-Null
Write-Host "    inline policy ForgeApiDeploy applied"

$RoleArn = "arn:aws:iam::${AccountId}:role/${RoleName}"
Write-Host ""
Write-Host "Role ARN: $RoleArn"
Write-Host ""
Write-Host "GitHub secret (production environment):"
Write-Host "  gh secret set AWS_DEPLOY_ROLE_ARN --env production --repo Rodium-AI/Forge --body `"$RoleArn`""
