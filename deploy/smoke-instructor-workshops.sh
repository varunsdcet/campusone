#!/usr/bin/env bash
# Smoke test for the instructor portal's Workshops tab (/instructor/f/t11, t24, t40, t41, t42).
# An admin creates one workshop assigned to the instructor and one that is not; the instructor then
# lists, enrols, approves/declines/reinstates and takes attendance, and is blocked from the other workshop.
#   API_URL=http://46.202.163.202:4000 ./deploy/smoke-instructor-workshops.sh
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000}"
PASS="${DEMO_PASSWORD:-Heritage!2026}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
INSTRUCTOR_EMAIL="${INSTRUCTOR_EMAIL:-vance.instructor@heritage.edu}"
STUDENT_EMAIL="${STUDENT_EMAIL:-marcus.vance@heritage.edu}"
TZ_NAME="${INSTITUTION_TZ:-America/Vancouver}"
STAMP="$(date +%s)"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1], {'d': d}))" "$1"; }
day() { python3 -c "import sys,datetime,zoneinfo; t=datetime.datetime.now(zoneinfo.ZoneInfo(sys.argv[1])).date()+datetime.timedelta(days=int(sys.argv[2])); print(t.isoformat() if sys.argv[3]=='iso' else t.strftime('%A'))" "$TZ_NAME" "$1" "${2:-iso}"; }
login() {
  curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\",\"deviceFingerprint\":\"smoke-instructor-workshops-01\"}" | json 'd["accessToken"]'
}
claim() { python3 -c "import sys,json,base64; p=sys.argv[1].split('.')[1]; print(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))['accountId'])" "$1"; }
enc() { python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"; }

AD="$(login "$ADMIN_EMAIL")"
IN="$(login "$INSTRUCTOR_EMAIL")"
admin() { curl -fsS -H "authorization: Bearer $AD" -H "content-type: application/json" "$@"; }
screen() { curl -fsS -H "authorization: Bearer $IN" "$API/instructor/sis/screen?path=$(enc "$1")"; }
action() { # action <path> <label> <rowKey> <expect ok: True|False>
  local body out
  body="$(python3 -c 'import sys,json; print(json.dumps(dict(path=sys.argv[1], action=sys.argv[2], rowKey=sys.argv[3])))' "$1" "$2" "$3")"
  out="$(curl -fsS -H "authorization: Bearer $IN" -H "content-type: application/json" -X POST "$API/instructor/sis/action" -d "$body")"
  echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); ok=d.get('ok'); print(('OK' if str(ok)==sys.argv[2] else 'FAIL'), sys.argv[1], '->', ok, d.get('message')); sys.exit(0 if str(ok)==sys.argv[2] else 1)" "$2" "$4"
}
W="$API/admin/heritage/workshops"
ME="$(claim "$AD")"
INS="$(claim "$IN")"
TODAY="$(day 0)"; WEEKDAY="$(day 0 name)"

echo "==> admin creates an assigned and an unassigned workshop (today $TODAY, $WEEKDAY)"
MINE="$(admin -X POST "$W/catalog" -d "{\"title\":\"Wound Care Lab $STAMP\",\"code\":\"WCL-$STAMP\",\"settings\":{\"adminStatus\":\"Active\",\"instructors\":[\"$INS\"],\"maxEnrolments\":10,\"privacy\":\"Public Workshop\",\"approval\":\"Manual Decision\",\"startDate\":\"$(day -3)\",\"endDate\":\"$(day 30)\",\"scheduleType\":\"Weekly Schedule\",\"sessions\":[{\"day\":\"$WEEKDAY\",\"start\":\"09:00\",\"end\":\"11:00\"}],\"feeCollection\":\"Do Not Collect\",\"introduction\":\"Dressing changes and assessment\"}}" | json 'd["id"]')"
OTHER="$(admin -X POST "$W/catalog" -d "{\"title\":\"Admin Only $STAMP\",\"code\":\"ADM-$STAMP\",\"settings\":{\"instructors\":[\"$ME\"],\"maxEnrolments\":5,\"startDate\":\"$(day 2)\",\"endDate\":\"$(day 20)\",\"scheduleType\":\"Daily Schedule\",\"dailyStart\":\"10:00\",\"dailyEnd\":\"11:00\",\"feeCollection\":\"Do Not Collect\"}}" | json 'd["id"]')"
MARCUS="$(admin "$W/students?q=$STUDENT_EMAIL" | json "next(i['id'] for i in d['items'] if i['login']=='$STUDENT_EMAIL')")"
SECOND="$(admin "$W/students?q=heritage" | json "next(i['login'] for i in d['items'] if i['id']!='$MARCUS')")"
OTHER_REG="$(admin -X POST "$W/enrolments" -d "{\"studentId\":\"$MARCUS\",\"workshopId\":\"$OTHER\"}" | json 'd["id"]')"

echo "==> workshop lists + sidebar counts"
screen "/instructor/f/t11-workshops?list=mine" | json "'mine has assigned=%s, unassigned hidden=%s | tabs %s' % (any('WCL-$STAMP' in c['description'] for c in d['payload']['workshops']['cards']), not any('ADM-$STAMP' in c['description'] for c in d['payload']['workshops']['cards']), d['payload']['workshops']['tabs'])"
screen "/instructor/f/t11-workshops?list=available" | json "'available: assigned=%s unassigned=%s' % (any('WCL-$STAMP' in c['description'] for c in d['payload']['workshops']['cards']), any('ADM-$STAMP' in c['description'] for c in d['payload']['workshops']['cards']))"
screen "/instructor/f/t11-workshops?list=completed" | json "'completed: %d card(s)' % len(d['payload']['workshops']['cards'])"
screen "/instructor" | json "'sidebar counts %s' % d['bootstrap']['workshopCounts']"

echo "==> workshop detail"
screen "/instructor/f/t24-workshop-detail?workshopId=$MINE" | json "'%s | %s | %s | %s | agenda %s' % (d['payload']['workshopDetail']['title'], d['payload']['workshopDetail']['status'], d['payload']['workshopDetail']['when'], d['payload']['workshopDetail']['seats'], d['payload']['workshopDetail']['agenda'])"
screen "/instructor/f/t24-workshop-detail?workshopId=$OTHER" | json "'unassigned detail: %s' % d['payload']['subtitle']"

echo "==> new workshop enrolment form + save"
screen "/instructor/f/t42-new-workshop-enrollment" | json "'form fields %s; offers assigned=%s unassigned=%s' % ([f['label'] for g in d['payload']['form']['groups'] for f in g['fields']], any(o['value']=='$MINE' for g in d['payload']['form']['groups'] for f in g['fields'] for o in f.get('options',[])), any(o['value']=='$OTHER' for g in d['payload']['form']['groups'] for f in g['fields'] for o in f.get('options',[])))"
T42="/instructor/f/t42-new-workshop-enrollment"
action "$T42" "Save Enrolment" "{\"Student\":\"$STUDENT_EMAIL\",\"Workshop\":\"$MINE\",\"Note\":\"Smoke $STAMP\"}" True
action "$T42" "Save Enrolment" "{\"Student\":\"$STUDENT_EMAIL\",\"Workshop\":\"$MINE\"}" False
action "$T42" "Save Enrolment" "{\"Student\":\"$SECOND\",\"Workshop\":\"$MINE\"}" True
action "$T42" "Save Enrolment" "{\"Student\":\"$SECOND\",\"Workshop\":\"$OTHER\"}" False
action "$T42" "Save Enrolment" "{\"Student\":\"nobody-$STAMP\",\"Workshop\":\"$MINE\"}" False

echo "==> enrolment status list + transitions"
T40="/instructor/f/t40-workshop-enrollment-status?status=pending&workshop=$MINE"
screen "$T40" | json "'pending: %s | workshop options %d' % ([(r['studentName'], r['status']) for r in d['payload']['workshopEnrolments']['rows']], len(d['payload']['workshopEnrolments']['workshopOptions']))"
E1="$(screen "$T40" | json "next(r['id'] for r in d['payload']['workshopEnrolments']['rows'] if r['note']=='Smoke $STAMP')")"
E2="$(screen "$T40" | json "next(r['id'] for r in d['payload']['workshopEnrolments']['rows'] if r['id']!='$E1')")"
action "$T40" "Approve Enrolment" "$E1" True
action "$T40" "Decline Enrolment" "$E2" True
action "$T40" "Approve Enrolment" "$E2" False
action "$T40" "Reinstate Enrolment" "$E2" True
action "$T40" "Approve Enrolment" "$OTHER_REG" False
screen "/instructor/f/t40-workshop-enrollment-status?status=all&workshop=$MINE" | json "'all: %s' % [(r['studentName'], r['status']) for r in d['payload']['workshopEnrolments']['rows']]"
screen "/instructor/f/t40-workshop-enrollment-status?status=all" | json "'unassigned workshop rows hidden: %s' % (not any('ADM-$STAMP' in r['workshop'] for r in d['payload']['workshopEnrolments']['rows']))"

echo "==> attendance"
T41="/instructor/f/t41-workshop-attendance?date=$TODAY&workshop=$MINE"
screen "$T41" | json "'%s: %s' % (d['payload']['workshopAttendance']['heading'], [(s['name'], s['status']) for s in d['payload']['workshopAttendance']['students']])"
action "$T41" "Save Attendance" "{\"date\":\"$TODAY\",\"roster\":[{\"studentId\":\"$MARCUS\",\"workshopId\":\"$MINE\",\"status\":\"Absent\",\"note\":\"Sick\"}]}" True
screen "$T41" | json "'reloaded: %s' % [(s['name'], s['status'], s['note']) for s in d['payload']['workshopAttendance']['students']]"
action "$T41" "Save Attendance" "{\"date\":\"$TODAY\",\"roster\":[{\"studentId\":\"$MARCUS\",\"workshopId\":\"$OTHER\",\"status\":\"Present\"}]}" False

echo "==> cleanup"
admin -X POST "$W/enrolments/$E1/status" -d '{"status":"dropped","note":"Smoke cleanup"}' | json 'd["message"]'
admin -X DELETE "$W/enrolments/$E2" | json 'd["message"]'
admin -X DELETE "$W/enrolments/$OTHER_REG" | json 'd["message"]'
admin -X DELETE "$W/catalog/$OTHER" | json 'd["message"]'
echo "DONE"
