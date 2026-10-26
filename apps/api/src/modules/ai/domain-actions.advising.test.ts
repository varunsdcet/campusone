import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(),
  transaction: vi.fn(),
  writeAuditAndOutbox: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));
vi.mock("@myheritage/events", () => ({
  writeAuditAndOutbox: mocks.writeAuditAndOutbox,
}));

import { createAdvisorAppointment } from "./domain-actions.service.js";

describe("career coaching appointment persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) =>
      run({ advisingAppointment: { create: mocks.createAppointment } }),
    );
    mocks.createAppointment.mockResolvedValue({});
    mocks.writeAuditAndOutbox.mockResolvedValue({});
  });

  it("writes the requested appointment and its audit/outbox event atomically", async () => {
    const result = await createAdvisorAppointment({
      institutionId: "institution-1",
      studentId: "student-1",
      topic: "Career coaching",
      startsAt: "2026-10-22T05:30:00.000Z",
      notes: "Requested from Career & Opportunities",
      actorAccountId: "account-student",
      correlationId: "career-coaching-1",
    });

    expect(mocks.createAppointment).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: "institution-1",
        studentId: "student-1",
        topic: "Career coaching",
        startsAt: new Date("2026-10-22T05:30:00.000Z"),
        notes: "Requested from Career & Opportunities",
        status: "requested",
      }),
    });
    expect(mocks.writeAuditAndOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        institutionId: "institution-1",
        actorId: "account-student",
        eventName: "AdvisingAppointment.created",
        source: "student.advising",
        correlationId: "career-coaching-1",
      }),
    );
    expect(result).toMatchObject({
      studentId: "student-1",
      topic: "Career coaching",
      status: "requested",
      notes: "Requested from Career & Opportunities",
    });
  });
});
