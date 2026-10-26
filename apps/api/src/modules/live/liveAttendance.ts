import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { institutionTimezone, ymdIn } from "../../lib/workshopPolicy.js";
import { ensureAttendanceClassSession } from "../instructor/attendanceSessions.js";

const PRESENCE_SCREEN = "LIVE:PRESENCE";
const PRESENCE_SINGLETON = "current";
/** A learner is "currently attending" only while the in-app Jitsi room is sending heartbeats. */
export const PRESENCE_FRESH_MS = 90 * 1000;
export const AUTO_ATTENDANCE_MINUTES = 30;

type Presence = {
  sectionId: string;
  studentId: string;
  accountId: string;
  provider: "bigbluebutton" | "jitsi";
  joinedAt: string;
  lastJoinedAt: string;
  autoMarkedOn?: string;
};

function parse(value: string): Presence | null {
  try {
    const data = JSON.parse(value) as Presence;
    return data && data.sectionId && data.studentId && data.joinedAt ? data : null;
  } catch {
    return null;
  }
}

/** Records an enrolled student's real live-room join without counting the whole roster as present. */
export async function recordLiveJoin(
  user: SessionClaims,
  input: { sectionId: string; studentId: string; provider: "bigbluebutton" | "jitsi" },
) {
  const now = new Date();
  const contextKey = `${input.sectionId}:${input.studentId}`;
  const current = await prisma.heritageRecord.findUnique({
    where: {
      institutionId_screenId_contextKey_singletonKey: {
        institutionId: user.institutionId,
        screenId: PRESENCE_SCREEN,
        contextKey,
        singletonKey: PRESENCE_SINGLETON,
      },
    },
  });
  const previous = current ? parse(current.dataJson) : null;
  const previousHeartbeat = previous ? new Date(previous.lastJoinedAt || previous.joinedAt) : null;
  const joinedAt =
    previous && previousHeartbeat && now.getTime() - previousHeartbeat.getTime() < PRESENCE_FRESH_MS
      ? previous.joinedAt
      : now.toISOString();
  const data: Presence = {
    sectionId: input.sectionId,
    studentId: input.studentId,
    accountId: user.accountId,
    provider: input.provider,
    joinedAt,
    lastJoinedAt: now.toISOString(),
    ...(joinedAt === previous?.joinedAt && previous.autoMarkedOn ? { autoMarkedOn: previous.autoMarkedOn } : {}),
  };
  await prisma.heritageRecord.upsert({
    where: {
      institutionId_screenId_contextKey_singletonKey: {
        institutionId: user.institutionId,
        screenId: PRESENCE_SCREEN,
        contextKey,
        singletonKey: PRESENCE_SINGLETON,
      },
    },
    create: {
      institutionId: user.institutionId,
      screenId: PRESENCE_SCREEN,
      contextKey,
      singletonKey: PRESENCE_SINGLETON,
      dataJson: JSON.stringify(data),
      createdById: user.accountId,
      updatedById: user.accountId,
    },
    update: { dataJson: JSON.stringify(data), deletedAt: null, updatedById: user.accountId, rowVersion: { increment: 1 } },
  });
}

async function presenceRows(institutionId: string, sectionId: string) {
  const rows = await prisma.heritageRecord.findMany({
    where: {
      institutionId,
      screenId: PRESENCE_SCREEN,
      contextKey: { startsWith: `${sectionId}:` },
      singletonKey: PRESENCE_SINGLETON,
      deletedAt: null,
    },
  });
  return rows.flatMap((row) => {
    const data = parse(row.dataJson);
    return data?.sectionId === sectionId ? [{ row, data }] : [];
  });
}

export async function livePresenceCount(institutionId: string, sectionId: string, now = new Date()) {
  const since = now.getTime() - PRESENCE_FRESH_MS;
  const rows = await presenceRows(institutionId, sectionId);
  return new Set(rows.filter(({ data }) => new Date(data.lastJoinedAt || data.joinedAt).getTime() >= since).map(({ data }) => data.studentId)).size;
}

/**
 * Automatic marks only fill an empty attendance slot. Any faculty-entered mark or correction is authoritative
 * and is deliberately never replaced by this sweep.
 */
export async function applyAutomaticAttendance(
  institutionId: string,
  section: { id: string; code: string; course: { code: string } },
  now = new Date(),
) {
  const tz = await institutionTimezone(institutionId);
  const meetingLabel = ymdIn(now, tz);
  const threshold = now.getTime() - AUTO_ATTENDANCE_MINUTES * 60_000;
  const rows = await presenceRows(institutionId, section.id);
  let created = 0;
  for (const { row, data } of rows) {
    const lastSeen = new Date(data.lastJoinedAt || data.joinedAt).getTime();
    if (data.autoMarkedOn === meetingLabel || new Date(data.joinedAt).getTime() > threshold || lastSeen < now.getTime() - PRESENCE_FRESH_MS) continue;
    const existing = await prisma.attendanceRecord.findFirst({
      where: { institutionId, sectionId: section.id, studentId: data.studentId, meetingLabel },
      select: { id: true },
    });
    const claimed: Presence = { ...data, autoMarkedOn: meetingLabel };
    const claim = await prisma.heritageRecord.updateMany({
      where: { id: row.id, rowVersion: row.rowVersion },
      data: { dataJson: JSON.stringify(claimed), updatedById: data.accountId, rowVersion: { increment: 1 } },
    });
    if (!claim.count || existing) continue;
    const classSessionId = await ensureAttendanceClassSession(prisma, {
      institutionId,
      section: { id: section.id, code: section.code, courseCode: section.course.code },
      dateIso: meetingLabel,
      tz,
    });
    await prisma.attendanceRecord.create({
      data: {
        institutionId,
        sectionId: section.id,
        studentId: data.studentId,
        classSessionId,
        meetingLabel,
        status: "present",
        note: `Automatic: ${AUTO_ATTENDANCE_MINUTES}-minute live-class threshold`,
      },
    });
    created += 1;
  }
  return created;
}
