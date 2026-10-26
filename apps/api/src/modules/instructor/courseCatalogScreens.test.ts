import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { buildCourseBackups, buildCourseGroupsList, saveCourseGroup } from "./courseCatalogScreens.js";

const institutionId = "00000000-0000-4000-8000-000000000004";
const db = { sisScreenState: { findUnique: vi.fn(), upsert: vi.fn() } };

function stored(groups: Array<{ name: string; abbreviation: string }>) {
  return {
    payloadJson: JSON.stringify({
      groups: groups.map((g, i) => ({ id: `cg-${i}`, createdAt: "2026-10-01T00:00:00.000Z", ...g })),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.sisScreenState.findUnique.mockResolvedValue(null);
  db.sisScreenState.upsert.mockResolvedValue({});
});

describe("saveCourseGroup", () => {
  it("requires a name", async () => {
    await expect(saveCourseGroup(institutionId, { "Course Group Name": "  " }, db as never)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    expect(db.sisScreenState.upsert).not.toHaveBeenCalled();
  });

  it("rejects duplicate names, the built-in group and duplicate abbreviations", async () => {
    db.sisScreenState.findUnique.mockResolvedValue(stored([{ name: "Business Core", abbreviation: "BUS" }]));
    for (const fields of [
      { "Course Group Name": "business core" },
      { "Course Group Name": "No Grouping" },
      { "Course Group Name": "Accounting", Abbreviation: "bus" },
    ]) {
      await expect(saveCourseGroup(institutionId, fields, db as never)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    }
    expect(db.sisScreenState.upsert).not.toHaveBeenCalled();
  });

  it("appends the new group to the institution's saved list", async () => {
    db.sisScreenState.findUnique.mockResolvedValue(stored([{ name: "Business Core", abbreviation: "BUS" }]));
    const group = await saveCourseGroup(institutionId, { "Course Group Name": "Accounting", Abbreviation: "acc" }, db as never);
    expect(group).toMatchObject({ name: "Accounting", abbreviation: "ACC" });
    const call = db.sisScreenState.upsert.mock.calls[0]![0];
    expect(call.where.institutionId_path.institutionId).toBe(institutionId);
    expect(JSON.parse(call.update.payloadJson).groups.map((g: { name: string }) => g.name)).toEqual(["Business Core", "Accounting"]);
  });
});

describe("course group and backup screens", () => {
  it("lists saved groups with a real title instead of the generic stub", async () => {
    db.sisScreenState.findUnique.mockResolvedValue(stored([{ name: "Zeta", abbreviation: "" }, { name: "Alpha", abbreviation: "AL" }]));
    const screen = await buildCourseGroupsList(institutionId, db as never);
    expect(screen.title).toBe("Course Groups");
    expect(screen.rows.map((r) => r.cells[0])).toEqual(["No Grouping", "Alpha", "Zeta"]);
    expect(screen.countLabel).toBe("3 course groups");
  });

  it("explains an empty backup list without assessment copy", () => {
    const screen = buildCourseBackups(2);
    expect(screen.title).toBe("Course Backups");
    expect(screen.rows).toEqual([]);
    expect(screen.emptyMessage).not.toMatch(/assessment/i);
  });
});
