#!/usr/bin/env bash
# Smoke Student Advisor + degree progress on a running stack.
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
EMAIL="${EMAIL:-marcus.vance@heritage.edu}"
PASSWORD="${PASSWORD:-Heritage!2026}"

echo "==> Web degree page"
curl -fsS -o /dev/null -w "degree page HTTP %{http_code}\n" "$WEB_URL/student/degree"

echo "==> Student login"
TOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceFingerprint\":\"advisor-smoke-device-01\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
)"
trap 'curl -sS -o /dev/null -X POST "$API_URL/auth/logout" -H "authorization: Bearer $TOKEN" || true' EXIT
echo OK

echo "==> Degree progress"
curl -fsS "$API_URL/student/degree-progress" \
  -H "authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("programCode"), d; print("OK program=%s remaining=%s projected=%s" % (d.get("programCode"), d.get("remainingCredits"), d.get("projectedCompletionTerm")))'

echo "==> What-if drop MATH210"
curl -fsS -X POST "$API_URL/student/degree-scenarios" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"dropCourseCodes":["MATH210"],"save":false}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("impactSummary"), d; print("OK impact=%s" % d["impactSummary"][0][:80])'

echo "==> Ask Heritage advisor"
curl -fsS -X POST "$API_URL/ai/ask" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -H "idempotency-key: advisor-smoke-$(date +%s)" \
  -d '{"question":"Can I graduate next summer?","contextPath":"/student/ask","capability":"student_advisor"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("capability")=="student_advisor", d; assert d.get("analysis"), d; assert d.get("sources"), d; print("OK capability=%s analysis.program=%s" % (d["capability"], d["analysis"].get("programCode")))'

echo "==> Ask Heritage what-if drop"
curl -fsS -X POST "$API_URL/ai/ask" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -H "idempotency-key: advisor-drop-smoke-$(date +%s)" \
  -d '{"question":"What happens if I drop MATH210?","contextPath":"/student/ask"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("capability")=="student_advisor", d; assert "MATH210" in d.get("answer",""), d; print("OK drop answer cites MATH210")'

echo "Advisor E2E smoke passed."
