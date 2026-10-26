import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  approvalRequest: { findFirst: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import { applyApproval, canDecideApproval, decideApproval, parseApproverRoles, requireApproval } from "@myheritage/auth";

const institutionId = "00000000-0000-4000-8000-000000000004";
const approvalId = "10000000-0000-4000-8000-000000000001";
const requesterId = "20000000-0000-4000-8000-000000000001";
const approverA = "20000000-0000-4000-8000-000000000002";
const approverB = "20000000-0000-4000-8000-000000000003";

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: approvalId,
    institutionId,
    type: "grade_publish",
    status: "pending",
    requestedBy: requesterId,
    requiredApproverRolesJson: JSON.stringify(["admin", "registrar"]),
    requiredCount: 1,
    decisionsJson: "[]",
    proposedDiffJson: JSON.stringify({ gradeItemIds: ["g-1"], studentIds: ["s-1"] }),
    rowVersion: 3,
    ...overrides,
  };
}

function decide(actorId: string, decision: "approve" | "reject" = "approve") {
  return decideApproval({ approvalId, institutionId, actorId, actorRoles: ["registrar"], decision });
}

function claimedData() {
  return tx.approvalRequest.updateMany.mock.calls[0]?.[0]?.data as { status: string; decisionsJson: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.approvalRequest.findFirst.mockResolvedValue(pendingRow());
  tx.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.approvalRequest.findFirstOrThrow.mockImplementation(async () => pendingRow({ rowVersion: 4 }));
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("decideApproval", () => {
  it("refuses to let the requester approve their own request", async () => {
    await expect(decide(requesterId)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(tx.approvalRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("refuses a second decision from the same approver", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(
      pendingRow({
        requiredCount: 2,
        decisionsJson: JSON.stringify([{ actorId: approverA, decision: "approve", decidedAt: "2026-10-01T00:00:00.000Z" }]),
      }),
    );

    await expect(decide(approverA)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(tx.approvalRequest.updateMany).not.toHaveBeenCalled();
  });

  it("fails with 409 when another approver changed the row first", async () => {
    tx.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(decide(approverA)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(tx.approvalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: approvalId, rowVersion: 3, status: "pending" } }),
    );
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("approves once the required number of distinct approvers is reached", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(
      pendingRow({
        requiredCount: 2,
        decisionsJson: JSON.stringify([{ actorId: approverA, decision: "approve", decidedAt: "2026-10-01T00:00:00.000Z" }]),
      }),
    );

    await decide(approverB);

    expect(claimedData().status).toBe("approved");
    expect(JSON.parse(claimedData().decisionsJson).map((d: { actorId: string }) => d.actorId)).toEqual([approverA, approverB]);
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "ApprovalRequest.decided", actorId: approverB }),
    });
  });

  it("does not count repeated decisions by one approver towards the quorum", async () => {
    const earlier = { actorId: approverA, decision: "approve", decidedAt: "2026-10-01T00:00:00.000Z" };
    tx.approvalRequest.findFirst.mockResolvedValue(
      pendingRow({ requiredCount: 3, decisionsJson: JSON.stringify([earlier, earlier]) }),
    );

    await decide(approverB);

    expect(claimedData().status).toBe("pending");
  });

  it("keeps a multi-approver request pending after the first approval", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(pendingRow({ requiredCount: 2 }));

    await decide(approverA);

    expect(claimedData().status).toBe("pending");
  });

  it("lets a System Administrator (admin only) decide a registrar-only request", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(
      pendingRow({ type: "student_profile_change", requiredApproverRolesJson: JSON.stringify(["registrar"]) }),
    );

    await decideApproval({ approvalId, institutionId, actorId: approverA, actorRoles: ["admin"], decision: "approve" });

    expect(claimedData().status).toBe("approved");
  });

  it("still refuses an admin approving their own registrar-only request", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(pendingRow({ requiredApproverRolesJson: JSON.stringify(["registrar"]) }));

    await expect(
      decideApproval({ approvalId, institutionId, actorId: requesterId, actorRoles: ["admin"], decision: "approve" }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(tx.approvalRequest.updateMany).not.toHaveBeenCalled();
  });

  it("counts an admin and a registrar as two distinct approvers towards a quorum", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(
      pendingRow({
        requiredCount: 2,
        requiredApproverRolesJson: JSON.stringify(["registrar"]),
        decisionsJson: JSON.stringify([{ actorId: approverA, decision: "approve", decidedAt: "2026-10-01T00:00:00.000Z" }]),
      }),
    );

    await decideApproval({ approvalId, institutionId, actorId: approverB, actorRoles: ["admin"], decision: "approve" });

    expect(claimedData().status).toBe("approved");
  });

  it("refuses roles that do not cover the required approver role", async () => {
    tx.approvalRequest.findFirst.mockResolvedValue(pendingRow({ requiredApproverRolesJson: JSON.stringify(["registrar"]) }));

    await expect(
      decideApproval({ approvalId, institutionId, actorId: approverA, actorRoles: ["instructor"], decision: "approve" }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

describe("canDecideApproval", () => {
  it("treats admin as covering registrar but not the reverse", () => {
    expect(canDecideApproval(["admin"], ["registrar"])).toBe(true);
    expect(canDecideApproval(["registrar"], ["registrar"])).toBe(true);
    expect(canDecideApproval(["registrar"], ["admin"])).toBe(false);
    expect(canDecideApproval(["instructor"], ["registrar", "admin"])).toBe(false);
    expect(canDecideApproval(["admin"], parseApproverRoles("not json"))).toBe(false);
  });
});

describe("requireApproval event name", () => {
  beforeEach(() => {
    tx.approvalRequest.create.mockResolvedValue({ id: approvalId });
  });

  it.each([
    ["leave_of_absence", "ApprovalRequest.requested"],
    ["service_request.course_withdrawal", "ApprovalRequest.requested"],
    ["grade.publish", "GradeItem.publishRequested"],
    ["grade_publish", "GradeItem.publishRequested"],
  ])("records a %s request as %s", async (type, eventName) => {
    await requireApproval({
      institutionId,
      type,
      subjectRef: "student:s-1",
      proposedDiff: {},
      requestedBy: requesterId,
      requiredApproverRoles: ["registrar", "admin"],
    });

    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventName }) });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventName }) });
  });
});

describe("applyApproval", () => {
  it.each([
    ["grade_publish", "GradeItem.published"],
    ["student_profile_change", "ApprovalRequest.applied"],
  ])("records %s as %s attributed to the applying actor", async (type, eventName) => {
    tx.approvalRequest.findFirst.mockResolvedValue(pendingRow({ type, status: "approved" }));
    const applyFn = vi.fn().mockResolvedValue(undefined);

    await applyApproval({ approvalId, institutionId, actorId: approverB, applyFn });

    expect(applyFn).toHaveBeenCalledWith({ gradeItemIds: ["g-1"], studentIds: ["s-1"] }, tx);
    expect(tx.approvalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: approvalId, rowVersion: 3, status: "approved" } }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName, actorId: approverB }),
    });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventName }) });
    const payload = JSON.parse(tx.eventOutbox.create.mock.calls[0]![0].data.payloadJson);
    expect(payload).toMatchObject({ type, notifyStudentIds: ["s-1"] });
  });
});
