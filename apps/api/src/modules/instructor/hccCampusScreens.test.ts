import { describe, expect, it, vi } from "vitest";
import type { SectionRunFacts } from "./myCoursesFacts.js";

const facts = vi.hoisted(() => new Map<string, SectionRunFacts>());
vi.mock("@myheritage/db", () => ({ prisma: {} }));
vi.mock("./myCoursesFacts.js", () => ({ loadSectionRunFacts: vi.fn(async () => facts) }));

import { buildHccCourseEvaluations, buildHccCourseHistory } from "./hccCampusScreens.js";

const section = (id: string, code: string, termCode: string) => ({ id, code, courseCode: "QA-101", courseTitle: "QA", termCode, enrolmentCount: 0, enrolments: [] });
const run = (startsOn: string, endsOn: string, timing: SectionRunFacts["timing"]): SectionRunFacts => ({ startsOn, endsOn, delivery: null, timing });

facts.set("jun", run("2026-06-01", "2026-08-28", "ended"));
facts.set("sep", run("2026-09-08", "2026-12-15", "current"));
facts.set("oct", run("2026-10-05", "2026-12-18", "current"));
facts.set("jan", run("2027-01-11", "2027-04-23", "upcoming"));

const sep9 = new Date("2026-09-09T16:00:00Z");
const ctx = {
  user: { institutionId: "inst" },
  displayName: "Ivy",
  sections: [section("jun", "QAJJUN26-01", ""), section("sep", "QAJSEP26-01", "2026F"), section("oct", "QAJOCT26-01", "2026W"), section("jan", "QAJJAN27-02", "2026W")],
  classSessions: [
    { id: "c1", title: "class", startsAt: sep9, endsAt: new Date(sep9.getTime() + 90 * 60_000), location: "Room 1", sectionCode: "QAJSEP26-01", courseCode: "QA-101" },
    { id: "c2", title: "class", startsAt: new Date("2026-08-26T16:00:00Z"), endsAt: null, location: null, sectionCode: "QAJJUN26-01", courseCode: "QA-101" },
  ],
  term: { code: "2026W", name: "2026-2027" },
  terms: [
    { code: "2026F", name: "Fall 2026", startsOn: "2026-09-01", endsOn: "2026-12-20" },
    { code: "2026W", name: "2026-2027", startsOn: "2026-09-01", endsOn: "2027-04-30" },
  ],
};

describe("instructor Course Evaluations", () => {
  it("lists every started section with its own start and end dates", async () => {
    const rows = (await buildHccCourseEvaluations(ctx)).hccEvaluations!.rows;
    expect(rows.map((r) => [r.offering, r.dates])).toEqual([
      ["QAJJUN26-01", "Jun 1, 2026 - Aug 28, 2026"],
      ["QAJSEP26-01", "Sep 8, 2026 - Dec 15, 2026"],
      ["QAJOCT26-01", "Oct 5, 2026 - Dec 18, 2026"],
    ]);
    expect(rows[2]!.schedule).toBe("TBA");
  });
});

describe("instructor Course History", () => {
  it("lists only sections that have ended, with the section's dates rather than the term's", async () => {
    const rows = (await buildHccCourseHistory(ctx)).hccCourseHistory.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ offering: "QAJJUN26-01", dates: "Jun 1, 2026 - Aug 28, 2026", term: "Not assigned" });
  });
});
