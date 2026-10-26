import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  approvalRequest: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import { requireApproval } from "./approvals.js";

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.approvalRequest.create.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001" });
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("requireApproval", () => {
  it("uses feature-specific audit and outbox metadata", async () => {
    await requireApproval({
      institutionId: "20000000-0000-4000-8000-000000000001",
      type: "student_profile_change",
      subjectRef: "30000000-0000-4000-8000-000000000001",
      proposedDiff: { familyName: "Vance-Singh" },
      requestedBy: "40000000-0000-4000-8000-000000000001",
      requiredApproverRoles: ["registrar"],
      correlationId: "profile-change-correlation",
      eventName: "Student.profileChangeRequested",
      purpose: "official_record_change",
      source: "student.profile",
    });

    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: "Student.profileChangeRequested",
        purpose: "official_record_change",
        source: "student.profile",
        correlationId: "profile-change-correlation",
      }),
    });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "Student.profileChangeRequested" }),
    });
  });
});
