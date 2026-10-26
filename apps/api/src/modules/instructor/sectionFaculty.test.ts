import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ section: { findMany: vi.fn() } }));
const settingsOf = vi.hoisted(() => vi.fn());
vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../admin/heritage/courses.js", () => ({ S: { session: "CM:SESSION" }, settingsOf }));

import { assignedFacultySectionIds, facultySectionIds } from "./sectionFaculty.js";

const user = {
  institutionId: "institution-1",
  personId: "person-secondary",
  accountId: "account-secondary",
  roles: ["instructor"],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.section.findMany.mockResolvedValue([
    { id: "lead", instructorPersonId: "person-secondary" },
    { id: "shared", instructorPersonId: "person-lead" },
    { id: "other", instructorPersonId: "person-other" },
  ]);
  settingsOf.mockResolvedValue(
    new Map([
      ["shared", { data: { instructors: ["account-lead", "account-secondary"] } }],
      ["other", { data: { instructors: ["account-other"] } }],
    ]),
  );
});

describe("facultySectionIds", () => {
  it("includes lead and additional assigned faculty, but no unrelated section", async () => {
    await expect(facultySectionIds(user as never)).resolves.toEqual(new Set(["lead", "shared"]));
  });

  it("lets administrators access every requested section", async () => {
    db.section.findMany.mockResolvedValue([
      { id: "shared", instructorPersonId: "person-lead" },
      { id: "other", instructorPersonId: "person-other" },
    ]);
    await expect(facultySectionIds({ ...user, roles: ["admin"] } as never, ["shared", "other"])).resolves.toEqual(
      new Set(["shared", "other"]),
    );
    expect(settingsOf).not.toHaveBeenCalled();
  });

  it("keeps an administrator's personal teaching list scoped to their assignments", async () => {
    await expect(assignedFacultySectionIds({ ...user, roles: ["admin"] } as never)).resolves.toEqual(
      new Set(["lead", "shared"]),
    );
  });
});
