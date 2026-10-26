import { applyApproval } from "@myheritage/auth";
import { prisma } from "@myheritage/db";
import { applyStudentProfileChange } from "../admin/registrar-gaps.service.js";

export const OPEN_SERVICE_REQUEST_STATUSES = ["open", "pending", "pending_approval", "submitted", "in_review"];

async function studentAccounts(institutionId: string, studentIds: string[]) {
  if (!studentIds.length) return new Map<string, string>();
  const students = await prisma.student.findMany({ where: { institutionId, id: { in: studentIds } }, select: { id: true, personId: true } });
  const accounts = await prisma.account.findMany({
    where: { institutionId, personId: { in: students.map((s) => s.personId) } },
    select: { id: true, personId: true },
    orderBy: { createdAt: "asc" },
  });
  const byPerson = new Map<string, string>();
  for (const a of accounts) if (a.personId && !byPerson.has(a.personId)) byPerson.set(a.personId, a.id);
  return new Map(students.flatMap((s) => (byPerson.has(s.personId) ? [[s.id, byPerson.get(s.personId)!] as const] : [])));
}

async function gradeItemIdsOf(institutionId: string, approvalId: string) {
  const row = await prisma.approvalRequest.findFirst({ where: { id: approvalId, institutionId }, select: { proposedDiffJson: true } });
  if (!row) return [];
  try {
    const ids = (JSON.parse(row.proposedDiffJson) as { gradeItemIds?: unknown }).gradeItemIds;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Closes the linked leave and service requests once an approval is rejected, returns its grades to draft, and tells the student. */
export async function settleRejectedApproval(institutionId: string, approvalId: string, comment?: string) {
  const gradeItemIds = await gradeItemIdsOf(institutionId, approvalId);
  if (gradeItemIds.length) {
    await prisma.gradeItem.updateMany({
      where: { id: { in: gradeItemIds }, institutionId, status: "pending_publish" },
      data: { status: "draft" },
    });
  }
  const [leaves, services] = await Promise.all([
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId, approvalRequestId: approvalId, status: "pending" }, select: { studentId: true } }),
    prisma.serviceRequest.findMany({
      where: { institutionId, approvalRequestId: approvalId, status: { in: OPEN_SERVICE_REQUEST_STATUSES } },
      select: { studentId: true, type: true, subject: true },
    }),
  ]);
  await prisma.$transaction([
    prisma.leaveOfAbsenceRequest.updateMany({
      where: { institutionId, approvalRequestId: approvalId, status: "pending" },
      data: { status: "rejected", decidedAt: new Date(), decisionNote: comment || "Declined from approvals inbox" },
    }),
    prisma.serviceRequest.updateMany({
      where: { institutionId, approvalRequestId: approvalId, status: { in: OPEN_SERVICE_REQUEST_STATUSES } },
      data: { status: "rejected" },
    }),
  ]);
  const note = comment ? ` Note: ${comment}` : "";
  const notices = [
    ...leaves.map((l) => ({ studentId: l.studentId, body: `Your leave of absence request was declined.${note}` })),
    ...services.map((r) => ({ studentId: r.studentId, body: `Your ${r.type.replace(/_/g, " ")} request “${r.subject}” was declined.${note}` })),
  ];
  const accounts = await studentAccounts(institutionId, [...new Set(notices.map((n) => n.studentId))]);
  const data = notices.flatMap((n) => {
    const recipientAccountId = accounts.get(n.studentId);
    return recipientAccountId ? [{ institutionId, recipientAccountId, channel: "in_app", title: "Request declined", body: n.body.slice(0, 4000) }] : [];
  });
  if (data.length) await prisma.notification.createMany({ data });
}

/** Applies an approved request's proposed change (grades, profile changes, leave, service requests). */
export async function applyApprovedRequest(institutionId: string, approvalId: string, actorId?: string) {
  const approvalRow = await prisma.approvalRequest.findFirst({ where: { id: approvalId, institutionId } });
  return applyApproval({
    approvalId,
    institutionId,
    actorId,
    applyFn: async (diff, tx) => {
      const payload = diff as { gradeItemIds?: string[]; type?: string; sectionId?: string; correction?: { gradeItemId: string; score: number; letter: string; feedback?: string | null; reason: string; expectedRowVersion: number } };
      if (approvalRow?.type === "grade.correct" && payload.correction) {
        const correction = payload.correction;
        const claimed = await tx.gradeItem.updateMany({
          where: { id: correction.gradeItemId, institutionId, status: "published", rowVersion: correction.expectedRowVersion },
          data: { score: correction.score, letter: correction.letter, feedback: correction.feedback, publishedAt: new Date(), rowVersion: { increment: 1 } },
        });
        if (claimed.count !== 1) throw Object.assign(new Error("The published grade changed before this correction was applied"), { code: "CONFLICT", status: 409 });
      } else if (Array.isArray(payload.gradeItemIds) && payload.gradeItemIds.length) {
        await tx.gradeItem.updateMany({
          where: { id: { in: payload.gradeItemIds }, institutionId },
          data: { status: "published", publishedAt: new Date() },
        });
      }
      if (approvalRow?.type === "student_profile_change" && approvalRow.subjectRef) {
        await applyStudentProfileChange(institutionId, approvalRow.subjectRef, payload as Record<string, unknown>, tx);
      }
      if (approvalRow?.type === "service_request.course_withdrawal") {
        if (!payload.sectionId) throw Object.assign(new Error("The withdrawal approval does not identify a course section"), { code: "CONFLICT", status: 409 });
        const request = await tx.serviceRequest.findFirst({ where: { institutionId, approvalRequestId: approvalId, type: "course_withdrawal" } });
        if (!request) throw Object.assign(new Error("Course withdrawal request not found"), { code: "NOT_FOUND", status: 404 });
        const withdrawn = await tx.enrolment.updateMany({
          where: { institutionId, studentId: request.studentId, sectionId: payload.sectionId, status: "enrolled" },
          data: { status: "withdrawn", rowVersion: { increment: 1 } },
        });
        if (withdrawn.count !== 1) {
          throw Object.assign(new Error("The selected course is no longer an active enrolment"), { code: "CONFLICT", status: 409 });
        }
        const charges = await tx.financeLedgerEntry.findMany({
          where: { institutionId, studentId: request.studentId, sectionId: payload.sectionId, kind: "charge", status: "open" },
        });
        const allocationRows = await tx.heritageRecord.findMany({
          where: { institutionId, screenId: "FIN:ALLOC", contextKey: request.studentId, deletedAt: null },
          select: { dataJson: true },
        });
        const paidByCharge = new Map<string, number>();
        for (const row of allocationRows) {
          try {
            const allocation = JSON.parse(row.dataJson) as { chargeId?: string; amount?: number };
            if (allocation.chargeId) paidByCharge.set(allocation.chargeId, (paidByCharge.get(allocation.chargeId) ?? 0) + Number(allocation.amount ?? 0));
          } catch {
            // Invalid legacy allocation rows are ignored; ledger validation on
            // adjustment review remains the final guard.
          }
        }
        for (const charge of charges) {
          const owing = Math.round(Math.max(0, Number(charge.amountCad) - (paidByCharge.get(charge.id) ?? 0)) * 100) / 100;
          if (owing < 0.005) continue;
          const sequence = await tx.heritageRecord.upsert({
            where: { institutionId_screenId_contextKey_singletonKey: { institutionId, screenId: "FIN:SEQ", contextKey: "", singletonKey: "adjustment" } },
            create: { institutionId, screenId: "FIN:SEQ", contextKey: "", singletonKey: "adjustment", dataJson: "{}", createdById: actorId ?? approvalRow.requestedBy, updatedById: actorId ?? approvalRow.requestedBy },
            update: { rowVersion: { increment: 1 }, updatedById: actorId ?? approvalRow.requestedBy },
          });
          await tx.heritageRecord.create({
            data: {
              institutionId,
              screenId: "FIN:ADJUSTMENT",
              contextKey: request.studentId,
              dataJson: JSON.stringify({
                number: 1000 + sequence.rowVersion,
                direction: "Decrease balance (credit)",
                amount: owing,
                reason: `Course withdrawal fee review for section ${payload.sectionId}`,
                status: "Pending",
                requestedBy: approvalRow.requestedBy,
                requestedAt: new Date().toISOString(),
                ledgerEntryId: charge.id,
                ledgerAction: "waive",
                withdrawalRequestId: request.id,
                sectionId: payload.sectionId,
              }),
              createdById: actorId ?? approvalRow.requestedBy,
              updatedById: actorId ?? approvalRow.requestedBy,
            },
          });
        }
      }
      await tx.serviceRequest.updateMany({
        where: { institutionId, approvalRequestId: approvalId },
        data: { status: "resolved" },
      });
      if (approvalRow?.type === "leave_of_absence") {
        await tx.leaveOfAbsenceRequest.updateMany({
          where: { approvalRequestId: approvalId, institutionId },
          data: { status: "approved", decidedAt: new Date(), decisionNote: "Applied from approvals inbox" },
        });
      }
    },
  });
}
