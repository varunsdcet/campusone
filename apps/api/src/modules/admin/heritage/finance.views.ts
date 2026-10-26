/* Financial Management read models: dropdown meta, directories (F01–F11) and the student Finance tabs. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { assertPermission } from "../superAdmin.service.js";
import { refs } from "./service.js";
import { ADVANCE_CREDIT, PLAN_FREQUENCIES } from "./finance.spec.js";
import {
  EPS,
  S,
  agentLabel,
  arr,
  canFinance,
  day,
  loadBooks,
  loadConfig,
  nameOf,
  num,
  page,
  r2,
  rows,
  s,
  studentMatches,
  studentsInfo,
  termOptions,
  today,
  type Book,
  type Charge,
  type Config,
  type Data,
  type Fund,
  type StudentInfo,
} from "./finance.core.js";
import { CREDIT_STATUSES, PAYEES, PAYMENT_STATUSES, PAYMENT_TYPES, studentCtx } from "./finance.ledger.js";
import {
  ADJUSTMENT_DIRECTIONS,
  AWARD_STATUSES,
  PLAN_STATUSES,
  SCHEDULE_TYPES,
  SYNC_OPTIONS,
  academicsOf,
  awardView,
  commissionFor,
  eligiblePromotions,
  fundView,
  planView,
  studentAgentId,
  syncAlerts,
} from "./finance.records.js";
import { DOCUMENTS, INVOICE_TEMPLATES, INVOICE_TYPES, ITEM_TYPES, SEND_OPTIONS, listInvoiceRows } from "./finance.invoices.js";

type Q = Record<string, unknown>;
const q = (v: unknown) => s(Array.isArray(v) ? v[0] : v).trim();
const has = (v: string, all: RegExp = /^All /) => Boolean(v) && !all.test(v);
const ci = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());

async function can(user: SessionClaims, mod: "financialManagement" | "agentManagement", level: "view" | "edit") {
  try {
    await assertPermission(user, mod, level);
    return true;
  } catch {
    return false;
  }
}

async function base(user: SessionClaims) {
  await canFinance(user, "view");
  const inst = user.institutionId;
  const cfg = await loadConfig(inst);
  const [students, books] = await Promise.all([studentsInfo(inst), loadBooks(inst, cfg)]);
  return { inst, cfg, students, books };
}

const who = (st: StudentInfo | undefined) => (st ? { id: st.id, name: st.name, number: st.number, campus: st.campus, program: st.program } : null);
const campusOk = (st: StudentInfo | undefined, campus: string) => !has(campus) || st?.campus === campus;

export async function financeMeta(user: SessionClaims) {
  await canFinance(user, "view");
  const inst = user.institutionId;
  const [cfg, r, terms, canEdit, agents] = await Promise.all([loadConfig(inst), refs(user), termOptions(inst), can(user, "financialManagement", "edit"), can(user, "agentManagement", "view")]);
  const list = (recs: Config["paymentMethods"]) => recs.map((x) => ({ id: x.id, name: nameOf(x) })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    campuses: r.campuses ?? [],
    programs: r.programs ?? [],
    statuses: r.statuses ?? [],
    terms,
    ledgerTypes: cfg.ledgerTypes
      .map((t) => ({ id: t.id, name: nameOf(t), trigger: s(t.data.trigger), domestic: num(t.data.domestic), international: num(t.data.international), overridable: s(t.data.overridable) !== "No" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    paymentMethods: cfg.paymentMethods.map((m) => ({ id: m.id, name: nameOf(m), creditCard: Boolean(m.data.creditCard) })).sort((a, b) => a.name.localeCompare(b.name)),
    disbursementTypes: list(cfg.disbursementTypes),
    promotionAllocations: list(cfg.promotionAllocations.filter((a) => a.data.status !== "Inactive")),
    promotions: cfg.promotions.map((p) => ({ id: p.id, name: nameOf(p), type: s(p.data.type), status: s(p.data.status) })),
    fundingSources: cfg.fundingSources.filter((f) => f.data.status !== "Inactive").map((f) => ({ id: f.id, name: nameOf(f) })),
    agents: cfg.agents.map((a) => ({ id: a.id, label: agentLabel(a), number: s(a.data.agentNumber), last: s(a.data.lastName) })),
    collectionAgencies: cfg.collectionAgencies.map((a) => ({ id: a.id, name: nameOf(a), isDefault: a.data.defaultAgency === "Enabled" })),
    planTemplates: cfg.planTemplates
      .filter((t) => t.data.status !== "Inactive")
      .map((t) => ({ id: t.id, name: nameOf(t), scheduleType: s(t.data.scheduleType), frequency: s(t.data.frequency), totalInstalments: num(t.data.totalInstalments), balanceSync: s(t.data.balanceSync), fixedAmount: num(t.data.fixedAmount), planFee: s(t.data.planFee), offsetCredit: Boolean(t.data.offsetCredit), prompts: Boolean(t.data.prompts) })),
    frequencies: PLAN_FREQUENCIES,
    documents: DOCUMENTS(),
    constants: {
      paymentTypes: PAYMENT_TYPES,
      payees: PAYEES,
      paymentStatuses: PAYMENT_STATUSES,
      creditStatuses: CREDIT_STATUSES,
      awardStatuses: AWARD_STATUSES,
      syncOptions: SYNC_OPTIONS,
      scheduleTypes: SCHEDULE_TYPES,
      planStatuses: PLAN_STATUSES,
      invoiceTypes: INVOICE_TYPES,
      invoiceTemplates: INVOICE_TEMPLATES,
      sendOptions: SEND_OPTIONS,
      itemTypes: ITEM_TYPES,
      adjustmentDirections: ADJUSTMENT_DIRECTIONS,
    },
    perms: { edit: canEdit, agents },
  };
}

export async function searchStudents(user: SessionClaims, query: Q) {
  await canFinance(user, "view");
  const term = q(query.q);
  const students = await studentsInfo(user.institutionId);
  const out = [...students.values()].filter((st) => term && studentMatches(st, term)).sort((a, b) => a.last.localeCompare(b.last)).slice(0, 20);
  return { items: out.map((st) => ({ id: st.id, name: st.name, number: st.number, campus: st.campus, program: st.program })) };
}

/* ------------------------------------------------------------------ */
/* Row mappers                                                          */
/* ------------------------------------------------------------------ */

const ENTRY_KIND: Record<string, string> = { payment: "Payment", refund: "Refund", credit: "Credit" };

function txRow(e: Fund | Book["refunds"][number], book: Book) {
  const fund = e as Fund;
  const isFund = e.kind === "payment" || e.kind === "credit";
  const refund = e.kind === "refund" ? (e as Book["refunds"][number]) : null;
  const type = e.kind === "payment" ? `${s(e.meta.paymentType) || "Standard"} Payment` : e.kind === "refund" ? `Refund (${refund?.refundType || "Cash Back"})` : `Credit: ${fund.typeName}`;
  return {
    id: e.id,
    number: e.number,
    studentId: e.studentId,
    kind: e.kind,
    kindLabel: ENTRY_KIND[e.kind] ?? e.kind,
    paymentType: s(e.meta.paymentType),
    type,
    fundSource: e.kind === "credit" ? fund.typeName : s(e.meta.method) || e.source || "—",
    entryDate: day(e.postedAt),
    recordedDate: day(e.createdAt),
    status: isFund ? fund.statusLabel : refund?.refundType === "Apply Credit" ? "Credited" : "Refunded",
    amount: e.kind === "refund" ? -e.amount : e.amount,
    available: isFund ? fund.available : 0,
    refundable: e.kind === "payment" ? r2(e.amount - fund.refunded) : 0,
    note: e.note,
    payee: s(e.meta.payee),
    refundOf: refund ? book.payments.find((p) => p.id === refund.refundOf)?.number ?? null : null,
    hidden: isFund ? fund.hidden : false,
    managed: e.managed,
  };
}

function feeRow(c: Charge) {
  return {
    id: c.id,
    number: c.number,
    studentId: c.studentId,
    ledgerTypeId: c.ledgerTypeId,
    type: c.ledgerTypeName,
    status: c.statusLabel,
    entryDate: day(c.createdAt),
    postedDate: day(c.postedAt),
    dueDate: day(c.dueAt),
    amount: c.total,
    paid: c.paid,
    owing: c.owing,
    quantity: num(c.meta.quantity) || 1,
    unitAmount: num(c.meta.unitAmount) || c.total,
    taxes: arr<Data>(c.meta.taxes),
    termId: c.termId ?? "",
    termName: c.termName,
    note: c.note,
    tuition: c.tuition,
    canRemove: !c.hidden && c.statusLabel !== "Refunded" && c.paid < EPS,
    canRefund: !c.hidden && c.statusLabel !== "Refunded" && c.paid > EPS,
  };
}

function creditRow(f: Fund) {
  return {
    id: f.id,
    number: f.number,
    studentId: f.studentId,
    type: f.typeName,
    typeId: s(f.meta.typeId),
    status: f.statusLabel,
    recordDate: day(f.createdAt),
    total: f.amount,
    balance: f.active ? f.available : 0,
    allocated: f.active ? r2(f.amount - f.available - f.refunded) : 0,
    note: f.note,
    advance: f.typeName === ADVANCE_CREDIT,
    award: Boolean(f.meta.awardId),
    fromFund: Boolean(f.meta.fundId),
    managed: f.managed,
  };
}

/* ------------------------------------------------------------------ */
/* Directories                                                          */
/* ------------------------------------------------------------------ */

function inRange(date: string, query: Q) {
  const preset = q(query.range);
  const t = today();
  const back = (days: number) => day(new Date(Date.now() - days * 86_400_000));
  let from = q(query.from);
  let to = q(query.to);
  if (preset === "Today") from = to = t;
  else if (preset === "Last 7 Days") (from = back(6)), (to = t);
  else if (preset === "Last 30 Days") (from = back(29)), (to = t);
  else if (preset === "This Month") (from = `${t.slice(0, 7)}-01`), (to = t);
  else if (preset === "This Year") (from = `${t.slice(0, 4)}-01-01`), (to = t);
  else if (preset !== "Custom Range") from = to = "";
  return (!from || date >= from) && (!to || date <= to);
}

const TX_TYPES: Record<string, (r: ReturnType<typeof txRow>) => boolean> = {
  "All Payments": (r) => r.kind === "payment",
  "Standard payments": (r) => r.kind === "payment" && (r.paymentType || "Standard") === "Standard",
  "Deposit payments": (r) => r.kind === "payment" && r.paymentType === "Deposit",
  "Correction payments": (r) => r.kind === "payment" && r.paymentType === "Correction",
  "All Refunds/Reimbursements": (r) => r.kind === "refund" || r.kind === "credit",
  Credits: (r) => r.kind === "credit",
  Refunds: (r) => r.kind === "refund",
};

export async function listTransactions(user: SessionClaims, query: Q) {
  const { students, books } = await base(user);
  const type = q(query.type);
  const number = q(query.number).replace(/^#/, "");
  const recorded = q(query.dateField) === "Recorded Date";
  const out = [];
  for (const b of books.values()) {
    const st = students.get(b.studentId);
    if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) continue;
    for (const e of [...b.payments, ...b.credits, ...b.refunds]) {
      const r = txRow(e, b);
      if (r.hidden) continue;
      if (has(type) && TX_TYPES[type] && !TX_TYPES[type](r)) continue;
      if (number && String(r.number) !== number) continue;
      if (!inRange(recorded ? r.recordedDate : r.entryDate, query)) continue;
      out.push({ ...r, student: who(st) });
    }
  }
  out.sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.number - a.number);
  return page(out, query);
}

const FEE_STATUS: Record<string, (s: string) => boolean> = { Paid: (x) => x === "Paid", Owing: (x) => ["Not Paid", "Partially Paid", "Pending"].includes(x), Returned: (x) => x === "Refunded" };

export async function listFees(user: SessionClaims, query: Q) {
  const { students, books } = await base(user);
  const type = q(query.ledgerType);
  const status = q(query.status);
  const number = q(query.number).replace(/^#/, "");
  const out = [];
  for (const b of books.values()) {
    const st = students.get(b.studentId);
    if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) continue;
    for (const c of b.charges) {
      if (c.hidden) continue;
      if (has(type) && c.ledgerTypeId !== type && c.ledgerTypeName !== type) continue;
      if (has(status) && FEE_STATUS[status] && !FEE_STATUS[status](c.statusLabel)) continue;
      if (number && String(c.number) !== number) continue;
      out.push({ ...feeRow(c), student: who(st) });
    }
  }
  out.sort((a, b) => b.postedDate.localeCompare(a.postedDate) || b.number - a.number);
  return page(out, query);
}

export async function listInvoices(user: SessionClaims, query: Q) {
  const { cfg, students } = await base(user);
  const type = q(query.type);
  const number = q(query.number).replace(/^#/, "");
  const all = await listInvoiceRows(user, cfg);
  const out = all.filter((v) => {
    const st = students.get(v.studentId);
    if (has(q(query.campus)) && st?.campus !== q(query.campus)) return false;
    if (q(query.student) && !studentMatches(st, q(query.student))) return false;
    if (has(type) && v.type !== type) return false;
    return !number || String(v.number) === number;
  });
  out.sort((a, b) => b.number - a.number);
  return page(out, query);
}

export async function listDisbursements(user: SessionClaims, query: Q) {
  const { students, books } = await base(user);
  const type = q(query.type);
  const status = q(query.status);
  const allocation = q(query.allocation);
  const out = [];
  for (const b of books.values()) {
    const st = students.get(b.studentId);
    if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) continue;
    for (const f of b.credits) {
      if (f.hidden) continue;
      const r = creditRow(f);
      if (has(type) && r.type !== type) continue;
      if (has(status) && r.status !== status) continue;
      if (allocation === "Unallocated" && r.balance < EPS) continue;
      if (allocation === "Allocated" && r.allocated < EPS) continue;
      out.push({ ...r, student: who(st) });
    }
  }
  out.sort((a, b) => b.recordDate.localeCompare(a.recordDate) || b.number - a.number);
  return page(out, query);
}

export async function listAwards(user: SessionClaims, query: Q) {
  const { inst, students, books } = await base(user);
  const status = q(query.status);
  const out = (await rows(inst, S.AWARD))
    .map((r) => ({ ...awardView(r, books.get(r.contextKey)), student: who(students.get(r.contextKey)) }))
    .filter((v) => {
      const st = students.get(v.studentId);
      if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) return false;
      if (has(q(query.program)) && st?.program !== q(query.program)) return false;
      if (has(q(query.studentStatus)) && st?.status !== q(query.studentStatus)) return false;
      return !has(status) || v.status === status;
    });
  out.sort((a, b) => b.number - a.number);
  return page(out, query);
}

export async function listAdjustments(user: SessionClaims, query: Q) {
  const { inst, students } = await base(user);
  const status = q(query.status);
  const out = (await rows(inst, S.ADJUSTMENT))
    .map((r) => ({
      id: r.id,
      number: num(r.data.number),
      studentId: r.contextKey,
      student: who(students.get(r.contextKey)),
      direction: s(r.data.direction),
      amount: num(r.data.amount),
      reason: s(r.data.reason),
      status: s(r.data.status),
      requestedAt: day(s(r.data.requestedAt)),
      reviewedAt: day(s(r.data.reviewedAt)),
      reviewNote: s(r.data.reviewNote),
    }))
    .filter((v) => {
      const st = students.get(v.studentId);
      if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) return false;
      return !status || /^ALL /i.test(status) || v.status === status;
    });
  out.sort((a, b) => b.number - a.number);
  return page(out, query);
}

export async function listCommissions(user: SessionClaims, query: Q) {
  const { inst, cfg, students, books } = await base(user);
  const [links, comm] = await Promise.all([rows(inst, S.STUDENT_AGENT), rows(inst, S.COMMISSION)]);
  const agentQ = q(query.agent).toLowerCase();
  const agentMatch = (a: (typeof cfg.agents)[number] | undefined) => !agentQ || (a ? s(a.data.agentNumber).toLowerCase().includes(agentQ) || s(a.data.lastName).toLowerCase().startsWith(agentQ) : false);
  const out: Array<Data & { student: ReturnType<typeof who>; agent: string; agentId: string; kind: string; status: string }> = [];
  for (const l of links) {
    const agent = cfg.byId.get(s(l.data.agentId));
    if (!agent) continue;
    const { expected, earned } = commissionFor(agent, books.get(l.contextKey));
    const paid = r2(comm.filter((c) => c.data.kind === "payout" && c.contextKey === l.contextKey && c.data.agentId === agent.id).reduce((a, c) => a + num(c.data.amount), 0));
    out.push({ id: `c:${l.contextKey}`, studentId: l.contextKey, student: who(students.get(l.contextKey)), agentId: agent.id, agent: agentLabel(agent), kind: "Commission", expected, earned, paid, owing: r2(Math.max(0, earned - paid)), status: earned > EPS && paid >= earned - EPS ? "Paid" : "Owing", note: `${s(agent.data.commissionType) === "Fixed" ? "Fixed" : `${num(agent.data.commissionRate)}%`} of ${s(agent.data.commissionBasis) || "tuition paid"}` });
  }
  for (const b of comm.filter((c) => c.data.kind === "bonus")) {
    const agent = cfg.byId.get(s(b.data.agentId));
    out.push({ id: b.id, number: num(b.data.number), studentId: b.contextKey, student: who(students.get(b.contextKey)), agentId: s(b.data.agentId), agent: agentLabel(agent) || "(removed agent)", kind: "Bonus", expected: num(b.data.amount), earned: num(b.data.amount), paid: b.data.paid ? num(b.data.amount) : 0, owing: b.data.paid ? 0 : num(b.data.amount), status: b.data.paid ? "Paid" : "Owing", note: s(b.data.note) });
  }
  const revenue = q(query.revenueType);
  const pay = q(query.paymentStatus);
  const filtered = out.filter((r) => {
    const st = students.get(s(r.studentId));
    if (has(q(query.campus)) && st?.campus !== q(query.campus)) return false;
    if (q(query.student) && !studentMatches(st, q(query.student))) return false;
    if (!agentMatch(cfg.byId.get(r.agentId))) return false;
    if (revenue === "Commissions" && r.kind !== "Commission") return false;
    if (revenue === "Bonuses" && r.kind !== "Bonus") return false;
    return !has(pay) || r.status === pay;
  });
  return page(filtered, query);
}

export async function listPlans(user: SessionClaims, query: Q) {
  const { inst, students, books } = await base(user);
  const status = q(query.status);
  const wanted = status === "Pending First Payment" ? "Pending First Instalment" : status;
  const number = q(query.number).replace(/^#/, "");
  const terms = new Map((await termOptions(inst)).map((t) => [t.id, t.name]));
  const out = (await rows(inst, S.PLAN))
    .map((r) => {
      const b = books.get(r.contextKey) ?? { studentId: r.contextKey, entries: [], charges: [], payments: [], credits: [], refunds: [], allocs: [], balance: 0, available: 0 };
      const v = planView(r, b);
      return { ...v, termName: terms.get(v.termId) ?? "", student: who(students.get(r.contextKey)) };
    })
    .filter((v) => {
      const st = students.get(v.studentId);
      if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) return false;
      if (has(q(query.program)) && st?.program !== q(query.program)) return false;
      if (has(q(query.term)) && v.termId !== q(query.term) && v.termName !== q(query.term)) return false;
      if (number && String(v.number) !== number) return false;
      return !has(wanted) || v.status === wanted;
    });
  out.sort((a, b) => b.number - a.number);
  return page(out, query);
}

export async function listFunds(user: SessionClaims, query: Q) {
  const { inst, students } = await base(user);
  const status = q(query.status);
  const number = q(query.number).replace(/^#/, "");
  const kw = q(query.keyword);
  const out = (await rows(inst, S.FUND))
    .map((r) => fundView(r, students))
    .filter((v) => {
      if (has(q(query.campus)) && v.allocations.length && !v.allocations.some((a) => students.get(a.studentId)?.campus === q(query.campus))) return false;
      if (number && String(v.number) !== number) return false;
      if (has(status) && v.status !== status) return false;
      return !kw || [String(v.amount), v.amount.toFixed(2), v.receipt, v.note, v.method].some((x) => ci(x, kw));
    });
  out.sort((a, b) => b.number - a.number);
  return page(out, query);
}

export async function listAlerts(user: SessionClaims, query: Q) {
  const { inst, students, books } = await base(user);
  await syncAlerts(user, books, await rows(inst, S.PLAN));
  const status = q(query.status) || "Active";
  const resolved = q(query.resolved) || "No";
  const out = (await rows(inst, S.ALERT))
    .map((r) => ({ id: r.id, studentId: r.contextKey, student: who(students.get(r.contextKey)), kind: s(r.data.kind), message: s(r.data.message), status: s(r.data.status), resolved: s(r.data.resolved), raisedAt: day(s(r.data.raisedAt)), resolvedAt: day(s(r.data.resolvedAt)) }))
    .filter((v) => {
      const st = students.get(v.studentId);
      if (!campusOk(st, q(query.campus)) || !studentMatches(st, q(query.student))) return false;
      return (!has(status) || v.status === status) && (!has(resolved) || v.resolved === resolved);
    });
  out.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
  return page(out, query);
}

/* ------------------------------------------------------------------ */
/* Student Finance                                                      */
/* ------------------------------------------------------------------ */

export async function studentHeader(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "view");
  const facts = await academicsOf(c.inst, studentId);
  const st = c.st;
  return {
    id: st.id,
    name: st.name,
    preferred: st.preferred,
    initials: `${st.first.charAt(0)}${st.last.charAt(0)}`.toUpperCase(),
    applicationNumber: st.number,
    status: st.status,
    campus: st.campus,
    program: st.program,
    cgpa: facts.cgpa,
    email: st.email,
    rateCategory: st.rateCategory,
  };
}

export async function studentOverview(user: SessionClaims, studentId: string, query: Q) {
  const c = await studentCtx(user, studentId, "view");
  const { book, cfg } = c;
  const live = book.charges.filter((x) => !x.hidden && x.statusLabel !== "Refunded");
  const sum = (list: Charge[], k: "owing" | "paid" | "total") => r2(list.reduce((a, x) => a + x[k], 0));
  const tuition = live.filter((x) => x.tuition);
  const fees = live.filter((x) => !x.tuition);
  const activeCredits = book.credits.filter((f) => f.active);
  const awards = (await rows(c.inst, S.AWARD, studentId)).map((r) => awardView(r, book));
  const agentId = await studentAgentId(c.inst, studentId);
  const agent = cfg.byId.get(agentId);
  const commission = commissionFor(agent, book);
  const type = q(query.ledgerType);
  const term = q(query.term);
  const nonAward = activeCredits.filter((f) => !f.meta.awardId);
  return {
    summary: {
      tuitionOwing: sum(tuition, "owing"),
      tuitionPaid: sum(tuition, "paid"),
      tuitionTotal: sum(tuition, "total"),
      feesOwing: sum(fees, "owing"),
      feesPaid: sum(fees, "paid"),
      feesTotal: sum(fees, "total"),
      totalPayments: r2(book.payments.filter((p) => !p.hidden).reduce((a, p) => a + p.amount, 0)),
      totalCredit: r2(activeCredits.reduce((a, f) => a + f.amount, 0)),
      totalRefunds: r2(book.refunds.reduce((a, r) => a + r.amount, 0)),
      balance: book.balance,
      available: book.available,
    },
    cards: {
      funds: { allocated: r2(nonAward.reduce((a, f) => a + (f.amount - f.available - f.refunded), 0)), remaining: r2(nonAward.reduce((a, f) => a + f.available, 0)) },
      awards: { allocated: r2(awards.filter((a) => a.status === "Active").reduce((t, a) => t + a.allocated, 0)), remaining: r2(awards.filter((a) => a.status === "Active").reduce((t, a) => t + a.remaining, 0)) },
      commission: { earned: commission.earned, expected: commission.expected, agent: agentLabel(agent) },
    },
    fees: live
      .concat(book.charges.filter((x) => x.statusLabel === "Refunded"))
      .filter((x) => (!has(type) || x.ledgerTypeId === type) && (!has(term) || x.termId === term))
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime() || b.number - a.number)
      .map(feeRow),
  };
}

export async function studentTransactions(user: SessionClaims, studentId: string, query: Q) {
  const c = await studentCtx(user, studentId, "view");
  const term = q(query.q).toLowerCase();
  const showAlloc = q(query.showAlloc) === "true";
  const receipts = new Set((await rows(c.inst, S.RECEIPT, studentId)).map((r) => r.singletonKey));
  const list = [...c.book.payments, ...c.book.credits, ...c.book.refunds]
    .map((e) => txRow(e, c.book))
    .filter((r) => !r.hidden && (showAlloc || r.kind !== "credit" || r.fundSource === ADVANCE_CREDIT))
    .map((r) => ({ ...r, hasReceipt: receipts.has(r.id) }))
    .filter((r) => !term || [String(r.number), r.entryDate, r.recordedDate, r.status, r.type, r.fundSource].some((x) => x.toLowerCase().includes(term)));
  list.sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.number - a.number);
  const allocations = showAlloc
    ? c.book.allocs.map((a) => ({
        id: a.id,
        at: day(a.at),
        amount: a.amount,
        fund: [...c.book.payments, ...c.book.credits].find((f) => f.id === a.fundId)?.number ?? null,
        fee: c.book.charges.find((x) => x.id === a.chargeId)?.number ?? null,
        feeType: c.book.charges.find((x) => x.id === a.chargeId)?.ledgerTypeName ?? "",
      }))
    : [];
  return { items: list, allocations, refundable: c.book.payments.filter((p) => !p.hidden && p.amount - p.refunded > EPS).map((p) => ({ id: p.id, number: p.number, refundable: r2(p.amount - p.refunded), label: `#${p.number} ${s(p.meta.method) || p.source} ${day(p.postedAt)}` })) };
}

export async function studentInvoices(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "view");
  const items = await listInvoiceRows(user, c.cfg, studentId);
  return { items: items.sort((a, b) => b.number - a.number) };
}

export async function studentDisbursements(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "view");
  return { items: c.book.credits.filter((f) => !f.hidden).map(creditRow).sort((a, b) => b.number - a.number), available: c.book.available };
}

export async function studentAwards(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "view");
  const items = (await rows(c.inst, S.AWARD, studentId)).map((r) => awardView(r, c.book)).sort((a, b) => b.number - a.number);
  return { items, eligible: await eligiblePromotions(c) };
}

export async function studentPlans(user: SessionClaims, studentId: string, query: Q) {
  const c = await studentCtx(user, studentId, "view");
  const terms = new Map((await termOptions(c.inst)).map((t) => [t.id, t.name]));
  const term = q(query.term);
  const needle = q(query.q).toLowerCase();
  const items = (await rows(c.inst, S.PLAN, studentId))
    .map((r) => ({ ...planView(r, c.book), termName: terms.get(s(r.data.termId)) ?? "" }))
    .filter((v) => (!has(term) || v.termId === term) && (!needle || [String(v.number), v.startDate, v.status, v.termName, v.next?.date ?? ""].some((x) => x.toLowerCase().includes(needle))))
    .sort((a, b) => b.number - a.number);
  const debit = r2(c.book.charges.reduce((a, x) => a + x.owing, 0));
  const collections = (await rows(c.inst, S.COLLECTION, studentId)).map((r) => ({ id: r.id, agency: s(r.data.agency), amount: num(r.data.amount), commission: num(r.data.commission), status: s(r.data.status), sentAt: s(r.data.sentAt), recalledAt: s(r.data.recalledAt), note: s(r.data.note) }));
  return { items, balances: { debit, credit: c.book.available, balance: c.book.balance }, termBalances: Object.fromEntries([...terms.keys()].map((id) => [id, r2(c.book.charges.filter((x) => x.termId === id).reduce((a, x) => a + x.owing, 0))])), collections };
}

export async function studentAudit(user: SessionClaims, studentId: string, query: Q) {
  await studentCtx(user, studentId, "view");
  const action = q(query.action);
  const from = q(query.from);
  const to = q(query.to);
  const list = await prisma.heritageAuditEntry.findMany({ where: { institutionId: user.institutionId, screenId: S.STUDENT_AUDIT, contextKey: studentId }, orderBy: { createdAt: "desc" }, take: 1000 });
  const items = list
    .map((a) => {
      let after: Data = {};
      try {
        after = a.afterJson ? (JSON.parse(a.afterJson) as Data) : {};
      } catch {
        after = {};
      }
      return { id: a.id, at: a.createdAt.toISOString(), by: a.actorName || "System", action: a.action, record: s(after.record), recordId: a.recordId ?? "", details: Object.fromEntries(Object.entries(after).filter(([k]) => k !== "record")) };
    })
    .filter((a) => (!has(action) || a.action === action) && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to));
  return { items, actions: [...new Set(list.map((a) => a.action))].sort() };
}
