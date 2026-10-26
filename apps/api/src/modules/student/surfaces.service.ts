import type { SessionClaims } from "@myheritage/contracts";
import {
  CreateLeaveOfAbsenceRequest,
  CreateStudentServiceRequest,
  LogPracticumHoursRequest,
  RegisterWorkshopRequest,
  StartAssessmentAttemptResponse,
  StudentAssessmentsResponse,
  StudentAttendanceResponse,
  StudentBadgesResponse,
  StudentCareerResponse,
  StudentCredentialsResponse,
  StudentFinanceResponse,
  StudentFinanceStatementResponse,
  StudentLabNotebook,
  StudentLecturesResponse,
  StudentPracticumResponse,
  StudentResourcesResponse,
  StudentServiceRequestsResponse,
  StudentWorkshopsResponse,
  ExtracurricularResponse,
  LeaveOfAbsenceListResponse,
  RequiredTasksResponse,
  TaxDocumentsResponse,
  SubmitAssessmentAttemptResponse,
  UpsertLabNotebookRequest,
} from "@myheritage/contracts";
import { requireApproval } from "@myheritage/auth";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { studentCareerOpportunityHref } from "../../lib/careerOpportunityLink.js";
import { sessionJoinUrl } from "../../lib/liveClass.js";
import { isSafeLink } from "../../lib/safeLink.js";
import {
  SEAT_STATUSES,
  feeFor,
  institutionTimezone,
  postWorkshopFee,
  waiveWorkshopFee,
  storedStatus,
  studentMayRegister,
  workshopPhase,
  workshopSettings,
  ymdIn,
  type StudentAccess,
} from "../../lib/workshopPolicy.js";
import { studentMetaMap } from "../admin/superAdmin.service.js";
import { studentStatusPolicy, storeValidFile, validateFile } from "../admin/heritage/students.core.js";
import { promoteWaitlisted } from "../admin/heritage/enrolment.js";
import { assertNoActiveStudentHold, currentStudentId } from "../me/studentAlignment.js";
import { studentPaymentsEnabled } from "./finance.payments.js";

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

function dataOf(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function withdrawalPolicy(institutionId: string, studentId: string) {
  const profile = await prisma.heritageRecord.findFirst({
    where: { institutionId, screenId: "STU:PROFILE", contextKey: studentId, singletonKey: "profile", deletedAt: null },
    select: { dataJson: true },
  });
  const programId = String(dataOf(profile?.dataJson).programId || "");
  if (!programId) return "Always requires approval";
  const program = await prisma.heritageRecord.findFirst({
    where: { id: programId, institutionId, screenId: "PM:PROGRAM", deletedAt: null },
    select: { dataJson: true },
  });
  return String(dataOf(program?.dataJson).dropPenalties || "Always requires approval");
}

const AssessmentQuestion = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(1000)).min(2).max(10),
  correct: z.number().int().nonnegative(),
});
const AssessmentAnswers = z.object({ answers: z.record(z.string(), z.number().int().nonnegative()) });

function assessmentQuestions(json: string) {
  const parsed = z.array(AssessmentQuestion).safeParse(JSON.parse(json || "[]"));
  return parsed.success ? parsed.data.filter((question) => question.correct < question.options.length) : [];
}

export async function requireStudent(user: SessionClaims, sectionId?: string) {
  const student = await prisma.student.findFirst({
    where: sectionId
      ? {
          institutionId: user.institutionId,
          personId: user.personId,
          enrolments: { some: { institutionId: user.institutionId, sectionId, status: { in: ["enrolled", "completed"] } } },
        }
      : { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);
  return student;
}

async function enrolledSectionIds(institutionId: string, studentId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId, studentId, status: "enrolled" },
    select: { sectionId: true },
  });
  return enrolments.map((e) => e.sectionId);
}

export async function listStudentAssessments(user: SessionClaims) {
  const student = await requireStudent(user);
  const sectionIds = await enrolledSectionIds(user.institutionId, student.id);
  const now = new Date();
  const assessments = await prisma.assessment.findMany({
    where: {
      institutionId: user.institutionId,
      sectionId: { in: sectionIds },
      status: "published",
    },
    include: {
      section: { include: { course: true } },
      attempts: { where: { studentId: student.id }, orderBy: { startedAt: "desc" } },
    },
    orderBy: { opensAt: "asc" },
  });

  const mapped = assessments.map((a) => {
    const openAttempt = a.attempts.find((t) => t.status === "open" && t.expiresAt > now);
    const submitted = a.attempts.some((t) => t.status === "submitted");
    const attemptsRemaining = a.attempts.length < a.maxAttempts;
    let state: "upcoming" | "open" | "in_progress" | "submitted" | "closed" = "open";
    if (now < a.opensAt) state = "upcoming";
    else if (openAttempt) state = "in_progress";
    else if (now > a.closesAt) state = submitted ? "submitted" : "closed";
    else if (attemptsRemaining) state = "open";
    else if (submitted) state = "submitted";
    else state = "closed";
    return {
      id: a.id,
      sectionId: a.sectionId,
      courseCode: a.section.course.code,
      title: a.title,
      opensAt: a.opensAt.toISOString(),
      closesAt: a.closesAt.toISOString(),
      durationMinutes: a.durationMinutes,
      maxAttempts: a.maxAttempts,
      attemptCount: a.attempts.length,
      openAttemptId: openAttempt?.id ?? null,
      state,
    };
  });

  return StudentAssessmentsResponse.parse({
    assessments: mapped,
    assessmentAttemptOpen: mapped.some((a) => a.state === "in_progress"),
  });
}

export async function startAssessmentAttempt(
  user: SessionClaims,
  assessmentId: string,
  correlationId: string,
) {
  const student = await requireStudent(user);
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, institutionId: user.institutionId, status: "published" },
    include: { attempts: { where: { studentId: student.id } }, section: true },
  });
  if (!assessment) throw httpError("Assessment not found", "NOT_FOUND", 404);
  const questions = assessmentQuestions(assessment.questionsJson);
  if (!questions.length) throw httpError("This assessment has no published questions yet", "ASSESSMENT_NOT_READY", 409);
  const enrolled = await prisma.enrolment.findFirst({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
      sectionId: assessment.sectionId,
      status: "enrolled",
    },
  });
  if (!enrolled) throw httpError("Not enrolled in section", "FORBIDDEN", 403);
  const now = new Date();
  if (now < assessment.opensAt || now > assessment.closesAt) {
    throw httpError("Assessment window is closed", "CONFLICT", 409);
  }
  const open = assessment.attempts.find((t) => t.status === "open" && t.expiresAt > now);
  if (open) {
    return StartAssessmentAttemptResponse.parse({
      attemptId: open.id,
      expiresAt: open.expiresAt.toISOString(),
      assessmentAttemptOpen: true,
      questions: questions.map(({ correct: _correct, ...question }) => question),
    });
  }
  if (assessment.attempts.length >= assessment.maxAttempts) {
    throw httpError("Maximum attempts reached", "CONFLICT", 409);
  }
  const expiresAt = new Date(now.getTime() + assessment.durationMinutes * 60_000);
  const attempt = await prisma.$transaction(async (tx) => {
    const row = await tx.assessmentAttempt.create({
      data: {
        institutionId: user.institutionId,
        assessmentId: assessment.id,
        studentId: student.id,
        status: "open",
        startedAt: now,
        expiresAt,
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "AssessmentAttempt.started",
      purpose: "assessment",
      before: null,
      after: row,
      source: "student.assessments.start",
      correlationId,
    });
    return row;
  });
  return StartAssessmentAttemptResponse.parse({
    attemptId: attempt.id,
    expiresAt: attempt.expiresAt.toISOString(),
    assessmentAttemptOpen: true,
    questions: questions.map(({ correct: _correct, ...question }) => question),
  });
}

export async function submitAssessmentAttempt(
  user: SessionClaims,
  attemptId: string,
  body: unknown,
  correlationId: string,
) {
  const student = await requireStudent(user);
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: attemptId, institutionId: user.institutionId, studentId: student.id },
  });
  if (!attempt) throw httpError("Attempt not found", "NOT_FOUND", 404);
  if (attempt.status !== "open") throw httpError("Attempt is not open", "CONFLICT", 409);
  const assessment = await prisma.assessment.findFirst({ where: { id: attempt.assessmentId, institutionId: user.institutionId } });
  if (!assessment) throw httpError("Assessment not found", "NOT_FOUND", 404);
  const questions = assessmentQuestions(assessment.questionsJson);
  if (!questions.length) throw httpError("This assessment has no published questions", "ASSESSMENT_NOT_READY", 409);
  const input = AssessmentAnswers.parse(body);
  const missing = questions.find((question) => input.answers[question.id] === undefined);
  const invalid = questions.find((question) => {
    const answer = input.answers[question.id];
    return answer !== undefined && (answer < 0 || answer >= question.options.length);
  });
  if (missing || invalid) throw httpError("Answer every question with a valid choice before submitting", "ASSESSMENT_ANSWERS_INVALID", 400);
  const submittedAt = new Date();
  if (submittedAt > attempt.expiresAt) {
    await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "expired", submittedAt, rowVersion: { increment: 1 } } });
    throw httpError("The timed attempt has expired", "ASSESSMENT_EXPIRED", 409);
  }
  const score = questions.filter((question) => input.answers[question.id] === question.correct).length;
  const maxScore = questions.length;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "submitted",
        submittedAt,
        answersJson: JSON.stringify(input.answers),
        score,
        maxScore,
        rowVersion: { increment: 1 },
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "AssessmentAttempt.submitted",
      purpose: "assessment",
      before: attempt,
      after: { ...row, answers: input.answers, score, maxScore },
      source: "student.assessments.submit",
      correlationId,
    });
    return row;
  });
  if (updated.status !== "submitted") {
    throw httpError("Attempt expired before submission", "CONFLICT", 409);
  }
  return SubmitAssessmentAttemptResponse.parse({
    attemptId: updated.id,
    status: "submitted",
    submittedAt: updated.submittedAt!.toISOString(),
    score,
    maxScore,
  });
}

export async function listStudentAttendance(user: SessionClaims) {
  const student = await requireStudent(user);
  const records = await prisma.attendanceRecord.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    include: { section: { include: { course: true } } },
    orderBy: { recordedAt: "desc" },
  });
  return StudentAttendanceResponse.parse({
    presentCount: records.filter((r) => r.status === "present").length,
    absentCount: records.filter((r) => r.status === "absent").length,
    lateCount: records.filter((r) => r.status === "late").length,
    records: records.map((r) => ({
      id: r.id,
      sectionId: r.sectionId,
      courseCode: r.section.course.code,
      meetingLabel: r.meetingLabel,
      status: r.status as "present" | "absent" | "late" | "excused",
      recordedAt: r.recordedAt.toISOString(),
      note: r.note,
    })),
  });
}

export async function listStudentSessions(user: SessionClaims, kind: "lecture" | "lab") {
  if (kind === "lab") {
    const { syncExistingLabSessions } = await import("../labs/lab-flow.service.js");
    await syncExistingLabSessions(user.institutionId);
  }
  const student = await requireStudent(user);
  const sectionIds = await enrolledSectionIds(user.institutionId, student.id);
  const sessions = await prisma.classSession.findMany({
    where: {
      institutionId: user.institutionId,
      sectionId: { in: sectionIds },
      sessionKind: kind,
    },
    include: { section: { include: { course: true } } },
    orderBy: { startsAt: "asc" },
  });
  return StudentLecturesResponse.parse({
    lectures: sessions.map((s) => ({
      id: s.id,
      sectionId: s.sectionId,
      courseCode: s.section.course.code,
      title: s.title,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt?.toISOString() ?? null,
      location: s.location,
      joinUrl: sessionJoinUrl(s.sectionId, s.joinUrl),
      sessionKind: kind,
      deliveryMode: s.deliveryMode,
    })),
  });
}

export async function getStudentLecture(user: SessionClaims, sessionId: string) {
  const list = await listStudentSessions(user, "lecture");
  const hit = list.lectures.find((l) => l.id === sessionId);
  if (!hit) {
    const labs = await listStudentSessions(user, "lab");
    const lab = labs.lectures.find((l) => l.id === sessionId);
    if (!lab) throw httpError("Lecture not found", "NOT_FOUND", 404);
    return lab;
  }
  return hit;
}

export async function getOrCreateLabNotebook(user: SessionClaims, classSessionId: string) {
  const student = await requireStudent(user);
  const session = await prisma.classSession.findFirst({
    where: {
      id: classSessionId,
      institutionId: user.institutionId,
      sessionKind: "lab",
    },
  });
  if (!session) throw httpError("Lab session not found", "NOT_FOUND", 404);
  const enrolled = await prisma.enrolment.findFirst({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
      sectionId: session.sectionId,
      status: "enrolled",
    },
  });
  if (!enrolled) throw httpError("Not enrolled", "FORBIDDEN", 403);
  let entry = await prisma.labNotebookEntry.findUnique({
    where: { studentId_classSessionId: { studentId: student.id, classSessionId } },
  });
  if (!entry) {
    entry = await prisma.labNotebookEntry.create({
      data: {
        institutionId: user.institutionId,
        studentId: student.id,
        classSessionId,
        title: `${session.title} notebook`,
        body: "",
      },
    });
  }
  return StudentLabNotebook.parse({
    id: entry.id,
    classSessionId: entry.classSessionId,
    title: entry.title,
    body: entry.body,
    version: entry.version,
    rowVersion: entry.rowVersion,
    lockedAt: entry.lockedAt?.toISOString() ?? null,
    updatedAt: entry.updatedAt.toISOString(),
  });
}

export async function upsertLabNotebook(
  user: SessionClaims,
  classSessionId: string,
  body: unknown,
  correlationId: string,
) {
  const student = await requireStudent(user);
  const input = UpsertLabNotebookRequest.parse(body);
  const existing = await getOrCreateLabNotebook(user, classSessionId);
  const row = await prisma.labNotebookEntry.findUniqueOrThrow({ where: { id: existing.id } });
  if (row.lockedAt) throw httpError("Notebook is locked", "CONFLICT", 409);
  if (input.rowVersion != null && input.rowVersion !== row.rowVersion) {
    throw httpError("Stale notebook version", "CONFLICT", 409);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.labNotebookEntry.update({
      where: { id: row.id },
      data: {
        title: input.title,
        body: input.body,
        version: { increment: 1 },
        rowVersion: { increment: 1 },
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "LabNotebook.updated",
      purpose: "lab_notebook",
      before: row,
      after: next,
      source: "student.labs.notebook",
      correlationId,
    });
    return next;
  });
  return StudentLabNotebook.parse({
    id: updated.id,
    classSessionId: updated.classSessionId,
    title: updated.title,
    body: updated.body,
    version: updated.version,
    rowVersion: updated.rowVersion,
    lockedAt: updated.lockedAt?.toISOString() ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function listStudentServiceRequests(user: SessionClaims) {
  const student = await requireStudent(user);
  const [rows, activeEnrolments] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { institutionId: user.institutionId, studentId: student.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, studentId: student.id, status: "enrolled" },
      include: { section: { include: { course: true, term: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return StudentServiceRequestsResponse.parse({
    requests: rows.map((r) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      details: r.details,
      status: r.status,
      approvalRequestId: r.approvalRequestId,
      createdAt: r.createdAt.toISOString(),
    })),
    withdrawalOptions: activeEnrolments.map((e) => ({
      sectionId: e.sectionId,
      label: `${e.section.course.code} ${e.section.code} — ${e.section.course.title} (${e.section.term.name})`,
    })),
  });
}

export async function createStudentServiceRequest(
  user: SessionClaims,
  body: unknown,
  correlationId: string,
) {
  const student = await requireStudent(user);
  const input = CreateStudentServiceRequest.parse(body);
  await assertNoActiveStudentHold(user.institutionId, student.id, "Submitting a student request");
  let withdrawalEnrolment: { id: string; sectionId: string; rowVersion: number } | null = null;
  let immediateWithdrawal = false;
  if (input.type === "course_withdrawal") {
    if (!input.sectionId) throw httpError("Choose the enrolled course section to withdraw from", "VALIDATION_ERROR", 400);
    const enrolment = await prisma.enrolment.findFirst({
      where: { institutionId: user.institutionId, studentId: student.id, sectionId: input.sectionId, status: "enrolled" },
      select: { id: true, sectionId: true, rowVersion: true },
    });
    if (!enrolment) throw httpError("The selected course section is not an active enrolment", "VALIDATION_ERROR", 400);
    withdrawalEnrolment = enrolment;
    const policy = await withdrawalPolicy(user.institutionId, student.id);
    if (policy === "Instant approval for all penalties") immediateWithdrawal = true;
    if (policy === "Instant approval for non-penalty tuition adjustments") {
      const chargeCount = await prisma.financeLedgerEntry.count({
        where: {
          institutionId: user.institutionId,
          studentId: student.id,
          sectionId: enrolment.sectionId,
          kind: "charge",
          amountCad: { gt: 0 },
          status: { notIn: ["waived", "reversed", "cancelled"] },
        },
      });
      immediateWithdrawal = chargeCount === 0;
    }
  }
  const needsApproval =
    input.type === "official_transcript" ||
    input.type === "enrollment_verification" ||
    (input.type === "course_withdrawal" && !immediateWithdrawal) ||
    input.type === "course_change" ||
    input.type === "transcript_request" ||
    input.type === "academic_appeal" ||
    input.type === "leave_of_absence";

  const created = await prisma.$transaction(async (tx) => {
    let approvalRequestId: string | null = null;
    let status: "open" | "pending_approval" | "resolved" = immediateWithdrawal ? "resolved" : "open";
    if (needsApproval) {
      const approval = await requireApproval({
        institutionId: user.institutionId,
        type: `service_request.${input.type}`,
        subjectRef: `student:${student.id}`,
        proposedDiff: { type: input.type, subject: input.subject, details: input.details, ...(input.sectionId ? { sectionId: input.sectionId } : {}) },
        requestedBy: user.accountId,
        requiredApproverRoles: ["admin", "registrar"],
        requiredCount: 1,
        correlationId,
        tx,
      });
      approvalRequestId = approval.id;
      status = "pending_approval";
    }
    const row = await tx.serviceRequest.create({
      data: {
        institutionId: user.institutionId,
        studentId: student.id,
        type: input.type,
        subject: input.subject,
        details: input.details,
        status,
        approvalRequestId,
      },
    });
    if (immediateWithdrawal && withdrawalEnrolment) {
      const claimed = await tx.enrolment.updateMany({
        where: { id: withdrawalEnrolment.id, status: "enrolled", rowVersion: withdrawalEnrolment.rowVersion },
        data: { status: "withdrawn", rowVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) throw httpError("The enrolment changed while withdrawing; reload and try again", "CONFLICT", 409);
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "ServiceRequest.created",
      purpose: "student_services",
      before: null,
      after: row,
      source: "student.services.create",
      correlationId,
    });
    return row;
  });
  if (immediateWithdrawal && withdrawalEnrolment) await promoteWaitlisted(user, withdrawalEnrolment.sectionId);

  return StudentServiceRequestsResponse.parse({
    requests: [
      {
        id: created.id,
        type: created.type as typeof input.type,
        subject: created.subject,
        details: created.details,
        status: created.status as "open" | "pending_approval" | "resolved" | "rejected" | "cancelled",
        approvalRequestId: created.approvalRequestId,
        createdAt: created.createdAt.toISOString(),
      },
    ],
    withdrawalOptions: [],
  });
}

export async function cancelStudentServiceRequest(user: SessionClaims, requestId: string, correlationId: string) {
  const student = await requireStudent(user);
  const request = await prisma.serviceRequest.findFirst({ where: { id: requestId, institutionId: user.institutionId, studentId: student.id } });
  if (!request) throw httpError("Service request not found", "NOT_FOUND", 404);
  if (!new Set(["open", "pending_approval"]).has(request.status)) throw httpError("Only an open request can be cancelled", "CONFLICT", 409);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.serviceRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw httpError("The request changed while it was being cancelled", "CONFLICT", 409);
    if (request.approvalRequestId) await tx.approvalRequest.updateMany({ where: { id: request.approvalRequestId, institutionId: user.institutionId, status: "pending" }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    await writeAuditAndOutbox(tx, { institutionId: user.institutionId, actorId: user.accountId, eventName: "ServiceRequest.cancelled", purpose: "student_services", before: { id: request.id, status: request.status }, after: { id: request.id, status: "cancelled" }, source: "student.services.cancel", correlationId: correlationId || randomUUID() });
  });
  return listStudentServiceRequests(user);
}

export async function listStudentPracticum(user: SessionClaims) {
  const student = await requireStudent(user);
  const placements = await prisma.placement.findMany({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
    },
    include: { hours: { orderBy: { createdAt: "desc" } }, evaluations: { orderBy: { createdAt: "desc" } }, employerOrg: true },
    orderBy: { createdAt: "desc" },
  });
  const siteIds = [...new Set(placements.map((p) => p.siteId).filter((id): id is string => Boolean(id)))];
  const supervisorIds = [...new Set(placements.map((p) => p.supervisorPersonId).filter((id): id is string => Boolean(id)))];
  const [siteRows, supervisors, incidentRows] = await Promise.all([
    siteIds.length ? prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, id: { in: siteIds }, screenId: "OPS:PR_SITE", deletedAt: null } }) : [],
    supervisorIds.length ? prisma.person.findMany({ where: { institutionId: user.institutionId, id: { in: supervisorIds } }, select: { id: true, givenName: true, familyName: true, email: true } }) : [],
    placements.length ? prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, screenId: "OPS:PR_INCIDENT", deletedAt: null } }) : [],
  ]);
  const sites = new Map(siteRows.map((row) => [row.id, dataOf(row.dataJson)]));
  const people = new Map(supervisors.map((person) => [person.id, person]));
  const incidents: Array<Record<string, unknown> & { id: string }> = incidentRows.map((row) => ({ id: row.id, ...dataOf(row.dataJson) }));
  return StudentPracticumResponse.parse({
    placements: placements.map((p) => ({
      id: p.id,
      programName: p.programName,
      employerName: p.employerOrg.name,
      siteName: String(sites.get(p.siteId ?? "")?.name || p.employerOrg.siteName),
      siteAddress: [sites.get(p.siteId ?? "")?.address, sites.get(p.siteId ?? "")?.city].filter(Boolean).join(", ") || null,
      supervisorName: p.supervisorPersonId ? `${people.get(p.supervisorPersonId)?.givenName ?? ""} ${people.get(p.supervisorPersonId)?.familyName ?? ""}`.trim() || null : null,
      supervisorEmail: p.supervisorPersonId ? people.get(p.supervisorPersonId)?.email ?? null : null,
      status: p.status,
      startsOn: p.startsOn,
      endsOn: p.endsOn,
      hours: p.hours.map((h) => ({
        id: h.id,
        weekLabel: h.weekLabel,
        hours: h.hours,
        status: h.status as "pending" | "approved" | "rejected",
      })),
      evaluations: p.evaluations.map((evaluation) => ({ id: evaluation.id, status: evaluation.status, score: evaluation.score, notes: evaluation.notes })),
      incidents: incidents.filter((incident) => String(incident.placementId) === p.id).map((incident) => ({
        id: incident.id,
        occurredOn: String(incident.occurredOn || ""),
        category: String(incident.category || "Other"),
        severity: String(incident.severity || "Low"),
        status: String(incident.status || "Open"),
        actionTaken: String(incident.actionTaken || "") || null,
      })),
    })),
  });
}

export async function logPracticumHours(user: SessionClaims, body: unknown, correlationId: string) {
  const student = await requireStudent(user);
  const input = LogPracticumHoursRequest.parse(body);
  const owned = await prisma.placement.findFirst({
    where: {
      id: input.placementId,
      institutionId: user.institutionId,
      studentId: student.id,
    },
  });
  if (!owned) throw httpError("Placement not found", "NOT_FOUND", 404);
  if (owned.status !== "active") throw httpError("Hours can only be logged for an active practicum placement", "CONFLICT", 409);
  const entry = await prisma.$transaction(async (tx) => {
    const row = await tx.hoursEntry.create({
      data: {
        institutionId: user.institutionId,
        placementId: owned.id,
        weekLabel: input.weekLabel,
        hours: input.hours,
        status: "pending",
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "PracticumHours.logged",
      purpose: "practicum_log",
      before: null,
      after: row,
      source: "student.practicum.hours",
      correlationId,
    });
    return row;
  });
  if (owned.supervisorPersonId) {
    const supervisor = await prisma.account.findFirst({ where: { institutionId: user.institutionId, personId: owned.supervisorPersonId, status: "active" }, select: { id: true } });
    if (supervisor) await prisma.notification.create({ data: { institutionId: user.institutionId, recipientAccountId: supervisor.id, channel: "in_app", title: "Practicum hours need review", body: `${owned.studentName} · ${entry.weekLabel} · ${entry.hours} hours`, templateKey: "practicum.hours.pending", dedupeKey: `practicum-hours:${entry.id}:pending:${supervisor.id}` } });
  }
  return {
    id: entry.id,
    weekLabel: entry.weekLabel,
    hours: entry.hours,
    status: "pending" as const,
  };
}

export async function listStudentFinance(user: SessionClaims, financialTermId?: string | null) {
  const student = await requireStudent(user);
  const storedEntries = await prisma.financeLedgerEntry.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    include: { financialTerm: true },
    orderBy: { postedAt: "desc" },
  });
  const allEntries = storedEntries.map((entry) => ({ ...entry, amountCad: Number(entry.amountCad) }));
  // Only terms the student was actually charged / paid in, so an institution-wide term never appears as a filter.
  const terms = [...new Map(allEntries.flatMap((e) => (e.financialTerm ? [[e.financialTerm.id, e.financialTerm] as const] : []))).values()].sort(
    (a, b) => b.startsOn.localeCompare(a.startsOn),
  );
  // Without an explicit term the statement covers the whole account, so entries posted without a
  // financial term are included and the balance matches the admin ledger.
  const selectedId = financialTermId && terms.some((t) => t.id === financialTermId) ? financialTermId : null;
  const entries = selectedId ? allEntries.filter((e) => e.financialTermId === selectedId) : allEntries;
  const isCounted = (e: (typeof allEntries)[number]) => e.status !== "waived" && e.status !== "void";
  const raisesBalance = (e: (typeof allEntries)[number]) => e.kind === "charge" || e.kind === "refund";
  const lowersBalance = (e: (typeof allEntries)[number]) => e.kind === "payment" || e.kind === "credit";
  const signed = (e: (typeof allEntries)[number]) => (raisesBalance(e) ? e.amountCad : lowersBalance(e) ? -e.amountCad : 0);
  const accountBalanceCad = Math.round(allEntries.filter(isCounted).reduce((sum, e) => sum + signed(e), 0) * 100) / 100;
  const openCharges = allEntries.filter((e) => e.kind === "charge" && e.status === "open");
  const pastDue = openCharges.filter((e) => e.dueAt && e.dueAt < new Date()).reduce((sum, e) => sum + e.amountCad, 0);
  const nextDue = openCharges
    .filter((e) => e.dueAt)
    .map((e) => e.dueAt!)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const counted = entries.filter(isCounted);
  const selectedTerm = terms.find((t) => t.id === selectedId) ?? null;
  const charges = counted.filter(raisesBalance);
  const chargeIds = charges.filter((entry) => entry.kind === "charge").map((entry) => entry.id);
  const metaRows = chargeIds.length
    ? await prisma.heritageRecord.findMany({
        where: { institutionId: user.institutionId, screenId: "FIN:META", singletonKey: { in: chargeIds }, deletedAt: null },
        select: { singletonKey: true, dataJson: true },
      })
    : [];
  const feeMeta = new Map(metaRows.flatMap((row) => row.singletonKey ? [[row.singletonKey, dataOf(row.dataJson)] as const] : []));
  const taxSummary = (name: "GST" | "PST") => {
    let amount = 0;
    let taxable = 0;
    for (const charge of charges) {
      if (charge.kind !== "charge") continue;
      const meta = feeMeta.get(charge.id);
      const lines = Array.isArray(meta?.taxes) ? meta.taxes as Array<Record<string, unknown>> : [];
      const matching = lines.filter((line) => String(line.name || "").trim().toUpperCase().startsWith(name));
      if (!matching.length) continue;
      amount += matching.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      taxable += Number(meta?.subtotal ?? charge.amountCad);
    }
    const rounded = Math.round(amount * 100) / 100;
    return { amount: rounded, rate: taxable > 0 ? Math.round((rounded / taxable) * 10_000) / 100 : 0 };
  };
  const gst = taxSummary("GST");
  const pst = taxSummary("PST");
  const grossChargesCad = charges.reduce((sum, e) => sum + Number(e.amountCad), 0);
  const totalChargesCad = Math.round((grossChargesCad - gst.amount - pst.amount) * 100) / 100;
  const totalPaymentsCad = counted.filter(lowersBalance).reduce((sum, e) => sum + Number(e.amountCad), 0);
  const gstRatePercent = gst.rate;
  const pstRatePercent = pst.rate;
  const gstCad = gst.amount;
  const pstCad = pst.amount;
  const balanceCad = Math.round((grossChargesCad - totalPaymentsCad) * 100) / 100;

  const mapEntry = (e: (typeof entries)[number]) => ({
    id: e.id,
    label: e.kind === "refund" ? `Refund: ${e.label}` : e.label,
    amountCad: e.amountCad,
    // The portal contract predates refunds; a refund raises the balance like a charge.
    kind: (e.kind === "refund" ? "charge" : e.kind) as "charge" | "credit" | "payment",
    status: (e.status === "void" ? "waived" : e.status) as "open" | "paid" | "waived",
    source: e.source ?? null,
    dueAt: e.dueAt?.toISOString() ?? null,
    postedAt: e.postedAt.toISOString(),
    financialTermId: e.financialTermId,
    financialTermCode: e.financialTerm?.code ?? null,
    financialTermName: e.financialTerm?.name ?? null,
  });

  const history = buildFinanceHistory(allEntries);

  return StudentFinanceResponse.parse({
    summary: {
      balance: { amountCents: Math.round(accountBalanceCad * 100), currency: "CAD" },
      pastDue: { amountCents: Math.round(pastDue * 100), currency: "CAD" },
      nextDueAt: nextDue?.toISOString() ?? null,
      paymentExecutionEnabled: studentPaymentsEnabled(),
    },
    entries: entries.map(mapEntry),
    financialTerms: terms.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      startsOn: t.startsOn,
      endsOn: t.endsOn,
    })),
    selectedFinancialTermId: selectedId,
    statement: {
      termCode: selectedTerm?.code ?? "All terms",
      termName: selectedTerm?.name ?? "All terms",
      charges: charges.map((c) => ({
        id: c.id,
        label: c.kind === "refund" ? `Refund: ${c.label}` : c.label,
        amountCad: c.kind === "charge" ? Number(feeMeta.get(c.id)?.subtotal ?? c.amountCad) : Number(c.amountCad),
      })),
      totalChargesCad,
      gstRatePercent,
      gstCad,
      pstRatePercent,
      pstCad,
      totalPaymentsCad,
      balanceCad,
    },
    history,
  });
}

function buildFinanceHistory(
  entries: Array<{
    id: string;
    label: string;
    amountCad: number;
    kind: string;
    source: string | null;
    postedAt: Date;
  }>,
) {
  type Event = {
    id: string;
    date: string;
    kind: "payment" | "accounts_receivable" | "credit";
    title: string;
    amountCad: number;
    source: string | null;
    receiptAvailable: boolean;
    lines: Array<{ id: string; label: string; amountCad: number }>;
    sortKey: number;
  };

  const events: Event[] = [];
  const chargesByDay = new Map<string, typeof entries>();

  for (const e of entries) {
    if (e.kind === "charge") {
      const day = e.postedAt.toISOString().slice(0, 10);
      const bucket = chargesByDay.get(day) ?? [];
      bucket.push(e);
      chargesByDay.set(day, bucket);
      continue;
    }
    if (e.kind === "payment" || e.kind === "credit") {
      events.push({
        id: e.id,
        date: e.postedAt.toISOString(),
        kind: e.kind === "payment" ? "payment" : "credit",
        title: e.kind === "payment" ? `Payment Applied: $${e.amountCad.toFixed(2)}` : e.label,
        amountCad: e.amountCad,
        source: e.source,
        receiptAvailable: e.kind === "payment",
        lines: [],
        sortKey: e.postedAt.getTime(),
      });
    }
  }

  for (const [, dayCharges] of chargesByDay) {
    const total = dayCharges.reduce((sum, c) => sum + c.amountCad, 0);
    const first = dayCharges[0]!;
    events.push({
      id: `ar-${first.id}`,
      date: first.postedAt.toISOString(),
      kind: "accounts_receivable",
      title: `Accounts Receivable Added: $${total.toFixed(2)}`,
      amountCad: total,
      source: null,
      receiptAvailable: false,
      lines: dayCharges.map((c) => ({ id: c.id, label: c.label, amountCad: c.amountCad })),
      sortKey: first.postedAt.getTime(),
    });
  }

  events.sort((a, b) => b.sortKey - a.sortKey);

  const months = new Map<string, { key: string; label: string; events: typeof events }>();
  for (const event of events) {
    const d = new Date(event.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d
      .toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      .toUpperCase();
    const bucket = months.get(key) ?? { key, label, events: [] };
    bucket.events.push(event);
    months.set(key, bucket);
  }

  return [...months.values()].map((m) => ({
    key: m.key,
    label: m.label,
    events: m.events.map(({ sortKey: _s, ...rest }) => rest),
  }));
}

export async function listStudentCredentials(user: SessionClaims) {
  const student = await requireStudent(user);
  const rows = await prisma.credentialRecord.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  return StudentCredentialsResponse.parse({
    credentials: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as "earned" | "pending" | "revoked",
      detail: r.detail,
      earnedAt: r.earnedAt?.toISOString() ?? null,
    })),
    issuanceEnabled: false,
  });
}

export async function listStudentResources(user: SessionClaims) {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { institutionId: user.institutionId, status: "published" },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return StudentResourcesResponse.parse({
    resources: docs.map((d) => ({
      id: d.id,
      title: d.title,
      snippet: d.body.slice(0, 240),
      sourceKind: d.docType,
      href: d.uri.startsWith("/") ? d.uri : "/student/library",
    })),
  });
}

export async function toPortalRowsFromAssessments(user: SessionClaims) {
  const data = await listStudentAssessments(user);
  return data.assessments.map((a) => ({
    primary: a.title,
    secondary: `${a.courseCode} · ${a.state}`,
    meta: a.closesAt.slice(0, 10),
    href: "/student/assessments",
  }));
}

export async function toPortalRowsFromAttendance(user: SessionClaims) {
  const data = await listStudentAttendance(user);
  return data.records.map((r) => ({
    primary: r.meetingLabel,
    secondary: `${r.courseCode} · ${r.status}`,
    meta: r.recordedAt.slice(0, 10),
    href: "/student/attendance",
  }));
}

export async function toPortalRowsFromLectures(user: SessionClaims, kind: "lecture" | "lab") {
  const [data, account] = await Promise.all([
    listStudentSessions(user, kind),
    prisma.account.findFirst({ where: { id: user.accountId, institutionId: user.institutionId }, select: { timezone: true } }),
  ]);
  const timezone = account?.timezone || "America/Vancouver";
  return data.lectures.map((l) => ({
    primary: l.title,
    secondary: `${l.courseCode} · ${l.location ?? l.deliveryMode}`,
    meta: new Date(l.startsAt).toLocaleString("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    href: kind === "lab" ? "/student/labs" : `/student/f/st-11-lecture-detail?sessionId=${l.id}`,
  }));
}

export async function toPortalRowsFromFinance(user: SessionClaims) {
  const data = await listStudentFinance(user);
  return data.entries.map((e) => ({
    primary: e.label,
    secondary: `${e.kind} · ${e.status}`,
    meta: `CAD ${e.amountCad.toFixed(2)}`,
    href: "/student/fees",
  }));
}

export async function toPortalRowsFromCredentials(user: SessionClaims) {
  const data = await listStudentCredentials(user);
  return data.credentials.map((c) => ({
    primary: c.title,
    secondary: c.detail ?? c.status,
    meta: c.status,
    href: "/student/f/st-19-credentials",
  }));
}

export async function toPortalRowsFromResources(user: SessionClaims) {
  const data = await listStudentResources(user);
  return data.resources.map((r) => ({
    primary: r.title,
    secondary: r.snippet,
    meta: r.sourceKind,
    href: r.href ?? "/student/library",
  }));
}

export async function toPortalRowsFromServices(user: SessionClaims) {
  const data = await listStudentServiceRequests(user);
  return data.requests.map((r) => ({
    primary: r.subject,
    secondary: `${r.type} · ${r.status}`,
    meta: r.createdAt.slice(0, 10),
    href: "/student/f/st-16-services",
  }));
}

export async function toPortalRowsFromPracticum(user: SessionClaims) {
  const data = await listStudentPracticum(user);
  return data.placements.flatMap((p) => [
    {
      primary: p.programName,
      secondary: `${p.siteName} · ${p.status}`,
      meta: p.startsOn ?? undefined,
      href: "/student/f/st-17-practicum",
    },
    ...p.hours.map((h) => ({
      primary: h.weekLabel,
      secondary: `${h.hours}h · ${h.status}`,
      meta: p.programName,
      href: "/student/f/st-17-practicum",
    })),
  ]);
}

function mapWorkshop(
  w: {
    id: string;
    code: string;
    title: string;
    description: string;
    creditsCeu: number;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    capacity: number;
    status: string;
    registrations: Array<{ studentId: string; status: string }>;
  },
  studentId: string,
) {
  const mine = w.registrations.find((r) => r.studentId === studentId);
  const joinUrl = w.location && isSafeLink(w.location) && /^https?:\/\//i.test(w.location) ? w.location : null;
  const seatStatuses = new Set(["registered", "approved", "pending", "completed"]);
  const studentStatus =
    !mine
      ? "none"
      : mine.status === "declined" || mine.status === "dropped" || mine.status === "cancelled"
        ? "cancelled"
        : mine.status === "completed" || w.status === "completed"
          ? "completed"
          : "registered";
  return {
    id: w.id,
    code: w.code,
    title: w.title,
    description: w.description,
    creditsCeu: w.creditsCeu,
    startsAt: w.startsAt.toISOString(),
    endsAt: w.endsAt?.toISOString() ?? null,
    location: w.location,
    capacity: w.capacity,
    registeredCount: w.registrations.filter((r) => seatStatuses.has(r.status)).length,
    status: w.status as "upcoming" | "active" | "completed" | "cancelled",
    registrationStatus: studentStatus,
    joinUrl,
  };
}

async function workshopAccess(institutionId: string, student: { id: string; programName: string; cohortId: string | null }) {
  const [meta, cohort] = await Promise.all([
    studentMetaMap(institutionId),
    student.cohortId ? prisma.cohort.findFirst({ where: { id: student.cohortId }, select: { campus: true } }) : null,
  ]);
  const m = meta[student.id] ?? {};
  const access: StudentAccess = { status: m.status ?? "", programName: student.programName, campus: m.campus || cohort?.campus || "" };
  return { access, residency: m.residency };
}

export async function listStudentWorkshops(user: SessionClaims) {
  const student = await requireStudent(user);
  const [workshops, tz, { access }] = await Promise.all([
    prisma.workshop.findMany({
      where: { institutionId: user.institutionId },
      include: { registrations: true },
      orderBy: { startsAt: "asc" },
    }),
    institutionTimezone(user.institutionId),
    workshopAccess(user.institutionId, student),
  ]);
  const now = new Date();
  const today = ymdIn(now, tz);
  const open = new Set<string>();
  const mapped = workshops.map((w) => {
    const settings = workshopSettings(w, tz);
    if (!studentMayRegister(w, settings, access, now, tz)) open.add(w.id);
    return mapWorkshop({ ...w, status: storedStatus(workshopPhase(w, settings, today)) }, student.id);
  });
  return StudentWorkshopsResponse.parse({
    available: mapped.filter((w) => w.registrationStatus === "none" && open.has(w.id)),
    mine: mapped.filter((w) => w.registrationStatus === "registered"),
    // A completed workshop belongs in the student's history only when that
    // student actually completed it. The workshop's global lifecycle status
    // must not leak unrelated workshops into every student's Completed tab.
    completed: mapped.filter((w) => w.registrationStatus === "completed"),
  });
}

export async function registerStudentWorkshop(user: SessionClaims, body: unknown, correlationId: string) {
  const student = await requireStudent(user);
  const input = RegisterWorkshopRequest.parse(body);
  const workshop = await prisma.workshop.findFirst({
    where: { id: input.workshopId, institutionId: user.institutionId },
  });
  if (!workshop) throw httpError("Workshop not found", "NOT_FOUND", 404);
  const tz = await institutionTimezone(user.institutionId);
  const settings = workshopSettings(workshop, tz);
  const { access, residency } = await workshopAccess(user.institutionId, student);
  const statusPolicy = await studentStatusPolicy(user.institutionId, access.status);
  if (statusPolicy && !statusPolicy.enablesRegistration) throw httpError(`Student status "${statusPolicy.name}" does not allow registration`, "STUDENT_STATUS_BLOCKS_REGISTRATION", 409);
  const blocked = studentMayRegister(workshop, settings, access, new Date(), tz);
  if (blocked) throw httpError(blocked, "VALIDATION_ERROR", 400);
  const status = settings.approval === "Automatic Approval" ? "approved" : "pending";
  const postFee = settings.feeCollection === "Immediately" || (settings.feeCollection === "Upon Approval" && status === "approved");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workshop-seats:${workshop.id}`}))`;
    const existing = await tx.workshopRegistration.findFirst({
      where: { institutionId: user.institutionId, workshopId: workshop.id, studentId: student.id },
      select: { id: true },
    });
    if (existing) return;
    const active = await tx.workshopRegistration.count({
      where: { workshopId: workshop.id, status: { in: [...SEAT_STATUSES] } },
    });
    if (active >= workshop.capacity) throw httpError("Workshop is full", "CONFLICT", 409);
    const reg = await tx.workshopRegistration.create({
      data: {
        institutionId: user.institutionId,
        workshopId: workshop.id,
        studentId: student.id,
        status,
      },
    });
    if (postFee) {
      await postWorkshopFee(tx, {
        institutionId: user.institutionId,
        registrationId: reg.id,
        studentId: student.id,
        workshop,
        amount: feeFor(settings, residency),
      });
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "Workshop.registered",
      purpose: "student_services",
      before: null,
      after: { workshopId: workshop.id, studentId: student.id },
      source: "student.workshops.register",
      correlationId,
    });
  });
  return listStudentWorkshops(user);
}

export async function cancelStudentWorkshop(user: SessionClaims, workshopId: string, correlationId: string) {
  const student = await requireStudent(user);
  const registration = await prisma.workshopRegistration.findFirst({
    where: { institutionId: user.institutionId, workshopId, studentId: student.id, status: { in: ["pending", "approved", "registered"] } },
    include: { workshop: true },
  });
  if (!registration) throw httpError("Active workshop registration not found", "NOT_FOUND", 404);
  if (registration.workshop.startsAt.getTime() <= Date.now()) throw httpError("A workshop cannot be cancelled after it starts", "CONFLICT", 409);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.workshopRegistration.updateMany({ where: { id: registration.id, status: registration.status }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw httpError("The registration changed while it was being cancelled", "CONFLICT", 409);
    await waiveWorkshopFee(tx, user.institutionId, registration.id, "Waived after student cancelled workshop registration");
    await writeAuditAndOutbox(tx, { institutionId: user.institutionId, actorId: user.accountId, eventName: "WorkshopRegistration.cancelled", purpose: "student_services", before: { id: registration.id, status: registration.status }, after: { id: registration.id, status: "cancelled" }, source: "student.workshops.cancel", correlationId: correlationId || randomUUID() });
  });
  return listStudentWorkshops(user);
}

export async function joinStudentWorkshop(user: SessionClaims, workshopId: string, correlationId: string) {
  const student = await requireStudent(user);
  const registration = await prisma.workshopRegistration.findFirst({
    where: { institutionId: user.institutionId, workshopId, studentId: student.id, status: { in: ["approved", "registered"] } },
    include: { workshop: true },
  });
  if (!registration) throw httpError("An approved workshop registration is required", "FORBIDDEN", 403);
  const opensAt = registration.workshop.startsAt.getTime() - 15 * 60_000;
  const closesAt = (registration.workshop.endsAt ?? new Date(registration.workshop.startsAt.getTime() + 2 * 60 * 60_000)).getTime();
  const now = Date.now();
  if (now < opensAt) throw httpError("Workshop access opens 15 minutes before the start time", "WORKSHOP_NOT_OPEN", 409);
  if (now > closesAt) throw httpError("This workshop session has ended", "WORKSHOP_ENDED", 409);
  const location = registration.workshop.location?.trim() || "";
  const joinUrl = isSafeLink(location) && /^https?:\/\//i.test(location) ? location : null;
  await prisma.$transaction(async (tx) => {
    if (!joinUrl) {
      const attendedOn = new Date().toISOString().slice(0, 10);
      await tx.workshopAttendance.upsert({
        where: { workshopId_studentId_attendedOn: { workshopId, studentId: student.id, attendedOn } },
        create: { institutionId: user.institutionId, workshopId, studentId: student.id, attendedOn, status: "present", note: "Student mobile check-in" },
        update: { status: "present", note: "Student mobile check-in", rowVersion: { increment: 1 } },
      });
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: joinUrl ? "Workshop.joined" : "Workshop.checkedIn",
      purpose: "student_services",
      before: null,
      after: { workshopId, studentId: student.id },
      source: "student.workshops.join",
      correlationId: correlationId || randomUUID(),
    });
  });
  return { ok: true as const, mode: joinUrl ? "online" as const : "check_in" as const, joinUrl };
}

export async function listLeaveOfAbsence(user: SessionClaims) {
  const student = await requireStudent(user);
  const rows = await prisma.leaveOfAbsenceRequest.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  return LeaveOfAbsenceListResponse.parse({
    requests: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      status: r.status as "pending" | "approved" | "rejected" | "cancelled",
      approvalRequestId: r.approvalRequestId,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function createLeaveOfAbsence(user: SessionClaims, body: unknown, correlationId: string) {
  const student = await requireStudent(user);
  const input = CreateLeaveOfAbsenceRequest.parse(body);
  if (input.endsOn < input.startsOn) {
    throw httpError("End date must be on or after start date", "VALIDATION_ERROR", 400);
  }
  await prisma.$transaction(async (tx) => {
    const approval = await requireApproval({
      institutionId: user.institutionId,
      type: "leave_of_absence",
      subjectRef: `student:${student.id}`,
      proposedDiff: input,
      requestedBy: user.accountId,
      requiredApproverRoles: ["registrar", "admin"],
      requiredCount: 1,
      correlationId,
      tx,
    });
    await tx.leaveOfAbsenceRequest.create({
      data: {
        institutionId: user.institutionId,
        studentId: student.id,
        reason: input.reason,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        status: "pending",
        approvalRequestId: approval.id,
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "LeaveOfAbsence.requested",
      purpose: "student_services",
      before: null,
      after: input,
      source: "student.leave.create",
      correlationId,
    });
  });
  return listLeaveOfAbsence(user);
}

export async function cancelLeaveOfAbsence(user: SessionClaims, requestId: string, correlationId: string) {
  const student = await requireStudent(user);
  const request = await prisma.leaveOfAbsenceRequest.findFirst({ where: { id: requestId, institutionId: user.institutionId, studentId: student.id } });
  if (!request) throw httpError("Leave request not found", "NOT_FOUND", 404);
  if (request.status !== "pending") throw httpError("Only a pending leave request can be cancelled", "CONFLICT", 409);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.leaveOfAbsenceRequest.updateMany({ where: { id: request.id, status: "pending" }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw httpError("The leave request changed while it was being cancelled", "CONFLICT", 409);
    if (request.approvalRequestId) await tx.approvalRequest.updateMany({ where: { id: request.approvalRequestId, institutionId: user.institutionId, status: "pending" }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    await writeAuditAndOutbox(tx, { institutionId: user.institutionId, actorId: user.accountId, eventName: "LeaveOfAbsence.cancelled", purpose: "student_services", before: { id: request.id, status: request.status }, after: { id: request.id, status: "cancelled" }, source: "student.leave.cancel", correlationId: correlationId || randomUUID() });
  });
  return listLeaveOfAbsence(user);
}

export async function listRequiredTasks(user: SessionClaims) {
  const student = await requireStudent(user);
  const [rows, requirementRows] = await Promise.all([
    prisma.requiredTask.findMany({
      where: { institutionId: user.institutionId, studentId: student.id },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    }),
    prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: "STU:REQ", contextKey: student.id, deletedAt: null },
      select: { id: true, dataJson: true },
    }),
  ]);
  const linked = new Map(requirementRows.map((row) => {
    const data = dataOf(row.dataJson);
    return [String(data.taskId || ""), { id: row.id, data }] as const;
  }).filter(([taskId]) => Boolean(taskId)));
  const map = (r: (typeof rows)[number]) => {
    const requirementRow = linked.get(r.id);
    const data = requirementRow?.data ?? {};
    const href = (r.href || "").toLowerCase();
    const requirement = data.dataType === "Document Required" || href.includes("document") || /upload/i.test(r.title)
      ? "upload" as const
      : href.includes("evaluation")
        ? "evaluation" as const
        : "confirm" as const;
    const history = Array.isArray(data.history) ? data.history as Array<{ files?: Array<{ id?: string; name?: string; size?: number; mime?: string }> }> : [];
    const latestFile = [...history].reverse().flatMap((item) => Array.isArray(item.files) ? item.files : []).find((file) => file?.id && file?.name);
    const submitted = String(data.submission || "") === "Submitted";
    const approved = String(data.status || "") === "Approved";
    return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    dueAt: r.dueAt?.toISOString() ?? null,
    requestedAt: r.createdAt.toISOString(),
    status: r.status as "pending" | "completed" | "waived",
    href: r.href,
    completedAt: r.completedAt?.toISOString() ?? null,
    requirement,
    approval: submitted ? (approved ? "approved" as const : "pending" as const) : null,
    evidence: latestFile ? {
      id: String(latestFile.id),
      name: String(latestFile.name),
      sizeBytes: Number(latestFile.size) || 0,
      mimeType: String(latestFile.mime || "application/octet-stream"),
    } : null,
    };
  };
  return RequiredTasksResponse.parse({
    pending: rows.filter((r) => r.status === "pending").map(map),
    completed: rows.filter((r) => r.status !== "pending").map(map),
  });
}

export async function completeRequiredTask(user: SessionClaims, taskId: string, correlationId: string) {
  const student = await requireStudent(user);
  const task = await prisma.requiredTask.findFirst({
    where: { id: taskId, institutionId: user.institutionId, studentId: student.id },
  });
  if (!task) throw httpError("Task not found", "NOT_FOUND", 404);
  if (task.status !== "pending") throw httpError("Only a pending task can be completed", "CONFLICT", 409);
  const requirementRows = await prisma.heritageRecord.findMany({
    where: { institutionId: user.institutionId, screenId: "STU:REQ", contextKey: student.id, deletedAt: null },
  });
  const linkedRequirement = requirementRows.map((row) => dataOf(row.dataJson)).find((data) => String(data.taskId || "") === task.id);
  if (linkedRequirement?.dataType === "Document Required") {
    throw httpError("Upload the requested evidence. The task completes after staff approval.", "APPROVAL_REQUIRED", 409);
  }
  if ((task.href || "").toLowerCase().includes("evaluation")) {
    throw httpError("Complete the course evaluation to finish this task.", "EVALUATION_REQUIRED", 409);
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.requiredTask.updateMany({
      where: { id: task.id, status: "pending" },
      data: { status: "completed", completedAt: new Date() },
    });
    if (claimed.count !== 1) throw httpError("The task status changed. Reload and try again.", "CONFLICT", 409);
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "RequiredTask.completed",
      purpose: "student_services",
      before: { status: task.status },
      after: { status: "completed", taskId: task.id },
      source: "student.tasks.complete",
      correlationId: correlationId || randomUUID(),
    });
  });
  return listRequiredTasks(user);
}

export async function submitRequiredTaskEvidence(
  user: SessionClaims,
  taskId: string,
  body: { name?: unknown; mime?: unknown; base64?: unknown },
  correlationId: string,
) {
  const student = await requireStudent(user);
  const task = await prisma.requiredTask.findFirst({ where: { id: taskId, institutionId: user.institutionId, studentId: student.id } });
  if (!task) throw httpError("Task not found", "NOT_FOUND", 404);
  if (task.status !== "pending") throw httpError("Only a pending task accepts evidence", "CONFLICT", 409);
  const candidates = await prisma.heritageRecord.findMany({
    where: { institutionId: user.institutionId, screenId: "STU:REQ", contextKey: student.id, deletedAt: null },
  });
  const linked = candidates.map((row) => ({ row, data: dataOf(row.dataJson) })).find(({ data }) => String(data.taskId || "") === task.id);
  if (!linked || linked.data.dataType !== "Document Required") {
    throw httpError("This task is not configured for document evidence. Ask Student Services to correct the requirement.", "VALIDATION_ERROR", 422);
  }
  if (String(linked.data.allowUpload || "Yes") !== "Yes") throw httpError("Uploads are disabled for this requirement", "UPLOAD_DISABLED", 409);
  if (String(linked.data.submission || "") === "Submitted") throw httpError("Evidence has already been submitted and is awaiting review", "CONFLICT", 409);
  const validatedFile = validateFile(body);
  const now = new Date().toISOString();
  const history = Array.isArray(linked.data.history) ? linked.data.history : [];
  let fileId = "";
  await prisma.$transaction(async (tx) => {
    const file = await storeValidFile(user, student.id, validatedFile, tx);
    fileId = file.id;
    const next = {
      ...linked.data,
      submission: "Submitted",
      submittedAt: now,
      history: [...history, { at: now, by: user.accountId, status: String(linked.data.status || "Pending"), action: "Uploaded", files: [file], note: "", noteVisible: false, expiryDate: "" }],
    };
    await tx.heritageRecord.update({ where: { id: linked.row.id }, data: { dataJson: JSON.stringify(next), rowVersion: { increment: 1 } } });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "RequiredTask.evidenceSubmitted",
      purpose: "student_services",
      before: { taskId: task.id, submission: linked.data.submission || "No Response" },
      after: { taskId: task.id, submission: "Submitted", fileId: file.id },
      source: "student.tasks.evidence",
      correlationId: correlationId || randomUUID(),
    });
  });
  if (!fileId) throw httpError("Evidence could not be stored", "INTERNAL_ERROR", 500);
  return listRequiredTasks(user);
}

export function studentTaxPdfPath(id: string) {
  return `/student/tax-documents/${id}/pdf`;
}

export async function listTaxDocuments(user: SessionClaims) {
  const student = await requireStudent(user);
  const rows = await prisma.taxDocument.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    orderBy: { taxYear: "desc" },
  });
  const documents = rows.map((r) => ({
    id: r.id,
    docType: r.docType,
    taxYear: r.taxYear,
    title: r.title,
    status: r.status as "available" | "pending" | "expired",
    issuedAt: r.issuedAt?.toISOString() ?? null,
    downloadUrl: studentTaxPdfPath(r.id),
  }));
  return TaxDocumentsResponse.parse({
    documents,
    formOptions: documents.map((d) => ({
      value: d.id,
      label: `${d.docType} — ${d.taxYear} · ${d.title}`,
    })),
    emptyNotice: documents.length
      ? null
      : "There are currently no tax documents or forms available.",
  });
}

export async function getStudentTaxPdf(user: SessionClaims, documentId: string) {
  const student = await requireStudent(user);
  const row = await prisma.taxDocument.findFirst({
    where: { id: documentId, institutionId: user.institutionId, studentId: student.id },
    include: { student: { include: { person: true } } },
  });
  if (!row) throw httpError("Tax document not found", "NOT_FOUND", 404);
  const { renderTaxCertificatePdf, taxPdfFilename } = await import("../../lib/taxPdf.js");
  const inst = await prisma.institution.findFirst({ where: { id: user.institutionId } });
  const pdf = renderTaxCertificatePdf({
    institutionName: inst?.name ?? "Heritage College",
    legalName: inst?.legalName,
    addressLine1: inst?.addressLine1,
    city: inst?.city,
    region: inst?.region,
    postalCode: inst?.postalCode,
    country: inst?.country,
    docType: row.docType,
    title: row.title,
    taxYear: row.taxYear,
    recipientName: `${row.student.person.givenName} ${row.student.person.familyName}`.trim(),
    recipientIdLabel: "Student number",
    recipientId: row.student.studentNumber,
    programName: row.student.programName,
    eligibleTuitionCad: row.eligibleTuitionCad,
    enrolmentMonths: row.enrolmentMonths,
    craStatus: row.craStatus,
    status: row.status,
    issuedAt: row.issuedAt,
  });
  return { pdf, filename: taxPdfFilename(row.docType, row.taxYear) };
}

export async function listExtracurricular(user: SessionClaims) {
  const student = await requireStudent(user);
  const rows = await prisma.extracurricularRecord.findMany({
    where: { institutionId: user.institutionId, studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  const categories = [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b));
  const terms = [...new Set(rows.map((r) => r.termCode).filter((t): t is string => Boolean(t)))].sort((a, b) =>
    b.localeCompare(a),
  );
  return ExtracurricularResponse.parse({
    records: rows.map((r) => ({
      id: r.id,
      termCode: r.termCode,
      category: r.category,
      title: r.title,
      detail: r.detail,
      status: r.status,
    })),
    categories,
    terms,
  });
}

export async function listStudentBadges(user: SessionClaims) {
  const student = await requireStudent(user);
  const rows = await prisma.studentBadge.findMany({
    where: { institutionId: user.institutionId, studentId: student.id, status: { in: ["available", "earned", "revoked"] } },
    orderBy: { createdAt: "desc" },
  });
  return StudentBadgesResponse.parse({
    badges: rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      status: r.status as "available" | "earned" | "revoked",
      earnedAt: r.earnedAt?.toISOString() ?? null,
    })),
  });
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function listStudentCareer(user: SessionClaims) {
  await requireStudent(user);
  const rows = await prisma.careerOpportunity.findMany({
    where: { institutionId: user.institutionId, status: "open" },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return StudentCareerResponse.parse({
    opportunities: rows.map((o) => ({
      id: o.id,
      title: o.title,
      employerName: o.employerName,
      skills: parseJsonStringArray(o.skillsJson),
      programCodes: parseJsonStringArray(o.programCodesJson),
      status: "open" as const,
      href: studentCareerOpportunityHref(o.href),
      updatedAt: o.updatedAt.toISOString(),
    })),
    services: [
      {
        title: "Career coaching",
        body: "Resume review, interview practice, and job-search planning with Career Services.",
        href: "/student/messages",
        cta: "Message Career Services",
      },
      {
        title: "Work-integrated learning",
        body: "Explore practicum placements, hours, and employer agreements tied to your program.",
        href: "/student/f/st-17-practicum",
        cta: "Open practicum",
      },
      {
        title: "Ask Heritage",
        body: "Get grounded answers about co-op timing, resume tips, and campus career resources.",
        href: "/student/ask",
        cta: "Ask a career question",
      },
    ],
  });
}

export async function buildFinanceStatement(user: SessionClaims, financialTermId?: string | null) {
  const student = await requireStudent(user);
  const finance = await listStudentFinance(user, financialTermId);
  const statement = finance.statement;
  const lines = [
    "MyHeritage · Financial Statement",
    `Student: ${student.studentNumber} · ${student.programName}`,
    statement ? `Term: ${statement.termName}` : "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "NEW FEES & CHARGES",
    ...(statement?.charges.map((c) => `  ${c.label}: $${c.amountCad.toFixed(2)}`) ??
      finance.entries.filter((e) => e.kind === "charge").map((e) => `  ${e.label}: $${e.amountCad.toFixed(2)}`)),
    "",
    `Total New Fees & Charges: ($${(statement?.totalChargesCad ?? 0).toFixed(2)})`,
    `GST ${statement?.gstRatePercent ?? 0}%: ($${(statement?.gstCad ?? 0).toFixed(2)})`,
    `PST ${statement?.pstRatePercent ?? 0}%: ($${(statement?.pstCad ?? 0).toFixed(2)})`,
    `Total Payments: $${(statement?.totalPaymentsCad ?? 0).toFixed(2)}`,
    `Statement Balance: ($${(statement?.balanceCad ?? finance.summary.balance.amountCents / 100).toFixed(2)})`,
  ].filter((line) => line !== undefined);
  return StudentFinanceStatementResponse.parse({
    generatedAt: new Date().toISOString(),
    studentNumber: student.studentNumber,
    programName: student.programName,
    summary: finance.summary,
    entries: finance.entries,
    statementText: lines.join("\n"),
  });
}
