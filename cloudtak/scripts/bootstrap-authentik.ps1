# ==============================================================================
# TISCK: Automated Authentik Bootstrap & Tactical Groups Setup (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$AuthentikUrl = "http://127.0.0.1:9000",
    [string]$BootstrapToken = "",
    [string]$ClientId = "cloudtak",
    [string]$ClientSecret = "",
    [string]$RedirectUri = "http://localhost:5000/api/login/oidc/callback"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CloudTakDir = Split-Path -Parent $ScriptDir
$EnvIdentity = Join-Path $CloudTakDir ".env.identity"
$DotEnv = Join-Path $CloudTakDir ".env"

function Get-EnvVal([string]$FilePath, [string]$Key) {
    if (Test-Path $FilePath) {
        $m = Select-String -Path $FilePath -Pattern "(?m)^$Key=(.*)$"
        if ($m -and $m.Matches.Count -gt 0) {
            return $m.Matches[0].Groups[1].Value.Trim()
        }
    }
    return ""
}

if ([string]::IsNullOrWhiteSpace($BootstrapToken)) {
    $BootstrapToken = $env:AUTHENTIK_BOOTSTRAP_TOKEN
}
if ([string]::IsNullOrWhiteSpace($BootstrapToken)) {
    $BootstrapToken = Get-EnvVal $EnvIdentity "AUTHENTIK_BOOTSTRAP_TOKEN"
}
if ([string]::IsNullOrWhiteSpace($BootstrapToken)) {
    $BootstrapToken = Get-EnvVal $DotEnv "AUTHENTIK_BOOTSTRAP_TOKEN"
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
    $ClientSecret = $env:OIDC_CLIENT_SECRET
}
if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
    $ClientSecret = Get-EnvVal $EnvIdentity "OIDC_CLIENT_SECRET"
}
if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
    $ClientSecret = Get-EnvVal $DotEnv "OIDC_CLIENT_SECRET"
}

if ([string]::IsNullOrWhiteSpace($BootstrapToken)) {
    Write-Error "Bootstrap token is required. Pass -BootstrapToken, set AUTHENTIK_BOOTSTRAP_TOKEN, or define it in .env.identity"
    exit 1
}

$Headers = @{
    "Authorization" = "Bearer $BootstrapToken"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

$TisckGroups = @(
    "TISCK_INTEL",
    "TISCK_RECON",
    "TISCK_COMMAND",
    "TISCK_ISR",
    "CloudTAKSystemAdmin",
    "CloudTAKAgency1"
)

# 1. Create Initial TISCK Tactical Groups & Admin Groups
Write-Host "Provisioning TISCK operational groups..." -ForegroundColor Cyan
foreach ($group in $TisckGroups) {
    try {
        $res = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/core/groups/?search=$group" -Headers $Headers -Method Get
        $existing = $res.results | Where-Object { $_.name -eq $group }
        if ($existing) {
            Write-Host "  [OK] Group '$group' already exists." -ForegroundColor Green
        } else {
            Write-Host "  [+] Creating group '$group'..." -ForegroundColor Yellow
            $body = @{ name = $group; is_superuser = $false } | ConvertTo-Json
            Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/core/groups/" -Headers $Headers -Method Post -Body $body | Out-Null
        }
    } catch {
        Write-Warning "Failed to check/create group $group`: $_"
    }
}

# 2. Ensure Custom Groups Scope Mapping Exists
Write-Host "Verifying custom 'groups' OAuth2 scope property mapping..." -ForegroundColor Cyan
$MappingPk = ""
try {
    $mappingList = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/propertymappings/provider/scope/?search=groups" -Headers $Headers -Method Get
    $existingMapping = $mappingList.results | Where-Object { $_.name -eq "TISCK Groups Scope" }
    if ($existingMapping) {
        Write-Host "  [OK] 'TISCK Groups Scope' property mapping exists." -ForegroundColor Green
        $MappingPk = $existingMapping.pk
    } else {
        Write-Host "  [+] Creating 'TISCK Groups Scope' property mapping..." -ForegroundColor Yellow
        $mappingBody = @{
            name = "TISCK Groups Scope"
            scope_name = "groups"
            description = "Maps TISCK tactical groups and roles into the OIDC groups claim"
            expression = "return [group.name for group in request.user.ak_groups.all()]"
        } | ConvertTo-Json
        $newMapping = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/propertymappings/provider/scope/" -Headers $Headers -Method Post -Body $mappingBody
        $MappingPk = $newMapping.pk
    }
} catch {
    Write-Warning "Failed to check/create groups scope property mapping: $_"
}

# 3. Retrieve default scope property mappings (openid, profile, email) to include
$PropertyMappings = @()
try {
    $allMappings = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/propertymappings/provider/scope/?page_size=100" -Headers $Headers -Method Get
    foreach ($m in $allMappings.results) {
        if ($m.scope_name -in @("openid", "profile", "email", "groups") -or $m.pk -eq $MappingPk) {
            $PropertyMappings += $m.pk
        }
    }
} catch {
    Write-Warning "Could not fetch property mappings: $_"
    if ($MappingPk) { $PropertyMappings += $MappingPk }
}

# 4. Resolve default authorization and invalidation flow PKs
$AuthFlowPk = ""
$InvalFlowPk = ""
try {
    $flows = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/flows/instances/" -Headers $Headers -Method Get
    $authFlow = $flows.results | Where-Object { $_.slug -eq "default-provider-authorization-implicit-consent" }
    if (-not $authFlow) {
        $authFlow = $flows.results | Where-Object { $_.designation -eq "authorization" } | Select-Object -First 1
    }
    if ($authFlow) { $AuthFlowPk = $authFlow.pk }

    $invalFlow = $flows.results | Where-Object { $_.slug -eq "default-provider-invalidation-flow" }
    if (-not $invalFlow) {
        $invalFlow = $flows.results | Where-Object { $_.designation -eq "invalidation" } | Select-Object -First 1
    }
    if ($invalFlow) { $InvalFlowPk = $invalFlow.pk }
} catch {
    Write-Warning "Failed to query flow instances: $_"
}

# 5. Create or Update CloudTAK OAuth2 Provider
Write-Host "Configuring CloudTAK OAuth2/OIDC Provider..." -ForegroundColor Cyan
$ProviderPk = $null
try {
    $providers = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/providers/oauth2/?search=$ClientId" -Headers $Headers -Method Get
    $existingProvider = $providers.results | Where-Object { $_.client_id -eq $ClientId }
    if ($existingProvider) {
        Write-Host "  [OK] OAuth2 Provider for '$ClientId' already exists." -ForegroundColor Green
        $ProviderPk = $existingProvider.pk
        $updateBody = @{
            name = "CloudTAK"
            client_type = "confidential"
            client_id = $ClientId
            client_secret = $ClientSecret
            redirect_uris = @(@{ matching_mode = "strict"; url = $RedirectUri })
            sub_mode = "user_username"
            include_claims_in_id_token = $true
            issuer_mode = "per_provider"
            property_mappings = $PropertyMappings
            authorization_flow = $AuthFlowPk
            invalidation_flow = $InvalFlowPk
        } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/providers/oauth2/$ProviderPk/" -Headers $Headers -Method Put -Body $updateBody | Out-Null
    } else {
        Write-Host "  [+] Creating OAuth2 Provider for '$ClientId'..." -ForegroundColor Yellow
        $providerBody = @{
            name = "CloudTAK"
            client_type = "confidential"
            client_id = $ClientId
            client_secret = $ClientSecret
            redirect_uris = @(@{ matching_mode = "strict"; url = $RedirectUri })
            sub_mode = "user_username"
            include_claims_in_id_token = $true
            issuer_mode = "per_provider"
            property_mappings = $PropertyMappings
            authorization_flow = $AuthFlowPk
            invalidation_flow = $InvalFlowPk
        } | ConvertTo-Json -Depth 5
        $newProvider = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/providers/oauth2/" -Headers $Headers -Method Post -Body $providerBody
        $ProviderPk = $newProvider.pk
    }
} catch {
    Write-Warning "Failed to create/update OAuth2 Provider: $_"
}

# 6. Attach Provider to CloudTAK Application
Write-Host "Configuring CloudTAK Application..." -ForegroundColor Cyan
try {
    $apps = Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/core/applications/?search=cloudtak" -Headers $Headers -Method Get
    $existingApp = $apps.results | Where-Object { $_.slug -eq "cloudtak" }
    if ($existingApp) {
        Write-Host "  [OK] Application 'cloudtak' already exists." -ForegroundColor Green
        if ($ProviderPk -and $existingApp.provider -ne $ProviderPk) {
            $appBody = @{
                name = "CloudTAK"
                slug = "cloudtak"
                provider = $ProviderPk
            } | ConvertTo-Json
            Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/core/applications/cloudtak/" -Headers $Headers -Method Patch -Body $appBody | Out-Null
        }
    } else {
        Write-Host "  [+] Creating Application 'cloudtak'..." -ForegroundColor Yellow
        $appBody = @{
            name = "CloudTAK"
            slug = "cloudtak"
            provider = $ProviderPk
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$AuthentikUrl/api/v3/core/applications/" -Headers $Headers -Method Post -Body $appBody | Out-Null
    }
} catch {
    Write-Warning "Failed to create/update Application: $_"
}

Write-Host "Authentik bootstrap completed successfully." -ForegroundColor Green
