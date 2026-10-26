#!/usr/bin/env bash
# Extended campus report: mail, forgot, ask, search + core sync modules
set -euo pipefail
API="${API_URL:-http://46.202.163.202:4000}"
WEB="${WEB_URL:-http://46.202.163.202:3000}"
PASS="${DEMO_PASSWORD:-Heritage!2026}"
STAMP="$(date +%s)"
OUT="${REPORT_OUT:-/tmp/mh-platform-report-$STAMP.txt}"
: >"$OUT"
pass(){ echo "PASS|$1|$2" | tee -a "$OUT"; }
fail(){ echo "FAIL|$1|$2" | tee -a "$OUT"; }
warn(){ echo "WARN|$1|$2" | tee -a "$OUT"; }

login(){
  curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\",\"deviceFingerprint\":\"plat-$STAMP\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
}

echo "=== PLATFORM REPORT $STAMP ===" | tee -a "$OUT"

curl -fsS "$API/health" | grep -q '"ok":true' && pass "infra" "health" || fail "infra" "health"
ADMIN="$(login admin@heritage.edu)" && pass "auth" "admin" || fail "auth" "admin"
TEACHER="$(login vance.instructor@heritage.edu)" && pass "auth" "teacher" || fail "auth" "teacher"
STUDENT="$(login marcus.vance@heritage.edu)" && pass "auth" "student" || fail "auth" "student"
APPLICANT="$(login nora.reyes@applicant.heritage.edu)" && pass "auth" "applicant" || fail "auth" "applicant"
EMPLOYER="$(login sam.okello@fraserhealth.partner)" && pass "auth" "employer" || fail "auth" "employer"

# Mail + forgot
FORGOT="$(curl -sS -m 30 -X POST "$API/auth/forgot-password" -H "content-type: application/json" \
  -d '{"email":"marcus.vance@heritage.edu"}')"
echo "$FORGOT" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("ok") is True' \
  && pass "mail" "forgot-password ok" || fail "mail" "forgot-password"
MAILED="$(echo "$FORGOT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("mailed"))')"
TOKEN="$(echo "$FORGOT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("resetToken") or "")')"
[[ "$MAILED" == "True" ]] && pass "mail" "Humanitix send_mail mailed=true" || warn "mail" "mailed=$MAILED"
if [[ -n "$TOKEN" ]]; then
  NEWPASS="HeritageReset!${STAMP: -4}"
  curl -fsS -X POST "$API/auth/reset-password" -H "content-type: application/json" \
    -d "{\"token\":\"$TOKEN\",\"password\":\"$NEWPASS\"}" >/dev/null \
    && pass "mail" "reset-password applied" || fail "mail" "reset-password"
  # restore original password via admin recreate path: login with new then forgot again not needed —
  # set back using another reset for smoke continuity
  FORGOT2="$(curl -sS -m 30 -X POST "$API/auth/forgot-password" -H "content-type: application/json" \
    -d '{"email":"marcus.vance@heritage.edu"}')"
  TOKEN2="$(echo "$FORGOT2" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("resetToken") or "")')"
  if [[ -n "$TOKEN2" ]]; then
    curl -fsS -X POST "$API/auth/reset-password" -H "content-type: application/json" \
      -d "{\"token\":\"$TOKEN2\",\"password\":\"$PASS\"}" >/dev/null \
      && pass "mail" "password restored to seed" || warn "mail" "could not restore seed password"
  fi
  login marcus.vance@heritage.edu >/dev/null && pass "mail" "student login after reset cycle" || fail "mail" "student login after reset"
else
  warn "mail" "no resetToken exposed (set EXPOSE_RESET_TOKEN=1)"
fi

# Ask Heritage / Campus Coach
ASK="$(curl -sS -m 60 -X POST "$API/ai/ask" -H "authorization: Bearer $STUDENT" -H "content-type: application/json" \
  -H "idempotency-key: smoke-stu-$STAMP" \
  -d '{"question":"Where do I see my grades and fees?","contextPath":"/student/ask"}')"
echo "$ASK" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("answer"); print(d.get("tier"), d.get("role"), len(d.get("sources") or []))' \
  && pass "ai" "student ask heritage" || fail "ai" "student ask"
ASKA="$(curl -sS -m 60 -X POST "$API/ai/ask" -H "authorization: Bearer $ADMIN" -H "content-type: application/json" \
  -H "idempotency-key: smoke-adm-$STAMP" \
  -d '{"question":"How do I open student 360 and finance?","contextPath":"/admin/ai/ask"}')"
echo "$ASKA" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("answer")' \
  && pass "ai" "admin ask heritage" || fail "ai" "admin ask"
ASKAP="$(curl -sS -m 60 -X POST "$API/ai/ask" -H "authorization: Bearer $APPLICANT" -H "content-type: application/json" \
  -H "idempotency-key: smoke-app-$STAMP" \
  -d '{"question":"Where do I upload documents and accept my offer?","contextPath":"/applicant/ask"}')"
echo "$ASKAP" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("answer")' \
  && pass "ai" "applicant ask heritage" || fail "ai" "applicant ask"
ASKEM="$(curl -sS -m 60 -X POST "$API/ai/ask" -H "authorization: Bearer $EMPLOYER" -H "content-type: application/json" \
  -H "idempotency-key: smoke-emp-$STAMP" \
  -d '{"question":"How do I approve student hours and submit evaluations?","contextPath":"/employer/ask"}')"
echo "$ASKEM" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("answer")' \
  && pass "ai" "employer ask heritage" || fail "ai" "employer ask"

# Applicant / employer portals
curl -fsS -H "authorization: Bearer $APPLICANT" "$API/applicant/bootstrap" >/tmp/ap-boot.json \
  && pass "applicant" "bootstrap" || fail "applicant" "bootstrap"
# Minimal valid PDF (%PDF-1.4\n) — upload_document requires real file fields
AP_PDF_B64="JVBERi0xLjQK"
curl -fsS -X POST "$API/applicant/action" -H "authorization: Bearer $APPLICANT" -H "content-type: application/json" \
  -d "{\"action\":\"upload_document\",\"path\":\"/applicant/documents\",\"payload\":{\"documentId\":\"d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d002\",\"filename\":\"transcript.pdf\",\"mimeType\":\"application/pdf\",\"sizeBytes\":9,\"contentBase64\":\"$AP_PDF_B64\"}}" >/tmp/ap-up.json \
  && pass "applicant" "upload_document" || fail "applicant" "upload_document"
curl -fsS -H "authorization: Bearer $EMPLOYER" "$API/employer/bootstrap" >/tmp/em-boot.json \
  && pass "employer" "bootstrap" || fail "employer" "bootstrap"
curl -fsS -X POST "$API/employer/action" -H "authorization: Bearer $EMPLOYER" -H "content-type: application/json" \
  -d '{"action":"approve_hours","path":"/employer/hours"}' >/tmp/em-hrs.json \
  && pass "employer" "approve_hours" || fail "employer" "approve_hours"
SRCHA="$(curl -sS -m 15 -H "authorization: Bearer $APPLICANT" "$API/search?q=Nursing")"
echo "$SRCHA" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(g.get("items") for g in d.get("groups",[]))' \
  && pass "search" "applicant Nursing" || fail "search" "applicant search"
SRCHE="$(curl -sS -m 15 -H "authorization: Bearer $EMPLOYER" "$API/search?q=Mei")"
echo "$SRCHE" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(g.get("items") for g in d.get("groups",[]))' \
  && pass "search" "employer Mei" || fail "search" "employer search"

# Global search
SRCH="$(curl -sS -m 15 -H "authorization: Bearer $ADMIN" "$API/search?q=Marcus")"
echo "$SRCH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(g.get("items") for g in d.get("groups",[]))' \
  && pass "search" "admin global search Marcus" || fail "search" "admin search"
SRCHS="$(curl -sS -m 15 -H "authorization: Bearer $STUDENT" "$API/search?q=CS")"
echo "$SRCHS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("groups",[])))' >/dev/null \
  && pass "search" "student search" || fail "search" "student search"

# Admin module screens
for path in \
  "/admin/f/pl-01-users-and-roles" \
  "/admin/f/ac-03-programs" \
  "/admin/f/ac-10-master-scheduling" \
  "/admin/f/fn-01-finance-dashboard" \
  "/admin/f/ai-01-ai-dashboard" \
  "/admin/audit" \
  "/admin/f/rg-01-student-360"
 do
  enc="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$path")"
  body="$(curl -sS -m 12 -H "authorization: Bearer $ADMIN" "$API/admin/sis/screen?path=$enc" || true)"
  ok="$(printf '%s' "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("live") is True)' 2>/dev/null || echo False)"
  [[ "$ok" == "True" ]] && pass "admin-mod" "$path" || fail "admin-mod" "$path"
done

# Teacher profile/bio + attendance
for path in "/instructor/profile" "/instructor/f/t02-profile-biography" "/instructor/attendance" "/instructor/gradebook"; do
  code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -H "authorization: Bearer $TEACHER" "$API/instructor/sis/screen?path=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$path")" 2>/dev/null || echo 000)"
  # gradebook is web-only live page; API may 404 for sis — treat web separately
  if [[ "$path" == "/instructor/gradebook" ]]; then
    wcode="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$WEB$path")"
    [[ "$wcode" == "200" ]] && pass "teacher-mod" "web $path" || fail "teacher-mod" "web $path $wcode"
  else
    [[ "$code" == "200" ]] && pass "teacher-mod" "sis $path" || fail "teacher-mod" "sis $path $code"
  fi
done

curl -fsS -X POST "$API/instructor/sis/action" -H "authorization: Bearer $TEACHER" -H "content-type: application/json" \
  -d '{"path":"/instructor/attendance","action":"Submit & Finalize Attendance"}' >/tmp/att.json \
  && pass "teacher-mod" "attendance action" || fail "teacher-mod" "attendance action"

# Student modules web
for path in /student /student/courses /student/assignments /student/grades /student/fees /student/ask /student/search /student/profile /student/calendar; do
  code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$WEB$path")"
  [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] && pass "student-web" "$path $code" || fail "student-web" "$path $code"
done

for path in /admin/search /admin/ai/ask /admin/f/fn-01-finance-dashboard /admin/f/rg-01-student-360 /instructor/ask /instructor/search /instructor/f/t02-profile-biography /applicant /applicant/ask /applicant/search /employer /employer/ask /employer/hours /reset /login; do
  code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$WEB$path")"
  [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]] && pass "web" "$path $code" || fail "web" "$path $code"
done

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
