import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { isSafeLink } from "../../lib/safeLink.js";

type Json = Record<string, unknown>;

const ELIGIBILITY_SCREEN = "OPS:LB_ELIGIBILITY";
const SESSION_SCREEN = "OPS:LB_SESSION";
const VIRTUAL_SCREEN = "OPS:LB_VIRTUAL";
const LINK_SCREEN = "SYS:LB_SESSION_LINK";

function dataOf(raw: string | null | undefined): Json {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
  } catch {
    return {};
  }
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

function wallClock(date: unknown, time: unknown) {
  const value = `${text(date)}T${text(time)}:00.000Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw Object.assign(new Error("Lab session has an invalid date or time"), { status: 400, code: "VALIDATION_ERROR" });
  return parsed;
}

async function linkedClassSession(institutionId: string, recordId: string) {
  const link = await prisma.heritageRecord.findFirst({
    where: { institutionId, screenId: LINK_SCREEN, contextKey: recordId, singletonKey: "class-session", deletedAt: null },
  });
  return { link, classSessionId: text(dataOf(link?.dataJson).classSessionId) };
}

/** Mirrors the admin workflow record into the canonical ClassSession used by student and teacher course surfaces. */
export async function syncLabSession(institutionId: string, recordId: string, data: Json, actorAccountId: string) {
  const sectionId = text(data.sectionId);
  if (!sectionId) throw Object.assign(new Error("Course Section is required so students can receive the lab session"), { status: 400, code: "VALIDATION_ERROR" });
  const section = await prisma.section.findFirst({ where: { id: sectionId, institutionId }, include: { course: true } });
  if (!section) throw Object.assign(new Error("Course Section no longer exists"), { status: 400, code: "VALIDATION_ERROR" });

  const { link, classSessionId } = await linkedClassSession(institutionId, recordId);
  if (text(data.status) === "Cancelled") {
    if (classSessionId) {
      const usage = await prisma.classSession.findFirst({
        where: { id: classSessionId, institutionId },
        include: { _count: { select: { attendanceRecords: true, labNotebookEntries: true } } },
      });
      if (usage && !usage._count.attendanceRecords && !usage._count.labNotebookEntries) await prisma.classSession.delete({ where: { id: usage.id } });
      else if (usage) await prisma.classSession.update({ where: { id: usage.id }, data: { title: `[Cancelled] ${text(data.title)}`, joinUrl: null, rowVersion: { increment: 1 } } });
    }
    if (link) await prisma.heritageRecord.update({ where: { id: link.id }, data: { deletedAt: new Date(), status: "deleted", updatedById: actorAccountId } });
    return null;
  }

  const room = text(data.roomId)
    ? await prisma.heritageRecord.findFirst({ where: { id: text(data.roomId), institutionId, screenId: "LOC:CLASSROOM", deletedAt: null } })
    : null;
  const location = text(dataOf(room?.dataJson).name) || "Lab room TBD";
  const startsAt = wallClock(data.date, data.startTime);
  const endsAt = wallClock(data.date, data.endTime);
  const values = {
    sectionId: section.id,
    title: text(data.title),
    startsAt,
    endsAt,
    location,
    deliveryMode: "in_person",
    sessionKind: "lab",
    rowVersion: { increment: 1 },
  };
  const existing = classSessionId ? await prisma.classSession.findFirst({ where: { id: classSessionId, institutionId } }) : null;
  const session = existing
    ? await prisma.classSession.update({ where: { id: existing.id }, data: values })
    : await prisma.classSession.create({ data: { institutionId, ...values, rowVersion: 1 } });

  const linkData = JSON.stringify({ classSessionId: session.id });
  if (link) {
    await prisma.heritageRecord.update({ where: { id: link.id }, data: { dataJson: linkData, updatedById: actorAccountId, rowVersion: { increment: 1 } } });
  } else {
    await prisma.heritageRecord.create({
      data: { institutionId, screenId: LINK_SCREEN, contextKey: recordId, singletonKey: "class-session", dataJson: linkData, createdById: actorAccountId, updatedById: actorAccountId },
    });
  }
  return session;
}

export async function removeSyncedLabSession(institutionId: string, recordId: string, actorAccountId: string) {
  const { link, classSessionId } = await linkedClassSession(institutionId, recordId);
  if (classSessionId) {
    const usage = await prisma.classSession.findFirst({
      where: { id: classSessionId, institutionId },
      include: { _count: { select: { attendanceRecords: true, labNotebookEntries: true } } },
    });
    if (usage && !usage._count.attendanceRecords && !usage._count.labNotebookEntries) await prisma.classSession.delete({ where: { id: usage.id } });
    else if (usage) await prisma.classSession.update({ where: { id: usage.id }, data: { title: `[Cancelled] ${usage.title}`, joinUrl: null, rowVersion: { increment: 1 } } });
  }
  if (link) await prisma.heritageRecord.update({ where: { id: link.id }, data: { deletedAt: new Date(), status: "deleted", updatedById: actorAccountId } });
}

/** Compatibility bridge for lab records created before canonical session syncing was introduced. */
export async function syncExistingLabSessions(institutionId: string) {
  const [records, links] = await Promise.all([
    prisma.heritageRecord.findMany({ where: { institutionId, screenId: SESSION_SCREEN, deletedAt: null } }),
    prisma.heritageRecord.findMany({ where: { institutionId, screenId: LINK_SCREEN, singletonKey: "class-session", deletedAt: null }, select: { contextKey: true } }),
  ]);
  const linked = new Set(links.map((row) => row.contextKey));
  for (const record of records) {
    if (linked.has(record.id)) continue;
    const data = dataOf(record.dataJson);
    if (!text(data.sectionId) || !text(data.instructorId)) continue;
    await syncLabSession(institutionId, record.id, data, record.updatedById);
  }
}

async function studentFor(user: SessionClaims) {
  const student = await prisma.student.findFirst({ where: { institutionId: user.institutionId, personId: user.personId } });
  if (!student) throw Object.assign(new Error("Student not found"), { status: 404, code: "NOT_FOUND" });
  return student;
}

type EffectiveEligibility = Json & { id: string; updatedAt: string; effectiveStatus: string };

function effectiveEligibility(rows: Array<{ id: string; dataJson: string; updatedAt: Date }>): EffectiveEligibility[] {
  const now = new Date().toISOString().slice(0, 10);
  return rows.map((row): Json & { id: string; updatedAt: string } => ({ id: row.id, ...dataOf(row.dataJson), updatedAt: row.updatedAt.toISOString() })).map((row): EffectiveEligibility => {
    const expired = text(row.expiresOn) && text(row.expiresOn) < now;
    return { ...row, effectiveStatus: expired && text(row.status) === "Cleared" ? "Expired" : text(row.status) };
  });
}

export async function getStudentLabAccess(user: SessionClaims) {
  const student = await studentFor(user);
  const [eligibilityRows, enrolments, virtualRows, safetyRows, equipmentRows] = await Promise.all([
    prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, screenId: ELIGIBILITY_SCREEN, deletedAt: null }, orderBy: { updatedAt: "desc" } }),
    prisma.enrolment.findMany({ where: { institutionId: user.institutionId, studentId: student.id, status: "enrolled" }, include: { section: true } }),
    prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, screenId: VIRTUAL_SCREEN, deletedAt: null }, orderBy: { updatedAt: "desc" } }),
    prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, screenId: "OPS:LB_SAFETY", deletedAt: null } }),
    prisma.heritageRecord.findMany({ where: { institutionId: user.institutionId, screenId: "OPS:LB_EQUIPMENT", deletedAt: null } }),
  ]);
  const eligibility = effectiveEligibility(eligibilityRows.filter((row) => text(dataOf(row.dataJson).studentId) === student.id));
  const cleared = eligibility.some((row) => row.effectiveStatus === "Cleared");
  const courseIds = new Set(enrolments.map((row) => row.section.courseId));
  const safety = new Map(safetyRows.map((row) => [row.id, text(dataOf(row.dataJson).title)]));
  const equipment = new Map(equipmentRows.map((row) => [row.id, text(dataOf(row.dataJson).name)]));
  const courses = new Map((await prisma.course.findMany({ where: { institutionId: user.institutionId, id: { in: [...courseIds] } } })).map((course) => [course.id, `${course.code} · ${course.title}`]));

  return {
    accessStatus: cleared ? "Cleared" : eligibility[0]?.effectiveStatus || "Not configured",
    canLaunchVirtualLabs: cleared,
    eligibility: eligibility.map((row) => ({
      id: row.id,
      status: row.effectiveStatus,
      clearedOn: text(row.clearedOn) || null,
      expiresOn: text(row.expiresOn) || null,
      training: safety.get(text(row.safetyRuleId)) || null,
      equipment: equipment.get(text(row.equipmentId)) || null,
      notes: text(row.notes) || null,
    })),
    virtualLabs: virtualRows.flatMap((row) => {
      const data = dataOf(row.dataJson);
      const courseId = text(data.courseId);
      if (text(data.status) !== "Active" || !courseIds.has(courseId)) return [];
      return [{ id: row.id, name: text(data.name), courseId, course: courses.get(courseId) || "Enrolled course", provider: text(data.provider) || null, seats: Number(data.seats) || 0, canLaunch: cleared && isSafeLink(text(data.launchUrl)) }];
    }),
  };
}

export async function launchStudentVirtualLab(user: SessionClaims, virtualLabId: string) {
  const access = await getStudentLabAccess(user);
  const allowed = access.virtualLabs.find((lab) => lab.id === virtualLabId);
  if (!allowed) throw Object.assign(new Error("Virtual lab is not assigned to one of your enrolled courses"), { status: 404, code: "NOT_FOUND" });
  if (!access.canLaunchVirtualLabs) throw Object.assign(new Error("A current Cleared lab eligibility record is required"), { status: 403, code: "LAB_ELIGIBILITY_REQUIRED" });
  const row = await prisma.heritageRecord.findFirst({ where: { id: virtualLabId, institutionId: user.institutionId, screenId: VIRTUAL_SCREEN, deletedAt: null } });
  const url = text(dataOf(row?.dataJson).launchUrl);
  if (!isSafeLink(url)) throw Object.assign(new Error("Virtual lab launch URL is not configured securely"), { status: 409, code: "LAB_LAUNCH_UNAVAILABLE" });
  return { url };
}

export async function updateAssignedLabStatus(user: SessionClaims, recordId: string, next: "In Progress" | "Completed" | "Cancelled") {
  const record = await prisma.heritageRecord.findFirst({ where: { id: recordId, institutionId: user.institutionId, screenId: SESSION_SCREEN, deletedAt: null } });
  if (!record) throw Object.assign(new Error("Lab session not found"), { status: 404, code: "NOT_FOUND" });
  const data = dataOf(record.dataJson);
  if (text(data.instructorId) !== user.personId) throw Object.assign(new Error("This lab session is assigned to another instructor"), { status: 403, code: "FORBIDDEN" });
  const current = text(data.status);
  const valid = (current === "Scheduled" && ["In Progress", "Completed", "Cancelled"].includes(next)) || (current === "In Progress" && next === "Completed");
  if (!valid) throw Object.assign(new Error(`Lab session cannot change from ${current} to ${next}`), { status: 409, code: "CONFLICT" });
  const updated = { ...data, status: next };
  await prisma.heritageRecord.update({ where: { id: record.id }, data: { dataJson: JSON.stringify(updated), updatedById: user.accountId, rowVersion: { increment: 1 } } });
  await syncLabSession(user.institutionId, record.id, updated, user.accountId);
  return { ok: true, id: record.id, status: next };
}
