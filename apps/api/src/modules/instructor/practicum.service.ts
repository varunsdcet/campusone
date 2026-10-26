import { randomUUID } from "node:crypto";
import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";

function failure(status: number, message: string, code: string) {
  return Object.assign(new Error(message), { status, code });
}

async function assignedPlacement(user: SessionClaims, placementId: string) {
  const placement = await prisma.placement.findFirst({
    where: { id: placementId, institutionId: user.institutionId, supervisorPersonId: user.personId },
    include: { student: { include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } } } },
  });
  if (!placement) throw failure(404, "Assigned practicum placement not found", "NOT_FOUND");
  return placement;
}

async function notifyStudent(placement: Awaited<ReturnType<typeof assignedPlacement>>, title: string, body: string, dedupeKey: string) {
  const recipients = placement.student?.person.accounts.map((account) => account.id) ?? [];
  if (recipients.length) await prisma.notification.createMany({
    data: recipients.map((recipientAccountId) => ({ institutionId: placement.institutionId, recipientAccountId, channel: "in_app", title, body, templateKey: "practicum.workflow", dedupeKey: `${dedupeKey}:${recipientAccountId}` })),
    skipDuplicates: true,
  });
}

export async function reviewAssignedPracticumHours(user: SessionClaims, hoursId: string, status: "approved" | "rejected") {
  const entry = await prisma.hoursEntry.findFirst({ where: { id: hoursId, institutionId: user.institutionId }, include: { placement: true } });
  if (!entry) throw failure(404, "Hours entry not found", "NOT_FOUND");
  const placement = await assignedPlacement(user, entry.placementId);
  if (entry.status !== "pending") throw failure(409, "This hours entry has already been reviewed", "CONFLICT");
  await prisma.hoursEntry.update({ where: { id: entry.id }, data: { status, rowVersion: { increment: 1 } } });
  await notifyStudent(placement, `Practicum hours ${status}`, `${entry.weekLabel} · ${entry.hours} hours`, `practicum-hours:${entry.id}:${status}`);
  await writeAuditAndOutbox(prisma, { institutionId: user.institutionId, actorId: user.accountId, eventName: `PracticumHours.${status}`, purpose: "practicum_supervision", before: { id: entry.id, status: entry.status }, after: { id: entry.id, status }, source: "instructor.practicum.hours", correlationId: randomUUID() });
  return { ok: true, id: entry.id, status };
}

export async function submitAssignedPracticumEvaluation(user: SessionClaims, evaluationId: string, score: number, notes: string) {
  const evaluation = await prisma.placementEvaluation.findFirst({ where: { id: evaluationId, institutionId: user.institutionId } });
  if (!evaluation) throw failure(404, "Evaluation not found", "NOT_FOUND");
  const placement = await assignedPlacement(user, evaluation.placementId);
  if (evaluation.status !== "due") throw failure(409, "This evaluation has already been submitted", "CONFLICT");
  await prisma.placementEvaluation.update({ where: { id: evaluation.id }, data: { status: "submitted", score, notes, rowVersion: { increment: 1 } } });
  await notifyStudent(placement, "Practicum evaluation submitted", `${placement.studentName} · ${score}/5`, `practicum-evaluation:${evaluation.id}:submitted`);
  await writeAuditAndOutbox(prisma, { institutionId: user.institutionId, actorId: user.accountId, eventName: "PracticumEvaluation.submitted", purpose: "practicum_supervision", before: { id: evaluation.id, status: evaluation.status }, after: { id: evaluation.id, status: "submitted", score, notes }, source: "instructor.practicum.evaluation", correlationId: randomUUID() });
  return { ok: true, id: evaluation.id, status: "submitted", score };
}
