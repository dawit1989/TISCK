# ==============================================================================
# TISCK: Automated Authentik Bootstrap & Tactical Groups Setup (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$AuthentikUrl = "http://127.0.0.1:9000",
    [string]$BootstrapToken = $env:AUTHENTIK_BOOTSTRAP_TOKEN,
    [string]$ClientId = "cloudtak",
    [string]$ClientSecret = "CHANGE_ME_TO_OIDC_CLIENT_SECRET",
    [string]$RedirectUri = "http://localhost:5000/api/login/oidc/callback"
)

if ([string]::IsNullOrWhiteSpace($BootstrapToken)) {
    Write-Error "Bootstrap token is required. Pass -BootstrapToken or set AUTHENTIK_BOOTSTRAP_TOKEN"
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

Write-Host "Authentik bootstrap script completed." -ForegroundColor Green
