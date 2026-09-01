# Bootstrap Forge Sites Gateway on AWS (Caddy → S3 + API proxy).
#
# Serves published sites at https://{slug}.forge.rodiumai.io
# DNS is external (rodiumai.io is NOT in Route53) - see README.md.
#
# Usage (from forge-web repo root):
#   powershell -File infra/aws/sites-gateway/bootstrap-sites-gateway.ps1
#   powershell -File infra/aws/sites-gateway/bootstrap-sites-gateway.ps1 -SkipBuild
#   powershell -File infra/aws/sites-gateway/bootstrap-sites-gateway.ps1 -RequestCertificate

param(
    [switch]$SkipBuild,
    [switch]$SkipService,
    [switch]$RequestCertificate,
    [switch]$NoVerifySsl = $true,
    [string]$Region = 'eu-west-1',
    [string]$AccountId = '330990434320',
    [string]$Cluster = 'rodiumai-cluster',
    [string]$ServiceName = 'forge-sites-gateway',
    [string]$TaskFamily = 'forge-sites-gateway',
    [string]$ContainerName = 'gateway',
    [string]$EcrRepository = 'forge/sites-gateway',
    [string]$SitesHostSuffix = 'forge.rodiumai.io',
    [string]$SitesHostWildcard = '*.forge.rodiumai.io',
    [string]$ForgeApiHost = 'api-forge.rodiumai.io',
    [string]$S3AssetsBucket = 'forge-assets-prod',
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
    [int]$ListenerRulePriority = 4,
    [int]$DesiredCount = 1
)

$ErrorActionPreference = 'Stop'
$GatewayRoot = $PSScriptRoot
$ForgeRoot = (Resolve-Path (Join-Path $GatewayRoot '..\..\..')).Path
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$StateFile = Join-Path $GatewayRoot 'bootstrap-state.json'
$AlbDns = 'rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com'

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

Write-Host "==> Forge Sites Gateway bootstrap ($Region)" -ForegroundColor Cyan
Write-Host "    Sites: https://{slug}.$SitesHostSuffix"
Write-Host "    ALB host rule: $SitesHostWildcard"

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

# --- 3. S3 public read for published assets (Caddy proxies without SigV4) ---
Write-Host "`n==> S3 bucket policy (public GetObject on $S3AssetsBucket)" -ForegroundColor Cyan
try {
    Invoke-Aws @('s3api', 'head-bucket', '--bucket', $S3AssetsBucket, '--region', $Region) | Out-Null
}
catch {
    throw "Bucket $S3AssetsBucket does not exist - run infra/aws/ecs/bootstrap-forge-ecs.ps1 first"
}

Invoke-Aws @(
    's3api', 'put-public-access-block',
    '--bucket', $S3AssetsBucket,
    '--public-access-block-configuration',
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false'
) | Out-Null

$policyFile = Join-Path $GatewayRoot 's3-assets-public-read.json'
Invoke-Aws @(
    's3api', 'put-bucket-policy',
    '--bucket', $S3AssetsBucket,
    '--policy', "file://$($policyFile -replace '\\','/')"
) | Out-Null
Write-Host '    Bucket policy applied' -ForegroundColor Green

# --- 4. ACM certificate *.forge.rodiumai.io (SNI on ALB) ---
Write-Host "`n==> ACM certificate for $SitesHostWildcard" -ForegroundColor Cyan
$certArn = $null
$certsJson = Invoke-Aws @('acm', 'list-certificates', '--region', $Region, '--certificate-statuses', 'ISSUED', 'PENDING_VALIDATION', '--output', 'json')
$certList = ($certsJson | ConvertFrom-Json).CertificateSummaryList
$existingCert = $certList | Where-Object { $_.DomainName -eq $SitesHostWildcard } | Select-Object -First 1
if ($existingCert) {
    $certArn = $existingCert.CertificateArn
    Write-Host "    Found: $certArn ($($existingCert.Status))" -ForegroundColor DarkGray
}
elseif ($RequestCertificate) {
    $certArn = (Invoke-Aws @(
        'acm', 'request-certificate',
        '--domain-name', $SitesHostWildcard,
        '--validation-method', 'DNS',
        '--region', $Region,
        '--query', 'CertificateArn',
        '--output', 'text'
    ) | Out-String).Trim()
    Write-Host "    Requested: $certArn" -ForegroundColor Green
    Start-Sleep -Seconds 5
}
else {
    Write-Host '    No cert found - re-run with -RequestCertificate' -ForegroundColor Yellow
}

if ($certArn) {
    $certDetail = Invoke-Aws @('acm', 'describe-certificate', '--certificate-arn', $certArn, '--region', $Region, '--output', 'json') | ConvertFrom-Json
    $status = $certDetail.Certificate.Status
    Write-Host "    Status: $status" -ForegroundColor $(if ($status -eq 'ISSUED') { 'Green' } else { 'Yellow' })

    if ($status -eq 'PENDING_VALIDATION') {
        Write-Host "`n    Add this DNS record at your registrar (rodiumai.io):" -ForegroundColor Yellow
        foreach ($opt in $certDetail.Certificate.DomainValidationOptions) {
            $rec = $opt.ResourceRecord
            if ($rec) {
                Write-Host "      CNAME  $($rec.Name)  ->  $($rec.Value)" -ForegroundColor Cyan
            }
        }
    }
}

# --- 5. ALB target group ---
Write-Host "`n==> Target group forge-sites-gateway-tg" -ForegroundColor Cyan
$tgName = 'forge-sites-gateway-tg'
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
        '--port', '80',
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

# --- 6. ALB listener rule + optional cert ---
Write-Host "`n==> ALB listener rule ($SitesHostWildcard)" -ForegroundColor Cyan
$albArn = (Invoke-Aws @('elbv2', 'describe-load-balancers', '--names', $AlbName, '--region', $Region,
    '--query', 'LoadBalancers[0].LoadBalancerArn', '--output', 'text') | Out-String).Trim()
$listenerArn = (Invoke-Aws @('elbv2', 'describe-listeners', '--load-balancer-arn', $albArn, '--region', $Region,
    '--query', 'Listeners[?Port==`443`].ListenerArn | [0]', '--output', 'text')).Trim()

if ($certArn) {
  $certDetail = Invoke-Aws @('acm', 'describe-certificate', '--certificate-arn', $certArn, '--region', $Region, '--output', 'json') | ConvertFrom-Json
  if ($certDetail.Certificate.Status -eq 'ISSUED') {
    try {
      Invoke-Aws @('elbv2', 'add-listener-certificates', '--listener-arn', $listenerArn, '--region', $Region,
        '--certificates', "CertificateArn=$certArn") | Out-Null
      Write-Host '    Listener certificate attached (SNI)' -ForegroundColor Green
    }
    catch {
      if ($_.Exception.Message -notmatch 'CertificateAlreadyExists|already exists') { throw }
      Write-Host '    Listener certificate already attached' -ForegroundColor DarkGray
    }
  }
}

$rulesJson = Invoke-Aws @('elbv2', 'describe-rules', '--listener-arn', $listenerArn, '--region', $Region, '--output', 'json')
$rules = ($rulesJson | ConvertFrom-Json).Rules
$hostRule = $rules | Where-Object {
    $_.Conditions | Where-Object { $_.Field -eq 'host-header' -and $_.Values -contains $SitesHostWildcard }
} | Select-Object -First 1

if ($hostRule) {
    Write-Host '    Rule already exists' -ForegroundColor DarkGray
}
else {
    Invoke-Aws @(
        'elbv2', 'create-rule',
        '--listener-arn', $listenerArn,
        '--priority', "$ListenerRulePriority",
        '--conditions', "Field=host-header,Values=$SitesHostWildcard",
        '--actions', "Type=forward,TargetGroupArn=$tgArn",
        '--region', $Region
    ) | Out-Null
    Write-Host '    Rule created' -ForegroundColor Green
}

# --- 7. Build & push image ---
$imageTag = 'bootstrap'
if (-not $SkipBuild) {
    Write-Host "`n==> Docker build & push" -ForegroundColor Cyan
    $password = Invoke-Aws @('ecr', 'get-login-password', '--region', $Region)
    $password | docker login --username AWS --password-stdin $Registry | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'docker login failed' }

    Push-Location $GatewayRoot
    try {
        docker build --platform linux/amd64 -t "${Registry}/${EcrRepository}:${imageTag}" .
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
    # --- 8. Register task definition ---
    Write-Host "`n==> Register task definition $TaskFamily" -ForegroundColor Cyan
    $taskDef = [ordered]@{
        family                  = $TaskFamily
        networkMode             = 'awsvpc'
        requiresCompatibilities = @('FARGATE')
        cpu                     = '256'
        memory                  = '512'
        executionRoleArn        = $ExecutionRoleArn
        taskRoleArn             = $TaskRoleArn
        containerDefinitions    = @(
            [ordered]@{
                name         = $ContainerName
                image        = $imageUri
                essential    = $true
                portMappings = @(
                    [ordered]@{ containerPort = 80; protocol = 'tcp'; name = 'gateway-80-tcp'; appProtocol = 'http' }
                )
                environment  = @(
                    @{ name = 'SITES_HOST_SUFFIX'; value = $SitesHostSuffix }
                    @{ name = 'S3_ASSETS_BUCKET'; value = $S3AssetsBucket }
                    @{ name = 'S3_REGION'; value = $Region }
                    @{ name = 'FORGE_API_UPSTREAM'; value = $ForgeApiHost }
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
    }

    $taskFile = Join-Path $GatewayRoot 'task-definition.generated.json'
    $json = $taskDef | ConvertTo-Json -Depth 20 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($taskFile, $json, $utf8NoBom)
    $regOut = Invoke-Aws @('ecs', 'register-task-definition', '--region', $Region,
        '--cli-input-json', "file://$($taskFile -replace '\\','/')", '--output', 'json')
    $taskArn = ($regOut | ConvertFrom-Json).taskDefinition.taskDefinitionArn
    Write-Host "    Registered: $taskArn" -ForegroundColor Green

    # --- 9. ECS service ---
    Write-Host "`n==> ECS service $ServiceName on $Cluster" -ForegroundColor Cyan
    $svcJson = Invoke-Aws @('ecs', 'describe-services', '--cluster', $Cluster, '--services', $ServiceName,
        '--region', $Region, '--output', 'json')
    $svcList = ($svcJson | ConvertFrom-Json).services | Where-Object { $_.status -ne 'INACTIVE' -and $_.serviceName -eq $ServiceName }
    $svcExists = @($svcList).Count -gt 0

    $subnetList = ($Subnets -join ',')
    $netCfg = "awsvpcConfiguration={subnets=[$subnetList],securityGroups=[$EcsSecurityGroup],assignPublicIp=ENABLED}"
    $lbCfg = "targetGroupArn=$tgArn,containerName=$ContainerName,containerPort=80"

    if ($svcExists) {
        Invoke-Aws @('ecs', 'update-service', '--cluster', $Cluster, '--service', $ServiceName,
            '--task-definition', $taskArn, '--force-new-deployment', '--region', $Region) | Out-Null
        Write-Host '    Service updated' -ForegroundColor Green
    }
    else {
        Invoke-Aws @('ecs', 'create-service', '--cluster', $Cluster, '--service-name', $ServiceName,
            '--task-definition', $taskArn, '--desired-count', "$DesiredCount", '--launch-type', 'FARGATE',
            '--network-configuration', $netCfg, '--load-balancers', $lbCfg,
            '--health-check-grace-period-seconds', '60', '--region', $Region) | Out-Null
        Write-Host '    Service created' -ForegroundColor Green
    }

    Write-Host "`n==> Waiting for service stability (up to ~10 min)..." -ForegroundColor Cyan
    Invoke-Aws @('ecs', 'wait', 'services-stable', '--cluster', $Cluster, '--services', $ServiceName, '--region', $Region) | Out-Null
}

@{
    TargetGroupArn     = $tgArn
    SitesHostWildcard  = $SitesHostWildcard
    SitesHostSuffix    = $SitesHostSuffix
    CertificateArn     = $certArn
    ImageUri           = $imageUri
    Cluster            = $Cluster
    ServiceName        = $ServiceName
    S3AssetsBucket     = $S3AssetsBucket
} | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8

Write-Host "`n=== Sites Gateway bootstrap complete ===" -ForegroundColor Green
Write-Host "Published URL pattern: https://{slug}.$SitesHostSuffix"
Write-Host "ALB DNS (CNAME target): $AlbDns"
Write-Host ""
Write-Host "DNS at your registrar (rodiumai.io is external - NOT Route53):" -ForegroundColor Yellow
Write-Host "  forge.rodiumai.io           -> Amplify (builder UI)" -ForegroundColor Cyan
Write-Host "  api-forge.rodiumai.io       -> CNAME $AlbDns" -ForegroundColor Cyan
Write-Host "  *.forge.rodiumai.io         -> CNAME $AlbDns  (one wildcard, all slugs)" -ForegroundColor Cyan
Write-Host ""
Write-Host "TLS: cert *.forge.rodiumai.io required (NOT covered by *.rodiumai.io)" -ForegroundColor Yellow
Write-Host "     Run with -RequestCertificate if not done yet, then add ACM validation CNAME" -ForegroundColor Yellow
Write-Host ""
Write-Host "Forge API: set SITES_BASE_DOMAIN=forge.rodiumai.io (bootstrap-forge-ecs.ps1)" -ForegroundColor Yellow
Write-Host "           Re-deploy forge-api to pick up the new published URLs" -ForegroundColor Yellow
