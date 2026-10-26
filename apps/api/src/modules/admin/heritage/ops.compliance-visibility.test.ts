import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../labs/lab-flow.service.js", () => ({ syncLabSession: vi.fn() }));

import { AFTER } from "./ops.ext.js";

const ctx = {
  inst: "institution-1",
  user: { institutionId: "institution-1", accountId: "account-admin", personId: "person-admin", roles: ["admin"] },
  labels: vi.fn(),
  rows: vi.fn(),
} as never;

describe("compliance portal notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.student.findFirst.mockResolvedValue({ personId: "person-student" });
    db.account.findFirst.mockImplementation(({ where }: { where: { personId: string } }) => Promise.resolve({
      id: where.personId === "person-student" ? "account-student" : "account-teacher",
    }));
    db.notification.create.mockResolvedValue({ id: "notification-1" });
  });

  it("notifies the selected student and assigned custodian when a legal hold is created", async () => {
    await AFTER.legalHolds?.(ctx, {
      id: "hold-1",
      before: null,
      data: { studentId: "student-1", custodianId: "person-teacher", matter: "Records preservation", scope: "Academic records", status: "Active" },
    });

    expect(db.notification.create).toHaveBeenCalledTimes(2);
    expect(db.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ recipientAccountId: "account-student", title: "Legal hold placed" }) });
    expect(db.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ recipientAccountId: "account-teacher", title: "Legal hold assigned" }) });
  });

  it("notifies students for privacy, vault and disposal lifecycle records", async () => {
    await AFTER.privacyRequests?.(ctx, { id: "privacy-1", before: null, data: { studentId: "student-1", handlerId: "person-teacher", type: "Access", status: "Received" } });
    await AFTER.recordVault?.(ctx, { id: "document-1", before: null, data: { studentId: "student-1", recordName: "Transcript", status: "available" } });
    await AFTER.disposals?.(ctx, { id: "disposal-1", before: null, data: { studentId: "student-1", records: "Old correspondence", status: "Proposed" } });

    const studentTitles = db.notification.create.mock.calls
      .map(([arg]) => arg.data)
      .filter((item) => item.recipientAccountId === "account-student")
      .map((item) => item.title);
    expect(studentTitles).toEqual(expect.arrayContaining([
      "Privacy request received",
      "Student record added",
      "Record disposal review created",
    ]));
  });
});
