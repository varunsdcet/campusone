#!/usr/bin/env bash
# Client handoff smoke — run on VPS after deploy (or against a reachable API).
#   API_URL=http://127.0.0.1:4000 WEB_URL=http://127.0.0.1:3000 ./deploy/smoke-admin-e2e.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"

echo "==> API health"
curl -fsS "$API_URL/health" | grep -q '"ok":true'
echo OK

echo "==> Web home"
code="$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/")"
[[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] || { echo "web status $code"; exit 1; }
echo OK "$code"

echo "==> Admin login"
TOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceFingerprint\":\"deploy-smoke-device-01\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
)"
# Sign out at the end so the smoke login does not push a real admin past the concurrent-session limit.
trap 'curl -sS -o /dev/null -X POST "$API_URL/auth/logout" -H "authorization: Bearer $TOKEN" || true' EXIT
echo OK

PATHS=(
  "/admin/f/pl-01-users-and-roles"
  "/admin/f/ac-09-sections"
  "/admin/f/ac-06-course-catalogue"
  "/admin/f/rg-00-registrar-dashboard"
  "/admin/f/ad-02-application-queue"
  "/admin/f/lb-01-lab-dashboard"
  "/admin/f/cp-01-compliance-dashboard"
  "/admin/f/fn-01-finance-dashboard"
)

echo "==> Live SIS screens (${#PATHS[@]})"
for path in "${PATHS[@]}"; do
  enc="$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$path''', safe=''))")"
  curl -fsS "$API_URL/admin/sis/screen?path=$enc" \
    -H "authorization: Bearer $TOKEN" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print(" ", d["path"], d["source"])'
done

echo "==> Mutation"
curl -fsS -X POST "$API_URL/admin/sis/action" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/admin/f/ad-02-application-queue","action":"Client smoke approve"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print("OK action")'

echo "==> Domain CRUD surfaces"
curl -fsS "$API_URL/admin/users" -H "authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert len(d["items"])>=1; print("OK users", len(d["items"]))'
curl -fsS "$API_URL/admin/sections" -H "authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert len(d["items"])>=1; print("OK sections", len(d["items"]))'

echo
echo "Client E2E smoke passed."
