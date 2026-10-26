#!/usr/bin/env bash
# Smoke test for My Courses (/admin/heritage/my-courses/*).
# Seeds a teaching fixture for the admin account (two offerings of one course, plus active, upcoming and
# completed offerings), then checks every screen's data, attendance save rules, filters and sidebar counts.
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/heritage API_URL=http://127.0.0.1:4100 ./deploy/smoke-my-courses.sh
#   CLEANUP=1 removes the fixture afterwards.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${API_URL:-http://127.0.0.1:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@heritage.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Heritage!2026}"
: "${DATABASE_URL:?DATABASE_URL is required to seed the fixture}"
STAMP="$(date +%s)"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1], {'d': d}))" "$1"; }
AD="$(curl -fsS -X POST "$API/auth/login" -H "content-type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"deviceFingerprint\":\"smoke-my-courses-01\"}" | json 'd["accessToken"]')"
M="$API/admin/heritage/my-courses"
get() { curl -fsS -H "authorization: Bearer $AD" "$M$1"; }
check() { # check <label> <python-bool-expr over d> <path>
  local out; out="$(get "$3")"
  if [ "$(echo "$out" | json "bool($2)")" = "True" ]; then echo "OK $1"; else echo "FAIL $1: $out"; exit 1; fi
}
expect() { # expect <code> <label> <method> <path> <body>
  local out code
  out="$(curl -s -w '\n%{http_code}' -X "$3" -H "authorization: Bearer $AD" -H "content-type: application/json" "$M$4" -d "$5")"
  code="${out##*$'\n'}"
  [ "$code" = "$1" ] && echo "OK $2 ($code): $(echo "${out%$'\n'*}" | json 'd.get("message") or d.get("error",{}).get("message","")' 2>/dev/null)" \
    || { echo "FAIL $2 returned $code: ${out%$'\n'*}"; exit 1; }
}

TODAY="$(get /attendance | json 'd["date"]')"
echo "==> seeding fixture (institution today $TODAY, stamp $STAMP)"
FIX="$(cd "$ROOT/packages/db" && STAMP="$STAMP" TODAY="$TODAY" ADMIN_EMAIL="$ADMIN_EMAIL" node --input-type=module - <<'NODE'
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const { STAMP, TODAY, ADMIN_EMAIL } = process.env;
const day = (n) => { const d = new Date(`${TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const at = (date, hm) => new Date(`${date}T${hm}:00Z`);
const account = await p.account.findFirstOrThrow({ where: { email: ADMIN_EMAIL } });
const inst = account.institutionId;
const term = await p.term.create({ data: { institutionId: inst, code: `MCS${STAMP}`, name: `My Courses Smoke ${STAMP}`, startsOn: day(-90), endsOn: day(90) } });
const course = async (code, title) =>
  (await p.course.findFirst({ where: { institutionId: inst, code } })) ?? (await p.course.create({ data: { institutionId: inst, code, title, credits: 3 } }));
const beth = await course("BETH 190", "Bioethics");
const acsw = await course("ACSW 100", "Addictions Fundamentals");
const later = await course(`MCU ${STAMP}`, "Upcoming Smoke Course");
const done = await course(`MCC ${STAMP}`, "Completed Smoke Course");
const section = (courseId, code) => p.section.create({ data: { institutionId: inst, courseId, termId: term.id, code, instructorPersonId: account.personId } });
const sessions = async (s, from, to, everyDays, hm, location, deliveryMode = "in_person") => {
  for (let n = from; n <= to; n += everyDays) {
    const d = day(n);
    await p.classSession.create({ data: { institutionId: inst, sectionId: s.id, title: "Lecture", startsAt: at(d, hm[0]), endsAt: at(d, hm[1]), location, deliveryMode } });
  }
};
const a = await section(beth.id, `MC${STAMP}-A`);
const b = await section(beth.id, `MC${STAMP}-B`);
const c = await section(acsw.id, `MC${STAMP}-C`);
const u = await section(later.id, `MC${STAMP}-U`);
const h = await section(done.id, `MC${STAMP}-H`);
await sessions(a, -14, 28, 7, ["17:00", "18:30"], "Room 204");
await sessions(b, -7, 21, 7, ["20:00", "21:00"], null, "online");
await sessions(u, 10, 40, 7, ["16:00", "17:00"], "Room 101");
await sessions(h, -60, -20, 7, ["15:00", "16:00"], "Lab 3");
const students = await p.student.findMany({ where: { institutionId: inst }, orderBy: { studentNumber: "asc" }, take: 2 });
if (students.length < 2) throw new Error("Need at least two students in the database");
const enrol = {};
for (const s of [a, b, c, h]) for (const st of students) enrol[`${s.id}:${st.id}`] = await p.enrolment.create({ data: { institutionId: inst, sectionId: s.id, studentId: st.id } });
const assignment = (s) => p.assignment.create({ data: { institutionId: inst, sectionId: s.id, title: "Final", maxScore: 100, weightPercent: 100 } });
await assignment(a);
const ab = await assignment(b);
const ah = await assignment(h);
const ac = await assignment(c);
for (const [as, s, status] of [[ab, b, "pending_publish"], [ah, h, "published"], [ac, c, "published"]]) {
  for (const st of students) {
    await p.gradeItem.create({ data: { institutionId: inst, assignmentId: as.id, studentId: st.id, enrolmentId: enrol[`${s.id}:${st.id}`].id, score: 88, maxScore: 100, status } });
  }
}
const approval = (type, s) => p.approvalRequest.create({ data: { institutionId: inst, type, subjectRef: s.id, proposedDiffJson: "{}", requestedBy: account.id, requiredApproverRolesJson: "[\"instructor\"]", requiredCount: 1 } });
await approval("course_session_new", a);
await approval("course_session_change", u);
const other = await p.section.findFirst({ where: { institutionId: inst, NOT: { instructorPersonId: account.personId } }, select: { id: true } });
console.log(JSON.stringify({ termId: term.id, A: a.id, B: b.id, C: c.id, U: u.id, H: h.id, S1: students[0].id, S1N: students[0].studentNumber, S2: students[1].id, other: other?.id ?? "" }));
await p.$disconnect();
NODE
)"
echo "$FIX"
f() { echo "$FIX" | json "d['$1']"; }
A="$(f A)"; B="$(f B)"; C="$(f C)"; U="$(f U)"; H="$(f H)"; S1="$(f S1)"; S1N="$(f S1N)"; S2="$(f S2)"; OTHER="$(f other)"

echo "==> sidebar"
check "nav marks the admin as instructor" 'd["instructor"] is True' /nav
check "both BETH 190 offerings listed separately under ACTIVE COURSES" "len([x for x in d['activeCourses'] if x['id'] in ('$A','$B')]) == 2" /nav
check "upcoming/completed offerings not in ACTIVE COURSES" "not [x for x in d['activeCourses'] if x['id'] in ('$U','$H')]" /nav

echo "==> All My Courses / Schedule"
check "default filter shows active + upcoming" "{'$A','$B','$C','$U'} <= {r['id'] for r in d['rows']} and '$H' not in {r['id'] for r in d['rows']}" /schedule
check "Upcoming Courses filter" "[r['id'] for r in d['rows'] if r['id'] in ('$A','$B','$C','$U','$H')] == ['$U']" "/schedule?status=Upcoming%20Courses"
check "Completed Courses filter" "[r['id'] for r in d['rows'] if r['id'] in ('$A','$B','$C','$U','$H')] == ['$H']" "/schedule?status=Completed%20Courses"
check "row fields (role, enrolled, location, day-wise schedule)" "[(r['role'], r['enrolled'], r['location'], r['status'], bool(r['days'])) for r in d['rows'] if r['id']=='$A'] == [('Instructor', 2, 'Room 204', 'In Progress', True)]" /schedule
check "missing location shows TBD, online delivery" "[(r['location'], r['delivery']) for r in d['rows'] if r['id']=='$B'] == [('TBD', 'Online')]" /schedule
check "no sessions falls back to term dates" "[r['dates'] != 'Continuous' for r in d['rows'] if r['id']=='$C'] == [True]" /schedule
check "term filter option present" "'My Courses Smoke $STAMP' in d['termOptions']" /schedule

echo "==> Course Evaluations"
check "evaluations exclude upcoming, include completed" "'$U' not in {r['id'] for r in d['rows']} and '$H' in {r['id'] for r in d['rows']} and all(r['evaluation']=='End of course evaluation' for r in d['rows'])" /evaluations

echo "==> Course History"
check "history lists completed offering with room" "[(r['room'], bool(r['days'])) for r in d['rows'] if r['id']=='$H'] == [('Lab 3', True)]" /history

echo "==> Course Repository"
check "repository shows only own course codes" "all(r['number'] in ('BETH 190','ACSW 100') or r['number'].startswith('MC') for r in d['rows']) and any(r['number']=='ACSW 100' for r in d['rows'])" /repository
check "repository search filter" "all('acsw' in (r['number']+' '+r['name']).lower() for r in d['rows'])" "/repository?course=acsw"
check "repository no match" 'd["rows"] == []' "/repository?course=zzzz-no-such-course"

echo "==> Pending Course Schedules"
check "all types" "{r['sectionId'] for r in d['rows']} >= {'$A','$U'}" /pending-schedules
check "New Sessions Only" "[r['changeType'] for r in d['rows'] if r['sectionId'] in ('$A','$U')] == ['New Session']" "/pending-schedules?type=New%20Sessions%20Only"
check "Changes Only" "[r['changeType'] for r in d['rows'] if r['sectionId'] in ('$A','$U')] == ['Schedule Change']" "/pending-schedules?type=Changes%20Only"

echo "==> Grades Submission"
check "Submission Required (no grades yet)" "'$A' in {r['id'] for r in d['rows']} and all(r['status']=='Submission Required' and r['gradingType']=='Final Grades' for r in d['rows'])" /grades
check "Pending (awaiting approval)" "'$B' in {r['id'] for r in d['rows']}" "/grades?status=Pending"
check "Approved" "{'$C','$H'} <= {r['id'] for r in d['rows']}" "/grades?status=Approved"
check "course filter" "[r['id'] for r in d['rows']] == ['$B']" "/grades?status=Pending&course=$B"
REQ="$(get /grades | json 'd["requiredCount"]')"
check "sidebar count equals Submission Required rows" "d['gradesSubmission'] == $REQ" /counts

echo "==> Submit Grades"
check "submit page loads own offering" "d['id']=='$A' and d['status']=='Submission Required'" "/grades/$A"
if [ -n "$OTHER" ]; then
  expect 404 "another instructor's offering not on the submission list" GET "/grades/$OTHER" ""
fi
BOOK="$(curl -fsS -H "authorization: Bearer $AD" "$API/gradebooks/$A")"
ASG="$(echo "$BOOK" | json 'd["assignments"][0]["id"]')"
ITEMS=""
for st in $(echo "$BOOK" | json '" ".join(r["studentId"] for r in d["rows"])'); do
  id="$(curl -fsS -X POST -H "authorization: Bearer $AD" -H "content-type: application/json" "$API/grade-items" \
    -d "{\"assignmentId\":\"$ASG\",\"studentId\":\"$st\",\"score\":80}" | json 'd["id"]')"
  ITEMS="$ITEMS${ITEMS:+,}\"$id\""
done
curl -fsS -X POST -H "authorization: Bearer $AD" -H "content-type: application/json" -H "idempotency-key: smoke-mc-$STAMP" \
  "$API/gradebooks/$A/publish" -d "{\"gradeItemIds\":[$ITEMS]}" > /dev/null && echo "OK grades submitted for approval"
check "submitted offering moves to Pending" "d['status']=='Pending'" "/grades/$A"
check "sidebar count drops by one" "d['gradesSubmission'] == $REQ - 1" /counts

echo "==> Course Attendance"
check "today's roster groups both BETH 190 offerings" "{g['course']['id'] for g in d['groups']} >= {'$A','$B'}" "/attendance?date=$TODAY"
check "upcoming offering not on today's roster" "'$U' not in {g['course']['id'] for g in d['groups']}" "/attendance?date=$TODAY"
check "unrecorded day shows the banner" "d['banner']=='Attendance has not yet been recorded for this day.'" "/attendance?date=$TODAY&course=$A"
check "Attendance Records and Total Students are separate counts" "d['records'] > d['totalStudents'] >= 2" "/attendance?date=$TODAY"
check "course filter" "[g['course']['id'] for g in d['groups']] == ['$A']" "/attendance?date=$TODAY&course=$A"
check "student filter by number" "[s['id'] for g in d['groups'] for s in g['students']] == ['$S1']" "/attendance?date=$TODAY&course=$A&student=$S1N"
expect 400 "save with nothing marked rejected" PUT /attendance "{\"date\":\"$TODAY\",\"marks\":[{\"sectionId\":\"$A\",\"studentId\":\"$S1\",\"status\":\"\",\"note\":\"\"}]}"
expect 400 "offering that does not run that day rejected" PUT /attendance "{\"date\":\"$TODAY\",\"marks\":[{\"sectionId\":\"$U\",\"studentId\":\"$S1\",\"status\":\"present\",\"note\":\"\"}]}"
if [ -n "$OTHER" ]; then
  expect 403 "another instructor's course rejected" PUT /attendance "{\"date\":\"$TODAY\",\"marks\":[{\"sectionId\":\"$OTHER\",\"studentId\":\"$S1\",\"status\":\"present\",\"note\":\"\"}]}"
fi
expect 200 "save attendance" PUT /attendance "{\"date\":\"$TODAY\",\"marks\":[{\"sectionId\":\"$A\",\"studentId\":\"$S1\",\"status\":\"present\",\"note\":\"Arrived on time\"},{\"sectionId\":\"$A\",\"studentId\":\"$S2\",\"status\":\"absent\",\"note\":\"Called in sick\"}]}"
check "marks and notes persisted, banner cleared" "sorted((s['status'], s['note']) for g in d['groups'] for s in g['students']) == [('absent','Called in sick'),('present','Arrived on time')] and d['banner']==''" "/attendance?date=$TODAY&course=$A"
expect 200 "update one mark and clear another" PUT /attendance "{\"date\":\"$TODAY\",\"marks\":[{\"sectionId\":\"$A\",\"studentId\":\"$S1\",\"status\":\"absent\",\"note\":\"Left early\"},{\"sectionId\":\"$A\",\"studentId\":\"$S2\",\"status\":\"\",\"note\":\"\"}]}"
check "update persisted without duplicates" "sorted((s['status'], s['note']) for g in d['groups'] for s in g['students']) == [('', ''), ('absent','Left early')]" "/attendance?date=$TODAY&course=$A"

echo "==> registry screens point at the dedicated pages"
for pair in MC01:/admin/my-courses MC02:/admin/my-courses/attendance MC03:/admin/my-courses/repository MC04:/admin/my-courses/pending-schedules MC05:/admin/my-courses/grades MC06:/admin/my-courses/history; do
  s="${pair%%:*}"; want="${pair#*:}"
  got="$(curl -fsS -H "authorization: Bearer $AD" "$API/admin/heritage/screens/$s" | json 'd.get("dedicated")')"
  [ "$got" = "$want" ] && echo "OK registry $s -> $got" || { echo "FAIL registry $s -> $got (want $want)"; exit 1; }
done

if [ "${CLEANUP:-0}" = "1" ]; then
  echo "==> cleanup"
  (cd "$ROOT/packages/db" && FIX="$FIX" STAMP="$STAMP" node --input-type=module - <<'NODE'
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const f = JSON.parse(process.env.FIX);
const ids = [f.A, f.B, f.C, f.U, f.H];
await p.approvalRequest.deleteMany({ where: { subjectRef: { in: [...ids, ...ids.map((id) => `section:${id}`)] } } });
await p.gradeItem.deleteMany({ where: { assignment: { sectionId: { in: ids } } } });
await p.assignment.deleteMany({ where: { sectionId: { in: ids } } });
await p.attendanceRecord.deleteMany({ where: { sectionId: { in: ids } } });
await p.enrolment.deleteMany({ where: { sectionId: { in: ids } } });
await p.classSession.deleteMany({ where: { sectionId: { in: ids } } });
await p.section.deleteMany({ where: { id: { in: ids } } });
await p.term.delete({ where: { id: f.termId } });
await p.course.deleteMany({ where: { code: { in: [`MCU ${process.env.STAMP}`, `MCC ${process.env.STAMP}`] } } });
await p.$disconnect();
console.log("fixture removed");
NODE
  )
fi
echo "==> My Courses smoke passed"
