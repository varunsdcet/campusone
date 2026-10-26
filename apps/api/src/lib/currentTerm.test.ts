import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { pickCurrentTerm } from "./currentTerm.js";

const terms = [
  { code: "2027W", startsOn: "2027-01-05", endsOn: "2027-04-23" },
  { code: "2026F", startsOn: "2026-09-01", endsOn: "2026-12-18" },
  { code: "2026-ALL", startsOn: "2026-01-01", endsOn: "2026-12-31" },
  { code: "2026S", startsOn: "2026-05-01", endsOn: "2026-08-21" },
];

describe("pickCurrentTerm", () => {
  it("picks the term running today rather than the highest code, preferring the shortest overlapping one", () => {
    expect(pickCurrentTerm(terms, "2026-10-07")?.code).toBe("2026F");
    expect(pickCurrentTerm(terms, "2026-12-25")?.code).toBe("2026-ALL");
  });

  it("falls back to the next upcoming term, then the most recently ended one", () => {
    expect(pickCurrentTerm(terms.filter((t) => t.code !== "2026-ALL"), "2026-12-25")?.code).toBe("2027W");
    expect(pickCurrentTerm(terms, "2027-06-01")?.code).toBe("2027W");
    expect(pickCurrentTerm([], "2026-10-07")).toBeNull();
  });
});
