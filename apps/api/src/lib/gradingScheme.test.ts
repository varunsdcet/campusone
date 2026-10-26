import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ heritageRecord: { findMany: vi.fn(), findFirst: vi.fn() } }));
vi.mock("@myheritage/db", () => ({ prisma: db }));

import { letterForSection } from "./gradingScheme.js";

describe("letterForSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the grading scheme saved on the section", async () => {
    db.heritageRecord.findMany.mockResolvedValue([{ screenId: "CM:SESSION", dataJson: JSON.stringify({ gradingScheme: "scheme-1" }) }]);
    db.heritageRecord.findFirst.mockResolvedValue({ id: "scheme-1", dataJson: JSON.stringify({ grades: [{ letter: "Honours", percent: 80 }, { letter: "Pass", percent: 55 }, { letter: "Fail", percent: 0 }] }) });
    await expect(letterForSection("institution-1", "section-1", "course-1", 82, 100)).resolves.toBe("Honours");
    expect(db.heritageRecord.findFirst).toHaveBeenCalledWith({ where: { id: "scheme-1", institutionId: "institution-1", screenId: "CM:GRADING", deletedAt: null } });
  });

  it("uses the standard scale only when no saved scheme matches", async () => {
    db.heritageRecord.findMany.mockResolvedValue([]);
    db.heritageRecord.findFirst.mockResolvedValue(null);
    await expect(letterForSection("institution-1", "section-1", "course-1", 76, 100)).resolves.toBe("B");
  });
});
