import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  applicationDocument: { findMany: vi.fn(), deleteMany: vi.fn() },
  admissionsApplication: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@myheritage/db", () => ({ prisma: db }));

import { purgeLegacyGovernmentIdData, redactApplication, stripGovernmentIdKeys } from "./governmentIdPurge.js";

describe("stripGovernmentIdKeys", () => {
  it("drops SIN and passport values and keeps the rest", () => {
    expect(JSON.parse(stripGovernmentIdKeys(JSON.stringify({ givenName: "Ana", sin: "000 000 000", passportNumber: "X1" }))!)).toEqual({ givenName: "Ana" });
  });

  it("returns null when nothing needs removing or the form is not JSON", () => {
    expect(stripGovernmentIdKeys(JSON.stringify({ givenName: "Ana", singleParent: "No" }))).toBeNull();
    expect(stripGovernmentIdKeys("not json")).toBeNull();
  });
});

describe("redactApplication", () => {
  it("hides government-ID documents and values from staff and AI views", () => {
    const app = { id: "a1", formJson: JSON.stringify({ sin: "1", program: "PN" }), documents: [{ label: "Passport" }, { label: "Grade 12 Certificate / Transcript" }] };
    const out = redactApplication(app);
    expect(JSON.parse(out.formJson)).toEqual({ program: "PN" });
    expect(out.documents.map((d) => d.label)).toEqual(["Grade 12 Certificate / Transcript"]);
  });
});

describe("purgeLegacyGovernmentIdData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes government-ID documents and strips stored identifiers", async () => {
    db.applicationDocument.findMany.mockResolvedValue([
      { id: "d1", institutionId: "i", applicationId: "a1", label: "Passport", fileName: null },
      { id: "d2", institutionId: "i", applicationId: "a1", label: "Language Proficiency Test Report", fileName: null },
    ]);
    db.admissionsApplication.findMany.mockResolvedValue([
      { id: "a1", formJson: JSON.stringify({ sin: "000 000 000", givenName: "Ana" }) },
      { id: "a2", formJson: JSON.stringify({ givenName: "Bo" }) },
    ]);
    await expect(purgeLegacyGovernmentIdData()).resolves.toEqual({ documents: 1, files: 0, forms: 1 });
    expect(db.applicationDocument.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["d1"] } } });
    expect(db.admissionsApplication.update).toHaveBeenCalledTimes(1);
    expect(db.admissionsApplication.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { formJson: JSON.stringify({ givenName: "Ana" }) } });
  });
});
