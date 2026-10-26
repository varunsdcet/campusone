import type { Prisma, PrismaClient } from "@myheritage/db";

export type Tx = Prisma.TransactionClient | PrismaClient;

export async function writeAuditAndOutbox(
  tx: Tx,
  input: {
    institutionId: string;
    actorId: string;
    eventName: string;
    purpose: string;
    before: unknown;
    after: unknown;
    source: string;
    correlationId: string;
    outboxPayload?: unknown;
  },
): Promise<void> {
  // A PrismaClient call must still be atomic. Transaction clients do not expose
  // $transaction, so calls already participating in a business transaction
  // continue directly on that transaction.
  if ("$transaction" in tx && typeof tx.$transaction === "function") {
    await tx.$transaction(async (db): Promise<void> => writeAuditAndOutbox(db, input));
    return;
  }
  await tx.auditEvent.create({
    data: {
      institutionId: input.institutionId,
      actorId: input.actorId,
      eventName: input.eventName,
      purpose: input.purpose,
      beforeJson: input.before == null ? null : JSON.stringify(input.before),
      afterJson: input.after == null ? null : JSON.stringify(input.after),
      source: input.source,
      correlationId: input.correlationId,
      version: 1,
    },
  });

  await tx.eventOutbox.create({
    data: {
      institutionId: input.institutionId,
      eventName: input.eventName,
      payloadJson: JSON.stringify(input.outboxPayload ?? input.after ?? {}),
      status: "pending",
    },
  });
}

export const EVENT_CATALOGUE = [
  "Account.login",
  "GradeItem.updated",
  "GradeItem.publishRequested",
  "GradeItem.published",
  "ApprovalRequest.requested",
  "ApprovalRequest.decided",
  "ApprovalRequest.applied",
  "Message.sent",
  "Student.grades.view",
  "StudentSubmission.fileUploaded",
  "StudentSubmission.fileArchived",
  "StudentSubmission.submitted",
  "Notification.read",
  "Student.preferencesUpdated",
  "Student.profileChangeRequested",
  "AiInteraction.created",
  "DegreePlanScenario.created",
] as const;
