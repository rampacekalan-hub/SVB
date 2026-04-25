#!/bin/bash
#
# DomovPlus deploy skript pre Hetzner VPS (oddelene od Unifyo).
#
# Štruktúra na servery:
#   /opt/domovplus/api/         — NestJS dist + node_modules
#   /opt/domovplus/web/         — Vite dist (statika servovaná nginx-om)
#   /var/lib/domovplus/storage/ — uploady (PDF, fotky)
#   /var/lib/domovplus/.env     — produkčné env premenné
#   /etc/systemd/system/domovplus-api.service
#   /etc/nginx/sites-available/domovplus
#
# Beh:
#   API: PM2 alebo systemd, port 127.0.0.1:3100 (len lokálne)
#   Web: nginx static + reverse proxy /api → 127.0.0.1:3100
#
# Použitie: ./scripts/deploy.sh
# Predpokladá: ssh root@204.168.212.58 funguje cez ssh keys.
#

set -euo pipefail

SERVER="root@204.168.212.58"
REMOTE_API="/opt/domovplus/api"
REMOTE_WEB="/opt/domovplus/web"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

echo "🔨 Building API…"
npm run build:api

echo "🔨 Building web…"
npm run build:web

echo "📦 Uploading API (dist + prisma + package.json)…"
rsync -az --delete \
  --exclude '*.tsbuildinfo' \
  apps/api/dist/ "$SERVER:$REMOTE_API/dist/"
rsync -az --delete apps/api/prisma/ "$SERVER:$REMOTE_API/prisma/"
rsync -az apps/api/package.json apps/api/package-lock.json "$SERVER:$REMOTE_API/" 2>/dev/null || rsync -az apps/api/package.json "$SERVER:$REMOTE_API/"

echo "📦 Uploading web (static dist)…"
rsync -az --delete apps/web/dist/ "$SERVER:$REMOTE_WEB/"

echo "📦 Installing API production deps + running prisma migrate…"
ssh "$SERVER" bash <<'REMOTE'
set -euo pipefail
cd /opt/domovplus/api
# Install runtime deps (rspc/Prisma etc)
npm install --omit=dev --no-audit --no-fund --silent

# Generate Prisma client + run migrations
DATABASE_URL=$(grep '^DATABASE_URL=' /var/lib/domovplus/.env | cut -d= -f2- | tr -d '"')
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL" npx prisma generate

# Restart service
if systemctl is-enabled domovplus-api.service >/dev/null 2>&1; then
  systemctl restart domovplus-api.service
  echo "✓ domovplus-api restarted"
else
  echo "⚠ systemd unit not yet enabled — run setup first"
fi

# nginx reload (web static sa servuje, žiadny restart netreba — len cache invalidation by sa hodila)
nginx -t && systemctl reload nginx
REMOTE

echo ""
echo "✅ Deploy done."
echo "   Api log: ssh $SERVER 'journalctl -u domovplus-api -f'"
echo "   Web URL: http://204.168.212.58:8080"
