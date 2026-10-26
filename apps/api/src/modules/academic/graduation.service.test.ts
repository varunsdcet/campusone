import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  requiredTask: { count: vi.fn() },
  serviceRequest: { count: vi.fn() },
  credentialRecord: { upsert: vi.fn() },
  programPlan: { updateMany: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const deps = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  patchStudentMeta: vi.fn(),
  loadConfig: vi.fn(),
  loadBook: vi.fn(),
  assertNoActiveStudentHold: vi.fn(),
  computeDegreeProgress: vi.fn(),
  writeAuditAndOutbox: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: deps.writeAuditAndOutbox }));
vi.mock("../admin/superAdmin.service.js", () => ({ assertPermission: deps.assertPermission, patchStudentMeta: deps.patchStudentMeta }));
vi.mock("../admin/heritage/finance.core.js", () => ({ loadConfig: deps.loadConfig, loadBook: deps.loadBook }));
vi.mock("../me/studentAlignment.js", () => ({ assertNoActiveStudentHold: deps.assertNoActiveStudentHold }));
vi.mock("./degree-progress.service.js", () => ({ computeDegreeProgress: deps.computeDegreeProgress }));

import { graduateStudent } from "./graduation.service.js";

const user: SessionClaims = {
  sub: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
  personId: "00000000-0000-4000-8000-000000000003",
  institutionId: "00000000-0000-4000-8000-000000000004",
  sessionId: "00000000-0000-4000-8000-000000000005",
  roles: ["registrar"],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.student.findFirst.mockResolvedValue({
    id: "student-1",
    programVersionId: "version-1",
    programVersion: { program: { name: "Business Administration", awardLevel: "Diploma" } },
    person: { accounts: [{ id: "account-1" }] },
  });
  deps.computeDegreeProgress.mockResolvedValue({
    programCode: "BA",
    programName: "Business Administration",
    completedCredits: 60,
    remainingCredits: 0,
    remainingRequirements: [],
  });
  db.requiredTask.count.mockResolvedValue(0);
  db.serviceRequest.count.mockResolvedValue(0);
  deps.loadConfig.mockResolvedValue({});
  deps.loadBook.mockResolvedValue({ balance: 0 });
  db.credentialRecord.upsert.mockResolvedValue({ id: "credential-1", title: "Business Administration Diploma", earnedAt: new Date("2026-10-14T00:00:00Z") });
  db.programPlan.updateMany.mockResolvedValue({ count: 1 });
  db.notification.create.mockResolvedValue({ id: "notice-1" });
});

describe("graduateStudent", () => {
  it("issues one degree credential and marks the audited profile graduated", async () => {
    await expect(graduateStudent(user, "student-1")).resolves.toMatchObject({
      status: "Graduated",
      credentialId: "credential-1",
    });
    expect(db.credentialRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId_sourceKey: { studentId: "student-1", sourceKey: "degree:version-1" } },
    }));
    expect(db.programPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }));
    expect(deps.patchStudentMeta).toHaveBeenCalledWith(user.institutionId, "student-1", { status: "Graduated" });
    expect(db.notification.create).toHaveBeenCalled();
  });

  it("does not issue a credential when the degree audit has blockers", async () => {
    deps.computeDegreeProgress.mockResolvedValue({
      programCode: "BA",
      programName: "Business Administration",
      completedCredits: 57,
      remainingCredits: 3,
      remainingRequirements: [{ code: "BA499" }],
    });
    await expect(graduateStudent(user, "student-1")).rejects.toMatchObject({ code: "GRADUATION_AUDIT_FAILED", status: 409 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(deps.patchStudentMeta).not.toHaveBeenCalled();
  });
});
