import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { sectionTerm, termLabel, UNASSIGNED_TERM } from "./sectionTerm.js";

const fall25 = { id: "t-f25", code: "2025F", name: "Fall 2025", startsOn: "2025-09-01", endsOn: "2025-12-19" };
const winter26 = { id: "t-w26", code: "2026W", name: "Winter 2026", startsOn: "2026-01-05", endsOn: "2026-04-24" };
const fall26 = { id: "t-f26", code: "2026F", name: "Fall 2026", startsOn: "2026-09-01", endsOn: "2026-12-18" };
const year26 = { id: "t-y26", code: "2026-ALL", name: "2026 Academic Year", startsOn: "2026-01-01", endsOn: "2026-12-31" };

describe("sectionTerm", () => {
  it("keeps the stored term when it covers the section's start date", () => {
    expect(sectionTerm(fall26, { startsOn: "2026-09-08", endsOn: "2026-12-10" }, [fall25, fall26])).toBe(fall26);
  });

  it("never labels a termless section with the unrelated fallback term", () => {
    const term = sectionTerm(fall25, { startsOn: "2026-06-01", endsOn: "2026-08-28" }, [fall25, winter26, fall26]);
    expect(term).toBeNull();
    expect(termLabel(term)).toBe(UNASSIGNED_TERM);
  });

  it("uses the term whose range covers the section's dates, shortest first", () => {
    expect(sectionTerm(fall25, { startsOn: "2026-09-08", endsOn: "2026-12-10" }, [fall25, year26, fall26])).toBe(fall26);
    expect(sectionTerm(fall25, { startsOn: "2026-06-01", endsOn: "2026-08-28" }, [fall25, year26, fall26])).toBe(year26);
  });

  it("prefers a term covering both ends over a shorter one covering only the start", () => {
    expect(sectionTerm(null, { startsOn: "2026-12-01", endsOn: "2027-01-20" }, [fall26, year26])).toBe(fall26);
    expect(sectionTerm(null, { startsOn: "2026-04-20", endsOn: "2026-06-30" }, [winter26, year26])).toBe(year26);
  });

  it("falls back to the stored term when the section has no dates", () => {
    expect(sectionTerm(fall25, { startsOn: null, endsOn: null }, [fall25, fall26])).toBe(fall25);
  });
});
