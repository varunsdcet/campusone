import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  approvalRequest: { findFirst: vi.fn() },
  serviceRequest: { findFirst: vi.fn(), updateMany: vi.fn() },
  enrolment: { updateMany: vi.fn() },
  financeLedgerEntry: { findMany: vi.fn() },
  heritageRecord: { findMany: vi.fn(), upsert: vi.fn(), create: vi.fn() },
  gradeItem: { updateMany: vi.fn() },
  leaveOfAbsenceRequest: { updateMany: vi.fn() },
}));
const applyApproval = vi.hoisted(() => vi.fn());

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/auth", () => ({
  applyApproval: applyApproval.mockImplementation(async (input: { applyFn: (diff: unknown, tx: typeof db) => Promise<void> }) => {
    await input.applyFn({ type: "course_withdrawal", sectionId: "section-1" }, db);
    return { id: "approval-1", status: "applied" };
  }),
}));
vi.mock("../admin/registrar-gaps.service.js", () => ({ applyStudentProfileChange: vi.fn() }));

import { applyApprovedRequest } from "./approvals.service.js";

describe("course withdrawal approval application", () => {
  it("withdraws the active enrolment before resolving the request", async () => {
    db.approvalRequest.findFirst.mockResolvedValue({ id: "approval-1", type: "service_request.course_withdrawal", subjectRef: "student:student-1" });
    db.serviceRequest.findFirst.mockResolvedValue({ id: "request-1", studentId: "student-1" });
    db.enrolment.updateMany.mockResolvedValue({ count: 1 });
    db.financeLedgerEntry.findMany.mockResolvedValue([]);
    db.heritageRecord.findMany.mockResolvedValue([]);
    db.serviceRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(applyApprovedRequest("institution-1", "approval-1", "registrar-1")).resolves.toMatchObject({ status: "applied" });
    expect(db.enrolment.updateMany).toHaveBeenCalledWith({
      where: { institutionId: "institution-1", studentId: "student-1", sectionId: "section-1", status: "enrolled" },
      data: { status: "withdrawn", rowVersion: { increment: 1 } },
    });
    expect(db.enrolment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(db.serviceRequest.updateMany.mock.invocationCallOrder[0]!);
  });

  it("creates a second-review fee adjustment for the unpaid section charge", async () => {
    db.approvalRequest.findFirst.mockResolvedValue({ id: "approval-1", type: "service_request.course_withdrawal", subjectRef: "student:student-1", requestedBy: "student-account" });
    db.serviceRequest.findFirst.mockResolvedValue({ id: "request-1", studentId: "student-1" });
    db.enrolment.updateMany.mockResolvedValue({ count: 1 });
    db.financeLedgerEntry.findMany.mockResolvedValue([{ id: "charge-1", amountCad: "125.50" }]);
    db.heritageRecord.findMany.mockResolvedValue([{ dataJson: JSON.stringify({ chargeId: "charge-1", amount: 25.5 }) }]);
    db.heritageRecord.upsert.mockResolvedValue({ rowVersion: 9 });
    db.serviceRequest.updateMany.mockResolvedValue({ count: 1 });

    await applyApprovedRequest("institution-1", "approval-1", "registrar-1");

    expect(db.heritageRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        screenId: "FIN:ADJUSTMENT",
        contextKey: "student-1",
        dataJson: expect.stringContaining('"amount":100'),
      }),
    });
  });
});
