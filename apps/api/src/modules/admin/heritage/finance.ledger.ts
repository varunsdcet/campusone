/* Financial Management ledger operations: fees, payments, refunds, receipts and disbursements / credits. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { buildDocumentPdf, type DocLine } from "../../../lib/taxPdf.js";
import { termLabel } from "../../../lib/sectionTerm.js";
import { loadSectionTerms } from "../../instructor/myCoursesFacts.js";
import { assertNoActiveStudentHold } from "../../me/studentAlignment.js";
import { type Rec } from "./sysconfig.js";
import { ADVANCE_CREDIT } from "./finance.spec.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { effectiveAccess } from "../superAdmin.service.js";
import {
  EPS,
  S,
  amountOf,
  arr,
  cad,
  canFinance,
  dateAt,
  day,
  deallocate,
  ensureFinancialTerm,
  finAudit,
  getSingle,
  httpError,
  allocateFund,
  assertPeriodOpen,
  loadBook,
  loadConfig,
  nameOf,
  nextNumber,
  num,
  patchMeta,
  postEntry,
  putSingle,
  r2,
  requireStudent,
  s,
  syncChargeStatuses,
  termId,
  text,
  type Book,
  type Charge,
  type Config,
  type Data,
  type Fund,
  type StudentInfo,
} from "./finance.core.js";

export type StudentCtx = { user: SessionClaims; inst: string; cfg: Config; st: StudentInfo; book: Book };

export async function studentCtx(user: SessionClaims, studentId: string, level: "view" | "edit"): Promise<StudentCtx> {
  await canFinance(user, level);
  const inst = user.institutionId;
  const cfg = await loadConfig(inst);
  const st = await requireStudent(inst, studentId);
  return { user, inst, cfg, st, book: await loadBook(inst, cfg, studentId) };
}

/** Context of the student owning a ledger entry. */
export async function entryCtx(user: SessionClaims, entryId: string, level: "view" | "edit") {
  await canFinance(user, level);
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId }, select: { studentId: true } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
  return studentCtx(user, e.studentId, level);
}

const findCharge = (c: StudentCtx, id: string) => {
  const x = c.book.charges.find((ch) => ch.id === id);
  if (!x) throw httpError(404, "Fee not found", "NOT_FOUND");
  return x;
};
const findFund = (c: StudentCtx, id: string, kind: "payment" | "credit") => {
  const x = (kind === "payment" ? c.book.payments : c.book.credits).find((f) => f.id === id);
  if (!x) throw httpError(404, kind === "payment" ? "Payment not found" : "Disbursement not found", "NOT_FOUND");
  return x;
};
const refresh = async (c: StudentCtx) => {
  c.book = await syncChargeStatuses(c.user, c.cfg, c.st.id);
  return c.book;
};

export const isInternational = (st: StudentInfo) => /international/i.test(st.rateCategory) || /international/i.test(st.residency);
export const defaultFee = (type: Rec | undefined, st: StudentInfo) => num(type?.data[isInternational(st) ? "international" : "domestic"]);

function paymentMethod(cfg: Config, v: unknown, label = "Payment Method") {
  const t = s(v).trim();
  if (!t) throw httpError(400, `${label} is required`);
  const m = cfg.paymentMethods.find((p) => p.id === t || nameOf(p) === t);
  if (!m) throw httpError(400, `${label} "${t}" is not a configured payment method`);
  return m;
}

function notFuture(d: Date, label: string) {
  if (day(d) > day(new Date())) throw httpError(400, `${label} cannot be in the future`);
}

/* ------------------------------------------------------------------ */
/* Fees (receivables)                                                   */
/* ------------------------------------------------------------------ */

type TaxLine = { name: string; rate: number; inclusive: boolean; amount: number };

function sameRegion(a: string, b: string) {
  const clean = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return Boolean(clean(a)) && clean(a) === clean(b);
}

export function feeTotals(cfg: Config, type: Rec | undefined, unit: number, quantity: number, student?: Pick<StudentInfo, "province" | "country">) {
  const subtotal = r2(unit * quantity);
  const province = student?.province ?? "";
  const country = student?.country ?? "";
  const taxes: TaxLine[] = arr<string>(type?.data.taxes)
    .map((id) => cfg.byId.get(id))
    .filter((t): t is Rec => {
      if (!t) return false;
      if (t.data.regionalize !== "Yes") return true;
      const regions = arr<string>(t.data.regions);
      return Boolean(student) && regions.some((region) => sameRegion(region, province) || sameRegion(region, country));
    })
    .map((t) => {
      const rate = num(t.data.rate);
      const inclusive = t.data.inclusive === "Yes";
      return { name: nameOf(t), rate, inclusive, amount: inclusive ? r2(subtotal - subtotal / (1 + rate / 100)) : r2((subtotal * rate) / 100) };
    });
  return { subtotal, taxes, total: r2(subtotal + taxes.filter((t) => !t.inclusive).reduce((a, t) => a + t.amount, 0)) };
}

function quantityOf(v: unknown) {
  const q = v === undefined || v === "" ? 1 : Number(v);
  if (!Number.isInteger(q) || q < 1 || q > 100) throw httpError(400, "Quantity must be a whole number between 1 and 100");
  return q;
}

function ledgerType(cfg: Config, v: unknown) {
  const t = s(v).trim();
  if (!t) throw httpError(400, "Tuition / Ledger Type is required");
  const type = cfg.ledgerTypes.find((x) => x.id === t || nameOf(x) === t);
  if (!type) throw httpError(400, `Tuition / Ledger Type "${t}" was not found`);
  return type;
}

function unitAmount(type: Rec | undefined, st: StudentInfo, v: unknown) {
  const dflt = defaultFee(type, st);
  const raw = v === undefined || v === "" ? dflt : amountOf(v, "Fee Amount", { allowZero: true });
  if (type && type.data.overridable === "No" && Math.abs(raw - dflt) > EPS) throw httpError(400, `"${nameOf(type)}" is not overridable; its fee amount is fixed at ${cad(dflt)}`);
  return raw;
}

export const PAYMENT_STATUSES = ["Pending / Not Paid", "Paid from available credit"] as const;

/** Applies a student's available funds (oldest first) to the given charges. */
export async function applyAvailable(c: StudentCtx, chargeIds?: string[]) {
  let applied = 0;
  for (const f of [...c.book.payments, ...c.book.credits].filter((x) => x.available > EPS).sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime())) {
    applied = r2(applied + (await allocateFund(c.user, c.book, f.id, chargeIds ? { chargeIds } : {})));
  }
  return applied;
}

export async function postFee(
  c: StudentCtx,
  input: { type: Rec | undefined; label?: string; unit: number; quantity: number; termId: string | null; note: string; dueAt?: Date | null; extra?: Data; courseId?: string | null; sectionId?: string | null },
) {
  const { subtotal, taxes, total } = feeTotals(c.cfg, input.type, input.unit, input.quantity, c.st);
  if (total < EPS) throw httpError(400, "Fee Amount must be greater than zero");
  const { entry, number } = await postEntry(
    c.user,
    { studentId: c.st.id, kind: "charge", label: input.label ?? nameOf(input.type), amount: total, termId: input.termId, note: input.note, dueAt: input.dueAt ?? null, courseId: input.courseId ?? null, sectionId: input.sectionId ?? null },
    { ledgerTypeId: input.type?.id ?? "", unitAmount: input.unit, quantity: input.quantity, subtotal, taxes, paymentStatus: "Not Paid", ...(input.extra ?? {}) },
  );
  await finAudit(c.user, c.st.id, "Receivable added", `Receivable #${number}`, { type: input.label ?? nameOf(input.type), amount: cad(total), quantity: input.quantity, taxes: taxes.map((t) => `${t.name} ${cad(t.amount)}`).join(", ") || "None", note: input.note }, entry.id);
  return { id: entry.id, number, total };
}

/** Resolves the optional course / section a fee is for; a section implies its course. */
export async function feeCourseLink(inst: string, body: Data) {
  const sectionId = s(body.sectionId).trim();
  const courseId = s(body.courseId).trim();
  if (sectionId) {
    const x = await prisma.section.findFirst({ where: { id: sectionId, institutionId: inst }, include: { course: true, term: true } });
    if (!x) throw httpError(400, "The selected course section was not found");
    if (courseId && courseId !== x.courseId) throw httpError(400, "The selected section does not belong to the selected course");
    const term = (await loadSectionTerms(inst, [x])).get(x.id) ?? null;
    return { courseId: x.courseId, sectionId: x.id, label: `${x.course.code} ${x.code}`, term };
  }
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, institutionId: inst } });
    if (!course) throw httpError(400, "The selected course was not found");
    return { courseId: course.id, sectionId: null, label: course.code, term: null };
  }
  return null;
}

/** Sections a fee can be linked to on Add Fee: the student's own course enrolments, newest term first. */
export async function feeSectionOptions(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "view");
  const rows = await prisma.enrolment.findMany({
    where: { institutionId: c.inst, studentId },
    include: { section: { include: { course: true, term: true } } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const terms = await loadSectionTerms(c.inst, rows.map((e) => e.section));
  const termOf = (e: (typeof rows)[number]) => terms.get(e.sectionId) ?? null;
  return {
    items: rows
      .filter((e) => !seen.has(e.sectionId) && seen.add(e.sectionId))
      .sort((a, b) => (termOf(b)?.startsOn ?? "").localeCompare(termOf(a)?.startsOn ?? "") || a.section.course.code.localeCompare(b.section.course.code))
      .map((e) => ({
        sectionId: e.sectionId,
        courseId: e.section.courseId,
        label: `${e.section.course.code} ${e.section.code} — ${e.section.course.title}`,
        termName: termLabel(termOf(e)),
        enrolmentStatus: e.status,
      })),
  };
}

export async function addFee(user: SessionClaims, studentId: string, body: Data) {
  return withStudentMoneyLock(user.institutionId, studentId, () => addFeeLocked(user, studentId, body));
}

async function addFeeLocked(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "edit");
  const type = ledgerType(c.cfg, body.ledgerTypeId);
  const quantity = quantityOf(body.quantity);
  const unit = unitAmount(type, c.st, body.amount);
  const link = await feeCourseLink(c.inst, body);
  const term = s(body.termId).trim() || !link?.term ? await termId(c.inst, body.termId) : (await ensureFinancialTerm(c.inst, link.term)).id;
  const status = s(body.paymentStatus) || PAYMENT_STATUSES[0];
  if (!(PAYMENT_STATUSES as readonly string[]).includes(status)) throw httpError(400, `Payment Status "${status}" is not valid`);
  await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This fee");
  const fee = await postFee(c, {
    type,
    label: link ? `${nameOf(type)} · ${link.label}` : undefined,
    unit,
    quantity,
    termId: term,
    note: text(body.note),
    courseId: link?.courseId ?? null,
    sectionId: link?.sectionId ?? null,
    extra: link ? { courseId: link.courseId, sectionId: link.sectionId, courseLabel: link.label } : undefined,
  });
  let applied = 0;
  if (status === "Paid from available credit") {
    c.book = await loadBook(c.inst, c.cfg, c.st.id);
    if (c.book.available < EPS) throw httpError(400, "The fee was added, but the student has no available credit to pay it.");
    applied = await applyAvailable(c, [fee.id]);
  }
  await refresh(c);
  const { applyAutomatedPromotions } = await import("./finance.records.js");
  const promotions = await applyAutomatedPromotions(user, studentId);
  return {
    id: fee.id,
    number: fee.number,
    promotionsApplied: promotions.length,
    message: `${applied > EPS ? `Fee added and ${cad(applied)} paid from available credit` : "Fee added successfully"}${promotions.length ? `; ${promotions.length} automated promotion${promotions.length === 1 ? "" : "s"} applied` : ""}`,
  };
}

export function updateFee(user: SessionClaims, entryId: string, body: Data) {
  return withStudentLock(user, entryId, () => updateFeeLocked(user, entryId, body));
}

async function updateFeeLocked(user: SessionClaims, entryId: string, body: Data) {
  const c = await entryCtx(user, entryId, "edit");
  const ch = findCharge(c, entryId);
  if (ch.hidden || ch.statusLabel === "Refunded") throw httpError(400, "Removed or refunded fees cannot be edited");
  const type = c.cfg.byId.get(ch.ledgerTypeId);
  const quantity = quantityOf(body.quantity ?? ch.meta.quantity);
  const unit = body.amount === undefined ? num(ch.meta.unitAmount) || ch.total : amountOf(body.amount, "Fee Amount", { allowZero: true });
  if (type && type.data.overridable === "No" && Math.abs(unit - defaultFee(type, c.st)) > EPS && Math.abs(unit - num(ch.meta.unitAmount)) > EPS) throw httpError(400, `"${nameOf(type)}" is not overridable`);
  const { subtotal, taxes, total } = feeTotals(c.cfg, type, unit, quantity, c.st);
  if (total < EPS) throw httpError(400, "Fee Amount must be greater than zero");
  if (total < ch.paid - EPS) throw httpError(400, `This fee already has ${cad(ch.paid)} paid; the new total (${cad(total)}) cannot be lower. Refund part of the fee instead.`);
  const paidElsewhere = ch.status === "paid" && !c.book.allocs.some((a) => a.chargeId === ch.id);
  if (paidElsewhere && Math.abs(total - ch.total) > EPS) throw httpError(400, "This fee was paid outside Financial Management, so its amount cannot be changed. Refund it and add a new fee instead.");
  await assertPeriodOpen(user, c.cfg, c.st.campus, ch.postedAt, "This fee");
  const term = body.termId === undefined ? ch.termId : await termId(c.inst, body.termId);
  const note = body.note === undefined ? ch.note : text(body.note);
  await prisma.financeLedgerEntry.update({ where: { id: ch.id }, data: { amountCad: total, financialTermId: term, note: note || null, status: ch.paid >= total - EPS ? "paid" : "open", rowVersion: { increment: 1 } } });
  await patchMeta(user, ch, { unitAmount: unit, quantity, subtotal, taxes });
  await finAudit(user, c.st.id, "Receivable updated", `Receivable #${ch.number}`, { type: ch.ledgerTypeName, before: `${cad(ch.total)} × ${num(ch.meta.quantity) || 1}`, after: `${cad(total)} (${quantity} × ${cad(unit)})`, note }, ch.id);
  await refresh(c);
  return { id: ch.id, message: "Fee updated successfully" };
}

export function removeFee(user: SessionClaims, entryId: string) {
  return withStudentLock(user, entryId, () => removeFeeLocked(user, entryId));
}

async function removeFeeLocked(user: SessionClaims, entryId: string) {
  const c = await entryCtx(user, entryId, "edit");
  const ch = findCharge(c, entryId);
  if (ch.hidden) throw httpError(400, "This fee has already been removed");
  if (ch.paid > EPS) throw httpError(400, `This fee has ${cad(ch.paid)} paid against it and cannot be removed. Refund it instead.`);
  await assertPeriodOpen(user, c.cfg, c.st.campus, ch.postedAt, "This fee");
  const { createAdjustment } = await import("./finance.records.js");
  const adjustment = await createAdjustment(user, {
    studentId: c.st.id,
    direction: "Decrease balance (credit)",
    amount: ch.owing,
    reason: `Remove receivable #${ch.number} ${ch.ledgerTypeName}`,
    ledgerEntryId: ch.id,
    ledgerAction: "waive",
  });
  return {
    pendingApproval: true,
    adjustmentId: adjustment.id,
    message: `Removal submitted as Financial Adjustment #${adjustment.number}. Another user must approve it before the balance changes.`,
  };
}

type RefundInput = { refundType: "Cash Back" | "Apply Credit"; method: Rec | null; amount: number; date: Date; note: string };

function refundInput(cfg: Config, body: Data, max: number, what: string): RefundInput {
  const refundType = s(body.refundType) || "Cash Back";
  if (refundType !== "Cash Back" && refundType !== "Apply Credit") throw httpError(400, `Refund Type "${refundType}" is not valid`);
  const amount = amountOf(body.amount, "Refund Amount");
  if (amount > max + EPS) throw httpError(400, `Refund Amount cannot exceed ${cad(max)} (the refundable amount of this ${what})`);
  const date = dateAt(body.date || day(new Date()), "Refund Date");
  notFuture(date, "Refund Date");
  return { refundType, method: refundType === "Cash Back" ? paymentMethod(cfg, body.method, "Refund Method") : null, amount, date, note: text(body.note) };
}

/** Cash back (refund entry) or account credit (refund + Advance Payment Credit) for part of a payment. */
async function refundFrom(c: StudentCtx, fund: Fund | null, r: RefundInput, amount: number, why: string) {
  if (amount < EPS) return null;
  const { entry, number } = await postEntry(
    c.user,
    {
      studentId: c.st.id,
      kind: "refund",
      label: r.refundType === "Cash Back" ? "Refund" : "Refund to account credit",
      amount,
      source: r.method ? nameOf(r.method) : ADVANCE_CREDIT,
      note: r.note,
      postedAt: r.date,
      reversedFromId: fund?.id ?? null,
    },
    { refundType: r.refundType, refundOf: fund?.id ?? "", method: r.method ? nameOf(r.method) : "", methodId: r.method?.id ?? "", reason: why },
  );
  if (fund) await patchMeta(c.user, fund, { refundedAmount: r2(fund.refunded + amount) });
  if (r.refundType === "Apply Credit") {
    await postEntry(
      c.user,
      { studentId: c.st.id, kind: "credit", label: ADVANCE_CREDIT, amount, note: r.note, postedAt: r.date, source: "financial-management" },
      { typeName: ADVANCE_CREDIT, typeId: "", status: "Active", fromRefund: entry.id },
    );
  }
  return number;
}

async function withStudentLock<T>(user: SessionClaims, entryId: string, run: () => Promise<T>): Promise<T> {
  const row = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId }, select: { studentId: true } });
  return withStudentMoneyLock(user.institutionId, row?.studentId ?? entryId, run);
}

export function refundPayment(user: SessionClaims, entryId: string, body: Data) {
  return withStudentLock(user, entryId, () => refundPaymentLocked(user, entryId, body));
}

export function refundFee(user: SessionClaims, entryId: string, body: Data) {
  return withStudentLock(user, entryId, () => refundFeeLocked(user, entryId, body));
}

async function refundPaymentLocked(user: SessionClaims, entryId: string, body: Data) {
  const c = await entryCtx(user, entryId, "edit");
  const p = findFund(c, entryId, "payment");
  const refundable = r2(p.amount - p.refunded);
  if (refundable < EPS) throw httpError(400, "This payment has already been fully refunded");
  const r = refundInput(c.cfg, body, refundable, "payment");
  await assertPeriodOpen(user, c.cfg, c.st.campus, r.date, "This refund");
  if (p.managed && r.amount > p.available + EPS) await deallocate(user, c.book, { fundId: p.id }, r2(r.amount - p.available));
  const number = await refundFrom(c, p, r, r.amount, `Refund of payment #${p.number}`);
  await finAudit(user, c.st.id, "Payment refunded", `Transaction #${p.number}`, { refund: `#${number}`, refundType: r.refundType, method: r.method ? nameOf(r.method) : ADVANCE_CREDIT, amount: cad(r.amount), date: day(r.date), note: r.note }, p.id);
  await refresh(c);
  return { message: "Transaction information updated successfully" };
}

async function refundFeeLocked(user: SessionClaims, entryId: string, body: Data) {
  const c = await entryCtx(user, entryId, "edit");
  const ch = findCharge(c, entryId);
  if (ch.hidden || ch.statusLabel === "Refunded") throw httpError(400, "This fee has already been removed or refunded");
  if (ch.paid < EPS) throw httpError(400, "Nothing has been paid on this fee. Remove it instead.");
  if (amountOf(body.amount, "Refund Amount") > ch.paid + EPS) throw httpError(400, `Refund Amount cannot exceed ${cad(ch.paid)} paid on this fee`);
  const r = refundInput(c.cfg, body, ch.paid, "fee");
  await assertPeriodOpen(user, c.cfg, c.st.campus, r.date, "This refund");
  const retained = r2(ch.total - r.amount);
  const release = r.amount;
  const allocated = r2(c.book.allocs.filter((a) => a.chargeId === ch.id).reduce((t, a) => t + a.amount, 0));
  const released = await deallocate(user, c.book, { chargeId: ch.id }, Math.min(release, allocated));
  const legacy = r2(release - [...released.values()].reduce((t, v) => t + v, 0));
  const full = retained < EPS;
  await prisma.financeLedgerEntry.update({ where: { id: ch.id }, data: full ? { status: "waived", rowVersion: { increment: 1 } } : { amountCad: retained, rowVersion: { increment: 1 } } });
  await patchMeta(user, ch, full ? { refunded: true, refundedAt: new Date().toISOString() } : { refundedAmount: r2(num(ch.meta.refundedAmount) + r.amount), originalAmount: num(ch.meta.originalAmount) || ch.total });
  c.book = await loadBook(c.inst, c.cfg, c.st.id);
  if (r.refundType === "Cash Back") {
    for (const [fundId, amt] of released) {
      const f = c.book.payments.find((x) => x.id === fundId);
      if (f) await refundFrom(c, f, r, Math.min(amt, f.available), `Refund of fee #${ch.number}`);
    }
  }
  await refundFrom(c, null, r, legacy, `Refund of fee #${ch.number}`);
  await finAudit(user, c.st.id, "Receivable refunded", `Receivable #${ch.number}`, { type: ch.ledgerTypeName, refundType: r.refundType, amount: cad(r.amount), released: cad(release), retained: cad(retained), date: day(r.date), note: r.note }, ch.id);
  await refresh(c);
  return { message: "Fee refunded successfully" };
}

/* ------------------------------------------------------------------ */
/* Payments                                                             */
/* ------------------------------------------------------------------ */

export const PAYMENT_TYPES = ["Standard", "Deposit", "Correction"] as const;
export const PAYEES = ["Student", "Institution"] as const;

export function applyPayment(user: SessionClaims, studentId: string, body: Data) {
  return withStudentMoneyLock(user.institutionId, studentId, () => applyPaymentLocked(user, studentId, body));
}

async function applyPaymentLocked(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "edit");
  const paymentType = s(body.paymentType) || "Standard";
  if (!(PAYMENT_TYPES as readonly string[]).includes(paymentType)) throw httpError(400, `Payment Type "${paymentType}" is not valid`);
  const payee = s(body.payee) || "Student";
  if (!(PAYEES as readonly string[]).includes(payee)) throw httpError(400, `Payee "${payee}" is not valid`);
  const amount = amountOf(body.amount, "Payment Amount", { allowNegative: paymentType === "Correction" });
  const date = dateAt(body.date || day(new Date()), "Payment Date");
  notFuture(date, "Payment Date");
  const method = paymentMethod(c.cfg, body.method);
  const note = text(body.note);
  if (amount < 0) {
    if (!(await effectiveAccess(user.institutionId, user.accountId)).administrator) {
      throw httpError(403, "Only an administrator can post a negative correction", "FORBIDDEN");
    }
    if (!note) throw httpError(400, "A note explaining the negative correction is required");
  }
  await assertPeriodOpen(user, c.cfg, c.st.campus, date, "This payment");
  const { entry, number } = await postEntry(
    user,
    { studentId: c.st.id, kind: "payment", label: `${paymentType} Payment`, amount, source: nameOf(method), note, postedAt: date },
    { method: nameOf(method), methodId: method.id, payee, paymentType },
  );
  let applied = 0;
  if (body.autoApply !== false && amount > 0) {
    c.book = await loadBook(c.inst, c.cfg, c.st.id);
    applied = await allocateFund(user, c.book, entry.id);
  }
  await refresh(c);
  await generateReceipt(user, entry.id, c);
  await finAudit(user, c.st.id, "Payment recorded", `Transaction #${number}`, { type: `${paymentType} payment`, method: nameOf(method), payee, amount: cad(amount), applied: cad(applied), date: day(date), note }, entry.id);
  return { id: entry.id, number, applied, message: "Payment applied successfully" };
}

/** Applies a payment's unapplied amount to open fees (oldest first). */
export function allocatePayment(user: SessionClaims, entryId: string) {
  return withStudentLock(user, entryId, () => allocatePaymentLocked(user, entryId));
}

async function allocatePaymentLocked(user: SessionClaims, entryId: string) {
  const c = await entryCtx(user, entryId, "edit");
  const f = [...c.book.payments, ...c.book.credits].find((x) => x.id === entryId);
  if (!f) throw httpError(404, "Transaction not found", "NOT_FOUND");
  if (f.available < EPS) throw httpError(400, "This transaction has no unapplied amount");
  const applied = await allocateFund(user, c.book, f.id);
  if (applied < EPS) throw httpError(400, "The student has no outstanding fees to apply it to");
  await refresh(c);
  await finAudit(user, c.st.id, "Credit allocated", `Transaction #${f.number}`, { amount: cad(applied) }, f.id);
  return { message: `${cad(applied)} applied to outstanding fees` };
}

/* ------------------------------------------------------------------ */
/* Receipts                                                             */
/* ------------------------------------------------------------------ */

function receiptLines(c: StudentCtx, f: Fund | undefined, entryId: string) {
  const entry = c.book.entries.find((e) => e.id === entryId);
  if (!entry || (entry.kind !== "payment" && entry.kind !== "refund")) throw httpError(400, "Receipts are available for payments and refunds only");
  const allocations = c.book.allocs
    .filter((a) => a.fundId === entryId)
    .map((a) => {
      const ch = c.book.charges.find((x) => x.id === a.chargeId);
      return { label: ch ? `#${ch.number} ${ch.ledgerTypeName}` : "Fee", amount: a.amount };
    });
  return {
    number: entry.number,
    kind: entry.kind,
    student: c.st.name,
    studentNumber: c.st.number,
    campus: c.st.campus,
    program: c.st.program,
    date: day(entry.postedAt),
    amount: entry.amount,
    method: s(entry.meta.method) || entry.source,
    type: entry.kind === "refund" ? s(entry.meta.refundType) || "Refund" : `${s(entry.meta.paymentType) || "Standard"} payment`,
    payee: s(entry.meta.payee),
    note: entry.note,
    allocations,
    unapplied: f?.available ?? 0,
    balance: c.book.balance,
  };
}

export async function generateReceipt(user: SessionClaims, entryId: string, ctx?: StudentCtx) {
  const c = ctx ?? (await entryCtx(user, entryId, "edit"));
  c.book = await loadBook(c.inst, c.cfg, c.st.id);
  const f = c.book.payments.find((x) => x.id === entryId);
  const snapshot = receiptLines(c, f, entryId);
  const prev = await getSingle(c.inst, S.RECEIPT, c.st.id, entryId);
  const receiptNumber = num(prev?.data.receiptNumber) || (await nextNumber(c.inst, "receipt"));
  await putSingle(user, S.RECEIPT, c.st.id, entryId, { receiptNumber, snapshot, generatedAt: new Date().toISOString(), by: user.accountId });
  if (prev) await finAudit(user, c.st.id, "Receipt re-generated", `Receipt #${receiptNumber}`, { transaction: `#${snapshot.number}` }, entryId);
  return { receiptNumber, message: prev ? "Receipt re-generated successfully" : "Receipt generated successfully" };
}

export async function receiptInfo(user: SessionClaims, entryId: string) {
  await canFinance(user, "view");
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId }, select: { studentId: true, kind: true } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
  const r = await getSingle(user.institutionId, S.RECEIPT, e.studentId, entryId);
  return { kind: e.kind, receipt: r ? { receiptNumber: num(r.data.receiptNumber), generatedAt: s(r.data.generatedAt) } : null };
}

export async function institutionName(inst: string) {
  const i = await prisma.institution.findUnique({ where: { id: inst }, select: { name: true } });
  return i?.name || "Heritage Community College";
}

export async function receiptPdf(user: SessionClaims, entryId: string) {
  await canFinance(user, "view");
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId }, select: { studentId: true } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
  const r = await getSingle(user.institutionId, S.RECEIPT, e.studentId, entryId);
  if (!r) throw httpError(404, "No receipt has been generated for this transaction yet", "NOT_FOUND");
  const x = r.data.snapshot as ReturnType<typeof receiptLines>;
  const school = await institutionName(user.institutionId);
  const lines: DocLine[] = [
    { kind: "title", text: school },
    { kind: "text", text: x.kind === "refund" ? "Refund Receipt" : "Payment Receipt", size: 13, bold: true },
    { kind: "rule" },
    { kind: "row", cells: [{ text: `Receipt #${num(r.data.receiptNumber)}`, x: 0, bold: true }, { text: `Transaction #${x.number}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: `Student: ${x.student} (${x.studentNumber})`, x: 0 }, { text: `Date: ${x.date}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: `Program: ${x.program || "—"}`, x: 0 }, { text: `Campus: ${x.campus || "—"}`, x: 504, right: true }] },
    { kind: "gap", h: 6 },
    { kind: "row", cells: [{ text: "Type", x: 0, bold: true }, { text: "Method", x: 200, bold: true }, { text: "Amount", x: 504, right: true, bold: true }] },
    { kind: "rule" },
    { kind: "row", cells: [{ text: x.type, x: 0 }, { text: x.method || "—", x: 200 }, { text: cad(x.amount), x: 504, right: true }] },
  ];
  if (x.allocations.length) {
    lines.push({ kind: "gap", h: 8 }, { kind: "text", text: "Applied to", bold: true });
    for (const a of x.allocations) lines.push({ kind: "row", cells: [{ text: a.label, x: 12 }, { text: cad(a.amount), x: 504, right: true }] });
  }
  lines.push(
    { kind: "rule" },
    ...(x.kind === "payment" ? [{ kind: "row" as const, cells: [{ text: "Unapplied amount", x: 0 }, { text: cad(x.unapplied), x: 504, right: true }] }] : []),
    { kind: "row", cells: [{ text: "Account balance", x: 0, bold: true }, { text: cad(x.balance), x: 504, right: true, bold: true }] },
  );
  if (x.note) lines.push({ kind: "gap", h: 8 }, { kind: "text", text: `Note: ${x.note}` });
  lines.push({ kind: "gap", h: 10 }, { kind: "text", text: `Generated ${new Date(s(r.data.generatedAt)).toLocaleString("en-CA")}`, size: 8 });
  return { filename: `receipt-${num(r.data.receiptNumber)}.pdf`, pdf: buildDocumentPdf(lines, `${school} - Receipt #${num(r.data.receiptNumber)}`) };
}

/* ------------------------------------------------------------------ */
/* Disbursements / credits                                              */
/* ------------------------------------------------------------------ */

export const CREDIT_STATUSES = ["Active", "Inactive", "Declined", "Pending", "Revoked"] as const;

function disbursementType(cfg: Config, v: unknown) {
  const t = s(v).trim();
  if (!t) throw httpError(400, "Disbursement Type is required");
  const type = cfg.disbursementTypes.find((x) => x.id === t || nameOf(x) === t);
  if (!type) throw httpError(400, `Disbursement Type "${t}" was not found`);
  return type;
}

/** Posts a credit (scholarship, bursary, loan, promotion, fund allocation…) and applies it to open fees. */
export async function postCredit(c: StudentCtx, input: { typeName: string; typeId: string; amount: number; note: string; status?: string; postedAt?: Date; chargeIds?: string[]; extra?: Data; allocate?: boolean }) {
  const status = input.status ?? "Active";
  const { entry, number } = await postEntry(
    c.user,
    { studentId: c.st.id, kind: "credit", label: input.typeName, amount: input.amount, note: input.note, postedAt: input.postedAt, status: status === "Active" ? "paid" : "waived" },
    { typeName: input.typeName, typeId: input.typeId, status, ...(input.extra ?? {}) },
  );
  let applied = 0;
  if (status === "Active" && input.allocate !== false) {
    c.book = await loadBook(c.inst, c.cfg, c.st.id);
    applied = await allocateFund(c.user, c.book, entry.id, input.chargeIds ? { chargeIds: input.chargeIds } : {});
  }
  await refresh(c);
  return { id: entry.id, number, applied };
}

/** Moves a credit between statuses; anything but Active releases its allocations. */
export async function setCreditStatus(c: StudentCtx, fund: Fund, status: string, chargeIds?: string[]) {
  if (s(fund.meta.status) === status) return;
  if (status !== "Active") await deallocate(c.user, c.book, { fundId: fund.id });
  await prisma.financeLedgerEntry.update({ where: { id: fund.id }, data: { status: status === "Active" ? "paid" : "waived", rowVersion: { increment: 1 } } });
  await patchMeta(c.user, fund, { status });
  c.book = await loadBook(c.inst, c.cfg, c.st.id);
  if (status === "Active") await allocateFund(c.user, c.book, fund.id, chargeIds ? { chargeIds } : {});
  await refresh(c);
}

export function createDisbursement(user: SessionClaims, studentId: string, body: Data) {
  return withStudentMoneyLock(user.institutionId, studentId, () => createDisbursementLocked(user, studentId, body));
}

async function createDisbursementLocked(user: SessionClaims, studentId: string, body: Data) {
  await assertNoActiveStudentHold(user.institutionId, studentId, "Creating a disbursement");
  const c = await studentCtx(user, studentId, "edit");
  const type = disbursementType(c.cfg, body.typeId);
  const amount = amountOf(body.amount, "Amount");
  const note = text(body.note);
  await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This disbursement");
  const out = await postCredit(c, { typeName: nameOf(type), typeId: type.id, amount, note, allocate: body.allocate !== false });
  await finAudit(user, c.st.id, "Disbursement created", `Disbursement #${out.number}`, { type: nameOf(type), amount: cad(amount), allocated: cad(out.applied), note }, out.id);
  return { id: out.id, number: out.number, message: "Disbursement created successfully" };
}

export function updateDisbursement(user: SessionClaims, entryId: string, body: Data) {
  return withStudentLock(user, entryId, () => updateDisbursementLocked(user, entryId, body));
}

async function updateDisbursementLocked(user: SessionClaims, entryId: string, body: Data) {
  const c = await entryCtx(user, entryId, "edit");
  const f = findFund(c, entryId, "credit");
  if (f.hidden) throw httpError(400, "This disbursement has been removed");
  const note = body.note === undefined ? f.note : text(body.note);
  if (f.typeName === ADVANCE_CREDIT || f.meta.awardId) {
    await prisma.financeLedgerEntry.update({ where: { id: f.id }, data: { note: note || null, rowVersion: { increment: 1 } } });
    await finAudit(user, c.st.id, "Disbursement updated", `Disbursement #${f.number}`, { type: f.typeName, note }, f.id);
    return { message: f.typeName === ADVANCE_CREDIT ? "Advanced payment credit updated successfully" : "Disbursement updated successfully" };
  }
  const type = body.typeId === undefined ? c.cfg.byId.get(s(f.meta.typeId)) : disbursementType(c.cfg, body.typeId);
  const amount = body.amount === undefined ? f.amount : amountOf(body.amount, "Amount");
  if (amount < f.allocated - EPS && f.managed) throw httpError(400, `${cad(f.allocated)} of this disbursement is already allocated to fees; the amount cannot be lower than that.`);
  await assertPeriodOpen(user, c.cfg, c.st.campus, f.postedAt, "This disbursement");
  const typeName = type ? nameOf(type) : f.typeName;
  await prisma.financeLedgerEntry.update({ where: { id: f.id }, data: { amountCad: amount, label: typeName, note: note || null, rowVersion: { increment: 1 } } });
  await patchMeta(user, f, { typeName, typeId: type?.id ?? s(f.meta.typeId) });
  if (amount > f.amount + EPS && s(f.meta.status || "Active") === "Active") {
    c.book = await loadBook(c.inst, c.cfg, c.st.id);
    await allocateFund(user, c.book, f.id);
  }
  await refresh(c);
  await finAudit(user, c.st.id, "Disbursement updated", `Disbursement #${f.number}`, { type: `${f.typeName} → ${typeName}`, amount: `${cad(f.amount)} → ${cad(amount)}`, note }, f.id);
  return { message: "Disbursement updated successfully" };
}

export function removeDisbursement(user: SessionClaims, entryId: string) {
  return withStudentLock(user, entryId, () => removeDisbursementLocked(user, entryId));
}

async function removeDisbursementLocked(user: SessionClaims, entryId: string) {
  const c = await entryCtx(user, entryId, "edit");
  const f = findFund(c, entryId, "credit");
  if (f.hidden) throw httpError(400, "This disbursement has already been removed");
  if (f.typeName === ADVANCE_CREDIT) throw httpError(400, "Advance Payment Credits hold money the student already paid and cannot be removed.");
  if (f.meta.awardId) throw httpError(400, "This disbursement belongs to a promotion / award. Change the award's status instead.");
  if (f.meta.fundId) throw httpError(400, "This disbursement was allocated from an unallocated fund. Remove the allocation from the fund instead.");
  await assertPeriodOpen(user, c.cfg, c.st.campus, f.postedAt, "This disbursement");
  await deallocate(user, c.book, { fundId: f.id });
  await prisma.financeLedgerEntry.update({ where: { id: f.id }, data: { status: "void", rowVersion: { increment: 1 } } });
  await patchMeta(user, f, { removed: true, removedAt: new Date().toISOString() });
  await refresh(c);
  await finAudit(user, c.st.id, "Disbursement removed", `Disbursement #${f.number}`, { type: f.typeName, amount: cad(f.amount) }, f.id);
  return { message: "Disbursement removed successfully" };
}

export type { Charge, Fund };
