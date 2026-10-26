import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));

vi.mock("@myheritage/db", () => ({
  prisma: {
    heritageRecord: { findMany: db.findMany, findFirst: db.findFirst },
  },
}));

import { assertLeadStageTransition, listAssignedCrmLeads } from "./assigned-crm.service.js";

const user: SessionClaims = {
  institutionId: "institution-1",
  personId: "teacher-1",
  accountId: "account-1",
  roles: ["instructor"],
  sessionId: "session-1",
  sub: "account-1",
};

describe("assigned CRM leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supports counsellor progress without allowing admission decisions", () => {
    expect(() => assertLeadStageTransition("New", "Contacted")).not.toThrow();
    expect(() => assertLeadStageTransition("Contacted", "Qualified")).not.toThrow();
    expect(() => assertLeadStageTransition("Qualified", "Applied")).not.toThrow();
    expect(() => assertLeadStageTransition("Applied", "Admitted")).toThrow(/cannot change/);
  });

  it("returns only leads assigned to the authenticated teacher", async () => {
    db.findMany
      .mockResolvedValueOnce([
        { id: "lead-1", dataJson: JSON.stringify({ firstName: "Asha", counsellorId: "teacher-1", programId: "program-1", stage: "New" }), createdAt: new Date("2026-10-16T09:00:00Z"), updatedAt: new Date("2026-10-16T09:00:00Z") },
        { id: "lead-2", dataJson: JSON.stringify({ firstName: "Noor", counsellorId: "teacher-2", programId: "program-1", stage: "New" }), createdAt: new Date("2026-10-16T09:00:00Z"), updatedAt: new Date("2026-10-16T09:00:00Z") },
      ])
      .mockResolvedValueOnce([{ id: "program-1", dataJson: JSON.stringify({ name: "Practical Nursing" }) }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await listAssignedCrmLeads(user);

    expect(db.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { institutionId: "institution-1", screenId: "OPS:CRM_LEAD", deletedAt: null },
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "lead-1", name: "Asha", programName: "Practical Nursing" });
  });
});
