import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { campusCourseCategories } from "./location.js";

describe("Add Campus course category options", () => {
  it("uses active categories from current Course Management records", () => {
    expect(campusCourseCategories(["Business", "Healthcare"], ["Legacy Category"])).toEqual(["Business", "Healthcare"]);
  });

  it("falls back to legacy categories and removes duplicates", () => {
    expect(campusCourseCategories([], ["Legacy Category", "Legacy Category"])).toEqual(["Legacy Category"]);
  });
});
