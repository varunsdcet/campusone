/* A section's offering facts (dates, weekly timetable, campus / room, delivery) as set on its session / offering form,
   and the class sessions generated from that timetable so calendars and attendance see real meetings. */

import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import { zonedToUtc } from "../../lib/workshopPolicy.js";

type Data = Record<string, unknown>;
export type Meeting = { day: string; start: string; end: string };
export type DeliveryMode = "in_person" | "online" | "hybrid";

export type Offering = {
  startsOn: string | null;
  endsOn: string | null;
  continuous: boolean;
  meetings: Meeting[];
  scheduleText: string | null;
  campus: string | null;
  room: string | null;
  location: string | null;
  deliveryMethod: string | null;
  deliveryMode: DeliveryMode;
};

export type OfferingLabels = { campus: Map<string, string>; classroom: Map<string, string>; type: Map<string, string> };

const SESSION_SETTINGS = "CM:SESSION";
const SETTINGS_KEY = "settings";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEK_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Upper bound on generated meetings per section (two years of daily classes is far beyond any real offering). */
const MAX_MEETINGS = 730;
/** Continuous feed-in sessions with no end date get this many weeks of meetings. */
const OPEN_ENDED_WEEKS = 16;

const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const parse = (json: string): Data => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
  } catch {
    return {};
  }
};

export function meetingsOf(st: Data | undefined): Meeting[] {
  const raw = Array.isArray(st?.meetings) ? (st!.meetings as Data[]) : [];
  return raw
    .map((m) => ({ day: s(m?.day), start: s(m?.start), end: s(m?.end) }))
    .filter((m) => (WEEKDAYS as readonly string[]).includes(m.day) && TIME_RE.test(m.start) && TIME_RE.test(m.end) && m.end > m.start)
    .sort((a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day));
}

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h! < 12 ? "am" : "pm"}`;
}

export function scheduleText(meetings: Meeting[]) {
  return meetings.length ? meetings.map((m) => `${m.day}: ${clock(m.start)} - ${clock(m.end)}`).join("\n") : null;
}

/** "online" / "hybrid" / "in_person" from a delivery or session-type label (Face to Face, Blended / Hybrid, Online, …). */
export function deliveryModeOf(label: string): DeliveryMode {
  if (/online|remote|virtual|self-paced/i.test(label)) return "online";
  if (/blend|bleded|hybrid/i.test(label)) return "hybrid";
  return "in_person";
}

export function offeringOf(st: Data | undefined, labels: OfferingLabels): Offering | null {
  if (!st) return null;
  const meetings = meetingsOf(st);
  const continuous = st.continuous === true;
  const startsOn = DATE_RE.test(s(st.startDate)) ? s(st.startDate) : null;
  const endsOn = !continuous && DATE_RE.test(s(st.endDate)) ? s(st.endDate) : null;
  const campusId = s(st.campus);
  const campus = (campusId && (labels.campus.get(campusId) ?? (campusId === "Not Set" ? "" : campusId))) || null;
  const roomLabel = labels.classroom.get(s(st.classroom)) ?? "";
  const room = roomLabel ? roomLabel.replace(/\s*\(\d+ seats\)$/, "") : null;
  const deliveryMethod = labels.type.get(s(st.sessionType)) || s(st.deliveryMethod) || null;
  const deliveryMode = deliveryModeOf(deliveryMethod ?? "");
  const location = [campus, room ? `Room ${room}` : ""].filter(Boolean).join(" · ") || (deliveryMode === "online" ? "Online" : null);
  return { startsOn, endsOn, continuous, meetings, scheduleText: scheduleText(meetings), campus, room, location, deliveryMethod: deliveryMethod === "Bleded" ? "Blended" : deliveryMethod, deliveryMode };
}

export async function offeringLabels(inst: string): Promise<OfferingLabels> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: ["LOC:CAMPUS", "LOC:CLASSROOM", "CM:TYPE"] }, deletedAt: null, singletonKey: null },
    select: { id: true, screenId: true, dataJson: true },
  });
  const map = (screen: string) => new Map(rows.filter((r) => r.screenId === screen).map((r) => [r.id, s(parse(r.dataJson).name)] as const));
  return { campus: map("LOC:CAMPUS"), classroom: map("LOC:CLASSROOM"), type: map("CM:TYPE") };
}

/** Offering facts for each section that has session / offering settings. */
export async function sectionOfferings(inst: string, sectionIds: string[]): Promise<Map<string, Offering>> {
  const out = new Map<string, Offering>();
  if (!sectionIds.length) return out;
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: SESSION_SETTINGS, singletonKey: SETTINGS_KEY, contextKey: { in: sectionIds }, deletedAt: null },
    select: { contextKey: true, dataJson: true },
  });
  if (!rows.length) return out;
  const labels = await offeringLabels(inst);
  for (const r of rows) {
    const o = offeringOf(parse(r.dataJson), labels);
    if (o) out.set(r.contextKey, o);
  }
  return out;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Every meeting between the offering's start and end dates (institution wall clock → UTC instants). */
export function plannedMeetings(
  o: Pick<Offering, "startsOn" | "endsOn" | "meetings">,
  fallbackEnd: string | null,
  tz: string,
  excludedDates: ReadonlySet<string> = new Set(),
) {
  if (!o.startsOn || !o.meetings.length) return [];
  const end = o.endsOn || (fallbackEnd && fallbackEnd >= o.startsOn ? fallbackEnd : addDays(o.startsOn, OPEN_ENDED_WEEKS * 7 - 1));
  const byDay = new Map(o.meetings.map((m) => [m.day, m] as const));
  const out: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (let d = o.startsOn; d <= end && out.length < MAX_MEETINGS; d = addDays(d, 1)) {
    const m = byDay.get(WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]!);
    if (m && !excludedDates.has(d)) out.push({ startsAt: zonedToUtc(d, m.start, tz), endsAt: zonedToUtc(d, m.end, tz) });
  }
  return out;
}

export function holidayDates(rows: Array<{ dataJson: string }>) {
  const dates = new Set<string>();
  for (const row of rows) {
    const data = parse(row.dataJson);
    const start = s(data.date);
    if (!DATE_RE.test(start)) continue;
    const requestedEnd = data.singleDay === false ? s(data.endDate) : start;
    const end = DATE_RE.test(requestedEnd) && requestedEnd >= start ? requestedEnd : start;
    for (let date = start; date <= end; date = addDays(date, 1)) dates.add(date);
  }
  return dates;
}

export const generatedTitle = (courseCode: string, sectionCode: string) => `${courseCode} ${sectionCode} class`;

/**
 * Brings the section's class sessions in line with its timetable: missing meetings are created, kept ones get the
 * current room / delivery, and generated meetings that left the timetable are removed unless attendance or lab work
 * was already recorded against them.
 */
export async function syncSectionClassSessions(inst: string, sectionId: string) {
  const section = await prisma.section.findFirst({ where: { id: sectionId, institutionId: inst }, include: { course: true, term: true } });
  if (!section) return { created: 0, removed: 0 };
  const offering = (await sectionOfferings(inst, [sectionId])).get(sectionId);
  const [institution, holidayRows] = await Promise.all([
    prisma.institution.findFirst({ where: { institutionId: inst }, select: { timezone: true } }),
    prisma.heritageRecord.findMany({
      where: { institutionId: inst, screenId: "SYS:HOLIDAY", deletedAt: null, singletonKey: null },
      select: { dataJson: true },
    }),
  ]);
  const tz = institution?.timezone || "America/Vancouver";
  const planned = offering ? plannedMeetings(offering, section.term.endsOn, tz, holidayDates(holidayRows)) : [];
  const title = generatedTitle(section.course.code, section.code);
  const existing = await prisma.classSession.findMany({
    where: { institutionId: inst, sectionId },
    select: { id: true, title: true, startsAt: true, endsAt: true, location: true, deliveryMode: true, _count: { select: { attendanceRecords: true, labNotebookEntries: true } } },
  });
  const byStart = new Map(existing.map((e) => [e.startsAt.getTime(), e] as const));
  const want = new Set(planned.map((p) => p.startsAt.getTime()));
  const location = offering?.location ?? null;
  const deliveryMode = offering?.deliveryMode ?? "in_person";
  const stale = existing.filter((e) => e.title === title && !want.has(e.startsAt.getTime()) && e._count.attendanceRecords === 0 && e._count.labNotebookEntries === 0).map((e) => e.id);
  const fresh = planned.filter((p) => !byStart.has(p.startsAt.getTime()));
  await prisma.$transaction(async (tx) => {
    if (stale.length) await tx.classSession.deleteMany({ where: { id: { in: stale }, institutionId: inst } });
    if (fresh.length)
      await tx.classSession.createMany({
        data: fresh.map((p) => ({ id: randomUUID(), institutionId: inst, sectionId, title, startsAt: p.startsAt, endsAt: p.endsAt, location, deliveryMode, sessionKind: "lecture" })),
      });
    for (const p of planned) {
      const e = byStart.get(p.startsAt.getTime());
      if (!e || e.title !== title) continue;
      if (e.location === location && e.deliveryMode === deliveryMode && e.endsAt?.getTime() === p.endsAt.getTime()) continue;
      await tx.classSession.update({ where: { id: e.id }, data: { location, deliveryMode, endsAt: p.endsAt, rowVersion: { increment: 1 } } });
    }
  });
  return { created: fresh.length, removed: stale.length };
}

/** Removes the generated meetings of a section that never had attendance or lab work (before deleting the section). */
export async function dropGeneratedClassSessions(inst: string, sectionId: string, courseCode: string, sectionCode: string) {
  const title = generatedTitle(courseCode, sectionCode);
  const rows = await prisma.classSession.findMany({
    where: { institutionId: inst, sectionId, title },
    select: { id: true, _count: { select: { attendanceRecords: true, labNotebookEntries: true } } },
  });
  const ids = rows.filter((r) => r._count.attendanceRecords === 0 && r._count.labNotebookEntries === 0).map((r) => r.id);
  if (ids.length) await prisma.classSession.deleteMany({ where: { id: { in: ids }, institutionId: inst } });
  return ids.length;
}
