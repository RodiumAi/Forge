# Bootstrap Forge API on AWS: ECR, ALB rule, EFS, ECS service (Fargate).
#
# Prerequisites:
#   - AWS CLI configured (account 330990434320)
#   - Docker running (for first image push)
#   - Monorepo: rodiumai_nestjs/.env.aurora OR infra/aws/ecs/.env.ecs (see .env.ecs.example)
#
# Usage (from forge-web repo root):
#   powershell -File infra/aws/ecs/bootstrap-forge-ecs.ps1
#   powershell -File infra/aws/ecs/bootstrap-forge-ecs.ps1 -SkipBuild   # infra only
#   powershell -File infra/aws/ecs/bootstrap-forge-ecs.ps1 -SkipService # ECR+ALB only

param(
    [switch]$SkipBuild,
    [switch]$SkipService,
    [switch]$NoVerifySsl = $true,
    [string]$Region = 'eu-west-1',
    [string]$AccountId = '330990434320',
    [string]$Cluster = 'rodiumai-cluster',
    [string]$ServiceName = 'forge-api',
    [string]$TaskFamily = 'forge-api',
    [string]$ContainerName = 'api',
    [string]$EcrRepository = 'forge/api',
    [string]$ApiHost = 'api-forge.rodiumai.io',
    [string]$WebOrigin = 'https://forge.rodiumai.io',
    [string]$VpcId = 'vpc-0e77bd5ea1bb767e4',
    [string[]]$Subnets = @(
        'subnet-03f0cc840a85f1ab4',
        'subnet-0d7b6b17a13794a4b',
        'subnet-08e140893f2c6456b'
    ),
    [string]$EcsSecurityGroup = 'sg-0b1684669adbe3849',
    [string]$AlbName = 'rodiumai-alb',
    [string]$ExecutionRoleArn = 'arn:aws:iam::330990434320:role/ecsTaskExecutionRole',
    [string]$TaskRoleArn = 'arn:aws:iam::330990434320:role/rodiumai-ecs-task-role',
    [int]$ListenerRulePriority = 3,
    [int]$DesiredCount = 1
)

$ErrorActionPreference = 'Stop'
$ForgeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$MonorepoRoot = (Resolve-Path (Join-Path $ForgeRoot '..')).Path
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$StateFile = Join-Path $PSScriptRoot 'bootstrap-state.json'

function Invoke-Aws {
    param([string[]]$CommandArgs)
    if ($NoVerifySsl) { $CommandArgs += '--no-verify-ssl' }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & aws @CommandArgs 2>$null
        if ($LASTEXITCODE -ne 0) {
            $err = (& aws @CommandArgs 2>&1 | Out-String)
            throw $err
        }
        return $out
    }
    finally { $ErrorActionPreference = $prev }
}

function Get-EnvFileMap {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { return }
        if ($line -match '^([^=]+)=(.*)$') {
            $map[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $map
}

function Get-ForgeDatabaseUrl {
    $auroraHelper = Join-Path $MonorepoRoot 'scripts\aws\_aurora-env.ps1'
    if (Test-Path $auroraHelper) {
        . $auroraHelper
        return (Get-AuroraDatabaseUrl -DatabaseName 'rodium_forge' -Driver 'postgresql+psycopg')
    }
    throw 'Cannot resolve DATABASE_URL — add rodiumai_nestjs/.env.aurora or DATABASE_URL in infra/aws/ecs/.env.ecs'
}

Write-Host "==> Forge ECS bootstrap ($Region)" -ForegroundColor Cyan
Write-Host "    Repo root: $ForgeRoot"
Write-Host "    API host:  https://$ApiHost"

# --- Load env overrides ---
$ecsEnvPath = Join-Path $PSScriptRoot '.env.ecs'
$ecsEnv = Get-EnvFileMap $ecsEnvPath
$databaseUrl = if ($ecsEnv['DATABASE_URL']) { $ecsEnv['DATABASE_URL'] } else { Get-ForgeDatabaseUrl }
$secretKey = if ($ecsEnv['SECRET_KEY']) { $ecsEnv['SECRET_KEY'] } else { [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
$encryptionKey = if ($ecsEnv['ENCRYPTION_KEY']) { $ecsEnv['ENCRYPTION_KEY'] } else { [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
$redisUrl = if ($ecsEnv['REDIS_URL']) {
    $ecsEnv['REDIS_URL']
}
else {
    'rediss://master.rodiumai-cache.kftqkz.euw1.cache.amazonaws.com:6379/1'
}
$environmentName = if ($ecsEnv['ENVIRONMENT']) { $ecsEnv['ENVIRONMENT'] } else { 'staging' }
$rodiumOidcClientId = $ecsEnv['RODIUM_OIDC_CLIENT_ID']
$rodiumOidcClientSecret = $ecsEnv['RODIUM_OIDC_CLIENT_SECRET']
$rodiumOidcScopes = if ($ecsEnv['RODIUM_OIDC_SCOPES']) { $ecsEnv['RODIUM_OIDC_SCOPES'] } else { 'openid profile email api_keys.read wallet.read' }
if (-not $rodiumOidcClientId -or -not $rodiumOidcClientSecret) {
    Write-Host 'WARN: RODIUM_OIDC_CLIENT_ID/SECRET missing in infra/aws/ecs/.env.ecs - Sign in with RodiumAi will fail' -ForegroundColor Yellow
}

# --- 1. ECR ---
Write-Host "`n==> ECR repository $EcrRepository" -ForegroundColor Cyan
try {
    Invoke-Aws @('ecr', 'create-repository', '--repository-name', $EcrRepository, '--region', $Region,
        '--image-scanning-configuration', 'scanOnPush=true', '--image-tag-mutability', 'IMMUTABLE') | Out-Null
    Write-Host '    Created' -ForegroundColor Green
}
catch {
    if ($_.Exception.Message -match 'RepositoryAlreadyExistsException') {
        Write-Host '    Already exists' -ForegroundColor DarkGray
    }
    else { throw }
}

try {
    $lifecycleFile = Join-Path $PSScriptRoot 'ecr-lifecycle-policy.json'
    Invoke-Aws @('ecr', 'put-lifecycle-policy', '--repository-name', $EcrRepository, '--region', $Region,
        '--lifecycle-policy-text', "file://$($lifecycleFile -replace '\\','/')") | Out-Null
}
catch {
    Write-Host "    Lifecycle policy skipped: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# --- 2. CloudWatch log group ---
Write-Host "`n==> CloudWatch log group /ecs/$TaskFamily" -ForegroundColor Cyan
try {
    Invoke-Aws @('logs', 'create-log-group', '--log-group-name', "/ecs/$TaskFamily", '--region', $Region) | Out-Null
    Write-Host '    Created' -ForegroundColor Green
}
catch {
    if ($_.Exception.Message -match 'ResourceAlreadyExistsException') {
        Write-Host '    Already exists' -ForegroundColor DarkGray
    }
    else { throw }
}

# --- 3. ALB idle timeout 600s (SSE agent streams) ---
Write-Host "`n==> ALB idle timeout -> 600s" -ForegroundColor Cyan
$albArn = (Invoke-Aws @('elbv2', 'describe-load-balancers', '--names', $AlbName, '--region', $Region, '--query', 'LoadBalancers[0].LoadBalancerArn', '--output', 'text') | Out-String).Trim()
Invoke-Aws @('elbv2', 'modify-load-balancer-attributes', '--load-balancer-arn', $albArn, '--region', $Region,
    '--attributes', 'Key=idle_timeout.timeout_seconds,Value=600') | Out-Null

# --- 4. Target group ---
Write-Host "`n==> Target group forge-api-tg" -ForegroundColor Cyan
$tgName = 'forge-api-tg'
$tgArn = $null
try {
    $tgArn = (Invoke-Aws @('elbv2', 'describe-target-groups', '--names', $tgName, '--region', $Region,
        '--query', 'TargetGroups[0].TargetGroupArn', '--output', 'text') | Out-String).Trim()
}
catch {
    if ($_.Exception.Message -notmatch 'TargetGroupNotFound') { throw }
}

if (-not $tgArn -or $tgArn -eq 'None') {
    $tgArn = (Invoke-Aws @(
        'elbv2', 'create-target-group',
        '--name', $tgName,
        '--protocol', 'HTTP',
        '--port', '8000',
        '--vpc-id', $VpcId,
        '--target-type', 'ip',
        '--health-check-path', '/health',
        '--health-check-interval-seconds', '30',
        '--health-check-timeout-seconds', '5',
        '--healthy-threshold-count', '2',
        '--unhealthy-threshold-count', '3',
        '--matcher', 'HttpCode=200',
        '--region', $Region,
        '--query', 'TargetGroups[0].TargetGroupArn',
        '--output', 'text'
    ) | Out-String).Trim()
    Write-Host "    Created: $tgArn" -ForegroundColor Green
}
else {
    Write-Host "    Exists: $tgArn" -ForegroundColor DarkGray
}

# --- 5. HTTPS listener rule (host api-forge.rodiumai.io) ---
Write-Host "`n==> ALB listener rule ($ApiHost)" -ForegroundColor Cyan
$listenerArn = (Invoke-Aws @('elbv2', 'describe-listeners', '--load-balancer-arn', $albArn, '--region', $Region,
    '--query', 'Listeners[?Port==`443`].ListenerArn | [0]', '--output', 'text')).Trim()

$rulesJson = Invoke-Aws @('elbv2', 'describe-rules', '--listener-arn', $listenerArn, '--region', $Region, '--output', 'json')
$rules = ($rulesJson | ConvertFrom-Json).Rules
$hostRule = $rules | Where-Object {
    $_.Conditions | Where-Object { $_.Field -eq 'host-header' -and $_.Values -contains $ApiHost }
} | Select-Object -First 1

if ($hostRule) {
    Write-Host '    Rule already exists' -ForegroundColor DarkGray
}
else {
    Invoke-Aws @(
        'elbv2', 'create-rule',
        '--listener-arn', $listenerArn,
        '--priority', "$ListenerRulePriority",
        '--conditions', "Field=host-header,Values=$ApiHost",
        '--actions', "Type=forward,TargetGroupArn=$tgArn",
        '--region', $Region
    ) | Out-Null
    Write-Host '    Rule created' -ForegroundColor Green
}

# --- 6. EFS for /data/projects ---
Write-Host "`n==> EFS volume (projects)" -ForegroundColor Cyan
$efsId = $null
$efsApId = $null
if (Test-Path $StateFile) {
    $state = Get-Content $StateFile -Raw | ConvertFrom-Json
    $efsId = $state.EfsId
    $efsApId = $state.EfsAccessPointId
}
if (-not $efsId) {
  $efsId = (Invoke-Aws @('efs', 'create-file-system', '--region', $Region, '--encrypted',
      '--tags', 'Key=Name,Value=forge-projects', '--performance-mode', 'generalPurpose',
      '--throughput-mode', 'bursting', '--query', 'FileSystemId', '--output', 'text') | Out-String).Trim()
  Write-Host "    FileSystem: $efsId" -ForegroundColor Green
  Start-Sleep -Seconds 10
}

# EFS security group (allow NFS from ECS tasks)
$efsSgName = 'forge-efs-sg'
$efsSgId = (Invoke-Aws @('ec2', 'describe-security-groups', '--filters', "Name=group-name,Values=$efsSgName", "Name=vpc-id,Values=$VpcId", '--region', $Region,
    '--query', 'SecurityGroups[0].GroupId', '--output', 'text' 2>$null)).Trim()
if (-not $efsSgId -or $efsSgId -eq 'None') {
    $efsSgId = (Invoke-Aws @('ec2', 'create-security-group', '--group-name', $efsSgName,
        '--description', 'Forge EFS NFS from ECS', '--vpc-id', $VpcId, '--region', $Region,
        '--query', 'GroupId', '--output', 'text')).Trim()
    Invoke-Aws @('ec2', 'authorize-security-group-ingress', '--group-id', $efsSgId, '--region', $Region,
        '--protocol', 'tcp', '--port', '2049', '--source-group', $EcsSecurityGroup) | Out-Null
    Write-Host "    EFS SG: $efsSgId" -ForegroundColor Green
}

foreach ($subnet in $Subnets) {
    $mt = Invoke-Aws @('efs', 'describe-mount-targets', '--file-system-id', $efsId, '--region', $Region, '--output', 'json')
    $exists = ($mt | ConvertFrom-Json).MountTargets | Where-Object { $_.SubnetId -eq $subnet }
    if (-not $exists) {
        Invoke-Aws @('efs', 'create-mount-target', '--file-system-id', $efsId, '--subnet-id', $subnet,
            '--security-groups', $efsSgId, '--region', $Region) | Out-Null
    }
}

if (-not $efsApId) {
    $apJson = @"
{
  "FileSystemId": "$efsId",
  "PosixUser": { "Uid": 1000, "Gid": 1000 },
  "RootDirectory": { "Path": "/forge-projects", "CreationInfo": { "OwnerUid": 1000, "OwnerGid": 1000, "Permissions": "755" } }
}
"@
    $apFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($apFile, $apJson)
    try {
        $efsApId = (Invoke-Aws @('efs', 'create-access-point', '--region', $Region,
            '--cli-input-json', "file://$($apFile -replace '\\','/')",
            '--query', 'AccessPointId', '--output', 'text')).Trim()
        Write-Host "    Access point: $efsApId" -ForegroundColor Green
    }
    finally { Remove-Item $apFile -ErrorAction SilentlyContinue }
}

# Allow ECS task role to mount EFS (if using IAM auth)
# rodiumai-ecs-task-role may need elasticfilesystem:ClientMount — document if mount fails.

# --- 7. S3 buckets (idempotent) ---
Write-Host "`n==> S3 buckets" -ForegroundColor Cyan
foreach ($bucket in @('forge-uploads-prod', 'forge-assets-prod', 'forge-runtime-prod')) {
    try {
        Invoke-Aws @('s3api', 'create-bucket', '--bucket', $bucket, '--region', $Region,
            '--create-bucket-configuration', "LocationConstraint=$Region") | Out-Null
        Write-Host "    Created $bucket" -ForegroundColor Green
    }
    catch {
        if ($_.Exception.Message -match 'BucketAlreadyOwnedByYou|BucketAlreadyExists') {
            Write-Host "    Exists $bucket" -ForegroundColor DarkGray
        }
        else { throw }
    }
}

# --- 8. Build & push image ---
$imageTag = 'bootstrap'
if (-not $SkipBuild) {
    Write-Host "`n==> Docker build & push" -ForegroundColor Cyan
    $password = Invoke-Aws @('ecr', 'get-login-password', '--region', $Region)
    $password | docker login --username AWS --password-stdin $Registry | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'docker login failed' }

    Push-Location $ForgeRoot
    try {
        docker build --platform linux/amd64 -f apps/api/Dockerfile -t "${Registry}/${EcrRepository}:${imageTag}" .
        if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }
        docker push "${Registry}/${EcrRepository}:${imageTag}"
        if ($LASTEXITCODE -ne 0) { throw 'docker push failed' }
    }
    finally { Pop-Location }
}
else {
    Write-Host "`n==> Skipping Docker build (-SkipBuild)" -ForegroundColor DarkYellow
}

$imageUri = "${Registry}/${EcrRepository}:${imageTag}"

if ($SkipService) {
    Write-Host "`nSkipService - stopping before ECS service." -ForegroundColor Yellow
}
else {
    # --- 9. Register task definition ---
    Write-Host "`n==> Register task definition $TaskFamily" -ForegroundColor Cyan
    $apiBaseUrl = "https://$ApiHost"
    $taskDef = [ordered]@{
        family                   = $TaskFamily
        networkMode              = 'awsvpc'
        requiresCompatibilities  = @('FARGATE')
        cpu                      = '1024'
        memory                   = '2048'
        executionRoleArn         = $ExecutionRoleArn
        taskRoleArn              = $TaskRoleArn
        containerDefinitions     = @(
            [ordered]@{
                name         = $ContainerName
                image        = $imageUri
                essential    = $true
                portMappings = @(
                    [ordered]@{ containerPort = 8000; protocol = 'tcp'; name = 'api-8000-tcp'; appProtocol = 'http' }
                )
                environment  = @(
                    @{ name = 'ENVIRONMENT'; value = $environmentName }
                    @{ name = 'API_BASE_URL'; value = $apiBaseUrl }
                    @{ name = 'CORS_ORIGINS'; value = $WebOrigin }
                    @{ name = 'RUNNER_PARENT_ORIGINS'; value = $WebOrigin }
                    @{ name = 'PROJECTS_ROOT'; value = '/data/projects' }
                    @{ name = 'TEMPLATES_ROOT'; value = '/app/data/templates' }
                    @{ name = 'SSE_HEARTBEAT_SECONDS'; value = '15' }
                    @{ name = 'ALB_IDLE_TIMEOUT_SECONDS'; value = '600' }
                    @{ name = 'DATABASE_URL'; value = $databaseUrl }
                    @{ name = 'SECRET_KEY'; value = $secretKey }
                    @{ name = 'ENCRYPTION_KEY'; value = $encryptionKey }
                    @{ name = 'REDIS_URL'; value = $redisUrl }
                    @{ name = 'KEY_PROVIDER'; value = 'local' }
                    @{ name = 'SECRET_PROVIDER'; value = 'env' }
                    @{ name = 'OBJECT_STORE_ENDPOINT'; value = 'https://s3.eu-west-1.amazonaws.com' }
                    @{ name = 'OBJECT_STORE_PUBLIC_ENDPOINT'; value = 'https://forge-uploads-prod.s3.eu-west-1.amazonaws.com' }
                    @{ name = 'OBJECT_STORE_ADDRESSING'; value = 'virtual' }
                    @{ name = 'OBJECT_STORE_REGION'; value = $Region }
                    @{ name = 'BUCKET_UPLOADS'; value = 'forge-uploads-prod' }
                    @{ name = 'BUCKET_SITE_ASSETS'; value = 'forge-assets-prod' }
                    @{ name = 'BUCKET_RUNTIME'; value = 'forge-runtime-prod' }
                    @{ name = 'RODIUM_BASE_URL'; value = 'https://api.rodiumai.io/v1' }
                    @{ name = 'RODIUM_OIDC_ISSUER'; value = 'https://rsb.rodiumai.io' }
                    @{ name = 'RODIUM_OIDC_INTERNAL_ISSUER'; value = 'https://rsb.rodiumai.io' }
                    @{ name = 'RODIUM_OIDC_CLIENT_ID'; value = $rodiumOidcClientId }
                    @{ name = 'RODIUM_OIDC_CLIENT_SECRET'; value = $rodiumOidcClientSecret }
                    @{ name = 'RODIUM_OIDC_SCOPES'; value = $rodiumOidcScopes }
                    @{ name = 'RODIUM_OIDC_REDIRECT_URI'; value = "$WebOrigin/auth/callback" }
                    @{ name = 'RODIUM_USER_APP_URL'; value = 'https://rodiumai.io' }
                    @{ name = 'SITES_BASE_DOMAIN'; value = 'forge.rodiumai.io' }
                )
                mountPoints  = @(
                    [ordered]@{
                        sourceVolume  = 'forge-projects'
                        containerPath = '/data/projects'
                        readOnly      = $false
                    }
                )
                logConfiguration = [ordered]@{
                    logDriver = 'awslogs'
                    options   = [ordered]@{
                        'awslogs-group'         = "/ecs/$TaskFamily"
                        'awslogs-region'        = $Region
                        'awslogs-stream-prefix' = 'ecs'
                    }
                }
            }
        )
        volumes = @(
            [ordered]@{
                name = 'forge-projects'
                efsVolumeConfiguration = [ordered]@{
                    fileSystemId      = $efsId
                    transitEncryption = 'ENABLED'
                    authorizationConfig = [ordered]@{
                        accessPointId = $efsApId
                        iam           = 'ENABLED'
                    }
                }
            }
        )
    }

    $taskFile = Join-Path $PSScriptRoot 'task-definition.generated.json'
    $json = $taskDef | ConvertTo-Json -Depth 20 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($taskFile, $json, $utf8NoBom)
    $regOut = Invoke-Aws @('ecs', 'register-task-definition', '--region', $Region,
        '--cli-input-json', "file://$($taskFile -replace '\\','/')", '--output', 'json')
    $taskArn = ($regOut | ConvertFrom-Json).taskDefinition.taskDefinitionArn
    Write-Host "    Registered: $taskArn" -ForegroundColor Green

    # --- 10. ECS service ---
    Write-Host "`n==> ECS service $ServiceName on $Cluster" -ForegroundColor Cyan
    $svcJson = Invoke-Aws @('ecs', 'describe-services', '--cluster', $Cluster, '--services', $ServiceName,
        '--region', $Region, '--output', 'json')
    $svcList = ($svcJson | ConvertFrom-Json).services | Where-Object { $_.status -ne 'INACTIVE' -and $_.serviceName -eq $ServiceName }
    $svcExists = @($svcList).Count -gt 0

    $subnetList = ($Subnets -join ',')
    $netCfg = "awsvpcConfiguration={subnets=[$subnetList],securityGroups=[$EcsSecurityGroup],assignPublicIp=ENABLED}"
    $lbCfg = "targetGroupArn=$tgArn,containerName=$ContainerName,containerPort=8000"

    if ($svcExists) {
        Invoke-Aws @('ecs', 'update-service', '--cluster', $Cluster, '--service', $ServiceName,
            '--task-definition', $taskArn, '--force-new-deployment', '--region', $Region) | Out-Null
        Write-Host '    Service updated' -ForegroundColor Green
    }
    else {
        Invoke-Aws @('ecs', 'create-service', '--cluster', $Cluster, '--service-name', $ServiceName,
            '--task-definition', $taskArn, '--desired-count', "$DesiredCount", '--launch-type', 'FARGATE',
            '--network-configuration', $netCfg, '--load-balancers', $lbCfg,
            '--health-check-grace-period-seconds', '120', '--region', $Region) | Out-Null
        Write-Host '    Service created' -ForegroundColor Green
    }

    Write-Host "`n==> Waiting for service stability (up to ~10 min)..." -ForegroundColor Cyan
    Invoke-Aws @('ecs', 'wait', 'services-stable', '--cluster', $Cluster, '--services', $ServiceName, '--region', $Region) | Out-Null
}

# Save state (no secrets)
@{
    EfsId            = $efsId
    EfsAccessPointId = $efsApId
    TargetGroupArn   = $tgArn
    ApiHost          = $ApiHost
    ImageUri         = $imageUri
    Cluster          = $Cluster
    ServiceName      = $ServiceName
} | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8

Write-Host "`n=== Bootstrap complete ===" -ForegroundColor Green
Write-Host "API URL (after DNS): https://$ApiHost"
Write-Host "Health check:        https://$ApiHost/health"
Write-Host "ALB DNS (CNAME):     rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com"
Write-Host ""
Write-Host "DNS: create CNAME api-forge.rodiumai.io -> ALB DNS" -ForegroundColor Yellow
Write-Host "Amplify web CORS:    CORS_ORIGINS=$WebOrigin (already in task def)" -ForegroundColor Yellow
Write-Host "GitHub vars:         ECS_CLUSTER=$Cluster ECS_SERVICE=$ServiceName" -ForegroundColor Yellow
Write-Host 'Note: wildcard cert *.rodiumai.io covers api-forge.rodiumai.io only' -ForegroundColor Yellow
