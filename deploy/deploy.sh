#!/usr/bin/env bash
# Run ON the VPS from the repo root: /opt/myheritage
#   chmod +x deploy/deploy.sh && ./deploy/deploy.sh
set -euo pipefail

ROOT="${ROOT:-/opt/myheritage}"
cd "$ROOT"

COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --project-directory "$ROOT")
ENV_FILE="${ENV_FILE:-$ROOT/.env.production}"
WITH_NGINX="${WITH_NGINX:-1}"
# The seed wipes every table first; only pass SEED=1 on a brand-new database.
# It refuses to run in production or when real accounts exist unless SEED_ALLOW_WIPE=yes-wipe-everything.
SEED="${SEED:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy deploy/.env.production.example → .env.production and edit secrets."
  exit 1
fi

# Load compose-compatible KEY=VALUE lines for shell use (password for migrate URL)
set +H
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | sed 's/\r$//')
set +a

PG_USER="${POSTGRES_USER:-heritage}"
PG_PASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env.production}"
PG_DB="${POSTGRES_DB:-heritage}"
MIGRATE_URL="postgresql://${PG_USER}:${PG_PASS}@postgres:5432/${PG_DB}"

echo "==> Building and starting services"
PROFILE_ARGS=()
if [[ "$WITH_NGINX" == "1" ]]; then
  PROFILE_ARGS+=(--profile with-nginx)
fi

"${COMPOSE[@]}" "${PROFILE_ARGS[@]}" --env-file "$ENV_FILE" up -d --build

echo "==> Waiting for Postgres"
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" --env-file "$ENV_FILE" exec -T postgres \
    pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "Postgres did not become ready"
    exit 1
  fi
done

echo "==> Prisma migrate deploy"
"${COMPOSE[@]}" --env-file "$ENV_FILE" run --rm --no-deps \
  -e "DATABASE_URL=${MIGRATE_URL}" \
  api \
  pnpm --filter @myheritage/db exec prisma migrate deploy

if [[ "$SEED" == "1" ]]; then
  echo "==> Seeding database (FD-07)"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" run --rm --no-deps \
    -e "DATABASE_URL=${MIGRATE_URL}" \
    -e "SEED_ALLOW_WIPE=${SEED_ALLOW_WIPE:-}" \
    api \
    pnpm --filter @myheritage/db seed
fi

echo "==> Health check"
curl -fsS "http://127.0.0.1:4000/health" || true
echo

echo "==> Admin SIS smoke (login + live screen + action)"
SMOKE_TOKEN="$(
  curl -fsS -X POST "http://127.0.0.1:4000/auth/login" \
    -H "content-type: application/json" \
    -d '{"email":"admin@heritage.edu","password":"Heritage!2026","deviceFingerprint":"deploy-smoke-device-01"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("accessToken",""))' \
    2>/dev/null || true
)"
if [[ -n "${SMOKE_TOKEN}" ]]; then
  curl -fsS "http://127.0.0.1:4000/admin/sis/screen?path=%2Fadmin%2Ff%2Fpl-01-users-and-roles" \
    -H "authorization: Bearer ${SMOKE_TOKEN}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("live") is True; rows=(d.get("payload") or {}).get("rows") or []; print("OK live users rows=%s source=%s" % (len(rows), d.get("source")))'
  curl -fsS -X POST "http://127.0.0.1:4000/admin/sis/action" \
    -H "authorization: Bearer ${SMOKE_TOKEN}" \
    -H "content-type: application/json" \
    -d '{"path":"/admin/f/pl-06-operations","action":"Deploy smoke ping"}' \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("live") is True; print("OK sis action")'
  if [[ -x deploy/smoke-admin-e2e.sh ]]; then
    API_URL=http://127.0.0.1:4000 WEB_URL=http://127.0.0.1:3000 ./deploy/smoke-admin-e2e.sh || echo "WARN: extended smoke failed"
  fi
  if [[ -x deploy/smoke-advisor-e2e.sh ]]; then
    API_URL=http://127.0.0.1:4000 WEB_URL=http://127.0.0.1:3000 ./deploy/smoke-advisor-e2e.sh || echo "WARN: advisor smoke failed"
  fi
  curl -sS -o /dev/null -X POST "http://127.0.0.1:4000/auth/logout" -H "authorization: Bearer ${SMOKE_TOKEN}" || true
else
  echo "WARN: could not login for SIS smoke (seed may be off)"
fi

echo "Deploy complete."
echo "  Web:  http://46.202.163.202:3000  (or :80 with nginx profile)"
echo "  API:  http://46.202.163.202:4000"
echo "  Docs: http://46.202.163.202:4000/api/docs"
echo "  Admin: http://46.202.163.202:3000/admin"
