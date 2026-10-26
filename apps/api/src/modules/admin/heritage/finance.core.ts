/* Financial Management records: storage, numbering, per-student ledger books, allocations, lock-out periods and audit. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { assertPermission, effectiveAccess, studentMetaMap } from "../superAdmin.service.js";
import { audit } from "./service.js";
import { entityRecords, type Rec } from "./sysconfig.js";
import type { FinEntityKey } from "./finance.spec.js";

export type Data = Record<string, unknown>;

export const S = {
  META: "FIN:META",
  ALLOC: "FIN:ALLOC",
  INVOICE: "FIN:INVOICE",
  AWARD: "FIN:AWARD",
  ADJUSTMENT: "FIN:ADJUSTMENT",
  COMMISSION: "FIN:COMMISSION",
  PLAN: "FIN:PLAN",
  COLLECTION: "FIN:COLLECTION",
  FUND: "FIN:FUND",
  ALERT: "FIN:ALERT",
  RECEIPT: "FIN:RECEIPT",
  SEQ: "FIN:SEQ",
  STUDENT_AGENT: "FIN:STUDENT_AGENT",
  STUDENT_AUDIT: "FIN:STUDENT",
} as const;

export const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
export const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const arr = <T = unknown>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const EPS = 0.005;
export const cad = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(r2(n)).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const day = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
};
export const today = () => new Date().toISOString().slice(0, 10);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const parse = (json: string): Data => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Data) : {};
  } catch {
    return {};
  }
};

export async function canFinance(user: SessionClaims, level: "view" | "edit") {
  await assertPermission(user, "financialManagement", level);
}

/** Parses a YYYY-MM-DD form date as noon UTC so the calendar day survives every time zone. */
export function dateAt(v: unknown, label: string): Date {
  const t = s(v).trim();
  if (!DATE_RE.test(t) || Number.isNaN(Date.parse(t))) throw httpError(400, `${label} must be a valid date`);
  return new Date(`${t}T12:00:00.000Z`);
}

export function amountOf(v: unknown, label: string, opts: { min?: number; allowZero?: boolean; allowNegative?: boolean } = {}) {
  if (v === "" || v === null || v === undefined) throw httpError(400, `${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n)) throw httpError(400, `${label} must be a number`);
  if (!opts.allowNegative && n < 0) throw httpError(400, `${label} cannot be negative`);
  if (!opts.allowZero && Math.abs(n) < EPS) throw httpError(400, `${label} must be greater than zero`);
  if (Math.abs(n) > 10_000_000) throw httpError(400, `${label} is too large`);
  return r2(n);
}

export const text = (v: unknown, max = 2000) => s(v).trim().slice(0, max);

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

export type Row = { id: string; contextKey: string; singletonKey: string | null; data: Data; createdAt: Date; updatedAt: Date; createdById: string };

const toRow = (r: { id: string; contextKey: string; singletonKey: string | null; dataJson: string; createdAt: Date; updatedAt: Date; createdById: string }): Row => ({
  id: r.id,
  contextKey: r.contextKey,
  singletonKey: r.singletonKey,
  data: parse(r.dataJson),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  createdById: r.createdById,
});

export async function rows(inst: string, screen: string, contextKey?: string | string[]) {
  const ctx = contextKey === undefined ? {} : Array.isArray(contextKey) ? { contextKey: { in: contextKey } } : { contextKey };
  const list = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: screen, deletedAt: null, ...ctx }, orderBy: { createdAt: "asc" } });
  return list.map(toRow);
}

export async function row(inst: string, screen: string, id: string, label: string) {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return toRow(r);
}

export type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function add(user: SessionClaims, screen: string, data: Data, contextKey = "", singletonKey: string | null = null, db: Db = prisma) {
  const r = await db.heritageRecord.create({
    data: { institutionId: user.institutionId, screenId: screen, contextKey, singletonKey, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
  });
  return toRow(r);
}

export async function save(user: SessionClaims, id: string, data: Data, contextKey?: string) {
  await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(data), updatedById: user.accountId, rowVersion: { increment: 1 }, ...(contextKey !== undefined ? { contextKey } : {}) } });
}

export async function drop(user: SessionClaims, ids: string[]) {
  if (!ids.length) return;
  await prisma.heritageRecord.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), updatedById: user.accountId, status: "deleted" } });
}

export async function putSingle(user: SessionClaims, screen: string, contextKey: string, key: string, data: Data, db: Db = prisma) {
  const where = { institutionId_screenId_contextKey_singletonKey: { institutionId: user.institutionId, screenId: screen, contextKey, singletonKey: key } };
  await db.heritageRecord.upsert({
    where,
    create: { institutionId: user.institutionId, screenId: screen, contextKey, singletonKey: key, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
    update: { dataJson: JSON.stringify(data), updatedById: user.accountId, deletedAt: null, status: "active", rowVersion: { increment: 1 } },
  });
}

export async function getSingle(inst: string, screen: string, contextKey: string, key: string) {
  const r = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: screen, contextKey, singletonKey: key, deletedAt: null } });
  return r ? toRow(r) : null;
}

/** Institution-wide running numbers (transactions, receivables, invoices, …). */
export async function nextNumber(inst: string, kind: string): Promise<number> {
  const where = { institutionId_screenId_contextKey_singletonKey: { institutionId: inst, screenId: S.SEQ, contextKey: "", singletonKey: kind } };
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await prisma.heritageRecord.upsert({
        where,
        create: { institutionId: inst, screenId: S.SEQ, contextKey: "", singletonKey: kind, dataJson: "{}", createdById: "system", updatedById: "system" },
        update: { rowVersion: { increment: 1 } },
      });
      return 1000 + r.rowVersion;
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Configuration                                                        */
/* ------------------------------------------------------------------ */

export type Config = Record<FinEntityKey, Rec[]> & { byId: Map<string, Rec> };

export async function loadConfig(inst: string): Promise<Config> {
  const keys: FinEntityKey[] = ["lockouts", "ledgerTypes", "ledgerCategories", "paymentMethods", "rateCategories", "planTemplates", "taxRates", "disbursementTypes", "promotionAllocations", "promotions", "fundingSources", "collectionAgencies", "agents"];
  const lists = await Promise.all(keys.map((k) => entityRecords(inst, k)));
  const out = Object.fromEntries(keys.map((k, i) => [k, lists[i]])) as Record<FinEntityKey, Rec[]>;
  const byId = new Map<string, Rec>();
  for (const l of lists) for (const r of l) byId.set(r.id, r);
  return { ...out, byId };
}

export const nameOf = (r: Rec | undefined) => s(r?.data.name);
export const agentLabel = (r: Rec | undefined) => (r ? `${s(r.data.lastName)}, ${s(r.data.firstName)} (${s(r.data.agentNumber)})` : "");

/* ------------------------------------------------------------------ */
/* Students                                                             */
/* ------------------------------------------------------------------ */

export type StudentInfo = {
  id: string;
  number: string;
  name: string;
  first: string;
  last: string;
  preferred: string;
  email: string;
  program: string;
  campus: string;
  status: string;
  residency: string;
  rateCategory: string;
  country: string;
  province: string;
  schedule: string;
  standing: string;
  personId: string;
  createdAt: Date;
};

export async function studentsInfo(inst: string, ids?: string[]): Promise<Map<string, StudentInfo>> {
  const [list, meta] = await Promise.all([
    prisma.student.findMany({
      where: { institutionId: inst, ...(ids ? { id: { in: ids } } : {}) },
      include: { person: true, cohort: true, _count: { select: { enrolments: true } } },
    }),
    studentMetaMap(inst),
  ]);
  const out = new Map<string, StudentInfo>();
  for (const st of list) {
    const m = meta[st.id] ?? {};
    const p = st.person;
    out.set(st.id, {
      id: st.id,
      number: st.studentNumber,
      name: `${p.givenName} ${p.familyName}`.trim(),
      first: p.givenName,
      last: p.familyName,
      preferred: s(p.preferredName),
      email: s(p.email),
      program: st.programName,
      campus: m.campus ?? st.cohort?.campus ?? "",
      status: m.status ?? (st._count.enrolments ? "Active Student" : "Registered Student"),
      residency: m.residency ?? "Domestic",
      rateCategory: m.rateCategory ?? m.residency ?? "Domestic",
      country: m.country ?? "",
      province: "province" in m ? s(m.province) : "",
      schedule: m.schedule ?? st.cohort?.label ?? "",
      standing: st.standing,
      personId: st.personId,
      createdAt: st.createdAt,
    });
  }
  return out;
}

/** "Enter student # or last name" filter. */
export function studentMatches(st: StudentInfo | undefined, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (!st) return false;
  return st.number.toLowerCase().includes(t) || st.last.toLowerCase().startsWith(t) || st.name.toLowerCase().includes(t);
}

export async function requireStudent(inst: string, id: string) {
  const info = (await studentsInfo(inst, [id])).get(id);
  if (!info) throw httpError(404, "Student not found", "NOT_FOUND");
  return info;
}

/* ------------------------------------------------------------------ */
/* Ledger books                                                         */
/* ------------------------------------------------------------------ */

export type Entry = {
  id: string;
  studentId: string;
  kind: string;
  label: string;
  amount: number;
  status: string;
  source: string;
  note: string;
  dueAt: Date | null;
  postedAt: Date;
  createdAt: Date;
  termId: string | null;
  termName: string;
  meta: Data;
  number: number;
  managed: boolean;
};
export type Alloc = { id: string; fundId: string; chargeId: string; amount: number; at: string; studentId: string };
export type Charge = Entry & { total: number; paid: number; owing: number; statusLabel: string; hidden: boolean; ledgerTypeId: string; ledgerTypeName: string; tuition: boolean };
export type Fund = Entry & { allocated: number; refunded: number; available: number; statusLabel: string; typeName: string; active: boolean; hidden: boolean };
export type Refund = Entry & { refundType: string; refundOf: string };
export type Book = {
  studentId: string;
  entries: Entry[];
  charges: Charge[];
  payments: Fund[];
  credits: Fund[];
  refunds: Refund[];
  allocs: Alloc[];
  balance: number;
  available: number;
};

const NUMBER_KIND: Record<string, string> = { charge: "receivable", payment: "transaction", refund: "transaction", credit: "disbursement" };

/** Ledger types whose category or trigger marks them as tuition. */
export function tuitionTypeIds(cfg: Config) {
  const tuitionCats = new Set(cfg.ledgerCategories.filter((c) => /tuition/i.test(s(c.data.name))).map((c) => c.id));
  return new Set(
    cfg.ledgerTypes
      .filter((t) => /Tuition/.test(s(t.data.trigger)) || arr<string>(t.data.categories).some((c) => tuitionCats.has(c)) || /tuition/i.test(s(t.data.name)))
      .map((t) => t.id),
  );
}

export async function loadBooks(inst: string, cfg: Config, studentIds?: string[]): Promise<Map<string, Book>> {
  const where = { institutionId: inst, ...(studentIds ? { studentId: { in: studentIds } } : {}) };
  const ctx = studentIds ?? undefined;
  const [entries, metas, allocRows, terms] = await Promise.all([
    prisma.financeLedgerEntry.findMany({ where, orderBy: [{ postedAt: "asc" }, { createdAt: "asc" }] }),
    rows(inst, S.META, ctx),
    rows(inst, S.ALLOC, ctx),
    prisma.financialTerm.findMany({ where: { institutionId: inst } }),
  ]);
  const termName = new Map(terms.map((t) => [t.id, t.name]));
  const metaBy = new Map(metas.filter((m) => m.singletonKey).map((m) => [m.singletonKey!, m.data]));

  // Entries recorded outside Financial Management may not have a display-number
  // metadata row. Reads must never create one: derive a stable, non-sequential
  // display number from the immutable UUID instead.
  for (const e of entries) {
    if (metaBy.has(e.id)) continue;
    const tail = e.id.replace(/[^a-f0-9]/gi, "").slice(-8);
    metaBy.set(e.id, { number: 8_000_000 + (Number.parseInt(tail || "0", 16) % 1_000_000), managed: false });
  }

  const tuitionTypes = tuitionTypeIds(cfg);
  const allocs: Alloc[] = allocRows.map((a) => ({ id: a.id, fundId: s(a.data.fundId), chargeId: s(a.data.chargeId), amount: num(a.data.amount), at: s(a.data.at), studentId: a.contextKey }));
  const books = new Map<string, Book>();
  const bookOf = (id: string) => {
    let b = books.get(id);
    if (!b) books.set(id, (b = { studentId: id, entries: [], charges: [], payments: [], credits: [], refunds: [], allocs: [], balance: 0, available: 0 }));
    return b;
  };
  for (const a of allocs) bookOf(a.studentId).allocs.push(a);

  for (const e of entries) {
    const meta = metaBy.get(e.id) ?? {};
    const base: Entry = {
      id: e.id,
      studentId: e.studentId,
      kind: e.kind,
      label: e.label,
      amount: num(e.amountCad),
      status: e.status,
      source: e.source ?? "",
      note: e.note ?? "",
      dueAt: e.dueAt,
      postedAt: e.postedAt,
      createdAt: e.createdAt,
      termId: e.financialTermId,
      termName: e.financialTermId ? termName.get(e.financialTermId) ?? "" : "",
      meta,
      number: num(meta.number),
      managed: meta.managed === true,
    };
    const b = bookOf(e.studentId);
    b.entries.push(base);
    if (e.kind === "charge") {
      const paidAlloc = r2(b.allocs.filter((a) => a.chargeId === e.id).reduce((t, a) => t + a.amount, 0));
      const legacyPaid = e.status === "paid" && paidAlloc < EPS;
      const total = r2(num(e.amountCad));
      const paid = legacyPaid ? total : Math.min(paidAlloc, Math.max(total, paidAlloc));
      const refunded = meta.refunded === true;
      const removed = meta.removed === true || (e.status === "waived" && !refunded) || e.status === "void";
      let statusLabel = "Not Paid";
      if (refunded) statusLabel = "Refunded";
      else if (removed) statusLabel = "Removed";
      else if (paid >= total - EPS) statusLabel = "Paid";
      else if (paid > EPS) statusLabel = "Partially Paid";
      else if (s(meta.paymentStatus) === "Pending") statusLabel = "Pending";
      const typeId = s(meta.ledgerTypeId);
      b.charges.push({
        ...base,
        total,
        paid: r2(paid),
        owing: refunded || removed ? 0 : r2(Math.max(0, total - paid)),
        statusLabel,
        hidden: removed,
        ledgerTypeId: typeId,
        ledgerTypeName: nameOf(cfg.byId.get(typeId)) || e.label,
        tuition: typeId ? tuitionTypes.has(typeId) : /tuition/i.test(e.label),
      });
    } else if (e.kind === "payment" || e.kind === "credit") {
      const allocated = r2(b.allocs.filter((a) => a.fundId === e.id).reduce((t, a) => t + a.amount, 0));
      const refunded = r2(num(meta.refundedAmount));
      const removed = meta.removed === true || e.status === "void";
      const active = !removed && (e.kind === "payment" ? true : e.status !== "waived");
      const amount = r2(num(e.amountCad));
      const available = active && base.managed ? r2(Math.max(0, amount - allocated - refunded)) : 0;
      let statusLabel = "";
      if (e.kind === "payment") {
        if (refunded >= amount - EPS && amount > 0) statusLabel = "Refunded";
        else if (refunded > EPS) statusLabel = "Partially Refunded";
        else if (!base.managed || available < EPS) statusLabel = "Applied";
        else if (allocated > EPS) statusLabel = "Partially Applied";
        else statusLabel = "Unapplied";
      } else statusLabel = s(meta.status) || (e.status === "waived" ? "Inactive" : "Active");
      const fund: Fund = {
        ...base,
        allocated: base.managed ? allocated : active ? amount - refunded : 0,
        refunded,
        available,
        statusLabel,
        typeName: e.kind === "credit" ? s(meta.typeName) || e.label : s(meta.method) || e.source || "Payment",
        active,
        hidden: removed,
      };
      (e.kind === "payment" ? b.payments : b.credits).push(fund);
    } else if (e.kind === "refund") {
      b.refunds.push({ ...base, refundType: s(meta.refundType) || "Cash Back", refundOf: s(meta.refundOf) });
    }
  }
  for (const b of books.values()) {
    // Payments recorded outside Financial Management were taken against the balance, not specific fees:
    // spread what they did not already settle oldest-first over the outside fees that are still open.
    const outsidePaid = b.charges.filter((c) => !c.managed && c.status === "paid" && !b.allocs.some((a) => a.chargeId === c.id)).reduce((t, c) => t + c.total, 0);
    const outsideRefunds = b.refunds.filter((r) => !r.refundOf && r.status !== "void").reduce((t, r) => t + r.amount, 0);
    let pool = r2([...b.payments, ...b.credits].filter((f) => !f.managed && f.active).reduce((t, f) => t + f.amount - f.refunded, 0) - outsidePaid - outsideRefunds);
    for (const c of b.charges) {
      if (pool < EPS) break;
      if (c.managed || c.hidden || c.statusLabel === "Refunded" || c.owing < EPS) continue;
      const take = r2(Math.min(pool, c.owing));
      c.paid = r2(c.paid + take);
      c.owing = r2(c.owing - take);
      c.statusLabel = c.owing < EPS ? "Paid" : "Partially Paid";
      pool = r2(pool - take);
    }
    const counted = b.entries.filter((e) => e.status !== "waived" && e.status !== "void");
    const sum = (k: string) => counted.filter((e) => e.kind === k).reduce((t, e) => t + e.amount, 0);
    b.balance = r2(sum("charge") + sum("refund") - sum("payment") - sum("credit"));
    b.available = r2([...b.payments, ...b.credits].reduce((t, f) => t + f.available, 0));
  }
  return books;
}

export async function loadBook(inst: string, cfg: Config, studentId: string): Promise<Book> {
  return (await loadBooks(inst, cfg, [studentId])).get(studentId) ?? { studentId, entries: [], charges: [], payments: [], credits: [], refunds: [], allocs: [], balance: 0, available: 0 };
}

export async function writeMeta(user: SessionClaims, studentId: string, entryId: string, data: Data) {
  await putSingle(user, S.META, studentId, entryId, data);
}

export async function patchMeta(user: SessionClaims, e: Entry, patch: Data) {
  await writeMeta(user, e.studentId, e.id, { ...e.meta, ...patch });
}

/** Creates a ledger entry together with its Financial Management metadata. */
export async function postEntry(
  user: SessionClaims,
  input: { studentId: string; kind: "charge" | "payment" | "credit" | "refund"; label: string; amount: number; status?: string; source?: string | null; note?: string | null; postedAt?: Date; dueAt?: Date | null; termId?: string | null; reversedFromId?: string | null; courseId?: string | null; sectionId?: string | null },
  meta: Data,
  db: Db = prisma,
) {
  const [cfg, student] = await Promise.all([
    loadConfig(user.institutionId),
    requireStudent(user.institutionId, input.studentId),
  ]);
  await assertPeriodOpen(
    user,
    cfg,
    student.campus,
    input.postedAt ?? new Date(),
    `This ${input.kind === "charge" ? "receivable" : input.kind}`,
  );
  const entry = await db.financeLedgerEntry.create({
    data: {
      institutionId: user.institutionId,
      studentId: input.studentId,
      kind: input.kind,
      label: input.label.slice(0, 200),
      amountCad: r2(input.amount),
      status: input.status ?? (input.kind === "charge" ? "open" : "paid"),
      source: input.source ?? `financial-management`,
      note: input.note || null,
      postedAt: input.postedAt ?? new Date(),
      dueAt: input.dueAt ?? null,
      financialTermId: input.termId ?? null,
      reversedFromId: input.reversedFromId ?? null,
      courseId: input.courseId ?? null,
      sectionId: input.sectionId ?? null,
    },
  });
  const number = num(meta.number) || (await nextNumber(user.institutionId, NUMBER_KIND[input.kind] ?? "transaction"));
  await putSingle(user, S.META, input.studentId, entry.id, { ...meta, number, managed: true }, db);
  return { entry, number };
}

/* ------------------------------------------------------------------ */
/* Allocations                                                          */
/* ------------------------------------------------------------------ */

/** Applies a payment / credit to open charges (oldest first), optionally limited to some charges or an amount. */
export async function allocateFund(user: SessionClaims, book: Book, fundId: string, opts: { chargeIds?: string[]; max?: number } = {}) {
  const fund = [...book.payments, ...book.credits].find((f) => f.id === fundId);
  if (!fund) return 0;
  let left = r2(Math.min(fund.available, opts.max ?? Infinity));
  if (left < EPS) return 0;
  let applied = 0;
  const open = book.charges.filter((c) => !c.hidden && c.statusLabel !== "Refunded" && c.owing > EPS && (!opts.chargeIds || opts.chargeIds.includes(c.id)));
  for (const c of open) {
    if (left < EPS) break;
    const take = r2(Math.min(left, c.owing));
    await add(user, S.ALLOC, { fundId, chargeId: c.id, amount: take, at: new Date().toISOString() }, book.studentId);
    c.owing = r2(c.owing - take);
    c.paid = r2(c.paid + take);
    fund.available = r2(fund.available - take);
    left = r2(left - take);
    applied = r2(applied + take);
  }
  return applied;
}

/** Releases allocations (newest first) for a fund and/or charge, up to an amount. Returns what was released per fund. */
export async function deallocate(user: SessionClaims, book: Book, filter: { fundId?: string; chargeId?: string }, amount = Infinity) {
  const matches = book.allocs
    .filter((a) => (!filter.fundId || a.fundId === filter.fundId) && (!filter.chargeId || a.chargeId === filter.chargeId))
    .sort((a, b) => b.at.localeCompare(a.at));
  let left = amount;
  const released = new Map<string, number>();
  for (const a of matches) {
    if (left < EPS) break;
    const take = r2(Math.min(left, a.amount));
    if (take >= a.amount - EPS) await drop(user, [a.id]);
    else await save(user, a.id, { fundId: a.fundId, chargeId: a.chargeId, amount: r2(a.amount - take), at: a.at });
    released.set(a.fundId, r2((released.get(a.fundId) ?? 0) + take));
    left = r2(left - take);
  }
  return released;
}

/** Keeps the ledger status of charges ("open" / "paid") in line with their allocations. */
export async function syncChargeStatuses(user: SessionClaims, cfg: Config, studentId: string) {
  const book = await loadBook(user.institutionId, cfg, studentId);
  for (const c of book.charges) {
    if (c.hidden || c.statusLabel === "Refunded") continue;
    const allocated = book.allocs.some((a) => a.chargeId === c.id);
    if (!allocated && !c.managed) continue;
    const want = c.paid >= c.total - EPS ? "paid" : "open";
    if (c.status !== want) await prisma.financeLedgerEntry.update({ where: { id: c.id }, data: { status: want, rowVersion: { increment: 1 } } });
  }
  return loadBook(user.institutionId, cfg, studentId);
}

/* ------------------------------------------------------------------ */
/* Period lock-out                                                      */
/* ------------------------------------------------------------------ */

export async function assertPeriodOpen(user: SessionClaims, cfg: Config, campus: string, when: Date | string, what: string) {
  const d = day(when);
  if (!d) return;
  const hits = cfg.lockouts.filter((l) => {
    if (l.data.lockStatus !== "Locked") return false;
    if (!(s(l.data.startDate) <= d && d <= s(l.data.endDate))) return false;
    const campuses = arr<string>(l.data.campuses);
    return !campus || !campuses.length || campuses.includes(campus);
  });
  if (!hits.length) return;
  let levelName: string | null = null;
  for (const l of hits) {
    if (l.data.overrideAccess === "Customize Access") {
      if (arr<string>(l.data.accessUsers).includes(user.accountId)) continue;
      levelName ??= (await effectiveAccess(user.institutionId, user.accountId)).accessLevel ?? "";
      if (levelName && arr<string>(l.data.accessLevels).includes(levelName)) continue;
    }
    const note = s(l.data.note);
    throw httpError(423, `${what} is dated ${d}, inside the locked period ${s(l.data.startDate)} – ${s(l.data.endDate)}${note ? ` (${note})` : ""}. Ask a user with override access or unlock the period.`, "PERIOD_LOCKED");
  }
}

/* ------------------------------------------------------------------ */
/* Audit                                                                */
/* ------------------------------------------------------------------ */

/** Student finance audit trail entry ("Receivable added", "Payment recorded", …) with the event's stored details. */
export async function finAudit(user: SessionClaims, studentId: string, action: string, record: string, details: Data, recordId?: string) {
  await audit(user, S.STUDENT_AUDIT, studentId, action, { recordId: recordId ?? null, after: { record, ...details } });
}

/** Prefix for academic terms offered as financial terms before they have a FinancialTerm row. */
export const ACADEMIC_TERM = "term:";

/** The financial term matching an academic term (same code), created on first use. */
export async function ensureFinancialTerm(inst: string, term: { code: string; name: string; startsOn: string; endsOn: string }, db: Db = prisma) {
  const found = await db.financialTerm.findFirst({ where: { institutionId: inst, code: term.code } });
  if (found) return found;
  return db.financialTerm.create({ data: { institutionId: inst, code: term.code, name: term.name, startsOn: term.startsOn, endsOn: term.endsOn } });
}

export async function termOptions(inst: string) {
  const [terms, academic] = await Promise.all([
    prisma.financialTerm.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" } }),
    prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" } }),
  ]);
  const codes = new Set(terms.map((t) => t.code));
  const out = [
    ...terms.map((t) => ({ id: t.id, name: t.name, startsOn: t.startsOn, endsOn: t.endsOn })),
    ...academic.filter((t) => !codes.has(t.code)).map((t) => ({ id: `${ACADEMIC_TERM}${t.id}`, name: t.name, startsOn: t.startsOn, endsOn: t.endsOn })),
  ];
  return out.sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.name.localeCompare(b.name));
}

export async function termId(inst: string, v: unknown, db: Db = prisma) {
  const t = s(v).trim();
  if (!t) return null;
  if (t.startsWith(ACADEMIC_TERM)) {
    const academic = await db.term.findFirst({ where: { id: t.slice(ACADEMIC_TERM.length), institutionId: inst } });
    if (!academic) throw httpError(400, `Term "${t}" was not found`);
    return (await ensureFinancialTerm(inst, academic, db)).id;
  }
  const found = await db.financialTerm.findFirst({ where: { institutionId: inst, OR: [{ id: t }, { name: t }, { code: t }] } });
  if (found) return found.id;
  const academic = await db.term.findFirst({ where: { institutionId: inst, OR: [{ id: t }, { name: t }, { code: t }] } });
  if (!academic) throw httpError(400, `Term "${t}" was not found`);
  return (await ensureFinancialTerm(inst, academic, db)).id;
}

/** Page slice for directory listings. */
export function page<T>(items: T[], q: { page?: unknown; perPage?: unknown }) {
  const perPage = Math.min(200, Math.max(1, Number(q.perPage) || 25));
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.min(pages, Math.max(1, Number(q.page) || 1));
  return { items: items.slice((p - 1) * perPage, p * perPage), total: items.length, page: p, perPage, pages };
}
