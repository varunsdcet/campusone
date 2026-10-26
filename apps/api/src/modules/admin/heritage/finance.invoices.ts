/* Financial Management invoices (student, agent, funding source) and generated documents (T2202 slips, financial statements). */

import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { buildDocumentPdf, type DocLine } from "../../../lib/taxPdf.js";
import { mailConfigured, sendMailViaHumanitix } from "../../../lib/mailer.js";
import { type Rec } from "./sysconfig.js";
import { audit } from "./service.js";
import {
  EPS,
  S,
  add,
  agentLabel,
  amountOf,
  arr,
  assertPeriodOpen,
  cad,
  canFinance,
  dateAt,
  day,
  drop,
  finAudit,
  httpError,
  loadBook,
  loadBooks,
  loadConfig,
  nameOf,
  nextNumber,
  num,
  r2,
  row,
  rows,
  s,
  save,
  studentsInfo,
  termId,
  text,
  today,
  type Book,
  type Config,
  type Data,
  type Row,
  type StudentInfo,
} from "./finance.core.js";
import { defaultFee, institutionName, postFee, studentCtx, type StudentCtx } from "./finance.ledger.js";
import { studentAgentId } from "./finance.records.js";
import { withStudentMoneyLock } from "./studentLock.js";

export const INVOICE_TYPES = ["Student", "Agent", "Funding Source"] as const;
export const INVOICE_TEMPLATES = ["Invoice Template", "Invoice Template - New"] as const;
export const SEND_OPTIONS = ["Do not send", "Send to student", "Send to student and agent", "Send to agent", "Send to funding source"] as const;
export const ITEM_TYPES = ["Course", "Textbook", "Other Fee / Ledger Item", "Credit / Disbursement"] as const;

type Item = { id: string; kind: string; refId: string; ledgerTypeId: string; quantity: number; description: string; fee: number; total: number };

const byTrigger = (cfg: Config, trigger: string) => cfg.ledgerTypes.find((t) => t.data.trigger === trigger);
/** Course fee dependencies: material types without a fee trigger (e.g. "Lab, Books, Supplies, etc."). */
const dependencyTypes = (cfg: Config) => {
  const materials = new Set(cfg.ledgerCategories.filter((c) => /material/i.test(nameOf(c))).map((c) => c.id));
  return cfg.ledgerTypes.filter((t) => t.data.trigger === "None" && arr<string>(t.data.categories).some((c) => materials.has(c)) && !/ship/i.test(nameOf(t)));
};

export async function courseOptions(user: SessionClaims) {
  await canFinance(user, "view");
  const courses = await prisma.course.findMany({ where: { institutionId: user.institutionId }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } });
  return courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` }));
}

/** Lines a Course item expands to: course tuition, optionally textbooks and fee dependencies (priced by the student's rate category). */
export async function courseItems(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "view");
  const ids = arr<string>(body.courseIds);
  if (!ids.length) throw httpError(400, "Select at least one course");
  const courses = await prisma.course.findMany({ where: { institutionId: c.inst, id: { in: ids } } });
  const tuition = byTrigger(c.cfg, "Course Tuition");
  const books = byTrigger(c.cfg, "Textbooks");
  const deps = dependencyTypes(c.cfg);
  const out: Item[] = [];
  const line = (kind: string, type: Rec | undefined, description: string) => {
    const fee = defaultFee(type, c.st);
    out.push({ id: randomUUID(), kind, refId: "", ledgerTypeId: type?.id ?? "", quantity: 1, description, fee, total: fee });
  };
  for (const course of courses) {
    line("course", tuition, `${course.code} — ${course.title}${tuition ? ` (${nameOf(tuition)})` : ""}`);
    if (body.textbooks && books) line("textbook", books, `${nameOf(books)}: ${course.code}`);
    if (body.dependencies) for (const d of deps) line("dependency", d, `${nameOf(d)}: ${course.code}`);
  }
  return { items: out };
}

/** Unpaid fees of a student for the invoice's term (fees without a term are always listed). */
export async function unpaidFees(user: SessionClaims, studentId: string, term: string) {
  const c = await studentCtx(user, studentId, "view");
  const tid = await termId(c.inst, term);
  return {
    items: c.book.charges
      .filter((ch) => !ch.hidden && ch.owing > EPS && (!tid || !ch.termId || ch.termId === tid))
      .map((ch) => ({ id: ch.id, number: ch.number, type: ch.ledgerTypeName, entryDate: day(ch.createdAt), amount: ch.total, owing: ch.owing, quantity: num(ch.meta.quantity) || 1, unit: num(ch.meta.unitAmount) || ch.total })),
    credits: c.book.credits.filter((f) => f.active && !f.hidden).map((f) => ({ id: f.id, number: f.number, type: f.typeName, amount: f.amount })),
  };
}

export function invoiceView(r: Row, ctx: { book?: Book; students: Map<string, StudentInfo>; cfg: Config }) {
  const d = r.data;
  const items = arr<Item>(d.items);
  const book = ctx.book;
  let payments = 0;
  const lines = items.map((i) => {
    const ch = book?.charges.find((x) => x.id === i.refId);
    const cr = book?.credits.find((x) => x.id === i.refId);
    if (ch) {
      const fromPayments = book!.allocs.filter((a) => a.chargeId === ch.id && book!.payments.some((p) => p.id === a.fundId)).reduce((t, a) => t + a.amount, 0);
      payments += ch.statusLabel === "Paid" && !book!.allocs.some((a) => a.chargeId === ch.id) ? ch.paid : fromPayments;
      return { ...i, total: ch.hidden ? 0 : ch.total, status: ch.statusLabel, number: ch.number };
    }
    if (cr) return { ...i, total: -Math.abs(cr.amount), status: cr.statusLabel, number: cr.number };
    return { ...i, status: "", number: 0 };
  });
  const subtotal = r2(lines.reduce((t, i) => t + i.total, 0));
  const creditNotes = arr<Data>(d.creditNotes);
  const adjustments = r2(creditNotes.reduce((t, n) => t + num(n.amount), 0));
  payments = r2(payments);
  const total = r2(subtotal - payments - adjustments);
  const st = ctx.students.get(s(d.studentId));
  const t = today();
  let status = "Created";
  let statusDate = day(r.createdAt);
  if (subtotal > EPS && total < EPS) status = "Paid";
  else if (payments > EPS) status = "Partially Paid";
  else if (s(d.dueDate) && s(d.dueDate) < t) status = "Overdue";
  else if (s(d.sentAt)) status = "Sent";
  if (status === "Sent") statusDate = s(d.sentAt);
  else if (status !== "Created") statusDate = day(r.updatedAt);
  return {
    id: r.id,
    number: num(d.number),
    type: s(d.type) || "Student",
    studentId: s(d.studentId),
    student: st ? { id: st.id, name: st.name, number: st.number, campus: st.campus, email: st.email } : null,
    agentId: s(d.agentId),
    agent: agentLabel(ctx.cfg.byId.get(s(d.agentId))),
    fundingSourceId: s(d.fundingSourceId),
    fundingSource: nameOf(ctx.cfg.byId.get(s(d.fundingSourceId))),
    dueDate: s(d.dueDate),
    termId: s(d.termId),
    template: s(d.template) || INVOICE_TEMPLATES[0],
    items: lines,
    subtotal,
    totalPayments: payments,
    adjustments,
    total,
    status,
    statusDate,
    creditNotes,
    note: s(d.note),
    sentAt: s(d.sentAt),
    sentTo: s(d.sentTo),
    documentAt: s(d.documentAt),
    createdAt: r.createdAt.toISOString(),
  };
}

function cleanItems(raw: unknown): Item[] {
  return arr<Data>(raw).map((i, k) => {
    const quantity = Number(i.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw httpError(400, `Item ${k + 1}: Quantity must be a whole number between 1 and 100`);
    const description = text(i.description, 300);
    if (!description) throw httpError(400, `Item ${k + 1}: Description is required`);
    const fee = amountOf(i.fee, `Item ${k + 1} fee`, { allowZero: true });
    return { id: s(i.id) || randomUUID(), kind: s(i.kind) || "other", refId: s(i.refId), ledgerTypeId: s(i.ledgerTypeId), quantity, description, fee, total: r2(fee * quantity) };
  });
}

/** Posts receivables for the new manual lines of a student invoice so the student ledger and the invoice agree. */
async function postLines(c: StudentCtx, items: Item[], term: string | null, number: number, dueAt: Date | null) {
  for (const i of items) {
    if (i.refId || i.kind === "credit" || i.kind === "fee") continue;
    const type = c.cfg.ledgerTypes.find((t) => t.id === i.ledgerTypeId) ?? (i.kind === "course" ? byTrigger(c.cfg, "Course Tuition") : i.kind === "textbook" ? byTrigger(c.cfg, "Textbooks") : undefined);
    if (!type) throw httpError(400, `Choose a Tuition / Ledger Type for "${i.description}"`);
    const fee = await postFee(c, { type, label: i.kind === "other" ? nameOf(type) : i.description.slice(0, 200), unit: i.fee, quantity: i.quantity, termId: term, note: `Invoice #${number}: ${i.description}`, dueAt, extra: { invoiceItem: i.id } });
    i.refId = fee.id;
    i.ledgerTypeId = type.id;
  }
}

async function invoiceInput(user: SessionClaims, cfg: Config, body: Data, prev: Data | null) {
  const type = s(body.type ?? prev?.type) || "Student";
  if (!(INVOICE_TYPES as readonly string[]).includes(type)) throw httpError(400, `Invoice type "${type}" is not valid`);
  const studentId = type === "Student" ? s(body.studentId ?? prev?.studentId) : "";
  const agentId = type === "Agent" ? s(body.agentId ?? prev?.agentId) : "";
  const fundingSourceId = type === "Funding Source" ? s(body.fundingSourceId ?? prev?.fundingSourceId) : "";
  if (type === "Student" && !studentId) throw httpError(400, "Please select a student and term to continue");
  if (type === "Agent" && !cfg.agents.some((a) => a.id === agentId)) throw httpError(400, "Agent is required");
  if (type === "Funding Source" && !cfg.fundingSources.some((f) => f.id === fundingSourceId)) throw httpError(400, "Funding Source is required");
  const term = await termId(user.institutionId, body.termId ?? prev?.termId);
  if (type === "Student" && !term) throw httpError(400, "Please select a student and term to continue");
  const dueDate = day(dateAt(body.dueDate ?? prev?.dueDate, "Due Date"));
  const template = s(body.template) || INVOICE_TEMPLATES[0];
  if (!(INVOICE_TEMPLATES as readonly string[]).includes(template)) throw httpError(400, `Invoice Template "${template}" is not valid`);
  const items = cleanItems(body.items ?? prev?.items);
  if (!items.length) throw httpError(400, "Add at least one invoice item");
  return { type, studentId, agentId, fundingSourceId, termId: term ?? "", dueDate, template, items, note: text(body.note ?? prev?.note) };
}

async function sendInvoice(user: SessionClaims, cfg: Config, view: ReturnType<typeof invoiceView>, how: string) {
  if (!how || how === "Do not send") return null;
  const to: string[] = [];
  if (how.includes("student") && view.student?.email) to.push(view.student.email);
  if (how.includes("agent")) {
    const agent = cfg.byId.get(view.agentId || (view.studentId ? await studentAgentId(user.institutionId, view.studentId) : ""));
    if (s(agent?.data.email)) to.push(s(agent!.data.email));
  }
  if (how.includes("funding")) {
    const src = cfg.byId.get(view.fundingSourceId);
    if (s(src?.data.email)) to.push(s(src!.data.email));
  }
  if (!to.length) return "No e-mail address is on file for the selected recipient(s); the invoice was saved but not sent.";
  if (!mailConfigured()) return "E-mail is not configured; the invoice was saved but not sent.";
  const school = await institutionName(user.institutionId);
  const message = [
    `Invoice #${view.number} from ${school}`,
    view.student ? `Student: ${view.student.name} (${view.student.number})` : view.agent || view.fundingSource,
    `Due date: ${view.dueDate}`,
    ...view.items.map((i) => `${i.quantity} x ${i.description}: ${cad(i.total)}`),
    `Subtotal: ${cad(view.subtotal)}`,
    `Total payments: ${cad(view.totalPayments)}`,
    `Total due: ${cad(view.total)}`,
  ].join("\n");
  try {
    for (const email of to) await sendMailViaHumanitix({ email, title: `Invoice #${view.number} — ${school}`, message });
  } catch {
    return "The invoice was saved, but the e-mail could not be delivered. Try sending it again later.";
  }
  return to;
}

async function finishInvoice(user: SessionClaims, cfg: Config, r: Row, body: Data) {
  const students = await studentsInfo(user.institutionId, s(r.data.studentId) ? [s(r.data.studentId)] : []);
  const book = s(r.data.studentId) ? await loadBook(user.institutionId, cfg, s(r.data.studentId)) : undefined;
  const view = invoiceView(r, { book, students, cfg });
  const patch: Data = {};
  if (body.generateDocument) patch.documentAt = new Date().toISOString();
  const sent = await sendInvoice(user, cfg, view, s(body.send));
  if (Array.isArray(sent)) {
    patch.sentAt = today();
    patch.sentTo = sent.join(", ");
  }
  if (Object.keys(patch).length) await save(user, r.id, { ...r.data, ...patch });
  return typeof sent === "string" ? sent : null;
}

export async function createInvoice(user: SessionClaims, body: Data) {
  const studentId = s(body.studentId);
  if (studentId) return withStudentMoneyLock(user.institutionId, studentId, () => createInvoiceLocked(user, body));
  return createInvoiceLocked(user, body);
}

async function createInvoiceLocked(user: SessionClaims, body: Data) {
  await canFinance(user, "edit");
  const cfg = await loadConfig(user.institutionId);
  const d = await invoiceInput(user, cfg, body, null);
  const number = await nextNumber(user.institutionId, "invoice");
  if (d.type === "Student") {
    const c = await studentCtx(user, d.studentId, "edit");
    await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This invoice");
    await postLines(c, d.items, d.termId || null, number, dateAt(d.dueDate, "Due Date"));
  }
  const r = await add(user, S.INVOICE, { ...d, number, creditNotes: [] }, d.studentId);
  if (d.studentId) await finAudit(user, d.studentId, "Invoice created", `Invoice #${number}`, { due: d.dueDate, items: d.items.length, total: cad(d.items.reduce((t, i) => t + i.total, 0)) }, r.id);
  const warning = await finishInvoice(user, cfg, r, body);
  return { id: r.id, number, message: warning ?? "Invoice saved successfully" };
}

export async function updateInvoice(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const cfg = await loadConfig(user.institutionId);
  const r = await row(user.institutionId, S.INVOICE, id, "Invoice");
  const d = await invoiceInput(user, cfg, { ...body, type: r.data.type, studentId: r.data.studentId, agentId: body.agentId ?? r.data.agentId, fundingSourceId: body.fundingSourceId ?? r.data.fundingSourceId }, r.data);
  if (d.type === "Student") {
    const c = await studentCtx(user, d.studentId, "edit");
    await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This invoice update");
    const prev = new Map(arr<Item>(r.data.items).map((i) => [i.id, i]));
    for (const i of d.items) {
      const old = prev.get(i.id);
      if (old?.refId) i.refId = old.refId;
    }
    await postLines(c, d.items, d.termId || null, num(r.data.number), dateAt(d.dueDate, "Due Date"));
  }
  const next = { ...r.data, ...d };
  await save(user, r.id, next);
  if (d.studentId) await finAudit(user, d.studentId, "Invoice updated", `Invoice #${num(r.data.number)}`, { due: d.dueDate, items: d.items.length }, r.id);
  const warning = await finishInvoice(user, cfg, { ...r, data: next }, body);
  return { message: warning ?? "Invoice saved successfully" };
}

export async function addCreditNote(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.INVOICE, id, "Invoice");
  const current = await getInvoice(user, id);
  const amount = amountOf(body.amount, "Credit Note Amount");
  if (amount > current.total + EPS) throw httpError(400, `Credit Note Amount cannot exceed ${cad(Math.max(0, current.total))} (the invoice balance)`);
  const note = text(body.note, 500);
  if (!note) throw httpError(400, "Credit Note is required");
  const date = day(dateAt(body.date ?? today(), "Credit Note Date"));
  const sid = s(r.data.studentId);
  if (!sid) throw httpError(409, "Credit notes require a student invoice", "CONFLICT");
  const { createAdjustment } = await import("./finance.records.js");
  const adjustment = await createAdjustment(user, {
    studentId: sid,
    direction: "Decrease balance (credit)",
    amount,
    reason: `Invoice #${num(r.data.number)} credit note: ${note}`,
    invoiceId: r.id,
    creditNoteDate: date,
    creditNoteText: note,
  });
  return {
    pendingApproval: true,
    adjustmentId: adjustment.id,
    message: `Credit note submitted as Financial Adjustment #${adjustment.number}. Another user must approve it before the invoice and ledger change.`,
  };
}

export async function deleteInvoice(user: SessionClaims, id: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.INVOICE, id, "Invoice");
  const sid = s(r.data.studentId);
  if (sid) {
    const c = await studentCtx(user, sid, "edit");
    const itemIds = new Set(arr<Item>(r.data.items).map((i) => i.id));
    const posted = c.book.charges.filter((ch) => !ch.hidden && itemIds.has(s(ch.meta.invoiceItem)));
    const paid = posted.filter((ch) => ch.paid > EPS);
    if (paid.length) {
      throw httpError(409, `Fee${paid.length === 1 ? "" : "s"} ${paid.map((ch) => `#${ch.number}`).join(", ")} on this invoice already have payments. Refund them before deleting the invoice.`, "CONFLICT");
    }
    if (posted.length) {
      throw httpError(
        409,
        `This invoice has posted receivables (${posted.map((ch) => `#${ch.number}`).join(", ")}). Request their removal and obtain second-user approval before deleting the invoice.`,
        "CONFLICT",
      );
    }
  }
  await drop(user, [r.id]);
  if (s(r.data.studentId)) await finAudit(user, s(r.data.studentId), "Invoice deleted", `Invoice #${num(r.data.number)}`, { due: s(r.data.dueDate) }, r.id);
  return { message: "Invoice deleted successfully" };
}

export async function getInvoice(user: SessionClaims, id: string) {
  await canFinance(user, "view");
  const cfg = await loadConfig(user.institutionId);
  const r = await row(user.institutionId, S.INVOICE, id, "Invoice");
  const sid = s(r.data.studentId);
  const [students, book] = await Promise.all([studentsInfo(user.institutionId, sid ? [sid] : []), sid ? loadBook(user.institutionId, cfg, sid) : Promise.resolve(undefined)]);
  return invoiceView(r, { book, students, cfg });
}

export async function listInvoiceRows(user: SessionClaims, cfg: Config, studentId?: string) {
  const list = await rows(user.institutionId, S.INVOICE, studentId);
  const ids = [...new Set(list.map((r) => s(r.data.studentId)).filter(Boolean))];
  const [students, books] = await Promise.all([studentsInfo(user.institutionId, ids), loadBooks(user.institutionId, cfg, ids)]);
  return list.map((r) => invoiceView(r, { book: books.get(s(r.data.studentId)), students, cfg }));
}

/* ------------------------------------------------------------------ */
/* PDFs                                                                 */
/* ------------------------------------------------------------------ */

const header = (school: string, title: string): DocLine[] => [{ kind: "title", text: school }, { kind: "text", text: title, size: 13, bold: true }, { kind: "rule" }];

export async function invoicePdf(user: SessionClaims, id: string) {
  const v = await getInvoice(user, id);
  const school = await institutionName(user.institutionId);
  const term = v.termId ? await prisma.financialTerm.findFirst({ where: { id: v.termId } }) : null;
  const lines: DocLine[] = [
    ...header(school, v.template === "Invoice Template - New" ? `INVOICE #${v.number}` : `Invoice #${v.number}`),
    { kind: "row", cells: [{ text: v.student ? `Bill to: ${v.student.name} (${v.student.number})` : `Bill to: ${v.agent || v.fundingSource}`, x: 0 }, { text: `Due: ${v.dueDate}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: term ? `Term: ${term.name}` : `Type: ${v.type}`, x: 0 }, { text: `Status: ${v.status}`, x: 504, right: true }] },
    { kind: "gap", h: 6 },
    { kind: "row", cells: [{ text: "Qty", x: 0, bold: true }, { text: "Description", x: 36, bold: true }, { text: "Fee", x: 420, right: true, bold: true }, { text: "Total", x: 504, right: true, bold: true }] },
    { kind: "rule" },
    ...v.items.map((i) => ({ kind: "row" as const, cells: [{ text: String(i.quantity), x: 0 }, { text: i.description.slice(0, 60), x: 36 }, { text: cad(i.fee), x: 420, right: true }, { text: cad(i.total), x: 504, right: true }] })),
    { kind: "rule" },
    { kind: "row", cells: [{ text: "Subtotal", x: 340 }, { text: cad(v.subtotal), x: 504, right: true }] },
    { kind: "row", cells: [{ text: "Total Payments", x: 340 }, { text: cad(-v.totalPayments), x: 504, right: true }] },
    ...(v.adjustments ? [{ kind: "row" as const, cells: [{ text: "Credit Notes", x: 340 }, { text: cad(-v.adjustments), x: 504, right: true }] }] : []),
    { kind: "row", cells: [{ text: "Total", x: 340, bold: true }, { text: cad(v.total), x: 504, right: true, bold: true }] },
  ];
  if (v.note) lines.push({ kind: "gap", h: 10 }, { kind: "text", text: v.note });
  return { filename: `invoice-${v.number}.pdf`, pdf: buildDocumentPdf(lines, `${school} - Invoice #${v.number}`) };
}

export const DOCUMENTS = () => {
  const y = new Date().getFullYear();
  return [
    { group: "T2202", items: [y - 2, y - 1].map((year) => ({ id: `t2202-${year}`, label: `T2202 Slip - ${year}` })) },
    { group: "FINANCIAL STATEMENTS", items: [{ id: "statement", label: "Student Financial Statement" }] },
  ];
};

/** Tuition paid in a calendar year and the part-time / full-time months the student was enrolled. */
async function t2202Facts(inst: string, book: Book, studentId: string, year: number) {
  const y = String(year);
  const tuition = book.charges.filter((c) => c.tuition && !c.hidden && day(c.postedAt).startsWith(y));
  const eligible = r2(tuition.reduce((a, c) => a + c.paid, 0));
  const enrolments = await prisma.enrolment.findMany({ where: { institutionId: inst, studentId, status: { in: ["enrolled", "completed"] } }, include: { section: { include: { term: true } } } });
  const perTerm = new Map<string, { start: string; end: string; courses: number }>();
  for (const e of enrolments) {
    const t = e.section.term;
    const cur = perTerm.get(t.id) ?? { start: t.startsOn, end: t.endsOn, courses: 0 };
    cur.courses++;
    perTerm.set(t.id, cur);
  }
  const full = new Set<number>();
  const part = new Set<number>();
  for (const t of perTerm.values()) {
    for (let m = 1; m <= 12; m++) {
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = `${y}-${String(m).padStart(2, "0")}-31`;
      if (t.start <= last && t.end >= first) (t.courses >= 3 ? full : part).add(m);
    }
  }
  for (const m of full) part.delete(m);
  return { eligible, fullMonths: full.size, partMonths: part.size };
}

function t2202Lines(school: string, st: StudentInfo, year: number, f: { eligible: number; fullMonths: number; partMonths: number }): DocLine[] {
  return [
    ...header(school, `T2202 Tuition and Enrolment Certificate - ${year}`),
    { kind: "row", cells: [{ text: `Student: ${st.name}`, x: 0, bold: true }, { text: `Student #: ${st.number}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: `Program: ${st.program || "—"}`, x: 0 }, { text: `Campus: ${st.campus || "—"}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: "Social insurance number: not on file", x: 0 }] },
    { kind: "gap", h: 8 },
    { kind: "row", cells: [{ text: "Box", x: 0, bold: true }, { text: "Description", x: 50, bold: true }, { text: "Amount / Months", x: 504, right: true, bold: true }] },
    { kind: "rule" },
    { kind: "row", cells: [{ text: "21", x: 0 }, { text: "Number of months in the program", x: 50 }, { text: String(f.fullMonths + f.partMonths), x: 504, right: true }] },
    { kind: "row", cells: [{ text: "23", x: 0 }, { text: "Session period (calendar year)", x: 50 }, { text: `${year}-01 to ${year}-12`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: "24", x: 0 }, { text: "Eligible tuition fees, part-time and full-time", x: 50 }, { text: cad(f.eligible), x: 504, right: true }] },
    { kind: "row", cells: [{ text: "25", x: 0 }, { text: "Number of months part-time", x: 50 }, { text: String(f.partMonths), x: 504, right: true }] },
    { kind: "row", cells: [{ text: "26", x: 0 }, { text: "Number of months full-time", x: 50 }, { text: String(f.fullMonths), x: 504, right: true }] },
    { kind: "rule" },
    { kind: "text", text: "Eligible tuition is the tuition paid for fees posted in the calendar year. Full-time months are months with three or more concurrent courses.", size: 8 },
    { kind: "gap", h: 24 },
  ];
}

function statementLines(school: string, st: StudentInfo, book: Book): DocLine[] {
  const lines: DocLine[] = [
    ...header(school, "Student Financial Statement"),
    { kind: "row", cells: [{ text: `Student: ${st.name} (${st.number})`, x: 0, bold: true }, { text: `Date: ${today()}`, x: 504, right: true }] },
    { kind: "row", cells: [{ text: `Program: ${st.program || "—"}`, x: 0 }, { text: `Campus: ${st.campus || "—"}`, x: 504, right: true }] },
    { kind: "gap", h: 8 },
    { kind: "row", cells: [{ text: "Date", x: 0, bold: true }, { text: "#", x: 62, bold: true }, { text: "Description", x: 100, bold: true }, { text: "Debit", x: 360, right: true, bold: true }, { text: "Credit", x: 432, right: true, bold: true }, { text: "Balance", x: 504, right: true, bold: true }] },
    { kind: "rule" },
  ];
  let bal = 0;
  for (const e of book.entries) {
    if (e.status === "waived" || e.status === "void") continue;
    const debit = e.kind === "charge" || e.kind === "refund";
    bal = r2(bal + (debit ? e.amount : -e.amount));
    const desc = e.kind === "charge" ? e.label : e.kind === "payment" ? `${e.label} (${s(e.meta.method) || e.source})` : e.kind === "refund" ? `${e.label}` : `Credit: ${e.label}`;
    lines.push({ kind: "row", size: 8.5, cells: [{ text: day(e.postedAt), x: 0 }, { text: String(e.number), x: 62 }, { text: desc.slice(0, 44), x: 100 }, { text: debit ? cad(e.amount) : "", x: 360, right: true }, { text: debit ? "" : cad(e.amount), x: 432, right: true }, { text: cad(bal), x: 504, right: true }] });
  }
  lines.push({ kind: "rule" }, { kind: "row", cells: [{ text: "Balance owing", x: 0, bold: true }, { text: cad(book.balance), x: 504, right: true, bold: true }] });
  return lines;
}

export async function generateDocument(user: SessionClaims, body: Data) {
  await canFinance(user, "view");
  const doc = s(body.document);
  const all = DOCUMENTS().flatMap((g) => g.items);
  const item = all.find((d) => d.id === doc);
  if (!item) throw httpError(400, "Select a Document / Tax Form");
  const inst = user.institutionId;
  const cfg = await loadConfig(inst);
  const school = await institutionName(inst);
  const sid = s(body.studentId);
  if (doc === "statement") {
    if (!sid) throw httpError(400, "Select a student to generate a financial statement");
    const c = await studentCtx(user, sid, "view");
    await finAudit(user, sid, "Document generated", item.label, {});
    return { filename: `statement-${c.st.number}.pdf`, pdf: buildDocumentPdf(statementLines(school, c.st, c.book), `${school} - Financial Statement - ${c.st.number}`) };
  }
  const year = Number(doc.slice(6));
  if (!sid) await canFinance(user, "edit");
  const students = await studentsInfo(inst, sid ? [sid] : undefined);
  if (sid && !students.size) throw httpError(404, "Student not found", "NOT_FOUND");
  const books = await loadBooks(inst, cfg, sid ? [sid] : undefined);
  const lines: DocLine[] = [];
  let count = 0;
  for (const st of [...students.values()].sort((a, b) => a.last.localeCompare(b.last))) {
    const book = books.get(st.id);
    if (!book) continue;
    const f = await t2202Facts(inst, book, st.id, year);
    if (!sid && f.eligible < EPS) continue;
    lines.push(...t2202Lines(school, st, year, f));
    count++;
  }
  if (!count) throw httpError(404, `No students paid eligible tuition in ${year}`, "NOT_FOUND");
  if (sid) await finAudit(user, sid, "Document generated", item.label, {});
  else await audit(user, "F17", "", "bulk T2202 generated", { note: `${item.label}: ${count} students` });
  const only = sid ? students.get(sid)! : null;
  return { filename: only ? `T2202-${year}-${only.number}.pdf` : `T2202-${year}-all-students.pdf`, pdf: buildDocumentPdf(lines, `${school} - T2202 ${year}`) };
}
