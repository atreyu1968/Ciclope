#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CICLOPE_CONFIG:-/etc/ciclope-fp/ciclope.env}"
DATA_ROOT="${CICLOPE_DATA_ROOT:-/var/lib/ciclope-fp}"
DELETE=false

if [[ "${1:-}" == "--delete" ]]; then
  DELETE=true
fi

if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "No se puede leer $CONFIG_FILE" >&2
  exit 1
fi

set -a
source "$CONFIG_FILE"
set +a

UPLOAD_ROOT="${UPLOAD_DIR:-$DATA_ROOT/uploads}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

psql "$DATABASE_URL" -Atc 'SELECT "path" FROM "Evidence" WHERE "path" IS NOT NULL' > "$TMP"

count=0
while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  if ! grep -Fxq "$file" "$TMP"; then
    count=$((count + 1))
    if $DELETE; then
      rm -f -- "$file"
      echo "ELIMINADO $file"
    else
      echo "HUÉRFANO $file"
    fi
  fi
done < <(find "$UPLOAD_ROOT" -type f -mtime +1 -print 2>/dev/null)

echo "Archivos huérfanos detectados: $count"
if ! $DELETE && (( count > 0 )); then
  echo "Ejecuta de nuevo con --delete para eliminarlos tras revisar el listado."
fi
