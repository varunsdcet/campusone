import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";
import { POLICY } from "./policy.js";

export async function buildComplianceInbox(input: {
  institutionId: string;
  accountId: string;
  roles: string[];
  personId: string;
}) {
  const isStaff = input.roles.includes("admin") || input.roles.includes("registrar");
  const isInstructor = input.roles.includes("instructor");

  const where = isStaff
    ? { institutionId: input.institutionId, status: "open" as const }
    : isInstructor
      ? {
          institutionId: input.institutionId,
          status: "open" as const,
          OR: [
            { subjectType: "instructor", subjectRef: input.accountId },
            { caseKind: { in: [POLICY.CASE_KINDS.STUDENT_MISS_WARN, POLICY.CASE_KINDS.STUDENT_MISS_PAUSE] } },
          ],
        }
      : {
          institutionId: input.institutionId,
          status: "open" as const,
          subjectType: "student",
          subjectRef: (
            await prisma.student.findFirst({
              where: { institutionId: input.institutionId, personId: input.personId },
              select: { id: true },
            })
          )?.id,
        };

  const cases = await prisma.complianceCase.findMany({
    where: where.subjectRef === undefined && !isStaff && !isInstructor
      ? { id: "none" }
      : (where as object),
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const lockedTeacher =
    isInstructor &&
    cases.some(
      (c) =>
        c.subjectType === "instructor" &&
        c.subjectRef === input.accountId &&
        (c.caseKind === POLICY.CASE_KINDS.TEACHER_ATTENDANCE_SLA ||
          c.caseKind === POLICY.CASE_KINDS.TEACHER_GRADE_SLA),
    );

  return {
    title: "Accountability inbox",
    policy: {
      missWarnDays: POLICY.MISS_WARN_DAYS,
      missPauseDays: POLICY.MISS_PAUSE_DAYS,
    },
    locked: lockedTeacher,
    lockMessage: lockedTeacher
      ? "You have open attendance or grade SLA items. Submit the missing work or add an explanation to clear the lock."
      : null,
    cases: cases.map((c) => ({
      id: c.id,
      caseKind: c.caseKind,
      severity: c.severity,
      status: c.status,
      title: c.title,
      detail: c.detail,
      missCount: c.missCount,
      explanation: c.explanation,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      meta: safeJson(c.metaJson),
    })),
    counts: {
      open: cases.length,
      critical: cases.filter((c) => c.severity === "critical").length,
      warning: cases.filter((c) => c.severity === "warning").length,
    },
  };
}

export async function submitExplanation(input: {
  institutionId: string;
  accountId: string;
  personId: string;
  caseId: string;
  explanation: string;
  roles: string[];
}) {
  const text = input.explanation.trim();
  if (text.length < 10) {
    throw Object.assign(new Error("Explanation must be at least 10 characters"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  const student = await prisma.student.findFirst({
    where: { institutionId: input.institutionId, personId: input.personId },
  });

  const c = await prisma.complianceCase.findFirst({
    where: { id: input.caseId, institutionId: input.institutionId, status: "open" },
  });
  if (!c) {
    throw Object.assign(new Error("Case not found"), { status: 404, code: "NOT_FOUND" });
  }

  const isStaff = input.roles.includes("admin") || input.roles.includes("registrar");
  const ownsStudent = student && c.subjectType === "student" && c.subjectRef === student.id;
  const ownsInstructor = c.subjectType === "instructor" && c.subjectRef === input.accountId;
  if (!isStaff && !ownsStudent && !ownsInstructor) {
    throw Object.assign(new Error("Not allowed"), { status: 403, code: "FORBIDDEN" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.complianceCase.update({
      where: { id: c.id },
      data: {
        explanation: text,
        status: "explained",
        resolvedAt: null,
        resolvedById: null,
        rowVersion: { increment: 1 },
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.accountId,
      eventName: "ComplianceCase.explained",
      purpose: "compliance",
      before: { caseId: c.id, status: c.status, explanation: c.explanation },
      after: { caseId: c.id, status: "explained", explanation: text, reviewRequired: true },
      source: "compliance.explain",
      correlationId: randomUUID(),
    });
    return row;
  });

  return { case: updated, restored: false, reviewRequired: true };
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
