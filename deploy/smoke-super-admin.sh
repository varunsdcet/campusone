#!/usr/bin/env bash
# Smoke test for the Super Admin API (/admin/super/*).
#   API_URL=http://46.202.163.202:4000 ./deploy/smoke-super-admin.sh
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"
STAMP="$(date +%s)"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1], {'d': d}))" "$1"; }

login() {
  curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"deviceFingerprint\":\"smoke-super-admin-01\"}"
}

TOKEN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" | json 'd["accessToken"]')"
H=(-H "authorization: Bearer $TOKEN" -H "content-type: application/json")
call() { curl -fsS "${H[@]}" "$@"; }

echo "==> meta + access levels"
call "$API/admin/super/meta" | json '"modules=%d campuses=%d" % (len(d["permissionModules"]), len(d["campuses"]))'
call "$API/admin/super/access-levels" | json '", ".join(l["name"] for l in d["items"])'

echo "==> create access level"
LEVEL_ID="$(call -X POST "$API/admin/super/access-levels" -d "{\"name\":\"Smoke Level $STAMP\",\"profileType\":\"Staff\",\"assignableByNonAdmins\":true,\"permissions\":{\"reporting\":{\"override\":false,\"level\":\"read\"}}}" | json 'd["id"]')"
echo "OK $LEVEL_ID"

echo "==> create user with login"
LOGIN="smoke.user$STAMP"
EMAIL="smoke.user$STAMP@heritage.edu"
USER_ID="$(call -X POST "$API/admin/super/users" -d "{\"givenName\":\"Smoke\",\"familyName\":\"User$STAMP\",\"email\":\"$EMAIL\",\"login\":\"$LOGIN\",\"password\":\"SmokePass!2026\",\"title\":\"Tester\",\"postNominals\":\"BSc\",\"employeeNumber\":\"E$STAMP\",\"accessLevelId\":\"faculty\",\"instructing\":true,\"customizeAccess\":true,\"permissions\":{\"reporting\":{\"override\":true,\"level\":\"full\"}},\"customizeRegional\":true,\"campuses\":[\"Online\"]}" | json 'd["accountId"]')"
echo "OK $USER_ID"
call "$API/admin/super/users/$USER_ID" | json '"%s roles=%s reporting=%s campuses=%s" % (d["login"], d["roles"], d["permissions"]["reporting"]["level"], d["campuses"])'

echo "==> sign in with user login"
login "$LOGIN" "SmokePass!2026" | json '"OK login roles=%s" % d.get("roles", d.get("session", {}).get("roles"))'

echo "==> directory search"
call "$API/admin/super/users?q=$LOGIN" | json '"total=%d first=%s level=%s" % (d["total"], d["items"][0]["login"], d["items"][0]["accessLevel"])'
call "$API/admin/super/users?perPage=50" | json '"all users=%d page_rows=%d" % (d["total"], len(d["items"]))'

echo "==> access level in use cannot be deleted; unused one can"
curl -sS -o /dev/null -w "delete faculty -> %{http_code}\n" -X DELETE "${H[@]}" "$API/admin/super/access-levels/faculty"
call -X DELETE "$API/admin/super/access-levels/$LEVEL_ID" | json '"deleted smoke level ok=%s" % d["ok"]'

echo "==> disable user blocks login"
call -X PUT "$API/admin/super/users/$USER_ID" -d "{\"givenName\":\"Smoke\",\"familyName\":\"User$STAMP\",\"email\":\"$EMAIL\",\"login\":\"$LOGIN\",\"accessLevelId\":\"faculty\",\"disabled\":true}" | json '"disabled=%s" % d["disabled"]'
curl -sS -o /dev/null -w "login after disable -> %{http_code}\n" -X POST "$API/auth/login" -H "content-type: application/json" \
  -d "{\"email\":\"$LOGIN\",\"password\":\"SmokePass!2026\",\"deviceFingerprint\":\"smoke-super-admin-01\"}"

echo "==> student search"
call "$API/admin/super/students/options" | json '"statuses=%d programs=%d terms=%s" % (len(d["statuses"]), len(d["programs"]), d["admissionTerms"][:3])'
call "$API/admin/super/students/search" | json '"all students=%d" % d["total"]'
call "$API/admin/super/students/search?status=Active%20Student" | json '"active=%d" % d["total"]'
call "$API/admin/super/students/search?campus=Online" | json '"online campus=%d" % d["total"]'

echo "==> faculty profile (smoke user)"
call "$API/admin/super/faculty/$USER_ID" | json '"%s status=%s current=%d" % (d["name"], d["status"], len(d["topics"]["currentCourses"]))'
call -X PATCH "$API/admin/super/faculty/$USER_ID" -d '{"section":"connect","phone":"604-555-0100","email":"connect@heritage.edu"}' | json '"connect=%s" % d["connect"]'
call -X PATCH "$API/admin/super/faculty/$USER_ID" -d '{"section":"education","background":"<p><b>MBA</b></p>","experience":"10 years","organizations":"CPA BC"}' | json '"edu=%s" % d["education"]["background"]'
call -X PATCH "$API/admin/super/faculty/$USER_ID" -d '{"section":"officeHours","content":"<p>Mon 9-11</p>"}' | json '"office=%s" % d["officeHours"]'
call -X PATCH "$API/admin/super/faculty/$USER_ID" -d '{"section":"availability.upsert","record":{"title":"","type":"Available to Teach","startTime":"21:00","endTime":"22:00","startDate":"2026-10-01","recurring":true,"endDate":"2026-10-08","days":["Mon","Wed"],"note":"Evening"}}' | json '"availability=%d" % len(d["availability"])'
curl -sS -o /dev/null -w "bad availability (end<start) -> %{http_code}\n" -X PATCH "${H[@]}" "$API/admin/super/faculty/$USER_ID" \
  -d '{"section":"availability.upsert","record":{"type":"Office Hours","startTime":"21:00","endTime":"20:00","startDate":"2026-10-01"}}'
curl -sS -o /dev/null -w "bad photo -> %{http_code}\n" -X PATCH "${H[@]}" "$API/admin/super/faculty/$USER_ID" -d '{"section":"photo","photo":"javascript:alert(1)"}'

echo "==> my account"
call "$API/admin/super/faculty/me" | json '"me=%s" % d["name"]'
call "$API/admin/super/me/timezone" | json '"tz=%s" % d["timezone"]'
curl -sS -o /dev/null -w "bad timezone -> %{http_code}\n" -X PUT "${H[@]}" "$API/admin/super/me/timezone" -d '{"timezone":"Mars/Olympus"}'
call "$API/admin/super/me/security-questions" | json '"questions=%s" % [q["answered"] for q in d["questions"]]'
call "$API/admin/super/me/accomplishments" | json '"badges=%d" % len(d["items"])'
curl -sS -o /dev/null -w "password mismatch -> %{http_code}\n" -X PUT "${H[@]}" "$API/admin/super/me/password" -d '{"newPassword":"abcdefghijk","confirmPassword":"different123"}'

echo "Super admin smoke passed."
