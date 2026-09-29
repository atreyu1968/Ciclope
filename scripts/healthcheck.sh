#!/usr/bin/env bash
set -euo pipefail

API_URL="${CICLOPE_API_HEALTH_URL:-http://127.0.0.1:4000/health}"
WEB_URL="${CICLOPE_WEB_HEALTH_URL:-http://127.0.0.1:3000/}"

for service in ciclope-api ciclope-web nginx postgresql; do
  systemctl is-active --quiet "$service" || { echo "Servicio no activo: $service" >&2; exit 1; }
done

curl --fail --silent --show-error --max-time 10 "$API_URL" >/dev/null
curl --fail --silent --show-error --max-time 10 "$WEB_URL" >/dev/null

echo "Healthcheck correcto."
