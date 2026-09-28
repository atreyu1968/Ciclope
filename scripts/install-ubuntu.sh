#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Ejecuta este instalador como root o con sudo."
  exit 1
fi

REPO_URL="https://github.com/atreyu1968/Ciclope.git"
APP_ROOT="/opt/ciclope-fp"
CONFIG_ROOT="/etc/ciclope-fp"
DATA_ROOT="/var/lib/ciclope-fp"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx postgresql postgresql-contrib build-essential openssl

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
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
APP_BASE_URL=http://localhost
SESSION_SECRET=$SESSION_SECRET
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
systemctl reload nginx

echo
echo "CÍCLOPE FP instalado."
echo "Frontend: http://IP_DEL_SERVIDOR/"
echo "API:      http://IP_DEL_SERVIDOR/api/health"
echo "Configuración: $CONFIG_ROOT/ciclope.env"
