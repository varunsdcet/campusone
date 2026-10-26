#!/usr/bin/env bash
# Smoke test for Requests → User Requests (/admin/heritage/requests/*).
# Submits real student requests, then reviews / edits / approves / declines / deletes them as admin.
#   API_URL=http://46.202.163.202:4000 ./deploy/smoke-user-requests.sh
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"
STUDENT_EMAIL="${STUDENT_EMAIL:-marcus.vance@heritage.edu}"
STUDENT_PASSWORD="${STUDENT_PASSWORD:-Heritage!2026}"
STAMP="$(date +%s)"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1], {'d': d}))" "$1"; }
login() {
  curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"deviceFingerprint\":\"smoke-user-requests-01\"}" | json 'd["accessToken"]'
}

ST="$(login "$STUDENT_EMAIL" "$STUDENT_PASSWORD")"
AD="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
student() { curl -fsS -H "authorization: Bearer $ST" -H "content-type: application/json" "$@"; }
admin() { curl -fsS -H "authorization: Bearer $AD" -H "content-type: application/json" "$@"; }
R="$API/admin/heritage/requests"

echo "==> student submits requests"
student -X POST "$API/student/leave-of-absence" -d "{\"reason\":\"Family medical emergency $STAMP\",\"startsOn\":\"2026-11-02\",\"endsOn\":\"2026-12-18\"}" >/dev/null
student -X POST "$API/me/profile-change-requests" -d "{\"givenName\":\"Marcus\",\"familyName\":\"Vance-$STAMP\",\"preferredName\":\"Marc\",\"primaryEmail\":\"marcus.$STAMP@example.com\",\"phone\":\"604-555-0199\",\"emergencyContactName\":\"Rita Vance\",\"emergencyContactPhone\":\"604-555-0100\",\"reason\":\"Legal name change after marriage\"}" >/dev/null
student -X POST "$API/student/services" -d "{\"type\":\"course_withdrawal\",\"subject\":\"Withdraw from ACC-101 $STAMP\",\"details\":\"Schedule conflict with clinical placement.\"}" >/dev/null
student -X POST "$API/student/services" -d "{\"type\":\"academic_appeal\",\"subject\":\"Grade dispute $STAMP\",\"details\":\"Requesting a review of my final mark.\"}" >/dev/null
echo "OK"

echo "==> sidebar counts + meta"
admin "$R/counts" | json '"total=%d %s" % (d["total"], d["byType"])'
admin "$R/meta" | json '"forms=%s types=%d" % (d["forms"], len(d["types"]))'

num() { admin "$R?status=Pending&perPage=500&$1" | json "next(str(i['number']) for i in d['items'] if $2)"; }
LOA="$(num 'type=Student+Requests' "i['form']=='Leave of Absence Application'")"
WD="$(num 'type=Student+Requests' "i['form']=='Withdraw'")"
PC="$(num 'type=Profile+Changes' "True")"
AP="$(num 'type=Incidents+%2F+Disputes' "True")"
echo "LOA=#$LOA Withdraw=#$WD Profile=#$PC Appeal=#$AP"

echo "==> listing filters"
admin "$R?request=$LOA&status=all" | json '"by request #: %d row(s) %s" % (d["total"], [i["form"] for i in d["items"]])'
admin "$R?user=vance&status=all&perPage=500" | json '"by last name: %d row(s)" % d["total"]'
admin "$R?type=E-mail+Changes" | json '"e-mail changes: %d row(s)" % d["total"]'

echo "==> leave of absence: review, edit, approve"
admin "$R/$LOA" | json '"%s %s %s→%s settings=%s profiles=%d" % (d["form"], d["status"], d["loa"]["startsOn"], d["loa"]["endsOn"], d["settings"]["type"], len(d["programProfiles"]))'
admin -X PATCH "$R/$LOA" -d '{"loa":{"reason":"Family medical emergency (updated)","startsOn":"2026-11-09","endsOn":"2026-12-18"}}' | json 'd["message"]'
admin -X POST "$R/$LOA/approve" -d '{"comments":"Approved by registrar","settings":{"type":"By dates","absenceStart":"2026-11-09","returning":"2027-01-05","programProfile":"primary","enrolmentsAction":"No action","changeStatus":"Leave of Absence","returningStatus":"Active Student"}}' | json 'd["message"]'
admin "$R/$LOA" | json '"status=%s comments=%r returning=%s" % (d["status"], d["comments"], d["settings"]["returning"])'
code="$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AD" -H "content-type: application/json" -X POST "$R/$LOA/approve" -d '{}')"
[ "$code" = "409" ] && echo "OK second approve rejected (409)" || { echo "FAIL second approve returned $code"; exit 1; }
student "$API/student/leave-of-absence" | json '"student sees: %s" % d["requests"][0]["status"]'

echo "==> profile change: edit (8 fields), approve"
admin -X PATCH "$R/$PC" -d "{\"profile\":{\"familyName\":\"Vance-$STAMP\",\"givenName\":\"Marcus\",\"middleName\":\"J\",\"preferredName\":\"Marc\",\"phone\":\"604-555-0199\",\"primaryEmail\":\"marcus.$STAMP@example.com\",\"emergencyContactName\":\"Rita Vance\",\"emergencyContactPhone\":\"604-555-0100\"}}" | json 'd["message"]'
admin "$R/$PC" | json '"requested middle=%s current last=%s" % (d["profile"]["requested"]["middleName"], d["profile"]["current"]["familyName"])'
admin -X POST "$R/$PC/approve" -d '{"comments":"ID verified"}' | json 'd["message"]'
student "$API/me/profile" | json '"student profile now: %s, %s <%s>" % (d["familyName"], d["givenName"], d["primaryEmail"])'

echo "==> withdraw: decline"
admin -X POST "$R/$WD/decline" -d '{"comments":"Past the withdrawal deadline"}' | json 'd["message"]'

echo "==> appeal: delete"
admin -X DELETE "$R/$AP" | json 'd["message"]'
code="$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AD" "$R/$AP")"
[ "$code" = "404" ] && echo "OK deleted request is gone (404)" || { echo "FAIL deleted request returned $code"; exit 1; }
student "$API/student/services" | json '"student services: %s" % sorted({r["status"] for r in d["requests"]})'

echo "==> final counts"
admin "$R/counts" | json '"total=%d %s" % (d["total"], d["byType"])'
admin "$R?status=all&perPage=500" | json '"all statuses: %s" % sorted({i["status"] for i in d["items"]})'
echo "DONE"
