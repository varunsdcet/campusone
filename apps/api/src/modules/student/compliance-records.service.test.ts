import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findMany: vi.fn() }));
const alignment = vi.hoisted(() => ({ profiles: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: { heritageRecord: { findMany: db.findMany } } }));
vi.mock("../me/studentAlignment.js", () => ({ personStudentIds: alignment.profiles }));

import { listStudentComplianceRecords } from "./compliance-records.service.js";

const user = {
  institutionId: "institution-1",
  personId: "person-1",
  accountId: "account-1",
  roles: ["student"],
} as never;

describe("student compliance records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alignment.profiles.mockResolvedValue([{ id: "student-1", studentNumber: "1001" }]);
  });

  it("returns only the signed-in student's records and omits internal assignment fields", async () => {
    db.findMany.mockResolvedValue([
      { id: "hold-1", screenId: "OPS:CP_HOLD", dataJson: JSON.stringify({ studentId: "student-1", matter: "Preservation", scope: "Academic record", custodianId: "staff-secret", status: "Active", placedOn: "2026-10-19" }), updatedAt: new Date("2026-10-19T08:00:00Z") },
      { id: "privacy-1", screenId: "OPS:CP_PRIVACY", dataJson: JSON.stringify({ studentId: "student-1", handlerId: "staff-secret", type: "Access", status: "In Progress", response: "Review underway" }), updatedAt: new Date("2026-10-19T09:00:00Z") },
      { id: "disposal-1", screenId: "OPS:CP_DISPOSAL", dataJson: JSON.stringify({ studentId: "student-1", policyId: "policy-secret", records: "Old correspondence", status: "Proposed", notes: "internal" }), updatedAt: new Date("2026-10-19T10:00:00Z") },
      { id: "other", screenId: "OPS:CP_HOLD", dataJson: JSON.stringify({ studentId: "student-2", matter: "Other student", status: "Active" }), updatedAt: new Date("2026-10-19T11:00:00Z") },
    ]);

    const result = await listStudentComplianceRecords(user);

    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: "institution-1", deletedAt: null }),
    }));
    expect(result.summary).toEqual({ activeLegalHolds: 1, openPrivacyRequests: 1, pendingDisposals: 1 });
    expect(result.legalHolds).toEqual([expect.objectContaining({ id: "hold-1", matter: "Preservation" })]);
    expect(result.privacyRequests).toEqual([expect.objectContaining({ id: "privacy-1", response: "Review underway" })]);
    expect(result.disposals).toEqual([expect.objectContaining({ id: "disposal-1", records: "Old correspondence" })]);
    expect(JSON.stringify(result)).not.toContain("staff-secret");
    expect(JSON.stringify(result)).not.toContain("policy-secret");
    expect(JSON.stringify(result)).not.toContain("internal");
    expect(JSON.stringify(result)).not.toContain("Other student");
  });
});
