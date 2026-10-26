import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { meetingsFromWeekly, sectionRemovalBlockers } from "./programs.sections.js";
import { ENTITIES } from "./programs.spec.js";
import { defaultRateCategory } from "./students.js";

describe("program session timetable", () => {
  it("turns the master-schedule weekly grid into section meetings, skipping days without both times", () => {
    expect(meetingsFromWeekly({ Wednesday: { start: "13:00", end: "15:00" }, Monday: { start: "09:00", end: "12:00" }, Friday: { start: "09:00", end: "" } })).toEqual([
      { day: "Monday", start: "09:00", end: "12:00" },
      { day: "Wednesday", start: "13:00", end: "15:00" },
    ]);
    expect(meetingsFromWeekly(null)).toEqual([]);
  });

  it("offers independent morning, afternoon and evening batch periods", () => {
    const field = ENTITIES.sessions.fields.find((item) => item.key === "classPeriod");
    expect(field?.options).toEqual(["Morning", "Afternoon", "Evening", "Flexible"]);
  });

  it("offers multi-faculty assignment while creating or editing a program", () => {
    const field = ENTITIES.programs.fields.find((item) => item.key === "instructors");
    expect(field).toMatchObject({ label: "Faculty Members (Multiple Select)", kind: "people", dflt: [], section: "Program Chair & Lead Accesses" });
  });

  it("offers multi-faculty assignment while creating or editing a section", () => {
    const field = ENTITIES.sessions.fields.find((item) => item.key === "instructors");
    expect(field).toMatchObject({ label: "Faculty Members (Multiple Select)", kind: "people", dflt: [], section: "Session Instruction & Accesses" });
  });
});

const emptyUsage = () => ({
  enrolments: 0,
  assignments: 0,
  assessments: 0,
  attendanceRecords: 0,
  dayBlocks: 0,
  folders: 0,
  syllabusTopics: 0,
  classSessions: [] as Array<{ title: string; attendanceRecords: number; labNotebookEntries: number }>,
});

describe("master schedule linked-section deletion", () => {
  it("allows an unused section with only disposable generated class sessions", () => {
    const usage = emptyUsage();
    usage.classSessions.push({ title: "CS101 CS101-01 class", attendanceRecords: 0, labNotebookEntries: 0 });

    expect(sectionRemovalBlockers(usage, "CS101 CS101-01 class")).toEqual([]);
  });

  it("blocks deletion when academic records depend on the section", () => {
    const usage = emptyUsage();
    usage.enrolments = 2;
    usage.assignments = 1;
    usage.attendanceRecords = 3;

    expect(sectionRemovalBlockers(usage, "CS101 CS101-01 class")).toEqual([
      "2 student enrolments",
      "1 assignment",
      "3 attendance records",
    ]);
  });

  it("blocks manual class sessions and generated sessions carrying lab work", () => {
    const usage = emptyUsage();
    usage.classSessions.push(
      { title: "Guest lecture", attendanceRecords: 0, labNotebookEntries: 0 },
      { title: "CS101 CS101-01 class", attendanceRecords: 0, labNotebookEntries: 1 },
    );

    expect(sectionRemovalBlockers(usage, "CS101 CS101-01 class")).toEqual(["2 protected class sessions"]);
  });
});

describe("rate category default", () => {
  it("defaults Rate Category / Fee Status from residency", () => {
    expect(defaultRateCategory({ residency: "international" })).toBe("International");
    expect(defaultRateCategory({ residency: "Domestic" })).toBe("Domestic");
    expect(defaultRateCategory({})).toBe("");
  });
});
