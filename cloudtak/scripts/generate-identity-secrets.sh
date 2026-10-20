#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDTAK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_FILE="${1:-${CLOUDTAK_DIR}/.env.identity}"
EXAMPLE_FILE="${CLOUDTAK_DIR}/.env.identity.example"

echo "Generating offline TISCK identity secrets..."

generate_secret() {
    local length="${1:-64}"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 96 | tr -dc 'a-zA-Z0-9_-' | head -c "$length"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import secrets; print(secrets.token_urlsafe($length)[:$length])"
    else
        head -c 128 /dev/urandom | tr -dc 'a-zA-Z0-9_-' | head -c "$length"
    fi
}

SECRET_KEY=$(generate_secret 64)
BOOTSTRAP_PASS=$(generate_secret 32)
BOOTSTRAP_TOKEN=$(generate_secret 48)
DB_PASS=$(generate_secret 32)
OIDC_SECRET=$(generate_secret 48)

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo "Error: Template file $EXAMPLE_FILE not found!" >&2
    exit 1
fi

if [ -f "$TARGET_FILE" ]; then
    echo "Target file $TARGET_FILE already exists. Creating backup at ${TARGET_FILE}.bak..."
    cp "$TARGET_FILE" "${TARGET_FILE}.bak"
fi

sed -e "s|CHANGE_ME_TO_SECURE_RANDOM_50_CHARS_MINIMUM|${SECRET_KEY}|g" \
    -e "s|CHANGE_ME_TO_SECURE_ADMIN_PASSWORD|${BOOTSTRAP_PASS}|g" \
    -e "s|CHANGE_ME_TO_SECURE_BOOTSTRAP_API_TOKEN|${BOOTSTRAP_TOKEN}|g" \
    -e "s|CHANGE_ME_TO_AUTHENTIK_DB_PASSWORD|${DB_PASS}|g" \
    -e "s|CHANGE_ME_TO_OIDC_CLIENT_SECRET|${OIDC_SECRET}|g" \
    "$EXAMPLE_FILE" > "$TARGET_FILE"

chmod 600 "$TARGET_FILE" || true

echo "Successfully wrote offline identity secrets to: $TARGET_FILE"
echo "  - AUTHENTIK_SECRET_KEY: ${#SECRET_KEY} characters"
echo "  - AUTHENTIK_BOOTSTRAP_PASSWORD: [GENERATED]"
echo "  - AUTHENTIK_BOOTSTRAP_TOKEN: [GENERATED]"
echo "  - AUTHENTIK_POSTGRESQL__PASSWORD: [GENERATED]"
echo "  - OIDC_CLIENT_SECRET: [GENERATED]"
