/* Student profile › Finance. Ledger writes go through Financial Management (finance.ledger); this adds the per-student views. */

import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { getTranscriptSummary } from "../../academic/program-plan.service.js";
import { assertNoActiveStudentHold } from "../../me/studentAlignment.js";
import { assertPermission } from "../superAdmin.service.js";
import {
  EPS,
  S,
  add,
  agentLabel,
  amountOf,
  arr,
  assertPeriodOpen,
  cad,
  day,
  drop,
  finAudit,
  getSingle,
  httpError,
  nameOf,
  nextNumber,
  num,
  page,
  putSingle,
  r2,
  row,
  rows,
  s,
  save,
  termOptions,
  text,
  type Data,
  type Fund,
} from "./finance.core.js";
import {
  PAYEES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  defaultFee,
  generateReceipt,
  postCredit,
  postFee,
  receiptInfo,
  receiptPdf,
  refundPayment,
  setCreditStatus,
  studentCtx,
  type StudentCtx,
} from "./finance.ledger.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { ADVANCE_CREDIT } from "./finance.spec.js";
import { auditTrail } from "./students.js";
import { loadProfile, saveProfile } from "./students.core.js";
import { AWARD_ELIGIBILITY, AWARD_STATUSES, INVOICE_ITEM_TYPES, PLAN_FREQUENCIES, PLAN_SCHEDULE_TYPES, PLAN_SYNC, REFUND_TYPES, TAX_DOCUMENTS } from "./students.spec.js";

/** Ledger-entry routes are nested under a student; the entry must belong to that student. */
export async function assertEntryOf(user: SessionClaims, studentId: string, entryId: string) {
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId, studentId }, select: { id: true } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
}

const visible = <T extends { hidden: boolean }>(xs: T[]) => xs.filter((x) => !x.hidden);
const sum = (xs: number[]) => r2(xs.reduce((t, v) => t + v, 0));
const isAward = (f: Fund) => Boolean(f.meta.awardId);

/* ------------------------------------------------------------------ */
/* Financial Overview                                                   */
/* ------------------------------------------------------------------ */

async function agentOf(c: StudentCtx) {
  const assigned = await getSingle(c.inst, S.STUDENT_AGENT, c.st.id, "agent");
  const id = s(assigned?.data.agentId) || (await loadProfile(c.inst, c.st.id)).agentId;
  return id ? c.cfg.agents.find((a) => a.id === id) : undefined;
}

export async function financeOverview(user: SessionClaims, id: string, q: Data) {
  const c = await studentCtx(user, id, "view");
  const charges = visible(c.book.charges);
  const tuition = charges.filter((x) => x.tuition);
  const fees = charges.filter((x) => !x.tuition);
  const payments = c.book.payments.filter((p) => p.active);
  const credits = visible(c.book.credits).filter((f) => f.active);
  const disb = credits.filter((f) => !isAward(f) && f.typeName !== ADVANCE_CREDIT);
  const awards = credits.filter(isAward);
  const agent = await agentOf(c);
  const tuitionPaid = sum(tuition.map((x) => x.paid));
  const tuitionTotal = sum(tuition.map((x) => x.total));
  let earned = 0;
  let expected = 0;
  if (agent) {
    const rate = num(agent.data.commissionRate);
    if (s(agent.data.commissionType) === "Fixed") {
      expected = rate;
      earned = tuitionPaid > EPS ? rate : 0;
    } else {
      earned = r2((tuitionPaid * rate) / 100);
      expected = r2((tuitionTotal * rate) / 100);
    }
  }
  const ledgerType = s(q.ledgerType);
  const term = s(q.term);
  const ledger = charges
    .filter((x) => (!ledgerType || x.ledgerTypeId === ledgerType) && (!term || x.termId === term))
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
    .map((x) => ({
      id: x.id,
      number: x.number,
      type: x.ledgerTypeName,
      ledgerTypeId: x.ledgerTypeId,
      status: x.statusLabel,
      entryDate: day(x.createdAt),
      postingDate: day(x.postedAt),
      amount: x.total,
      paid: x.paid,
      owing: x.owing,
      quantity: num(x.meta.quantity) || 1,
      unitAmount: num(x.meta.unitAmount) || x.total,
      termId: x.termId ?? "",
      term: x.termName,
      note: x.note,
    }));
  return {
    totals: {
      tuitionOwing: sum(tuition.map((x) => x.owing)),
      tuitionPaid,
      tuitionTotal,
      feesOwing: sum(fees.map((x) => x.owing)),
      feesPaid: sum(fees.map((x) => x.paid)),
      feesTotal: sum(fees.map((x) => x.total)),
      totalPayments: sum(payments.map((p) => p.amount)),
      totalCredit: c.book.available,
      totalRefunds: sum(c.book.refunds.map((r) => r.amount)),
      balance: c.book.balance,
      fundsAllocated: sum(disb.map((f) => f.allocated)),
      fundsRemaining: sum(disb.map((f) => f.available)),
      awardsAllocated: sum(awards.map((f) => f.allocated)),
      awardsRemaining: sum(awards.map((f) => f.available)),
      commissionEarned: earned,
      commissionExpected: expected,
    },
    agent: agent ? agentLabel(agent) : "",
    ledger,
    unpaidFees: ledger.filter((x) => x.owing > EPS),
    options: {
      ledgerTypes: c.cfg.ledgerTypes.map((t) => ({ id: t.id, name: nameOf(t), amount: defaultFee(t, c.st), overridable: s(t.data.overridable) !== "No" })),
      terms: await termOptions(c.inst),
      paymentMethods: c.cfg.paymentMethods.map((m) => nameOf(m)),
      paymentStatuses: PAYMENT_STATUSES,
      paymentTypes: PAYMENT_TYPES,
      payees: PAYEES,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Manage Agent (separate Agent Management permission)                  */
/* ------------------------------------------------------------------ */

export async function getAgent(user: SessionClaims, id: string) {
  await assertPermission(user, "agentManagement", "edit");
  const c = await studentCtx(user, id, "view");
  const agent = await agentOf(c);
  return { agentId: agent?.id ?? "", agents: c.cfg.agents.map((a) => ({ id: a.id, name: agentLabel(a) })) };
}

export async function setAgent(user: SessionClaims, id: string, body: Data) {
  await assertPermission(user, "agentManagement", "edit");
  const c = await studentCtx(user, id, "view");
  const agentId = s(body.agentId);
  const agent = agentId ? c.cfg.agents.find((a) => a.id === agentId) : undefined;
  if (agentId && !agent) throw httpError(400, "Agent was not found");
  const before = await agentOf(c);
  await putSingle(user, S.STUDENT_AGENT, id, "agent", { agentId });
  await saveProfile(user, id, { agentId });
  await finAudit(user, id, "Agent updated", "Student agent", { before: before ? agentLabel(before) : "None", after: agent ? agentLabel(agent) : "None" });
  return { message: "Agent updated successfully" };
}

/* ------------------------------------------------------------------ */
/* Financial Transactions                                               */
/* ------------------------------------------------------------------ */

export async function financeTransactions(user: SessionClaims, id: string, q: Data) {
  const c = await studentCtx(user, id, "view");
  const receipts = new Set((await rows(c.inst, S.RECEIPT, id)).map((r) => r.singletonKey));
  const out: Array<Data & { sortAt: number }> = [];
  for (const p of c.book.payments) {
    out.push({ id: p.id, number: p.number, kind: "payment", fundSource: s(p.meta.method) || p.source || "Payment", entryDate: day(p.postedAt), recordedDate: day(p.createdAt), status: p.statusLabel, type: `${s(p.meta.paymentType) || "Standard"} Payment`, amount: p.amount, balance: p.available, refundable: r2(p.amount - p.refunded), receipt: receipts.has(p.id), sortAt: p.postedAt.getTime() });
  }
  for (const r of c.book.refunds) {
    out.push({ id: r.id, number: r.number, kind: "refund", fundSource: s(r.meta.method) || r.source, entryDate: day(r.postedAt), recordedDate: day(r.createdAt), status: r.refundType, type: "Refund", amount: r.amount, balance: r.amount, refundable: 0, receipt: receipts.has(r.id), sortAt: r.postedAt.getTime() });
  }
  for (const f of visible(c.book.credits)) {
    out.push({ id: f.id, number: f.number, kind: "credit", fundSource: f.typeName, entryDate: day(f.postedAt), recordedDate: day(f.createdAt), status: f.statusLabel, type: isAward(f) ? "Promotion / Award" : "Disbursement / Credit", amount: f.amount, balance: f.available, refundable: 0, receipt: false, sortAt: f.postedAt.getTime() });
  }
  if (q.credit === "true" || q.credit === true) {
    for (const a of c.book.allocs) {
      const fund = [...c.book.payments, ...c.book.credits].find((f) => f.id === a.fundId);
      const ch = c.book.charges.find((x) => x.id === a.chargeId);
      out.push({ id: a.id, number: fund?.number ?? "", kind: "allocation", fundSource: fund ? (fund.kind === "payment" ? s(fund.meta.method) || "Payment" : fund.typeName) : "", entryDate: day(a.at), recordedDate: day(a.at), status: "Allocated", type: `Credit Allocation → #${ch?.number ?? ""} ${ch?.ledgerTypeName ?? ""}`.trim(), amount: a.amount, balance: a.amount, refundable: 0, receipt: false, sortAt: new Date(a.at).getTime() });
    }
  }
  const term = text(q.q, 120).toLowerCase();
  const items = out
    .filter((x) => !term || [x.number, x.entryDate, x.status, x.type, x.fundSource].some((v) => s(v).toLowerCase().includes(term)))
    .sort((a, b) => b.sortAt - a.sortAt)
    .map(({ sortAt: _s, ...x }) => x);
  return {
    ...page(items, q),
    refundable: sum(c.book.payments.filter((p) => p.active).map((p) => r2(p.amount - p.refunded))),
    options: { refundTypes: REFUND_TYPES, methods: ["Originating payment source", ...c.cfg.paymentMethods.map((m) => nameOf(m))] },
  };
}

/** Refund of one payment, or (Issue Refund) spread over the newest refundable payments. "Originating payment source" reuses each payment's method. */
export async function issueRefund(user: SessionClaims, id: string, body: Data) {
  await assertNoActiveStudentHold(user.institutionId, id, "Issuing a refund");
  const c = await studentCtx(user, id, "edit");
  const origin = s(body.method) === "Originating payment source";
  const payload = (p: Fund, amount: number) => ({ ...body, amount, method: origin ? s(p.meta.method) || p.source : body.method });
  const target = s(body.entryId);
  if (target) {
    const p = c.book.payments.find((x) => x.id === target);
    if (!p) throw httpError(404, "Payment not found", "NOT_FOUND");
    return refundPayment(user, target, payload(p, Number(body.amount)));
  }
  let left = amountOf(body.amount, "Refund Amount");
  const pool = c.book.payments.filter((p) => p.active && p.amount - p.refunded > EPS).sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  const total = sum(pool.map((p) => p.amount - p.refunded));
  if (left > total + EPS) throw httpError(400, `Refund Amount cannot exceed ${cad(total)} (the refundable amount of this student's payments)`);
  for (const p of pool) {
    if (left < EPS) break;
    const take = r2(Math.min(left, p.amount - p.refunded));
    await refundPayment(user, p.id, payload(p, take));
    left = r2(left - take);
  }
  return { message: "Transaction information updated successfully" };
}

export async function receipt(user: SessionClaims, id: string, entryId: string) {
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId, studentId: id } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
  const info = await receiptInfo(user, entryId);
  if (!info.receipt) await generateReceipt(user, entryId);
  return receiptPdf(user, entryId);
}

export async function regenerateReceipt(user: SessionClaims, id: string, entryId: string) {
  const e = await prisma.financeLedgerEntry.findFirst({ where: { id: entryId, institutionId: user.institutionId, studentId: id } });
  if (!e) throw httpError(404, "Transaction not found", "NOT_FOUND");
  return generateReceipt(user, entryId);
}

/* ------------------------------------------------------------------ */
/* Manage Invoices                                                      */
/* ------------------------------------------------------------------ */

type InvoiceItem = { id?: string; type: string; quantity: number; description: string; fee: number; total: number; chargeId?: string; courseId?: string };

export async function invoices(user: SessionClaims, id: string) {
  const c = await studentCtx(user, id, "view");
  const [list, templates, courses, textbooks] = await Promise.all([
    rows(c.inst, S.INVOICE, id),
    prisma.heritageRecord.findMany({ where: { institutionId: c.inst, screenId: "SYS:DOC_TEMPLATE", deletedAt: null } }),
    prisma.course.findMany({ where: { institutionId: c.inst }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    rows(c.inst, "CM:TEXTBOOK"),
  ]);
  const tuitionType = c.cfg.ledgerTypes.find((t) => s(t.data.trigger) === "Course Tuition");
  const intl = /international/i.test(c.st.rateCategory) || /international/i.test(c.st.residency);
  return {
    items: list
      .filter((r) => !r.data.deleted)
      .map((r) => ({ id: r.id, number: num(r.data.number), dueDate: s(r.data.dueDate), term: s(r.data.term), template: s(r.data.template), total: num(r.data.total), items: arr<InvoiceItem>(r.data.items), date: day(r.createdAt) }))
      .sort((a, b) => b.number - a.number),
    templates: templates
      .map((t) => ({ id: t.id, data: JSON.parse(t.dataJson) as Data }))
      .filter((t) => s(t.data.documentType) === "Invoice / Receipt")
      .map((t) => ({ id: t.id, name: s(t.data.name) })),
    terms: await termOptions(c.inst),
    courses: courses.map((x) => ({
      id: x.id,
      label: `${x.code} — ${x.title}`,
      fee: tuitionType ? defaultFee(tuitionType, c.st) : 0,
      textbooks: textbooks
        .filter((t) => arr<Data>(t.data.courses).some((cr) => s(cr.course) === x.id))
        .map((t) => ({ id: t.id, name: s(t.data.name), fee: num(t.data[intl ? "international" : "domestic"]) })),
    })),
    itemTypes: INVOICE_ITEM_TYPES,
  };
}

export function createInvoice(user: SessionClaims, id: string, body: Data) {
  return withStudentMoneyLock(user.institutionId, id, () => createInvoiceLocked(user, id, body));
}

async function createInvoiceLocked(user: SessionClaims, id: string, body: Data) {
  const c = await studentCtx(user, id, "edit");
  const dueDate = s(body.dueDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw httpError(400, "Due Date is required");
  const terms = await termOptions(c.inst);
  const term = s(body.termId) ? terms.find((t) => t.id === s(body.termId)) : undefined;
  if (s(body.termId) && !term) throw httpError(400, "Term was not found");
  const templateRow = s(body.templateId) ? await prisma.heritageRecord.findFirst({ where: { id: s(body.templateId), institutionId: c.inst, screenId: "SYS:DOC_TEMPLATE", deletedAt: null } }) : null;
  if (s(body.templateId) && !templateRow) throw httpError(400, "Invoice Template was not found");
  const items: InvoiceItem[] = [];
  for (const raw of arr<Data>(body.items)) {
    const chargeId = s(raw.chargeId);
    if (chargeId) {
      const ch = c.book.charges.find((x) => x.id === chargeId && !x.hidden);
      if (!ch) throw httpError(400, "One of the selected fees was not found");
      if (ch.owing < EPS) throw httpError(400, `Fee #${ch.number} is already paid`);
      items.push({ id: randomUUID(), type: "Other Fee / Ledger Item", quantity: 1, description: `#${ch.number} ${ch.ledgerTypeName}`, fee: ch.owing, total: ch.owing, chargeId });
      continue;
    }
    const quantity = Number(raw.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw httpError(400, "Quantity must be a whole number between 1 and 100");
    const description = text(raw.description, 300);
    if (!description) throw httpError(400, "Each invoice item needs a description");
    const fee = amountOf(raw.fee, "Fee", { allowZero: true });
    const type = s(raw.type) || "Course";
    if (!(INVOICE_ITEM_TYPES as readonly string[]).includes(type)) throw httpError(400, `Item Type "${type}" is not valid`);
    items.push({ id: randomUUID(), type, quantity, description, fee, total: r2(fee * quantity), ...(s(raw.courseId) ? { courseId: s(raw.courseId) } : {}) });
  }
  if (!items.length) throw httpError(400, "Add at least one invoice item");
  const number = await nextNumber(c.inst, "invoice");
  await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This invoice");
  for (const item of items) {
    if (item.chargeId || item.type === "Credit / Disbursement") continue;
    const trigger = item.type === "Course" ? "Course Tuition" : item.type === "Textbook" ? "Textbooks" : "";
    const ledgerType = trigger ? c.cfg.ledgerTypes.find((type) => s(type.data.trigger) === trigger) : undefined;
    if (trigger && !ledgerType) throw httpError(400, `${trigger} ledger type is not configured`);
    const posted = await postFee(c, {
      type: ledgerType,
      label: item.description,
      unit: item.fee,
      quantity: item.quantity,
      termId: term?.id ?? null,
      note: `Invoice #${number}: ${item.description}`,
      dueAt: new Date(`${dueDate}T12:00:00.000Z`),
      courseId: item.courseId ?? null,
      extra: { invoiceItem: item.id ?? "" },
    });
    item.chargeId = posted.id;
  }
  const total = sum(items.map((i) => i.total));
  const template = templateRow ? s((JSON.parse(templateRow.dataJson) as Data).name) : "";
  const rec = await add(user, S.INVOICE, { number, dueDate, termId: term?.id ?? "", term: term?.name ?? "", templateId: templateRow?.id ?? "", template, items, total }, id);
  await finAudit(user, id, "Invoice created", `Invoice #${number}`, { dueDate, term: term?.name ?? "", template, items: items.length, total: cad(total) }, rec.id);
  return { id: rec.id, number, message: "Invoice saved successfully" };
}

/* ------------------------------------------------------------------ */
/* Disbursements & Credits                                              */
/* ------------------------------------------------------------------ */

export async function disbursements(user: SessionClaims, id: string) {
  const c = await studentCtx(user, id, "view");
  return {
    items: visible(c.book.credits)
      .filter((f) => !isAward(f))
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
      .map((f) => ({ id: f.id, number: f.number, fundType: f.typeName, typeId: s(f.meta.typeId), status: f.statusLabel, recordDate: day(f.postedAt), total: f.amount, balance: f.available, allocated: f.allocated, note: f.note, advance: f.typeName === ADVANCE_CREDIT })),
    types: c.cfg.disbursementTypes.map((t) => ({ id: t.id, name: nameOf(t) })),
  };
}

/* ------------------------------------------------------------------ */
/* Promotions & Awards                                                  */
/* ------------------------------------------------------------------ */

async function eligiblePromotions(c: StudentCtx) {
  const today = day(new Date());
  const summary = await getTranscriptSummary(c.inst, c.st.id).catch(() => null);
  const completed = summary?.courses.filter((x) => x.status === "completed").length ?? 0;
  return c.cfg.promotions.filter((p) => {
    const d = p.data;
    if (s(d.status) !== "Active") return false;
    if (d.specifyDates && ((s(d.startDate) && today < s(d.startDate)) || (s(d.endDate) && today > s(d.endDate)))) return false;
    if (d.completion === "Courses Completed" && completed < num(d.coursesCompleted)) return false;
    if (d.academic === "Grade Point Average" && (summary?.cgpa ?? 0) < num(d.requiredAverage)) return false;
    return true;
  });
}

function promotionAmount(c: StudentCtx, d: Data) {
  if (s(d.value) === "Percentage") {
    const base = visible(c.book.charges).filter((x) => (s(d.applyTo) === "Tuition Only" ? x.tuition : true)).reduce((t, x) => t + x.total, 0);
    const amt = r2((base * num(d.percentage)) / 100);
    return d.customizeMax ? Math.min(amt, num(d.maxPerUse)) : amt;
  }
  return num(d.amount);
}

export async function awards(user: SessionClaims, id: string) {
  const c = await studentCtx(user, id, "view");
  const recs = await rows(c.inst, S.AWARD, id);
  const credits = new Map(c.book.credits.map((f) => [f.id, f]));
  const eligible = await eligiblePromotions(c);
  return {
    items: recs
      .filter((r) => !r.data.deleted)
      .map((r) => {
        const f = credits.get(s(r.data.creditId));
        return { id: r.id, number: num(r.data.number), name: s(r.data.name), status: s(r.data.status), allocation: s(r.data.allocation), eligibility: s(r.data.eligibility), note: s(r.data.note), amount: f?.amount ?? num(r.data.amount), allocated: f?.allocated ?? 0, remaining: f?.available ?? 0 };
      }),
    eligible: eligible.map((p) => ({ id: p.id, name: nameOf(p), amount: promotionAmount(c, p.data), eligibility: s(p.data.eligibility) || "Manual" })),
    configuredPromotions: c.cfg.promotions.filter((p) => s(p.data.status) === "Active").length,
    options: {
      statuses: AWARD_STATUSES,
      allocation: c.cfg.promotionAllocations.filter((a) => a.data.status !== "Inactive").map(nameOf).filter(Boolean),
      eligibility: AWARD_ELIGIBILITY,
    },
  };
}

export async function addAward(user: SessionClaims, id: string, body: Data) {
  const c = await studentCtx(user, id, "edit");
  const eligible = await eligiblePromotions(c);
  if (!eligible.length) throw httpError(400, "This student is not eligible for any promotions or awards.");
  const promo = eligible.find((p) => p.id === s(body.promotionId));
  if (!promo) throw httpError(400, "Select a Promotion / Award the student is eligible for");
  const status = s(body.status) || AWARD_STATUSES[0];
  if (!(AWARD_STATUSES as readonly string[]).includes(status)) throw httpError(400, "Promotion / Award Status is not valid");
  const allocations = c.cfg.promotionAllocations.filter((a) => a.data.status !== "Inactive");
  const requestedAllocation = s(body.allocation);
  const allocationRecord = requestedAllocation ? allocations.find((a) => a.id === requestedAllocation || nameOf(a) === requestedAllocation) : allocations[0];
  const allocation = allocationRecord ? nameOf(allocationRecord) : "";
  if (!allocation) throw httpError(400, "Select an active Promotion Allocation");
  const eligibility = s(body.eligibility) || s(promo.data.eligibility) || AWARD_ELIGIBILITY[0];
  if (!(AWARD_ELIGIBILITY as readonly string[]).includes(eligibility)) throw httpError(400, "Promotion Eligibility is not valid");
  const amount = promotionAmount(c, promo.data);
  if (amount < EPS) throw httpError(400, "This promotion has no amount to award for this student");
  const note = text(body.note);
  const number = await nextNumber(c.inst, "award");
  const rec = await add(user, S.AWARD, { number, promotionId: promo.id, name: nameOf(promo), status, allocation, eligibility, note, amount }, id);
  const credit = await postCredit(c, { typeName: nameOf(promo), typeId: promo.id, amount, note, status: status === "Active" ? "Active" : "Inactive", extra: { awardId: rec.id } });
  await save(user, rec.id, { ...rec.data, creditId: credit.id });
  await finAudit(user, id, "Promotion / award added", `Award #${number}`, { promotion: nameOf(promo), status, allocation, eligibility, amount: cad(amount), allocated: cad(credit.applied), note }, rec.id);
  return { id: rec.id, message: "Promotion / award saved successfully" };
}

export async function updateAward(user: SessionClaims, id: string, awardId: string, body: Data) {
  const c = await studentCtx(user, id, "edit");
  const rec = await row(c.inst, S.AWARD, awardId, "Promotion / award");
  if (rec.contextKey !== id) throw httpError(404, "Promotion / award not found", "NOT_FOUND");
  const status = s(body.status) || s(rec.data.status);
  if (!(AWARD_STATUSES as readonly string[]).includes(status)) throw httpError(400, "Promotion / Award Status is not valid");
  const note = body.note === undefined ? s(rec.data.note) : text(body.note);
  const fund = c.book.credits.find((f) => f.id === s(rec.data.creditId));
  if (fund) await setCreditStatus(c, fund, status);
  await save(user, rec.id, { ...rec.data, status, note });
  await finAudit(user, id, "Promotion / award updated", `Award #${num(rec.data.number)}`, { promotion: rec.data.name, status: `${s(rec.data.status)} → ${status}`, note }, rec.id);
  return { message: "Promotion / award updated successfully" };
}

/* ------------------------------------------------------------------ */
/* Payment Plans & Collections                                          */
/* ------------------------------------------------------------------ */

function addInterval(date: string, freq: string, times: number) {
  const [n, unit] = freq.split(" ");
  const k = Number(n) * times;
  const d = new Date(`${date}T12:00:00Z`);
  if (unit!.startsWith("day")) d.setUTCDate(d.getUTCDate() + k);
  else if (unit!.startsWith("week")) d.setUTCDate(d.getUTCDate() + 7 * k);
  else d.setUTCMonth(d.getUTCMonth() + k);
  return d.toISOString().slice(0, 10);
}

function planBalances(c: StudentCtx, sync: string, termId: string, includeCredit: boolean) {
  const charges = visible(c.book.charges);
  const debit = sync === "With term balance" ? sum(charges.filter((x) => x.termId === termId).map((x) => x.owing)) : sum(charges.map((x) => x.owing));
  const credit = c.book.available;
  return { debit, credit, debt: r2(Math.max(0, debit - (includeCredit ? credit : 0))) };
}

function planView(c: StudentCtx, r: { id: string; data: Data }) {
  const d = r.data;
  const debt = num(d.debt);
  const start = s(d.startDate);
  const instalments = arr<{ due: string; amount: number }>(d.instalments);
  const paid = Math.min(debt, sum(c.book.payments.filter((p) => p.active && day(p.postedAt) >= start).map((p) => p.amount - p.refunded)));
  let cumulative = 0;
  const next = instalments.find((i) => (cumulative = r2(cumulative + i.amount)) > paid + EPS);
  let status = "Active";
  if (paid >= debt - EPS) status = "Completed";
  else if (!instalments.length || paid < (instalments[0]?.amount ?? 0) - EPS) status = "Pending First Instalment";
  return {
    id: r.id,
    number: num(d.number),
    status,
    nextPayment: next ? `${next.due} (${cad(next.amount)})` : "",
    term: s(d.term),
    termId: s(d.termId),
    instalments: instalments.length,
    schedule: instalments,
    interest: 0,
    debt,
    paid: r2(paid),
    remaining: r2(debt - paid),
    startDate: start,
    sync: s(d.sync),
    includeCredit: d.includeCredit === true,
    applyInterest: d.applyInterest === true,
    scheduleType: s(d.scheduleType),
    frequency: s(d.frequency),
    instalmentAmount: num(d.instalmentAmount),
    promptConditions: s(d.promptConditions),
    notes: s(d.notes),
  };
}

export async function paymentPlans(user: SessionClaims, id: string, q: Data) {
  const c = await studentCtx(user, id, "view");
  const list = (await rows(c.inst, S.PLAN, id)).filter((r) => !r.data.deleted).map((r) => planView(c, r));
  const term = text(q.q, 120).toLowerCase();
  const items = list.filter((p) => (!s(q.term) || p.termId === s(q.term)) && (!term || [p.number, p.startDate, p.status].some((v) => String(v).toLowerCase().includes(term))));
  return {
    items,
    terms: await termOptions(c.inst),
    balances: { total: planBalances(c, "With total fees balance", "", false), credit: c.book.available },
    options: { sync: PLAN_SYNC, scheduleTypes: PLAN_SCHEDULE_TYPES, frequencies: PLAN_FREQUENCIES },
  };
}

async function planInput(c: StudentCtx, body: Data) {
  const startDate = s(body.startDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw httpError(400, "Start Date is required");
  const terms = await termOptions(c.inst);
  const term = s(body.termId) ? terms.find((t) => t.id === s(body.termId)) : undefined;
  if (s(body.termId) && !term) throw httpError(400, "Term was not found");
  const sync = s(body.sync) || PLAN_SYNC[0];
  if (!(PLAN_SYNC as readonly string[]).includes(sync)) throw httpError(400, "Synchronize Balance is not valid");
  if (sync === "With term balance" && !term) throw httpError(400, "Select a Term to synchronize with the term balance");
  const includeCredit = body.includeCredit === true;
  const bal = planBalances(c, sync, term?.id ?? "", includeCredit);
  const debt = sync === "Disabled" ? amountOf(body.debt, "Debt Amount") : bal.debt;
  if (debt < EPS) throw httpError(400, "There is no balance to put on a payment plan");
  const scheduleType = s(body.scheduleType) || PLAN_SCHEDULE_TYPES[0];
  if (!(PLAN_SCHEDULE_TYPES as readonly string[]).includes(scheduleType)) throw httpError(400, "Schedule Type is not valid");
  if (scheduleType !== "Fixed Instalment Frequency") throw httpError(400, "Manual / Advanced instalment entry is not available yet (source confirmation required). Use Fixed Instalment Frequency.");
  const frequency = s(body.frequency) || "1 month";
  if (!PLAN_FREQUENCIES.includes(frequency)) throw httpError(400, "Instalment Frequency is not valid");
  const instalmentAmount = amountOf(body.instalmentAmount, "Instalment Amount");
  if (instalmentAmount > debt + EPS) throw httpError(400, "Instalment Amount cannot exceed the Debt Amount");
  const count = Math.ceil(debt / instalmentAmount - 1e-9);
  if (count > 120) throw httpError(400, "The plan would need more than 120 instalments; increase the Instalment Amount");
  const instalments = Array.from({ length: count }, (_, i) => ({ due: addInterval(startDate, frequency, i), amount: i === count - 1 ? r2(debt - instalmentAmount * (count - 1)) : instalmentAmount }));
  return {
    startDate,
    termId: term?.id ?? "",
    term: term?.name ?? "",
    sync,
    includeCredit,
    debit: bal.debit,
    credit: bal.credit,
    debt,
    applyInterest: body.applyInterest === true,
    scheduleType,
    frequency,
    instalmentAmount,
    instalments,
    promptConditions: text(body.promptConditions, 500),
    notes: text(body.notes, 4000),
  };
}

const planAuditDetails = (p: Data) => ({ "Start Date": p.startDate, Term: p.term || "—", "Debt Amount": cad(num(p.debt)), "Schedule Type": p.scheduleType, "Instalment Frequency": p.frequency, "Instalment Amount": cad(num(p.instalmentAmount)), Interest: p.applyInterest ? "Applied" : "None" });

export async function createPlan(user: SessionClaims, id: string, body: Data) {
  const c = await studentCtx(user, id, "edit");
  const input = await planInput(c, body);
  const number = await nextNumber(c.inst, "plan");
  const rec = await add(user, S.PLAN, { number, ...input }, id);
  await finAudit(user, id, "Payment plan created", `Payment Plan #${number}`, planAuditDetails(input), rec.id);
  return { id: rec.id, number, message: "Payment plan created successfully" };
}

async function studentPlan(c: StudentCtx, planId: string) {
  const rec = await row(c.inst, S.PLAN, planId, "Payment plan");
  if (rec.contextKey !== c.st.id || rec.data.deleted) throw httpError(404, "Payment plan not found", "NOT_FOUND");
  return rec;
}

export async function updatePlan(user: SessionClaims, id: string, planId: string, body: Data) {
  const c = await studentCtx(user, id, "edit");
  const rec = await studentPlan(c, planId);
  const input = await planInput(c, body);
  await save(user, rec.id, { ...rec.data, ...input });
  await finAudit(user, id, "Payment plan updated", `Payment Plan #${num(rec.data.number)}`, planAuditDetails(input), rec.id);
  return { message: "Payment plan updated successfully" };
}

export async function deletePlan(user: SessionClaims, id: string, planId: string) {
  const c = await studentCtx(user, id, "edit");
  const rec = await studentPlan(c, planId);
  await drop(user, [rec.id]);
  await finAudit(user, id, "Payment plan deleted", `Payment Plan #${num(rec.data.number)}`, planAuditDetails(rec.data), rec.id);
  return { message: "Payment plan deleted successfully" };
}

/* ------------------------------------------------------------------ */
/* Documents & Tax Forms / Finance audit                                */
/* ------------------------------------------------------------------ */

export async function taxDocuments(user: SessionClaims, id: string) {
  await studentCtx(user, id, "view");
  return { items: TAX_DOCUMENTS };
}

export async function financeAudit(user: SessionClaims, id: string, q: Data) {
  await studentCtx(user, id, "view");
  return auditTrail(user, id, q, true);
}
