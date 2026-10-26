#!/usr/bin/env bash
# Sync repo to VPS and rebuild API only (web image left untouched).
# Usage:
#   ./deploy/sync-api-only-vps.sh [user@host]
set -euo pipefail

HOST="${1:-root@46.202.163.202}"
ROOT_REMOTE="${ROOT_REMOTE:-/opt/myheritage}"
LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_REMOTE/.env.production}"

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

echo "==> rebuild API only (SEED=0, web unchanged)"
ssh "${HOST}" bash -s <<EOF
set -euo pipefail
cd ${ROOT_REMOTE}
COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --project-directory ${ROOT_REMOTE})
"\${COMPOSE[@]}" --env-file ${ENV_FILE} up -d --build --no-deps api
curl -fsS "http://127.0.0.1:4000/health" || true
echo
EOF

echo "==> health"
curl -fsS "http://46.202.163.202:4000/health" || true
echo
curl -fsS "http://46.202.163.202:3000/__api/health" || true
echo
echo "API-only sync complete. Web container was not rebuilt."
echo "VPS API:  http://46.202.163.202:4000"
echo "VPS web:  http://46.202.163.202:3000  (previous frontend build)"
