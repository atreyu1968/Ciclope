#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CICLOPE_CONFIG:-/etc/ciclope-fp/ciclope.env}"
DATA_ROOT="${CICLOPE_DATA_ROOT:-/var/lib/ciclope-fp}"
BACKUP_ROOT="${CICLOPE_BACKUP_ROOT:-$DATA_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "No se puede leer $CONFIG_FILE" >&2
  exit 1
fi

set -a
source "$CONFIG_FILE"
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_ROOT/$STAMP"
mkdir -p "$TARGET"

echo "Creando copia PostgreSQL..."
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$TARGET/database.dump"

echo "Copiando ficheros persistentes..."
if [[ -d "$DATA_ROOT/uploads" ]]; then
  tar -C "$DATA_ROOT" -czf "$TARGET/uploads.tar.gz" uploads
fi

cp "$CONFIG_FILE" "$TARGET/ciclope.env"
chmod 600 "$TARGET/ciclope.env"

cat > "$TARGET/manifest.txt" <<EOF
created_at=$(date --iso-8601=seconds)
host=$(hostname)
database=database.dump
uploads=uploads.tar.gz
EOF

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup completado: $TARGET"
