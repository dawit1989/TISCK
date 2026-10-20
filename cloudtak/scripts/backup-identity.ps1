# ==============================================================================
# TISCK: Authentik Identity Database Backup and Restore Utility (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Backup", "Restore")]
    [string]$Action,

    [string]$File = "",
    [string]$Container = "cloudtak-postgis-1",
    [string]$Database = "authentik",
    [string]$User = "authentik"
)

if ($Action -eq "Backup") {
    if ([string]::IsNullOrWhiteSpace($File)) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $File = Join-Path $env:TEMP "authentik_$timestamp.dump"
    }
    Write-Host "Creating backup of database '$Database' from container '$Container'..." -ForegroundColor Cyan
    docker exec $Container pg_dump -U $User -d $Database -F c -f "/tmp/backup.dump"
    docker cp "$($Container):/tmp/backup.dump" $File
    docker exec $Container rm -f "/tmp/backup.dump"
    $fileInfo = Get-Item $File
    Write-Host "Backup completed successfully: $File ($($fileInfo.Length) bytes)" -ForegroundColor Green
}
elseif ($Action -eq "Restore") {
    if ([string]::IsNullOrWhiteSpace($File) -or (-not (Test-Path $File))) {
        Write-Error "Valid backup file must be provided for restore."
        exit 1
    }
    Write-Host "Restoring database '$Database' from '$File'..." -ForegroundColor Cyan
    docker cp $File "$($Container):/tmp/restore.dump"
    docker exec $Container pg_restore -U $User -d $Database -c --if-exists "/tmp/restore.dump"
    docker exec $Container rm -f "/tmp/restore.dump"
    Write-Host "Restore completed successfully." -ForegroundColor Green
}
