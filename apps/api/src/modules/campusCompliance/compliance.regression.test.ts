import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  classSession: { findFirst: vi.fn() },
  student: { findFirst: vi.fn() },
  enrolment: { findFirst: vi.fn() },
  sessionJoinEvent: { create: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
  complianceCase: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));

import { submitExplanation } from "./inbox.js";
import { notifyAccount } from "./notify.js";
import { recordSessionJoin } from "./sessions.js";

const base = { institutionId: "inst", accountId: "account", personId: "person", roles: ["student"], userAgent: "Mozilla/5.0" };

beforeEach(() => {
  vi.clearAllMocks();
  db.classSession.findFirst.mockResolvedValue({ id: "session", sectionId: "section", joinUrl: "/live/section", section: { instructorPersonId: "teacher" } });
  db.student.findFirst.mockResolvedValue({ id: "student" });
  db.sessionJoinEvent.create.mockResolvedValue({ id: "join" });
  db.notification.findFirst.mockResolvedValue(null);
  db.notification.create.mockResolvedValue({ id: "notification" });
});

describe("compliance regressions", () => {
  it("does not expose a join URL to a non-enrolled student", async () => {
    db.enrolment.findFirst.mockResolvedValue(null);
    await expect(recordSessionJoin({ ...base, classSessionId: "session" })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(db.sessionJoinEvent.create).not.toHaveBeenCalled();
  });

  it("allows the assigned instructor without creating a student join", async () => {
    db.student.findFirst.mockResolvedValue(null);
    await expect(recordSessionJoin({ ...base, personId: "teacher", roles: ["instructor"], classSessionId: "session" })).resolves.toMatchObject({ joinUrl: "/live/section" });
    expect(db.sessionJoinEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ studentId: null }) }));
  });

  it("leaves an explained case pending staff review and never activates the account", async () => {
    db.complianceCase.findFirst.mockResolvedValue({ id: "case", subjectType: "student", subjectRef: "student", status: "open", explanation: null });
    const tx = { complianceCase: { update: vi.fn().mockResolvedValue({ id: "case", status: "explained" }) }, account: { updateMany: vi.fn() } };
    db.$transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx));
    await expect(submitExplanation({ ...base, caseId: "case", explanation: "A valid explanation" })).resolves.toMatchObject({ restored: false, reviewRequired: true });
    expect(tx.complianceCase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "explained", resolvedAt: null }) }));
    expect(tx.account.updateMany).not.toHaveBeenCalled();
  });

  it("does not create an exact duplicate sweep notification", async () => {
    db.notification.findFirst.mockResolvedValue({ id: "existing" });
    await notifyAccount({ institutionId: "inst", accountId: "account", title: "Attendance warning", body: "Same case", templateKey: "compliance.student.warning" });
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("treats a unique-index race as an already-created notification", async () => {
    db.notification.create.mockRejectedValue({ code: "P2002" });
    await expect(notifyAccount({ institutionId: "inst", accountId: "account", title: "Attendance warning", body: "Same case", templateKey: "compliance.student.warning" })).resolves.toBeUndefined();
  });
});
