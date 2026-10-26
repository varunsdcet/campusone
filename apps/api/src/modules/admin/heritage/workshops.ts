import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import {
  ALL_ACCESSES,
  ALL_CAMPUSES,
  ALL_PROGRAMS,
  ALL_STATUSES,
  APPROVAL,
  FEE_COLLECTION,
  LMS,
  NO_GRADING,
  PRIVACY,
  ROLE_MODES,
  SCHEDULE_TYPES,
  SEAT_STATUSES,
  VISIBILITY,
  WEEKDAYS,
  WORKSHOP_STATUSES,
  addDays,
  cutoffPassed,
  feeFor,
  institutionTimezone,
  lengthLabel,
  meetsOn,
  phaseLabel,
  postWorkshopFee,
  scheduleLabel,
  sessionTimeOn,
  storedStatus,
  waiveWorkshopFee,
  workshopPhase,
  workshopSettings,
  ymdIn,
  zonedToUtc,
  type Phase,
  type WorkshopSettings,
} from "../../../lib/workshopPolicy.js";
import { CAMPUSES, STUDENT_PROGRAMS, STUDENT_STATUSES, assertPermission, listAccessLevels, studentMetaMap } from "../superAdmin.service.js";
import { courseRefLists } from "./courses.refs.js";
import { audit, refs } from "./service.js";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                           */
/* ------------------------------------------------------------------ */

export const ENROLMENT_STATUSES = ["Pending", "Approved", "Declined", "Dropped"] as const;
type EnrolmentStatus = "pending" | "approved" | "declined" | "dropped";
export const MY_FILTERS = ["Active & Upcoming Workshops", "Active Workshops", "Upcoming Workshops", "Completed Workshops"] as const;
export const COMPLETION_FILTERS = ["Upcoming / In Progress", "Completed"] as const;
const IMAGE_SCREEN = "WS:IMAGE";
const IMAGE_MAX = 2 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp)$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const parseArr = <T>(json: string | null | undefined): T[] => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};
const lower = (v: string) => v.toLowerCase();
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
export function workshopGradingSchemes(managed?: string[], legacy?: string[]) {
  return uniq([NO_GRADING, ...((managed?.length ? managed : legacy) ?? [])]);
}
const statusOf = (raw: string): EnrolmentStatus => {
  const v = lower(raw);
  if (v === "pending") return "pending";
  if (v === "declined" || v === "rejected") return "declined";
  if (v === "dropped" || v === "cancelled") return "dropped";
  return "approved";
};
const statusLabel = (st: EnrolmentStatus) => (st.charAt(0).toUpperCase() + st.slice(1)) as (typeof ENROLMENT_STATUSES)[number];
const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Instructor portal access is limited to workshops explicitly assigned to the instructor.
 * Admin callers pass no scope and are checked against Course Management instead.
 */
export type WorkshopScope = { accountId: string; workshopIds: Set<string> };

export const workshopAssignedTo = (instructorIds: readonly string[], accountId: string) => instructorIds.includes(accountId);

async function gate(user: SessionClaims, level: "view" | "edit", scope?: WorkshopScope) {
  if (!scope) await assertPermission(user, "courseManagement", level);
}

function assertInScope(scope: WorkshopScope | undefined, workshopId: string) {
  if (scope && !scope.workshopIds.has(workshopId)) throw httpError(403, "This workshop is not assigned to you", "FORBIDDEN");
}

const inScope = (scope: WorkshopScope | undefined, workshopId: string) => !scope || scope.workshopIds.has(workshopId);

export async function instructorWorkshopScope(user: SessionClaims): Promise<WorkshopScope> {
  const [ws, tz] = await Promise.all([prisma.workshop.findMany({ where: { institutionId: user.institutionId } }), institutionTimezone(user.institutionId)]);
  const ids = ws
    .filter((w) => {
      const instructors = workshopSettings(w, tz).instructors;
      return workshopAssignedTo(instructors, user.accountId);
    })
    .map((w) => w.id);
  return { accountId: user.accountId, workshopIds: new Set(ids) };
}

function stripHtml(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function clock(inst: string) {
  const tz = await institutionTimezone(inst);
  const now = new Date();
  return { tz, now, today: ymdIn(now, tz) };
}

type Staff = { id: string; name: string };

async function staffList(inst: string): Promise<Staff[]> {
  const accounts = await prisma.account.findMany({ where: { institutionId: inst, status: "active" }, include: { person: true } });
  return accounts
    .filter((a) => /instructor|admin|registrar|advisor|staff/.test(a.rolesJson))
    .map((a) => ({ id: a.id, name: `${a.person.givenName} ${a.person.familyName}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type Campus = { value: string; label: string };
type Classroom = { value: string; label: string; campus: string; size: number };

async function locationOptions(inst: string): Promise<{ campuses: Campus[]; classrooms: Classroom[] }> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: ["LOC:CAMPUS", "LOC:CLASSROOM"] }, deletedAt: null, singletonKey: null },
    orderBy: { createdAt: "asc" },
  });
  const data = (json: string) => {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  const active = (d: Record<string, unknown>) => String(d.active || "Active") === "Active";
  const campusRows = rows.filter((r) => r.screenId === "LOC:CAMPUS").map((r) => ({ id: r.id, d: data(r.dataJson) }));
  const campuses: Campus[] = campusRows.length
    ? campusRows.filter((c) => active(c.d)).map((c) => ({ value: c.id, label: String(c.d.name ?? "") }))
    : CAMPUSES.map((c) => ({ value: c, label: c }));
  const campusName = new Map(campusRows.map((c) => [c.id, String(c.d.name ?? "")]));
  const classrooms = rows
    .filter((r) => r.screenId === "LOC:CLASSROOM")
    .map((r) => ({ r, d: data(r.dataJson) }))
    .filter(({ d }) => active(d))
    .map(({ r, d }) => ({
      value: r.id,
      label: `${campusName.get(r.contextKey) ?? ""} · ${String(d.name ?? "")}`.replace(/^ · /, ""),
      campus: r.contextKey,
      size: Number(d.size) || 0,
    }));
  return { campuses, classrooms };
}

async function workshopsWithRegs(inst: string) {
  return prisma.workshop.findMany({
    where: { institutionId: inst },
    include: { category: true, registrations: { select: { status: true } } },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
  });
}
type LoadedWorkshop = Awaited<ReturnType<typeof workshopsWithRegs>>[number];

type Ctx = { tz: string; now: Date; today: string; staff: Map<string, string>; campusLabel: Map<string, string>; classroomLabel: Map<string, string> };

async function context(inst: string): Promise<Ctx> {
  const [c, staff, loc] = await Promise.all([clock(inst), staffList(inst), locationOptions(inst)]);
  return {
    ...c,
    staff: new Map(staff.map((x) => [x.id, x.name])),
    campusLabel: new Map(loc.campuses.map((x) => [x.value, x.label])),
    classroomLabel: new Map(loc.classrooms.map((x) => [x.value, x.label.split(" · ").pop() ?? x.label])),
  };
}

function summary(w: LoadedWorkshop, ctx: Ctx) {
  const st = workshopSettings(w, ctx.tz);
  const phase = workshopPhase(w, st, ctx.today);
  const counts = { pending: 0, approved: 0, declined: 0, dropped: 0 };
  for (const r of w.registrations) counts[statusOf(r.status)] += 1;
  const seated = w.registrations.filter((r) => SEAT_STATUSES.includes(r.status)).length;
  return {
    id: w.id,
    code: w.code,
    title: w.title,
    category: w.category?.name ?? "",
    categoryAbbreviation: w.category?.abbreviation ?? "",
    instructors: st.instructors.map((id) => ctx.staff.get(id)).filter((x): x is string => Boolean(x)),
    status: phaseLabel(phase),
    phase,
    adminStatus: st.adminStatus,
    length: lengthLabel(st),
    startDate: st.startDate,
    endDate: st.continuous ? "" : st.endDate,
    continuous: st.continuous,
    schedule: scheduleLabel(st),
    campus: ctx.campusLabel.get(st.campus) ?? st.campus,
    classroom: ctx.classroomLabel.get(st.classroom) ?? "",
    capacity: w.capacity,
    seatsLeft: Math.max(0, w.capacity - seated),
    counts,
    privacy: st.privacy,
    approval: st.approval,
    fee: st.defaultFee,
    enrolmentCutoff: st.enrolmentCutoff,
    cutoffPassed: cutoffPassed(st, ctx.now, ctx.tz),
    hasImage: st.hasImage,
  };
}
export type WorkshopSummary = ReturnType<typeof summary>;

function isAvailable(x: WorkshopSummary) {
  return (x.phase === "upcoming" || x.phase === "active") && !x.cutoffPassed && x.seatsLeft > 0;
}

/* ------------------------------------------------------------------ */
/* Meta + sidebar counts                                                */
/* ------------------------------------------------------------------ */

export async function workshopMeta(user: SessionClaims) {
  await assertPermission(user, "courseManagement", "view");
  const inst = user.institutionId;
  const [categories, roles, staff, loc, r, courseRefs, levels, workshops] = await Promise.all([
    prisma.workshopCategory.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } }),
    prisma.workshopRole.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } }),
    staffList(inst),
    locationOptions(inst),
    refs(user),
    courseRefLists(inst),
    listAccessLevels(inst),
    prisma.workshop.findMany({ where: { institutionId: inst }, orderBy: { title: "asc" }, select: { id: true, code: true, title: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, abbreviation: c.abbreviation })),
    roles: roles.map((x) => ({ id: x.id, name: x.name, status: x.status })),
    instructors: staff,
    campuses: loc.campuses,
    classrooms: loc.classrooms,
    workshops: workshops.map((w) => ({ id: w.id, label: `${w.title} (${w.code})` })),
    gradingSchemes: workshopGradingSchemes(courseRefs.gradingSchemes, r.gradingSchemes),
    accessLevels: uniq([ALL_ACCESSES, ...levels.map((l) => l.name)]),
    studentStatuses: uniq([ALL_STATUSES, ...STUDENT_STATUSES]),
    programs: uniq([ALL_PROGRAMS, ...(r.programs ?? []), ...STUDENT_PROGRAMS.map((p) => p.name)]),
    campusAccess: uniq([ALL_CAMPUSES, ...loc.campuses.map((c) => c.label)]),
    competencies: r.competencies ?? [],
    options: {
      statuses: WORKSHOP_STATUSES,
      roleModes: ROLE_MODES,
      privacy: PRIVACY,
      approval: APPROVAL,
      scheduleTypes: SCHEDULE_TYPES,
      feeCollection: FEE_COLLECTION,
      lms: LMS,
      visibility: VISIBILITY,
      weekdays: WEEKDAYS,
      enrolmentStatuses: ENROLMENT_STATUSES,
      myFilters: MY_FILTERS,
      completion: COMPLETION_FILTERS,
    },
  };
}

export async function workshopCounts(user: SessionClaims, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const [regs, ws, ctx] = await Promise.all([
    prisma.workshopRegistration.findMany({ where: { institutionId: inst }, select: { status: true, workshopId: true } }),
    workshopsWithRegs(inst),
    context(inst),
  ]);
  const by = { pending: 0, approved: 0, declined: 0, dropped: 0 };
  for (const r of regs) if (inScope(scope, r.workshopId)) by[statusOf(r.status)] += 1;
  const rows = ws.filter((w) => inScope(scope, w.id)).map((w) => summary(w, ctx));
  return {
    pending: by.pending,
    approved: by.approved,
    declined: by.declined,
    available: rows.filter(isAvailable).length,
    completed: rows.filter((x) => x.phase === "completed").length,
  };
}

/* ------------------------------------------------------------------ */
/* Workshop listings                                                    */
/* ------------------------------------------------------------------ */

export async function myWorkshops(user: SessionClaims, filter: string, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const [ws, ctx] = await Promise.all([workshopsWithRegs(inst), context(inst)]);
  const wanted: Phase[] =
    filter === "Active Workshops" ? ["active"] : filter === "Upcoming Workshops" ? ["upcoming"] : filter === "Completed Workshops" ? ["completed"] : ["active", "upcoming"];
  const items = ws
    .filter((w) => workshopSettings(w, ctx.tz).instructors.includes(user.accountId))
    .map((w) => summary(w, ctx))
    .filter((x) => wanted.includes(x.phase));
  return { items };
}

export async function availableWorkshops(user: SessionClaims, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const [ws, ctx] = await Promise.all([workshopsWithRegs(inst), context(inst)]);
  return { items: ws.filter((w) => inScope(scope, w.id)).map((w) => summary(w, ctx)).filter(isAvailable) };
}

export async function completedWorkshops(user: SessionClaims, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const [ws, ctx] = await Promise.all([workshopsWithRegs(inst), context(inst)]);
  const items = ws
    .filter((w) => inScope(scope, w.id))
    .map((w) => summary(w, ctx))
    .filter((x) => x.phase === "completed")
    .sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));
  return { items };
}

export async function adminWorkshops(user: SessionClaims, q: { status?: string; completion?: string; q?: string }) {
  await assertPermission(user, "courseManagement", "view");
  const inst = user.institutionId;
  const [ws, ctx] = await Promise.all([workshopsWithRegs(inst), context(inst)]);
  const needle = lower(s(q.q));
  const items = ws
    .map((w) => summary(w, ctx))
    .filter((x) => !q.status || q.status === "all" || x.adminStatus === q.status)
    .filter((x) => {
      if (!q.completion || q.completion === "all") return true;
      if (q.completion === "Completed") return x.phase === "completed";
      return x.phase === "upcoming" || x.phase === "active";
    })
    .filter((x) => !needle || lower(x.title).includes(needle) || lower(x.code).includes(needle));
  return { items };
}

/* ------------------------------------------------------------------ */
/* Single workshop (view / edit)                                        */
/* ------------------------------------------------------------------ */

async function findWorkshop(inst: string, id: string) {
  const w = await prisma.workshop.findFirst({ where: { id, institutionId: inst }, include: { category: true, registrations: { select: { status: true } } } });
  if (!w) throw httpError(404, "Workshop not found", "NOT_FOUND");
  return w;
}

export async function getWorkshop(user: SessionClaims, id: string, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  assertInScope(scope, id);
  const inst = user.institutionId;
  const [w, ctx] = await Promise.all([findWorkshop(inst, id), context(inst)]);
  const settings = workshopSettings(w, ctx.tz);
  return {
    ...summary(w, ctx),
    categoryId: w.categoryId ?? "",
    settings,
    instructorOptions: settings.instructors.map((i) => ({ id: i, name: ctx.staff.get(i) ?? "Former staff member" })),
  };
}

export async function getWorkshopImage(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "view");
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: user.institutionId, screenId: IMAGE_SCREEN, contextKey: id, deletedAt: null } });
  if (!row) throw httpError(404, "No workshop image", "NOT_FOUND");
  const d = JSON.parse(row.dataJson) as { name?: string; dataUrl?: string };
  return { name: d.name ?? "", dataUrl: d.dataUrl ?? "" };
}

export type WorkshopBody = {
  categoryId?: string;
  title?: string;
  code?: string;
  image?: { name: string; dataUrl: string } | null;
  settings?: Partial<WorkshopSettings>;
};

function pick<T extends string>(v: unknown, allowed: readonly T[], label: string, fallback: T): T {
  if (v === undefined || v === null || v === "") return fallback;
  if (!(allowed as readonly string[]).includes(String(v))) throw httpError(400, `Choose a valid ${label}`);
  return v as T;
}

function amount(v: unknown, label: string) {
  const n = v === undefined || v === null || v === "" ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw httpError(400, `${label} must be between $0.00 and $1,000,000.00`);
  return Math.round(n * 100) / 100;
}

async function validate(user: SessionClaims, body: WorkshopBody, existingId: string | null) {
  const inst = user.institutionId;
  const st = body.settings ?? {};
  const title = s(body.title);
  if (!title) throw httpError(400, "Workshop Name is required");
  if (title.length > 200) throw httpError(400, "Workshop Name must be 200 characters or fewer");

  const categoryId = s(body.categoryId);
  if (categoryId && !(await prisma.workshopCategory.findFirst({ where: { id: categoryId, institutionId: inst } }))) throw httpError(400, "Choose a valid Workshop Category");

  let code = s(body.code).toUpperCase();
  if (code.length > 40) throw httpError(400, "Workshop Number must be 40 characters or fewer");
  if (code) {
    const clash = await prisma.workshop.findFirst({ where: { institutionId: inst, code, ...(existingId ? { id: { not: existingId } } : {}) }, select: { id: true } });
    if (clash) throw httpError(409, `Workshop Number ${code} is already used by another workshop`, "CONFLICT");
  } else {
    const base = `WS-${title.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "WORKSHOP"}`;
    const taken = new Set((await prisma.workshop.findMany({ where: { institutionId: inst, code: { startsWith: base } }, select: { code: true } })).map((x) => x.code));
    code = base;
    for (let n = 2; taken.has(code); n++) code = `${base}-${n}`;
  }

  const [staff, loc, roles, levels, r, courseRefs] = await Promise.all([
    staffList(inst),
    locationOptions(inst),
    prisma.workshopRole.findMany({ where: { institutionId: inst } }),
    listAccessLevels(inst),
    refs(user),
    courseRefLists(inst),
  ]);

  const adminStatus = pick(st.adminStatus, WORKSHOP_STATUSES, "Status", "Active");
  const campus = s(st.campus);
  if (campus && !loc.campuses.some((c) => c.value === campus)) throw httpError(400, "Choose a valid Campus / Location");
  const instructors = [...new Set((st.instructors ?? []).map(s).filter(Boolean))];
  const staffIds = new Set(staff.map((x) => x.id));
  if (instructors.some((i) => !staffIds.has(i))) throw httpError(400, "One of the selected instructors is not an active staff member");
  const classroom = s(st.classroom);
  const room = classroom ? loc.classrooms.find((c) => c.value === classroom) : undefined;
  if (classroom && !room) throw httpError(400, "Choose a valid Classroom");
  if (room && campus && room.campus !== campus && loc.campuses.some((c) => c.value === room.campus)) throw httpError(400, "The selected Classroom belongs to a different campus");

  const enrolmentCutoff = s(st.enrolmentCutoff);
  if (enrolmentCutoff && !DATETIME.test(enrolmentCutoff)) throw httpError(400, "Enrolment Cut-off must be a valid date and time");

  const rolesMode = pick(st.rolesMode, ROLE_MODES, "Workshop Roles option", "Disabled");
  const roleIds = rolesMode === "Enabled" ? [...new Set((st.roleIds ?? []).map(s).filter(Boolean))] : [];
  if (rolesMode === "Enabled") {
    if (!roleIds.length) throw httpError(400, "Select at least one workshop role, or set Workshop Roles to Disabled");
    const activeRoles = new Set(roles.filter((x) => x.status === "Active").map((x) => x.id));
    if (roleIds.some((id) => !activeRoles.has(id))) throw httpError(400, "Only active workshop roles can be used");
  }

  const sameAsClassroom = st.sameAsClassroom === true;
  let capacity: number;
  if (sameAsClassroom) {
    if (!room) throw httpError(400, "Select a Classroom, or untick “Same as classroom size” and enter Maximum Enrolments");
    if (!(room.size > 0)) throw httpError(400, "The selected classroom has no size set; untick “Same as classroom size” and enter Maximum Enrolments");
    capacity = room.size;
  } else {
    capacity = Number(st.maxEnrolments);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw httpError(400, "Maximum Enrolments must be a whole number between 1 and 10,000");
  }
  if (existingId) {
    const seated = await prisma.workshopRegistration.count({ where: { workshopId: existingId, status: { in: SEAT_STATUSES } } });
    if (capacity < seated) throw httpError(400, `Maximum Enrolments cannot be lower than the ${seated} seat(s) already taken`);
  }

  const privacy = pick(st.privacy, PRIVACY, "Workshop Privacy", "Private Workshop");
  const approval = pick(st.approval, APPROVAL, "Enrolment Approval", "Manual Decision");
  const hours = st.hours === undefined || (st.hours as unknown) === "" ? 0 : Number(st.hours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 10000) throw httpError(400, "Workshop Hours must be between 0 and 10,000");
  const continuous = st.continuous === true;
  const startDate = s(st.startDate);
  if (!ISO.test(startDate)) throw httpError(400, "Start Date is required");
  const endDate = continuous ? "" : s(st.endDate);
  if (!continuous) {
    if (!ISO.test(endDate)) throw httpError(400, "End Date is required unless this is a continuous feed-in workshop");
    if (endDate < startDate) throw httpError(400, "End Date must be on or after Start Date");
  }
  const scheduleType = pick(st.scheduleType, SCHEDULE_TYPES, "Schedule Type", "Weekly Schedule");
  let sessions: WorkshopSettings["sessions"] = [];
  let dailyStart = "";
  let dailyEnd = "";
  const checkTimes = (a: string, b: string, label: string) => {
    if (!HM.test(a) || !HM.test(b)) throw httpError(400, `Enter a start and end time for ${label}`);
    if (b <= a) throw httpError(400, `End time must be after start time for ${label}`);
  };
  if (scheduleType === "Weekly Schedule") {
    const seen = new Set<string>();
    for (const x of st.sessions ?? []) {
      const day = s(x?.day);
      if (!(WEEKDAYS as readonly string[]).includes(day) || seen.has(day)) continue;
      seen.add(day);
      const start = s(x.start);
      const end = s(x.end);
      checkTimes(start, end, day);
      sessions.push({ day, start, end });
    }
    if (!sessions.length) throw httpError(400, "Select at least one day for the Weekly Schedule");
    sessions = sessions.sort((a, b) => WEEKDAYS.indexOf(a.day as never) - WEEKDAYS.indexOf(b.day as never));
  } else {
    dailyStart = s(st.dailyStart);
    dailyEnd = s(st.dailyEnd);
    checkTimes(dailyStart, dailyEnd, "the Daily Schedule");
  }

  const feeCollection = pick(st.feeCollection, FEE_COLLECTION, "Fee Collection", "Immediately");
  const gradingSchemes = workshopGradingSchemes(courseRefs.gradingSchemes, r.gradingSchemes);
  const gradingScheme = pick(st.gradingScheme, gradingSchemes, "Grading Scheme", NO_GRADING);
  const campusAccess = pick(st.campusAccess, [ALL_CAMPUSES, ...loc.campuses.map((c) => c.label)], "Campus Access", ALL_CAMPUSES);
  const accessLevels = pick(st.accessLevels, [ALL_ACCESSES, ...levels.map((l) => l.name)], "Access Level", ALL_ACCESSES);
  const studentStatuses = pick(st.studentStatuses, [ALL_STATUSES, ...STUDENT_STATUSES], "Student Status", ALL_STATUSES);
  const programOfStudy = pick(st.programOfStudy, [ALL_PROGRAMS, ...(r.programs ?? []), ...STUDENT_PROGRAMS.map((p) => p.name)], "Program of Study", ALL_PROGRAMS);

  const descriptionHtml = typeof st.descriptionHtml === "string" ? st.descriptionHtml.slice(0, 200_000) : "";
  const introduction = s(st.introduction).slice(0, 4000);

  let image: { name: string; dataUrl: string; size: number } | null | undefined;
  if (body.image === null) image = null;
  else if (body.image) {
    const m = /^data:([^;,]+);base64,(.+)$/.exec(body.image.dataUrl ?? "");
    if (!m || !IMAGE_TYPES.test(m[1].toLowerCase())) throw httpError(400, "Workshop Image must be a PNG, JPG, GIF or WebP image");
    const size = Math.floor((m[2].length * 3) / 4);
    if (size > IMAGE_MAX) throw httpError(400, "Workshop Image must be 2 MB or smaller");
    image = { name: s(body.image.name).slice(0, 200) || "workshop-image", dataUrl: body.image.dataUrl, size };
  }

  const settings: Omit<WorkshopSettings, "hasImage"> = {
    introduction,
    descriptionHtml,
    adminStatus,
    campus,
    instructors,
    classroom,
    enrolmentCutoff,
    rolesMode,
    roleIds,
    maxEnrolments: capacity,
    sameAsClassroom,
    privacy,
    approval,
    hours: Math.round(hours * 100) / 100,
    continuous,
    startDate,
    endDate,
    scheduleType,
    sessions,
    dailyStart,
    dailyEnd,
    feeCollection,
    defaultFee: amount(st.defaultFee, "Workshop Default Fee"),
    domesticFee: amount(st.domesticFee, "Domestic fee"),
    internationalFee: amount(st.internationalFee, "International fee"),
    gradingScheme,
    lms: pick(st.lms, LMS, "Enable LMS option", "Disabled"),
    campusAccess,
    accessLevels,
    studentStatuses,
    programOfStudy,
    grades: pick(st.grades, VISIBILITY, "Grades visibility", "Visible"),
    badges: pick(st.badges, VISIBILITY, "Badges visibility", "Visible"),
  };
  const campusName = loc.campuses.find((c) => c.value === campus)?.label ?? "";
  const location = [campusName, room?.label.split(" · ").pop()].filter(Boolean).join(" · ") || null;
  return { title, code, categoryId: categoryId || null, capacity, settings, image, location };
}

async function storeImage(user: SessionClaims, workshopId: string, image: { name: string; dataUrl: string; size: number } | null) {
  const inst = user.institutionId;
  const existing = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: IMAGE_SCREEN, contextKey: workshopId } });
  if (image === null) {
    if (existing) await prisma.heritageRecord.delete({ where: { id: existing.id } });
    return false;
  }
  const dataJson = JSON.stringify(image);
  if (existing) await prisma.heritageRecord.update({ where: { id: existing.id }, data: { dataJson, deletedAt: null, updatedById: user.accountId, rowVersion: { increment: 1 } } });
  else await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: IMAGE_SCREEN, contextKey: workshopId, singletonKey: "image", dataJson, createdById: user.accountId, updatedById: user.accountId } });
  return true;
}

export async function saveWorkshop(user: SessionClaims, id: string | null, body: WorkshopBody) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const before = id ? await findWorkshop(inst, id) : null;
  const v = await validate(user, body, id);
  const { tz, today } = await clock(inst);
  const first = v.settings.scheduleType === "Daily Schedule" ? v.settings.dailyStart : (v.settings.sessions[0]?.start ?? "00:00");
  const last = v.settings.scheduleType === "Daily Schedule" ? v.settings.dailyEnd : (v.settings.sessions[v.settings.sessions.length - 1]?.end ?? "23:59");
  const startsAt = zonedToUtc(v.settings.startDate, first, tz);
  const endsAt = v.settings.continuous ? null : zonedToUtc(v.settings.endDate, last, tz);
  const prevSettings = before ? workshopSettings(before, tz) : null;
  const hasImage = v.image === undefined ? Boolean(prevSettings?.hasImage) : v.image !== null;
  const settings: WorkshopSettings = { ...v.settings, hasImage };
  const phase = workshopPhase({ status: "upcoming" } as Parameters<typeof workshopPhase>[0], settings, today);
  const data = {
    code: v.code,
    title: v.title,
    description: stripHtml(settings.descriptionHtml) || settings.introduction,
    categoryId: v.categoryId,
    startsAt,
    endsAt,
    location: v.location,
    capacity: v.capacity,
    status: storedStatus(phase),
    settingsJson: JSON.stringify(settings),
    creditsCeu: settings.hours > 0 ? Math.round((settings.hours / 10) * 100) / 100 : 0,
  };
  const saved = before
    ? await prisma.workshop.update({ where: { id: before.id }, data: { ...data, rowVersion: { increment: 1 } } })
    : await prisma.workshop.create({ data: { ...data, institutionId: inst } });
  if (v.image !== undefined) await storeImage(user, saved.id, v.image);
  await audit(user, "C18", `workshop:${saved.id}`, before ? "workshop.updated" : "workshop.created", {
    recordId: saved.id,
    before: before ? { title: before.title, code: before.code, capacity: before.capacity, settings: prevSettings } : undefined,
    after: { title: data.title, code: data.code, capacity: data.capacity, settings },
  });
  return { id: saved.id, message: `Workshop ${saved.title} ${before ? "updated" : "created"}` };
}

export async function deleteWorkshop(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const w = await findWorkshop(inst, id);
  const [regs, marks] = await Promise.all([
    prisma.workshopRegistration.count({ where: { workshopId: id } }),
    prisma.workshopAttendance.count({ where: { workshopId: id } }),
  ]);
  if (regs || marks) {
    throw httpError(409, `${w.title} has ${regs} enrolment(s)${marks ? ` and ${marks} attendance record(s)` : ""}. Set its Status to Inactive instead of deleting it.`, "CONFLICT");
  }
  await prisma.$transaction([
    prisma.heritageRecord.deleteMany({ where: { institutionId: inst, screenId: IMAGE_SCREEN, contextKey: id } }),
    prisma.workshop.delete({ where: { id } }),
  ]);
  await audit(user, "C17", `workshop:${id}`, "workshop.deleted", { recordId: id, before: { title: w.title, code: w.code } });
  return { message: `Workshop ${w.title} deleted` };
}

/* ------------------------------------------------------------------ */
/* Categories                                                           */
/* ------------------------------------------------------------------ */

export async function listCategories(user: SessionClaims) {
  await assertPermission(user, "courseManagement", "view");
  const rows = await prisma.workshopCategory.findMany({
    where: { institutionId: user.institutionId },
    include: { _count: { select: { workshops: true } } },
    orderBy: { name: "asc" },
  });
  return { items: rows.map((c) => ({ id: c.id, name: c.name, abbreviation: c.abbreviation, workshops: c._count.workshops })) };
}

export async function saveCategory(user: SessionClaims, id: string | null, body: { name?: string; abbreviation?: string }) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const name = s(body.name);
  const abbreviation = s(body.abbreviation).toUpperCase();
  if (!name) throw httpError(400, "Name is required");
  if (name.length > 120) throw httpError(400, "Name must be 120 characters or fewer");
  if (abbreviation.length > 20) throw httpError(400, "Abbreviation must be 20 characters or fewer");
  const all = await prisma.workshopCategory.findMany({ where: { institutionId: inst } });
  const others = all.filter((c) => c.id !== id);
  if (others.some((c) => lower(c.name) === lower(name))) throw httpError(409, `A workshop category named ${name} already exists`, "CONFLICT");
  if (abbreviation && others.some((c) => lower(c.abbreviation) === lower(abbreviation))) throw httpError(409, `Abbreviation ${abbreviation} is already used`, "CONFLICT");
  const before = id ? all.find((c) => c.id === id) : null;
  if (id && !before) throw httpError(404, "Workshop category not found", "NOT_FOUND");
  const saved = before
    ? await prisma.workshopCategory.update({ where: { id: before.id }, data: { name, abbreviation, rowVersion: { increment: 1 } } })
    : await prisma.workshopCategory.create({ data: { institutionId: inst, name, abbreviation } });
  await audit(user, "C17", `workshop-category:${saved.id}`, before ? "category.updated" : "category.created", {
    recordId: saved.id,
    before: before ? { name: before.name, abbreviation: before.abbreviation } : undefined,
    after: { name, abbreviation },
  });
  return { id: saved.id, message: `Workshop category ${name} ${before ? "updated" : "saved"}` };
}

export async function deleteCategory(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "edit");
  const c = await prisma.workshopCategory.findFirst({ where: { id, institutionId: user.institutionId }, include: { _count: { select: { workshops: true } } } });
  if (!c) throw httpError(404, "Workshop category not found", "NOT_FOUND");
  if (c._count.workshops) throw httpError(409, `${c.name} is used by ${c._count.workshops} workshop(s). Move them to another category first.`, "CONFLICT");
  await prisma.workshopCategory.delete({ where: { id } });
  await audit(user, "C17", `workshop-category:${id}`, "category.deleted", { recordId: id, before: { name: c.name, abbreviation: c.abbreviation } });
  return { message: `Workshop category ${c.name} deleted` };
}

/* ------------------------------------------------------------------ */
/* Workshop roles                                                       */
/* ------------------------------------------------------------------ */

type Outcome = { value: string; grantsCompletion: "Yes" | "No" };

function roleView(r: { id: string; name: string; status: string; outcomesJson: string; competenciesJson: string; updatedAt: Date }) {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    outcomes: parseArr<Outcome>(r.outcomesJson),
    competencies: parseArr<string>(r.competenciesJson),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listRoles(user: SessionClaims) {
  await assertPermission(user, "courseManagement", "view");
  const rows = await prisma.workshopRole.findMany({ where: { institutionId: user.institutionId }, orderBy: { name: "asc" } });
  return { items: rows.map(roleView) };
}

export async function getRole(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "view");
  const r = await prisma.workshopRole.findFirst({ where: { id, institutionId: user.institutionId } });
  if (!r) throw httpError(404, "Workshop role not found", "NOT_FOUND");
  return roleView(r);
}

export async function saveRole(
  user: SessionClaims,
  id: string | null,
  body: { name?: string; status?: string; outcomes?: Array<{ value?: string; grantsCompletion?: string }>; competencies?: string[] },
) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const name = s(body.name);
  if (!name) throw httpError(400, "Name is required");
  if (name.length > 120) throw httpError(400, "Name must be 120 characters or fewer");
  const status = pick(body.status, ["Active", "Inactive"] as const, "Status", "Active");
  const outcomes: Outcome[] = (body.outcomes ?? [])
    .map((o) => ({ value: s(o?.value).slice(0, 2000), grantsCompletion: (o?.grantsCompletion === "No" ? "No" : "Yes") as Outcome["grantsCompletion"] }))
    .filter((o) => o.value);
  if (!outcomes.length) throw httpError(400, "Enter at least one Outcome Value");
  const competencies = [...new Set((body.competencies ?? []).map(s).filter(Boolean))].slice(0, 50);
  const clash = await prisma.workshopRole.findFirst({ where: { institutionId: inst, name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw httpError(409, `A workshop role named ${name} already exists`, "CONFLICT");
  const before = id ? await prisma.workshopRole.findFirst({ where: { id, institutionId: inst } }) : null;
  if (id && !before) throw httpError(404, "Workshop role not found", "NOT_FOUND");
  if (before && status === "Inactive" && before.status === "Active") {
    const tz = await institutionTimezone(inst);
    const using = (await prisma.workshop.findMany({ where: { institutionId: inst } })).filter((w) => {
      const st = workshopSettings(w, tz);
      return st.rolesMode === "Enabled" && st.roleIds.includes(before.id) && st.adminStatus === "Active";
    });
    if (using.length) throw httpError(409, `${name} is used by ${using.map((w) => w.title).join(", ")}. Remove it from those workshops before making it inactive.`, "CONFLICT");
  }
  const data = { name, status, outcomesJson: JSON.stringify(outcomes), competenciesJson: JSON.stringify(competencies) };
  const saved = before
    ? await prisma.workshopRole.update({ where: { id: before.id }, data: { ...data, rowVersion: { increment: 1 } } })
    : await prisma.workshopRole.create({ data: { ...data, institutionId: inst } });
  await audit(user, "C23", `workshop-role:${saved.id}`, before ? "role.updated" : "role.created", {
    recordId: saved.id,
    before: before ? roleView(before) : undefined,
    after: { name, status, outcomes, competencies },
  });
  return { id: saved.id, message: `Workshop role ${name} ${before ? "updated" : "saved"}` };
}

export async function deleteRole(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const r = await prisma.workshopRole.findFirst({ where: { id, institutionId: inst } });
  if (!r) throw httpError(404, "Workshop role not found", "NOT_FOUND");
  const tz = await institutionTimezone(inst);
  const [regs, workshops] = await Promise.all([
    prisma.workshopRegistration.count({ where: { institutionId: inst, roleId: id } }),
    prisma.workshop.findMany({ where: { institutionId: inst } }),
  ]);
  const using = workshops.filter((w) => workshopSettings(w, tz).roleIds.includes(id));
  if (regs || using.length) {
    throw httpError(409, `${r.name} is assigned to ${using.length} workshop(s) and ${regs} enrolment(s). Set it to Inactive instead.`, "CONFLICT");
  }
  await prisma.workshopRole.delete({ where: { id } });
  await audit(user, "C23", `workshop-role:${id}`, "role.deleted", { recordId: id, before: roleView(r) });
  return { message: `Workshop role ${r.name} deleted` };
}

/* ------------------------------------------------------------------ */
/* Enrolments                                                           */
/* ------------------------------------------------------------------ */

const studentInclude = { person: { include: { accounts: { select: { email: true } } } }, cohort: { include: { program: true } } } as const;

function studentView(st: {
  id: string;
  studentNumber: string;
  programName: string;
  person: { givenName: string; familyName: string; preferredName: string | null; email: string; accounts: Array<{ email: string }> };
  cohort: { program: { code: string } } | null;
}) {
  return {
    id: st.id,
    name: `${st.person.familyName}, ${st.person.givenName}`,
    preferredName: st.person.preferredName ?? "",
    familyName: st.person.familyName,
    studentNumber: st.studentNumber,
    login: st.person.accounts[0]?.email ?? st.person.email,
    programCode: st.cohort?.program.code ?? STUDENT_PROGRAMS.find((p) => p.name === st.programName)?.code ?? "",
  };
}

export async function searchStudents(user: SessionClaims, q: string) {
  await assertPermission(user, "courseManagement", "view");
  const term = s(q);
  if (term.length < 2) return { items: [] };
  const rows = await prisma.student.findMany({
    where: {
      institutionId: user.institutionId,
      OR: [
        { studentNumber: { contains: term, mode: "insensitive" } },
        { person: { familyName: { contains: term, mode: "insensitive" } } },
        { person: { givenName: { contains: term, mode: "insensitive" } } },
        { person: { email: { contains: term, mode: "insensitive" } } },
        { person: { accounts: { some: { email: { contains: term, mode: "insensitive" } } } } },
      ],
    },
    include: studentInclude,
    take: 15,
    orderBy: { studentNumber: "asc" },
  });
  return { items: rows.map(studentView) };
}

export type EnrolmentQuery = { student?: string; workshop?: string; status?: string; letter?: string; page: number; perPage: number };

export async function listEnrolments(user: SessionClaims, q: EnrolmentQuery, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const [regs, roles] = await Promise.all([
    prisma.workshopRegistration.findMany({
      where: { institutionId: inst, ...(q.workshop && q.workshop !== "all" ? { workshopId: q.workshop } : {}) },
      include: { workshop: true, student: { include: studentInclude } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    prisma.workshopRole.findMany({ where: { institutionId: inst }, select: { id: true, name: true } }),
  ]);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const status = q.status && lower(q.status) !== "all" ? statusOf(q.status) : null;
  const needle = lower(s(q.student));
  const letter = s(q.letter).toUpperCase();
  const rows = regs
    .filter((r) => inScope(scope, r.workshopId))
    .map((r) => ({ r, st: statusOf(r.status), who: studentView(r.student) }))
    .filter((x) => !status || x.st === status)
    .filter((x) => !/^[A-Z]$/.test(letter) || x.who.familyName.toUpperCase().startsWith(letter))
    .filter((x) => !needle || lower(x.who.studentNumber).includes(needle) || lower(x.who.login).includes(needle) || lower(x.who.familyName).includes(needle))
    .sort((a, b) => a.who.name.localeCompare(b.who.name) || b.r.createdAt.getTime() - a.r.createdAt.getTime());
  const perPage = Math.min(Math.max(q.perPage, 1), 500);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Math.max(q.page, 1), pages);
  return {
    total: rows.length,
    page,
    pages,
    perPage,
    items: rows.slice((page - 1) * perPage, page * perPage).map(({ r, st, who }) => ({
      id: r.id,
      student: who,
      workshop: { id: r.workshop.id, title: r.workshop.title, code: r.workshop.code },
      role: r.roleId ? (roleName.get(r.roleId) ?? "") : "",
      status: statusLabel(st),
      note: r.note,
      enrolledAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

async function loadEnrolment(inst: string, id: string) {
  const r = await prisma.workshopRegistration.findFirst({ where: { id, institutionId: inst }, include: { workshop: true, student: { include: studentInclude } } });
  if (!r) throw httpError(404, "Workshop enrolment not found", "NOT_FOUND");
  return r;
}

async function residencyOf(inst: string, studentId: string) {
  return (await studentMetaMap(inst))[studentId]?.residency;
}

export async function createEnrolment(
  user: SessionClaims,
  body: { studentId?: string; workshopId?: string; roleId?: string; note?: string },
  scope?: WorkshopScope,
) {
  await gate(user, "edit", scope);
  const inst = user.institutionId;
  const studentId = s(body.studentId);
  const workshopId = s(body.workshopId);
  if (!studentId) throw httpError(400, "Select a user from the search results");
  if (!workshopId) throw httpError(400, "Please select a workshop");
  assertInScope(scope, workshopId);
  const [student, workshop, { tz, today }] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, institutionId: inst }, include: studentInclude }),
    prisma.workshop.findFirst({ where: { id: workshopId, institutionId: inst } }),
    clock(inst),
  ]);
  if (!student) throw httpError(400, "The selected user is not a student of this institution");
  if (!workshop) throw httpError(404, "Workshop not found", "NOT_FOUND");
  const st = workshopSettings(workshop, tz);
  const phase = workshopPhase(workshop, st, today);
  if (phase === "inactive") throw httpError(409, `${workshop.title} is inactive and not accepting enrolments`, "CONFLICT");
  if (phase === "completed") throw httpError(409, `${workshop.title} has already been completed`, "CONFLICT");
  let roleId: string | null = null;
  if (st.rolesMode === "Enabled") {
    roleId = s(body.roleId);
    if (!roleId) throw httpError(400, "Select a Workshop Role");
    if (!st.roleIds.includes(roleId)) throw httpError(400, "Choose one of this workshop's roles");
  }
  const status: EnrolmentStatus = st.approval === "Automatic Approval" ? "approved" : "pending";
  const note = s(body.note).slice(0, 2000) || "Enrolled by administrator";
  const fee = feeFor(st, await residencyOf(inst, student.id));
  const postFee = st.feeCollection === "Immediately" || (st.feeCollection === "Upon Approval" && status === "approved");
  const reg = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workshop-seats:${workshop.id}`}))`;
    const existing = await tx.workshopRegistration.findFirst({
      where: { institutionId: inst, workshopId: workshop.id, studentId: student.id },
    });
    if (existing && ["pending", "approved", "registered", "completed"].includes(existing.status)) {
      throw httpError(409, `${student.person.givenName} ${student.person.familyName} is already enrolled in ${workshop.title} (${statusLabel(statusOf(existing.status))})`, "CONFLICT");
    }
    const seated = await tx.workshopRegistration.count({
      where: { workshopId: workshop.id, status: { in: [...SEAT_STATUSES] }, ...(existing ? { id: { not: existing.id } } : {}) },
    });
    if (seated >= workshop.capacity) throw httpError(409, `${workshop.title} is full (${workshop.capacity} of ${workshop.capacity} seats taken)`, "CONFLICT");
    const saved = existing
      ? await tx.workshopRegistration.update({ where: { id: existing.id }, data: { status, note, roleId, rowVersion: { increment: 1 } } })
      : await tx.workshopRegistration.create({ data: { institutionId: inst, workshopId: workshop.id, studentId: student.id, status, note, roleId } });
    if (postFee) await postWorkshopFee(tx, { institutionId: inst, registrationId: saved.id, studentId: student.id, workshop, amount: fee });
    await writeAuditAndOutbox(tx, {
      institutionId: inst,
      actorId: user.accountId,
      eventName: "WorkshopEnrolment.created",
      purpose: "workshop_enrolment",
      before: existing ? { status: existing.status } : null,
      after: { registrationId: saved.id, workshopId: workshop.id, studentId: student.id, status, roleId, fee: postFee ? fee : 0 },
      source: "workshops.enrolment.create",
      correlationId: randomUUID(),
    });
    return saved;
  });
  const who = `${student.person.familyName}, ${student.person.givenName}`;
  return {
    id: reg.id,
    status: statusLabel(status),
    message: `${who} enrolled in ${workshop.title} — ${status === "approved" ? "approved automatically" : "pending approval"}${postFee && fee > 0 ? `; workshop fee ${money(fee)} posted` : ""}`,
  };
}

export async function createEnrolments(
  user: SessionClaims,
  body: { studentIds?: string[]; workshopId?: string; roleId?: string; note?: string },
  scope?: WorkshopScope,
) {
  await gate(user, "edit", scope);
  const studentIds = [...new Set((body.studentIds ?? []).map(s).filter(Boolean))];
  if (!studentIds.length) throw httpError(400, "Select at least one student from the search results");
  if (studentIds.length > 50) throw httpError(400, "You can enrol up to 50 students at a time");

  const enrolled: Array<{ studentId: string; id: string; status: string; message: string }> = [];
  const failed: Array<{ studentId: string; message: string }> = [];
  for (const studentId of studentIds) {
    try {
      const result = await createEnrolment(user, { ...body, studentId }, scope);
      enrolled.push({ studentId, ...result });
    } catch (error) {
      failed.push({ studentId, message: error instanceof Error ? error.message : "Could not enrol this student" });
    }
  }
  return {
    enrolled,
    failed,
    message: `${enrolled.length} student${enrolled.length === 1 ? "" : "s"} enrolled${failed.length ? `; ${failed.length} failed` : ""}`,
    status: enrolled[0]?.status ?? "Pending",
  };
}

const TRANSITIONS: Record<EnrolmentStatus, EnrolmentStatus[]> = {
  pending: ["approved", "declined"],
  approved: ["dropped"],
  declined: ["pending"],
  dropped: ["pending"],
};

export async function setEnrolmentStatus(user: SessionClaims, id: string, next: string, note?: string, scope?: WorkshopScope) {
  await gate(user, "edit", scope);
  const inst = user.institutionId;
  const target = statusOf(next);
  const r = await loadEnrolment(inst, id);
  assertInScope(scope, r.workshopId);
  const current = statusOf(r.status);
  if (!TRANSITIONS[current].includes(target)) throw httpError(409, `A ${statusLabel(current).toLowerCase()} enrolment cannot be changed to ${statusLabel(target).toLowerCase()}`, "CONFLICT");
  const tz = await institutionTimezone(inst);
  const st = workshopSettings(r.workshop, tz);
  const fee = feeFor(st, await residencyOf(inst, r.studentId));
  let feeMsg = "";
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workshop-seats:${r.workshopId}`}))`;
    if (target === "approved" || target === "pending") {
      const seated = await tx.workshopRegistration.count({ where: { workshopId: r.workshopId, status: { in: [...SEAT_STATUSES] }, id: { not: r.id } } });
      if (seated >= r.workshop.capacity) throw httpError(409, `${r.workshop.title} is full (${r.workshop.capacity} seats)`, "CONFLICT");
    }
    const changed = await tx.workshopRegistration.updateMany({
      where: { id: r.id, institutionId: inst, status: r.status, rowVersion: r.rowVersion },
      data: { status: target, ...(note && s(note) ? { note: s(note).slice(0, 2000) } : {}), rowVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw httpError(409, "This enrolment changed; reload and try again", "CONFLICT");
    if (target === "approved" && st.feeCollection === "Upon Approval") {
      const posted = await postWorkshopFee(tx, { institutionId: inst, registrationId: r.id, studentId: r.studentId, workshop: r.workshop, amount: fee });
      if (posted && fee > 0) feeMsg = `; workshop fee ${money(fee)} posted`;
    }
    if (target === "pending" && st.feeCollection === "Immediately") {
      await postWorkshopFee(tx, { institutionId: inst, registrationId: r.id, studentId: r.studentId, workshop: r.workshop, amount: fee });
    }
    if (target === "declined" || target === "dropped") {
      const waived = await waiveWorkshopFee(tx, inst, r.id, `Waived — enrolment ${target}`);
      if (waived) feeMsg = "; unpaid workshop fee waived";
    }
    await writeAuditAndOutbox(tx, {
      institutionId: inst,
      actorId: user.accountId,
      eventName: `WorkshopEnrolment.${target}`,
      purpose: "workshop_enrolment",
      before: { registrationId: r.id, status: current },
      after: { registrationId: r.id, workshopId: r.workshopId, status: target, note: s(note) || null },
      source: "workshops.enrolment.status",
      correlationId: randomUUID(),
    });
  });
  return { status: statusLabel(target), message: `${r.student.person.familyName}, ${r.student.person.givenName} — ${r.workshop.title}: ${statusLabel(target).toLowerCase()}${feeMsg}` };
}

export async function deleteEnrolment(user: SessionClaims, id: string) {
  await assertPermission(user, "courseManagement", "edit");
  const inst = user.institutionId;
  const r = await loadEnrolment(inst, id);
  const marks = await prisma.workshopAttendance.count({ where: { workshopId: r.workshopId, studentId: r.studentId } });
  if (marks) throw httpError(409, `Attendance has been recorded for this enrolment; drop it instead of deleting it.`, "CONFLICT");
  await prisma.$transaction(async (tx) => {
    await waiveWorkshopFee(tx, inst, r.id, "Waived — enrolment deleted");
    await tx.workshopRegistration.delete({ where: { id: r.id } });
    await writeAuditAndOutbox(tx, {
      institutionId: inst,
      actorId: user.accountId,
      eventName: "WorkshopEnrolment.deleted",
      purpose: "workshop_enrolment",
      before: { registrationId: r.id, workshopId: r.workshopId, studentId: r.studentId, status: r.status },
      after: null,
      source: "workshops.enrolment.delete",
      correlationId: randomUUID(),
    });
  });
  return { message: `Enrolment for ${r.student.person.familyName}, ${r.student.person.givenName} in ${r.workshop.title} deleted` };
}

/* ------------------------------------------------------------------ */
/* Attendance                                                           */
/* ------------------------------------------------------------------ */

async function approvedRoster(inst: string, workshopFilter: string, scope?: WorkshopScope) {
  const rows = await prisma.workshop.findMany({
    where: { institutionId: inst, ...(workshopFilter && workshopFilter !== "all" ? { id: workshopFilter } : {}) },
    include: { registrations: { where: { status: { in: ["approved", "registered", "completed"] } }, include: { student: { include: studentInclude } } } },
    orderBy: { title: "asc" },
  });
  return rows.filter((w) => inScope(scope, w.id));
}

export async function attendanceDay(user: SessionClaims, q: { date?: string; student?: string; workshop?: string }, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const { tz, today } = await clock(inst);
  const date = ISO.test(s(q.date)) ? s(q.date) : today;
  const needle = lower(s(q.student));
  const ws = (await approvedRoster(inst, s(q.workshop), scope)).filter((w) => {
    const st = workshopSettings(w, tz);
    return workshopPhase(w, st, date) !== "inactive" && meetsOn(st, date);
  });
  const marks = ws.length
    ? await prisma.workshopAttendance.findMany({ where: { institutionId: inst, attendedOn: date, workshopId: { in: ws.map((w) => w.id) } } })
    : [];
  const markBy = new Map(marks.map((m) => [`${m.workshopId}:${m.studentId}`, m]));
  const groups = ws
    .map((w) => {
      const st = workshopSettings(w, tz);
      const students = w.registrations
        .map((r) => ({ r, who: studentView(r.student) }))
        .filter(({ who }) => !needle || lower(who.studentNumber).includes(needle) || lower(who.familyName).includes(needle))
        .sort((a, b) => a.who.name.localeCompare(b.who.name))
        .map(({ who }) => {
          const m = markBy.get(`${w.id}:${who.id}`);
          return { student: who, status: (m?.status ?? "") as "" | "present" | "absent", note: m?.note ?? "" };
        });
      return { workshop: { id: w.id, title: w.title, code: w.code, time: sessionTimeOn(st, date), location: w.location ?? "" }, students };
    })
    .filter((g) => g.students.length);
  return { date, previous: addDays(date, -1), next: addDays(date, 1), groups, total: groups.reduce((n, g) => n + g.students.length, 0) };
}

export async function saveAttendance(
  user: SessionClaims,
  body: { date?: string; marks?: Array<{ workshopId?: string; studentId?: string; status?: string; note?: string }> },
  scope?: WorkshopScope,
) {
  await gate(user, "edit", scope);
  const inst = user.institutionId;
  const date = s(body.date);
  if (!ISO.test(date)) throw httpError(400, "Choose a valid attendance date");
  const marks = (body.marks ?? []).map((m) => ({ workshopId: s(m.workshopId), studentId: s(m.studentId), status: lower(s(m.status)), note: s(m.note).slice(0, 500) }));
  if (!marks.length) throw httpError(400, "There is no attendance to save");
  const tz = await institutionTimezone(inst);
  const ids = [...new Set(marks.map((m) => m.workshopId))];
  const ws = await approvedRoster(inst, "", scope);
  const byId = new Map(ws.filter((w) => ids.includes(w.id)).map((w) => [w.id, w]));
  for (const m of marks) {
    const w = byId.get(m.workshopId);
    if (!w) throw httpError(400, "Attendance refers to an unknown workshop");
    if (!meetsOn(workshopSettings(w, tz), date)) throw httpError(400, `${w.title} does not meet on ${date}`);
    if (!w.registrations.some((r) => r.studentId === m.studentId)) throw httpError(400, `A student is not an approved participant of ${w.title}`);
    if (!["present", "absent", ""].includes(m.status)) throw httpError(400, "Attendance must be Present or Absent");
  }
  let saved = 0;
  let cleared = 0;
  await prisma.$transaction(async (tx) => {
    for (const m of marks) {
      const key = { workshopId_studentId_attendedOn: { workshopId: m.workshopId, studentId: m.studentId, attendedOn: date } };
      if (!m.status) {
        const r = await tx.workshopAttendance.deleteMany({ where: { institutionId: inst, workshopId: m.workshopId, studentId: m.studentId, attendedOn: date } });
        cleared += r.count;
        continue;
      }
      await tx.workshopAttendance.upsert({
        where: key,
        create: { institutionId: inst, workshopId: m.workshopId, studentId: m.studentId, attendedOn: date, status: m.status, note: m.note },
        update: { status: m.status, note: m.note, rowVersion: { increment: 1 } },
      });
      saved += 1;
    }
  });
  await audit(user, "W03", `workshop-attendance:${date}`, "attendance.saved", { after: { date, saved, cleared } });
  return { message: `Attendance saved for ${date} — ${saved} student${saved === 1 ? "" : "s"} marked${cleared ? `, ${cleared} cleared` : ""}` };
}

export async function attendanceWeek(user: SessionClaims, q: { date?: string; student?: string; workshop?: string }, scope?: WorkshopScope) {
  await gate(user, "view", scope);
  const inst = user.institutionId;
  const { tz, today } = await clock(inst);
  const date = ISO.test(s(q.date)) ? s(q.date) : today;
  const sunday = addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const needle = lower(s(q.student));
  const ws = await approvedRoster(inst, s(q.workshop), scope);
  const marks = await prisma.workshopAttendance.findMany({ where: { institutionId: inst, attendedOn: { gte: days[0], lte: days[6] } } });
  const rows = ws
    .map((w) => {
      const st = workshopSettings(w, tz);
      const roster = w.registrations.map((r) => studentView(r.student)).filter((who) => !needle || lower(who.studentNumber).includes(needle) || lower(who.familyName).includes(needle));
      const ids = new Set(roster.map((x) => x.id));
      const cells = days.map((d) => {
        const scheduled = workshopPhase(w, st, d) !== "inactive" && meetsOn(st, d);
        const m = marks.filter((x) => x.workshopId === w.id && x.attendedOn === d && ids.has(x.studentId));
        return { date: d, scheduled, enrolled: scheduled ? roster.length : 0, present: m.filter((x) => x.status === "present").length, absent: m.filter((x) => x.status === "absent").length };
      });
      return { workshop: { id: w.id, title: w.title, code: w.code }, cells, roster: roster.length };
    })
    .filter((r) => r.roster > 0 && r.cells.some((c) => c.scheduled));
  return { date, days, previous: addDays(sunday, -7), next: addDays(sunday, 7), rows };
}
