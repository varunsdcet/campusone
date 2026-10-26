/**
 * My Courses — the teaching workspace of the signed-in person (instructor portal and Super Admin).
 * Every query is scoped to sections where the caller is the assigned instructor.
 */
import { requireApproval } from "@myheritage/auth";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import type { SessionClaims } from "@myheritage/contracts";
import { randomUUID } from "node:crypto";
import { addDays, hmIn, institutionTimezone, ymdIn } from "../../lib/workshopPolicy.js";
import { REPOSITORY_LIST_PATH, buildRepositoryCatalog, mergeRepositoryList } from "./courseContentScreens.js";
import { assignedFacultySectionIds } from "./sectionFaculty.js";

export const COURSE_STATUS_FILTERS = ["Active & Upcoming Courses", "Active Courses", "Upcoming Courses", "Completed Courses"] as const;
export const GRADE_SUBMISSION_STATUSES = ["Submission Required", "Pending", "Approved"] as const;
export const SCHEDULE_CHANGE_TYPES = ["All Types", "New Sessions Only", "Changes Only"] as const;
/** ApprovalRequest.type values for schedule items awaiting the assigned instructor. */
export const SCHEDULE_APPROVAL_TYPES = { newSession: "course_session_new", change: "course_session_change" } as const;
export const EVALUATION_TYPE = "End of course evaluation";

export type CourseStatusFilter = (typeof COURSE_STATUS_FILTERS)[number];
export type GradeSubmissionStatus = (typeof GRADE_SUBMISSION_STATUSES)[number];
type Phase = "active" | "upcoming" | "completed";
export type ScheduleDay = { day: string; start: string; end: string };
export type Option = { value: string; label: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const WEEKDAYS = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DELIVERY: Record<string, string> = { in_person: "In Person", online: "Online", hybrid: "Hybrid" };
const PHASE_LABEL: Record<Phase, string> = { active: "In Progress", upcoming: "Upcoming", completed: "Completed" };

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const lower = (v: string) => v.toLowerCase();

export function fmtDate(iso: string) {
  if (!ISO.test(iso.slice(0, 10))) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
export function fmtWeekday(iso: string) {
  return WEEKDAYS[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()];
}
function clock12(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

async function clock(institutionId: string) {
  const tz = await institutionTimezone(institutionId);
  return { tz, today: ymdIn(new Date(), tz) };
}

/* ------------------------------------------------------------------ */
/* Offerings                                                            */
/* ------------------------------------------------------------------ */

type SessionRow = { id: string; startsAt: Date; endsAt: Date | null; location: string | null; deliveryMode: string };
type SectionRow = {
  id: string;
  code: string;
  courseId: string;
  course: { code: string; title: string };
  term: { code: string; name: string; startsOn: string; endsOn: string };
  classSessions: SessionRow[];
  _count: { enrolments: number };
};

export type Offering = {
  id: string;
  courseId: string;
  code: string;
  offering: string;
  title: string;
  term: string;
  termCode: string;
  start: string;
  end: string;
  continuous: boolean;
  dates: string;
  datesWithWeekday: string;
  days: ScheduleDay[];
  location: string;
  delivery: string;
  enrolled: number;
  phase: Phase;
  status: string;
};

function weeklyPattern(sessions: SessionRow[], tz: string): ScheduleDay[] {
  const byDay = new Map<number, Map<string, number>>();
  for (const x of sessions) {
    const day = weekdayOf(ymdIn(x.startsAt, tz));
    const slot = `${hmIn(x.startsAt, tz)}|${x.endsAt ? hmIn(x.endsAt, tz) : ""}`;
    const slots = byDay.get(day) ?? new Map<string, number>();
    slots.set(slot, (slots.get(slot) ?? 0) + 1);
    byDay.set(day, slots);
  }
  return DAY_ORDER.filter((d) => byDay.has(d)).map((d) => {
    const [slot] = [...byDay.get(d)!.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const [start, end] = slot.split("|");
    return { day: DAY_NAMES[d]!, start: clock12(start!), end: end ? clock12(end) : "" };
  });
}

function offeringOf(sec: SectionRow, tz: string, today: string): Offering {
  const sessions = sec.classSessions;
  let start = "";
  let end = "";
  if (sessions.length) {
    const starts = sessions.map((x) => ymdIn(x.startsAt, tz)).sort();
    const ends = sessions.map((x) => ymdIn(x.endsAt ?? x.startsAt, tz)).sort();
    start = starts[0]!;
    end = ends[ends.length - 1]!;
  } else if (ISO.test(sec.term.startsOn.slice(0, 10)) && ISO.test(sec.term.endsOn.slice(0, 10))) {
    start = sec.term.startsOn.slice(0, 10);
    end = sec.term.endsOn.slice(0, 10);
  }
  const continuous = !start || !end;
  const phase: Phase = continuous ? "active" : start > today ? "upcoming" : end < today ? "completed" : "active";
  const deliveries = [...new Set(sessions.map((x) => DELIVERY[x.deliveryMode] ?? x.deliveryMode).filter(Boolean))];
  return {
    id: sec.id,
    courseId: sec.courseId,
    code: sec.course.code,
    offering: sec.code,
    title: sec.course.title,
    term: sec.term.name || sec.term.code,
    termCode: sec.term.code,
    start,
    end,
    continuous,
    dates: continuous ? "Continuous" : start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`,
    datesWithWeekday: continuous
      ? "Continuous"
      : start === end
        ? `${fmtDate(start)} (${fmtWeekday(start)})`
        : `${fmtDate(start)} (${fmtWeekday(start)}) – ${fmtDate(end)} (${fmtWeekday(end)})`,
    days: weeklyPattern(sessions, tz),
    location: sessions.find((x) => x.location?.trim())?.location?.trim() ?? "",
    delivery: deliveries.join(" / "),
    enrolled: sec._count.enrolments,
    phase,
    status: PHASE_LABEL[phase],
  };
}

const byCourse = (a: Offering, b: Offering) => a.code.localeCompare(b.code) || a.offering.localeCompare(b.offering);

async function myOfferings(user: SessionClaims, sectionIds?: string[]) {
  const { tz, today } = await clock(user.institutionId);
  const assignedIds = await assignedFacultySectionIds(user, sectionIds);
  const rows = await prisma.section.findMany({
    where: {
      institutionId: user.institutionId,
      id: { in: [...assignedIds] },
    },
    include: {
      course: { select: { code: true, title: true } },
      term: { select: { code: true, name: true, startsOn: true, endsOn: true } },
      classSessions: { select: { id: true, startsAt: true, endsAt: true, location: true, deliveryMode: true }, orderBy: { startsAt: "asc" } },
      _count: { select: { enrolments: { where: { status: "enrolled" } } } },
    },
  });
  return { tz, today, offerings: rows.map((r) => offeringOf(r, tz, today)).sort(byCourse) };
}

export const offeringLabel = (o: Pick<Offering, "code" | "offering" | "title">) => `${o.code} (${o.offering}) — ${o.title}`;

/* ------------------------------------------------------------------ */
/* All My Courses / Schedule + sidebar Active Courses                   */
/* ------------------------------------------------------------------ */

export async function mySchedule(user: SessionClaims, q: { term?: string; status?: string }) {
  const { offerings } = await myOfferings(user);
  const termNames = [...new Map(offerings.map((o) => [o.termCode, o.term])).values()].sort((a, b) => a.localeCompare(b));
  const termOptions = ["All Terms", ...termNames];
  const term = termOptions.includes(s(q.term)) ? s(q.term) : "All Terms";
  const status = (COURSE_STATUS_FILTERS as readonly string[]).includes(s(q.status)) ? (s(q.status) as CourseStatusFilter) : COURSE_STATUS_FILTERS[0];
  const phases: Record<CourseStatusFilter, Phase[]> = {
    "Active & Upcoming Courses": ["active", "upcoming"],
    "Active Courses": ["active"],
    "Upcoming Courses": ["upcoming"],
    "Completed Courses": ["completed"],
  };
  const rows = offerings
    .filter((o) => term === "All Terms" || o.term === term)
    .filter((o) => phases[status].includes(o.phase))
    .map((o) => ({ ...o, role: "Instructor", location: o.location || "TBD" }));
  return { termOptions, statusOptions: [...COURSE_STATUS_FILTERS], term, status, rows };
}

export async function activeCourseLinks(user: SessionClaims) {
  const { offerings } = await myOfferings(user);
  return offerings.filter((o) => o.phase === "active").map((o) => ({ id: o.id, courseId: o.courseId, code: o.code, offering: o.offering, title: o.title }));
}

/** Sidebar shape: a caller who teaches gets ACTIVE COURSES + Course Evaluations; otherwise the plain Super Admin list. */
export async function myCoursesNav(user: SessionClaims) {
  const [{ offerings }, counts] = await Promise.all([myOfferings(user), myCoursesCounts(user)]);
  return {
    instructor: offerings.length > 0,
    activeCourses: offerings
      .filter((o) => o.phase === "active")
      .map((o) => ({ id: o.id, courseId: o.courseId, code: o.code, offering: o.offering, title: o.title })),
    counts,
  };
}

/* ------------------------------------------------------------------ */
/* Course Evaluations / Course History                                  */
/* ------------------------------------------------------------------ */

export async function evaluationList(user: SessionClaims) {
  const { offerings } = await myOfferings(user);
  const rows = offerings
    .filter((o) => o.phase !== "upcoming")
    .sort((a, b) => (b.start || "").localeCompare(a.start || "") || byCourse(a, b))
    .map((o) => ({ ...o, evaluation: EVALUATION_TYPE }));
  return { rows };
}

export async function courseHistory(user: SessionClaims) {
  const { offerings } = await myOfferings(user);
  const rows = offerings
    .filter((o) => o.phase === "completed")
    .sort((a, b) => b.end.localeCompare(a.end) || byCourse(a, b))
    .map((o) => ({ ...o, room: o.location }));
  return { rows };
}

/* ------------------------------------------------------------------ */
/* Course Attendance                                                    */
/* ------------------------------------------------------------------ */

const covers = (o: Offering, date: string) => o.continuous || (o.start <= date && date <= o.end);

async function rosters(institutionId: string, sectionIds: string[]) {
  if (!sectionIds.length) return new Map<string, Array<{ id: string; name: string; familyName: string; studentNumber: string }>>();
  const rows = await prisma.enrolment.findMany({
    where: { institutionId, sectionId: { in: sectionIds }, status: "enrolled" },
    select: { sectionId: true, student: { select: { id: true, studentNumber: true, person: { select: { givenName: true, familyName: true } } } } },
  });
  const out = new Map<string, Array<{ id: string; name: string; familyName: string; studentNumber: string }>>();
  for (const r of rows) {
    const list = out.get(r.sectionId) ?? [];
    if (list.some((x) => x.id === r.student.id)) continue;
    list.push({
      id: r.student.id,
      name: `${r.student.person.givenName} ${r.student.person.familyName}`.trim(),
      familyName: r.student.person.familyName,
      studentNumber: r.student.studentNumber,
    });
    out.set(r.sectionId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.familyName.localeCompare(b.familyName) || a.name.localeCompare(b.name));
  return out;
}

export type AttendanceMark = "" | "present" | "absent";

export async function attendanceDay(user: SessionClaims, q: { date?: string; student?: string; course?: string }) {
  const { today, offerings } = await myOfferings(user);
  const date = ISO.test(s(q.date)) ? s(q.date) : today;
  const needle = lower(s(q.student));
  const meeting = offerings.filter((o) => covers(o, date));
  const courseOptions: Option[] = [{ value: "", label: "All Courses" }, ...meeting.map((o) => ({ value: o.id, label: offeringLabel(o) }))];
  const course = meeting.some((o) => o.id === s(q.course)) ? s(q.course) : "";
  const shown = meeting.filter((o) => !course || o.id === course);
  const roster = await rosters(user.institutionId, shown.map((o) => o.id));
  const marks = shown.length
    ? await prisma.attendanceRecord.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: shown.map((o) => o.id) }, meetingLabel: date },
        orderBy: { recordedAt: "desc" },
        select: { sectionId: true, studentId: true, status: true, note: true },
      })
    : [];
  const markBy = new Map<string, { status: string; note: string }>();
  for (const m of marks) if (!markBy.has(`${m.sectionId}:${m.studentId}`)) markBy.set(`${m.sectionId}:${m.studentId}`, m);
  const groups = shown
    .map((o) => ({
      course: { id: o.id, courseId: o.courseId, code: o.code, offering: o.offering, title: o.title, dates: o.dates },
      students: (roster.get(o.id) ?? [])
        .filter((st) => !needle || lower(st.studentNumber).includes(needle) || lower(st.familyName).includes(needle))
        .map((st) => {
          const m = markBy.get(`${o.id}:${st.id}`);
          const status: AttendanceMark = m && (m.status === "absent" || m.status === "present") ? m.status : m ? "present" : "";
          return { id: st.id, name: st.name, studentNumber: st.studentNumber, status, note: m?.note ?? "" };
        }),
    }))
    .filter((g) => g.students.length);
  const records = groups.reduce((n, g) => n + g.students.length, 0);
  const totalStudents = new Set(groups.flatMap((g) => g.students.map((st) => st.id))).size;
  const recorded = groups.some((g) => g.students.some((st) => st.status));
  return {
    date,
    weekday: fmtWeekday(date),
    label: fmtDate(date),
    previous: addDays(date, -1),
    next: addDays(date, 1),
    student: s(q.student),
    course,
    courseOptions,
    groups,
    records,
    totalStudents,
    recorded,
    banner: records && !recorded ? "Attendance has not yet been recorded for this day." : "",
  };
}

export async function saveCourseAttendance(
  user: SessionClaims,
  body: { date?: string; marks?: Array<{ sectionId?: string; studentId?: string; status?: string; note?: string }> },
) {
  const date = s(body.date);
  if (!ISO.test(date)) throw httpError(400, "Choose a valid attendance date");
  const marks = (body.marks ?? []).map((m) => ({ sectionId: s(m.sectionId), studentId: s(m.studentId), status: lower(s(m.status)), note: s(m.note).slice(0, 500) }));
  if (!marks.length) throw httpError(400, "There is no attendance to save");
  for (const m of marks) if (!["present", "absent", ""].includes(m.status)) throw httpError(400, "Attendance must be Present or Absent");
  const sectionIds = [...new Set(marks.map((m) => m.sectionId))];
  const { tz, offerings } = await myOfferings(user, sectionIds);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const roster = await rosters(user.institutionId, sectionIds);
  for (const m of marks) {
    const o = byId.get(m.sectionId);
    if (!o) throw httpError(403, "Attendance refers to a course that is not assigned to you", "FORBIDDEN");
    if (!covers(o, date)) throw httpError(400, `${o.code} (${o.offering}) does not run on ${fmtDate(date)}`);
    if (!(roster.get(o.id) ?? []).some((st) => st.id === m.studentId)) throw httpError(400, `A student is not enrolled in ${o.code} (${o.offering})`);
  }
  const existing = await prisma.attendanceRecord.findMany({
    where: { institutionId: user.institutionId, sectionId: { in: sectionIds }, meetingLabel: date },
    orderBy: { recordedAt: "desc" },
    select: { id: true, sectionId: true, studentId: true, status: true, note: true },
  });
  const rowsFor = (m: { sectionId: string; studentId: string }) => existing.filter((r) => r.sectionId === m.sectionId && r.studentId === m.studentId);
  if (!marks.some((m) => m.status || rowsFor(m).length)) throw httpError(400, "Mark at least one student Present or Absent before saving");
  const sessions = await prisma.classSession.findMany({
    where: { institutionId: user.institutionId, sectionId: { in: sectionIds } },
    select: { id: true, sectionId: true, startsAt: true },
    orderBy: { startsAt: "asc" },
  });
  const sessionOn = new Map<string, string>();
  for (const x of sessions) if (ymdIn(x.startsAt, tz) === date && !sessionOn.has(x.sectionId)) sessionOn.set(x.sectionId, x.id);
  let saved = 0;
  let cleared = 0;
  await prisma.$transaction(async (tx) => {
    for (const m of marks) {
      const [current, ...dupes] = rowsFor(m);
      if (dupes.length) await tx.attendanceRecord.deleteMany({ where: { id: { in: dupes.map((d) => d.id) } } });
      if (!m.status) {
        if (current) {
          await tx.attendanceRecord.delete({ where: { id: current.id } });
          cleared += 1;
        }
        continue;
      }
      if (current) {
        if (current.status !== m.status || current.note !== m.note) {
          await tx.attendanceRecord.update({ where: { id: current.id }, data: { status: m.status, note: m.note, recordedAt: new Date(), rowVersion: { increment: 1 } } });
        }
      } else {
        await tx.attendanceRecord.create({
          data: {
            institutionId: user.institutionId,
            studentId: m.studentId,
            sectionId: m.sectionId,
            classSessionId: sessionOn.get(m.sectionId) ?? null,
            meetingLabel: date,
            status: m.status,
            note: m.note,
          },
        });
      }
      saved += 1;
    }
  });
  void import("../campusCompliance/sweep.js")
    .then(({ escalateStudentMisses }) => escalateStudentMisses(user.institutionId))
    .catch(() => undefined);
  const parts = [`${saved} attendance record${saved === 1 ? "" : "s"} saved`];
  if (cleared) parts.push(`${cleared} cleared`);
  return { saved, cleared, message: `Attendance for ${fmtDate(date)} (${fmtWeekday(date)}): ${parts.join(", ")}` };
}

/* ------------------------------------------------------------------ */
/* Course Repository (personal)                                         */
/* ------------------------------------------------------------------ */

/** Course Management → Repository content courses (heritageRecord "CM:REPOSITORY") for the given courses. */
async function managedRepositories(institutionId: string, courses: Map<string, { code: string; title: string }>) {
  if (!courses.size) return [];
  const recs = await prisma.heritageRecord.findMany({
    where: { institutionId, screenId: "CM:REPOSITORY", deletedAt: null, singletonKey: null },
    select: { id: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  return recs.flatMap((r) => {
    let d: Record<string, unknown> = {};
    try {
      d = JSON.parse(r.dataJson) as Record<string, unknown>;
    } catch {
      return [];
    }
    const course = courses.get(s(d.course));
    if (!course) return [];
    return [{ id: r.id, courseId: s(d.course), number: course.code, name: s(d.name) || course.title, lms: `Moodle · ${s(d.format) || "Topics"} format` }];
  });
}

export async function myRepository(user: SessionClaims, q: { course?: string }) {
  const [{ offerings }, state] = await Promise.all([
    myOfferings(user),
    prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId: user.institutionId, path: REPOSITORY_LIST_PATH } } }),
  ]);
  let overlay: Record<string, unknown> | null = null;
  try {
    overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  } catch {
    overlay = null;
  }
  const mine = new Set(offerings.map((o) => lower(o.code)));
  const offeringByCourse = new Map(offerings.map((o) => [o.courseId, o]));
  const offeringByCode = new Map(offerings.map((o) => [lower(o.code), o]));
  const myCourses = new Map(offerings.map((o) => [o.courseId, { code: o.code, title: o.title }]));
  const needle = lower(s(q.course));
  const catalog = mergeRepositoryList(buildRepositoryCatalog(), overlay)
    .filter((c) => mine.has(lower(c.number)))
    .map((c) => ({ id: c.id, number: c.number, name: c.name, lms: c.lms, sectionId: offeringByCode.get(lower(c.number))?.id ?? "" }));
  const rows = [...(await managedRepositories(user.institutionId, myCourses)), ...catalog]
    .filter((c) => !needle || lower(c.number).includes(needle) || lower(c.name).includes(needle) || lower(`${c.number} ${c.name}`).includes(needle))
    .map((row) => {
      const sectionId = "sectionId" in row ? row.sectionId : offeringByCourse.get(row.courseId)?.id ?? "";
      return { ...row, sectionId, workspaceHref: sectionId ? `/instructor/sections/${sectionId}` : "" };
    })
    .sort((a, b) => a.number.localeCompare(b.number) || a.name.localeCompare(b.name));
  return { course: s(q.course), rows };
}

/* ------------------------------------------------------------------ */
/* Pending Course Schedules                                             */
/* ------------------------------------------------------------------ */

export async function pendingSchedules(user: SessionClaims, q: { type?: string }) {
  const type = (SCHEDULE_CHANGE_TYPES as readonly string[]).includes(s(q.type)) ? s(q.type) : SCHEDULE_CHANGE_TYPES[0];
  const types =
    type === "New Sessions Only"
      ? [SCHEDULE_APPROVAL_TYPES.newSession]
      : type === "Changes Only"
        ? [SCHEDULE_APPROVAL_TYPES.change]
        : [SCHEDULE_APPROVAL_TYPES.newSession, SCHEDULE_APPROVAL_TYPES.change];
  const { tz, offerings } = await myOfferings(user);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const requests = offerings.length
    ? await prisma.approvalRequest.findMany({
        where: { institutionId: user.institutionId, status: "pending", type: { in: types }, subjectRef: { in: [...byId.keys()] } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const rows = requests.map((r) => {
    const o = byId.get(r.subjectRef)!;
    return {
      id: r.id,
      sectionId: o.id,
      courseId: o.courseId,
      code: o.code,
      offering: o.offering,
      title: o.title,
      changeType: r.type === SCHEDULE_APPROVAL_TYPES.newSession ? "New Session" : "Schedule Change",
      submitted: fmtDate(ymdIn(r.createdAt, tz)),
    };
  });
  return { type, typeOptions: [...SCHEDULE_CHANGE_TYPES], rows };
}

const SCHEDULE_TYPES: string[] = Object.values(SCHEDULE_APPROVAL_TYPES);

async function accountOfPerson(institutionId: string, personId: string) {
  if (!personId) return null;
  return prisma.account.findFirst({ where: { institutionId, personId }, select: { id: true } });
}

/**
 * Called after Course Management saves a session / offering: asks the assigned instructor to review a new
 * assignment (course_session_new) or a schedule change (course_session_change) under Pending Course Schedules.
 * Reassigning the offering withdraws the previous instructor's open requests.
 */
export async function queueScheduleReview(
  user: SessionClaims,
  input: {
    sectionId: string;
    label: string;
    instructorPersonId: string;
    previousInstructorPersonId: string | null;
    scheduleChanged: boolean;
    diff: Record<string, unknown>;
  },
) {
  const inst = user.institutionId;
  const reassigned = input.previousInstructorPersonId === null || input.previousInstructorPersonId !== input.instructorPersonId;
  const open = await prisma.approvalRequest.findMany({
    where: { institutionId: inst, status: "pending", type: { in: SCHEDULE_TYPES }, subjectRef: input.sectionId },
    select: { id: true },
  });
  if (reassigned && open.length) {
    await prisma.approvalRequest.updateMany({ where: { id: { in: open.map((r) => r.id) } }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
  }
  if (!input.instructorPersonId || input.instructorPersonId === user.personId) return null;
  if (!reassigned && (!input.scheduleChanged || open.length)) return null;
  const type = reassigned ? SCHEDULE_APPROVAL_TYPES.newSession : SCHEDULE_APPROVAL_TYPES.change;
  const row = await requireApproval({
    institutionId: inst,
    type,
    subjectRef: input.sectionId,
    proposedDiff: input.diff,
    requestedBy: user.accountId,
    requiredApproverRoles: ["instructor"],
    source: "courses.session",
  });
  const recipient = await accountOfPerson(inst, input.instructorPersonId);
  if (recipient) {
    await prisma.notification.create({
      data: {
        institutionId: inst,
        recipientAccountId: recipient.id,
        channel: "in_app",
        title: reassigned ? "New course session assigned" : "Course schedule changed",
        body: `${input.label}: please review it under My Courses → Pending Course Schedules.`.slice(0, 4000),
      },
    });
  }
  return row;
}

/** The assigned instructor accepts or declines a pending schedule item on their own offering. */
export async function decideSchedule(user: SessionClaims, id: string, body: { decision?: string; comment?: string }) {
  const decision = s(body.decision);
  if (decision !== "accept" && decision !== "decline") throw httpError(400, "Choose Accept or Decline");
  const comment = s(body.comment).slice(0, 1000);
  const req = await prisma.approvalRequest.findFirst({ where: { id, institutionId: user.institutionId, type: { in: SCHEDULE_TYPES } } });
  if (!req) throw httpError(404, "Pending course schedule not found", "NOT_FOUND");
  const [o] = (await myOfferings(user, [req.subjectRef])).offerings;
  if (!o) throw httpError(403, "This course offering is not assigned to you", "FORBIDDEN");
  if (req.status !== "pending") throw httpError(409, "This schedule has already been reviewed", "CONFLICT");
  let decisions: unknown[] = [];
  try {
    decisions = JSON.parse(req.decisionsJson) as unknown[];
  } catch {
    decisions = [];
  }
  decisions.push({ actorId: user.accountId, decision: decision === "accept" ? "approve" : "reject", comment: comment || undefined, decidedAt: new Date().toISOString() });
  const status = decision === "accept" ? "approved" : "rejected";
  const what = req.type === SCHEDULE_APPROVAL_TYPES.newSession ? "new session" : "schedule change";
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.approvalRequest.updateMany({
      where: { id: req.id, rowVersion: req.rowVersion, status: "pending" },
      data: { status, decisionsJson: JSON.stringify(decisions), rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw httpError(409, "This schedule was reviewed by someone else. Reload and try again.", "CONFLICT");
    if (req.requestedBy !== user.accountId) {
      await tx.notification.create({
        data: {
          institutionId: user.institutionId,
          recipientAccountId: req.requestedBy,
          channel: "in_app",
          title: decision === "accept" ? "Course schedule accepted" : "Course schedule declined",
          body: `${offeringLabel(o)}: the instructor ${decision === "accept" ? "accepted" : "declined"} the ${what}.${comment ? ` Note: ${comment}` : ""}`.slice(0, 4000),
        },
      });
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: decision === "accept" ? "CourseSchedule.accepted" : "CourseSchedule.declined",
      purpose: "course_schedule",
      before: { approvalRequestId: req.id, status: req.status },
      after: { approvalRequestId: req.id, status, sectionId: o.id, comment: comment || null },
      source: "my_courses.schedule.decision",
      correlationId: randomUUID(),
      outboxPayload: { notifyAccountId: req.requestedBy, sectionId: o.id, status },
    });
  });
  return { id: req.id, sectionId: o.id, status, message: `${o.code} (${o.offering}) ${what} ${decision === "accept" ? "accepted" : "declined"}` };
}

/* ------------------------------------------------------------------ */
/* Grades Submission                                                    */
/* ------------------------------------------------------------------ */

const SUBMITTED = new Set(["pending_publish", "published", "under_review"]);
const AWAITING_APPROVAL = new Set(["pending_publish", "under_review"]);

async function submissionBoard(user: SessionClaims) {
  const { offerings } = await myOfferings(user);
  const started = offerings.filter((o) => o.phase !== "upcoming");
  const ids = started.map((o) => o.id);
  const [assignments, items] = ids.length
    ? await Promise.all([
        prisma.assignment.groupBy({ by: ["sectionId"], where: { institutionId: user.institutionId, sectionId: { in: ids } }, _count: { _all: true } }),
        prisma.gradeItem.findMany({
          where: { institutionId: user.institutionId, assignment: { sectionId: { in: ids } }, enrolment: { status: "enrolled" } },
          select: { status: true, score: true, assignment: { select: { sectionId: true } } },
        }),
      ])
    : [[], []];
  const assignmentCount = new Map(assignments.map((a) => [a.sectionId, a._count._all]));
  const itemsBy = new Map<string, Array<{ status: string; score: number | null }>>();
  for (const it of items) {
    const list = itemsBy.get(it.assignment.sectionId) ?? [];
    list.push(it);
    itemsBy.set(it.assignment.sectionId, list);
  }
  return started
    .filter((o) => o.enrolled > 0 || (itemsBy.get(o.id)?.length ?? 0) > 0)
    .map((o) => {
      const mine = itemsBy.get(o.id) ?? [];
      const expected = o.enrolled * (assignmentCount.get(o.id) ?? 0);
      const submitted = mine.filter((g) => g.score != null && SUBMITTED.has(g.status)).length;
      const status: GradeSubmissionStatus =
        !assignmentCount.get(o.id) || submitted < expected
          ? "Submission Required"
          : mine.some((g) => AWAITING_APPROVAL.has(g.status))
            ? "Pending"
            : "Approved";
      return { ...o, submissionStatus: status, gradingType: "Final Grades", outstanding: Math.max(expected - submitted, 0) };
    });
}

export async function gradeSubmissions(user: SessionClaims, q: { course?: string; status?: string }) {
  const board = await submissionBoard(user);
  const courseOptions: Option[] = [{ value: "", label: "All Courses" }, ...board.map((o) => ({ value: o.id, label: offeringLabel(o) }))];
  const course = board.some((o) => o.id === s(q.course)) ? s(q.course) : "";
  const status = (GRADE_SUBMISSION_STATUSES as readonly string[]).includes(s(q.status)) ? (s(q.status) as GradeSubmissionStatus) : GRADE_SUBMISSION_STATUSES[0];
  const rows = board
    .filter((o) => !course || o.id === course)
    .filter((o) => o.submissionStatus === status)
    .map((o) => ({ ...o, status: o.submissionStatus }));
  return {
    courseOptions,
    statusOptions: [...GRADE_SUBMISSION_STATUSES],
    course,
    status,
    rows,
    requiredCount: board.filter((o) => o.submissionStatus === "Submission Required").length,
  };
}

/** One of the caller's own offerings on the grades board; anything else is not theirs to submit. */
export async function gradeSubmission(user: SessionClaims, sectionId: string) {
  const row = (await submissionBoard(user)).find((o) => o.id === sectionId);
  if (!row) throw httpError(404, "This course offering is not on your grades submission list", "NOT_FOUND");
  return { ...row, status: row.submissionStatus };
}

export async function myCoursesCounts(user: SessionClaims) {
  const board = await submissionBoard(user);
  return { gradesSubmission: board.filter((o) => o.submissionStatus === "Submission Required").length };
}
