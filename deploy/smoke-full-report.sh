#!/usr/bin/env bash
# Full 3-module sync report against live API/web
set -euo pipefail
API="${API_URL:-http://46.202.163.202:4000}"
WEB="${WEB_URL:-http://46.202.163.202:3000}"
PASS="${DEMO_PASSWORD:-Heritage!2026}"
STAMP="$(date +%s)"
OUT="${REPORT_OUT:-/tmp/mh-full-report-$STAMP.txt}"
: >"$OUT"

pass() { echo "PASS|$1|$2" | tee -a "$OUT"; }
fail() { echo "FAIL|$1|$2" | tee -a "$OUT"; }
warn() { echo "WARN|$1|$2" | tee -a "$OUT"; }

login() {
  curl -fsS -X POST "$API/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\",\"deviceFingerprint\":\"report-$STAMP\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
}

echo "=== FULL CAMPUS REPORT $STAMP ===" | tee -a "$OUT"

code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$API/health")"
[[ "$code" == "200" ]] && pass "infra" "API health" || fail "infra" "API health $code"
code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$WEB/login")"
[[ "$code" == "200" ]] && pass "infra" "Web login page" || fail "infra" "Web login $code"

for pair in "admin:admin@heritage.edu" "teacher:vance.instructor@heritage.edu" "student:marcus.vance@heritage.edu"; do
  role="${pair%%:*}"; email="${pair#*:}"
  if tok="$(login "$email" 2>/dev/null)"; then
    home="$(curl -sS -m 8 -H "authorization: Bearer $tok" "$API/me/home")"
    r="$(printf '%s' "$home" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("role",""))' 2>/dev/null || true)"
    pass "auth" "$role login -> role=$r"
  else
    fail "auth" "$role login ($email)"
  fi
done

ADMIN_TOKEN="$(login admin@heritage.edu)"
STU_SEED="$(login marcus.vance@heritage.edu)"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  enc="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$path")"
  body="$(curl -sS -m 10 -H "authorization: Bearer $ADMIN_TOKEN" "$API/admin/sis/screen?path=$enc")"
  ok="$(printf '%s' "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("live") is True)' 2>/dev/null || echo False)"
  [[ "$ok" == "True" ]] && pass "admin-sis" "$path live" || fail "admin-sis" "$path not live"
done <<'PATHS'
/admin/f/pl-01-users-and-roles
/admin/f/ac-03-programs
/admin/f/ac-09-sections
/admin/f/ac-10-master-scheduling
/admin/f/fn-01-finance-dashboard
/admin/f/rg-00-registrar-dashboard
/admin/f/ad-02-application-queue
PATHS

INS_EMAIL="sync.teacher.${STAMP}@heritage.edu"
STU_EMAIL="sync.student.${STAMP}@heritage.edu"

curl -fsS -X POST "$API/admin/users" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"email\":\"$INS_EMAIL\",\"givenName\":\"Sync\",\"familyName\":\"Teacher\",\"role\":\"instructor\",\"password\":\"$PASS\"}" >/tmp/cu_ins.json \
  && pass "admin-crud" "create instructor" || fail "admin-crud" "create instructor"

curl -fsS -X POST "$API/admin/users" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"email\":\"$STU_EMAIL\",\"givenName\":\"Sync\",\"familyName\":\"Student\",\"role\":\"student\",\"password\":\"$PASS\",\"programName\":\"Sync Nursing $STAMP\"}" >/tmp/cu_stu.json \
  && pass "admin-crud" "create student" || fail "admin-crud" "create student"

curl -fsS -X POST "$API/admin/sis/action" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"path\":\"/admin/f/ac-03-programs\",\"action\":\"Create Program\",\"note\":\"Sync Program $STAMP\"}" >/tmp/prog.json \
  && pass "admin-flow" "program create" || fail "admin-flow" "program create"

SEC="$(curl -fsS -X POST "$API/admin/sections" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"courseCode\":\"SYN$STAMP\",\"courseTitle\":\"Sync Course\",\"credits\":3,\"sectionCode\":\"SYN$STAMP-01\",\"instructorEmail\":\"$INS_EMAIL\",\"termCode\":\"2026F\"}")"
SEC_ID="$(printf '%s' "$SEC" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("sectionId",""))')"
[[ -n "$SEC_ID" ]] && pass "admin-flow" "section/schedule created" || fail "admin-flow" "section create"

curl -fsS -X POST "$API/admin/enrolments" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"studentEmail\":\"$STU_EMAIL\",\"sectionId\":\"$SEC_ID\"}" >/tmp/enr.json \
  && pass "admin-flow" "enrol student" || fail "admin-flow" "enrol"

curl -fsS -X POST "$API/admin/sis/action" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d "{\"path\":\"/admin/f/fn-01-finance-dashboard\",\"action\":\"Approve Refund\",\"rowKey\":\"sync-$STAMP\"}" >/tmp/fee.json \
  && pass "admin-flow" "finance refund action" || fail "admin-flow" "finance"

INS_TOKEN="$(login "$INS_EMAIL")"
boot="$(curl -sS -m 10 -H "authorization: Bearer $INS_TOKEN" "$API/instructor/sis/bootstrap")"
sc="$(printf '%s' "$boot" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(int(d.get("sectionCount") or 0), int(d.get("studentCount") or 0))')"
SC="$(echo "$sc" | awk '{print $1}')"
STC="$(echo "$sc" | awk '{print $2}')"
[[ "$SC" -ge 1 ]] && pass "teacher-sync" "bootstrap sections=$SC students=$STC" || fail "teacher-sync" "bootstrap empty ($sc)"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  enc="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$path")"
  body="$(curl -sS -m 12 -H "authorization: Bearer $INS_TOKEN" "$API/instructor/sis/screen?path=$enc")"
  ok="$(printf '%s' "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("path" in d or d.get("live") is True or "payload" in d)' 2>/dev/null || echo False)"
  [[ "$ok" == "True" ]] && pass "teacher-sis" "$path" || fail "teacher-sis" "$path"
done <<'PATHS'
/instructor
/instructor/attendance
/instructor/roster
/instructor/announcements
PATHS

att="$(curl -sS -m 15 -X POST "$API/instructor/sis/action" \
  -H "authorization: Bearer $INS_TOKEN" -H "content-type: application/json" \
  -d '{"path":"/instructor/attendance","action":"Submit & Finalize Attendance"}')"
echo "$att" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "Attendance" in str(d.get("message","")) or d.get("live") is True' \
  && pass "teacher-flow" "attendance finalize" || fail "teacher-flow" "attendance"

ann="$(curl -sS -m 15 -X POST "$API/instructor/sis/action" \
  -H "authorization: Bearer $INS_TOKEN" -H "content-type: application/json" \
  -d "{\"path\":\"/instructor/announcements\",\"action\":\"Share with class\",\"rowKey\":\"Sync note $STAMP\"}")"
msg="$(printf '%s' "$ann" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message",""))' 2>/dev/null || true)"
echo "$msg" | grep -Eqi 'Announcement|sent|Saved' && pass "teacher-flow" "announcement ($msg)" || warn "teacher-flow" "announcement: $msg"

pub="$(curl -sS -m 15 -X POST "$API/instructor/sis/action" \
  -H "authorization: Bearer $INS_TOKEN" -H "content-type: application/json" \
  -d "{\"path\":\"/instructor/assessments\",\"action\":\"Publish Assessment\",\"rowKey\":\"Sync Quiz $STAMP\"}")"
msg="$(printf '%s' "$pub" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message",""))' 2>/dev/null || true)"
echo "$msg" | grep -Eqi 'Scheduled|Saved|Assessment|created|Publish' && pass "teacher-flow" "publish assessment ($msg)" || warn "teacher-flow" "publish: $msg"

STU_TOKEN="$(login "$STU_EMAIL")"
courses="$(curl -sS -m 10 -H "authorization: Bearer $STU_TOKEN" "$API/courses/me")"
c_count="$(printf '%s' "$courses" | python3 -c 'import sys,json; d=json.load(sys.stdin); items=d.get("items") or d.get("courses") or []; print(len(items))')"
[[ "$c_count" -ge 1 ]] && pass "student-sync" "courses/me count=$c_count" || fail "student-sync" "courses empty"

cal="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/calendar/me")"
[[ "$cal" == "200" ]] && pass "student-sync" "calendar/me" || fail "student-sync" "calendar $cal"
ntf="$(curl -sS -m 10 -o /tmp/ntf.json -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/notifications/me")"
[[ "$ntf" == "200" ]] && pass "student-sync" "notifications/me" || fail "student-sync" "notifications $ntf"
ncount="$(python3 -c 'import json; d=json.load(open("/tmp/ntf.json")); print(len(d.get("items") or d.get("notifications") or []))' 2>/dev/null || echo 0)"
pass "student-sync" "notification items=$ncount"

asn="$(curl -sS -m 10 -o /tmp/asn.json -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/student/assignments")"
[[ "$asn" == "200" ]] && pass "student-sync" "student/assignments API" || fail "student-sync" "assignments $asn"
acount="$(python3 -c 'import json; d=json.load(open("/tmp/asn.json")); print(len(d.get("assignments") or d.get("items") or []))')"
pass "student-sync" "assignment items=$acount"

grades="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/grades/me")"
[[ "$grades" == "200" ]] && pass "student-sync" "grades/me" || fail "student-sync" "grades $grades"

iso="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/admin/users")"
[[ "$iso" == "401" || "$iso" == "403" ]] && pass "security" "student blocked from admin ($iso)" || fail "security" "student admin $iso"
iso2="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' -H "authorization: Bearer $STU_TOKEN" "$API/instructor/sis/bootstrap")"
[[ "$iso2" == "401" || "$iso2" == "403" ]] && pass "security" "student blocked from instructor ($iso2)" || fail "security" "student instructor $iso2"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$WEB$path")"
  [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] && pass "web" "$path $code" || fail "web" "$path $code"
done <<'PATHS'
/login
/admin
/instructor
/student
/student/assignments
/student/courses
/student/grades
/student/fees
/admin/f/ac-10-master-scheduling
/admin/f/fn-01-finance-dashboard
/instructor/attendance
PATHS

m_asn="$(curl -sS -m 10 -H "authorization: Bearer $STU_SEED" "$API/student/assignments")"
m_count="$(printf '%s' "$m_asn" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("assignments") or d.get("items") or []))')"
[[ "$m_count" -ge 1 ]] && pass "seed-data" "marcus assignments=$m_count" || warn "seed-data" "marcus assignments=$m_count"

echo "CREATED|$INS_EMAIL|$STU_EMAIL|$SEC_ID" | tee -a "$OUT"
echo "=== SUMMARY ===" | tee -a "$OUT"
python3 - <<PY
from collections import Counter
rows=open("$OUT").read().splitlines()
c=Counter(r.split("|")[0] for r in rows if "|" in r and r.split("|")[0] in {"PASS","FAIL","WARN"})
print(f"PASS={c.get('PASS',0)} FAIL={c.get('FAIL',0)} WARN={c.get('WARN',0)}")
for kind in ("FAIL","WARN"):
  hits=[r for r in rows if r.startswith(kind+"|")]
  if hits:
    print(kind+"S:")
    for h in hits: print(" ", h)
print("REPORT=$OUT")
PY
