import { randomUUID } from "node:crypto";
import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { assertPermission, patchStudentMeta } from "../admin/superAdmin.service.js";
import { loadBook, loadConfig } from "../admin/heritage/finance.core.js";
import { assertNoActiveStudentHold } from "../me/studentAlignment.js";
import { computeDegreeProgress } from "./degree-progress.service.js";

const OPEN_REQUESTS = ["open", "pending", "pending_approval", "submitted", "in_review"];

/** Runs the authoritative graduation audit, then changes status and issues one idempotent degree credential. */
export async function graduateStudent(user: SessionClaims, studentId: string) {
  await assertPermission(user, "studentRecords", "edit");
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId: user.institutionId },
    include: {
      programVersion: { include: { program: true } },
      person: { include: { accounts: { where: { status: "active" } } } },
    },
  });
  if (!student) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND", status: 404 });
  await assertNoActiveStudentHold(user.institutionId, student.id, "Graduation");

  const progress = await computeDegreeProgress({ institutionId: user.institutionId, studentId: student.id });
  const [pendingTasks, openRequests, config] = await Promise.all([
    prisma.requiredTask.count({ where: { institutionId: user.institutionId, studentId: student.id, status: "pending" } }),
    prisma.serviceRequest.count({ where: { institutionId: user.institutionId, studentId: student.id, status: { in: OPEN_REQUESTS } } }),
    loadConfig(user.institutionId),
  ]);
  const finance = await loadBook(user.institutionId, config, student.id);
  const blockers = [
    ...(progress.remainingRequirements.length ? [`${progress.remainingRequirements.length} program requirement(s) remain`] : []),
    ...(progress.remainingCredits > 0 ? [`${progress.remainingCredits} required credit(s) remain`] : []),
    ...(pendingTasks ? [`${pendingTasks} required task(s) remain`] : []),
    ...(openRequests ? [`${openRequests} student request(s) remain open`] : []),
    ...(finance.balance > 0.005 ? [`Outstanding balance ${finance.balance.toFixed(2)} CAD`] : []),
  ];
  if (blockers.length) {
    throw Object.assign(new Error(`Graduation audit not clear: ${blockers.join("; ")}`), {
      code: "GRADUATION_AUDIT_FAILED",
      status: 409,
      blockers,
    });
  }

  const sourceKey = `degree:${student.programVersionId ?? progress.programCode}`;
  const title = `${student.programVersion?.program.name ?? progress.programName} ${student.programVersion?.program.awardLevel ?? "credential"}`;
  const earnedAt = new Date();
  const credential = await prisma.$transaction(async (tx) => {
    const row = await tx.credentialRecord.upsert({
      where: { studentId_sourceKey: { studentId: student.id, sourceKey } },
      create: {
        institutionId: user.institutionId,
        studentId: student.id,
        title,
        status: "earned",
        earnedAt,
        sourceKey,
        detail: `Graduation audit cleared by ${user.accountId}`,
      },
      update: {
        title,
        status: "earned",
        earnedAt,
        detail: `Graduation audit cleared by ${user.accountId}`,
        rowVersion: { increment: 1 },
      },
    });
    await tx.programPlan.updateMany({
      where: { institutionId: user.institutionId, studentId: student.id, status: "active" },
      data: { status: "completed", rowVersion: { increment: 1 } },
    });
    for (const account of student.person.accounts) {
      await tx.notification.create({
        data: {
          institutionId: user.institutionId,
          recipientAccountId: account.id,
          channel: "in_app",
          title: "Graduation confirmed",
          body: `${title} has been awarded. Your official credential is now available.`,
        },
      });
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "Student.graduated",
      purpose: "graduation",
      before: null,
      after: { studentId: student.id, credentialId: row.id, sourceKey, completedCredits: progress.completedCredits },
      source: "academic.graduation",
      correlationId: randomUUID(),
      outboxPayload: { studentId: student.id, credentialId: row.id, notifyStudentIds: [student.id] },
    });
    return row;
  });
  await patchStudentMeta(user.institutionId, student.id, { status: "Graduated" });
  return {
    studentId: student.id,
    status: "Graduated",
    credentialId: credential.id,
    credentialTitle: credential.title,
    earnedAt: credential.earnedAt?.toISOString() ?? earnedAt.toISOString(),
  };
}
