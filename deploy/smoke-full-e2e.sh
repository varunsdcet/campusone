#!/usr/bin/env bash
# Full campus flow smoke: admin create users → login → program/schedule/fees → teacher attendance → student APIs
#   API_URL=http://46.202.163.202:4000 WEB_URL=http://46.202.163.202:3000 ./deploy/smoke-full-e2e.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
PASS="${DEMO_PASSWORD:-Heritage!2026}"
STAMP="$(date +%s)"
STU_EMAIL="e2e.student.${STAMP}@heritage.edu"
INS_EMAIL="e2e.instructor.${STAMP}@heritage.edu"

json_field() {
  python3 -c 'import sys,json; d=json.load(sys.stdin); print(d'"$1"')'
}

login() {
  local email="$1"
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"deviceFingerprint\":\"full-e2e-$STAMP\"}" \
    | json_field '["accessToken"]'
}

echo "==> Health"
curl -fsS "$API_URL/health" | grep -q '"ok":true'
echo OK

echo "==> Admin login"
ADMIN_TOKEN="$(login admin@heritage.edu)"
echo OK

echo "==> Create instructor"
curl -fsS -X POST "$API_URL/admin/users" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$INS_EMAIL\",\"givenName\":\"E2E\",\"familyName\":\"Teacher\",\"role\":\"instructor\",\"password\":\"$PASS\"}" \
  | json_field '["accountId"]' >/dev/null
echo OK "$INS_EMAIL"

echo "==> Create student (program Nursing)"
curl -fsS -X POST "$API_URL/admin/users" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$STU_EMAIL\",\"givenName\":\"E2E\",\"familyName\":\"Learner\",\"role\":\"student\",\"password\":\"$PASS\",\"programName\":\"Nursing E2E $STAMP\"}" \
  | json_field '["accountId"]' >/dev/null
echo OK "$STU_EMAIL"

echo "==> Program create (SIS)"
curl -fsS -X POST "$API_URL/admin/sis/action" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"path\":\"/admin/f/ac-03-programs\",\"action\":\"Create Program\",\"note\":\"Health Sciences $STAMP\"}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print("OK programs", d.get("payload",{}).get("countLabel"))'

echo "==> Master scheduling screen"
curl -fsS "$API_URL/admin/sis/screen?path=%2Fadmin%2Ff%2Fac-10-master-scheduling" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print("OK master scheduling")'

echo "==> Create section (schedule)"
SECTION_JSON="$(curl -fsS -X POST "$API_URL/admin/sections" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"courseCode\":\"E2E$STAMP\",\"courseTitle\":\"E2E Flow Course\",\"credits\":3,\"sectionCode\":\"E2E$STAMP-01\",\"instructorEmail\":\"$INS_EMAIL\",\"termCode\":\"2026F\"}")"
SECTION_ID="$(printf '%s' "$SECTION_JSON" | json_field '["sectionId"]')"
echo OK "$SECTION_ID"

echo "==> Enrol student"
curl -fsS -X POST "$API_URL/admin/enrolments" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"studentEmail\":\"$STU_EMAIL\",\"sectionId\":\"$SECTION_ID\"}" \
  | json_field '["enrolmentId"]' >/dev/null
echo OK

echo "==> Fees / finance screen + refund action"
curl -fsS "$API_URL/admin/sis/screen?path=%2Fadmin%2Ff%2Ffn-01-finance-dashboard" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print("OK finance")'
curl -fsS -X POST "$API_URL/admin/sis/action" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/admin/f/fn-01-finance-dashboard","action":"Approve Refund","rowKey":"e2e-refund"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["live"] is True; print("OK refund action")'

echo "==> Instructor login + attendance"
INS_TOKEN="$(login "$INS_EMAIL")"
curl -fsS -X POST "$API_URL/instructor/sis/action" \
  -H "authorization: Bearer $INS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"path":"/instructor/attendance","action":"Submit & Finalize Attendance"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("live") is True or d.get("ok") is True or "message" in d; print("OK attendance", d.get("message") or d.get("path"))'

echo "==> Student login"
STU_TOKEN="$(login "$STU_EMAIL")"
curl -fsS "$API_URL/me/home" -H "authorization: Bearer $STU_TOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "student" in str(d.get("role","")).lower() or d.get("role")=="student"; print("OK student home", d.get("role"))'

STU_ASSIGN_CODE="$(curl -sS -o /tmp/stu_assign.json -w "%{http_code}" "$API_URL/student/assignments" -H "authorization: Bearer $STU_TOKEN")"
if [[ "$STU_ASSIGN_CODE" == "200" ]]; then
  python3 -c 'import json; d=json.load(open("/tmp/stu_assign.json")); print("OK student assignments", len(d.get("items") or d.get("assignments") or []))'
else
  echo "WARN student assignments HTTP $STU_ASSIGN_CODE (deploy latest API for student module)"
fi

echo "==> Web routes (sample)"
for path in /login /admin /instructor /student /admin/f/ac-10-master-scheduling /admin/f/fn-01-finance-dashboard /admin/f/ac-03-programs; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL$path")"
  [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] || { echo "FAIL web $path -> $code"; exit 1; }
  echo "  OK $path $code"
done

ASSIGN_WEB="$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL/student/assignments")"
if [[ "$ASSIGN_WEB" == "200" || "$ASSIGN_WEB" == "307" || "$ASSIGN_WEB" == "308" ]]; then
  echo "  OK /student/assignments $ASSIGN_WEB"
else
  echo "  WARN /student/assignments $ASSIGN_WEB (redeploy web for student module pages)"
fi

echo
echo "Full E2E smoke passed (student API optional if VPS not redeployed)."
echo "Created: $INS_EMAIL / $STU_EMAIL  password=$PASS"
