# ==============================================================================
# Generate Offline TISCK Identity Secrets (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$TargetFile = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CloudTakDir = Split-Path -Parent $ScriptDir

if ([string]::IsNullOrWhiteSpace($TargetFile)) {
    $TargetFile = Join-Path $CloudTakDir ".env.identity"
}

$ExampleFile = Join-Path $CloudTakDir ".env.identity.example"

if (-not (Test-Path $ExampleFile)) {
    Write-Error "Template file not found at $ExampleFile"
    exit 1
}

function Generate-Secret([int]$Length = 64) {
    $bytes = New-Object byte[] ($Length)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $b64 = [Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9_-]', ''
    if ($b64.Length -gt $Length) {
        return $b64.Substring(0, $Length)
    }
    return $b64
}

$SecretKey = Generate-Secret 64
$BootstrapPass = Generate-Secret 32
$BootstrapToken = Generate-Secret 48
$DbPass = Generate-Secret 32
$OidcSecret = Generate-Secret 48

if (Test-Path $TargetFile) {
    Copy-Item $TargetFile "$TargetFile.bak" -Force
    Write-Host "Backed up existing target file to $TargetFile.bak"
}

$content = Get-Content $ExampleFile -Raw
$content = $content.Replace("CHANGE_ME_TO_SECURE_RANDOM_50_CHARS_MINIMUM", $SecretKey)
$content = $content.Replace("CHANGE_ME_TO_SECURE_ADMIN_PASSWORD", $BootstrapPass)
$content = $content.Replace("CHANGE_ME_TO_SECURE_BOOTSTRAP_API_TOKEN", $BootstrapToken)
$content = $content.Replace("CHANGE_ME_TO_AUTHENTIK_DB_PASSWORD", $DbPass)
$content = $content.Replace("CHANGE_ME_TO_OIDC_CLIENT_SECRET", $OidcSecret)

Set-Content -Path $TargetFile -Value $content -Encoding utf8 -NoNewline

Write-Host "Successfully generated offline identity secrets to: $TargetFile"
Write-Host "  - AUTHENTIK_SECRET_KEY: $($SecretKey.Length) characters"
Write-Host "  - AUTHENTIK_BOOTSTRAP_PASSWORD: [GENERATED]"
Write-Host "  - AUTHENTIK_BOOTSTRAP_TOKEN: [GENERATED]"
Write-Host "  - AUTHENTIK_POSTGRESQL__PASSWORD: [GENERATED]"
Write-Host "  - OIDC_CLIENT_SECRET: [GENERATED]"
