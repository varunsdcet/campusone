/* Financial Management records beside the ledger: promotions / awards, adjustments, agent commissions, payment plans, collections, unallocated funds and alerts. */

import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { assertPermission } from "../superAdmin.service.js";
import { type Rec } from "./sysconfig.js";
import { PLAN_FREQUENCIES } from "./finance.spec.js";
import {
  EPS,
  S,
  add,
  agentLabel,
  allocateFund,
  amountOf,
  arr,
  assertPeriodOpen,
  cad,
  canFinance,
  dateAt,
  day,
  deallocate,
  drop,
  finAudit,
  getSingle,
  httpError,
  loadBook,
  loadConfig,
  nameOf,
  nextNumber,
  num,
  patchMeta,
  postEntry,
  putSingle,
  r2,
  row,
  rows,
  s,
  save,
  termId,
  text,
  today,
  type Book,
  type Config,
  type Data,
  type Row,
  type StudentInfo,
} from "./finance.core.js";
import { postCredit, postFee, setCreditStatus, studentCtx, type StudentCtx } from "./finance.ledger.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { termLabel } from "../../../lib/sectionTerm.js";
import { loadSectionTerms } from "../../instructor/myCoursesFacts.js";

/* ------------------------------------------------------------------ */
/* Academic facts used by promotion requirements and the profile header */
/* ------------------------------------------------------------------ */

function letterFromPct(p: number) {
  if (p >= 90) return 4.0;
  if (p >= 85) return 3.7;
  if (p >= 80) return 3.3;
  if (p >= 75) return 3.0;
  if (p >= 70) return 2.7;
  if (p >= 65) return 2.3;
  if (p >= 60) return 2.0;
  if (p >= 50) return 1.0;
  return 0;
}
const LETTER_POINTS: Record<string, number> = { A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "B-": 2.7, "C+": 2.3, C: 2.0, "C-": 1.7, D: 1.0, F: 0 };

export async function academicsOf(inst: string, studentId: string) {
  const [enrolments, grades] = await Promise.all([
    prisma.enrolment.findMany({ where: { institutionId: inst, studentId }, include: { section: { include: { course: true, term: true } } } }),
    prisma.gradeItem.findMany({ where: { institutionId: inst, studentId, status: "published", enrolment: { countsTowardCgpa: true } } }),
  ]);
  const sectionTerms = await loadSectionTerms(inst, enrolments.map((e) => e.section));
  const scored = grades.filter((g) => g.score != null && g.maxScore > 0);
  const pcts = scored.map((g) => ((g.score ?? 0) / g.maxScore) * 100);
  const points = scored.map((g, i) => LETTER_POINTS[s(g.letter)] ?? letterFromPct(pcts[i]!));
  const completed = enrolments.filter((e) => e.status === "completed");
  const enrolled = enrolments.filter((e) => e.status === "enrolled");
  return {
    cgpa: points.length ? r2(points.reduce((a, b) => a + b, 0) / points.length) : null,
    average: pcts.length ? r2(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    enrolledCourses: enrolled.length,
    completedCourses: completed.length,
    completedTerms: new Set(completed.map((e) => sectionTerms.get(e.sectionId)?.id ?? e.section.termId)).size,
    termNames: [...new Set(enrolments.map((e) => termLabel(sectionTerms.get(e.sectionId))))],
    courseLabels: [...new Set(enrolments.map((e) => `${e.section.course.code} — ${e.section.course.title}`))],
  };
}

/* ------------------------------------------------------------------ */
/* Agents                                                               */
/* ------------------------------------------------------------------ */

export const NO_PERMISSION = "You do not have the appropriate permissions to view this page.";

async function agentAccess(user: SessionClaims, level: "view" | "edit") {
  try {
    await assertPermission(user, "agentManagement", level);
  } catch {
    throw httpError(403, NO_PERMISSION, "FORBIDDEN");
  }
}

export async function studentAgentId(inst: string, studentId: string) {
  return s((await getSingle(inst, S.STUDENT_AGENT, studentId, "agent"))?.data.agentId);
}

export async function getStudentAgent(user: SessionClaims, studentId: string) {
  await canFinance(user, "view");
  await agentAccess(user, "view");
  const cfg = await loadConfig(user.institutionId);
  const id = await studentAgentId(user.institutionId, studentId);
  return { agentId: id, agent: id ? agentLabel(cfg.byId.get(id)) : "", options: cfg.agents.map((a) => ({ id: a.id, label: agentLabel(a) })) };
}

export async function setStudentAgent(user: SessionClaims, studentId: string, body: Data) {
  await canFinance(user, "edit");
  await agentAccess(user, "edit");
  const c = await studentCtx(user, studentId, "edit");
  const id = s(body.agentId);
  if (id && !c.cfg.agents.some((a) => a.id === id)) throw httpError(400, "Agent not found");
  const before = await studentAgentId(c.inst, studentId);
  await putSingle(user, S.STUDENT_AGENT, studentId, "agent", { agentId: id });
  await finAudit(user, studentId, id ? "Agent assigned" : "Agent removed", "Assigned agent", { before: agentLabel(c.cfg.byId.get(before)) || "None", after: agentLabel(c.cfg.byId.get(id)) || "None" });
  return { message: id ? "Agent assigned successfully" : "Agent removed from the student" };
}

/** Commission owed to an agent for one student, from the agent's rate and the student's tuition. */
export function commissionFor(agent: Rec | undefined, book: Book | undefined) {
  if (!agent || !book) return { expected: 0, earned: 0 };
  const tuition = book.charges.filter((c) => c.tuition && !c.hidden && c.statusLabel !== "Refunded");
  const total = r2(tuition.reduce((a, c) => a + c.total, 0));
  const paid = r2(tuition.reduce((a, c) => a + c.paid, 0));
  const rate = num(agent.data.commissionRate);
  const invoiced = agent.data.commissionBasis === "Tuition invoiced";
  if (agent.data.commissionType === "Fixed") return { expected: total > EPS ? rate : 0, earned: (invoiced ? total : paid) > EPS ? rate : 0 };
  return { expected: r2((total * rate) / 100), earned: r2(((invoiced ? total : paid) * rate) / 100) };
}

export async function createBonus(user: SessionClaims, body: Data) {
  await canFinance(user, "edit");
  await assertPermission(user, "agentManagement", "edit");
  const cfg = await loadConfig(user.institutionId);
  const agent = cfg.agents.find((a) => a.id === s(body.agentId));
  if (!agent) throw httpError(400, "Agent is required");
  const studentId = s(body.studentId);
  if (studentId) await studentCtx(user, studentId, "edit");
  const amount = amountOf(body.amount, "Bonus Amount");
  const number = await nextNumber(user.institutionId, "commission");
  const r = await add(user, S.COMMISSION, { kind: "bonus", number, agentId: agent.id, studentId, amount, note: text(body.note), paid: false }, studentId);
  if (studentId) await finAudit(user, studentId, "Agent bonus added", `Bonus #${number}`, { agent: agentLabel(agent), amount: cad(amount) }, r.id);
  return { id: r.id, message: "Agent bonus created successfully" };
}

export async function payCommission(user: SessionClaims, body: Data) {
  await canFinance(user, "edit");
  await assertPermission(user, "agentManagement", "edit");
  if (s(body.bonusId)) return payCommissionLocked(user, body);
  return withStudentMoneyLock(user.institutionId, s(body.studentId), () => payCommissionLocked(user, body));
}

async function payCommissionLocked(user: SessionClaims, body: Data) {
  const inst = user.institutionId;
  if (s(body.bonusId)) {
    const r = await row(inst, S.COMMISSION, s(body.bonusId), "Agent bonus");
    if (r.data.paid) throw httpError(400, "This bonus is already paid");
    await save(user, r.id, { ...r.data, paid: true, paidAt: today() });
    return { message: "Bonus marked as paid" };
  }
  const studentId = s(body.studentId);
  const c = await studentCtx(user, studentId, "edit");
  const agentId = await studentAgentId(inst, studentId);
  const agent = c.cfg.byId.get(agentId);
  if (!agent) throw httpError(400, "This student has no assigned agent");
  const { earned } = commissionFor(agent, c.book);
  const paid = r2((await rows(inst, S.COMMISSION, studentId)).filter((r) => r.data.kind === "payout" && r.data.agentId === agentId).reduce((a, r) => a + num(r.data.amount), 0));
  const owing = r2(earned - paid);
  if (owing < EPS) throw httpError(400, "There is no earned commission owing for this student");
  await add(user, S.COMMISSION, { kind: "payout", agentId, studentId, amount: owing, paidAt: today() }, studentId);
  await finAudit(user, studentId, "Agent commission paid", "Agent commission", { agent: agentLabel(agent), amount: cad(owing) });
  return { message: `Commission of ${cad(owing)} marked as paid` };
}

export async function deleteBonus(user: SessionClaims, id: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.COMMISSION, id, "Agent bonus");
  if (r.data.kind !== "bonus") throw httpError(400, "Only agent bonuses can be removed");
  if (r.data.paid) throw httpError(400, "Paid bonuses cannot be removed");
  await drop(user, [r.id]);
  return { message: "Agent bonus removed" };
}

/* ------------------------------------------------------------------ */
/* Promotions / awards                                                  */
/* ------------------------------------------------------------------ */

export const AWARD_STATUSES = ["Pending", "Active", "Inactive", "Revoked", "Declined"] as const;

const allOf = (d: Data, key: string) => !s(d[`${key}Mode`]).startsWith("Selected") || !arr(d[key]).length;
const inList = (d: Data, key: string, ...values: string[]) => allOf(d, key) || values.some((v) => v && arr<string>(d[key]).includes(v));
const standingLabel = (v: string) => (/suspen/i.test(v) ? "Academic Suspension" : /probation/i.test(v) ? "Academic Probation" : /warn/i.test(v) ? "Academic Warning" : "Good Standing");

function applicableCharges(c: StudentCtx, p: Rec) {
  return c.book.charges.filter(
    (ch) => !ch.hidden && ch.statusLabel !== "Refunded" && (p.data.applyTo === "Tuition Only" ? ch.tuition : p.data.applyTo === "Select Fees" ? arr<string>(p.data.applyFees).includes(ch.ledgerTypeId) : true),
  );
}

export function promotionAmount(c: StudentCtx, p: Rec) {
  const base = r2(applicableCharges(c, p).reduce((a, ch) => a + ch.total, 0));
  let amount = p.data.value === "Percentage" ? r2((base * num(p.data.percentage)) / 100) : num(p.data.amount);
  if (p.data.customizeMax) amount = Math.min(amount, num(p.data.maxPerUse));
  if (p.data.distribution === "Reduce Fees / Receivables") amount = Math.min(amount, base);
  return r2(amount);
}

/** Why a promotion is not available to the student (null when eligible). */
async function ineligible(c: StudentCtx, p: Rec, facts: Awaited<ReturnType<typeof academicsOf>>, awards: Row[], agent: string, termNow: string) {
  const d = p.data;
  const st = c.st;
  if (d.status !== "Active") return "Inactive";
  const t = today();
  if (d.specifyDates && (t < s(d.startDate) || t > s(d.endDate))) return "Outside the promotion dates";
  if (!inList(d, "campuses", st.campus)) return "Campus";
  if (!inList(d, "programs", st.program)) return "Program";
  if (!inList(d, "schedules", st.schedule)) return "Master schedule";
  if (!inList(d, "studentStatuses", st.status)) return "Student status";
  if (!inList(d, "standing", standingLabel(st.standing))) return "Academic standing";
  if (!inList(d, "rateCategories", st.rateCategory)) return "Rate category";
  if (!inList(d, "nationality", st.country)) return "Nationality";
  if (!inList(d, "agents", agent)) return "Assigned agent";
  if (!inList(d, "terms", ...facts.termNames)) return "Enrolment term";
  if (!inList(d, "courses", ...facts.courseLabels)) return "Enrolled courses";
  const n = facts.enrolledCourses;
  if (d.enrolment === "Full Time" && n < 3) return "Full-time enrolment";
  if (d.enrolment === "Part-time" && (n < 1 || n > 2)) return "Part-time enrolment";
  if (d.enrolment === "Custom" && n < num(d.minCourses)) return "Minimum courses";
  if (d.completion === "Courses Completed" && facts.completedCourses < num(d.coursesCompleted)) return "Courses completed";
  if (d.completion === "Terms Completed" && facts.completedTerms < num(d.termsCompleted)) return "Terms completed";
  if (d.academic === "Grade Point Average" && (facts.cgpa ?? -1) < num(d.requiredAverage)) return "Grade point average";
  if (d.academic === "Average Percentage" && (facts.average ?? -1) < num(d.requiredAverage)) return "Average percentage";
  const live = awards.filter((a) => a.data.promotionId === p.id && a.data.status !== "Declined");
  const mine = live.filter((a) => a.contextKey === st.id);
  if (d.uses === "Once per Student" && mine.length) return "Already awarded";
  if (d.uses === "Once per Term" && mine.some((a) => s(a.data.termId) === termNow)) return "Already awarded this term";
  if (d.uses === "Once per Program" && mine.some((a) => s(a.data.program) === st.program)) return "Already awarded for this program";
  if (num(d.maxUses) > 0 && live.length >= num(d.maxUses)) return "Maximum uses reached";
  if (promotionAmount(c, p) < EPS) return "No applicable fees";
  return null;
}

async function currentTermId(inst: string) {
  const t = today();
  const term = await prisma.financialTerm.findFirst({ where: { institutionId: inst, startsOn: { lte: t }, endsOn: { gte: t } }, orderBy: { startsOn: "desc" } });
  return term?.id ?? "";
}

export async function eligiblePromotions(c: StudentCtx) {
  const [facts, awards, agentId, termNow] = await Promise.all([academicsOf(c.inst, c.st.id), rows(c.inst, S.AWARD), studentAgentId(c.inst, c.st.id), currentTermId(c.inst)]);
  const agent = agentLabel(c.cfg.byId.get(agentId));
  const out: Array<{ id: string; name: string; type: string; eligibility: string; amount: number; distribution: string }> = [];
  for (const p of c.cfg.promotions) {
    if (await ineligible(c, p, facts, awards, agent, termNow)) continue;
    out.push({ id: p.id, name: nameOf(p), type: s(p.data.type), eligibility: s(p.data.eligibility), amount: promotionAmount(c, p), distribution: s(p.data.distribution) });
  }
  return out;
}

/** Applies every currently eligible automated promotion exactly through the
 * normal award path, so use limits, allocations and audit records are shared
 * with manually-created awards. */
export async function applyAutomatedPromotions(user: SessionClaims, studentId: string) {
  const c = await studentCtx(user, studentId, "edit");
  const eligible = (await eligiblePromotions(c)).filter((promotion) => promotion.eligibility === "Automated");
  const applied: string[] = [];
  for (const promotion of eligible) {
    const result = await createAward(user, studentId, { promotionId: promotion.id, status: "Active", eligibility: "Automated", note: "Applied automatically after an eligible fee was posted" });
    applied.push(result.id);
  }
  return applied;
}

export async function createAward(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "edit");
  const p = c.cfg.promotions.find((x) => x.id === s(body.promotionId));
  if (!p) throw httpError(400, "Promotion / Award is required");
  const eligible = await eligiblePromotions(c);
  if (!eligible.some((e) => e.id === p.id)) throw httpError(400, eligible.length ? `${c.st.name} is not eligible for "${nameOf(p)}".` : "Student is not eligible for any promotions or awards.");
  const status = s(body.status) || "Active";
  if (!(AWARD_STATUSES as readonly string[]).includes(status)) throw httpError(400, `Status "${status}" is not valid`);
  const allocations = c.cfg.promotionAllocations.filter((a) => a.data.status !== "Inactive");
  const requestedAllocation = s(body.allocation);
  const allocationRecord = requestedAllocation ? allocations.find((a) => a.id === requestedAllocation || nameOf(a) === requestedAllocation) : allocations[0];
  const allocation = allocationRecord ? nameOf(allocationRecord) : "";
  if (!allocation) throw httpError(400, "Select an active Promotion Allocation");
  const amount = promotionAmount(c, p);
  const note = text(body.note);
  await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This award");
  const number = await nextNumber(c.inst, "award");
  const reduce = p.data.distribution === "Reduce Fees / Receivables";
  const type = c.cfg.byId.get(s(p.data.disbursementType));
  const awardRow = await add(
    user,
    S.AWARD,
    { number, promotionId: p.id, promotionName: nameOf(p), type: s(p.data.type), status, allocation, eligibility: s(body.eligibility) || s(p.data.eligibility) || "Manual", note, amount, termId: await currentTermId(c.inst), program: c.st.program, creditId: "" },
    studentId,
  );
  const credit = await postCredit(c, {
    typeName: reduce || !type ? nameOf(p) : nameOf(type),
    typeId: reduce || !type ? "" : type.id,
    amount,
    note: note || `Promotion / award: ${nameOf(p)}`,
    status,
    chargeIds: reduce ? applicableCharges(c, p).map((ch) => ch.id) : undefined,
    extra: { awardId: awardRow.id, reduceFees: reduce, commission: p.data.disbursementCommission === "Include in agent commissions" },
  });
  await save(user, awardRow.id, { ...awardRow.data, creditId: credit.id });
  await finAudit(user, studentId, "Promotion / award added", `Award #${number}`, { promotion: nameOf(p), status, amount: cad(amount), allocated: cad(credit.applied), note }, awardRow.id);
  return { id: awardRow.id, message: "Promotion / award added successfully" };
}

export async function updateAward(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.AWARD, id, "Promotion / award");
  const c = await studentCtx(user, r.contextKey, "edit");
  const status = s(body.status) || s(r.data.status);
  if (!(AWARD_STATUSES as readonly string[]).includes(status)) throw httpError(400, `Status "${status}" is not valid`);
  const note = body.note === undefined ? s(r.data.note) : text(body.note);
  const credit = c.book.credits.find((f) => f.id === s(r.data.creditId));
  const p = c.cfg.byId.get(s(r.data.promotionId));
  if (credit && status !== s(r.data.status)) await setCreditStatus(c, credit, status, credit.meta.reduceFees && p ? applicableCharges(c, p).map((ch) => ch.id) : undefined);
  await save(user, r.id, { ...r.data, status, note });
  await finAudit(user, c.st.id, "Promotion / award updated", `Award #${num(r.data.number)}`, { promotion: s(r.data.promotionName), status: `${s(r.data.status)} → ${status}`, note }, r.id);
  return { message: "Promotion / award updated successfully" };
}

export function awardView(r: Row, book: Book | undefined) {
  const credit = book?.credits.find((f) => f.id === s(r.data.creditId));
  const amount = num(r.data.amount);
  const allocated = credit && credit.active ? r2(amount - credit.available) : 0;
  return {
    id: r.id,
    number: num(r.data.number),
    studentId: r.contextKey,
    promotionId: s(r.data.promotionId),
    promotion: s(r.data.promotionName),
    type: s(r.data.type),
    status: s(r.data.status),
    allocation: s(r.data.allocation),
    eligibility: s(r.data.eligibility),
    note: s(r.data.note),
    amount,
    allocated: credit?.active ? allocated : 0,
    remaining: credit?.active ? r2(amount - allocated) : amount,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Financial adjustments                                                */
/* ------------------------------------------------------------------ */

export const ADJUSTMENT_DIRECTIONS = ["Increase balance (debit)", "Decrease balance (credit)"] as const;

export async function createAdjustment(user: SessionClaims, body: Data) {
  const c = await studentCtx(user, s(body.studentId), "edit");
  const direction = s(body.direction);
  if (!(ADJUSTMENT_DIRECTIONS as readonly string[]).includes(direction)) throw httpError(400, "Adjustment Type is required");
  const amount = amountOf(body.amount, "Adjustment Amount");
  const reason = text(body.reason);
  if (!reason) throw httpError(400, "Reason is required");
  const number = await nextNumber(c.inst, "adjustment");
  const ledgerEntryId = s(body.ledgerEntryId);
  const ledgerAction = s(body.ledgerAction);
  const r = await add(
    user,
    S.ADJUSTMENT,
    {
      number,
      direction,
      amount,
      reason,
      status: "Pending",
      requestedBy: user.accountId,
      requestedAt: new Date().toISOString(),
      ...(ledgerEntryId ? { ledgerEntryId, ...(ledgerAction ? { ledgerAction } : {}) } : {}),
      ...(s(body.invoiceId)
        ? {
            invoiceId: s(body.invoiceId),
            creditNoteDate: s(body.creditNoteDate),
            creditNoteText: text(body.creditNoteText, 500),
          }
        : {}),
    },
    c.st.id,
  );
  await finAudit(user, c.st.id, "Adjustment requested", `Adjustment #${number}`, { direction, amount: cad(amount), reason }, r.id);
  return { id: r.id, number, message: "Financial adjustment submitted for approval" };
}

export async function reviewAdjustment(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const first = await row(user.institutionId, S.ADJUSTMENT, id, "Financial adjustment");
  return withStudentMoneyLock(user.institutionId, first.contextKey, () => reviewAdjustmentLocked(user, id, body));
}

async function reviewAdjustmentLocked(user: SessionClaims, id: string, body: Data) {
  const r = await row(user.institutionId, S.ADJUSTMENT, id, "Financial adjustment");
  if (r.data.status !== "Pending") throw httpError(400, "Only pending adjustments can be reviewed");
  const decision = s(body.decision);
  if (decision !== "Approved / Complete" && decision !== "Declined") throw httpError(400, "Decision must be Approved / Complete or Declined");
  if (decision === "Approved / Complete" && s(r.data.requestedBy) === user.accountId) {
    throw httpError(403, "You requested this adjustment; another user must approve it", "FORBIDDEN");
  }
  const c = await studentCtx(user, r.contextKey, "edit");
  const amount = num(r.data.amount);
  let entryId = "";
  if (decision === "Approved / Complete") {
    await assertPeriodOpen(user, c.cfg, c.st.campus, new Date(), "This adjustment");
    const chargeId = s(r.data.ledgerEntryId);
    if (chargeId && s(r.data.ledgerAction) !== "reverse") {
      const charge = c.book.charges.find((ch) => ch.id === chargeId);
      if (!charge || charge.owing < amount - 0.005) {
        throw httpError(409, `The charge this adjustment writes off is no longer open for ${cad(amount)}. Decline this adjustment instead.`, "CONFLICT");
      }
    }
    const invoiceId = s(r.data.invoiceId);
    let invoice: Row | null = null;
    let invoiceChargeIds: string[] = [];
    if (invoiceId) {
      invoice = await row(user.institutionId, S.INVOICE, invoiceId, "Invoice");
      if (invoice.contextKey !== c.st.id) throw httpError(409, "The invoice does not belong to this student", "CONFLICT");
      invoiceChargeIds = arr<Data>(invoice.data.items).map((item) => s(item.refId || item.chargeId)).filter(Boolean);
      const outstanding = r2(c.book.charges.filter((ch) => invoiceChargeIds.includes(ch.id) && !ch.hidden).reduce((sum, ch) => sum + ch.owing, 0));
      if (amount > outstanding + EPS) {
        throw httpError(409, `The invoice now has only ${cad(outstanding)} outstanding. Decline this adjustment and submit a new credit note.`, "CONFLICT");
      }
    }
    if (r.data.direction === "Increase balance (debit)") entryId = (await postFee(c, { type: undefined, label: "Financial Adjustment", unit: amount, quantity: 1, termId: null, note: s(r.data.reason), extra: { adjustmentId: r.id } })).id;
    else entryId = (await postCredit(c, { typeName: invoice ? "Invoice Credit Note" : "Financial Adjustment", typeId: "", amount, note: s(r.data.reason), extra: { adjustmentId: r.id, ...(invoice ? { invoiceId: invoice.id } : {}) }, ...(chargeId ? { chargeIds: [chargeId] } : invoiceChargeIds.length ? { chargeIds: invoiceChargeIds } : {}) })).id;
    if (invoice) {
      const notes = arr<Data>(invoice.data.creditNotes);
      const number = Math.max(0, ...notes.map((n) => num(n.number))) + 1;
      await save(user, invoice.id, {
        ...invoice.data,
        creditNotes: [
          ...notes,
          {
            number,
            date: s(r.data.creditNoteDate) || today(),
            amount,
            note: s(r.data.creditNoteText) || s(r.data.reason),
            adjustmentId: r.id,
            ledgerEntryId: entryId,
          },
        ],
      });
    }
  }
  await save(user, r.id, { ...r.data, status: decision, reviewedBy: user.accountId, reviewedAt: new Date().toISOString(), reviewNote: text(body.note), entryId });
  await finAudit(user, c.st.id, decision === "Declined" ? "Adjustment declined" : "Adjustment approved", `Adjustment #${num(r.data.number)}`, { direction: s(r.data.direction), amount: cad(amount), note: text(body.note) }, r.id);
  return { message: decision === "Declined" ? "Financial adjustment declined" : "Financial adjustment approved and posted to the ledger" };
}

/* ------------------------------------------------------------------ */
/* Payment plans                                                        */
/* ------------------------------------------------------------------ */

export const SYNC_OPTIONS = ["Disabled", "With term balance", "With total fees balance"] as const;
export const SCHEDULE_TYPES = ["Fixed Instalment Frequency", "Manual / Advanced Instalments"] as const;
export const PLAN_STATUSES = ["Overdue", "Paid To-Date", "Pending First Instalment", "Balance Paid"] as const;

function addFrequency(start: string, freq: string, k: number) {
  const m = /^(\d+) (day|week|month)s?$/.exec(freq);
  const d = new Date(`${start}T12:00:00.000Z`);
  if (!m) return day(d);
  const n = Number(m[1]) * k;
  if (m[2] === "day") d.setUTCDate(d.getUTCDate() + n);
  else if (m[2] === "week") d.setUTCDate(d.getUTCDate() + n * 7);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return day(d);
}

export function planDebt(d: Data, book: Book) {
  const open = book.charges.filter((c) => !c.hidden && c.statusLabel !== "Refunded");
  let debt = num(d.debt);
  if (d.syncBalance === "With term balance") debt = open.filter((c) => c.termId === (s(d.termId) || null)).reduce((a, c) => a + c.owing, 0);
  if (d.syncBalance === "With total fees balance") debt = open.reduce((a, c) => a + c.owing, 0);
  if (d.includeCredit && d.syncBalance !== "Disabled") debt -= book.available;
  return r2(Math.max(0, debt));
}

export function planSchedule(d: Data, debt: number) {
  let list: Array<{ date: string; amount: number }> = [];
  const downPayment = r2(Math.min(debt, Math.max(0, num(d.downPaymentCad))));
  const financed = r2(Math.max(0, debt - downPayment));
  if (d.scheduleType === "Manual / Advanced Instalments") {
    list = arr<Data>(d.instalments).map((i) => ({ date: s(i.date), amount: r2(num(i.amount)) })).sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const each = num(d.instalmentAmount);
    if (each > EPS && financed > EPS) {
      let left = financed;
      for (let k = 0; left > EPS && k < 240; k++) {
        const amt = r2(Math.min(each, left));
        list.push({ date: addFrequency(s(d.startDate), s(d.frequency), downPayment > EPS ? k + 1 : k), amount: amt });
        left = r2(left - amt);
      }
    }
  }
  if (downPayment > EPS) list.unshift({ date: s(d.startDate), amount: downPayment });
  let interest = 0;
  if (d.applyInterest && list.length) {
    const days = Math.max(0, (Date.parse(list[list.length - 1]!.date) - Date.parse(s(d.startDate))) / 86_400_000);
    interest = r2((financed * num(d.interestRate)) / 100 * (days / 365));
    if (interest > EPS) list[list.length - 1] = { ...list[list.length - 1]!, amount: r2(list[list.length - 1]!.amount + interest) };
  }
  return { list, interest };
}

export function planView(r: Row, book: Book) {
  const d = r.data;
  const debt = d.syncBalance && d.syncBalance !== "Disabled" ? planDebt(d, book) : num(d.debt);
  const { list, interest } = planSchedule(d, debt);
  const start = s(d.startDate);
  const paid = r2(
    Math.min(
      debt + interest,
      book.payments.filter((p) => !p.hidden && day(p.postedAt) >= start).reduce((a, p) => a + Math.max(0, p.amount - p.refunded), 0),
    ),
  );
  const remaining = r2(Math.max(0, debt + interest - paid));
  const t = today();
  const dueToDate = r2(list.filter((i) => i.date <= t).reduce((a, i) => a + i.amount, 0));
  let status: string;
  if (debt > EPS && remaining < EPS) status = "Balance Paid";
  else if (paid + EPS >= dueToDate) status = paid < EPS && (!list[0] || list[0].date >= t) ? "Pending First Instalment" : "Paid To-Date";
  else status = "Overdue";
  let cum = 0;
  let next: { date: string; amount: number } | null = null;
  for (const i of list) {
    cum = r2(cum + i.amount);
    if (cum > paid + EPS) {
      next = { date: i.date, amount: r2(Math.min(i.amount, cum - paid)) };
      break;
    }
  }
  return {
    id: r.id,
    number: num(d.number),
    studentId: r.contextKey,
    status,
    next,
    termId: s(d.termId),
    startDate: start,
    syncBalance: s(d.syncBalance) || "Disabled",
    scheduleType: s(d.scheduleType),
    frequency: s(d.frequency),
    instalmentAmount: num(d.instalmentAmount),
    instalmentsLabel: d.scheduleType === "Manual / Advanced Instalments" ? `${list.length} manual instalment${list.length === 1 ? "" : "s"}` : `${cad(num(d.instalmentAmount))} / ${s(d.frequency)}`,
    instalments: list,
    interest,
    interestRate: num(d.interestRate),
    downPaymentCad: num(d.downPaymentCad),
    debt,
    paid,
    remaining,
    prompts: s(d.prompts) || "Disabled",
    notes: s(d.notes),
    includeCredit: Boolean(d.includeCredit),
    applyInterest: Boolean(d.applyInterest),
    debtInput: num(d.debt),
    manual: arr<Data>(d.instalments),
    createdAt: r.createdAt.toISOString(),
  };
}

function downPaymentAmount(option: string, debt: number, instalment: number) {
  if (option === "First Instalment Amount") return r2(Math.min(debt, instalment));
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(option);
  return percent ? r2(Math.min(debt, debt * Number(percent[1]) / 100)) : 0;
}

async function planInput(c: StudentCtx, body: Data, prev: Data | null, template?: Rec) {
  const startDate = body.startDate === undefined && prev ? s(prev.startDate) : day(dateAt(body.startDate, "Start Date"));
  const syncBalance = s(body.syncBalance) || "Disabled";
  if (!(SYNC_OPTIONS as readonly string[]).includes(syncBalance)) throw httpError(400, `Synchronize Balance "${syncBalance}" is not valid`);
  const scheduleType = s(body.scheduleType) || SCHEDULE_TYPES[0];
  if (!(SCHEDULE_TYPES as readonly string[]).includes(scheduleType)) throw httpError(400, `Schedule Type "${scheduleType}" is not valid`);
  const term = await termId(c.inst, body.termId);
  if (syncBalance === "With term balance" && !term) throw httpError(400, "Select a Term to synchronize the plan with the term balance");
  const d: Data = {
    startDate,
    termId: term ?? "",
    syncBalance,
    debt: syncBalance === "Disabled" ? amountOf(body.debt, "Debt Amount") : num(body.debt),
    scheduleType,
    frequency: "",
    instalmentAmount: 0,
    instalments: [] as Data[],
    prompts: s(body.prompts) === "Enabled" ? "Enabled" : "Disabled",
    notes: text(body.notes),
    includeCredit: Boolean(body.includeCredit),
    applyInterest: Boolean(body.applyInterest),
    interestRate: body.applyInterest ? amountOf(body.interestRate, "Annual Interest Rate", { allowZero: false }) : 0,
  };
  if (num(d.interestRate) > 60) throw httpError(400, "Annual Interest Rate cannot exceed 60%");
  const debt = syncBalance === "Disabled" ? num(d.debt) : planDebt(d, c.book);
  if (debt < EPS) throw httpError(400, syncBalance === "Disabled" ? "Debt Amount must be greater than zero" : "There is no outstanding balance to put on a payment plan");
  if (scheduleType === "Fixed Instalment Frequency") {
    d.frequency = s(body.frequency);
    if (!PLAN_FREQUENCIES.includes(s(d.frequency))) throw httpError(400, "Instalment Frequency is required");
    d.instalmentAmount = amountOf(body.instalmentAmount, "Instalment Amount");
    d.downPaymentCad = downPaymentAmount(s(template?.data.downPayment), debt, num(d.instalmentAmount));
    if (Math.ceil((debt - num(d.downPaymentCad)) / num(d.instalmentAmount)) > 240) throw httpError(400, "The instalment amount is too small (more than 240 instalments)");
  } else {
    d.downPaymentCad = downPaymentAmount(s(template?.data.downPayment), debt, 0);
    const list = arr<Data>(body.instalments).map((i, k) => ({ date: day(dateAt(i.date, `Instalment ${k + 1} date`)), amount: amountOf(i.amount, `Instalment ${k + 1} amount`) }));
    if (!list.length) throw httpError(400, "Add at least one instalment");
    const sum = r2(list.reduce((a, i) => a + i.amount, 0));
    const financed = r2(debt - num(d.downPaymentCad));
    if (Math.abs(sum - financed) > 0.01) throw httpError(400, `Instalments add up to ${cad(sum)} but the financed balance after the ${cad(num(d.downPaymentCad))} down payment is ${cad(financed)}`);
    if (list.some((i) => i.date < startDate)) throw httpError(400, "Instalment dates cannot be before the start date");
    d.instalments = list;
  }
  return d;
}

export async function createPlan(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "edit");
  const tpl = c.cfg.planTemplates.find((t) => t.id === s(body.templateId));
  const d = await planInput(c, body, null, tpl);
  const number = await nextNumber(c.inst, "plan");
  const r = await add(user, S.PLAN, { ...d, number, templateId: tpl?.id ?? "" }, studentId);
  const feeType = tpl && s(tpl.data.planFee) !== "No Fee" ? c.cfg.ledgerTypes.find((t) => nameOf(t) === s(tpl.data.planFee)) : undefined;
  if (feeType) {
    const setupFee = await postFee(c, { type: feeType, unit: num(feeType.data[/international/i.test(c.st.rateCategory) ? "international" : "domestic"]), quantity: 1, termId: s(d.termId) || null, note: `Payment plan #${number} fee`, extra: { planId: r.id } });
    await save(user, r.id, { ...r.data, setupFeeEntryId: setupFee.id });
  }
  const v = planView({ ...r, data: { ...d, number } }, c.book);
  await finAudit(user, studentId, "Payment plan created", `Payment plan #${number}`, { debt: cad(v.debt), schedule: v.instalmentsLabel, start: v.startDate, instalments: v.instalments.length, interest: cad(v.interest), notes: s(d.notes) }, r.id);
  return { id: r.id, message: "Payment plan created successfully" };
}

export async function updatePlan(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.PLAN, id, "Payment plan");
  const c = await studentCtx(user, r.contextKey, "edit");
  const tpl = c.cfg.planTemplates.find((template) => template.id === s(body.templateId || r.data.templateId));
  const d = await planInput(c, body, r.data, tpl);
  await save(user, r.id, { ...r.data, ...d });
  await finAudit(user, c.st.id, "Payment plan updated", `Payment plan #${num(r.data.number)}`, { debt: cad(num(d.debt)), start: s(d.startDate), schedule: s(d.scheduleType), notes: s(d.notes) }, r.id);
  return { message: "Payment plan updated successfully" };
}

export async function deletePlan(user: SessionClaims, id: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.PLAN, id, "Payment plan");
  const c = await studentCtx(user, r.contextKey, "edit");
  const setupFee = c.book.charges.find((charge) => charge.id === s(r.data.setupFeeEntryId) || charge.meta.planId === r.id);
  let adjustmentId: string | null = null;
  if (setupFee && !setupFee.hidden) {
    if (setupFee.paid > EPS) throw httpError(409, `Payment plan #${num(r.data.number)} has a setup fee with ${cad(setupFee.paid)} paid. Refund the payment before deleting the plan.`, "CONFLICT");
    if (setupFee.owing > EPS) {
      const adjustment = await createAdjustment(user, {
        studentId: r.contextKey,
        direction: "Decrease balance (credit)",
        amount: setupFee.owing,
        reason: `Payment plan #${num(r.data.number)} setup fee cleanup`,
        ledgerEntryId: setupFee.id,
        ledgerAction: "waive",
      });
      adjustmentId = adjustment.id;
    }
  }
  await drop(user, [r.id]);
  await finAudit(user, r.contextKey, "Payment plan deleted", `Payment plan #${num(r.data.number)}`, { debt: cad(num(r.data.debt)), setupFeeAdjustmentId: adjustmentId }, r.id);
  return { message: adjustmentId ? "Payment plan deleted; its setup fee reversal was sent for approval" : "Payment plan deleted successfully", adjustmentId };
}

/* ------------------------------------------------------------------ */
/* Collections                                                          */
/* ------------------------------------------------------------------ */

export async function sendToCollections(user: SessionClaims, studentId: string, body: Data) {
  const c = await studentCtx(user, studentId, "edit");
  const agency = c.cfg.collectionAgencies.find((a) => a.id === s(body.agencyId));
  if (!agency) throw httpError(400, "Collection Agency is required");
  if ((await rows(c.inst, S.COLLECTION, studentId)).some((r) => r.data.status === "Active")) throw httpError(409, "This account is already with a collection agency. Recall it first.", "CONFLICT");
  const amount = amountOf(body.amount, "Amount Sent to Collections");
  if (amount > c.book.balance + EPS) throw httpError(400, `The amount cannot exceed the student balance (${cad(c.book.balance)})`);
  const rate = num(agency.data.commissionRate);
  const commission = agency.data.commissionType === "Fixed" ? rate : r2((amount * rate) / 100);
  const r = await add(user, S.COLLECTION, { agencyId: agency.id, agency: nameOf(agency), amount, commission, status: "Active", sentAt: today(), note: text(body.note) }, studentId);
  await finAudit(user, studentId, "Sent to collections", nameOf(agency), { amount: cad(amount), commission: cad(commission), note: text(body.note) }, r.id);
  return { id: r.id, message: `Account sent to ${nameOf(agency)}` };
}

export async function recallCollection(user: SessionClaims, id: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.COLLECTION, id, "Collection account");
  if (r.data.status !== "Active") throw httpError(400, "This collection account is not active");
  await save(user, r.id, { ...r.data, status: "Recalled", recalledAt: today() });
  await finAudit(user, r.contextKey, "Recalled from collections", s(r.data.agency), { amount: cad(num(r.data.amount)) }, r.id);
  return { message: "Account recalled from collections" };
}

/* ------------------------------------------------------------------ */
/* Unallocated funds                                                    */
/* ------------------------------------------------------------------ */

type FundAlloc = { id: string; studentId: string; amount: number; entryId: string; as: string; typeId: string; at: string };
export const fundAllocs = (r: Row) => arr<FundAlloc>(r.data.allocations);

export function fundView(r: Row, students: Map<string, StudentInfo>) {
  const allocs = fundAllocs(r);
  const amount = num(r.data.amount);
  const allocated = r2(allocs.reduce((a, x) => a + x.amount, 0));
  return {
    id: r.id,
    number: num(r.data.number),
    status: allocated >= amount - EPS ? "Allocated" : "Unallocated",
    note: s(r.data.note),
    amount,
    allocated,
    unallocated: r2(amount - allocated),
    receivedDate: s(r.data.receivedDate),
    recordedDate: day(r.createdAt),
    methodId: s(r.data.methodId),
    method: s(r.data.method),
    receipt: s(r.data.receipt),
    fundingSourceId: s(r.data.fundingSourceId),
    allocations: allocs.map((x) => ({ ...x, student: students.get(x.studentId)?.name ?? "(unknown student)", studentNumber: students.get(x.studentId)?.number ?? "" })),
  };
}

async function fundInput(cfg: Config, body: Data) {
  const method = cfg.paymentMethods.find((m) => m.id === s(body.methodId) || nameOf(m) === s(body.methodId));
  if (!method) throw httpError(400, "Payment Method is required");
  const received = dateAt(body.receivedDate, "Received Date");
  if (day(received) > today()) throw httpError(400, "Received Date cannot be in the future");
  const src = s(body.fundingSourceId);
  if (src && !cfg.fundingSources.some((f) => f.id === src)) throw httpError(400, "Funding source not found");
  return { amount: amountOf(body.amount, "Fund Amount"), receivedDate: day(received), methodId: method.id, method: nameOf(method), receipt: text(body.receipt, 100), note: text(body.note), fundingSourceId: src };
}

export async function createFund(user: SessionClaims, body: Data) {
  await canFinance(user, "edit");
  const cfg = await loadConfig(user.institutionId);
  const d = await fundInput(cfg, body);
  await assertPeriodOpen(user, cfg, "", d.receivedDate, "This fund");
  const number = await nextNumber(user.institutionId, "fund");
  const r = await add(user, S.FUND, { ...d, number, allocations: [] });
  return { id: r.id, message: "Unallocated fund added successfully" };
}

export async function updateFund(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  const cfg = await loadConfig(user.institutionId);
  const r = await row(user.institutionId, S.FUND, id, "Unallocated fund");
  const d = await fundInput(cfg, body);
  const allocated = r2(fundAllocs(r).reduce((a, x) => a + x.amount, 0));
  if (d.amount < allocated - EPS) throw httpError(400, `${cad(allocated)} of this fund is already allocated; the fund amount cannot be lower.`);
  await save(user, r.id, { ...r.data, ...d });
  return { message: "Unallocated fund updated successfully" };
}

export async function deleteFund(user: SessionClaims, id: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.FUND, id, "Unallocated fund");
  if (fundAllocs(r).length) throw httpError(400, "This fund has allocations. Remove them before deleting the fund.");
  await drop(user, [r.id]);
  return { message: "Unallocated fund removed successfully" };
}

export async function allocateFunds(user: SessionClaims, id: string, body: Data) {
  await canFinance(user, "edit");
  return withStudentMoneyLock(user.institutionId, `fund:${id}`, () => allocateFundsLocked(user, id, body));
}

async function allocateFundsLocked(user: SessionClaims, id: string, body: Data) {
  const r = await row(user.institutionId, S.FUND, id, "Unallocated fund");
  const lines = arr<Data>(body.rows).filter((x) => s(x.studentId) || s(x.amount));
  if (!lines.length) throw httpError(400, "Add at least one student allocation");
  const allocs = fundAllocs(r);
  let left = r2(num(r.data.amount) - allocs.reduce((a, x) => a + x.amount, 0));
  const total = r2(lines.reduce((a, x) => a + num(x.amount), 0));
  if (total > left + EPS) throw httpError(400, `Only ${cad(left)} of this fund is unallocated`);
  const planned: Array<{ c: StudentCtx; amount: number; typeId: string; type: Rec | undefined }> = [];
  for (const [k, line] of lines.entries()) {
    const c = await studentCtx(user, s(line.studentId), "edit");
    const amount = amountOf(line.amount, `Allocation ${k + 1} amount`);
    const typeId = s(line.typeId);
    const type = typeId ? c.cfg.disbursementTypes.find((t) => t.id === typeId) : undefined;
    if (typeId && !type) throw httpError(400, `Allocation ${k + 1}: disbursement type not found`);
    planned.push({ c, amount, typeId, type });
  }
  for (const { c, amount, typeId, type } of planned) {
    const note = `Allocated from unallocated fund #${num(r.data.number)}`;
    let entryId: string;
    if (type) entryId = (await postCredit(c, { typeName: nameOf(type), typeId: type.id, amount, note, extra: { fundId: r.id } })).id;
    else {
      const { entry, number } = await postEntry(
        user,
        { studentId: c.st.id, kind: "payment", label: "Standard Payment", amount, source: s(r.data.method), note, postedAt: dateAt(r.data.receivedDate, "Received Date") },
        { method: s(r.data.method), methodId: s(r.data.methodId), payee: "Student", paymentType: "Standard", fundId: r.id },
      );
      entryId = entry.id;
      const book = await loadBook(c.inst, c.cfg, c.st.id);
      await allocateFund(user, book, entry.id);
      await finAudit(user, c.st.id, "Payment recorded", `Transaction #${number}`, { type: "Fund allocation", amount: cad(amount), fund: `#${num(r.data.number)}` }, entry.id);
    }
    allocs.push({ id: randomUUID(), studentId: c.st.id, amount, entryId, as: type ? nameOf(type) : "Payment", typeId, at: new Date().toISOString() });
    left = r2(left - amount);
    await save(user, r.id, { ...r.data, allocations: allocs });
  }
  return { message: "Funds allocated successfully" };
}

export async function removeFundAllocation(user: SessionClaims, id: string, allocId: string) {
  await canFinance(user, "edit");
  const r = await row(user.institutionId, S.FUND, id, "Unallocated fund");
  const allocs = fundAllocs(r);
  const a = allocs.find((x) => x.id === allocId);
  if (!a) throw httpError(404, "Allocation not found", "NOT_FOUND");
  const c = await studentCtx(user, a.studentId, "edit");
  const f = [...c.book.payments, ...c.book.credits].find((x) => x.id === a.entryId);
  if (f && !f.hidden) {
    if (f.refunded > EPS) throw httpError(400, "Part of this allocation has been refunded to the student and it can no longer be removed.");
    await deallocate(user, c.book, { fundId: f.id });
    await prisma.financeLedgerEntry.update({ where: { id: f.id }, data: { status: "void", rowVersion: { increment: 1 } } });
    await patchMeta(user, f, { removed: true, removedAt: new Date().toISOString() });
    await finAudit(user, c.st.id, "Fund allocation removed", `Transaction #${f.number}`, { amount: cad(f.amount), fund: `#${num(r.data.number)}` }, f.id);
  }
  await save(user, r.id, { ...r.data, allocations: allocs.filter((x) => x.id !== allocId) });
  return { message: "Allocation removed" };
}

/* ------------------------------------------------------------------ */
/* Financial alerts                                                     */
/* ------------------------------------------------------------------ */

/** Raises alerts for overdue fees, overdue payment plans (with prompts enabled) and credit balances; clears the ones whose condition is gone. */
export async function syncAlerts(user: SessionClaims, books: Map<string, Book>, plans: Row[]) {
  const inst = user.institutionId;
  const existing = await rows(inst, S.ALERT);
  const byKey = new Map(existing.map((a) => [s(a.data.key), a]));
  const want = new Map<string, { studentId: string; kind: string; message: string }>();
  const t = today();
  for (const b of books.values()) {
    for (const ch of b.charges) {
      if (ch.owing > EPS && ch.dueAt && day(ch.dueAt) < t) want.set(`fee:${ch.id}`, { studentId: b.studentId, kind: "Overdue fee", message: `Fee #${ch.number} (${ch.ledgerTypeName}) was due ${day(ch.dueAt)}; ${cad(ch.owing)} is still owing.` });
    }
    if (b.balance < -EPS) want.set(`credit:${b.studentId}`, { studentId: b.studentId, kind: "Credit balance", message: `The student has a credit balance of ${cad(-b.balance)}.` });
  }
  for (const p of plans) {
    if (p.data.prompts !== "Enabled") continue;
    const b = books.get(p.contextKey);
    if (!b) continue;
    const v = planView(p, b);
    if (v.status === "Overdue") want.set(`plan:${p.id}`, { studentId: p.contextKey, kind: "Overdue payment plan", message: `Payment plan #${v.number} is overdue; ${cad(v.remaining)} remaining.` });
  }
  for (const [key, w] of want) {
    const a = byKey.get(key);
    if (!a) await add(user, S.ALERT, { key, ...w, status: "Active", resolved: "No", raisedAt: new Date().toISOString() }, w.studentId);
    else if (a.data.resolved === "Yes" && a.data.autoResolved) await save(user, a.id, { ...a.data, ...w, resolved: "No", autoResolved: false, status: "Active", raisedAt: new Date().toISOString() });
    else if (a.data.message !== w.message) await save(user, a.id, { ...a.data, message: w.message });
  }
  for (const a of existing) {
    if (!want.has(s(a.data.key)) && a.data.resolved !== "Yes") await save(user, a.id, { ...a.data, resolved: "Yes", autoResolved: true, resolvedAt: new Date().toISOString() });
  }
}

export async function alertAction(user: SessionClaims, id: string, action: string) {
  await canFinance(user, "edit");
  const a = await row(user.institutionId, S.ALERT, id, "Financial alert");
  const patch: Data =
    action === "dismiss" ? { status: "Dismissed" } : action === "restore" ? { status: "Active" } : action === "resolve" ? { resolved: "Yes", autoResolved: false, resolvedAt: new Date().toISOString(), resolvedBy: user.accountId } : action === "reopen" ? { resolved: "No" } : {};
  if (!Object.keys(patch).length) throw httpError(400, "Unknown alert action");
  await save(user, a.id, { ...a.data, ...patch });
  return { message: action === "dismiss" ? "Alert dismissed" : action === "restore" ? "Alert restored" : action === "resolve" ? "Alert marked as resolved" : "Alert reopened" };
}
