#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTAINER_NAME="${GARAGE_CONTAINER:-cloudtak-store-1}"
ASSET_BUCKET="${ASSET_BUCKET:-cloudtak}"

# Resolve container name if using standard compose naming
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  FOUND=$(docker ps --format '{{.Names}}' | grep "store" | head -n 1 || true)
  if [ -n "$FOUND" ]; then
    CONTAINER_NAME="$FOUND"
  fi
fi

echo "Checking Garage container (${CONTAINER_NAME})..."
docker exec "${CONTAINER_NAME}" /garage status > /dev/null 2>&1
echo "Garage daemon is responding."

# 1. Check layout and assign if needed
LAYOUT_SHOW=$(docker exec "${CONTAINER_NAME}" /garage layout show 2>&1 || true)
if echo "$LAYOUT_SHOW" | grep -q "No nodes currently have a role" || echo "$LAYOUT_SHOW" | grep -q "No layout configuration" || echo "$LAYOUT_SHOW" | grep -q "NO ROLE ASSIGNED"; then
  echo "Configuring single-node Garage layout..."
  NODE_ID=$(docker exec "${CONTAINER_NAME}" /garage status 2>&1 | grep -E '^[0-9a-fA-F]{16,64}' | head -n 1 | awk '{print $1}')
  
  if [ -n "$NODE_ID" ]; then
    echo "Assigning node $NODE_ID to zone local with 100G capacity..."
    docker exec "${CONTAINER_NAME}" /garage layout assign -z local -c 100G "$NODE_ID"
    docker exec "${CONTAINER_NAME}" /garage layout apply --version 1
    echo "Layout applied successfully."
  fi
else
  echo "Garage layout already configured."
fi

# 2. Key management
KEY_NAME="cloudtak-key"
if docker exec "${CONTAINER_NAME}" /garage key list 2>&1 | grep -q "$KEY_NAME"; then
  echo "Key '$KEY_NAME' already exists."
else
  echo "Creating S3 access key '$KEY_NAME'..."
  KEY_OUTPUT=$(docker exec "${CONTAINER_NAME}" /garage key create "$KEY_NAME" 2>&1)
  KEY_ID=$(echo "$KEY_OUTPUT" | grep "Key ID:" | awk '{print $3}')
  SECRET_KEY=$(echo "$KEY_OUTPUT" | grep "Secret key:" | awk '{print $3}')
  echo "Created Key ID: $KEY_ID"
fi

# 3. Create required ASSET_BUCKET
EXISTING_BUCKETS=$(docker exec "${CONTAINER_NAME}" /garage bucket list 2>&1)
if echo "$EXISTING_BUCKETS" | grep -q "$ASSET_BUCKET"; then
  echo "Bucket '$ASSET_BUCKET' already exists."
else
  echo "Creating bucket '$ASSET_BUCKET'..."
  docker exec "${CONTAINER_NAME}" /garage bucket create "$ASSET_BUCKET" > /dev/null 2>&1 || true
  docker exec "${CONTAINER_NAME}" /garage bucket allow "$ASSET_BUCKET" --key "$KEY_NAME" --read --write > /dev/null 2>&1 || true
  echo "Bucket '$ASSET_BUCKET' created and permitted for '$KEY_NAME'."
fi

echo "Garage initialization complete."
