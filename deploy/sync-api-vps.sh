#!/usr/bin/env bash
# Sync this repo to the VPS and rebuild API + web.
# Usage from laptop:
#   ./deploy/sync-api-vps.sh [user@host]
set -euo pipefail

HOST="${1:-root@46.202.163.202}"
ROOT_REMOTE="${ROOT_REMOTE:-/opt/myheritage}"
LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> rsync → ${HOST}:${ROOT_REMOTE}"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '*.log' \
  --exclude .venv \
  --exclude __pycache__ \
  --exclude '/.tmp/' \
  --exclude '.env.local' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude 'var/uploads/' \
  --filter 'P .env.production' \
  --filter 'P var/uploads/' \
  "${LOCAL_ROOT}/" "${HOST}:${ROOT_REMOTE}/"

echo "==> migrate + rebuild API and web (SEED=0)"
ssh "${HOST}" "cd ${ROOT_REMOTE} && SEED=0 WITH_NGINX=\${WITH_NGINX:-0} ./deploy/deploy.sh"

echo "==> health"
curl -fsS "http://46.202.163.202:4000/health" || true
echo
curl -fsS "http://46.202.163.202:3000/__api/health" || true
echo
echo "VPS web:  http://46.202.163.202:3000  (same-origin /__api → live API)"
echo "VPS API:  http://46.202.163.202:4000"
echo "Local UI: apps/web/.env.local → NEXT_PUBLIC_API_URL=http://46.202.163.202:4000"
