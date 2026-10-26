/* Course Management: courses, sessions / offerings, course tabs, pending changes and active courses. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { audit } from "./service.js";
import { sectionTerm, termLabel } from "../../../lib/sectionTerm.js";
import { dropGeneratedClassSessions, syncSectionClassSessions } from "../../courses/sectionOffering.js";
import { queueScheduleReview } from "../../instructor/myCourses.js";
import { COURSE_FIELDS, COURSE_TEXTBOOK_FIELDS, ENTITIES, SESSION_FIELDS, WEEKDAYS, type Data, type Field } from "./courses.spec.js";
import {
  S,
  arr,
  changedLabels,
  clean,
  defaults,
  edit,
  find,
  httpError,
  insert,
  list,
  lookups,
  num,
  s,
  saveSettings,
  settingsOf,
  dropSettings,
  today,
  update,
  view,
  type Lookups,
  type Rec,
} from "./courses.js";

/* ------------------------------------------------------------------ */
/* Session windows                                                      */
/* ------------------------------------------------------------------ */

type Meeting = { day: string; start: string; end: string };
export type SessionStatus = "Not Started" | "In Progress" | "Completed";

export function sessionWindow(term: { startsOn: string; endsOn: string }, st: Data | undefined) {
  const continuous = st?.continuous === true;
  const start = s(st?.startDate) || term.startsOn;
  const end = continuous ? "" : s(st?.endDate) || term.endsOn;
  return { start, end, continuous };
}

export function sessionStatus(w: { start: string; end: string; continuous: boolean }, on = today()): SessionStatus {
  if (w.start > on) return "Not Started";
  if (!w.continuous && w.end && w.end < on) return "Completed";
  return "In Progress";
}

export const meetingsOf = (st: Data | undefined): Meeting[] =>
  arr(st?.meetings)
    .map((m) => m as Data)
    .map((m) => ({ day: s(m.day), start: s(m.start), end: s(m.end) }))
    .filter((m) => WEEKDAYS.includes(m.day as (typeof WEEKDAYS)[number]))
    .sort((a, b) => WEEKDAYS.indexOf(a.day as (typeof WEEKDAYS)[number]) - WEEKDAYS.indexOf(b.day as (typeof WEEKDAYS)[number]));

/**
 * Session settings use account ids, while Section keeps the primary teacher as
 * a person id. Normalise legacy person ids and fall back to the Section teacher
 * when older settings do not contain an instructors array.
 */
export function sessionInstructorAccountIds(stored: unknown, instructorPersonId: string, lk: Pick<Lookups, "users" | "accountOfPerson">) {
  const accountIds = new Set(lk.users.map((user) => user.id));
  const saved = arr(stored)
    .map(s)
    .map((id) => (accountIds.has(id) ? id : lk.accountOfPerson.get(id) ?? ""))
    .filter(Boolean);
  const fallback = lk.accountOfPerson.get(instructorPersonId);
  return [...new Set(saved.length ? saved : fallback ? [fallback] : [])];
}

async function courseOr404(inst: string, id: string) {
  const c = await prisma.course.findFirst({ where: { id, institutionId: inst } });
  if (!c) throw httpError(404, "Course not found", "NOT_FOUND");
  return c;
}

/* ------------------------------------------------------------------ */
/* Courses & Sessions directory                                         */
/* ------------------------------------------------------------------ */

export async function courseDirectory(user: SessionClaims, q: string) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const [courses, sections] = await Promise.all([
    prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" } }),
    prisma.section.findMany({ where: { institutionId: inst }, include: { term: true } }),
  ]);
  const [cs, ss] = await Promise.all([settingsOf(inst, S.courseSettings, courses.map((c) => c.id)), settingsOf(inst, S.session, sections.map((x) => x.id))]);
  const needle = q.trim().toLowerCase();
  const on = today();
  const groups = new Map<string, { category: string; rows: Data[] }>();
  for (const c of courses) {
    if (needle && !c.code.toLowerCase().includes(needle) && !c.title.toLowerCase().includes(needle)) continue;
    const st = cs.get(c.id)?.data ?? {};
    const category = lk.label("courseCategories", st.category) || "No Category";
    const counts = { notStarted: 0, inProgress: 0, completed: 0 };
    for (const x of sections.filter((y) => y.courseId === c.id)) {
      const status = sessionStatus(sessionWindow(x.term, ss.get(x.id)?.data), on);
      if (status === "Not Started") counts.notStarted += 1;
      else if (status === "In Progress") counts.inProgress += 1;
      else counts.completed += 1;
    }
    const g = groups.get(category) ?? { category, rows: [] };
    g.rows.push({ id: c.id, code: c.code, title: c.title, credits: c.credits, group: lk.label("courseGroups", st.group), sessions: counts });
    groups.set(category, g);
  }
  const ordered = [...groups.values()].sort((a, b) => (a.category === "No Category" ? 1 : b.category === "No Category" ? -1 : a.category.localeCompare(b.category)));
  return { groups: ordered, total: ordered.reduce((n, g) => n + g.rows.length, 0) };
}

export async function getCourse(user: SessionClaims, id: string) {
  await view(user);
  const c = await courseOr404(user.institutionId, id);
  const inst = user.institutionId;
  const [st, requirements, prerequisites, corequisites, offerings] = await Promise.all([
    settingsOf(inst, S.courseSettings, [id]).then((rows) => rows.get(id)?.data ?? {}),
    prisma.degreeRequirement.findMany({
      where: { institutionId: inst, courseId: id },
      include: { programVersion: { include: { program: true } } },
      orderBy: [{ programVersion: { program: { name: "asc" } } }, { sortOrder: "asc" }],
    }),
    prisma.coursePrerequisite.findMany({
      where: { institutionId: inst, courseId: id },
      include: { prerequisiteCourse: true },
      orderBy: { prerequisiteCourse: { code: "asc" } },
    }),
    prisma.courseCorequisite.findMany({
      where: { institutionId: inst, courseId: id },
      include: { corequisiteCourse: true },
      orderBy: { corequisiteCourse: { code: "asc" } },
    }),
    prisma.courseOffering.findMany({
      where: { institutionId: inst, courseId: id },
      orderBy: { termCode: "desc" },
    }),
  ]);
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    credits: c.credits,
    values: { ...defaults(COURSE_FIELDS), ...st, name: c.title, number: c.code, credits: c.credits },
    sessionDefaults: { gradingScheme: await defaultGradingScheme(user.institutionId, id, await lookups(user)) },
    curriculum: {
      requirements: requirements.map((row) => ({
        id: row.id,
        program: row.programVersion.program.name,
        programCode: row.programVersion.program.code,
        version: row.programVersion.label,
        versionStatus: row.programVersion.status,
        title: row.title,
        kind: row.kind,
        credits: row.credits,
        sortOrder: row.sortOrder,
      })),
      prerequisites: prerequisites.map((row) => ({
        id: row.id,
        courseId: row.prerequisiteCourseId,
        code: row.prerequisiteCourse.code,
        title: row.prerequisiteCourse.title,
      })),
      corequisites: corequisites.map((row) => ({
        id: row.id,
        courseId: row.corequisiteCourseId,
        code: row.corequisiteCourse.code,
        title: row.corequisiteCourse.title,
      })),
      offerings: offerings.map((row) => ({
        id: row.id,
        termCode: row.termCode,
        termName: row.termName,
        seatsOpen: row.seatsOpen,
        seatsTotal: row.seatsTotal,
        status: row.status,
      })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Course history (Audit Changes)                                       */
/* ------------------------------------------------------------------ */

async function versionsOf(inst: string, courseId: string) {
  const seq = (v: Rec) => num(v.data.seq);
  return (await list(inst, S.courseVersion, courseId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || seq(b) - seq(a));
}

async function addVersion(user: SessionClaims, courseId: string, snapshot: Data, changes: string[]) {
  const top = (await versionsOf(user.institutionId, courseId))[0];
  const person = await prisma.person.findFirst({ where: { id: user.personId }, select: { givenName: true, familyName: true } });
  await insert(user, S.courseVersion, { snapshot, changes, seq: (top ? num(top.data.seq) : 0) + 1, by: person ? `${person.givenName} ${person.familyName}`.trim() : "System" }, courseId);
}

async function ensureBaseline(user: SessionClaims, courseId: string) {
  const inst = user.institutionId;
  if ((await versionsOf(inst, courseId)).length) return;
  const c = await getCourse(user, courseId);
  const rec = await insert(user, S.courseVersion, { snapshot: c.values, changes: ["Course created"], seq: 1, by: "System" }, courseId);
  const course = await prisma.course.findFirst({ where: { id: courseId }, select: { createdAt: true } });
  if (course) await prisma.heritageRecord.update({ where: { id: rec.id }, data: { createdAt: course.createdAt } });
}

function displayValue(f: Field, v: unknown, lk: Lookups): string {
  if (f.kind === "bool") return v ? "Yes" : "No";
  if (f.kind === "ref") return lk.label(f.ref ?? "", v) || (s(v) ? "(no longer available)" : "—");
  if (f.kind === "people") return arr(v).map((id) => lk.label("users", id) || "(removed user)").join(", ") || "—";
  if (f.kind === "file") return v ? s((v as Data).name) : "—";
  if (Array.isArray(v)) return v.map(s).join(", ") || "—";
  return s(v) || "—";
}

export async function courseHistory(user: SessionClaims, courseId: string) {
  await view(user);
  await courseOr404(user.institutionId, courseId);
  await ensureBaseline(user, courseId);
  const versions = await versionsOf(user.institutionId, courseId);
  return { items: versions.map((v, i) => ({ id: v.id, date: v.createdAt.toISOString(), by: s(v.data.by) || "System", changes: arr(v.data.changes).map(s), current: i === 0 })) };
}

export async function courseVersion(user: SessionClaims, courseId: string, versionId: string) {
  await view(user);
  const versions = await versionsOf(user.institutionId, courseId);
  const i = versions.findIndex((v) => v.id === versionId);
  if (i < 0) throw httpError(404, "Version not found", "NOT_FOUND");
  const v = versions[i];
  const prev = versions[i + 1];
  const lk = await lookups(user);
  const after = (v.data.snapshot ?? {}) as Data;
  const before = (prev?.data.snapshot ?? {}) as Data;
  const fields = prev ? COURSE_FIELDS.filter((f) => changedLabels([f], before, after).length) : COURSE_FIELDS.filter((f) => displayValue(f, after[f.key], lk) !== "—");
  return {
    id: v.id,
    date: v.createdAt.toISOString(),
    by: s(v.data.by) || "System",
    changes: arr(v.data.changes).map(s),
    rows: fields.map((f) => ({ label: f.label, former: prev ? displayValue(f, before[f.key], lk) : "—", updated: displayValue(f, after[f.key], lk) })),
  };
}

export async function courseRecords(user: SessionClaims, courseId: string) {
  await view(user);
  const inst = user.institutionId;
  await courseOr404(inst, courseId);
  const sections = await prisma.section.findMany({ where: { institutionId: inst, courseId }, include: { term: true, _count: { select: { dayBlocks: true } } } });
  const ss = await settingsOf(inst, S.session, sections.map((x) => x.id));
  const statuses = sections.map((x) => sessionStatus(sessionWindow(x.term, ss.get(x.id)?.data)));
  const [enrolled, plans] = await Promise.all([
    prisma.enrolment.count({ where: { institutionId: inst, status: "enrolled", section: { courseId } } }),
    prisma.programPlanItem.count({ where: { institutionId: inst, courseId } }),
  ]);
  return {
    enrolledStudents: enrolled,
    currentSessions: statuses.filter((x) => x !== "Completed").length,
    completedSessions: statuses.filter((x) => x === "Completed").length,
    programPlans: plans,
    schedules: sections.filter((x) => meetingsOf(ss.get(x.id)?.data).length || x._count.dayBlocks).length,
  };
}

export async function restoreCourse(user: SessionClaims, courseId: string, versionId: string) {
  await edit(user);
  const inst = user.institutionId;
  const versions = await versionsOf(inst, courseId);
  const v = versions.find((x) => x.id === versionId);
  if (!v) throw httpError(404, "Version not found", "NOT_FOUND");
  if (versions[0]?.id === versionId) throw httpError(400, "This is already the current version");
  const snap = (v.data.snapshot ?? {}) as Data;
  const lk = await lookups(user);
  let data: Data;
  try {
    data = await clean(user, COURSE_FIELDS, snap, lk);
  } catch (e) {
    throw httpError(409, `This version can no longer be restored: ${(e as Error).message}`, "STALE_VERSION");
  }
  const clash = await prisma.course.findFirst({ where: { institutionId: inst, code: { equals: s(data.number), mode: "insensitive" }, NOT: { id: courseId } } });
  if (clash) throw httpError(409, `Course Number "${s(data.number)}" is now used by another course`, "DUPLICATE");
  const before = (await getCourse(user, courseId)).values;
  await writeCourse(user, courseId, data);
  await addVersion(user, courseId, data, [`Restored the version saved ${v.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`]);
  await audit(user, "C07", courseId, "Restored course version", { recordId: courseId, before, after: data });
  return { message: "Course restored to the selected version" };
}

/* ------------------------------------------------------------------ */
/* Add / Edit / Delete course                                            */
/* ------------------------------------------------------------------ */

async function writeCourse(user: SessionClaims, id: string | null, data: Data) {
  const hours = num(data.totalHours);
  const perDay = num(data.hoursPerDay);
  data.totalDays = hours > 0 && perDay > 0 ? Math.ceil(hours / perDay) : null;
  const values = { code: s(data.number), title: s(data.name), credits: num(data.credits) };
  const course = id
    ? await prisma.course.update({ where: { id }, data: { ...values, rowVersion: { increment: 1 } } })
    : await prisma.course.create({ data: { institutionId: user.institutionId, ...values } });
  await saveSettings(user, S.courseSettings, course.id, data);
  return course;
}

export async function saveCourse(user: SessionClaims, id: string | null, body: Data) {
  await edit(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const before = id ? (await getCourse(user, id)).values : null;
  const data = await clean(user, COURSE_FIELDS, body, lk, before ?? {});
  const clash = await prisma.course.findFirst({ where: { institutionId: inst, code: { equals: s(data.number), mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
  if (clash) throw httpError(409, `Course Number "${s(data.number)}" is already used by ${clash.title}`, "DUPLICATE");
  if (id) await ensureBaseline(user, id);
  const course = await writeCourse(user, id, data);
  const changes = before ? changedLabels(COURSE_FIELDS, before, data) : [];
  if (!before || changes.length) await addVersion(user, course.id, data, before ? [`Updated ${changes.join(", ")}`] : ["Course created"]);
  await audit(user, id ? "C03" : "C02", course.id, id ? "Updated course" : "Created course", { recordId: course.id, before, after: data });
  return { id: course.id, message: id ? `Course ${course.code} saved` : `Course ${course.code} created` };
}

export async function deleteCourse(user: SessionClaims, id: string) {
  await edit(user);
  const inst = user.institutionId;
  const c = await courseOr404(inst, id);
  const sections = await prisma.section.count({ where: { institutionId: inst, courseId: id } });
  if (sections) throw httpError(409, `${c.code} has ${sections} session(s) / offering(s). Delete them first.`, "IN_USE");
  const linked = await prisma.course.findFirst({
    where: { id },
    select: { _count: { select: { requirements: true, prereqFor: true, isPrereqOf: true, coreqFor: true, isCoreqOf: true, offerings: true, transferCredits: true, programPlanItems: true, courseResources: true } } },
  });
  const counts: Record<string, number> = linked?._count ?? {};
  if (Object.values(counts).some((n) => n > 0)) throw httpError(409, `${c.code} is still used by program requirements, plans, prerequisites, transfer credits or resources and cannot be deleted.`, "IN_USE");
  await prisma.course.delete({ where: { id } });
  await dropSettings(user, S.courseSettings, id);
  await audit(user, "C01", id, "Deleted course", { recordId: id, before: { code: c.code, title: c.title, credits: c.credits } });
  return { message: `Course ${c.code} deleted` };
}

export async function bulkUpdate(user: SessionClaims, body: { type?: string; value?: unknown; courseIds?: string[] }) {
  await edit(user);
  if (body.type !== "Credit Value") throw httpError(400, "Choose a bulk update");
  const value = Number(s(body.value));
  if (!s(body.value) || !Number.isFinite(value) || value < 0 || value > 100) throw httpError(400, "Course Credit Value must be a number between 0 and 100");
  const ids = [...new Set((body.courseIds ?? []).map(s).filter(Boolean))];
  if (!ids.length) throw httpError(400, "Add at least one course to the Selected Courses list");
  const courses = await prisma.course.findMany({ where: { institutionId: user.institutionId, id: { in: ids } } });
  if (courses.length !== ids.length) throw httpError(404, "One of the selected courses no longer exists", "NOT_FOUND");
  let changed = 0;
  for (const c of courses) {
    if (c.credits === value) continue;
    await ensureBaseline(user, c.id);
    const before = (await getCourse(user, c.id)).values;
    const after = { ...before, credits: value };
    await writeCourse(user, c.id, after);
    await addVersion(user, c.id, after, [`Course Credit Value changed from ${c.credits} to ${value} (bulk update)`]);
    changed += 1;
  }
  await audit(user, "C08", "", "Bulk updated course credit value", { after: { value, courseIds: ids } });
  return { message: changed ? `Credit value updated on ${changed} course(s)` : "The selected courses already have this credit value" };
}

/* ------------------------------------------------------------------ */
/* Sessions / Offerings                                                  */
/* ------------------------------------------------------------------ */

export type LoadedSection = Awaited<ReturnType<typeof loadSections>>[number];
export async function loadSections(inst: string, where: Record<string, unknown>) {
  return prisma.section.findMany({
    where: { institutionId: inst, ...where },
    include: {
      course: true,
      term: true,
      enrolments: { where: { status: "enrolled" }, select: { id: true, student: { select: { studentNumber: true, person: { select: { familyName: true } } } } } },
      _count: { select: { enrolments: { where: { status: "waitlisted" } } } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function sessionRow(x: LoadedSection, st: Data | undefined, lk: Lookups) {
  const w = sessionWindow(x.term, st);
  const instructorIds = sessionInstructorAccountIds(st?.instructors, x.instructorPersonId, lk);
  const names = instructorIds.length ? instructorIds.map((id) => lk.label("users", id)).filter(Boolean) : [lk.accountOfPerson.get(x.instructorPersonId)].filter(Boolean).map((id) => lk.label("users", id));
  const capacity = st && st.maxEnrolments !== null && st.maxEnrolments !== undefined ? num(st.maxEnrolments) : null;
  const term = sectionTerm(x.term, { startsOn: w.start, endsOn: w.end }, lk.terms);
  const campusId = lk.campusId(st?.campus);
  return {
    id: x.id,
    courseId: x.courseId,
    courseCode: x.course.code,
    courseTitle: x.course.title,
    code: x.code,
    name: s(st?.name),
    term: termLabel(term),
    termId: term?.id ?? "",
    campusId,
    campus: lk.label("campuses", campusId),
    classroom: lk.label("classrooms", st?.classroom),
    instructors: names,
    instructorIds,
    start: w.start,
    end: w.end,
    continuous: w.continuous,
    meetings: meetingsOf(st),
    status: sessionStatus(w),
    enrolled: x.enrolments.length,
    capacity,
    reserved: 0,
    waitlist: x._count.enrolments,
    sessionType: lk.label("courseTypes", st?.sessionType),
    enableLms: s(st?.enableLms) || "Disabled",
  };
}

export async function listSessions(user: SessionClaims, courseId: string, status: string) {
  await view(user);
  const inst = user.institutionId;
  const course = await courseOr404(inst, courseId);
  const lk = await lookups(user);
  const sections = await loadSections(inst, { courseId });
  const ss = await settingsOf(inst, S.session, sections.map((x) => x.id));
  const rows = sections.map((x) => sessionRow(x, ss.get(x.id)?.data, lk)).filter((r) => !status || r.status === status);
  rows.sort((a, b) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code));
  return { course: { id: course.id, code: course.code, title: course.title }, items: rows };
}

export async function getSession(user: SessionClaims, id: string) {
  await view(user);
  const inst = user.institutionId;
  const x = await prisma.section.findFirst({ where: { id, institutionId: inst }, include: { course: true, term: true } });
  if (!x) throw httpError(404, "Session / offering not found", "NOT_FOUND");
  const st = (await settingsOf(inst, S.session, [id])).get(id)?.data;
  const lk = await lookups(user);
  const w = sessionWindow(x.term, st);
  const instructors = sessionInstructorAccountIds(st?.instructors, x.instructorPersonId, lk);
  const gradingScheme = s(st?.gradingScheme) || (await defaultGradingScheme(inst, x.courseId, lk));
  const term = sectionTerm(x.term, { startsOn: w.start, endsOn: w.end }, lk.terms);
  const termId = term?.id ?? "";
  return {
    id: x.id,
    courseId: x.courseId,
    course: { id: x.course.id, code: x.course.code, title: x.course.title },
    code: x.code,
    term: termLabel(term),
    termId,
    values: {
      ...defaults(SESSION_FIELDS),
      ...(st ?? {}),
      ...(st && s(st.campus) ? { campus: lk.campusId(st.campus) } : {}),
      startDate: w.start,
      endDate: w.end,
      continuous: w.continuous,
      instructors,
      meetings: meetingsOf(st),
      gradingScheme,
      termId,
    },
  };
}

/** A new session's grading scheme: the course's scheme when it is still active, else the institution default scheme. */
export async function defaultGradingScheme(inst: string, courseId: string, lk: Lookups) {
  const active = new Set((lk.refs.gradingSchemes ?? []).map((o) => o.id));
  const fromCourse = s((await settingsOf(inst, S.courseSettings, [courseId])).get(courseId)?.data.gradingScheme);
  if (fromCourse && active.has(fromCourse)) return fromCourse;
  const schemes = await list(inst, ENTITIES.gradingSchemes.screen);
  return schemes.find((r) => r.data.isDefault === true && active.has(r.id))?.id ?? "";
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export async function nextSectionCode(inst: string, termId: string, courseCode: string, start: string) {
  const prefix = courseCode.replace(/[^A-Za-z]/g, "").toUpperCase() || "SEC";
  const base = `${prefix}${MONTHS[Number(start.slice(5, 7)) - 1] ?? ""}${start.slice(2, 4)}`;
  const taken = new Set((await prisma.section.findMany({ where: { institutionId: inst, termId }, select: { code: true } })).map((x) => x.code));
  for (let n = 1; n < 1000; n++) {
    const code = `${base}-${String(n).padStart(2, "0")}`;
    if (!taken.has(code)) return code;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function termFor(inst: string, start: string) {
  const terms = await prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "asc" } });
  if (!terms.length) throw httpError(400, "Create a term first (Program Management → Manage Terms); every session / offering belongs to a term.");
  return terms.find((t) => t.startsOn <= start && t.endsOn >= start) ?? [...terms].reverse().find((t) => t.startsOn <= start) ?? terms[0];
}

function cleanMeetings(raw: unknown): Meeting[] {
  const out: Meeting[] = [];
  const seen = new Set<string>();
  for (const item of arr(raw).slice(0, 7)) {
    const m = (item ?? {}) as Data;
    const day = s(m.day);
    if (!WEEKDAYS.includes(day as (typeof WEEKDAYS)[number])) throw httpError(400, "Weekly Schedule contains an unknown day");
    if (seen.has(day)) continue;
    seen.add(day);
    const start = s(m.start);
    const end = s(m.end);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw httpError(400, `${day}: choose a start and finish time`);
    if (end <= start) throw httpError(400, `${day}: the finish time must be after the start time`);
    out.push({ day, start, end });
  }
  return out;
}

function midpoint(a: string, b: string) {
  const t = (new Date(`${a}T12:00:00Z`).getTime() + new Date(`${b}T12:00:00Z`).getTime()) / 2;
  return new Date(t).toISOString().slice(0, 10);
}

export function sessionNameTaken(name: unknown, others: Iterable<{ data: Data }>) {
  const want = s(name).trim().toLowerCase();
  if (!want) return false;
  for (const r of others) if (s(r.data.name).trim().toLowerCase() === want) return true;
  return false;
}

const sessionSaves = new Map<string, Promise<unknown>>();

/** Serialises session saves per course (single API process) so a double-submit cannot slip past the name check. */
async function serialPerCourse<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (sessionSaves.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
  const tail = next.catch(() => undefined);
  sessionSaves.set(key, tail);
  try {
    return await next;
  } finally {
    if (sessionSaves.get(key) === tail) sessionSaves.delete(key);
  }
}

export async function saveSession(user: SessionClaims, courseId: string, id: string | null, body: Data) {
  await edit(user);
  return serialPerCourse(`${user.institutionId}:${courseId}`, () => saveSessionNow(user, courseId, id, body));
}

async function saveSessionNow(user: SessionClaims, courseId: string, id: string | null, body: Data) {
  const inst = user.institutionId;
  const course = await courseOr404(inst, courseId);
  const lk = await lookups(user);
  const existing = id ? await prisma.section.findFirst({ where: { id, institutionId: inst, courseId } }) : null;
  if (id && !existing) throw httpError(404, "Session / offering not found", "NOT_FOUND");
  const before = id ? (await settingsOf(inst, S.session, [id])).get(id)?.data ?? null : null;
  const data = await clean(user, SESSION_FIELDS, s(body.campus) ? { ...body, campus: lk.campusId(body.campus) } : body, lk, before && s(before.campus) ? { ...before, campus: lk.campusId(before.campus) } : before ?? {});
  const meetings = cleanMeetings(body.meetings);
  const errors: string[] = [];
  const classroomCampus = lk.refs.classrooms?.find((o) => o.id === data.classroom)?.tag;
  if (data.classroom && classroomCampus !== data.campus) errors.push("Classroom does not belong to the selected campus");
  if (data.sameAsClassroom) {
    if (!data.classroom) errors.push("Choose a classroom to use its size as the maximum enrolment");
    else data.maxEnrolments = lk.classroomSize.get(s(data.classroom)) ?? data.maxEnrolments;
  }
  if (data.minEnrolments !== null && data.maxEnrolments !== null && num(data.minEnrolments) > num(data.maxEnrolments)) errors.push("Minimum Enrolments cannot be more than Maximum Enrolments");
  if (!data.continuous && s(data.endDate) && s(data.endDate) < s(data.startDate)) errors.push("End Date must be on or after the Start Date");
  for (const ex of arr(data.exams) as Data[]) if (s(ex.start) && s(ex.end) && s(ex.end) <= s(ex.start)) errors.push(`Exam on ${s(ex.date)}: finish time must be after the start time`);
  if (errors.length) throw httpError(400, errors.join("; "));
  if (s(data.name)) {
    const siblings = await prisma.section.findMany({ where: { institutionId: inst, courseId, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    const settings = await settingsOf(inst, S.session, siblings.map((x) => x.id));
    if (sessionNameTaken(data.name, settings.values())) throw httpError(409, `Session Name "${s(data.name)}" is already used by another session of ${course.code}`, "DUPLICATE");
  }
  if (data.autoMedian) data.medianDate = !data.continuous && s(data.endDate) ? midpoint(s(data.startDate), s(data.endDate)) : "";
  if (!s(data.gradingScheme)) data.gradingScheme = await defaultGradingScheme(inst, courseId, lk);
  const term = s(body.termId) ? await chosenTerm(inst, s(body.termId), s(data.startDate), data.continuous ? "" : s(data.endDate)) : await termFor(inst, s(data.startDate));
  const shownTerm = sectionTerm(term, { startsOn: s(data.startDate), endsOn: data.continuous ? "" : s(data.endDate) }, lk.terms);
  const instructors = arr(data.instructors).map(s);
  const instructorPersonId = (instructors[0] && lk.personOf.get(instructors[0])) || "";
  const section = existing
    ? await prisma.section.update({ where: { id: existing.id }, data: { termId: term.id, instructorPersonId, rowVersion: { increment: 1 } } })
    : await prisma.section.create({ data: { institutionId: inst, courseId, termId: term.id, code: await nextSectionCode(inst, term.id, course.code, s(data.startDate)), instructorPersonId } });
  const saved = { ...data, meetings };
  await saveSettings(user, S.session, section.id, saved);
  const meetingsSync = await syncSectionClassSessions(inst, section.id);
  const schedule = (d: Data | null) => JSON.stringify([s(d?.startDate), s(d?.endDate), d?.continuous === true, meetingsOf(d ?? undefined)]);
  await queueScheduleReview(user, {
    sectionId: section.id,
    label: `${course.code} (${section.code}) — ${course.title}`,
    instructorPersonId,
    previousInstructorPersonId: existing ? existing.instructorPersonId : null,
    scheduleChanged: !!existing && (existing.termId !== term.id || schedule(before) !== schedule({ ...data, meetings })),
    diff: { course: course.code, title: course.title, offering: section.code, term: termLabel(shownTerm), startDate: s(data.startDate), endDate: s(data.endDate), continuous: data.continuous === true, meetings },
  });
  await audit(user, "C04", courseId, id ? "Updated session / offering" : "Created session / offering", {
    recordId: section.id,
    before,
    after: { ...saved, termId: term.id },
    note: meetingsSync.created || meetingsSync.removed ? `${meetingsSync.created} class meeting(s) scheduled, ${meetingsSync.removed} removed` : undefined,
  });
  return { id: section.id, message: `Session ${section.code} ${id ? "saved" : "created"}${shownTerm ? ` in ${shownTerm.name}` : " with no term assigned"}` };
}

/** The term picked on the session form; the session's dates must fall within it. */
async function chosenTerm(inst: string, termId: string, start: string, end: string) {
  const term = await prisma.term.findFirst({ where: { id: termId, institutionId: inst } });
  if (!term) throw httpError(400, "Term: the selected term no longer exists");
  if (start && (start < term.startsOn || start > term.endsOn)) throw httpError(400, `Start Date ${start} is outside ${term.name} (${term.startsOn} – ${term.endsOn})`);
  if (end && end > term.endsOn) throw httpError(400, `End Date ${end} is after the end of ${term.name} (${term.endsOn})`);
  return term;
}

export async function deleteSession(user: SessionClaims, id: string) {
  await edit(user);
  const inst = user.institutionId;
  const x = await prisma.section.findFirst({
    where: { id, institutionId: inst },
    include: { course: true, _count: { select: { enrolments: true, assignments: true, classSessions: true, assessments: true, attendanceRecords: true, dayBlocks: true, folders: true, syllabusTopics: true } } },
  });
  if (!x) throw httpError(404, "Session / offering not found", "NOT_FOUND");
  if (x._count.enrolments) throw httpError(409, `${x.code} has ${x._count.enrolments} student enrolment(s). Withdraw or move the students first.`, "IN_USE");
  x._count.classSessions -= await dropGeneratedClassSessions(inst, id, x.course.code, x.code);
  const { enrolments: _e, ...rest } = x._count;
  if (Object.values(rest).some((n) => n > 0)) throw httpError(409, `${x.code} already has course content, class sessions or attendance and cannot be deleted.`, "IN_USE");
  await prisma.section.delete({ where: { id } });
  await dropSettings(user, S.session, id);
  await audit(user, "C04", x.courseId, "Deleted session / offering", { recordId: id, before: { code: x.code } });
  return { message: `Session ${x.code} deleted` };
}

/* ------------------------------------------------------------------ */
/* Course Textbooks & e-Texts tab                                        */
/* ------------------------------------------------------------------ */

export async function courseTextbooks(user: SessionClaims, courseId: string) {
  await view(user);
  await courseOr404(user.institutionId, courseId);
  const books = await list(user.institutionId, ENTITIES.textbooks.screen);
  const items = books.flatMap((b) =>
    arr(b.data.courses)
      .map((r) => r as Data)
      .filter((r) => r.course === courseId)
      .map((r) => ({ id: b.id, name: s(b.data.name), isbn: s(b.data.isbn), format: s(b.data.format), domestic: b.data.domestic ?? null, international: b.data.international ?? null, optOut: s(r.optOut), recurringFee: s(r.recurringFee) })),
  );
  return { items };
}

export async function addCourseTextbook(user: SessionClaims, courseId: string, body: Data) {
  await edit(user);
  const inst = user.institutionId;
  const course = await courseOr404(inst, courseId);
  const data = await clean(user, COURSE_TEXTBOOK_FIELDS, body, await lookups(user));
  const book = await find(inst, ENTITIES.textbooks.screen, s(data.textbook), "Textbook");
  const rows = arr(book.data.courses) as Data[];
  if (rows.some((r) => r.course === courseId)) throw httpError(409, `${s(book.data.name)} is already associated with ${course.code}`, "DUPLICATE");
  await update(user, book.id, { ...book.data, courses: [...rows, { id: `r${Date.now().toString(36)}`, course: courseId, optOut: data.optOut, recurringFee: data.recurringFee }] });
  await audit(user, "C06", courseId, "Added textbook to course", { recordId: book.id, after: data });
  return { message: `${s(book.data.name)} added to ${course.code}` };
}

export async function removeCourseTextbook(user: SessionClaims, courseId: string, textbookId: string) {
  await edit(user);
  const inst = user.institutionId;
  const book = await find(inst, ENTITIES.textbooks.screen, textbookId, "Textbook");
  await update(user, book.id, { ...book.data, courses: (arr(book.data.courses) as Data[]).filter((r) => r.course !== courseId) });
  await audit(user, "C06", courseId, "Removed textbook from course", { recordId: book.id });
  return { message: `${s(book.data.name)} removed from the course` };
}

/* ------------------------------------------------------------------ */
/* Pending Course Sessions & Changes                                     */
/* ------------------------------------------------------------------ */

export async function pendingChanges(user: SessionClaims, f: { campus?: string; course?: string; term?: string; status?: string; type?: string }) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const changes = await list(inst, S.change);
  const sectionIds = [...new Set(changes.map((c) => s(c.data.sectionId)).filter(Boolean))];
  const sections = new Map((await loadSections(inst, { id: { in: sectionIds } })).map((x) => [x.id, x]));
  const ss = await settingsOf(inst, S.session, sectionIds);
  const items = changes
    .map((c) => {
      const x = sections.get(s(c.data.sectionId));
      const row = x ? sessionRow(x, ss.get(x.id)?.data, lk) : null;
      return {
        id: c.id,
        status: s(c.data.status) || "Pending Review",
        type: s(c.data.type),
        summary: s(c.data.summary),
        submittedBy: lk.label("users", c.createdById) || "System",
        submittedAt: c.createdAt.toISOString(),
        courseId: s(c.data.courseId) || row?.courseId || "",
        session: row,
      };
    })
    .filter((r) => (!f.status || r.status === f.status) && (!f.type || r.type === f.type))
    .filter((r) => (!f.course || r.courseId === f.course) && (!f.campus || r.session?.campusId === f.campus) && (!f.term || r.session?.termId === f.term))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { items };
}

/* ------------------------------------------------------------------ */
/* Active Courses                                                       */
/* ------------------------------------------------------------------ */

export async function activeCourses(user: SessionClaims, f: { campus?: string; course?: string; term?: string; student?: string; faculty?: string; page?: number; perPage?: number }) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const sections = await loadSections(inst, { ...(f.course ? { courseId: f.course } : {}), ...(f.term ? { termId: f.term } : {}) });
  const ss = await settingsOf(inst, S.session, sections.map((x) => x.id));
  const needle = s(f.student).toLowerCase();
  let rows = sections
    .filter((x) => !needle || x.enrolments.some((e) => e.student.studentNumber.toLowerCase().includes(needle) || e.student.person.familyName.toLowerCase().startsWith(needle)))
    .map((x) => sessionRow(x, ss.get(x.id)?.data, lk))
    .filter((r) => r.status === "In Progress")
    .filter((r) => (!f.campus || r.campusId === f.campus) && (!f.faculty || r.instructorIds.includes(f.faculty) || lk.accountOfPerson.get(sections.find((x) => x.id === r.id)?.instructorPersonId ?? "") === f.faculty));
  rows = rows.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.code.localeCompare(b.code));
  const perPage = f.perPage && f.perPage > 0 ? f.perPage : 25;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  return { items: rows.slice((page - 1) * perPage, page * perPage), total: rows.length, page, pages, perPage };
}
