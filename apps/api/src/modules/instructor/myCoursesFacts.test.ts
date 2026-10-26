import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  section: { findMany: vi.fn() },
  heritageRecord: { findMany: vi.fn() },
  institution: { findFirst: vi.fn() },
  term: { findMany: vi.fn() },
}));
vi.mock("@myheritage/db", () => ({ prisma: db }));

import type { Offering } from "../courses/sectionOffering.js";
import { loadSectionTerms, sectionRunFacts } from "./myCoursesFacts.js";

const tz = "America/Vancouver";
const term = { startsOn: "2026-09-01", endsOn: "2026-12-20" };

function offering(patch: Partial<Offering>): Offering {
  return {
    startsOn: null,
    endsOn: null,
    continuous: false,
    meetings: [],
    scheduleText: null,
    campus: null,
    room: null,
    location: null,
    deliveryMethod: null,
    deliveryMode: "in_person",
    ...patch,
  };
}

const sessions = [
  { startsAt: new Date("2026-09-09T16:00:00Z"), endsAt: new Date("2026-09-09T17:30:00Z"), deliveryMode: "in_person" },
  { startsAt: new Date("2026-09-16T16:00:00Z"), endsAt: new Date("2026-09-16T17:30:00Z"), deliveryMode: "in_person" },
];

describe("sectionRunFacts", () => {
  it("uses the offering's start/end dates and delivery over class sessions", () => {
    const facts = sectionRunFacts(
      { term, academicBlock: null, classSessions: sessions },
      offering({ startsOn: "2026-09-08", endsOn: "2026-12-15", deliveryMethod: "Online", deliveryMode: "online" }),
      tz,
      "2026-10-07",
    );
    expect(facts).toEqual({ startsOn: "2026-09-08", endsOn: "2026-12-15", delivery: "Online", timing: "current" });
  });

  it("falls back to the first and last class session dates", () => {
    const facts = sectionRunFacts({ term: null, academicBlock: null, classSessions: sessions }, undefined, tz, "2026-10-07");
    expect(facts).toMatchObject({ startsOn: "2026-09-09", endsOn: "2026-09-16", delivery: "In person", timing: "ended" });
  });

  it("is upcoming before the section starts, even inside the latest term", () => {
    const facts = sectionRunFacts(
      { term, academicBlock: null, classSessions: [] },
      offering({ startsOn: "2027-01-11", endsOn: "2027-04-20" }),
      tz,
      "2026-10-07",
    );
    expect(facts.timing).toBe("upcoming");
  });

  it("keeps a continuous offering open-ended", () => {
    const facts = sectionRunFacts(
      { term, academicBlock: null, classSessions: [] },
      offering({ startsOn: "2026-09-08", continuous: true }),
      tz,
      "2027-02-01",
    );
    expect(facts).toMatchObject({ startsOn: "2026-09-08", endsOn: null, timing: "current" });
  });

  it("has no timing when nothing dates the section", () => {
    expect(sectionRunFacts({ term: null, academicBlock: null, classSessions: [] }, undefined, tz, "2026-10-07").timing).toBeNull();
  });
});

describe("loadSectionTerms", () => {
  const fall25 = { id: "t25", code: "2025F", name: "Fall 2025", startsOn: "2025-09-01", endsOn: "2025-12-20" };
  const fall26 = { id: "t26", code: "2026F", name: "Fall 2026", startsOn: "2026-09-01", endsOn: "2026-12-20" };

  it("labels a section by the term covering its run dates, not its stored fallback term", async () => {
    db.institution.findFirst.mockResolvedValue({ timezone: tz });
    db.term.findMany.mockResolvedValue([fall25, fall26]);
    db.heritageRecord.findMany.mockImplementation(async ({ where }: { where: { screenId: unknown } }) =>
      where.screenId === "CM:SESSION"
        ? [
            { contextKey: "jun", dataJson: JSON.stringify({ startDate: "2026-06-01", endDate: "2026-08-28" }) },
            { contextKey: "sep", dataJson: JSON.stringify({ startDate: "2026-09-08", endDate: "2026-12-15" }) },
          ]
        : [],
    );
    db.section.findMany.mockResolvedValue([
      { id: "jun", term: fall25, academicBlock: null, classSessions: [] },
      { id: "sep", term: fall25, academicBlock: null, classSessions: [] },
      { id: "old", term: fall25, academicBlock: null, classSessions: [] },
    ]);
    const terms = await loadSectionTerms("inst", [
      { id: "jun", term: fall25 },
      { id: "sep", term: fall25 },
      { id: "old", term: fall25 },
    ]);
    expect(terms.get("jun")).toBeNull();
    expect(terms.get("sep")).toBe(fall26);
    expect(terms.get("old")).toBe(fall25);
  });
});
