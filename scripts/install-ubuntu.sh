#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Ejecuta este instalador como root o con sudo."
  exit 1
fi

REPO_URL="${CICLOPE_REPO_URL:-https://github.com/atreyu1968/Ciclope.git}"
APP_ROOT="${CICLOPE_APP_ROOT:-/opt/ciclope-fp}"
CONFIG_ROOT="${CICLOPE_CONFIG_ROOT:-/etc/ciclope-fp}"
DATA_ROOT="${CICLOPE_DATA_ROOT:-/var/lib/ciclope-fp}"
PUBLIC_URL="${CICLOPE_PUBLIC_URL:-http://localhost}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y sudo ca-certificates curl git nginx postgresql postgresql-contrib build-essential openssl

# Los servicios systemd ejecutan /usr/bin/npm como usuario ciclope. No basta con
# que Node exista únicamente en el PATH interactivo de root (p. ej. setup-node/nvm).
SYSTEM_NODE_MAJOR=0
if [[ -x /usr/bin/node ]]; then
  SYSTEM_NODE_MAJOR="$(/usr/bin/node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
fi
if [[ "$SYSTEM_NODE_MAJOR" -lt 24 || ! -x /usr/bin/npm ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

# En instalaciones mínimas (incluidos algunos VPS y runners de CI) apt puede
# instalar PostgreSQL y Nginx sin arrancarlos. PostgreSQL debe estar disponible
# antes de crear el rol/base de CÍCLOPE.
systemctl enable --now postgresql
if ! systemctl is-active --quiet postgresql; then
  echo "PostgreSQL no ha podido arrancar tras la instalación." >&2
  exit 1
fi

if ! id ciclope >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/ciclope-fp --shell /usr/sbin/nologin ciclope
fi

mkdir -p "$APP_ROOT/releases" "$CONFIG_ROOT" "$DATA_ROOT/uploads" "$DATA_ROOT/generated" "$DATA_ROOT/backups"
chown -R ciclope:ciclope "$APP_ROOT" "$DATA_ROOT"
chmod 750 "$CONFIG_ROOT"

RELEASE="$APP_ROOT/releases/$(date +%Y%m%d%H%M%S)"
sudo -u ciclope git clone --depth 1 "$REPO_URL" "$RELEASE"
ln -sfn "$RELEASE" "$APP_ROOT/current"

DB_PASSWORD="$(openssl rand -hex 24)"
SESSION_SECRET="$(openssl rand -hex 48)"
INTEGRATIONS_ENCRYPTION_KEY="$(openssl rand -hex 48)"

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ciclope') THEN
    CREATE ROLE ciclope LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE ciclope WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ciclope'" | grep -q 1; then
  sudo -u postgres createdb -O ciclope ciclope
fi

cat > "$CONFIG_ROOT/ciclope.env" <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://ciclope:$DB_PASSWORD@127.0.0.1:5432/ciclope
PORT=4000
WEB_PORT=3000
NEXT_PUBLIC_API_URL=/api
UPLOAD_DIR=$DATA_ROOT/uploads
APP_BASE_URL=$PUBLIC_URL
APP_TIME_ZONE=Atlantic/Canary
SESSION_SECRET=$SESSION_SECRET
INTEGRATIONS_ENCRYPTION_KEY=$INTEGRATIONS_ENCRYPTION_KEY

# Resend y la API de IA se configuran posteriormente desde el panel de administración.
AUTOMATIONS_ENABLED=true
AUTOMATIONS_INTERVAL_MINUTES=60
TASK_REMINDER_DAYS=3
COMMUNICATION_REMINDER_HOURS=24
MILESTONE_REMINDER_DAYS=7
WEEKLY_SUMMARY_WEEKDAY=MON
EVIDENCE_MAX_MB=25
EVIDENCE_ALLOWED_MIME_TYPES=
EOF

chmod 640 "$CONFIG_ROOT/ciclope.env"
chown root:ciclope "$CONFIG_ROOT/ciclope.env"

cd "$APP_ROOT/current"
sudo -u ciclope npm install
set -a
source "$CONFIG_ROOT/ciclope.env"
set +a
sudo -u ciclope -E npm run db:generate
sudo -u ciclope -E npm run db:migrate
sudo -u ciclope -E npm run db:seed
sudo -u ciclope -E npm run build

cp deploy/systemd/ciclope-api.service /etc/systemd/system/
cp deploy/systemd/ciclope-web.service /etc/systemd/system/
cp deploy/nginx/ciclope.conf /etc/nginx/sites-available/ciclope
ln -sfn /etc/nginx/sites-available/ciclope /etc/nginx/sites-enabled/ciclope
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable --now ciclope-api ciclope-web
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# Validación inmediata del estado de los cuatro servicios fundamentales.
for service in ciclope-api ciclope-web nginx postgresql; do
  systemctl is-active --quiet "$service" || {
    echo "La instalación terminó, pero el servicio $service no está activo." >&2
    systemctl --no-pager --full status "$service" || true
    exit 1
  }
done

echo
echo "CÍCLOPE FP instalado."
echo "Frontend: http://IP_DEL_SERVIDOR/"
echo "API:      http://IP_DEL_SERVIDOR/api/health"
echo "Configuración: $CONFIG_ROOT/ciclope.env"
