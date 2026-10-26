#!/usr/bin/env bash
# Smoke test for the Workshops module (/admin/heritage/workshops/*) and student self-registration.
# Creates a category, role and three workshops, then runs enrolments, approvals, attendance and guards end to end.
#   API_URL=http://46.202.163.202:4000 ./deploy/smoke-workshops.sh
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"
STUDENT_EMAIL="${STUDENT_EMAIL:-marcus.vance@heritage.edu}"
STUDENT_PASSWORD="${STUDENT_PASSWORD:-Heritage!2026}"
TZ_NAME="${INSTITUTION_TZ:-America/Vancouver}"
STAMP="$(date +%s)"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1], {'d': d}))" "$1"; }
day() { python3 -c "import sys,datetime,zoneinfo; t=datetime.datetime.now(zoneinfo.ZoneInfo(sys.argv[1])).date()+datetime.timedelta(days=int(sys.argv[2])); print(t.isoformat() if sys.argv[3]=='iso' else t.strftime('%A'))" "$TZ_NAME" "$1" "${2:-iso}"; }
login() {
  curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"deviceFingerprint\":\"smoke-workshops-01\"}" | json 'd["accessToken"]'
}

ST="$(login "$STUDENT_EMAIL" "$STUDENT_PASSWORD")"
AD="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
student() { curl -fsS -H "authorization: Bearer $ST" -H "content-type: application/json" "$@"; }
admin() { curl -fsS -H "authorization: Bearer $AD" -H "content-type: application/json" "$@"; }
expect() { # expect <code> <label> curl-args...
  local want="$1" label="$2"; shift 2
  local out code
  out="$(curl -s -w '\n%{http_code}' -H "authorization: Bearer $AD" -H "content-type: application/json" "$@")"
  code="${out##*$'\n'}"
  [ "$code" = "$want" ] && echo "OK $label ($code): $(echo "${out%$'\n'*}" | json 'd.get("message") or d.get("error",{}).get("message","") if isinstance(d,dict) else ""' 2>/dev/null)" \
    || { echo "FAIL $label returned $code: ${out%$'\n'*}"; exit 1; }
}
W="$API/admin/heritage/workshops"
TODAY="$(day 0)"; WEEKDAY="$(day 0 name)"; OTHERDAY="$(day 2 name)"

echo "==> meta + counts (today $TODAY, $WEEKDAY)"
admin "$W/meta" | json '"instructors=%d campuses=%d statuses=%s" % (len(d["instructors"]), len(d["campuses"]), d["options"]["statuses"])'
admin "$W/counts" | json 'd'
ME="$(python3 -c "import sys,json,base64; p=sys.argv[1].split('.')[1]; print(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))['accountId'])" "$AD")"

echo "==> category + role"
CAT="$(admin -X POST "$W/categories" -d "{\"name\":\"Clinical Skills $STAMP\",\"abbreviation\":\"CS$STAMP\"}" | json 'd["id"]')"
expect 409 "duplicate category rejected" -X POST "$W/categories" -d "{\"name\":\"Clinical Skills $STAMP\",\"abbreviation\":\"X$STAMP\"}"
ROLE="$(admin -X POST "$W/roles" -d "{\"name\":\"Participant $STAMP\",\"status\":\"Active\",\"outcomes\":[{\"value\":\"Attended every session\",\"grantsCompletion\":\"Yes\"}],\"competencies\":[\"Patient safety\"]}" | json 'd["id"]')"
expect 400 "role without outcome rejected" -X POST "$W/roles" -d "{\"name\":\"Empty $STAMP\",\"status\":\"Active\",\"outcomes\":[]}"
admin "$W/roles/$ROLE" | json '"role %s outcomes=%d competencies=%s" % (d["name"], len(d["outcomes"]), d["competencies"])'

echo "==> workshops"
SETTINGS_A="{\"adminStatus\":\"Active\",\"instructors\":[\"$ME\"],\"enrolmentCutoff\":\"$(day 20)T17:00\",\"rolesMode\":\"Enabled\",\"roleIds\":[\"$ROLE\"],\"maxEnrolments\":10,\"sameAsClassroom\":false,\"privacy\":\"Private Workshop\",\"approval\":\"Manual Decision\",\"hours\":12,\"startDate\":\"$(day -7)\",\"endDate\":\"$(day 30)\",\"scheduleType\":\"Weekly Schedule\",\"sessions\":[{\"day\":\"$WEEKDAY\",\"start\":\"09:00\",\"end\":\"12:00\"},{\"day\":\"$OTHERDAY\",\"start\":\"13:00\",\"end\":\"15:00\"}],\"feeCollection\":\"Immediately\",\"defaultFee\":\"75.00\",\"domesticFee\":\"75.00\",\"internationalFee\":\"150.00\",\"introduction\":\"Hands-on IV therapy practice\",\"descriptionHtml\":\"<p>Bring your <b>scrubs</b>.</p>\"}"
A="$(admin -X POST "$W/catalog" -d "{\"categoryId\":\"$CAT\",\"title\":\"IV Therapy Lab $STAMP\",\"code\":\"IVT-$STAMP\",\"settings\":$SETTINGS_A}" | json 'd["id"]')"
B="$(admin -X POST "$W/catalog" -d "{\"title\":\"Open Study Hall $STAMP\",\"code\":\"OSH-$STAMP\",\"settings\":{\"maxEnrolments\":30,\"privacy\":\"Public Workshop\",\"approval\":\"Automatic Approval\",\"startDate\":\"$(day 3)\",\"endDate\":\"$(day 40)\",\"scheduleType\":\"Daily Schedule\",\"dailyStart\":\"16:00\",\"dailyEnd\":\"18:00\",\"feeCollection\":\"Do Not Collect\"}}" | json 'd["id"]')"
C="$(admin -X POST "$W/catalog" -d "{\"title\":\"CPR Refresher $STAMP\",\"code\":\"CPR-$STAMP\",\"settings\":{\"maxEnrolments\":5,\"startDate\":\"$(day -30)\",\"endDate\":\"$(day -2)\",\"scheduleType\":\"Weekly Schedule\",\"sessions\":[{\"day\":\"$WEEKDAY\",\"start\":\"10:00\",\"end\":\"11:00\"}]}}" | json 'd["id"]')"
expect 400 "workshop without name rejected" -X POST "$W/catalog" -d '{"settings":{"maxEnrolments":5,"startDate":"2026-01-01","endDate":"2026-01-02","sessions":[{"day":"Monday","start":"09:00","end":"10:00"}]}}'
expect 400 "end before start rejected" -X POST "$W/catalog" -d "{\"title\":\"Bad $STAMP\",\"settings\":{\"maxEnrolments\":5,\"startDate\":\"2026-02-01\",\"endDate\":\"2026-01-01\",\"sessions\":[{\"day\":\"Monday\",\"start\":\"09:00\",\"end\":\"10:00\"}]}}"
admin "$W/catalog/$A" | json '"A: %s [%s] %s | %s | %s | cap=%d fee=%s instructors=%s" % (d["title"], d["category"], d["status"], d["schedule"], d["length"], d["capacity"], d["fee"], d["instructors"])'
admin "$W/catalog/$B" | json '"B: %s %s | %s" % (d["title"], d["status"], d["schedule"])'
admin "$W/catalog/$C" | json '"C: %s %s" % (d["title"], d["status"])'
admin "$W/catalog?completion=Completed&q=$STAMP" | json '"catalog completed filter: %s" % [i["code"] for i in d["items"]]'
admin "$W/catalog?q=IVT-$STAMP" | json '"catalog text filter: %s" % [i["code"] for i in d["items"]]'
admin "$W/available" | json "'available has A,B not C: %s' % ({'IVT-$STAMP','OSH-$STAMP'} <= {i['code'] for i in d['items']} and 'CPR-$STAMP' not in {i['code'] for i in d['items']})"
admin "$W/completed" | json "'completed has C: %s' % ('CPR-$STAMP' in {i['code'] for i in d['items']})"
admin "$W/mine" | json "'my workshops (instructor) has A: %s' % ('IVT-$STAMP' in {i['code'] for i in d['items']})"
admin "$W/mine?filter=Upcoming+Workshops" | json "'my upcoming excludes A (active): %s' % ('IVT-$STAMP' not in {i['code'] for i in d['items']})"

echo "==> new workshop enrolment"
MARCUS="$(admin "$W/students?q=$STUDENT_EMAIL" | json "next(i['id'] for i in d['items'] if i['login']=='$STUDENT_EMAIL')")"
OTHER="$(admin "$W/students?q=heritage" | json "next(i['id'] for i in d['items'] if i['id']!='$MARCUS')")"
expect 400 "enrolment without role rejected" -X POST "$W/enrolments" -d "{\"studentId\":\"$MARCUS\",\"workshopId\":\"$A\"}"
E1="$(admin -X POST "$W/enrolments" -d "{\"studentId\":\"$MARCUS\",\"workshopId\":\"$A\",\"roleId\":\"$ROLE\",\"note\":\"Placement prerequisite\"}" | tee /dev/stderr | json 'd["id"]')"
expect 409 "duplicate enrolment rejected" -X POST "$W/enrolments" -d "{\"studentId\":\"$MARCUS\",\"workshopId\":\"$A\",\"roleId\":\"$ROLE\"}"
expect 409 "enrolment in completed workshop rejected" -X POST "$W/enrolments" -d "{\"studentId\":\"$MARCUS\",\"workshopId\":\"$C\"}"
E2="$(admin -X POST "$W/enrolments" -d "{\"studentId\":\"$OTHER\",\"workshopId\":\"$A\",\"roleId\":\"$ROLE\"}" | json 'd["id"]')"
admin "$W/enrolments?status=Pending&workshop=$A" | json '"pending in A: %s" % [(i["student"]["name"], i["role"], i["status"]) for i in d["items"]]'
admin "$W/enrolments?status=all&student=vance&workshop=$A" | json '"student filter: %d row(s)" % d["total"]'
admin "$W/enrolments?status=all&letter=V&workshop=$A" | json '"letter V: %d row(s)" % d["total"]'

echo "==> approve / decline / drop / reinstate"
admin -X POST "$W/enrolments/$E1/status" -d '{"status":"approved"}' | json 'd["message"]'
admin -X POST "$W/enrolments/$E2/status" -d '{"status":"declined","note":"Missing prerequisite"}' | json 'd["message"]'
expect 409 "approving a declined enrolment directly rejected" -X POST "$W/enrolments/$E2/status" -d '{"status":"approved"}'
admin -X POST "$W/enrolments/$E2/status" -d '{"status":"pending"}' | json '"reinstated: " + d["message"]'
admin "$W/counts" | json 'd'

echo "==> attendance"
admin "$W/attendance?date=$TODAY&workshop=$A" | json '"day %s: %s" % (d["date"], [(g["workshop"]["code"], g["workshop"]["time"], [s["student"]["name"] for s in g["students"]]) for g in d["groups"]])'
admin -X PUT "$W/attendance" -d "{\"date\":\"$TODAY\",\"marks\":[{\"workshopId\":\"$A\",\"studentId\":\"$MARCUS\",\"status\":\"present\",\"note\":\"On time\"}]}" | json 'd["message"]'
admin "$W/attendance?date=$TODAY&workshop=$A" | json '"reloaded: %s" % [(s["student"]["name"], s["status"], s["note"]) for g in d["groups"] for s in g["students"]]'
expect 400 "attendance for pending student rejected" -X PUT "$W/attendance" -d "{\"date\":\"$TODAY\",\"marks\":[{\"workshopId\":\"$A\",\"studentId\":\"$OTHER\",\"status\":\"present\"}]}"
expect 400 "attendance on a non-meeting day rejected" -X PUT "$W/attendance" -d "{\"date\":\"$(day 1)\",\"marks\":[{\"workshopId\":\"$A\",\"studentId\":\"$MARCUS\",\"status\":\"present\"}]}"
admin "$W/attendance/week?date=$TODAY&workshop=$A" | json '"week %s..%s: %s" % (d["days"][0], d["days"][6], [(c["date"], c["enrolled"], c["present"]) for r in d["rows"] for c in r["cells"] if c["scheduled"]])'

echo "==> guards"
expect 409 "delete enrolment with attendance blocked" -X DELETE "$W/enrolments/$E1"
expect 409 "delete category in use blocked" -X DELETE "$W/categories/$CAT"
expect 409 "delete role in use blocked" -X DELETE "$W/roles/$ROLE"
expect 409 "delete workshop with enrolments blocked" -X DELETE "$W/catalog/$A"
admin -X POST "$W/enrolments/$E1/status" -d '{"status":"dropped","note":"Withdrew"}' | json 'd["message"]'
admin -X DELETE "$W/enrolments/$E2" | json 'd["message"]'

echo "==> edit workshop"
admin -X PUT "$W/catalog/$A" -d "{\"categoryId\":\"$CAT\",\"title\":\"IV Therapy Lab $STAMP (Rev)\",\"code\":\"IVT-$STAMP\",\"settings\":$SETTINGS_A}" | json 'd["message"]'

echo "==> student self-registration"
student "$API/student/workshops" | json "'student available: B=%s A(private)=%s' % (any(w['code']=='OSH-$STAMP' for w in d['available']), any(w['code']=='IVT-$STAMP' for w in d['available']))"
student -X POST "$API/student/workshops/register" -d "{\"workshopId\":\"$B\"}" | json "'registered B -> mine: %s' % any(w['code']=='OSH-$STAMP' for w in d['mine'])"
code="$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $ST" -H "content-type: application/json" -X POST "$API/student/workshops/register" -d "{\"workshopId\":\"$A\"}")"
[ "$code" = "400" ] && echo "OK private workshop self-registration rejected (400)" || { echo "FAIL private self-registration returned $code"; exit 1; }
admin "$W/enrolments?status=Approved&workshop=$B" | json '"admin sees auto-approved: %s" % [i["student"]["name"] for i in d["items"]]'

echo "==> cleanup: workshop without enrolments can be deleted"
admin -X DELETE "$W/catalog/$C" | json 'd["message"]'
admin "$W/counts" | json 'd'
echo "DONE"
