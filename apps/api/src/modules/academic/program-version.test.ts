import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn(), update: vi.fn() },
  heritageRecord: { findMany: vi.fn() },
  program: { findFirst: vi.fn(), findMany: vi.fn() },
  programVersion: { findFirst: vi.fn(), create: vi.fn() },
  course: { findMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import { ensureProgramVersion, knownProgramName } from "./program-version.js";

const rec = (id: string, contextKey: string, data: Record<string, unknown>) => ({ id, contextKey, createdAt: new Date("2026-09-01T00:00:00Z"), dataJson: JSON.stringify(data) });

const store: Record<string, ReturnType<typeof rec>[]> = {
  "PM:PROGRAM": [rec("pm-prog", "fac-1", { name: "Practical Nursing", abbreviation: "PN", _prismaId: "prog-1" })],
  "STU:ENROL": [rec("enrol-1", "stu-1", { programId: "pm-prog", program: "Practical Nursing" })],
  "PM:PATHWAY": [rec("path-minor", "pm-prog", { type: "Minor", name: "Minor", abbreviation: "MIN", status: "Active" }), rec("path-main", "pm-prog", { type: "Major", name: "Main", abbreviation: "PN-2026", status: "Active", defaultOutline: true })],
  "PM:PATHWAY_COURSE": [rec("pc-2", "path-main", { course: "c-2", _order: 2 }), rec("pc-1", "path-main", { course: "c-1", _order: 1 }), rec("pc-x", "path-minor", { course: "c-9" })],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.heritageRecord.findMany.mockImplementation(async ({ where }: { where: { screenId: string; contextKey?: string } }) =>
    (store[where.screenId] ?? []).filter((r) => where.contextKey === undefined || r.contextKey === where.contextKey),
  );
  db.student.findFirst.mockResolvedValue({ id: "stu-1", programName: "Practical Nursing", programVersionId: null, programVersion: null, cohort: null });
  db.programVersion.findFirst.mockResolvedValue(null);
  db.programVersion.create.mockResolvedValue({ id: "pv-new" });
  db.course.findMany.mockResolvedValue([
    { id: "c-1", code: "PN101", title: "Foundations", credits: 3 },
    { id: "c-2", code: "PN102", title: "Clinical Practice", credits: 4 },
  ]);
});

describe("ensureProgramVersion", () => {
  it("builds a program version from the default pathway outline of the student's enrolled program and links it", async () => {
    await expect(ensureProgramVersion("inst-1", "stu-1")).resolves.toBe("pv-new");
    expect(db.programVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        programId: "prog-1",
        label: "PN-2026",
        totalCredits: 7,
        requirements: {
          create: [
            expect.objectContaining({ courseId: "c-1", courseCode: "PN101", credits: 3, sortOrder: 0 }),
            expect.objectContaining({ courseId: "c-2", courseCode: "PN102", credits: 4, sortOrder: 1 }),
          ],
        },
      }),
    });
    expect(db.student.update).toHaveBeenCalledWith({ where: { id: "stu-1" }, data: expect.objectContaining({ programVersionId: "pv-new" }) });
  });

  it("links the program's existing active version instead of creating one", async () => {
    db.programVersion.findFirst.mockResolvedValueOnce({ id: "pv-active" });
    await expect(ensureProgramVersion("inst-1", "stu-1")).resolves.toBe("pv-active");
    expect(db.programVersion.create).not.toHaveBeenCalled();
    expect(db.student.update).toHaveBeenCalledWith({ where: { id: "stu-1" }, data: expect.objectContaining({ programVersionId: "pv-active" }) });
  });

  it("keeps an assigned version unless asked to relink", async () => {
    db.student.findFirst.mockResolvedValue({ id: "stu-1", programName: "Practical Nursing", programVersionId: "pv-old", programVersion: { programId: "prog-old" }, cohort: null });
    await expect(ensureProgramVersion("inst-1", "stu-1")).resolves.toBe("pv-old");
    expect(db.student.update).not.toHaveBeenCalled();
    await expect(ensureProgramVersion("inst-1", "stu-1", { relink: true })).resolves.toBe("pv-new");
  });
});

describe("knownProgramName", () => {
  beforeEach(() => {
    db.program.findMany.mockResolvedValue([{ code: "HCA", name: "Health Care Assistant" }]);
  });

  it("returns the canonical name for a program name, code or Program Management abbreviation", async () => {
    await expect(knownProgramName("inst-1", "  health care assistant ")).resolves.toBe("Health Care Assistant");
    await expect(knownProgramName("inst-1", "hca")).resolves.toBe("Health Care Assistant");
    await expect(knownProgramName("inst-1", "PN")).resolves.toBe("Practical Nursing");
  });

  it("rejects an unknown program with a 400", async () => {
    await expect(knownProgramName("inst-1", "Helth Care Asistant")).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Helth Care Asistant") });
  });

  it("accepts any name when the institution has no programs yet", async () => {
    db.program.findMany.mockResolvedValue([]);
    db.heritageRecord.findMany.mockResolvedValue([]);
    await expect(knownProgramName("inst-1", "General Studies")).resolves.toBe("General Studies");
  });
});
