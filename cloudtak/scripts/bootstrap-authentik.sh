#!/usr/bin/env bash
# ==============================================================================
# TISCK: Automated Authentik Bootstrap & Tactical Groups Setup
# ==============================================================================
set -euo pipefail

AUTHENTIK_URL="${AUTHENTIK_URL:-http://127.0.0.1:9000}"
BOOTSTRAP_TOKEN="${AUTHENTIK_BOOTSTRAP_TOKEN:-${1:-}}"
CLIENT_ID="${OIDC_CLIENT_ID:-cloudtak}"
CLIENT_SECRET="${OIDC_CLIENT_SECRET:-${2:-CHANGE_ME_TO_OIDC_CLIENT_SECRET}}"
REDIRECT_URI="${OIDC_REDIRECT_URI:-http://localhost:5000/api/login/oidc/callback}"

if [ -z "$BOOTSTRAP_TOKEN" ]; then
    echo "Usage: $0 <AUTHENTIK_BOOTSTRAP_TOKEN> [OIDC_CLIENT_SECRET]" >&2
    echo "Or export AUTHENTIK_BOOTSTRAP_TOKEN and OIDC_CLIENT_SECRET environment variables." >&2
    exit 1
fi

echo "Connecting to Authentik API at ${AUTHENTIK_URL}..."

HEADERS=(
    -H "Authorization: Bearer ${BOOTSTRAP_TOKEN}"
    -H "Content-Type: application/json"
    -H "Accept: application/json"
)

# 1. Create Initial TISCK Tactical Groups & Admin Groups
TISCK_GROUPS=(
    "TISCK_INTEL"
    "TISCK_RECON"
    "TISCK_COMMAND"
    "TISCK_ISR"
    "CloudTAKSystemAdmin"
    "CloudTAKAgency1"
)

echo "Provisioning TISCK operational groups..."
for group in "${TISCK_GROUPS[@]}"; do
    EXISTING=$(curl -s -k "${HEADERS[@]}" "${AUTHENTIK_URL}/api/v3/core/groups/?search=${group}")
    if echo "$EXISTING" | grep -q "\"name\":\"${group}\""; then
        echo "  [OK] Group '${group}' already exists."
    else
        echo "  [+] Creating group '${group}'..."
        curl -s -k -X POST "${HEADERS[@]}" \
            -d "{\"name\":\"${group}\",\"is_superuser\":false}" \
            "${AUTHENTIK_URL}/api/v3/core/groups/" > /dev/null
    fi
done

# 2. Ensure Custom Groups Scope Mapping Exists
echo "Verifying custom 'groups' OAuth2 scope property mapping..."
MAPPING_LIST=$(curl -s -k "${HEADERS[@]}" "${AUTHENTIK_URL}/api/v3/property-mappings/provider/oauth2/?search=groups")
MAPPING_PK=""

if echo "$MAPPING_LIST" | grep -q "\"name\":\"TISCK Groups Scope\""; then
    echo "  [OK] 'TISCK Groups Scope' property mapping exists."
    MAPPING_PK=$(echo "$MAPPING_LIST" | grep -o '"pk":"[^"]*"' | head -n 1 | cut -d'"' -f4)
else
    echo "  [+] Creating 'TISCK Groups Scope' property mapping..."
    MAPPING_RESP=$(curl -s -k -X POST "${HEADERS[@]}" \
        -d '{
            "name": "TISCK Groups Scope",
            "scope_name": "groups",
            "description": "Maps TISCK tactical groups and roles into the OIDC groups claim",
            "expression": "return [group.name for group in request.user.ak_groups.all()]"
        }' \
        "${AUTHENTIK_URL}/api/v3/property-mappings/provider/oauth2/")
    MAPPING_PK=$(echo "$MAPPING_RESP" | grep -o '"pk":"[^"]*"' | head -n 1 | cut -d'"' -f4 || true)
fi

# 3. Create or Update CloudTAK OAuth2 Provider
echo "Configuring CloudTAK OAuth2/OIDC Provider..."
PROVIDERS=$(curl -s -k "${HEADERS[@]}" "${AUTHENTIK_URL}/api/v3/providers/oauth2/?search=${CLIENT_ID}")
PROVIDER_PK=""

if echo "$PROVIDERS" | grep -q "\"client_id\":\"${CLIENT_ID}\""; then
    echo "  [OK] OAuth2 Provider for '${CLIENT_ID}' already exists."
    PROVIDER_PK=$(echo "$PROVIDERS" | grep -o '"pk":[0-9]*' | head -n 1 | cut -d':' -f2)
else
    echo "  [+] Creating OAuth2 Provider for '${CLIENT_ID}'..."
    PROVIDER_RESP=$(curl -s -k -X POST "${HEADERS[@]}" \
        -d "{
            \"name\": \"CloudTAK\",
            \"client_type\": \"confidential\",
            \"client_id\": \"${CLIENT_ID}\",
            \"client_secret\": \"${CLIENT_SECRET}\",
            \"redirect_uris\": \"${REDIRECT_URI}\",
            \"sub_mode\": \"user_username\",
            \"include_claims_in_id_token\": true,
            \"issuer_mode\": \"per_provider\"
        }" \
        "${AUTHENTIK_URL}/api/v3/providers/oauth2/")
    PROVIDER_PK=$(echo "$PROVIDER_RESP" | grep -o '"pk":[0-9]*' | head -n 1 | cut -d':' -f2 || true)
fi

# 4. Attach Provider to CloudTAK Application
echo "Configuring CloudTAK Application..."
APPS=$(curl -s -k "${HEADERS[@]}" "${AUTHENTIK_URL}/api/v3/core/applications/?search=cloudtak")

if echo "$APPS" | grep -q "\"slug\":\"cloudtak\""; then
    echo "  [OK] Application 'cloudtak' already exists."
else
    echo "  [+] Creating Application 'cloudtak'..."
    curl -s -k -X POST "${HEADERS[@]}" \
        -d "{
            \"name\": \"CloudTAK\",
            \"slug\": \"cloudtak\",
            \"provider\": ${PROVIDER_PK}
        }" \
        "${AUTHENTIK_URL}/api/v3/core/applications/" > /dev/null
fi

echo "Authentik bootstrap completed successfully."
