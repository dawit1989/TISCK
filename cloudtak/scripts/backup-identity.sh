#!/usr/bin/env bash
# ==============================================================================
# TISCK: Authentik Identity Database Backup and Restore Utility
# ==============================================================================
set -euo pipefail

CONTAINER_NAME="${POSTGIS_CONTAINER:-cloudtak-postgis-1}"
DB_NAME="${AUTHENTIK_DB_NAME:-authentik}"
DB_USER="${AUTHENTIK_DB_USER:-authentik}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/tisck-backups}"

mkdir -p "$BACKUP_DIR"

case "${1:-}" in
  --backup)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${2:-${BACKUP_DIR}/authentik_${TIMESTAMP}.dump}"
    echo "Creating backup of Authentik database '${DB_NAME}'..."
    docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c > "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    ;;
  --restore)
    RESTORE_FILE="${2:-}"
    if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
      echo "Error: Must specify a valid backup file to restore." >&2
      echo "Usage: $0 --restore <path_to_dump_file>" >&2
      exit 1
    fi
    echo "Restoring database '${DB_NAME}' from '$RESTORE_FILE'..."
    docker exec -i "$CONTAINER_NAME" pg_restore -U "$DB_USER" -d "$DB_NAME" -c --if-exists < "$RESTORE_FILE" || true
    echo "Restore completed successfully."
    ;;
  *)
    echo "Usage: $0 [--backup [output_file] | --restore <dump_file>]"
    exit 1
    ;;
esac
