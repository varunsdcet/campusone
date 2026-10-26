import { prisma, type Prisma } from "@myheritage/db";

export const GRADE_APPROVAL_TYPES = ["grade_publish", "grade.publish", "grade.correct"];

export const GRADE_AWAITING_APPROVAL_MESSAGE =
  "This grade is awaiting approval; ask the approver to decline it before editing";

/**
 * Grade items referenced by a grade-publish approval that is still open (pending, or approved but not applied),
 * mapped to that approval's id. The approver reviews the scores as they were when submitted, so these items are frozen.
 */
export async function gradeItemsInOpenApproval(
  institutionId: string,
  gradeItemIds: string[],
  db: Prisma.TransactionClient = prisma,
) {
  const locked = new Map<string, string>();
  if (!gradeItemIds.length) return locked;
  const wanted = new Set(gradeItemIds);
  const approvals = await db.approvalRequest.findMany({
    where: { institutionId, type: { in: GRADE_APPROVAL_TYPES }, status: { in: ["pending", "approved"] } },
    select: { id: true, proposedDiffJson: true },
  });
  for (const approval of approvals) {
    let ids: unknown;
    try {
      ids = (JSON.parse(approval.proposedDiffJson) as { gradeItemIds?: unknown }).gradeItemIds;
    } catch {
      continue;
    }
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id === "string" && wanted.has(id) && !locked.has(id)) locked.set(id, approval.id);
    }
  }
  return locked;
}

export function gradeAwaitingApprovalError() {
  return Object.assign(new Error(GRADE_AWAITING_APPROVAL_MESSAGE), { code: "CONFLICT", status: 409 });
}
