#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Ejecuta la restauración como root o con sudo." >&2
  exit 1
fi

BACKUP="${1:-}"
CONFIG_FILE="${CICLOPE_CONFIG:-/etc/ciclope-fp/ciclope.env}"
DATA_ROOT="${CICLOPE_DATA_ROOT:-/var/lib/ciclope-fp}"

if [[ -z "$BACKUP" || ! -f "$BACKUP/database.dump" ]]; then
  echo "Uso: sudo $0 /var/lib/ciclope-fp/backups/AAAAMMDD-HHMMSS" >&2
  exit 1
fi

set -a
source "$CONFIG_FILE"
set +a

echo "Deteniendo CÍCLOPE..."
systemctl stop ciclope-api ciclope-web

rollback() {
  systemctl start ciclope-api ciclope-web || true
}
trap rollback EXIT

echo "Restaurando PostgreSQL..."
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$BACKUP/database.dump"

if [[ -f "$BACKUP/uploads.tar.gz" ]]; then
  echo "Restaurando ficheros..."
  rm -rf "$DATA_ROOT/uploads"
  tar -C "$DATA_ROOT" -xzf "$BACKUP/uploads.tar.gz"
  chown -R ciclope:ciclope "$DATA_ROOT/uploads"
fi

systemctl start ciclope-api ciclope-web
trap - EXIT

echo "Restauración completada."
