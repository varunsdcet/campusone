/* Student profile › Program Plan (enrolment entry, entry / progress tests) and Grades & Transcript. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { ensureStudentProgramPlan, getTranscriptSummary, summarizeCourses } from "../../academic/program-plan.service.js";
import { ensureProgramVersion } from "../../academic/program-version.js";
import { COURSE_STATUS_LABEL } from "../../../lib/courseStatus.js";
import { buildDocumentPdf, type DocLine } from "../../../lib/taxPdf.js";
import {
  add,
  bool,
  canStudents,
  httpError,
  loadProfile,
  metaOf,
  oneOf,
  optDate,
  patchMetaLoose,
  programCatalogue,
  requireStudentRow,
  rows,
  s,
  saveProfile,
  statusOf,
  studentStatusPolicy,
  stuAudit,
  type Data,
} from "./students.core.js";
import { assertRateCategory, defaultRateCategory, setRateCategory } from "./students.js";
import { enrolInSections, quoteSectionFee } from "./enrolment.js";
import { linkScheduleSections } from "./programs.js";
import { scheduleSectionIds } from "./programs.sections.js";
import { ENROLMENT_STATUSES, RATE_CATEGORIES, STU, TRANSCRIPT_OPTIONS } from "./students.spec.js";
import { assertNoActiveStudentHold } from "../../me/studentAlignment.js";

/* ------------------------------------------------------------------ */
/* Program enrolment                                                    */
/* ------------------------------------------------------------------ */

async function courseLabels(inst: string, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const courses = await prisma.course.findMany({ where: { institutionId: inst, id: { in: ids } }, select: { id: true, code: true, title: true } });
  return new Map(courses.map((c) => [c.id, `${c.code} — ${c.title}`]));
}

async function feedInSessions(inst: string, scheduleIds: string[]) {
  const sessions = scheduleIds.length ? await rows(inst, "PM:SESSION", scheduleIds) : [];
  const labels = await courseLabels(
    inst,
    sessions.map((x) => s(x.data.course)).filter(Boolean),
  );
  return sessions.map((x) => ({
    id: x.id,
    schedule: x.contextKey,
    feedIn: x.data.feedIn === true,
    course: labels.get(s(x.data.course)) ?? (s(x.data.sessionName) || "Course"),
    startDate: s(x.data.startDate),
    endDate: s(x.data.endDate),
    campus: s(x.data.campus),
    sectionId: x.data._status === "active" ? s(x.data._sectionId) : "",
  }));
}

export async function programPlan(user: SessionClaims, id: string) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  await assertNoActiveStudentHold(inst, id, "Transcript generation");
  const [meta, pm, enrolRows] = await Promise.all([metaOf(inst, id), programCatalogue(inst), rows(inst, STU.ENROL, id)]);
  const sessions = await feedInSessions(
    inst,
    pm.schedules.map((x) => x.id),
  );
  const enrolments = enrolRows.map((r) => ({
    id: r.id,
    program: s(r.data.program),
    schedule: s(r.data.schedule),
    feedIn: s(r.data.feedIn),
    status: s(r.data.status),
    startDate: s(r.data.startDate),
    date: r.createdAt.toISOString(),
  }));
  const feedIns = await Promise.all(
    sessions
      .filter((x) => x.feedIn)
      .map(async (x) => {
        const quote = x.sectionId ? await quoteSectionFee(inst, x.sectionId, id).catch(() => null) : null;
        return { ...x, fee: quote ? { amount: quote.amount, included: quote.included, termName: quote.termName } : null, seats: quote?.seats ?? null };
      }),
  );
  return {
    enrolled: enrolments.length > 0,
    status: statusOf(meta, st._count.enrolments),
    enrolments,
    rateCategory: meta.rateCategory ?? "",
    defaultRateCategory: defaultRateCategory(meta),
    rateCategories: RATE_CATEGORIES,
    programs: pm.programs,
    schedules: pm.schedules.map((x) => ({ id: x.id, program: x.program, name: x.name, description: x.description })),
    feedIns,
    statuses: ENROLMENT_STATUSES,
  };
}

export async function enrolProgram(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const pm = await programCatalogue(inst);
  const program = pm.programs.find((p) => p.id === s(body.programId));
  if (!program) throw httpError(400, "Program is required");
  const schedule = pm.schedules.find((x) => x.id === s(body.scheduleId));
  if (!schedule || schedule.program !== program.id) throw httpError(400, "Schedule is required and must belong to the selected program");
  const sessions = await feedInSessions(inst, [schedule.id]);
  const session = sessions.find((x) => x.id === s(body.sessionId) && x.feedIn);
  if (!session) throw httpError(400, "Feed-in Course is required");
  const status = oneOf(body.status, ENROLMENT_STATUSES, "Student Status");
  let meta = await metaOf(inst, id);
  const currentPolicy = await studentStatusPolicy(inst, statusOf(meta, 0));
  if (currentPolicy?.locksPlan) throw httpError(409, `Student status "${currentPolicy.name}" locks the program plan`, "PROGRAM_PLAN_LOCKED");
  const rate = s(body.rateCategory).trim() || (s(meta.rateCategory).trim() ? "" : defaultRateCategory(meta));
  if (rate && rate !== meta.rateCategory) {
    await setRateCategory(user, id, { rateCategory: rate });
    meta = await metaOf(inst, id);
  }
  assertRateCategory(meta, status);
  const scheduleEnd = sessions.map((x) => x.endDate).filter(Boolean).sort().pop() ?? "";
  const courseEnrolments = await enrolScheduleSections(user, id, schedule.id, session, {
    scope: body.courseScope === "feedIn" ? "feedIn" : "schedule",
    postFee: bool(body.postFee),
  });
  const rec = await add(
    user,
    STU.ENROL,
    {
      programId: program.id,
      program: program.name,
      scheduleId: schedule.id,
      schedule: schedule.name,
      sessionId: session.id,
      feedIn: session.course,
      status,
      startDate: session.startDate,
      enrolmentIds: courseEnrolments.map((e) => e.enrolmentId),
    },
    id,
  );
  await prisma.student.update({ where: { id }, data: { programName: program.name, rowVersion: { increment: 1 } } });
  await ensureProgramVersion(inst, id, { relink: true });
  await ensureStudentProgramPlan(inst, id);
  await patchMetaLoose(inst, id, { status, schedule: schedule.name, ...(session.campus && session.campus !== "Not Set" ? { campus: session.campus } : {}) });
  await saveProfile(user, id, { programId: program.id, scheduleStart: session.startDate, scheduleEnd, feedIn: session.course });
  await stuAudit(
    user,
    "Program Plan",
    id,
    "Program enrolment saved",
    { program: program.name, schedule: schedule.name, feedIn: session.course, status, startDate: session.startDate, courses: courseEnrolments.map((e) => `${e.courseCode} ${e.sectionCode} (${e.status})`).join(", ") },
    rec.id,
  );
  return {
    id: rec.id,
    rateCategory: meta.rateCategory ?? "",
    courses: courseEnrolments.map((e) => ({ enrolmentId: e.enrolmentId, sectionId: e.sectionId, course: `${e.courseCode} ${e.sectionCode}`, status: e.status, fee: e.fee, feeNote: e.feeNote })),
  };
}

/**
 * Course enrolments that come with a program enrolment: the feed-in session's section and, for the whole schedule,
 * the first session of every other course that starts on or after the feed-in date. Courses the student already holds
 * (enrolled, waitlisted or completed) are left alone.
 */
async function enrolScheduleSections(user: SessionClaims, studentId: string, scheduleId: string, feedIn: { id: string; startDate: string }, opts: { scope: "feedIn" | "schedule"; postFee: boolean }) {
  const inst = user.institutionId;
  await linkScheduleSections(user, scheduleId);
  const linked = await scheduleSectionIds(inst, scheduleId);
  const feedInLink = linked.find((x) => x.sessionId === feedIn.id);
  if (!feedInLink) throw httpError(409, "The feed-in session is not linked to a course section yet. Check its course and dates in Program Management, then try again.", "NOT_SCHEDULED");
  const starts = new Map((await rows(inst, "PM:SESSION", [scheduleId])).map((x) => [x.id, s(x.data.startDate)]));
  const picked = new Map<string, string>([[feedInLink.course, feedInLink.sectionId]]);
  if (opts.scope === "schedule") {
    const later = linked
      .filter((x) => x.course !== feedInLink.course && (!feedIn.startDate || !starts.get(x.sessionId) || starts.get(x.sessionId)! >= feedIn.startDate))
      .sort((a, b) => (starts.get(a.sessionId) ?? "").localeCompare(starts.get(b.sessionId) ?? ""));
    for (const x of later) if (!picked.has(x.course)) picked.set(x.course, x.sectionId);
  }
  const held = await prisma.enrolment.findMany({
    where: { institutionId: inst, studentId, status: { in: ["enrolled", "waitlisted", "completed"] }, section: { courseId: { in: [...picked.keys()] } } },
    select: { sectionId: true, section: { select: { courseId: true } } },
  });
  const heldCourse = new Set(held.filter((e) => picked.get(e.section.courseId) !== e.sectionId).map((e) => e.section.courseId));
  const sectionIds = [...picked.entries()].filter(([course]) => !heldCourse.has(course)).map(([, sectionId]) => sectionId);
  return enrolInSections(user, studentId, sectionIds, { source: "admin.students.programPlan", postFee: opts.postFee, skipExisting: true });
}

/* ------------------------------------------------------------------ */
/* Entry / Progress Tests                                               */
/* ------------------------------------------------------------------ */

export function testView(r: { id: string; contextKey: string; data: Data; createdAt: Date }) {
  return { id: r.id, studentId: r.contextKey, testId: s(r.data.testId), test: s(r.data.test), date: s(r.data.date), mark: s(r.data.mark), hide: r.data.hide === true, status: s(r.data.mark) ? "Marked" : "Pending Mark" };
}

export async function listTests(user: SessionClaims, id: string) {
  await canStudents(user, "view");
  await requireStudentRow(user.institutionId, id);
  const items = (await rows(user.institutionId, STU.TEST, id)).map(testView).sort((a, b) => b.date.localeCompare(a.date));
  const options = (await rows(user.institutionId, "CM:TEST")).map((t) => ({ id: t.id, name: s(t.data.name) })).filter((t) => t.name);
  return { items, options };
}

export async function addTest(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const tests = await rows(inst, "CM:TEST");
  const test = tests.find((t) => t.id === s(body.testId));
  if (!test) throw httpError(400, "Select an Entry / Progress Test");
  const date = optDate(body.date, "Test Date");
  if (!date) throw httpError(400, "Test Date is required");
  const rec = await add(user, STU.TEST, { testId: test.id, test: s(test.data.name), date, hide: bool(body.hide), mark: "" }, id);
  await stuAudit(user, "Program Plan", id, "Entry / progress test added", { test: s(test.data.name), date, hideFromTranscript: bool(body.hide) }, rec.id);
  return testView(rec);
}

/* ------------------------------------------------------------------ */
/* Final marks + transcript                                             */
/* ------------------------------------------------------------------ */

export async function finalMarks(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const summary = await getTranscriptSummary(inst, id);
  const term = s(q.term);
  const rows = summary.courses.filter((c) => !term || term === "all" || c.termCode === term);
  const items = rows.map((c) => ({
    id: c.enrolmentId,
    course: `${c.courseCode} — ${c.title}`,
    term: c.termName,
    credits: c.credits,
    percent: c.averagePercent,
    finalGrade: c.letter,
    gradePoint: c.gradePoints,
    status: c.status === "withdrawn" && !c.final ? "Withdrawn" : COURSE_STATUS_LABEL[c.courseStatus],
    completed: c.final ? (c.endsOn ?? "") : "",
  }));
  const totals = rows.length === summary.courses.length ? summary : { ...summary, ...summarizeCourses(rows) };
  return {
    programs: [{ value: "all", label: "All Programs" }, ...(summary.programName && summary.programName !== "all" ? [{ value: summary.programName, label: summary.programName }] : [])],
    terms: summary.terms,
    items,
    cgpa: totals.cgpa,
    earnedCredits: totals.earnedCredits,
    attemptedCredits: totals.attemptedCredits,
    averagePercent: totals.averagePercent,
    currentAverage: totals.currentAverage,
  };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

export async function transcriptPdf(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const start = optDate(body.startDate, "Start Date");
  const end = optDate(body.completionDate, "Completion Date");
  if (start && end && start > end) throw httpError(400, "Start Date must be on or before Completion Date");
  const opt = Object.fromEntries(TRANSCRIPT_OPTIONS.map((o) => [o.key, bool((body.options as Data | undefined)?.[o.key])])) as Record<(typeof TRANSCRIPT_OPTIONS)[number]["key"], boolean>;
  const [summary, profile, tests, transfers] = await Promise.all([
    getTranscriptSummary(inst, id),
    loadProfile(inst, id),
    opt.tests ? rows(inst, STU.TEST, id) : Promise.resolve([]),
    opt.transfer ? prisma.transferCredit.findMany({ where: { institutionId: inst, studentId: id, status: "accepted" } }) : Promise.resolve([]),
  ]);
  const inRange = (from?: string | null, to?: string | null) => (!start || !from || from >= start) && (!end || !(to ?? from) || (to ?? from)! <= end);
  const failing = (c: { gradePoints: number | null; letter: string }) => c.gradePoints === 0 || c.letter === "F";
  let courses = summary.courses.filter((c) => inRange(c.startsOn, c.endsOn));
  courses = courses.filter((c) => {
    if (c.status === "withdrawn") return opt.droppedPenalty;
    if (!c.final) return opt.inProgress;
    if (failing(c)) return opt.noCredit;
    return true;
  });
  if (!opt.overlapping) {
    const latest = new Map<string, number>();
    for (const c of courses) latest.set(c.courseCode, Math.max(latest.get(c.courseCode) ?? 0, c.attemptNumber));
    courses = courses.filter((c) => c.attemptNumber === latest.get(c.courseCode));
  }

  const lines: DocLine[] = [
    { kind: "title", text: "Academic Transcript" },
    { kind: "text", text: `${st.person.familyName}, ${st.person.givenName}`, bold: true },
    { kind: "text", text: `Student #: ${st.studentNumber}${profile.applicationNumber ? `   Application #: ${profile.applicationNumber}` : ""}` },
    { kind: "text", text: `Program: ${summary.programName}` },
    { kind: "text", text: `Start Date: ${start || profile.scheduleStart || "—"}   Completion Date: ${end || profile.scheduleEnd || "—"}` },
    { kind: "gap" },
    { kind: "row", cells: [{ text: "Course", x: 0, bold: true }, { text: "Term", x: 220, bold: true }, { text: "Credits", x: 395, bold: true }, { text: "Grade", x: 445, bold: true }, { text: "GP", x: 500, bold: true }] },
    { kind: "rule" },
    ...courses.map(
      (c): DocLine => ({
        kind: "row",
        cells: [
          { text: clip(`${c.courseCode} ${c.title}`, 38), x: 0 },
          { text: clip(c.termName || c.termCode || "", 30), x: 220 },
          { text: String(c.credits), x: 395 },
          { text: c.letter, x: 445 },
          { text: c.gradePoints == null ? "" : c.gradePoints.toFixed(2), x: 500 },
        ],
      }),
    ),
  ];
  if (!courses.length) lines.push({ kind: "text", text: "No courses match the selected transcript options." });
  if (transfers.length) {
    lines.push({ kind: "gap" }, { kind: "text", text: "Transfer Courses", bold: true }, { kind: "rule" });
    for (const t of transfers) lines.push({ kind: "row", cells: [{ text: `${t.externalCode} ${t.externalTitle}`.slice(0, 48), x: 0 }, { text: String(t.credits), x: 380 }, { text: "TR", x: 440 }] });
  }
  const shownTests = tests.filter((t) => t.data.hide !== true && s(t.data.mark) && inRange(s(t.data.date), s(t.data.date)));
  if (shownTests.length) {
    lines.push({ kind: "gap" }, { kind: "text", text: "Entry / Progress Tests", bold: true }, { kind: "rule" });
    for (const t of shownTests) lines.push({ kind: "row", cells: [{ text: s(t.data.test).slice(0, 48), x: 0 }, { text: s(t.data.date), x: 270 }, { text: s(t.data.mark), x: 440 }] });
  }
  lines.push({ kind: "gap" }, { kind: "text", text: `Cumulative GPA: ${summary.cgpa ?? "—"}`, bold: true });
  await stuAudit(user, "Transcripts/Final Marks", id, "Transcript generated", { options: TRANSCRIPT_OPTIONS.filter((o) => opt[o.key]).map((o) => o.label), startDate: start, completionDate: end, courses: courses.length });
  return { pdf: buildDocumentPdf(lines, `Generated ${new Date().toISOString().slice(0, 10)}`), filename: `transcript-${st.studentNumber}.pdf` };
}
