$ErrorActionPreference = "Stop"

$ContainerName = if ($env:GARAGE_CONTAINER) { $env:GARAGE_CONTAINER } else { "cloudtak-store-1" }
$AssetBucket = if ($env:ASSET_BUCKET) { $env:ASSET_BUCKET } else { "cloudtak" }

# Find running store container if standard name not found
$Running = docker ps --format '{{.Names}}'
if ($Running -notcontains $ContainerName) {
    $Match = $Running | Where-Object { $_ -match "store" } | Select-Object -First 1
    if ($Match) { $ContainerName = $Match }
}

Write-Host "Checking Garage container ($ContainerName)..."
docker exec $ContainerName /garage status | Out-Null
Write-Host "Garage daemon is responding."

# 1. Cluster Layout
$Layout = docker exec $ContainerName /garage layout show 2>&1
if ($Layout -match "No layout configuration" -or $Layout -match "NO ROLE ASSIGNED") {
    Write-Host "Configuring single-node Garage layout..."
    $Status = docker exec $ContainerName /garage status 2>&1
    $NodeId = ($Status | Select-String -Pattern '^[0-9a-fA-F]{16,64}').Matches[0].Value.Split()[0]
    if ($NodeId) {
        Write-Host "Assigning node $NodeId to zone local with 100G capacity..."
        docker exec $ContainerName /garage layout assign -z local -c 100G $NodeId
        docker exec $ContainerName /garage layout apply --version 1
        Write-Host "Layout applied successfully."
    }
} else {
    Write-Host "Garage layout already configured."
}

# 2. Key Management
$KeyName = "cloudtak-key"
$Keys = docker exec $ContainerName /garage key list 2>&1
if ($Keys -match $KeyName) {
    Write-Host "Key '$KeyName' already exists."
} else {
    Write-Host "Creating S3 access key '$KeyName'..."
    docker exec $ContainerName /garage key create $KeyName
}

# 3. Bucket Management
$Buckets = docker exec $ContainerName /garage bucket list 2>&1
if ($Buckets -match $AssetBucket) {
    Write-Host "Bucket '$AssetBucket' already exists."
} else {
    Write-Host "Creating bucket '$AssetBucket'..."
    docker exec $ContainerName /garage bucket create $AssetBucket
    docker exec $ContainerName /garage bucket allow $AssetBucket --key $KeyName --read --write
    Write-Host "Bucket '$AssetBucket' created and allowed for '$KeyName'."
}

Write-Host "Garage initialization complete."
