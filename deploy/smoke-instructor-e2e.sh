#!/usr/bin/env bash
# Instructor handoff smoke — run on VPS after deploy.
#   API_URL=http://127.0.0.1:4000 WEB_URL=http://127.0.0.1:3000 ./deploy/smoke-instructor-e2e.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
EMAIL="${INSTRUCTOR_EMAIL:-vance.instructor@heritage.edu}"
PASSWORD="${INSTRUCTOR_PASSWORD:-Heritage!2026}"

echo "==> API health"
curl -fsS "$API_URL/health" | grep -q '"ok":true'
echo OK

echo "==> Instructor login"
TOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceFingerprint\":\"instructor-smoke-device-01\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
)"
echo OK

PATHS=(
  "/instructor"
  "/instructor/sections"
  "/instructor/attendance"
  "/instructor/calendar"
  "/instructor/f/t10-assessments-gradebook"
  "/instructor/f/t23-course-announcements"
  "/instructor/f/t53-master-scheduling"
  "/instructor/lectures"
  "/instructor/messages"
  "/instructor/roster"
)

echo "==> Live instructor SIS screens (${#PATHS[@]})"
for path in "${PATHS[@]}"; do
  enc="$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$path''', safe=''))")"
  curl -fsS "$API_URL/instructor/sis/screen?path=$enc" \
    -H "authorization: Bearer $TOKEN" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print(" ", d["path"], d["source"])'
done

echo "==> Schedule lecture"
curl -fsS -X POST "$API_URL/instructor/sis/action" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/instructor/lectures","action":"Schedule Lecture"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print("OK", d.get("message"))'

echo "==> Attendance finalize"
curl -fsS -X POST "$API_URL/instructor/sis/action" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/instructor/attendance","action":"Submit & Finalize Session"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print("OK", d.get("message"))'

echo "==> Announcement"
curl -fsS -X POST "$API_URL/instructor/sis/action" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/instructor/announcements","action":"New Announcement","rowKey":"Smoke test notice"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True; print("OK", d.get("message"))'

echo "==> Web instructor home"
code="$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/instructor")"
[[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] || { echo "web status $code"; exit 1; }
echo OK "$code"

echo
echo "Instructor E2E smoke passed."
