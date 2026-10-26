import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionFindMany, facultySectionIds } = vi.hoisted(() => ({
  sectionFindMany: vi.fn(),
  facultySectionIds: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({
  prisma: {
    section: { findMany: sectionFindMany },
  },
}));
vi.mock("../instructor/sectionFaculty.js", () => ({ facultySectionIds }));
vi.mock("./sectionOffering.js", () => ({ sectionOfferings: vi.fn(async () => new Map()) }));
vi.mock("../../lib/sectionTerm.js", () => ({
  institutionTerms: vi.fn(async () => []),
  sectionTerm: (term: unknown) => term,
  termLabel: vi.fn(),
}));

import { instructorCourseItems } from "./courses.router.js";

describe("instructor course visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes every assigned section even before students enrol", async () => {
    facultySectionIds.mockResolvedValue(new Set(["som", "strength"]));
    sectionFindMany.mockResolvedValue([
      {
        id: "som",
        course: { code: "som 315", title: "som", credits: 3 },
        term: { code: "FALL-2026", name: "Fall 2026", startsOn: "2026-09-01", endsOn: "2026-12-31" },
        _count: { enrolments: 0 },
      },
      {
        id: "strength",
        course: { code: "STROCT26-01", title: "Strenth of material", credits: 3 },
        term: { code: "E2E", name: "E2E_20261008144047 Term", startsOn: "2026-10-01", endsOn: "2027-01-31" },
        _count: { enrolments: 0 },
      },
    ]);

    const items = await instructorCourseItems({
      accountId: "faculty-account",
      personId: "faculty-person",
      institutionId: "institution",
      roles: ["instructor"],
      permissions: [],
    } as never);

    expect(sectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { institutionId: "institution", id: { in: ["som", "strength"] } },
      }),
    );
    expect(items).toEqual([
      expect.objectContaining({ sectionId: "som", code: "som 315", enrolmentCount: 0, status: "teaching" }),
      expect.objectContaining({ sectionId: "strength", code: "STROCT26-01", enrolmentCount: 0, status: "teaching" }),
    ]);
  });
});
