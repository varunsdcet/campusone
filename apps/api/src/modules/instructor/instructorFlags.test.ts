import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { listInstructorFlags, updateInstructorFlag, validateFlagFields } from "./instructorFlags.js";

const institutionId = "00000000-0000-4000-8000-000000000004";
const instructor = { institutionId, accountId: "acct-instructor", roles: ["instructor" as const] };
const otherInstructor = { institutionId, accountId: "acct-other", roles: ["instructor" as const] };
const admin = { institutionId, accountId: "acct-admin", roles: ["admin" as const] };

const db = {
  heritageRecord: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  student: { findMany: vi.fn() },
};

const flagRecord = {
  id: "flag-1",
  contextKey: "stu-1",
  createdById: "acct-instructor",
  createdAt: new Date("2026-10-06T18:00:00Z"),
  dataJson: JSON.stringify({ name: "ACADEMIC RISK", message: "<p>Missed two quizzes</p>", status: "Active", priority: "High" }),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.heritageRecord.findMany.mockResolvedValue([flagRecord]);
  db.heritageRecord.findFirst.mockResolvedValue(flagRecord);
  db.heritageRecord.update.mockResolvedValue({});
  db.student.findMany.mockResolvedValue([
    { id: "stu-1", studentNumber: "ST-1001", person: { givenName: "QA_I_1010", familyName: "Student1" } },
  ]);
});

describe("validateFlagFields", () => {
  it("rejects an empty form instead of defaulting student, type and note", () => {
    expect(() => validateFlagFields({})).toThrow(/student, flag type, note/);
    try {
      validateFlagFields({ "Student Name": "", "Flag Type": "", Description: "  " });
    } catch (err) {
      expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    }
  });

  it("names only the missing fields", () => {
    expect(() => validateFlagFields({ "Student Name": "QA_I_1010 Student1 · ST-1001", "Flag Type": "ACADEMIC RISK" })).toThrow(
      "Enter the note for this flag",
    );
  });

  it("normalises a complete submission and defaults priority to Medium", () => {
    expect(
      validateFlagFields({ "Student Name": " QA_I_1010 Student1 ", "Flag Type": "attendance concern", Description: "Absent 3 weeks" }),
    ).toEqual({ student: "QA_I_1010 Student1", flagType: "ATTENDANCE CONCERN", note: "Absent 3 weeks", priority: "Medium" });
  });

  it("rejects an unknown priority and an oversized note", () => {
    const base = { "Student Name": "S", "Flag Type": "ACADEMIC RISK", Description: "n" };
    expect(() => validateFlagFields({ ...base, Priority: "Urgent" })).toThrow(/priority/);
    expect(() => validateFlagFields({ ...base, Description: "x".repeat(2001) })).toThrow(/2000/);
  });
});

describe("listInstructorFlags", () => {
  it("lists only flags the instructor raised, with student name and editable rows", async () => {
    const rows = await listInstructorFlags(instructor, db as never);
    expect(db.heritageRecord.findMany.mock.calls[0]![0].where).toMatchObject({
      institutionId,
      screenId: "STU:FLAG",
      deletedAt: null,
      createdById: "acct-instructor",
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "flag-1",
        student: "QA_I_1010 Student1 · ST-1001",
        description: "ACADEMIC RISK — Missed two quizzes",
        status: "Active",
        resolved: "No",
        date: "2026-10-06",
        canEdit: true,
        href: "/instructor/f/t22-student-detail-full-page?studentId=stu-1",
      }),
    ]);
  });

  it("does not scope admins to their own flags", async () => {
    await listInstructorFlags(admin, db as never);
    expect(db.heritageRecord.findMany.mock.calls[0]![0].where).not.toHaveProperty("createdById");
  });
});

describe("updateInstructorFlag", () => {
  it("dismisses a flag the instructor created", async () => {
    await expect(updateInstructorFlag(instructor, "flag-1", "dismiss", db as never)).resolves.toEqual({ id: "flag-1", dismissed: true });
    const data = JSON.parse(db.heritageRecord.update.mock.calls[0]![0].data.dataJson);
    expect(data).toMatchObject({ status: "Dismissed", resolved: "Yes", message: "<p>Missed two quizzes</p>" });
  });

  it("soft-deletes on delete", async () => {
    await updateInstructorFlag(instructor, "flag-1", "delete", db as never);
    expect(db.heritageRecord.update.mock.calls[0]![0].data).toMatchObject({ status: "deleted", deletedAt: expect.any(Date) });
  });

  it("forbids changing another instructor's flag", async () => {
    await expect(updateInstructorFlag(otherInstructor, "flag-1", "delete", db as never)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(db.heritageRecord.update).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or already deleted flag", async () => {
    db.heritageRecord.findFirst.mockResolvedValue(null);
    await expect(updateInstructorFlag(instructor, "missing", "dismiss", db as never)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
