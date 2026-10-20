# ==============================================================================
# TISCK: Offline Image Bundle Script (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Export", "Import")]
    [string]$Mode,

    [string]$Archive = "tisck-identity-images-2024.12.3.tar"
)

$Images = @(
    "ghcr.io/goauthentik/server:2024.12.3",
    "ghcr.io/goauthentik/ldap:2024.12.3",
    "redis:7.4-alpine",
    "postgis/postgis:17-3.4-alpine"
)

if ($Mode -eq "Export") {
    Write-Host "Pulling pinned identity images..." -ForegroundColor Cyan
    foreach ($img in $Images) {
        docker pull $img
    }
    Write-Host "Saving images to $Archive..." -ForegroundColor Cyan
    docker save -o $Archive $Images
    Write-Host "Export completed: $Archive" -ForegroundColor Green
}
elseif ($Mode -eq "Import") {
    if (-not (Test-Path $Archive)) {
        Write-Error "Archive file not found: $Archive"
        exit 1
    }
    Write-Host "Loading images from $Archive into Docker daemon..." -ForegroundColor Cyan
    docker load -i $Archive
    Write-Host "Import completed." -ForegroundColor Green
    docker images | Select-String -Pattern "authentik|redis"
}
