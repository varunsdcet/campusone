import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  heritageRecord: { findMany: vi.fn(), create: vi.fn() },
  heritageAuditEntry: { create: vi.fn(), findMany: vi.fn() },
  person: { findFirst: vi.fn() },
  term: { findMany: vi.fn() },
  account: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../superAdmin.service.js", () => ({ assertPermission: vi.fn() }));

import { listOwnProgramChangeRequests, submitProgramChangeRequest } from "./ops.js";

const user = {
  accountId: "account-teacher",
  institutionId: "institution-1",
  personId: "person-teacher",
  email: "teacher@example.edu",
  roles: ["instructor"],
} as const;

describe("instructor program change submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.heritageRecord.findMany.mockImplementation(({ where }: { where: { screenId: string } }) => {
      if (where.screenId === "PM:PROGRAM") {
        return Promise.resolve([{ id: "program-record", dataJson: JSON.stringify({ name: "Nursing", _prismaId: "program-prisma" }), createdAt: new Date(), updatedAt: new Date() }]);
      }
      return Promise.resolve([]);
    });
    db.heritageRecord.create.mockResolvedValue({ id: "request-1" });
    db.person.findFirst.mockResolvedValue({ givenName: "Elena", familyName: "Vance" });
    db.term.findMany.mockResolvedValue([{ id: "term-1", name: "Fall 2026" }]);
    db.account.findMany
      .mockResolvedValueOnce([{ personId: "person-teacher", rolesJson: '["instructor"]', person: { givenName: "Elena", familyName: "Vance" } }])
      .mockResolvedValueOnce([{ id: "account-admin", rolesJson: '["admin"]' }]);
    db.heritageAuditEntry.create.mockResolvedValue({ id: "audit-1" });
    db.heritageAuditEntry.findMany.mockResolvedValue([]);
    db.notification.createMany.mockResolvedValue({ count: 1 });
  });

  it("normalizes the Prisma programme id, attributes the signed-in teacher and enters Submitted status", async () => {
    const out = await submitProgramChangeRequest(user as never, {
      programId: "program-prisma",
      type: "Add course",
      title: "Add clinical practicum",
      rationale: "Required by the updated accreditation map",
      effectiveTerm: "Fall 2026",
      requestedBy: "spoofed-person",
      status: "Approved",
    });

    expect(out).toMatchObject({ ok: true, id: "request-1" });
    const created = JSON.parse(db.heritageRecord.create.mock.calls[0][0].data.dataJson);
    expect(created).toMatchObject({
      programId: "program-record",
      type: "Add course",
      requestedBy: "person-teacher",
      status: "Submitted",
      decisionNote: "",
    });
    expect(db.notification.createMany).toHaveBeenCalledOnce();
  });

  it("rejects a programme outside the institution catalogue", async () => {
    await expect(submitProgramChangeRequest(user as never, {
      programId: "missing-program",
      type: "Other",
      title: "Change",
      rationale: "Reason",
    })).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });

  it("returns only the signed-in teacher's requests with the admin status history", async () => {
    const submittedAt = new Date("2026-10-17T09:00:00.000Z");
    const updatedAt = new Date("2026-10-19T08:30:00.000Z");
    db.heritageRecord.findMany.mockImplementation(({ where }: { where: { screenId: string } }) => {
      if (where.screenId === "PM:PROGRAM") {
        return Promise.resolve([{ id: "program-record", dataJson: JSON.stringify({ name: "Nursing" }), createdAt: submittedAt, updatedAt }]);
      }
      if (where.screenId === "OPS:AC_CHANGE") {
        return Promise.resolve([
          { id: "request-own", dataJson: JSON.stringify({ programId: "program-record", requestedBy: "person-teacher", title: "Add clinical practicum", type: "Add course", status: "Approved", decisionNote: "Approved for Fall" }), createdAt: submittedAt, updatedAt },
          { id: "request-other", dataJson: JSON.stringify({ requestedBy: "person-other", title: "Private request", status: "Rejected" }), createdAt: submittedAt, updatedAt },
        ]);
      }
      return Promise.resolve([]);
    });
    db.heritageAuditEntry.findMany.mockResolvedValue([
      { recordId: "request-own", action: "approve", actorName: "Registrar One", afterJson: JSON.stringify({ status: "Approved", decisionNote: "Approved for Fall" }), note: null, createdAt: updatedAt },
    ]);

    const result = await listOwnProgramChangeRequests(user as never);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "request-own",
      programme: "Nursing",
      status: "Approved",
      decisionNote: "Approved for Fall",
      history: [expect.objectContaining({ status: "Approved", actor: "Registrar One" })],
    });
    expect(db.heritageAuditEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: "institution-1", recordId: { in: ["request-own"] } }),
    }));
  });
});
