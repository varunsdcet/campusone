import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { decideApproval } from "@myheritage/auth";
import { STUDENT_PROGRAMS, STUDENT_STATUSES, assertPermission, patchStudentMeta, studentMetaMap } from "../superAdmin.service.js";
import { applyStudentProfileChange } from "../registrar-gaps.service.js";
import { audit } from "./service.js";
import { S, loadBook, loadConfig, nextNumber, r2 } from "./finance.core.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { promoteWaitlisted } from "./enrolment.js";

/* ------------------------------------------------------------------ */
/* Vocabulary captured from the User Requests screens                   */
/* ------------------------------------------------------------------ */

const META_SCREEN = "REQ:META";
const META_KEY = "meta";

export const REQUEST_TYPES = ["Student Requests", "Incidents / Disputes", "General Requests", "Profile Changes", "E-mail Changes"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export const REQUEST_STATUSES = ["Pending", "Approved", "Declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const FORM_LOA = "Leave of Absence Application";
const FORM_PROFILE = "Request to Update Personal Details";
const FORM_WITHDRAW = "Withdraw";
export const CAPTURED_FORMS = [FORM_LOA, FORM_PROFILE, FORM_WITHDRAW] as const;

export const LOA_TYPES = ["By dates", "Until further notice"] as const;
export const ENROLMENT_ACTIONS = ["No action", "Withdraw from active enrolments"] as const;

const SERVICE_FORMS: Record<string, { form: string; type: RequestType }> = {
  course_withdrawal: { form: FORM_WITHDRAW, type: "Student Requests" },
  leave_of_absence: { form: FORM_LOA, type: "Student Requests" },
  official_transcript: { form: "Official Transcript", type: "Student Requests" },
  transcript_request: { form: "Transcript Request", type: "Student Requests" },
  enrollment_verification: { form: "Enrolment Verification", type: "Student Requests" },
  course_change: { form: "Course Change", type: "Student Requests" },
  academic_appeal: { form: "Academic Appeal", type: "Incidents / Disputes" },
  general_inquiry: { form: "General Inquiry", type: "General Requests" },
  advising_referral: { form: "Advising Referral", type: "General Requests" },
};

function serviceForm(type: string): { form: string; type: RequestType } {
  const known = SERVICE_FORMS[type];
  if (known) return known;
  const form = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (/incident|dispute|complaint|appeal/i.test(type)) return { form, type: "Incidents / Disputes" };
  if (/e-?mail/i.test(type)) return { form, type: "E-mail Changes" };
  if (/profile|personal/i.test(type)) return { form, type: "Profile Changes" };
  if (/general|inquiry|other/i.test(type)) return { form, type: "General Requests" };
  return { form, type: "Student Requests" };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const day = (d: Date) => d.toISOString().slice(0, 10);
const parse = <T>(json: string | null | undefined, fallback: T): T => {
  try {
    const v = JSON.parse(json ?? "");
    return v && typeof v === "object" ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const stripStudentRef = (ref: string) => (ref.startsWith("student:") ? ref.slice("student:".length) : ref);

function addDays(iso: string, n: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
}

function approvalStatus(status: string | undefined): RequestStatus | null {
  if (status === "approved" || status === "applied") return "Approved";
  if (status === "rejected") return "Declined";
  return null;
}

export type LoaSettings = {
  type: string;
  absenceStart: string;
  returning: string;
  programProfile: string;
  enrolmentsAction: string;
  changeStatus: string;
  returningStatus: string;
};

type Meta = {
  number: number;
  deleted?: boolean;
  deletedAt?: string;
  comments?: string;
  loa?: LoaSettings;
  decidedAt?: string;
  decidedBy?: string;
};

type Kind = "loa" | "profile" | "service";

type StudentInfo = {
  id: string;
  personId: string;
  name: string;
  givenName: string;
  familyName: string;
  preferredName: string;
  studentNumber: string;
  programCode: string;
  programName: string;
  login: string;
};

type Item = {
  ref: string;
  kind: Kind;
  sourceId: string;
  approvalId: string | null;
  form: string;
  type: RequestType;
  status: RequestStatus;
  requestedAt: Date;
  student: StudentInfo | null;
};

type Loaded = {
  items: Item[];
  metas: Map<string, { id: string; data: Meta }>;
};

/* ------------------------------------------------------------------ */
/* Loading every request source into one queue                          */
/* ------------------------------------------------------------------ */

async function loadStudents(inst: string, ids: string[]) {
  if (!ids.length) return new Map<string, StudentInfo>();
  const students = await prisma.student.findMany({
    where: { institutionId: inst, id: { in: [...new Set(ids)] } },
    include: { person: { include: { accounts: { select: { email: true } } } }, cohort: { include: { program: true } } },
  });
  return new Map(
    students.map((s) => [
      s.id,
      {
        id: s.id,
        personId: s.personId,
        name: `${s.person.familyName}, ${s.person.givenName}`,
        givenName: s.person.givenName,
        familyName: s.person.familyName,
        preferredName: s.person.preferredName ?? "",
        studentNumber: s.studentNumber,
        programCode: s.cohort?.program.code ?? STUDENT_PROGRAMS.find((p) => p.name === s.programName)?.code ?? "",
        programName: s.programName,
        login: s.person.accounts[0]?.email ?? s.person.email,
      } satisfies StudentInfo,
    ]),
  );
}

async function loadAll(inst: string): Promise<Loaded> {
  const [loas, profiles, services, metaRows] = await Promise.all([
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.approvalRequest.findMany({ where: { institutionId: inst, type: "student_profile_change", status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.serviceRequest.findMany({ where: { institutionId: inst, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: META_SCREEN } }),
  ]);
  const approvalIds = [...loas, ...services].map((r) => r.approvalRequestId).filter((id): id is string => Boolean(id));
  const [linked, students] = await Promise.all([
    approvalIds.length ? prisma.approvalRequest.findMany({ where: { institutionId: inst, id: { in: approvalIds } }, select: { id: true, status: true } }) : [],
    loadStudents(inst, [...loas.map((l) => l.studentId), ...services.map((s) => s.studentId), ...profiles.map((p) => stripStudentRef(p.subjectRef))]),
  ]);
  const linkedStatus = new Map(linked.map((a) => [a.id, a.status]));

  const items: Item[] = [
    ...loas.map((l): Item => {
      const fromRow: RequestStatus | null = l.status === "approved" ? "Approved" : l.status === "rejected" ? "Declined" : null;
      return {
        ref: `loa:${l.id}`,
        kind: "loa",
        sourceId: l.id,
        approvalId: l.approvalRequestId,
        form: FORM_LOA,
        type: "Student Requests",
        status: fromRow ?? approvalStatus(l.approvalRequestId ? linkedStatus.get(l.approvalRequestId) : undefined) ?? "Pending",
        requestedAt: l.createdAt,
        student: students.get(l.studentId) ?? null,
      };
    }),
    ...profiles.map(
      (p): Item => ({
        ref: `profile:${p.id}`,
        kind: "profile",
        sourceId: p.id,
        approvalId: p.id,
        form: FORM_PROFILE,
        type: "Profile Changes",
        status: approvalStatus(p.status) ?? "Pending",
        requestedAt: p.createdAt,
        student: students.get(stripStudentRef(p.subjectRef)) ?? null,
      }),
    ),
    ...services.map((s): Item => {
      const { form, type } = serviceForm(s.type);
      const fromRow: RequestStatus | null = s.status === "resolved" ? "Approved" : s.status === "rejected" ? "Declined" : null;
      return {
        ref: `service:${s.id}`,
        kind: "service",
        sourceId: s.id,
        approvalId: s.approvalRequestId,
        form,
        type,
        status: fromRow ?? approvalStatus(s.approvalRequestId ? linkedStatus.get(s.approvalRequestId) : undefined) ?? "Pending",
        requestedAt: s.createdAt,
        student: students.get(s.studentId) ?? null,
      };
    }),
  ].sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());

  const metas = new Map(metaRows.map((m) => [m.contextKey, { id: m.id, data: parse<Meta>(m.dataJson, { number: 0 }) }]));
  return { items, metas };
}

/** Gives every request a permanent sequential request number (the "#" column). */
async function ensureNumbers(user: SessionClaims, loaded: Loaded) {
  const missing = loaded.items.filter((i) => !loaded.metas.has(i.ref));
  if (!missing.length) return loaded;
  const inst = user.institutionId;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`user-requests:${inst}`}))`;
    const rows = await tx.heritageRecord.findMany({ where: { institutionId: inst, screenId: META_SCREEN }, select: { contextKey: true, dataJson: true } });
    const have = new Set(rows.map((r) => r.contextKey));
    let next = rows.reduce((max, r) => Math.max(max, Number(parse<Meta>(r.dataJson, { number: 0 }).number) || 0), 0);
    for (const item of missing) {
      if (have.has(item.ref)) continue;
      next += 1;
      await tx.heritageRecord.create({
        data: {
          institutionId: inst,
          screenId: META_SCREEN,
          contextKey: item.ref,
          singletonKey: META_KEY,
          dataJson: JSON.stringify({ number: next } satisfies Meta),
          createdById: user.accountId,
          updatedById: user.accountId,
        },
      });
    }
  });
  const metaRows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: META_SCREEN } });
  return { items: loaded.items, metas: new Map(metaRows.map((m) => [m.contextKey, { id: m.id, data: parse<Meta>(m.dataJson, { number: 0 }) }])) };
}

/** Request numbers for `loa:<id>` / `service:<id>` refs, so other queues can link to the User Request review page. */
export async function requestNumbersFor(user: SessionClaims, refs: string[]) {
  if (!refs.length) return new Map<string, number>();
  const loaded = await ensureNumbers(user, await loadAll(user.institutionId));
  const out = new Map<string, number>();
  for (const ref of refs) {
    const meta = loaded.metas.get(ref)?.data;
    if (meta?.number && !meta.deleted) out.set(ref, meta.number);
  }
  return out;
}

function visible(loaded: Loaded) {
  return loaded.items.filter((i) => !loaded.metas.get(i.ref)?.data.deleted);
}

async function saveMeta(user: SessionClaims, ref: string, patch: Partial<Meta>) {
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: user.institutionId, screenId: META_SCREEN, contextKey: ref } });
  if (!row) throw httpError(404, "User request not found", "NOT_FOUND");
  const data = { ...parse<Meta>(row.dataJson, { number: 0 }), ...patch };
  await prisma.heritageRecord.update({ where: { id: row.id }, data: { dataJson: JSON.stringify(data), updatedById: user.accountId, rowVersion: { increment: 1 } } });
  return data;
}

async function actorName(user: SessionClaims) {
  const p = await prisma.person.findFirst({ where: { id: user.personId }, select: { givenName: true, familyName: true } });
  return p ? `${p.givenName} ${p.familyName}` : "Admin";
}

/* ------------------------------------------------------------------ */
/* Listing + sidebar counts                                             */
/* ------------------------------------------------------------------ */

export async function requestMeta(user: SessionClaims) {
  await assertPermission(user, "userRequests", "view");
  const loaded = await loadAll(user.institutionId);
  const extra = [...new Set(visible(loaded).map((i) => i.form))].filter((f) => !(CAPTURED_FORMS as readonly string[]).includes(f)).sort();
  return {
    types: REQUEST_TYPES,
    statuses: REQUEST_STATUSES,
    forms: [...CAPTURED_FORMS, ...extra],
    loaTypes: LOA_TYPES,
    enrolmentActions: ENROLMENT_ACTIONS,
    studentStatuses: STUDENT_STATUSES,
  };
}

export async function requestCounts(user: SessionClaims) {
  await assertPermission(user, "userRequests", "view");
  const pending = visible(await loadAll(user.institutionId)).filter((i) => i.status === "Pending");
  const byType = Object.fromEntries(REQUEST_TYPES.map((t) => [t, pending.filter((i) => i.type === t).length])) as Record<RequestType, number>;
  return { total: pending.length, byType };
}

export type ListQuery = { request?: string; user?: string; form?: string; status?: string; type?: string; page: number; perPage: number };

function summary(item: Item, meta: Meta | undefined) {
  return {
    number: meta?.number ?? 0,
    kind: item.kind,
    form: item.form,
    type: item.type,
    status: item.status,
    requestedAt: item.requestedAt.toISOString(),
    student: item.student
      ? {
          id: item.student.id,
          name: item.student.name,
          preferredName: item.student.preferredName,
          studentNumber: item.student.studentNumber,
          programCode: item.student.programCode,
        }
      : null,
  };
}

export async function listRequests(user: SessionClaims, q: ListQuery) {
  await assertPermission(user, "userRequests", "view");
  const loaded = await ensureNumbers(user, await loadAll(user.institutionId));
  const reqNo = Number((q.request ?? "").replace(/[^\d]/g, ""));
  const needle = (q.user ?? "").trim().toLowerCase();
  const only = (v: string | undefined) => (v && v.toLowerCase() !== "all" ? v : "");
  const [form, status, type] = [only(q.form), only(q.status), only(q.type)];
  const rows = visible(loaded)
    .filter((i) => !reqNo || loaded.metas.get(i.ref)?.data.number === reqNo)
    .filter((i) => !form || i.form === form)
    .filter((i) => !status || i.status === status)
    .filter((i) => !type || i.type === type)
    .filter((i) => {
      if (!needle) return true;
      const s = i.student;
      if (!s) return false;
      return s.login.toLowerCase().includes(needle) || s.studentNumber.toLowerCase().includes(needle) || s.familyName.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  const perPage = Math.min(Math.max(q.perPage, 1), 500);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Math.max(q.page, 1), pages);
  return {
    total: rows.length,
    page,
    pages,
    perPage,
    items: rows.slice((page - 1) * perPage, page * perPage).map((i) => summary(i, loaded.metas.get(i.ref)?.data)),
  };
}

/* ------------------------------------------------------------------ */
/* Single request (Review / Edit)                                       */
/* ------------------------------------------------------------------ */

async function findByNumber(user: SessionClaims, number: number) {
  const loaded = await ensureNumbers(user, await loadAll(user.institutionId));
  const item = visible(loaded).find((i) => loaded.metas.get(i.ref)?.data.number === number);
  if (!item) throw httpError(404, `User request #${number} was not found`, "NOT_FOUND");
  return { item, meta: loaded.metas.get(item.ref)!.data };
}

type ProfileFields = {
  familyName: string;
  givenName: string;
  middleName: string;
  preferredName: string;
  phone: string;
  primaryEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

async function personFields(personId: string): Promise<ProfileFields> {
  const p = await prisma.person.findUnique({ where: { id: personId } });
  return {
    familyName: p?.familyName ?? "",
    givenName: p?.givenName ?? "",
    middleName: p?.middleName ?? "",
    preferredName: p?.preferredName ?? "",
    phone: p?.phone ?? "",
    primaryEmail: p?.email ?? "",
    emergencyContactName: p?.emergencyContactName ?? "",
    emergencyContactPhone: p?.emergencyContactPhone ?? "",
  };
}

function requestedFields(diff: Record<string, unknown>, current: ProfileFields): ProfileFields {
  const pick = (k: keyof ProfileFields) => (typeof diff[k] === "string" ? (diff[k] as string) : current[k]);
  return {
    familyName: pick("familyName"),
    givenName: pick("givenName"),
    middleName: pick("middleName"),
    preferredName: pick("preferredName"),
    phone: pick("phone"),
    primaryEmail: pick("primaryEmail"),
    emergencyContactName: pick("emergencyContactName"),
    emergencyContactPhone: pick("emergencyContactPhone"),
  };
}

async function programProfiles(inst: string, studentId: string) {
  const [s, meta, extra] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, institutionId: inst }, include: { cohort: true } }),
    studentMetaMap(inst),
    prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: "S07", contextKey: `student:${studentId}`, deletedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!s) return [];
  const status = meta[s.id]?.status ?? "Active Student";
  const out = [{ value: "primary", label: [s.programName, s.cohort?.startDate ?? day(s.createdAt), status].filter(Boolean).join(" — ") }];
  for (const r of extra) {
    const d = parse<Record<string, unknown>>(r.dataJson, {});
    const label = [str(d.program) || str(d.program_name), str(d.start_date) || str(d.admission_date), str(d.student_status) || str(d.status)].filter(Boolean).join(" — ");
    if (label) out.push({ value: r.id, label });
  }
  return out;
}

export async function getRequest(user: SessionClaims, number: number) {
  await assertPermission(user, "userRequests", "view");
  const { item, meta } = await findByNumber(user, number);
  const base = { ...summary(item, meta), comments: meta.comments ?? "", decidedAt: meta.decidedAt ?? null, decidedBy: meta.decidedBy ?? null };

  if (item.kind === "loa") {
    const loa = await prisma.leaveOfAbsenceRequest.findFirst({ where: { id: item.sourceId, institutionId: user.institutionId } });
    if (!loa) throw httpError(404, "Leave of absence request not found", "NOT_FOUND");
    const settings: LoaSettings = {
      type: "By dates",
      absenceStart: loa.startsOn,
      returning: addDays(loa.endsOn, 1),
      programProfile: "primary",
      enrolmentsAction: "No action",
      changeStatus: "Leave of Absence",
      returningStatus: "Active Student",
      ...meta.loa,
    };
    return {
      ...base,
      loa: { reason: loa.reason, startsOn: loa.startsOn, endsOn: loa.endsOn },
      settings,
      programProfiles: item.student ? await programProfiles(user.institutionId, item.student.id) : [],
    };
  }

  if (item.kind === "profile") {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: item.sourceId, institutionId: user.institutionId } });
    if (!approval) throw httpError(404, "Profile change request not found", "NOT_FOUND");
    const diff = parse<Record<string, unknown>>(approval.proposedDiffJson, {});
    const current = item.student ? await personFields(item.student.personId) : await personFields("");
    return { ...base, profile: { requested: requestedFields(diff, current), current, reason: str(diff.reason) } };
  }

  const sr = await prisma.serviceRequest.findFirst({ where: { id: item.sourceId, institutionId: user.institutionId } });
  if (!sr) throw httpError(404, "Request not found", "NOT_FOUND");
  return { ...base, service: { subject: sr.subject, details: sr.details } };
}

/* ------------------------------------------------------------------ */
/* Edit (Update Request)                                                */
/* ------------------------------------------------------------------ */

export type EditBody = {
  profile?: Partial<ProfileFields>;
  loa?: { reason?: string; startsOn?: string; endsOn?: string };
  service?: { subject?: string; details?: string };
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requirePending(item: Item) {
  if (item.status !== "Pending") throw httpError(409, `This request has already been ${item.status.toLowerCase()} and can no longer be changed.`, "CONFLICT");
}

export async function updateRequest(user: SessionClaims, number: number, body: EditBody) {
  await assertPermission(user, "userRequests", "edit");
  const { item } = await findByNumber(user, number);
  requirePending(item);
  if (item.approvalId) {
    throw httpError(409, "The proposed change is locked after submission. Decline this request and ask the requester to submit a corrected proposal.", "CONFLICT");
  }
  const inst = user.institutionId;

  if (item.kind === "profile") {
    const input = body.profile ?? {};
    const required: Array<[keyof ProfileFields, string]> = [
      ["familyName", "Last Name"],
      ["givenName", "First Name"],
      ["phone", "Phone Number"],
      ["primaryEmail", "E-mail Address"],
      ["emergencyContactName", "Emergency Contact Name"],
      ["emergencyContactPhone", "Emergency Contact Phone Number"],
    ];
    const missing = required.filter(([k]) => !(input[k] ?? "").trim()).map(([, label]) => label);
    if (missing.length) throw httpError(400, `Required: ${missing.join(", ")}`);
    if (!EMAIL.test(input.primaryEmail!.trim())) throw httpError(400, "E-mail Address is not a valid e-mail");
    const approval = await prisma.approvalRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
    if (!approval) throw httpError(404, "Profile change request not found", "NOT_FOUND");
    const before = parse<Record<string, unknown>>(approval.proposedDiffJson, {});
    const { sinMasked: _dropSin, ...kept } = before;
    const after = {
      ...kept,
      familyName: input.familyName!.trim(),
      givenName: input.givenName!.trim(),
      middleName: (input.middleName ?? "").trim(),
      preferredName: (input.preferredName ?? "").trim(),
      phone: input.phone!.trim(),
      primaryEmail: input.primaryEmail!.trim(),
      emergencyContactName: input.emergencyContactName!.trim(),
      emergencyContactPhone: input.emergencyContactPhone!.trim(),
    };
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { proposedDiffJson: JSON.stringify(after), rowVersion: { increment: 1 } } });
    await audit(user, "R04", item.ref, "request.updated", { recordId: approval.id, before, after });
    return { message: `User request #${number} updated` };
  }

  if (item.kind === "loa") {
    const input = body.loa ?? {};
    const reason = (input.reason ?? "").trim();
    if (!reason) throw httpError(400, "Reason for absence is required");
    if (!ISO.test(input.startsOn ?? "") || !ISO.test(input.endsOn ?? "")) throw httpError(400, "Start Date and End Date are required");
    if (input.endsOn! < input.startsOn!) throw httpError(400, "End Date must be on or after Start Date");
    const loa = await prisma.leaveOfAbsenceRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
    if (!loa) throw httpError(404, "Leave of absence request not found", "NOT_FOUND");
    const before = { reason: loa.reason, startsOn: loa.startsOn, endsOn: loa.endsOn };
    const after = { reason, startsOn: input.startsOn!, endsOn: input.endsOn! };
    await prisma.$transaction(async (tx) => {
      await tx.leaveOfAbsenceRequest.update({ where: { id: loa.id }, data: { ...after, rowVersion: { increment: 1 } } });
      if (loa.approvalRequestId) {
        await tx.approvalRequest.updateMany({ where: { id: loa.approvalRequestId, institutionId: inst, status: "pending" }, data: { proposedDiffJson: JSON.stringify(after) } });
      }
    });
    await audit(user, "R03", item.ref, "request.updated", { recordId: loa.id, before, after });
    return { message: `User request #${number} updated` };
  }

  const input = body.service ?? {};
  const subject = (input.subject ?? "").trim();
  const details = (input.details ?? "").trim();
  if (!subject || !details) throw httpError(400, "Subject and Details are required");
  const sr = await prisma.serviceRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
  if (!sr) throw httpError(404, "Request not found", "NOT_FOUND");
  await prisma.serviceRequest.update({ where: { id: sr.id }, data: { subject, details, rowVersion: { increment: 1 } } });
  await audit(user, "R01", item.ref, "request.updated", { recordId: sr.id, before: { subject: sr.subject, details: sr.details }, after: { subject, details } });
  return { message: `User request #${number} updated` };
}

/* ------------------------------------------------------------------ */
/* Approve / Decline                                                    */
/* ------------------------------------------------------------------ */

export type DecisionBody = { comments?: string; settings?: Partial<LoaSettings> };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function closeApproval(tx: Tx, user: SessionClaims, approvalId: string | null, decision: "approve" | "reject", comment: string) {
  if (!approvalId) return;
  const row = await tx.approvalRequest.findFirst({ where: { id: approvalId, institutionId: user.institutionId } });
  if (!row || !["pending", "approved"].includes(row.status)) return;
  if (decision === "approve" && row.requestedBy === user.accountId) {
    throw httpError(403, "You cannot approve your own request; another approver must decide it", "FORBIDDEN");
  }
  const decisions = parse<Array<{ actorId?: string }>>(row.decisionsJson, []);
  if (row.status === "approved" && decision === "approve") {
    const claimed = await tx.approvalRequest.updateMany({
      where: { id: row.id, rowVersion: row.rowVersion, status: "approved" },
      data: { status: "applied", rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw httpError(409, "This request was decided by someone else. Reload and try again.", "CONFLICT");
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "ApprovalRequest.applied",
      purpose: "approval",
      before: { status: row.status },
      after: { status: "applied", decision },
      source: "user-requests",
      correlationId: row.id,
      outboxPayload: { approvalId: row.id, type: row.type, subjectRef: row.subjectRef, decision, status: "applied" },
    });
    return;
  }
  if (row.status === "pending" && decisions.some((d) => d.actorId === user.accountId)) {
    throw httpError(409, "You have already decided this request", "CONFLICT");
  }
  decisions.push({ actorId: user.accountId, decision, comment: comment || undefined, decidedAt: new Date().toISOString(), source: "user-requests" } as { actorId: string });
  const status = decision === "approve" ? "applied" : "rejected";
  const claimed = await tx.approvalRequest.updateMany({
    where: { id: row.id, rowVersion: row.rowVersion, status: row.status },
    data: { status, decisionsJson: JSON.stringify(decisions), rowVersion: { increment: 1 } },
  });
  if (claimed.count !== 1) throw httpError(409, "This request was decided by someone else. Reload and try again.", "CONFLICT");
  await writeAuditAndOutbox(tx, {
    institutionId: user.institutionId,
    actorId: user.accountId,
    eventName: decision === "approve" ? "ApprovalRequest.applied" : "ApprovalRequest.decided",
    purpose: "approval",
    before: { status: row.status },
    after: { status, decision },
    source: "user-requests",
    correlationId: row.id,
    outboxPayload: { approvalId: row.id, type: row.type, subjectRef: row.subjectRef, decision, status },
  });
}

function validSettings(input: Partial<LoaSettings> | undefined): LoaSettings {
  const s = input ?? {};
  const type = (LOA_TYPES as readonly string[]).includes(s.type ?? "") ? s.type! : "By dates";
  if (!ISO.test(s.absenceStart ?? "")) throw httpError(400, "Absence Start Date is required");
  const returning = s.returning ?? "";
  if (type === "By dates" && !ISO.test(returning)) throw httpError(400, "Returning Date is required when the leave is set By dates");
  if (returning && ISO.test(returning) && returning <= s.absenceStart!) throw httpError(400, "Returning Date must be after Absence Start Date");
  const statuses = STUDENT_STATUSES as readonly string[];
  if (s.changeStatus && !statuses.includes(s.changeStatus)) throw httpError(400, "Choose a valid Change Student Status");
  if (s.returningStatus && !statuses.includes(s.returningStatus)) throw httpError(400, "Choose a valid Returning Student Status");
  return {
    type,
    absenceStart: s.absenceStart!,
    returning: ISO.test(returning) ? returning : "",
    programProfile: s.programProfile || "primary",
    enrolmentsAction: (ENROLMENT_ACTIONS as readonly string[]).includes(s.enrolmentsAction ?? "") ? s.enrolmentsAction! : "No action",
    changeStatus: s.changeStatus || "Leave of Absence",
    returningStatus: s.returningStatus || "Active Student",
  };
}

async function courseWithdrawalPlan(user: SessionClaims, studentId: string, approvalId: string | null) {
  if (!approvalId) throw httpError(409, "This withdrawal has no approval record", "CONFLICT");
  const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, institutionId: user.institutionId } });
  if (!approval) throw httpError(404, "Withdrawal approval record not found", "NOT_FOUND");
  const sectionId = str(parse<Record<string, unknown>>(approval.proposedDiffJson, {}).sectionId);
  if (!sectionId) {
    throw httpError(409, "This older withdrawal request does not identify a course section. Ask the student to submit it again.", "CONFLICT");
  }
  const enrolment = await prisma.enrolment.findFirst({
    where: { institutionId: user.institutionId, studentId, sectionId, status: "enrolled" },
    include: { section: { include: { course: true } } },
  });
  if (!enrolment) throw httpError(409, "The selected course section is no longer an active enrolment", "CONFLICT");

  const cfg = await loadConfig(user.institutionId);
  const book = await loadBook(user.institutionId, cfg, studentId);
  const linked = await prisma.financeLedgerEntry.findMany({
    where: { institutionId: user.institutionId, studentId, sectionId, kind: "charge" },
    select: { id: true },
  });
  const linkedIds = new Set(linked.map((entry) => entry.id));
  const charges = book.charges.filter((charge) => linkedIds.has(charge.id) && !charge.hidden && charge.owing > 0.005);
  const adjustments = [] as Array<{ number: number; chargeId: string; amount: number }>;
  for (const charge of charges) {
    adjustments.push({ number: await nextNumber(user.institutionId, "adjustment"), chargeId: charge.id, amount: r2(charge.owing) });
  }
  return { approval, enrolment, adjustments, courseLabel: `${enrolment.section.course.code} ${enrolment.section.code}` };
}

export async function decideRequest(user: SessionClaims, number: number, decision: "approve" | "decline", body: DecisionBody) {
  await assertPermission(user, "userRequests", "edit");
  const { item } = await findByNumber(user, number);
  requirePending(item);
  const inst = user.institutionId;
  const comments = (body.comments ?? "").trim();
  const approve = decision === "approve";
  const verb = approve ? "approved" : "declined";
  const patch: Partial<Meta> = { comments, decidedAt: new Date().toISOString(), decidedBy: await actorName(user) };
  let message = `User request #${number} ${verb}`;

  // User Requests and the central approvals inbox share one decision engine. This
  // enforces approver roles, self-approval protection, distinct voters and quorum
  // before any requested change is applied to the student record.
  if (item.approvalId) {
    const approval = await decideApproval({
      approvalId: item.approvalId,
      institutionId: inst,
      actorId: user.accountId,
      actorRoles: user.roles,
      decision: approve ? "approve" : "reject",
      comment: comments || undefined,
    });
    if (approve && approval.status === "pending") {
      await audit(user, item.kind === "loa" ? "R02" : item.kind === "profile" ? "R04" : "R01", item.ref, "request.approval_recorded", {
        recordId: item.sourceId,
        after: { approvalId: approval.id, status: approval.status },
        note: comments || null,
      });
      return { message: `Approval recorded for user request #${number}; additional approval is still required`, status: "Pending" };
    }
  }

  if (item.kind === "loa") {
    const settings = approve ? validSettings(body.settings) : undefined;
    const loa = await prisma.leaveOfAbsenceRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
    if (!loa) throw httpError(404, "Leave of absence request not found", "NOT_FOUND");
    let withdrawnIds: string[] = [];
    let withdrawnSectionIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveOfAbsenceRequest.updateMany({
        where: { id: loa.id, rowVersion: loa.rowVersion, status: "pending" },
        data: { status: approve ? "approved" : "rejected", decidedAt: new Date(), decisionNote: comments || null, rowVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) throw httpError(409, "This request has already been decided", "CONFLICT");
      await closeApproval(tx, user, loa.approvalRequestId, approve ? "approve" : "reject", comments);
      if (settings?.enrolmentsAction === "Withdraw from active enrolments") {
        // Only enrolments whose term overlaps the leave; past terms and terms after the return date stay untouched.
        const overlapping = await tx.enrolment.findMany({
          where: {
            institutionId: inst,
            studentId: loa.studentId,
            status: "enrolled",
            section: { term: { endsOn: { gte: settings.absenceStart }, ...(settings.returning ? { startsOn: { lt: settings.returning } } : {}) } },
          },
          select: { id: true, sectionId: true },
        });
        withdrawnIds = overlapping.map((e) => e.id);
        withdrawnSectionIds = [...new Set(overlapping.map((e) => e.sectionId))];
        if (withdrawnIds.length) {
          await tx.enrolment.updateMany({ where: { id: { in: withdrawnIds }, status: "enrolled" }, data: { status: "withdrawn", rowVersion: { increment: 1 } } });
        }
      }
    });
    const withdrawn = withdrawnIds.length;
    if (settings) {
      patch.loa = settings;
      await patchStudentMeta(inst, loa.studentId, {
        status: settings.changeStatus,
        loaStartDate: settings.absenceStart,
        loaReturnDate: settings.returning || null,
        loaReturnStatus: settings.returningStatus,
      });
      message += ` — student status set to ${settings.changeStatus}${withdrawn ? `, ${withdrawn} active enrolment${withdrawn === 1 ? "" : "s"} withdrawn` : ""}`;
      if (withdrawnSectionIds.length) await Promise.allSettled(withdrawnSectionIds.map((sectionId) => promoteWaitlisted(user, sectionId)));
    }
    await audit(user, "R02", item.ref, `request.${verb}`, { recordId: loa.id, after: { comments, settings, withdrawnEnrolmentIds: withdrawnIds }, note: comments || null });
  } else if (item.kind === "profile") {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
    if (!approval) throw httpError(404, "Profile change request not found", "NOT_FOUND");
    const diff = parse<Record<string, unknown>>(approval.proposedDiffJson, {});
    const studentId = stripStudentRef(approval.subjectRef);
    if (approve && typeof diff.primaryEmail === "string") {
      const student = await prisma.student.findFirst({ where: { id: studentId, institutionId: inst } });
      const clash = student
        ? await prisma.person.findFirst({ where: { institutionId: inst, email: diff.primaryEmail, id: { not: student.personId } }, select: { id: true } })
        : null;
      if (clash) throw httpError(409, `E-mail Address ${diff.primaryEmail} is already used by another profile`, "CONFLICT");
    }
    await prisma.$transaction(async (tx) => {
      if (approve) await applyStudentProfileChange(inst, studentId, diff, tx);
      await closeApproval(tx, user, approval.id, approve ? "approve" : "reject", comments);
    });
    if (approve) message += " — student profile updated";
    await audit(user, "R04", item.ref, `request.${verb}`, { recordId: approval.id, after: approve ? diff : undefined, note: comments || null });
  } else {
    const sr = await prisma.serviceRequest.findFirst({ where: { id: item.sourceId, institutionId: inst } });
    if (!sr) throw httpError(404, "Request not found", "NOT_FOUND");
    if (approve && sr.type === "course_withdrawal") {
      const outcome = await withStudentMoneyLock(inst, sr.studentId, async () => {
        const plan = await courseWithdrawalPlan(user, sr.studentId, sr.approvalRequestId);
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.enrolment.updateMany({
            where: { id: plan.enrolment.id, institutionId: inst, studentId: sr.studentId, status: "enrolled", rowVersion: plan.enrolment.rowVersion },
            data: { status: "withdrawn", rowVersion: { increment: 1 } },
          });
          if (claimed.count !== 1) throw httpError(409, "The enrolment changed while this request was being approved", "CONFLICT");
          for (const adjustment of plan.adjustments) {
            await tx.heritageRecord.create({
              data: {
                institutionId: inst,
                screenId: S.ADJUSTMENT,
                contextKey: sr.studentId,
                dataJson: JSON.stringify({
                  number: adjustment.number,
                  direction: "Decrease balance (credit)",
                  amount: adjustment.amount,
                  reason: `Course withdrawal fee review: ${plan.courseLabel}`,
                  status: "Pending",
                  requestedBy: plan.approval.requestedBy,
                  requestedAt: new Date().toISOString(),
                  ledgerEntryId: adjustment.chargeId,
                  ledgerAction: "waive",
                  withdrawalRequestId: sr.id,
                  sectionId: plan.enrolment.sectionId,
                }),
                createdById: user.accountId,
                updatedById: user.accountId,
              },
            });
          }
          await tx.serviceRequest.update({ where: { id: sr.id }, data: { status: "resolved", rowVersion: { increment: 1 } } });
          await closeApproval(tx, user, sr.approvalRequestId, "approve", comments);
        });
        return { courseLabel: plan.courseLabel, reviews: plan.adjustments.length, sectionId: plan.enrolment.sectionId };
      });
      await promoteWaitlisted(user, outcome.sectionId);
      message += ` — withdrawn from ${outcome.courseLabel}${outcome.reviews ? `; ${outcome.reviews} fee review${outcome.reviews === 1 ? "" : "s"} sent for approval` : ""}`;
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.serviceRequest.update({ where: { id: sr.id }, data: { status: approve ? "resolved" : "rejected", rowVersion: { increment: 1 } } });
        await closeApproval(tx, user, sr.approvalRequestId, approve ? "approve" : "reject", comments);
      });
    }
    await audit(user, "R01", item.ref, `request.${verb}`, { recordId: sr.id, note: comments || null });
  }

  await saveMeta(user, item.ref, patch);
  return { message, status: approve ? "Approved" : "Declined" };
}

/* ------------------------------------------------------------------ */
/* Delete                                                               */
/* ------------------------------------------------------------------ */

export async function deleteRequest(user: SessionClaims, number: number) {
  await assertPermission(user, "userRequests", "edit");
  const { item } = await findByNumber(user, number);
  const inst = user.institutionId;
  if (item.status === "Pending") {
    await prisma.$transaction(async (tx) => {
      if (item.kind === "loa") await tx.leaveOfAbsenceRequest.updateMany({ where: { id: item.sourceId, institutionId: inst }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
      if (item.kind === "service") await tx.serviceRequest.updateMany({ where: { id: item.sourceId, institutionId: inst }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
      if (item.approvalId) await tx.approvalRequest.updateMany({ where: { id: item.approvalId, institutionId: inst, status: "pending" }, data: { status: "cancelled", rowVersion: { increment: 1 } } });
    });
  }
  await saveMeta(user, item.ref, { deleted: true, deletedAt: new Date().toISOString() });
  await audit(user, item.kind === "loa" ? "R02" : item.kind === "profile" ? "R04" : "R01", item.ref, "request.deleted", { recordId: item.sourceId, before: summary(item, undefined) });
  return { message: `User request #${number} deleted` };
}
