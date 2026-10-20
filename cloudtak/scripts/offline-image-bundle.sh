#!/usr/bin/env bash
set -euo pipefail

IMAGES=(
  "ghcr.io/goauthentik/server:2024.12.3"
  "ghcr.io/goauthentik/ldap:2024.12.3"
  "redis:7.4-alpine"
  "postgis/postgis:17-3.4-alpine"
)

ARCHIVE_NAME="${2:-tisck-identity-images-2024.12.3.tar.gz}"

case "${1:-}" in
  --export)
    echo "Pulling pinned identity images..."
    for img in "${IMAGES[@]}"; do
      docker pull "$img"
    done
    echo "Saving images to ${ARCHIVE_NAME}..."
    docker save "${IMAGES[@]}" | gzip -c > "${ARCHIVE_NAME}"
    sha256sum "${ARCHIVE_NAME}" > "${ARCHIVE_NAME}.sha256"
    echo "Export complete: ${ARCHIVE_NAME} ($(du -h "${ARCHIVE_NAME}" | cut -f1))"
    ;;
  --import)
    if [ ! -f "${ARCHIVE_NAME}" ]; then
      echo "Error: Archive file '${ARCHIVE_NAME}' not found." >&2
      exit 1
    fi
    if [ -f "${ARCHIVE_NAME}.sha256" ]; then
      echo "Verifying archive checksum..."
      sha256sum -c "${ARCHIVE_NAME}.sha256"
    fi
    echo "Loading images from ${ARCHIVE_NAME} into local Docker daemon..."
    docker load -i "${ARCHIVE_NAME}"
    echo "Import complete. Available identity images:"
    docker images | grep -E 'authentik|redis' || true
    ;;
  *)
    echo "Usage: $0 [--export | --import] [archive_filename]"
    exit 1
    ;;
esac
