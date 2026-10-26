import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { resolveCampusId } from "./courses.js";

const campuses = [
  { id: "camp-surrey", label: "Heritage College – Surrey" },
  { id: "camp-van", label: "Vancouver" },
];

describe("resolveCampusId", () => {
  it("keeps a stored campus id", () => {
    expect(resolveCampusId(campuses, "camp-van")).toBe("camp-van");
  });

  it("maps a legacy campus name (any dash / case / spacing) to the campus id", () => {
    expect(resolveCampusId(campuses, "Heritage College – Surrey")).toBe("camp-surrey");
    expect(resolveCampusId(campuses, "heritage college -  surrey")).toBe("camp-surrey");
  });

  it("leaves unknown and empty values unchanged", () => {
    expect(resolveCampusId(campuses, "Not Set")).toBe("Not Set");
    expect(resolveCampusId(campuses, undefined)).toBe("");
  });
});
