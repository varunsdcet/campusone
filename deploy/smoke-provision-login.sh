#!/usr/bin/env bash
# Provision teacher + student via admin, then verify they can login to their portals.
#   API_URL=http://127.0.0.1:4000 ./deploy/smoke-provision-login.sh
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"
RUN="$(date +%s)"
PASS="Heritage!2026"
INST_EMAIL="smoke.teacher.${RUN}@heritage.edu"
STU_EMAIL="smoke.student.${RUN}@heritage.edu"

echo "==> Admin login"
ADMIN_TOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"deviceFingerprint\":\"smoke-provision-admin\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
)"
echo OK

echo "==> Create instructor"
INST_JSON="$(
  curl -fsS -X POST "$API_URL/admin/users" \
    -H "authorization: Bearer $ADMIN_TOKEN" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$INST_EMAIL\",\"givenName\":\"Smoke\",\"familyName\":\"Teacher\",\"role\":\"instructor\",\"password\":\"$PASS\"}"
)"
python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["role"]=="instructor"; print(" ", d["email"], "→", d.get("portalHref") or "/instructor")' <<<"$INST_JSON"

echo "==> Create student"
STU_JSON="$(
  curl -fsS -X POST "$API_URL/admin/users" \
    -H "authorization: Bearer $ADMIN_TOKEN" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$STU_EMAIL\",\"givenName\":\"Smoke\",\"familyName\":\"Student\",\"role\":\"student\",\"password\":\"$PASS\",\"programName\":\"Computer Science\"}"
)"
STU_NUM="$(
  python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["role"]=="student" and d.get("studentNumber"); print(d["studentNumber"]); print(" ", d["email"], d["studentNumber"], "→", d.get("portalHref") or "/student", file=sys.stderr)' <<<"$STU_JSON"
)"

echo "==> Instructor login + portal"
ITOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$INST_EMAIL\",\"password\":\"$PASS\",\"deviceFingerprint\":\"smoke-teacher\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "instructor" in d["roles"]; print(d["accessToken"])'
)"
curl -fsS "$API_URL/instructor/sis/bootstrap" -H "authorization: Bearer $ITOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "displayName" in d; print(" OK bootstrap", d.get("email"))'
curl -fsS "$API_URL/me/home" -H "authorization: Bearer $ITOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("role")=="instructor"; print(" OK me/home instructor")'

echo "==> Student login (email) + portal"
STOKEN="$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$STU_EMAIL\",\"password\":\"$PASS\",\"deviceFingerprint\":\"smoke-student\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "student" in d["roles"]; print(d["accessToken"])'
)"
curl -fsS "$API_URL/me/home" -H "authorization: Bearer $STOKEN" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("role")=="student"; print(" OK me/home student", d.get("studentNumber"))'

echo "==> Student login (student number)"
curl -fsS -X POST "$API_URL/auth/login" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$STU_NUM\",\"password\":\"$PASS\",\"deviceFingerprint\":\"smoke-student-num\"}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "student" in d["roles"]; print(" OK student-number login")'

echo
echo "Provision → login smoke passed."
echo "  Teacher: $INST_EMAIL / $PASS → /instructor"
echo "  Student: $STU_EMAIL / $PASS (or $STU_NUM) → /student"
