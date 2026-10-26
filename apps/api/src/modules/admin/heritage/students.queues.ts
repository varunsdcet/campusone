/* Student Management global work queues (multi-student screens, separate from the same-name profile tabs). */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { applyApproval, decideApproval } from "@myheritage/auth";
import { dateBoundsFromSessions, deliveryFromSessions, instructorDisplayName, roomFromSessions, scheduleTextFromSessions } from "../../courses/sectionSchedule.js";
import { page, studentMatches, type StudentInfo } from "./finance.core.js";
import { add, arr, assertStudentCampusAccess, canStudents, httpError, optDate, rows, s, scopedStudentsInfo, stuAudit, text, type Data } from "./students.core.js";
import { caseView, reqView } from "./students.comms.js";
import { testView } from "./students.plan.js";
import { filterFlags, flagView } from "./students.js";
import { BADGE_STATUSES, LOA_STATUSES, STU, WITHDRAW_STATUSES } from "./students.spec.js";
import { requestNumbersFor } from "./requests.js";
import { assertPermission } from "../superAdmin.service.js";
import { institutionTimezone, ymdIn } from "../../../lib/workshopPolicy.js";

const GRADE_TYPES = ["grade.publish", "grade_publish"];
const letterOf = (v: unknown) => text(v, 1).toUpperCase();
const byLetter = (info: StudentInfo | undefined, letter: string) => !letter || (info?.last ?? "").toUpperCase().startsWith(letter);
const studentCell = (info: StudentInfo | undefined, id: string) => ({ id, name: info ? `${info.last}, ${info.first}` : "Unknown student", number: info?.number ?? "", campus: info?.campus ?? "", program: info?.program ?? "" });

/* ------------------------------------------------------------------ */
/* Academic Alerts                                                      */
/* ------------------------------------------------------------------ */

export async function academicAlerts(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const list = await rows(inst, STU.ALERT);
  const info = await scopedStudentsInfo(user, [...new Set(list.map((r) => r.contextKey))]);
  const status = s(q.status) || "Active";
  const resolved = s(q.resolved) || "No";
  const items = list
    .filter((r) => {
      const st = info.get(r.contextKey);
      if (!st) return false;
      if (s(q.campus) && st?.campus !== s(q.campus)) return false;
      if (s(q.student) && !studentMatches(st, s(q.student))) return false;
      if ((s(r.data.status) || "Active") !== status) return false;
      if ((s(r.data.resolved) || "No") !== resolved) return false;
      return true;
    })
    .map((r) => ({ id: r.id, student: studentCell(info.get(r.contextKey), r.contextKey), description: s(r.data.description), status: s(r.data.status) || "Active", resolved: s(r.data.resolved) || "No", date: r.createdAt.toISOString() }));
  const canDecide = await canStudents(user, "edit").then(() => true, () => false);
  return { items, canDecide };
}

export async function resolveAcademicAlert(user: SessionClaims, alertId: string) {
  await canStudents(user, "edit");
  const row = await prisma.heritageRecord.findFirst({ where: { id: alertId, institutionId: user.institutionId, screenId: STU.ALERT, deletedAt: null } });
  if (!row) throw httpError(404, "Academic alert not found", "NOT_FOUND");
  await assertStudentCampusAccess(user, row.contextKey);
  const before = JSON.parse(row.dataJson) as Data;
  if (s(before.resolved) === "Yes") throw httpError(409, "This academic alert is already resolved", "CONFLICT");
  const after = { ...before, resolved: "Yes", status: "Dismissed", resolvedAt: new Date().toISOString(), resolvedBy: user.accountId };
  const claimed = await prisma.heritageRecord.updateMany({ where: { id: row.id, rowVersion: row.rowVersion }, data: { dataJson: JSON.stringify(after), rowVersion: { increment: 1 }, updatedById: user.accountId } });
  if (claimed.count !== 1) throw httpError(409, "This alert changed while you were reviewing it. Reload and try again.", "CONFLICT");
  await stuAudit(user, "Assessments", row.contextKey, "Academic alert resolved", after, row.id, before);
  return { status: "resolved", message: "Academic alert resolved" };
}

/* ------------------------------------------------------------------ */
/* Student Flags                                                        */
/* ------------------------------------------------------------------ */

export async function studentFlags(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const list = (await rows(inst, STU.FLAG)).map(flagView);
  const info = await scopedStudentsInfo(user, [...new Set(list.map((f) => f.studentId))]);
  const template = s(q.template);
  const templateRow = template ? await prisma.heritageRecord.findFirst({ where: { id: template, institutionId: inst, screenId: "SYS:FLAG_TEMPLATE" } }) : null;
  const templateName = templateRow ? s((JSON.parse(templateRow.dataJson) as Data).name) : "";
  const items = filterFlags(list, q)
    .filter((f) => {
      const st = info.get(f.studentId);
      if (!st) return false;
      if (s(q.campus) && st?.campus !== s(q.campus)) return false;
      if (s(q.student) && !studentMatches(st, s(q.student))) return false;
      if (template && f.templateId !== template && f.name !== templateName) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((f) => ({ ...f, student: studentCell(info.get(f.studentId), f.studentId) }));
  return page(items, q);
}

/* ------------------------------------------------------------------ */
/* Student Assessments                                                  */
/* ------------------------------------------------------------------ */

export async function studentAssessments(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const list = (await rows(inst, STU.ASSESS)).map(caseView);
  const info = await scopedStudentsInfo(user, [...new Set(list.map((c) => c.studentId))]);
  const items = list
    .filter((c) => {
      if (!info.has(c.studentId)) return false;
      if (s(q.number) && !c.number.includes(s(q.number))) return false;
      if (s(q.student) && !studentMatches(info.get(c.studentId), s(q.student))) return false;
      if (s(q.status) && c.status !== s(q.status)) return false;
      if (s(q.advisor) && c.advisor !== s(q.advisor)) return false;
      return true;
    })
    .map((c) => ({ ...c, student: studentCell(info.get(c.studentId), c.studentId) }));
  return page(items, q);
}

/* ------------------------------------------------------------------ */
/* Student Requirements                                                 */
/* ------------------------------------------------------------------ */

export async function studentRequirements(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const list = await rows(inst, STU.REQ);
  const info = await scopedStudentsInfo(user, [...new Set(list.map((r) => r.contextKey))]);
  const taskIds = list.map((r) => s(r.data.taskId)).filter(Boolean);
  const done = new Set((taskIds.length ? await prisma.requiredTask.findMany({ where: { institutionId: inst, id: { in: taskIds }, completedAt: { not: null } }, select: { id: true } }) : []).map((t) => t.id));
  const letter = letterOf(q.letter);
  const items = list
    .map((r) => reqView(r, done.has(s(r.data.taskId))))
    .filter((r) => {
      const st = info.get(r.studentId);
      if (!st) return false;
      if (s(q.student) && !studentMatches(st, s(q.student))) return false;
      if (s(q.status) && s(q.status) !== "All" && r.status !== s(q.status)) return false;
      if (s(q.submission) && r.submission !== s(q.submission)) return false;
      if (s(q.program) && st?.program !== s(q.program)) return false;
      if (s(q.workflow) && r.workflowId !== s(q.workflow)) return false;
      return byLetter(st, letter);
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map(({ history: _h, ...r }) => ({ ...r, student: studentCell(info.get(r.studentId), r.studentId) }));
  return page(items, q);
}

/* ------------------------------------------------------------------ */
/* Leave of Absence                                                     */
/* ------------------------------------------------------------------ */

function loaStatus(status: string, startsOn: string, endsOn: string, today: string) {
  const st = status.toLowerCase();
  if (st === "pending") return "Pending";
  if (["rejected", "declined"].includes(st)) return "Declined";
  if (["approved", "applied", "active"].includes(st)) {
    if (endsOn && endsOn < today) return "Completed";
    if (startsOn && startsOn > today) return "Approved";
    return "Active";
  }
  if (st === "completed") return "Completed";
  return status;
}

export async function leaveOfAbsence(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const loas = await prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 2000 });
  const info = await scopedStudentsInfo(user, [...new Set(loas.map((l) => l.studentId))]);
  const status = s(q.status);
  if (status && !(LOA_STATUSES as readonly string[]).includes(status)) throw httpError(400, "Unknown status");
  const letter = letterOf(q.letter);
  const today = ymdIn(new Date(), await institutionTimezone(inst));
  const items = loas
    .filter((l) => l.status !== "cancelled" && info.has(l.studentId))
    .map((l) => ({ id: l.id, student: studentCell(info.get(l.studentId), l.studentId), reason: l.reason, startsOn: l.startsOn, endsOn: l.endsOn, status: loaStatus(l.status, l.startsOn, l.endsOn, today), requested: l.createdAt.toISOString(), decisionNote: l.decisionNote ?? "" }))
    .filter((l) => (!status || l.status === status) && (!s(q.student) || studentMatches(info.get(l.student.id), s(q.student))) && byLetter(info.get(l.student.id), letter));
  return withRequestNumbers(user, page(items, q), "loa");
}

/** Leave and withdraw decisions are made on the User Request review page, which owns the approval, status and enrolment effects. */
async function withRequestNumbers<T extends { id: string }>(user: SessionClaims, paged: ReturnType<typeof page<T>>, kind: "loa" | "service") {
  const numbers = await requestNumbersFor(user, paged.items.map((i) => `${kind}:${i.id}`));
  const canDecide = await assertPermission(user, "userRequests", "edit").then(
    () => true,
    () => false,
  );
  return { ...paged, canDecide, items: paged.items.map((i) => ({ ...i, requestNumber: numbers.get(`${kind}:${i.id}`) ?? null })) };
}

/* ------------------------------------------------------------------ */
/* Course Withdraw Requests                                             */
/* ------------------------------------------------------------------ */

function withdrawStatus(status: string) {
  const st = status.toLowerCase();
  if (["open", "pending", "pending_approval", "submitted", "in_review"].includes(st)) return "Pending";
  if (["resolved", "approved", "completed"].includes(st)) return "Approved";
  if (["rejected", "declined"].includes(st)) return "Declined";
  return status;
}

export async function withdrawRequests(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const list = await prisma.serviceRequest.findMany({ where: { institutionId: inst, type: { contains: "withdraw", mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 2000 });
  const info = await scopedStudentsInfo(user, [...new Set(list.map((r) => r.studentId))]);
  const status = s(q.status);
  if (status && !(WITHDRAW_STATUSES as readonly string[]).includes(status)) throw httpError(400, "Unknown status");
  const letter = letterOf(q.letter);
  const items = list
    .filter((r) => r.status !== "cancelled" && info.has(r.studentId))
    .map((r) => ({ id: r.id, student: studentCell(info.get(r.studentId), r.studentId), subject: r.subject, details: r.details, status: withdrawStatus(r.status), requested: r.createdAt.toISOString() }))
    .filter((r) => (!status || r.status === status) && (!s(q.student) || studentMatches(info.get(r.student.id), s(q.student))) && byLetter(info.get(r.student.id), letter));
  return withRequestNumbers(user, page(items, q), "service");
}

/* ------------------------------------------------------------------ */
/* Pending Grade Submissions                                            */
/* ------------------------------------------------------------------ */

const sectionIdOf = (subjectRef: string) => subjectRef.replace(/^section:/, "");

function letterFor(pct: number) {
  if (pct >= 90) return "A";
  if (pct >= 85) return "A-";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "B-";
  if (pct >= 65) return "C+";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}
const GP: Record<string, number> = { A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "B-": 2.7, "C+": 2.3, C: 2.0, D: 1.0, F: 0 };

async function pendingGradeApprovals(inst: string) {
  return prisma.approvalRequest.findMany({ where: { institutionId: inst, type: { in: GRADE_TYPES }, status: "pending" }, orderBy: { createdAt: "desc" } });
}

async function sectionsFor(inst: string, ids: string[]) {
  const sections = ids.length
    ? await prisma.section.findMany({
        where: { institutionId: inst, id: { in: ids } },
        include: { course: true, term: true, classSessions: { orderBy: { startsAt: "asc" } }, enrolments: { select: { studentId: true } } },
      })
    : [];
  const instructors = await prisma.person.findMany({ where: { id: { in: [...new Set(sections.map((x) => x.instructorPersonId))] } } });
  const instructorBy = new Map(instructors.map((p) => [p.id, instructorDisplayName(p) ?? ""]));
  return new Map(sections.map((x) => [x.id, { ...x, instructor: instructorBy.get(x.instructorPersonId) ?? "" }]));
}

async function accountName(ids: string[]) {
  const accounts = ids.length ? await prisma.account.findMany({ where: { id: { in: [...new Set(ids)] } }, include: { person: true } }) : [];
  return new Map(accounts.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim() || a.email]));
}

export async function gradeSubmissions(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const approvals = await pendingGradeApprovals(inst);
  const sections = await sectionsFor(
    inst,
    approvals.map((a) => sectionIdOf(a.subjectRef)),
  );
  const names = await accountName(approvals.map((a) => a.requestedBy));
  const campusFilter = s(q.campus);
  const info = await scopedStudentsInfo(user);
  const items = approvals
    .map((a) => {
      const sec = sections.get(sectionIdOf(a.subjectRef));
      if (!sec) return null;
      const bounds = dateBoundsFromSessions(sec.classSessions);
      return {
        id: a.id,
        sectionId: sec.id,
        courseCode: sec.course.code,
        offering: sec.code,
        courseTitle: sec.course.title,
        courseId: sec.courseId,
        instructor: sec.instructor,
        instructorPersonId: sec.instructorPersonId,
        startsOn: bounds.startsOn ?? sec.term.startsOn,
        endsOn: bounds.endsOn ?? sec.term.endsOn,
        submittedBy: names.get(a.requestedBy) ?? "",
        submittedAt: a.createdAt.toISOString(),
        studentIds: sec.enrolments.map((e) => e.studentId),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((x) => x.studentIds.length > 0 && x.studentIds.every((sid) => info.has(sid)))
    .filter((x) => (!s(q.course) || x.courseId === s(q.course)) && (!s(q.instructor) || x.instructorPersonId === s(q.instructor)))
    .filter((x) => !campusFilter || x.studentIds.some((sid) => info.get(sid)?.campus === campusFilter))
    .map(({ studentIds: _s, ...x }) => x);
  const courseOptions = [...new Map([...sections.values()].map((x) => [x.courseId, `${x.course.code} — ${x.course.title}`])).entries()].map(([value, label]) => ({ value, label }));
  const instructorOptions = [...new Map([...sections.values()].map((x) => [x.instructorPersonId, x.instructor])).entries()].map(([value, label]) => ({ value, label }));
  return { ...page(items, q), courseOptions, instructorOptions };
}

async function pendingGrade(inst: string, approvalId: string) {
  const a = await prisma.approvalRequest.findFirst({ where: { id: approvalId, institutionId: inst, type: { in: GRADE_TYPES } } });
  if (!a) throw httpError(404, "Grade submission not found", "NOT_FOUND");
  return a;
}

export async function gradeSubmission(user: SessionClaims, approvalId: string) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const a = await pendingGrade(inst, approvalId);
  const sec = (await sectionsFor(inst, [sectionIdOf(a.subjectRef)])).get(sectionIdOf(a.subjectRef));
  if (!sec) throw httpError(404, "The submitted course section no longer exists", "NOT_FOUND");
  const diff = JSON.parse(a.proposedDiffJson) as { gradeItemIds?: string[] };
  const items = await prisma.gradeItem.findMany({ where: { institutionId: inst, id: { in: diff.gradeItemIds ?? [] } } });
  const studentIds = [...new Set(items.map((g) => g.studentId))];
  const info = await scopedStudentsInfo(user, studentIds);
  if (studentIds.some((studentId) => !info.has(studentId))) throw httpError(403, "This grade submission includes a student outside your assigned campus scope", "FORBIDDEN");
  const bounds = dateBoundsFromSessions(sec.classSessions);
  const endsOn = bounds.endsOn ?? sec.term.endsOn;
  const saved = await rows(inst, "STU:COMPLETION", approvalId);
  const completion = (saved[0]?.data ?? {}) as Record<string, string>;
  const students = studentIds
    .map((sid) => {
      const mine = items.filter((g) => g.studentId === sid);
      const max = mine.reduce((t, g) => t + g.maxScore, 0);
      const score = mine.reduce((t, g) => t + (g.score ?? 0), 0);
      const pct = max > 0 ? (score / max) * 100 : 0;
      const letter = mine.length === 1 && mine[0]!.letter ? mine[0]!.letter : letterFor(pct);
      const gp = GP[letter] ?? null;
      const st = info.get(sid);
      return {
        studentId: sid,
        name: st ? `${st.last}, ${st.first}` : "Unknown student",
        number: st?.number ?? "",
        completionDate: completion[sid] ?? endsOn ?? "",
        creditReceived: gp !== null && gp > 0 ? sec.course.credits : 0,
        gradePoint: gp,
        finalGrade: `${letter} (${pct.toFixed(1)}%)`,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
  const submitter = (await accountName([a.requestedBy])).get(a.requestedBy) ?? "";
  return {
    id: a.id,
    status: a.status,
    course: `${sec.course.code} ${sec.code} — ${sec.course.title}`,
    session: {
      instructors: sec.instructor,
      room: roomFromSessions(sec.classSessions) ?? "",
      delivery: deliveryFromSessions(sec.classSessions) ?? "",
      startsOn: bounds.startsOn ?? sec.term.startsOn,
      endsOn,
      schedule: scheduleTextFromSessions(sec.classSessions) ?? "",
    },
    submittedBy: submitter,
    submittedAt: a.createdAt.toISOString(),
    students,
  };
}

export async function approveGradeSubmission(user: SessionClaims, approvalId: string, body: Data) {
  await assertPermission(user, "userRequests", "edit");
  const inst = user.institutionId;
  const a = await pendingGrade(inst, approvalId);
  if (a.status !== "pending") throw httpError(409, "This grade submission has already been decided", "CONFLICT");
  const dates: Record<string, string> = {};
  const proposedIds = arr<string>((JSON.parse(a.proposedDiffJson) as Data).gradeItemIds);
  const proposedStudents = [...new Set((await prisma.gradeItem.findMany({ where: { id: { in: proposedIds }, institutionId: inst }, select: { studentId: true } })).map((item) => item.studentId))];
  for (const studentId of proposedStudents) await assertStudentCampusAccess(user, studentId);
  for (const [sid, v] of Object.entries((body.completionDates as Data | undefined) ?? {})) {
    const d = optDate(v, "Completion Date");
    if (d) dates[sid] = d;
  }
  const decided = await decideApproval({ approvalId, institutionId: inst, actorId: user.accountId, actorRoles: user.roles, decision: "approve" });
  if (decided.status === "approved") {
    await applyApproval({
      approvalId,
      institutionId: inst,
      actorId: user.accountId,
      applyFn: async (diff, tx) => {
        const ids = arr<string>((diff as Data).gradeItemIds);
        if (ids.length) await tx.gradeItem.updateMany({ where: { id: { in: ids }, institutionId: inst }, data: { status: "published", publishedAt: new Date() } });
      },
    });
  }
  if (Object.keys(dates).length) await add(user, "STU:COMPLETION", dates, approvalId);
  const studentIds = [...new Set((await prisma.gradeItem.findMany({ where: { id: { in: arr<string>(JSON.parse(a.proposedDiffJson).gradeItemIds) } }, select: { studentId: true } })).map((g) => g.studentId))];
  for (const sid of studentIds) await stuAudit(user, "Transcripts/Final Marks", sid, "Grade submission approved", { submission: approvalId, completionDate: dates[sid] ?? "" }, approvalId);
  return { status: decided.status === "approved" ? "applied" : decided.status };
}

export async function declineGradeSubmission(user: SessionClaims, approvalId: string) {
  await assertPermission(user, "userRequests", "edit");
  const inst = user.institutionId;
  const a = await pendingGrade(inst, approvalId);
  if (a.status !== "pending") throw httpError(409, "This grade submission has already been decided", "CONFLICT");
  const proposedIds = arr<string>((JSON.parse(a.proposedDiffJson) as Data).gradeItemIds);
  const proposedStudents = [...new Set((await prisma.gradeItem.findMany({ where: { id: { in: proposedIds }, institutionId: inst }, select: { studentId: true } })).map((item) => item.studentId))];
  for (const studentId of proposedStudents) await assertStudentCampusAccess(user, studentId);
  await decideApproval({ approvalId, institutionId: inst, actorId: user.accountId, actorRoles: user.roles, decision: "reject" });
  const ids = arr<string>(JSON.parse(a.proposedDiffJson).gradeItemIds);
  if (ids.length) await prisma.gradeItem.updateMany({ where: { id: { in: ids }, institutionId: inst, status: "pending_publish" }, data: { status: "draft" } });
  return { status: "rejected" };
}

/* ------------------------------------------------------------------ */
/* Pending Transcript Changes / Entry Marks / Badges / Bulk log         */
/* ------------------------------------------------------------------ */

export async function transcriptChanges(user: SessionClaims) {
  await canStudents(user, "view");
  const list = (await rows(user.institutionId, STU.TRANSCRIPT_CHANGE)).filter((r) => s(r.data.status) === "Pending");
  const info = await scopedStudentsInfo(user, [...new Set(list.map((r) => r.contextKey))]);
  const canDecide = await canStudents(user, "edit").then(() => true, () => false);
  return { canDecide, items: list.filter((r) => info.has(r.contextKey)).map((r) => ({ id: r.id, student: studentCell(info.get(r.contextKey), r.contextKey), description: s(r.data.description), date: r.createdAt.toISOString() })) };
}

export async function decideTranscriptChange(user: SessionClaims, changeId: string, body: Data) {
  await canStudents(user, "edit");
  const decision = s(body.decision);
  if (decision !== "approve" && decision !== "reject") throw httpError(400, "Choose Approve or Reject");
  const row = await prisma.heritageRecord.findFirst({ where: { id: changeId, institutionId: user.institutionId, screenId: STU.TRANSCRIPT_CHANGE, deletedAt: null } });
  if (!row) throw httpError(404, "Transcript change not found", "NOT_FOUND");
  await assertStudentCampusAccess(user, row.contextKey);
  const before = JSON.parse(row.dataJson) as Data;
  if (s(before.status) !== "Pending") throw httpError(409, "This transcript change has already been decided", "CONFLICT");
  const after = { ...before, status: decision === "approve" ? "Approved" : "Rejected", decisionNote: text(body.note, 1000), decidedAt: new Date().toISOString(), decidedBy: user.accountId };
  const claimed = await prisma.heritageRecord.updateMany({ where: { id: row.id, rowVersion: row.rowVersion }, data: { dataJson: JSON.stringify(after), rowVersion: { increment: 1 }, updatedById: user.accountId } });
  if (claimed.count !== 1) throw httpError(409, "This transcript change was decided by someone else. Reload and try again.", "CONFLICT");
  await stuAudit(user, "Transcripts/Final Marks", row.contextKey, `Transcript change ${decision === "approve" ? "approved" : "rejected"}`, after, row.id, before);
  return { status: after.status, message: `Transcript change ${decision === "approve" ? "approved" : "rejected"}` };
}

export async function pendingEntryMarks(user: SessionClaims) {
  await canStudents(user, "view");
  const list = (await rows(user.institutionId, STU.TEST)).map(testView).filter((t) => !t.mark);
  const info = await scopedStudentsInfo(user, [...new Set(list.map((t) => t.studentId))]);
  return { items: list.filter((t) => info.has(t.studentId)).map((t) => ({ ...t, student: studentCell(info.get(t.studentId), t.studentId) })) };
}

function badgeStatus(status: string) {
  const st = status.toLowerCase();
  if (st === "pending") return "Pending";
  if (["declined", "rejected"].includes(st)) return "Declined";
  return "Approved";
}

export async function badgeQueue(user: SessionClaims, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const status = s(q.status);
  if (status && !(BADGE_STATUSES as readonly string[]).includes(status)) throw httpError(400, "Unknown status");
  const list = await prisma.studentBadge.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 3000 });
  const info = await scopedStudentsInfo(user, [...new Set(list.map((b) => b.studentId))]);
  const userQ = text(q.user, 120).toLowerCase();
  const badge = s(q.badge);
  const items = list
    .filter((b) => info.has(b.studentId))
    .map((b) => ({ id: b.id, student: studentCell(info.get(b.studentId), b.studentId), email: info.get(b.studentId)?.email ?? "", badge: b.title, code: b.code, status: badgeStatus(b.status), earned: b.earnedAt?.toISOString() ?? "" }))
    .filter((b) => (!status || b.status === status) && (!badge || b.badge === badge || b.code === badge))
    .filter((b) => !userQ || b.student.number.toLowerCase().includes(userQ) || b.email.toLowerCase().includes(userQ) || b.student.name.toLowerCase().startsWith(userQ));
  const canDecide = await canStudents(user, "edit").then(
    () => true,
    () => false,
  );
  return { ...page(items, q), canDecide };
}

export async function decideBadge(user: SessionClaims, badgeId: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  const decision = s(body.decision);
  if (decision !== "approve" && decision !== "decline") throw httpError(400, "Choose Approve or Decline");
  const badge = await prisma.studentBadge.findFirst({ where: { id: badgeId, institutionId: inst } });
  if (!badge) throw httpError(404, "Badge not found", "NOT_FOUND");
  await assertStudentCampusAccess(user, badge.studentId);
  if (badge.status !== "pending") throw httpError(409, "This badge has already been reviewed", "CONFLICT");
  const approve = decision === "approve";
  const claimed = await prisma.studentBadge.updateMany({
    where: { id: badge.id, rowVersion: badge.rowVersion, status: "pending" },
    data: { status: approve ? "earned" : "declined", earnedAt: approve ? new Date() : null, rowVersion: { increment: 1 } },
  });
  if (claimed.count !== 1) throw httpError(409, "This badge was reviewed by someone else. Reload and try again.", "CONFLICT");
  const note = text(body.comments, 1000);
  await stuAudit(user, "Assessments", badge.studentId, approve ? `Badge "${badge.title}" awarded` : `Badge "${badge.title}" declined`, { status: approve ? "earned" : "declined", note: note || null }, badge.id, { status: badge.status });
  return { message: `${badge.title} ${approve ? "awarded" : "declined"}`, status: approve ? "Approved" : "Declined" };
}

export async function bulkLog(user: SessionClaims) {
  await canStudents(user, "view");
  return { items: (await rows(user.institutionId, STU.BULK_LOG)).map((r) => ({ id: r.id, action: s(r.data.action), summary: s(r.data.summary), date: r.createdAt.toISOString() })) };
}
