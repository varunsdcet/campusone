import { randomUUID } from "node:crypto";
import type { Prisma } from "@myheritage/db";
import { hmIn, ymdIn, zonedToUtc } from "../../lib/workshopPolicy.js";

export type AttendanceMark = { studentId: string; sectionId: string; status: string; note?: string };
export type AttendanceSectionRef = { id: string; code: string; courseCode: string };

type Tx = Pick<Prisma.TransactionClient, "classSession" | "attendanceRecord">;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 500;

/** Class session the section met on `dateIso` (institution wall clock); one is created at the section's usual start time when none exists. */
export async function ensureAttendanceClassSession(
  tx: Tx,
  input: { institutionId: string; section: AttendanceSectionRef; dateIso: string; tz: string },
) {
  const { institutionId, section, dateIso, tz } = input;
  if (!ISO.test(dateIso)) throw Object.assign(new Error("Choose a valid attendance date"), { status: 400, code: "VALIDATION_ERROR" });
  const dayStart = zonedToUtc(dateIso, "00:00", tz);
  const windowStart = new Date(dayStart.getTime() - 36 * 3600_000);
  const windowEnd = new Date(dayStart.getTime() + 60 * 3600_000);
  const nearby = await tx.classSession.findMany({
    where: { institutionId, sectionId: section.id, startsAt: { gte: windowStart, lt: windowEnd } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true },
  });
  const sameDay = nearby.find((s) => ymdIn(s.startsAt, tz) === dateIso);
  if (sameDay) return sameDay.id;

  const usual = await tx.classSession.findFirst({
    where: { institutionId, sectionId: section.id },
    orderBy: { startsAt: "desc" },
    select: { startsAt: true, endsAt: true, location: true, deliveryMode: true },
  });
  const startTime = usual ? hmIn(usual.startsAt, tz) : "09:00";
  const startsAt = zonedToUtc(dateIso, startTime, tz);
  const durationMs = usual?.endsAt ? usual.endsAt.getTime() - usual.startsAt.getTime() : 0;
  const created = await tx.classSession.create({
    data: {
      id: randomUUID(),
      institutionId,
      sectionId: section.id,
      title: `${section.courseCode} ${section.code} class`.trim(),
      startsAt,
      endsAt: durationMs > 0 ? new Date(startsAt.getTime() + durationMs) : null,
      location: usual?.location ?? null,
      deliveryMode: usual?.deliveryMode ?? "in_person",
      sessionKind: "lecture",
    },
    select: { id: true },
  });
  return created.id;
}

/** Replaces the day's attendance rows for each marked student, keeping the note and linking every row to that day's class session. */
export async function writeAttendanceRecords(
  tx: Tx,
  input: { institutionId: string; meetingLabel: string; tz: string; sections: AttendanceSectionRef[]; marks: AttendanceMark[] },
) {
  const { institutionId, meetingLabel, tz } = input;
  const marked = input.marks.filter((m) => m.status.trim());
  const sectionById = new Map(input.sections.map((s) => [s.id, s]));
  const sessionBySection = new Map<string, string>();
  let written = 0;
  for (const row of marked) {
    const section = sectionById.get(row.sectionId);
    if (!section) {
      throw Object.assign(new Error("Attendance refers to a course section you do not teach"), { status: 403, code: "FORBIDDEN" });
    }
    let classSessionId = sessionBySection.get(section.id);
    if (!classSessionId) {
      classSessionId = await ensureAttendanceClassSession(tx, { institutionId, section, dateIso: meetingLabel, tz });
      sessionBySection.set(section.id, classSessionId);
    }
    await tx.attendanceRecord.deleteMany({
      where: { institutionId, studentId: row.studentId, sectionId: row.sectionId, meetingLabel },
    });
    await tx.attendanceRecord.create({
      data: {
        id: randomUUID(),
        institutionId,
        studentId: row.studentId,
        sectionId: row.sectionId,
        classSessionId,
        meetingLabel,
        status: row.status.trim().toLowerCase(),
        note: (row.note ?? "").trim().slice(0, NOTE_MAX),
      },
    });
    written += 1;
  }
  return { written, classSessionIds: Object.fromEntries(sessionBySection) };
}

/**
 * The attendance page shows a student's submitted record over any draft, so a draft edit to an
 * already-submitted student is written to that record; only students without a record stay in the draft.
 */
export async function applyDraftToSubmittedAttendance(
  tx: Tx,
  input: { institutionId: string; meetingLabel: string; tz: string; sections: AttendanceSectionRef[]; marks: AttendanceMark[] },
) {
  const { institutionId, meetingLabel } = input;
  const sectionIds = input.sections.map((s) => s.id);
  const existing = sectionIds.length
    ? await tx.attendanceRecord.findMany({
        where: { institutionId, sectionId: { in: sectionIds }, meetingLabel },
        select: { studentId: true, sectionId: true },
      })
    : [];
  const submitted = new Set(existing.map((r) => `${r.sectionId}:${r.studentId}`));
  const edits = input.marks.filter((m) => m.status.trim() && submitted.has(`${m.sectionId}:${m.studentId}`));
  const { written } = edits.length ? await writeAttendanceRecords(tx, { ...input, marks: edits }) : { written: 0 };
  return { submittedCount: submitted.size, updated: written };
}
