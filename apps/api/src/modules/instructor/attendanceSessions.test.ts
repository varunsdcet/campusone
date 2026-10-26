import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { applyDraftToSubmittedAttendance, ensureAttendanceClassSession, writeAttendanceRecords } from "./attendanceSessions.js";

const institutionId = "00000000-0000-4000-8000-000000000004";
const tz = "America/Vancouver";
const sectionA = { id: "70d5a076-c10e-41ce-aee6-1ba4ff374035", code: "QAI1010A-01", courseCode: "QAI1010A" };
const sectionB = { id: "1caa169d-d2e4-4f91-8a1f-eb1d1689eeff", code: "QAI1010B-01", courseCode: "QAI1010B" };

const tx = {
  classSession: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  attendanceRecord: { deleteMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.classSession.findMany.mockResolvedValue([]);
  tx.classSession.findFirst.mockResolvedValue(null);
  tx.classSession.create.mockImplementation(async ({ data }: { data: { sectionId: string } }) => ({ id: `session-${data.sectionId}` }));
  tx.attendanceRecord.deleteMany.mockResolvedValue({ count: 0 });
  tx.attendanceRecord.create.mockResolvedValue({});
  tx.attendanceRecord.findMany.mockResolvedValue([]);
});

describe("ensureAttendanceClassSession", () => {
  it("reuses the section's class session on that local date", async () => {
    tx.classSession.findMany.mockResolvedValue([
      { id: "previous-day", startsAt: new Date("2026-10-05T16:00:00Z") },
      { id: "same-day", startsAt: new Date("2026-10-06T16:00:00Z") },
    ]);
    const id = await ensureAttendanceClassSession(tx as never, { institutionId, section: sectionA, dateIso: "2026-10-06", tz });
    expect(id).toBe("same-day");
    expect(tx.classSession.create).not.toHaveBeenCalled();
  });

  it("matches by institution wall clock, not UTC date", async () => {
    tx.classSession.findMany.mockResolvedValue([{ id: "evening", startsAt: new Date("2026-10-07T02:30:00Z") }]);
    const id = await ensureAttendanceClassSession(tx as never, { institutionId, section: sectionA, dateIso: "2026-10-06", tz });
    expect(id).toBe("evening");
  });

  it("creates a session at the section's usual start time when none exists", async () => {
    tx.classSession.findFirst.mockResolvedValue({
      startsAt: new Date("2026-09-29T17:30:00Z"),
      endsAt: new Date("2026-09-29T19:00:00Z"),
      location: "Room 204",
      deliveryMode: "in_person",
    });
    const id = await ensureAttendanceClassSession(tx as never, { institutionId, section: sectionA, dateIso: "2026-10-06", tz });
    expect(id).toBe(`session-${sectionA.id}`);
    const data = tx.classSession.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ institutionId, sectionId: sectionA.id, location: "Room 204", sessionKind: "lecture" });
    expect((data.startsAt as Date).toISOString()).toBe("2026-10-06T17:30:00.000Z");
    expect((data.endsAt as Date).toISOString()).toBe("2026-10-06T19:00:00.000Z");
  });

  it("rejects an invalid date", async () => {
    await expect(
      ensureAttendanceClassSession(tx as never, { institutionId, section: sectionA, dateIso: "06/10/2026", tz }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("writeAttendanceRecords", () => {
  it("saves the note and links every row to the day's class session", async () => {
    const result = await writeAttendanceRecords(tx as never, {
      institutionId,
      meetingLabel: "2026-10-06",
      tz,
      sections: [sectionA, sectionB],
      marks: [
        { studentId: "student-1", sectionId: sectionA.id, status: "Present", note: "  On time  " },
        { studentId: "student-2", sectionId: sectionA.id, status: "Absent", note: "QA_I_1010 sick note" },
        { studentId: "student-1", sectionId: sectionB.id, status: "Late" },
        { studentId: "student-3", sectionId: sectionB.id, status: "" },
      ],
    });

    expect(result.written).toBe(3);
    expect(tx.classSession.create).toHaveBeenCalledTimes(2);
    const rows = tx.attendanceRecord.create.mock.calls.map((c) => c[0].data);
    expect(rows).toEqual([
      expect.objectContaining({ studentId: "student-1", sectionId: sectionA.id, status: "present", note: "On time", classSessionId: `session-${sectionA.id}`, meetingLabel: "2026-10-06" }),
      expect.objectContaining({ studentId: "student-2", sectionId: sectionA.id, status: "absent", note: "QA_I_1010 sick note", classSessionId: `session-${sectionA.id}` }),
      expect.objectContaining({ studentId: "student-1", sectionId: sectionB.id, status: "late", note: "", classSessionId: `session-${sectionB.id}` }),
    ]);
    expect(tx.attendanceRecord.deleteMany).toHaveBeenCalledWith({
      where: { institutionId, studentId: "student-2", sectionId: sectionA.id, meetingLabel: "2026-10-06" },
    });
  });

  it("refuses rows for a section the instructor does not teach", async () => {
    await expect(
      writeAttendanceRecords(tx as never, {
        institutionId,
        meetingLabel: "2026-10-06",
        tz,
        sections: [sectionA],
        marks: [{ studentId: "student-9", sectionId: "77777777-7777-4777-8777-777777777701", status: "Present" }],
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
  });
});

describe("applyDraftToSubmittedAttendance", () => {
  const input = { institutionId, meetingLabel: "2026-10-06", tz, sections: [sectionA, sectionB] };

  it("leaves a day with no submitted records to the draft", async () => {
    const result = await applyDraftToSubmittedAttendance(tx as never, {
      ...input,
      marks: [{ studentId: "student-1", sectionId: sectionA.id, status: "Present", note: "draft" }],
    });
    expect(result).toEqual({ submittedCount: 0, updated: 0 });
    expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it("writes edits for already-submitted students to their records and skips the rest", async () => {
    tx.attendanceRecord.findMany.mockResolvedValue([{ studentId: "student-1", sectionId: sectionA.id }]);
    const result = await applyDraftToSubmittedAttendance(tx as never, {
      ...input,
      marks: [
        { studentId: "student-1", sectionId: sectionA.id, status: "Present", note: "Arrived with doctor's note" },
        { studentId: "student-2", sectionId: sectionA.id, status: "Absent" },
        { studentId: "student-1", sectionId: sectionB.id, status: "Late" },
      ],
    });
    expect(result).toEqual({ submittedCount: 1, updated: 1 });
    expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith({
      where: { institutionId, sectionId: { in: [sectionA.id, sectionB.id] }, meetingLabel: "2026-10-06" },
      select: { studentId: true, sectionId: true },
    });
    const rows = tx.attendanceRecord.create.mock.calls.map((c) => c[0].data);
    expect(rows).toEqual([
      expect.objectContaining({ studentId: "student-1", sectionId: sectionA.id, status: "present", note: "Arrived with doctor's note" }),
    ]);
  });
});
