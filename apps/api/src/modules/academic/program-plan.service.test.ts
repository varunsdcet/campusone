import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  enrolment: { findMany: vi.fn() },
  institution: { findFirst: vi.fn() },
  term: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
  programPlanItem: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  programPlan: { findFirst: vi.fn(), create: vi.fn() },
  heritageRecord: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import {
  creditWeighted,
  ensureStudentProgramPlan,
  getProgramPlan,
  hasFinalMark,
  planItemFacts,
  planItemRows,
  summarizeCourses,
  weightedPercent,
} from "./program-plan.service.js";

const row = (over: Partial<Parameters<typeof summarizeCourses>[0][number]>) => ({
  status: "enrolled",
  final: true,
  credits: 3,
  letter: "B",
  averagePercent: 75,
  gradePoints: 3,
  countsTowardCgpa: true,
  ...over,
});

describe("course percent", () => {
  it("weights published marks by assessment weight, like the instructor gradebook", () => {
    expect(weightedPercent([{ score: 88, maxScore: 100, weightPercent: 30 }, { score: 50, maxScore: 100, weightPercent: 70 }])).toBe(61.4);
    expect(weightedPercent([{ score: 8, maxScore: 10, weightPercent: 0 }, { score: 6, maxScore: 10, weightPercent: 0 }])).toBe(70);
    expect(weightedPercent([{ score: null, maxScore: 100, weightPercent: 40 }])).toBeNull();
  });

  it("credit-weights course values", () => {
    expect(creditWeighted([{ credits: 3, value: 4 }, { credits: 1, value: 2 }])).toBe(3.5);
    expect(creditWeighted([])).toBeNull();
  });
});

const history = (over: Partial<Parameters<typeof planItemFacts>[1][number]>) => ({
  courseId: "c-1",
  courseCode: "HCA101",
  status: "enrolled",
  courseStatus: "in_progress" as const,
  attemptNumber: 1,
  startsOn: "2026-06-01",
  endsOn: "2026-08-28",
  scheduleText: "Monday: 9:00am - 12:00pm",
  sectionId: "sec-1",
  letter: "—",
  averagePercent: null as number | null,
  ...over,
});

describe("program plan rows", () => {
  it("shows an active enrolment as In Progress with its section's dates and timetable", () => {
    expect(planItemFacts({ courseId: "c-1", courseCode: "HCA101" }, [history({})])).toEqual({
      status: "in_progress",
      startsOn: "2026-06-01",
      endsOn: "2026-08-28",
      scheduleText: "Monday: 9:00am - 12:00pm",
      sectionId: "sec-1",
      grade: null,
    });
  });

  it("shows a course with a final mark as Completed with its grade", () => {
    const f = planItemFacts({ courseId: null, courseCode: "hca101" }, [history({ courseStatus: "completed", averagePercent: 93, letter: "A" })]);
    expect(f).toMatchObject({ status: "completed", grade: "A" });
  });

  it("shows a course with a failing final mark as Failed with its grade", () => {
    const f = planItemFacts({ courseId: "c-1", courseCode: "HCA101" }, [history({ courseStatus: "failed", averagePercent: 40, letter: "F" })]);
    expect(f).toMatchObject({ status: "failed", grade: "F" });
  });

  it("prefers the latest live attempt over a dropped one, and ignores other courses", () => {
    const rows = [history({ courseStatus: "dropped", status: "withdrawn", attemptNumber: 2, sectionId: "sec-old" }), history({ attemptNumber: 1 }), history({ courseId: "c-2", courseCode: "HCA102", sectionId: "sec-2" })];
    expect(planItemFacts({ courseId: "c-1", courseCode: "HCA101" }, rows)?.sectionId).toBe("sec-1");
    expect(planItemFacts({ courseId: "c-9", courseCode: "HCA999" }, rows)).toBeNull();
  });

  it("leaves courses without an enrolment Not Started on the fallback dates", () => {
    const [row] = planItemRows([{ courseId: "c-9", courseCode: "HCA999", title: "Capstone", credits: 3, sortOrder: 4, category: "main" }], [history({})], { startsOn: "2026-01-05", endsOn: "2026-12-18" });
    expect(row).toMatchObject({ status: "not_started", startsOn: "2026-01-05", endsOn: "2026-12-18", scheduleText: null, sectionId: null, sortOrder: 4 });
  });
});

describe("student cohort visibility", () => {
  it("returns the assigned cohort even before a program plan exists", async () => {
    vi.clearAllMocks();
    db.programPlan.findFirst.mockResolvedValue(null);
    db.student.findFirst.mockResolvedValue({
      cohort: { code: "F26-A", label: "Fall 2026", intakeYear: 2026, intakeMonth: 9, sectionLabel: "A" },
    });

    await expect(getProgramPlan("inst-1", "stu-1")).resolves.toMatchObject({
      planId: null,
      status: "missing",
      cohort: { code: "F26-A", label: "Fall 2026", intakeYear: 2026, intakeMonth: 9, sectionLabel: "A" },
    });
  });
});

describe("ensureStudentProgramPlan", () => {
  const requirement = (code: string, i: number) => ({ courseId: `c-${code}`, courseCode: code, title: `${code} title`, credits: 3, sortOrder: i });
  const enrolment = {
    id: "enr-1",
    sectionId: "sec-1",
    status: "enrolled",
    attemptNumber: 1,
    countsTowardCgpa: true,
    continuous: false,
    section: {
      courseId: "c-HCA101",
      code: "HCAJUN20-01",
      instructorPersonId: "p-1",
      course: { code: "HCA101", title: "Foundations", credits: 3 },
      term: { id: "t-f19", code: "2019F", name: "Fall 2019", startsOn: "2019-09-01", endsOn: "2019-12-19" },
      academicBlock: null,
      classSessions: [],
    },
    gradeItems: [{ score: 93, maxScore: 100, letter: null, assignment: { weightPercent: 100 } }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.student.findFirst.mockResolvedValue({ cohortId: null, cohort: null, programVersion: { requirements: [requirement("HCA101", 0), requirement("HCA102", 1)] } });
    db.enrolment.findMany.mockResolvedValue([enrolment]);
    db.institution.findFirst.mockResolvedValue({ timezone: "America/Vancouver" });
    db.term.findMany.mockResolvedValue([enrolment.section.term]);
    db.person.findMany.mockResolvedValue([]);
    db.programPlanItem.findMany.mockResolvedValue([]);
    db.heritageRecord.findMany.mockImplementation(async (args: { where: { screenId: unknown } }) =>
      args.where.screenId === "CM:SESSION" ? [{ contextKey: "sec-1", dataJson: JSON.stringify({ startDate: "2020-06-01", endDate: "2020-08-28", meetings: [{ day: "Monday", start: "09:00", end: "12:00" }] }) }] : [],
    );
    db.$transaction.mockImplementation(async (work: (tx: typeof db) => unknown) => work(db));
    db.programPlan.create.mockResolvedValue({ id: "plan-1" });
  });

  it("creates the plan from the program's requirements with real enrolment status", async () => {
    db.programPlan.findFirst.mockResolvedValue(null);
    await expect(ensureStudentProgramPlan("inst-1", "stu-1")).resolves.toEqual({ planId: "plan-1", created: true });
    const items = db.programPlan.create.mock.calls[0]![0].data.items.create;
    expect(items).toEqual([
      expect.objectContaining({ courseCode: "HCA101", status: "completed", sectionId: "sec-1", startsOn: "2020-06-01", endsOn: "2020-08-28", scheduleText: "Monday: 9:00am - 12:00pm" }),
      expect.objectContaining({ courseCode: "HCA102", status: "not_started", sectionId: null }),
    ]);
  });

  it("is idempotent: updates the existing plan's rows and only adds missing courses", async () => {
    db.programPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      items: [
        { id: "i-1", category: "main", courseId: "c-HCA101", courseCode: "HCA101", status: "not_started", startsOn: null, endsOn: null, scheduleText: null, sectionId: null },
        { id: "i-old", category: "main", courseId: "c-OLD", courseCode: "OLD100", status: "not_started", startsOn: null, endsOn: null, scheduleText: null, sectionId: null },
      ],
    });
    await expect(ensureStudentProgramPlan("inst-1", "stu-1")).resolves.toEqual({ planId: "plan-1", created: false });
    expect(db.programPlan.create).not.toHaveBeenCalled();
    expect(db.programPlanItem.update).toHaveBeenCalledWith({ where: { id: "i-1" }, data: expect.objectContaining({ status: "completed", sectionId: "sec-1" }) });
    expect(db.programPlanItem.create).toHaveBeenCalledTimes(1);
    expect(db.programPlanItem.create.mock.calls[0]![0].data).toMatchObject({ planId: "plan-1", courseCode: "HCA102", status: "not_started" });
    expect(db.programPlanItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["i-old"] }, planId: "plan-1" } });
  });

  it("does nothing without a program version", async () => {
    db.student.findFirst.mockResolvedValue({ cohortId: null, cohort: null, programVersion: null });
    await expect(ensureStudentProgramPlan("inst-1", "stu-1")).resolves.toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("final marks", () => {
  it("treats an enrolled course as final only after it has ended with published marks", () => {
    expect(hasFinalMark({ status: "enrolled", endsOn: "2026-09-30", averagePercent: 80 }, "2026-10-07")).toBe(true);
    expect(hasFinalMark({ status: "enrolled", endsOn: "2026-12-18", averagePercent: 80 }, "2026-10-07")).toBe(false);
    expect(hasFinalMark({ status: "enrolled", endsOn: "2026-09-30", averagePercent: null }, "2026-10-07")).toBe(false);
    expect(hasFinalMark({ status: "completed", endsOn: null, averagePercent: null }, "2026-10-07")).toBe(true);
  });

  it("keeps in-progress, withdrawn and failed courses out of earned credits and CGPA", () => {
    const totals = summarizeCourses([
      row({ credits: 3, gradePoints: 4, averagePercent: 90, letter: "A" }),
      row({ credits: 1, gradePoints: 2, averagePercent: 65, letter: "C" }),
      row({ credits: 3, gradePoints: 0, averagePercent: 40, letter: "F" }),
      row({ status: "enrolled", final: false, credits: 3, letter: "IP", gradePoints: null, averagePercent: 82 }),
      row({ status: "withdrawn", final: false, credits: 3, letter: "W", gradePoints: null, averagePercent: null }),
    ]);
    expect(totals.earnedCredits).toBe(4);
    expect(totals.attemptedCredits).toBe(10);
    expect(totals.cgpa).toBe(Number(((3 * 4 + 1 * 2 + 0) / 7).toFixed(2)));
    expect(totals.averagePercent).toBe(Number(((3 * 90 + 65 + 3 * 40) / 7).toFixed(2)));
    expect(totals.currentAverage).toBe(82);
  });
});
