#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Ejecuta este actualizador como root o con sudo." >&2
  exit 1
fi

APP_ROOT="${CICLOPE_APP_ROOT:-/opt/ciclope-fp}"
CONFIG_FILE="${CICLOPE_CONFIG:-/etc/ciclope-fp/ciclope.env}"
REPO_URL="${CICLOPE_REPO_URL:-https://github.com/atreyu1968/Ciclope.git}"
KEEP_RELEASES="${CICLOPE_KEEP_RELEASES:-5}"

CURRENT="$(readlink -f "$APP_ROOT/current" || true)"
STAMP="$(date +%Y%m%d%H%M%S)"
RELEASE="$APP_ROOT/releases/$STAMP"

echo "1/7 Copia de seguridad previa..."
"$CURRENT/scripts/backup.sh"

echo "2/7 Descargando nueva versión..."
sudo -u ciclope git clone --depth 1 "$REPO_URL" "$RELEASE"

set -a
source "$CONFIG_FILE"
set +a

echo "3/7 Instalando dependencias y generando cliente..."
cd "$RELEASE"
sudo -u ciclope npm ci
sudo -u ciclope -E npm run db:generate

echo "4/7 Compilando antes de tocar la base de datos..."
sudo -u ciclope -E npm run build

echo "5/7 Aplicando migraciones..."
sudo -u ciclope -E npm run db:migrate

echo "6/7 Activando release..."
ln -sfn "$RELEASE" "$APP_ROOT/current"
systemctl restart ciclope-api ciclope-web

if ! "$RELEASE/scripts/healthcheck.sh"; then
  echo "La comprobación ha fallado. Volviendo a la release anterior..." >&2
  if [[ -n "$CURRENT" && -d "$CURRENT" ]]; then
    ln -sfn "$CURRENT" "$APP_ROOT/current"
    systemctl restart ciclope-api ciclope-web
  fi
  exit 1
fi

echo "7/7 Limpiando releases antiguas..."
mapfile -t RELEASES < <(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
for ((i=KEEP_RELEASES; i<${#RELEASES[@]}; i++)); do
  [[ "${RELEASES[$i]}" == "$CURRENT" ]] || rm -rf "${RELEASES[$i]}"
done

echo "CÍCLOPE actualizado correctamente."
