#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
RETENTION_DAYS=30
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/quotidy_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump via the Docker container
docker compose --env-file "${ROOT_DIR}/.env.production" \
  -f "${ROOT_DIR}/docker-compose.prod.yml" \
  exec -T db pg_dump -U quotidy quotidy \
  | gzip > "$BACKUP_FILE"

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "quotidy_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup OK: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
