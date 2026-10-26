import { prisma } from "@myheritage/db";

/* ------------------------------------------------------------------ */
/* Vocabulary captured from the Workshops / Add Workshop screens        */
/* ------------------------------------------------------------------ */

export const WORKSHOP_STATUSES = ["Active", "Inactive"] as const;
export const ROLE_MODES = ["Disabled", "Enabled"] as const;
export const PRIVACY = ["Private Workshop", "Public Workshop"] as const;
export const APPROVAL = ["Manual Decision", "Automatic Approval"] as const;
export const SCHEDULE_TYPES = ["Weekly Schedule", "Daily Schedule"] as const;
export const FEE_COLLECTION = ["Immediately", "Upon Approval", "Do Not Collect"] as const;
export const LMS = ["Disabled", "Enabled"] as const;
export const VISIBILITY = ["Visible", "Hidden"] as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const NO_GRADING = "None / Not Applicable";
export const ALL_CAMPUSES = "All Campuses";
export const ALL_ACCESSES = "All Accesses";
export const ALL_STATUSES = "All Statuses";
export const ALL_PROGRAMS = "All Programs";

export type WorkshopSession = { day: string; start: string; end: string };

export type WorkshopSettings = {
  introduction: string;
  descriptionHtml: string;
  adminStatus: string;
  campus: string;
  instructors: string[];
  classroom: string;
  enrolmentCutoff: string;
  rolesMode: string;
  roleIds: string[];
  maxEnrolments: number;
  sameAsClassroom: boolean;
  privacy: string;
  approval: string;
  hours: number;
  continuous: boolean;
  startDate: string;
  endDate: string;
  scheduleType: string;
  sessions: WorkshopSession[];
  dailyStart: string;
  dailyEnd: string;
  feeCollection: string;
  defaultFee: number;
  domesticFee: number;
  internationalFee: number;
  gradingScheme: string;
  lms: string;
  campusAccess: string;
  accessLevels: string;
  studentStatuses: string;
  programOfStudy: string;
  grades: string;
  badges: string;
  hasImage: boolean;
};

export type WorkshopRow = {
  id: string;
  institutionId: string;
  code: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  capacity: number;
  status: string;
  settingsJson: string;
};

/** Enrolment statuses that hold a seat. */
export const SEAT_STATUSES = ["pending", "approved", "registered", "completed"];

/* ------------------------------------------------------------------ */
/* Time zone helpers                                                    */
/* ------------------------------------------------------------------ */

const tzCache = new Map<string, string>();

export async function institutionTimezone(institutionId: string) {
  const hit = tzCache.get(institutionId);
  if (hit) return hit;
  const row = await prisma.institution.findFirst({ where: { OR: [{ id: institutionId }, { institutionId }] }, select: { timezone: true } });
  const tz = row?.timezone || "America/Vancouver";
  tzCache.set(institutionId, tz);
  return tz;
}

export function ymdIn(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function hmIn(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** Wall-clock date + time in `tz` → UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string) {
  const guess = new Date(`${date}T${time || "00:00"}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export function weekdayOf(iso: string) {
  return WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

function parseJson(json: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(json ?? "");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Settings for a workshop; rows created before the admin form get values derived from their columns. */
export function workshopSettings(w: WorkshopRow, tz: string): WorkshopSettings {
  const raw = parseJson(w.settingsJson);
  const legacy = Object.keys(raw).length === 0;
  const start = ymdIn(w.startsAt, tz);
  const end = w.endsAt ? ymdIn(w.endsAt, tz) : start;
  const sessions = Array.isArray(raw.sessions)
    ? (raw.sessions as unknown[])
        .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
        .map((s) => ({ day: str(s.day), start: str(s.start), end: str(s.end) }))
        .filter((s) => (WEEKDAYS as readonly string[]).includes(s.day))
    : legacy
      ? [{ day: weekdayOf(start), start: hmIn(w.startsAt, tz), end: w.endsAt ? hmIn(w.endsAt, tz) : "" }]
      : [];
  const legacyHours = w.endsAt ? Math.max(0, Math.round(((w.endsAt.getTime() - w.startsAt.getTime()) / 36e5) * 100) / 100) : 0;
  return {
    introduction: str(raw.introduction),
    descriptionHtml: str(raw.descriptionHtml, legacy ? w.description : ""),
    adminStatus: str(raw.adminStatus, w.status === "cancelled" ? "Inactive" : "Active"),
    campus: str(raw.campus, legacy ? (w.location ?? "") : ""),
    instructors: Array.isArray(raw.instructors) ? (raw.instructors as unknown[]).filter((x): x is string => typeof x === "string") : [],
    classroom: str(raw.classroom),
    enrolmentCutoff: str(raw.enrolmentCutoff),
    rolesMode: str(raw.rolesMode, "Disabled"),
    roleIds: Array.isArray(raw.roleIds) ? (raw.roleIds as unknown[]).filter((x): x is string => typeof x === "string") : [],
    maxEnrolments: num(raw.maxEnrolments, w.capacity),
    sameAsClassroom: typeof raw.sameAsClassroom === "boolean" ? raw.sameAsClassroom : false,
    // Self-registration is opt-in. Legacy rows did not store a privacy setting;
    // treating them as public exposed unrelated workshops to every student.
    privacy: str(raw.privacy, "Private Workshop"),
    approval: str(raw.approval, "Manual Decision"),
    hours: num(raw.hours, legacy ? legacyHours : 0),
    continuous: raw.continuous === true,
    startDate: str(raw.startDate, start),
    endDate: str(raw.endDate, raw.continuous === true ? "" : end),
    scheduleType: str(raw.scheduleType, "Weekly Schedule"),
    sessions,
    dailyStart: str(raw.dailyStart),
    dailyEnd: str(raw.dailyEnd),
    feeCollection: str(raw.feeCollection, legacy ? "Do Not Collect" : "Immediately"),
    defaultFee: num(raw.defaultFee),
    domesticFee: num(raw.domesticFee),
    internationalFee: num(raw.internationalFee),
    gradingScheme: str(raw.gradingScheme, NO_GRADING),
    lms: str(raw.lms, "Disabled"),
    campusAccess: str(raw.campusAccess, ALL_CAMPUSES),
    accessLevels: str(raw.accessLevels, ALL_ACCESSES),
    studentStatuses: str(raw.studentStatuses, ALL_STATUSES),
    programOfStudy: str(raw.programOfStudy, ALL_PROGRAMS),
    grades: str(raw.grades, "Visible"),
    badges: str(raw.badges, "Visible"),
    hasImage: raw.hasImage === true,
  };
}

/* ------------------------------------------------------------------ */
/* Lifecycle + schedule                                                 */
/* ------------------------------------------------------------------ */

export type Phase = "upcoming" | "active" | "completed" | "inactive";

export function workshopPhase(w: WorkshopRow, s: WorkshopSettings, today: string): Phase {
  if (s.adminStatus === "Inactive" || w.status === "cancelled") return "inactive";
  if (w.status === "completed") return "completed";
  if (!s.continuous && s.endDate && s.endDate < today) return "completed";
  if (s.startDate && s.startDate > today) return "upcoming";
  return "active";
}

/** Column value stored on Workshop.status, read by the student and instructor portals. */
export function storedStatus(phase: Phase) {
  return phase === "inactive" ? "cancelled" : phase;
}

export const phaseLabel = (p: Phase) => p.charAt(0).toUpperCase() + p.slice(1);

export function meetsOn(s: WorkshopSettings, date: string) {
  if (!s.startDate || date < s.startDate) return false;
  if (!s.continuous && s.endDate && date > s.endDate) return false;
  if (s.scheduleType === "Daily Schedule") return true;
  if (!s.sessions.length) return date === s.startDate;
  return s.sessions.some((x) => x.day === weekdayOf(date));
}

const SHORT_DAY: Record<string, string> = { Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" };
const span = (a: string, b: string) => (a && b ? `${a}–${b}` : a || "");

export function scheduleLabel(s: WorkshopSettings) {
  if (s.scheduleType === "Daily Schedule") return `Daily${s.dailyStart ? ` ${span(s.dailyStart, s.dailyEnd)}` : ""}`;
  if (!s.sessions.length) return "—";
  const ordered = [...s.sessions].sort((a, b) => WEEKDAYS.indexOf(a.day as never) - WEEKDAYS.indexOf(b.day as never));
  const sameTime = ordered.every((x) => x.start === ordered[0].start && x.end === ordered[0].end);
  if (sameTime) return `${ordered.map((x) => SHORT_DAY[x.day]).join(", ")}${ordered[0].start ? ` ${span(ordered[0].start, ordered[0].end)}` : ""}`;
  return ordered.map((x) => `${SHORT_DAY[x.day]} ${span(x.start, x.end)}`.trim()).join("; ");
}

export function sessionTimeOn(s: WorkshopSettings, date: string) {
  if (s.scheduleType === "Daily Schedule") return span(s.dailyStart, s.dailyEnd);
  const hit = s.sessions.find((x) => x.day === weekdayOf(date));
  return hit ? span(hit.start, hit.end) : "";
}

export function lengthLabel(s: WorkshopSettings) {
  if (s.hours > 0) return `${s.hours} hr${s.hours === 1 ? "" : "s"}`;
  if (s.continuous) return "Continuous";
  if (!s.startDate || !s.endDate) return "—";
  const days = Math.round((Date.parse(`${s.endDate}T12:00:00Z`) - Date.parse(`${s.startDate}T12:00:00Z`)) / 864e5) + 1;
  if (days >= 14 && days % 7 === 0) return `${days / 7} weeks`;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function cutoffPassed(s: WorkshopSettings, now: Date, tz: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.enrolmentCutoff)) return false;
  const [d, t] = s.enrolmentCutoff.split("T");
  return zonedToUtc(d, t, tz).getTime() < now.getTime();
}

/* ------------------------------------------------------------------ */
/* Student eligibility (portal self-registration)                       */
/* ------------------------------------------------------------------ */

export type StudentAccess = { status: string; programName: string; campus: string };

export function studentMayRegister(w: WorkshopRow, s: WorkshopSettings, who: StudentAccess, now: Date, tz: string): string | null {
  const phase = workshopPhase(w, s, ymdIn(now, tz));
  if (phase === "inactive" || phase === "completed") return "Workshop is not open for registration";
  if (s.privacy !== "Public Workshop") return "This workshop is private; enrolments are made by the college";
  if (cutoffPassed(s, now, tz)) return "The enrolment cut-off for this workshop has passed";
  if (s.studentStatuses !== ALL_STATUSES && who.status && who.status !== s.studentStatuses) return "This workshop is not available to your student status";
  if (s.programOfStudy !== ALL_PROGRAMS && who.programName !== s.programOfStudy) return "This workshop is only available to another program of study";
  if (s.campusAccess !== ALL_CAMPUSES && who.campus && who.campus !== s.campusAccess) return "This workshop is only available at another campus";
  return null;
}

/* ------------------------------------------------------------------ */
/* Fees                                                                 */
/* ------------------------------------------------------------------ */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function feeFor(s: WorkshopSettings, residency: string | undefined) {
  if (residency === "International" && s.internationalFee > 0) return s.internationalFee;
  if (residency === "Domestic" && s.domesticFee > 0) return s.domesticFee;
  return s.defaultFee;
}

const feeRef = (registrationId: string) => `workshop-enrolment:${registrationId}`;

/** Posts the workshop fee once per enrolment (idempotent). */
export async function postWorkshopFee(
  tx: Tx,
  input: { institutionId: string; registrationId: string; studentId: string; workshop: { code: string; title: string }; amount: number },
) {
  if (!(input.amount > 0)) return null;
  const existing = await tx.financeLedgerEntry.findFirst({
    where: { institutionId: input.institutionId, studentId: input.studentId, source: feeRef(input.registrationId), kind: "charge", status: { not: "waived" } },
  });
  if (existing) return existing;
  return tx.financeLedgerEntry.create({
    data: {
      institutionId: input.institutionId,
      studentId: input.studentId,
      label: `Workshop Fee — ${input.workshop.code} ${input.workshop.title}`.slice(0, 200),
      amountCad: Math.round(input.amount * 100) / 100,
      kind: "charge",
      status: "open",
      source: feeRef(input.registrationId),
      note: "Posted from workshop enrolment",
    },
  });
}

/** Waives an unpaid workshop fee when the enrolment is declined, dropped or deleted. */
export async function waiveWorkshopFee(tx: Tx, institutionId: string, registrationId: string, reason: string) {
  const r = await tx.financeLedgerEntry.updateMany({
    where: { institutionId, source: feeRef(registrationId), kind: "charge", status: "open" },
    data: { status: "waived", note: reason, rowVersion: { increment: 1 } },
  });
  return r.count;
}
