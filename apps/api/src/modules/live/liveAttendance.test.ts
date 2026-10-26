import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  heritageRecord: { findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  attendanceRecord: { findFirst: vi.fn(), create: vi.fn() },
  classSession: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../lib/workshopPolicy.js", () => ({
  institutionTimezone: vi.fn(async () => "UTC"),
  ymdIn: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
  hmIn: vi.fn(() => "09:00"),
  zonedToUtc: vi.fn((date: string, time: string) => new Date(`${date}T${time}:00Z`)),
}));

import { applyAutomaticAttendance, livePresenceCount } from "./liveAttendance.js";

const section = { id: "section-1", code: "01", course: { code: "BUS101" } };
const now = new Date("2026-10-13T10:00:00.000Z");
const row = (studentId: string, joinedAt: string, rowVersion = 1, lastJoinedAt = joinedAt) => ({
  row: { id: `presence-${studentId}`, rowVersion },
  data: { sectionId: section.id, studentId, accountId: `account-${studentId}`, provider: "jitsi", joinedAt, lastJoinedAt },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.heritageRecord.updateMany.mockResolvedValue({ count: 1 });
  db.attendanceRecord.findFirst.mockResolvedValue(null);
  db.attendanceRecord.create.mockResolvedValue({});
  db.classSession.findMany.mockResolvedValue([{ id: "class-session", startsAt: new Date("2026-10-13T09:00:00.000Z") }]);
});

describe("automatic live attendance", () => {
  it("marks present after 30 minutes and records the automatic source", async () => {
    const old = row("student-1", "2026-10-13T09:29:00.000Z", 1, "2026-10-13T09:59:30.000Z");
    db.heritageRecord.findMany.mockResolvedValue([{ ...old.row, dataJson: JSON.stringify(old.data) }]);
    await expect(applyAutomaticAttendance("institution-1", section, now)).resolves.toBe(1);
    expect(db.attendanceRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId: "student-1", status: "present", note: "Automatic: 30-minute live-class threshold" }),
    });
  });

  it("never overwrites an existing faculty mark", async () => {
    const old = row("student-1", "2026-10-13T09:00:00.000Z", 1, "2026-10-13T09:59:30.000Z");
    db.heritageRecord.findMany.mockResolvedValue([{ ...old.row, dataJson: JSON.stringify(old.data) }]);
    db.attendanceRecord.findFirst.mockResolvedValue({ id: "manual-absent" });
    await expect(applyAutomaticAttendance("institution-1", section, now)).resolves.toBe(0);
    expect(db.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it("counts joined students only, not the full enrolment roster", async () => {
    const recent = row("student-1", "2026-10-13T09:45:00.000Z", 1, "2026-10-13T09:59:30.000Z");
    const expired = row("student-2", "2026-10-13T04:00:00.000Z");
    db.heritageRecord.findMany.mockResolvedValue([
      { ...recent.row, dataJson: JSON.stringify(recent.data) },
      { ...expired.row, dataJson: JSON.stringify(expired.data) },
    ]);
    await expect(livePresenceCount("institution-1", section.id, now)).resolves.toBe(1);
  });

  it("does not auto-mark a learner whose room heartbeat stopped", async () => {
    const stale = row("student-1", "2026-10-13T09:00:00.000Z", 1, "2026-10-13T09:55:00.000Z");
    db.heritageRecord.findMany.mockResolvedValue([{ ...stale.row, dataJson: JSON.stringify(stale.data) }]);
    await expect(applyAutomaticAttendance("institution-1", section, now)).resolves.toBe(0);
    expect(db.attendanceRecord.create).not.toHaveBeenCalled();
  });
});
