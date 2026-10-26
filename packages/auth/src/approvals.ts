import { randomUUID } from "node:crypto";
import type { RoleName } from "@myheritage/contracts";
import { prisma, type Prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";

/** Roles that may also act for a required approver role: a System Administrator (`admin`) covers registrar approvals. */
const COVERING_ROLES: Partial<Record<RoleName, RoleName[]>> = { registrar: ["admin"] };

export function canDecideApproval(actorRoles: readonly RoleName[], requiredRoles: readonly RoleName[]) {
  return requiredRoles.some((r) => actorRoles.includes(r) || (COVERING_ROLES[r] ?? []).some((c) => actorRoles.includes(c)));
}

export function parseApproverRoles(json: string): RoleName[] {
  try {
    const roles = JSON.parse(json) as unknown;
    return Array.isArray(roles) ? (roles.filter((r) => typeof r === "string") as RoleName[]) : [];
  } catch {
    return [];
  }
}

const GRADE_APPROVAL_TYPES = new Set(["grade_publish", "grade.publish", "grade.correct"]);

export function approvalRequestedEventName(type: string) {
  return GRADE_APPROVAL_TYPES.has(type) ? "GradeItem.publishRequested" : "ApprovalRequest.requested";
}

export async function requireApproval(input: {
  institutionId: string;
  type: string;
  subjectRef: string;
  proposedDiff: unknown;
  requestedBy: string;
  requiredApproverRoles: RoleName[];
  requiredCount?: number;
  correlationId?: string;
  eventName?: string;
  purpose?: string;
  source?: string;
  tx?: Prisma.TransactionClient;
}) {
  const correlationId = input.correlationId ?? randomUUID();
  const createRequest = async (tx: Prisma.TransactionClient) => {
    const row = await tx.approvalRequest.create({
      data: {
        institutionId: input.institutionId,
        type: input.type,
        subjectRef: input.subjectRef,
        proposedDiffJson: JSON.stringify(input.proposedDiff),
        requestedBy: input.requestedBy,
        requiredApproverRolesJson: JSON.stringify(input.requiredApproverRoles),
        requiredCount: input.requiredCount ?? 1,
        status: "pending",
        decisionsJson: "[]",
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.requestedBy,
      eventName: input.eventName ?? approvalRequestedEventName(input.type),
      purpose: input.purpose ?? "consequential_write",
      before: null,
      after: { approvalRequestId: row.id, type: input.type },
      source: input.source ?? "approvals.require",
      correlationId,
      outboxPayload: { approvalRequestId: row.id },
    });
    return row;
  };
  return input.tx ? createRequest(input.tx) : prisma.$transaction(createRequest);
}

export async function decideApproval(input: {
  approvalId: string;
  institutionId: string;
  actorId: string;
  actorRoles: RoleName[];
  decision: "approve" | "reject";
  comment?: string;
}) {
  const correlationId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const row = await tx.approvalRequest.findFirst({
      where: { id: input.approvalId, institutionId: input.institutionId },
    });
    if (!row) throw Object.assign(new Error("Approval not found"), { code: "NOT_FOUND", status: 404 });
    if (row.status !== "pending") {
      throw Object.assign(new Error("Approval is not pending"), { code: "CONFLICT", status: 409 });
    }
    if (!canDecideApproval(input.actorRoles, parseApproverRoles(row.requiredApproverRolesJson))) {
      throw Object.assign(new Error("Insufficient role to decide"), { code: "FORBIDDEN", status: 403 });
    }
    if (input.decision === "approve" && row.requestedBy === input.actorId) {
      throw Object.assign(new Error("You cannot approve your own request; another approver must decide it"), { code: "FORBIDDEN", status: 403 });
    }
    const decisions = JSON.parse(row.decisionsJson) as Array<{
      actorId: string;
      decision: string;
      comment?: string;
      decidedAt: string;
    }>;
    if (decisions.some((d) => d.actorId === input.actorId)) {
      throw Object.assign(new Error("You have already decided this request"), { code: "CONFLICT", status: 409 });
    }
    decisions.push({
      actorId: input.actorId,
      decision: input.decision,
      comment: input.comment,
      decidedAt: new Date().toISOString(),
    });

    let status = row.status;
    if (input.decision === "reject") status = "rejected";
    else if (new Set(decisions.filter((d) => d.decision === "approve").map((d) => d.actorId)).size >= row.requiredCount) {
      status = "approved";
    }

    // Guarded on rowVersion so two approvers deciding at the same moment cannot overwrite each other's decision.
    const claimed = await tx.approvalRequest.updateMany({
      where: { id: row.id, rowVersion: row.rowVersion, status: "pending" },
      data: { decisionsJson: JSON.stringify(decisions), status, rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("This request was decided by someone else. Reload and try again."), { code: "CONFLICT", status: 409 });
    }
    const updated = await tx.approvalRequest.findFirstOrThrow({ where: { id: row.id } });

    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.actorId,
      eventName: "ApprovalRequest.decided",
      purpose: "approval",
      before: { status: row.status },
      after: { status, decisions },
      source: "approvals.decide",
      correlationId,
    });

    return updated;
  });
}

export async function applyApproval(input: {
  approvalId: string;
  institutionId: string;
  /** Who applied it; defaults to the requester for older callers. */
  actorId?: string;
  applyFn: (proposedDiff: unknown, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>;
}) {
  const correlationId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const row = await tx.approvalRequest.findFirst({
      where: { id: input.approvalId, institutionId: input.institutionId },
    });
    if (!row) throw Object.assign(new Error("Approval not found"), { code: "NOT_FOUND", status: 404 });
    if (row.status !== "approved") {
      throw Object.assign(new Error("Approval not approved"), { code: "CONFLICT", status: 409 });
    }
    const claimed = await tx.approvalRequest.updateMany({
      where: { id: row.id, rowVersion: row.rowVersion, status: "approved" },
      data: { status: "applied", rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("This approval has already been applied"), { code: "CONFLICT", status: 409 });
    }
    const diff = JSON.parse(row.proposedDiffJson);
    await input.applyFn(diff, tx);
    const updated = await tx.approvalRequest.findFirstOrThrow({ where: { id: row.id } });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.actorId ?? row.requestedBy,
      eventName: GRADE_APPROVAL_TYPES.has(row.type) ? "GradeItem.published" : "ApprovalRequest.applied",
      purpose: "apply_approval",
      before: null,
      after: diff,
      source: "approvals.apply",
      correlationId,
      outboxPayload: {
        type: row.type,
        ...diff,
        notifyStudentIds: (diff as { studentIds?: string[] }).studentIds ?? [],
      },
    });
    return updated;
  });
}
