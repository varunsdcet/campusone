import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox, type Tx } from "@myheritage/events";
import type { SessionClaims } from "@myheritage/contracts";
import { SAFE_LINK_MESSAGE, isSafeLink } from "../../lib/safeLink.js";
import { assertSeat } from "./heritage/enrolment.js";
import { getCourseHistory, planItemRows } from "../academic/program-plan.service.js";
import { assertPeriodOpen, deallocate, S as FIN_SCREENS } from "./heritage/finance.core.js";
import { createAdjustment } from "./heritage/finance.records.js";
import { studentCtx } from "./heritage/finance.ledger.js";
import { withStudentMoneyLock } from "./heritage/studentLock.js";

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

export const UpsertCohortBody = z.object({
  id: z.string().uuid().optional(),
  programId: z.string().uuid(),
  code: z.string().trim().min(2).max(40),
  label: z.string().trim().min(2).max(120),
  intakeYear: z.number().int().min(2000).max(2100),
  intakeMonth: z.number().int().min(1).max(12),
  sectionLabel: z.string().trim().min(1).max(20).default("A"),
  campus: z.string().trim().min(1).max(120).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const GeneratePlanBody = z.object({
  studentId: z.string().uuid(),
  cohortId: z.string().uuid(),
});

export const LedgerPostBody = z.object({
  studentId: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  amountCad: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Amount can have at most 2 decimal places"),
  kind: z.enum(["charge", "credit", "payment"]),
  financialTermId: z.string().uuid().optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const LedgerAdjustBody = z.object({
  entryId: z.string().uuid(),
  action: z.enum(["reverse", "waive", "mark_paid"]),
  note: z.string().trim().max(1000).optional(),
});

export const GenerateTaxBody = z.object({
  studentId: z.string().uuid(),
  taxYear: z.number().int().min(2000).max(2100),
  regenerate: z.boolean().optional(),
});

export const ExtracurricularBody = z.object({
  id: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  termCode: z.string().trim().max(40).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(2000).optional().nullable(),
  status: z.string().trim().min(1).max(40).default("recorded"),
});

const SafeLinkUrl = z.string().trim().max(2000).refine(isSafeLink, SAFE_LINK_MESSAGE);

export const StudentDocumentBody = z.object({
  id: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  recordName: z.string().trim().min(1).max(200),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  docLabel: z.string().trim().max(200).optional().nullable(),
  downloadUrl: SafeLinkUrl.optional().nullable(),
  status: z.string().trim().min(1).max(40).default("available"),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const RetakeBody = z.object({
  studentId: z.string().uuid(),
  sectionId: z.string().uuid(),
  originalEnrolmentId: z.string().uuid().optional().nullable(),
  countsTowardCgpa: z.boolean().default(true),
  creditAwarded: z.boolean().default(false),
  continuous: z.boolean().default(false),
  addMakeupPlanItem: z.boolean().default(true),
  feeCad: z.number().positive().max(100_000),
});

export const MailPolicyBody = z.object({
  allowStudentForwarding: z.boolean(),
  allowSmsForwarding: z.boolean(),
  requireRegistrarAudit: z.boolean(),
  maxForwardAddressLength: z.number().int().min(20).max(500).default(200),
  note: z.string().trim().max(1000).optional().nullable(),
});

async function audit(
  user: SessionClaims,
  eventName: string,
  purpose: string,
  before: unknown,
  after: unknown,
  source: string,
  correlationId?: string,
  tx?: Tx,
) {
  const input = {
    institutionId: user.institutionId,
    actorId: user.accountId,
    eventName,
    purpose,
    before,
    after,
    source,
    correlationId: correlationId || randomUUID(),
  };
  if (tx) return writeAuditAndOutbox(tx, input);
  return prisma.$transaction((db) => writeAuditAndOutbox(db, input));
}

export async function listCohorts(institutionId: string) {
  const rows = await prisma.cohort.findMany({
    where: { institutionId },
    include: {
      program: true,
      _count: { select: { students: true, programPlans: true } },
    },
    orderBy: [{ intakeYear: "desc" }, { intakeMonth: "desc" }, { code: "asc" }],
  });
  return {
    items: rows.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      programId: c.programId,
      programName: c.program.name,
      programCode: c.program.code,
      intakeYear: c.intakeYear,
      intakeMonth: c.intakeMonth,
      sectionLabel: c.sectionLabel,
      campus: c.campus,
      startDate: c.startDate,
      endDate: c.endDate,
      studentCount: c._count.students,
      planCount: c._count.programPlans,
    })),
  };
}

export async function upsertCohort(user: SessionClaims, body: z.infer<typeof UpsertCohortBody>) {
  const program = await prisma.program.findFirst({
    where: { id: body.programId, institutionId: user.institutionId },
  });
  if (!program) throw httpError("Program not found", "NOT_FOUND", 404);

  if (body.id) {
    const existing = await prisma.cohort.findFirst({
      where: { id: body.id, institutionId: user.institutionId },
    });
    if (!existing) throw httpError("Cohort not found", "NOT_FOUND", 404);
    const updated = await prisma.cohort.update({
      where: { id: existing.id },
      data: {
        programId: body.programId,
        code: body.code,
        label: body.label,
        intakeYear: body.intakeYear,
        intakeMonth: body.intakeMonth,
        sectionLabel: body.sectionLabel,
        campus: body.campus ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        rowVersion: { increment: 1 },
      },
    });
    await audit(user, "Cohort.updated", "registrar_cohort", existing, updated, "admin.cohorts");
    return updated;
  }

  const created = await prisma.cohort.create({
    data: {
      institutionId: user.institutionId,
      programId: body.programId,
      code: body.code,
      label: body.label,
      intakeYear: body.intakeYear,
      intakeMonth: body.intakeMonth,
      sectionLabel: body.sectionLabel,
      campus: body.campus ?? null,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
    },
  });
  await audit(user, "Cohort.created", "registrar_cohort", null, created, "admin.cohorts");
  return created;
}

export async function generateProgramPlan(user: SessionClaims, body: z.infer<typeof GeneratePlanBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
    include: { programVersion: { include: { requirements: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);
  const cohort = await prisma.cohort.findFirst({
    where: { id: body.cohortId, institutionId: user.institutionId },
  });
  if (!cohort) throw httpError("Cohort not found", "NOT_FOUND", 404);
  if (!student.programVersionId || !student.programVersion) {
    throw httpError("Assign a program version before generating a program plan", "PROGRAM_VERSION_REQUIRED", 409);
  }
  if (student.programVersion.programId !== cohort.programId) {
    throw httpError("The selected cohort belongs to a different program", "COHORT_PROGRAM_MISMATCH", 409);
  }

  const requirements =
    student.programVersion?.requirements ??
    (await prisma.degreeRequirement.findMany({
      where: { institutionId: user.institutionId, programVersionId: student.programVersionId ?? undefined },
      orderBy: { sortOrder: "asc" },
    }));

  if (!requirements.length) {
    throw httpError("The assigned program version has no degree requirements", "PROGRAM_REQUIREMENTS_REQUIRED", 409);
  }
  const courses = requirements.map((r, i) => ({
          courseId: r.courseId,
          courseCode: r.courseCode,
          title: r.title,
          credits: r.credits,
          sortOrder: r.sortOrder ?? i,
          category: "main" as const,
        }));
  const history = await getCourseHistory(user.institutionId, student.id);
  const items = planItemRows(courses, history.all, { startsOn: cohort.startDate, endsOn: cohort.endDate });

  const plan = await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: student.id },
      data: { cohortId: cohort.id, rowVersion: { increment: 1 } },
    });
    const existing = await tx.programPlan.findFirst({
      where: { institutionId: user.institutionId, studentId: student.id, status: "active" },
    });
    if (existing) {
      await tx.programPlanItem.deleteMany({ where: { planId: existing.id } });
      await tx.programPlan.update({
        where: { id: existing.id },
        data: { cohortId: cohort.id, rowVersion: { increment: 1 } },
      });
      await tx.programPlanItem.createMany({
        data: items.map((c) => ({ institutionId: user.institutionId, planId: existing.id, ...c })),
      });
      return existing;
    }
    const created = await tx.programPlan.create({
      data: {
        institutionId: user.institutionId,
        studentId: student.id,
        cohortId: cohort.id,
        status: "active",
        items: {
          create: items.map((c) => ({ institutionId: user.institutionId, ...c })),
        },
      },
    });
    return created;
  });

  await audit(
    user,
    "ProgramPlan.generated",
    "registrar_cohort",
    null,
    { planId: plan.id, studentId: student.id, cohortId: cohort.id, itemCount: courses.length },
    "admin.cohorts.generatePlan",
  );
  return { planId: plan.id, itemCount: courses.length, cohortId: cohort.id, studentId: student.id };
}

export async function listLedger(institutionId: string, studentId?: string) {
  const rows = await prisma.financeLedgerEntry.findMany({
    where: {
      institutionId,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { include: { person: true } },
      financialTerm: true,
    },
    orderBy: { postedAt: "desc" },
    take: 200,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.person.givenName} ${r.student.person.familyName}`,
      studentNumber: r.student.studentNumber,
      label: r.label,
      amountCad: Number(r.amountCad),
      kind: r.kind,
      status: r.status,
      source: r.source,
      note: r.note,
      dueAt: r.dueAt?.toISOString() ?? null,
      postedAt: r.postedAt.toISOString(),
      financialTermId: r.financialTermId,
      financialTermCode: r.financialTerm?.code ?? null,
      reversedFromId: r.reversedFromId,
    })),
  };
}

export function postLedgerEntry(user: SessionClaims, body: z.infer<typeof LedgerPostBody>) {
  return withStudentMoneyLock(user.institutionId, body.studentId, () => postLedgerEntryLocked(user, body));
}

async function postLedgerEntryLocked(user: SessionClaims, body: z.infer<typeof LedgerPostBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);
  const finance = await studentCtx(user, student.id, "edit");
  await assertPeriodOpen(user, finance.cfg, finance.st.campus, new Date(), "This ledger entry");
  if (body.financialTermId) {
    const term = await prisma.financialTerm.findFirst({
      where: { id: body.financialTermId, institutionId: user.institutionId },
    });
    if (!term) throw httpError("Financial term not found", "NOT_FOUND", 404);
  }
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeLedgerEntry.create({
      data: {
        institutionId: user.institutionId,
        studentId: body.studentId,
        label: body.label,
        amountCad: body.amountCad.toFixed(2),
        kind: body.kind,
        status: body.kind === "payment" ? "paid" : "open",
        source: body.source ?? "manual_post",
        note: body.note ?? null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        financialTermId: body.financialTermId ?? null,
      },
    });
    await audit(user, "FinanceLedger.posted", "finance_ar", null, entry, "admin.finance.post", undefined, tx);
    return entry;
  });
}

export async function adjustLedgerEntry(user: SessionClaims, body: z.infer<typeof LedgerAdjustBody>) {
  const entry = await prisma.financeLedgerEntry.findFirst({
    where: { id: body.entryId, institutionId: user.institutionId },
  });
  if (!entry) throw httpError("Ledger entry not found", "NOT_FOUND", 404);
  if (entry.status === "waived" || entry.status === "void") throw httpError(`This entry is already ${entry.status}`, "CONFLICT", 409);
  if (entry.source === "reversal" || entry.reversedFromId) throw httpError("A reversal cannot be adjusted", "CONFLICT", 409);
  const unpaidCharge = entry.kind === "charge" && entry.status === "open";
  // Only rows still at the status we read are changed, so two concurrent adjustments cannot both apply.
  const claim = async (tx: Pick<typeof prisma, "financeLedgerEntry">, status: string, note: string | null) => {
    const res = await tx.financeLedgerEntry.updateMany({
      where: { id: entry.id, institutionId: user.institutionId, status: entry.status },
      data: { status, note, rowVersion: { increment: 1 } },
    });
    if (res.count !== 1) throw httpError("This entry was changed by someone else. Reload and try again.", "CONFLICT", 409);
    return tx.financeLedgerEntry.findFirstOrThrow({ where: { id: entry.id } });
  };

  if (body.action === "mark_paid") {
    throw httpError("A charge is settled by posting the payment against it (Post ledger entry, kind Payment), not by marking it paid", "CONFLICT", 409);
  }
  if (body.action === "waive" && !unpaidCharge) {
    throw httpError("Only an open charge can be waived; reverse payments and paid charges instead", "CONFLICT", 409);
  }
  if (entry.kind === "charge") return requestChargeWriteOff(user, entry, body);

  return withStudentMoneyLock(user.institutionId, entry.studentId, async () => {
    // Release every allocation first so reversing a payment/credit cannot leave charges looking paid.
    const finance = await studentCtx(user, entry.studentId, "edit");
    await assertPeriodOpen(user, finance.cfg, finance.st.campus, new Date(), "This reversal");
    await deallocate(user, finance.book, { fundId: entry.id });

    // Waiving the original removes its balance effect; the reversal row is a void memo for the audit trail.
    const reversal = await prisma.$transaction(async (tx) => {
      const updated = await claim(tx, "waived", body.note ?? "Reversed");
      const created = await tx.financeLedgerEntry.create({
        data: {
          institutionId: user.institutionId,
          studentId: entry.studentId,
          label: `Reversal: ${entry.label}`,
          amountCad: (-Math.abs(Number(entry.amountCad))).toFixed(2),
          kind: "charge",
          status: "void",
          source: "reversal",
          note: body.note ?? null,
          financialTermId: entry.financialTermId,
          reversedFromId: entry.id,
        },
      });
      await audit(user, "FinanceLedger.reversed", "finance_ar", entry, { updated, created }, "admin.finance.adjust", undefined, tx);
      return { updated, created };
    });
    return reversal;
  });
}

/**
 * Writing off a charge lowers what the student owes, so it goes through the same second-reviewer
 * Financial Adjustment approval as Financial Management instead of changing the ledger directly.
 */
async function requestChargeWriteOff(
  user: SessionClaims,
  entry: { id: string; studentId: string; label: string; amountCad: unknown },
  body: z.infer<typeof LedgerAdjustBody>,
) {
  // Same lock as adjustment review, so parallel requests see each other's adjustment before creating one.
  const created = await withStudentMoneyLock(user.institutionId, entry.studentId, async () => {
    const linked = await prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: FIN_SCREENS.ADJUSTMENT, contextKey: entry.studentId, deletedAt: null, dataJson: { contains: entry.id } },
      select: { dataJson: true },
    });
    const prior = linked
      .map((r) => JSON.parse(r.dataJson) as { status?: string; number?: number; ledgerEntryId?: string })
      .find((d) => d.ledgerEntryId === entry.id && (d.status === "Pending" || d.status === "Approved / Complete"));
    if (prior?.status === "Pending") throw httpError(`Adjustment #${prior.number} for this charge is already waiting for approval`, "CONFLICT", 409);
    if (prior) throw httpError(`Adjustment #${prior.number} already wrote off this charge`, "CONFLICT", 409);
    let amount = Math.abs(Number(entry.amountCad));
    if (body.action === "waive") {
      const ctx = await studentCtx(user, entry.studentId, "edit");
      amount = ctx.book.charges.find((c) => c.id === entry.id)?.owing ?? amount;
      if (amount < 0.005) throw httpError("This charge has nothing left to pay", "CONFLICT", 409);
    }
    const verb = body.action === "waive" ? "Waive" : "Reverse";
    return createAdjustment(user, {
      studentId: entry.studentId,
      direction: "Decrease balance (credit)",
      amount,
      reason: `${verb} ledger charge "${entry.label}"${body.note ? `: ${body.note}` : ""}`,
      ledgerEntryId: entry.id,
      ledgerAction: body.action,
    });
  });
  const verb = body.action === "waive" ? "Waive" : "Reverse";
  await audit(user, "FinanceLedger.writeOffRequested", "finance_ar", entry, { adjustmentId: created.id, action: body.action }, "admin.finance.adjust");
  return {
    pendingApproval: true,
    adjustmentId: created.id,
    message: `${verb} request submitted as Financial Adjustment #${created.number}. Another user must approve it in Financial Management before the balance changes.`,
  };
}

export async function listTaxDocumentsAdmin(institutionId: string) {
  const rows = await prisma.taxDocument.findMany({
    where: { institutionId },
    include: { student: { include: { person: true } } },
    orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.person.givenName} ${r.student.person.familyName}`,
      studentNumber: r.student.studentNumber,
      docType: r.docType,
      taxYear: r.taxYear,
      title: r.title,
      status: r.status,
      eligibleTuitionCad: r.eligibleTuitionCad,
      enrolmentMonths: r.enrolmentMonths,
      craStatus: r.craStatus,
      issuedAt: r.issuedAt?.toISOString() ?? null,
      downloadUrl: `/admin/tax-documents/${r.id}/pdf`,
    })),
  };
}

export async function getAdminTaxPdf(user: SessionClaims, documentId: string) {
  const row = await prisma.taxDocument.findFirst({
    where: { id: documentId, institutionId: user.institutionId },
    include: { student: { include: { person: true } } },
  });
  if (!row) throw httpError("Tax document not found", "NOT_FOUND", 404);
  const { renderTaxCertificatePdf, taxPdfFilename } = await import("../../lib/taxPdf.js");
  const inst = await prisma.institution.findFirst({ where: { id: user.institutionId } });
  const pdf = renderTaxCertificatePdf({
    institutionName: inst?.name ?? "Heritage College",
    legalName: inst?.legalName,
    addressLine1: inst?.addressLine1,
    city: inst?.city,
    region: inst?.region,
    postalCode: inst?.postalCode,
    country: inst?.country,
    docType: row.docType,
    title: row.title,
    taxYear: row.taxYear,
    recipientName: `${row.student.person.givenName} ${row.student.person.familyName}`.trim(),
    recipientIdLabel: "Student number",
    recipientId: row.student.studentNumber,
    programName: row.student.programName,
    eligibleTuitionCad: row.eligibleTuitionCad,
    enrolmentMonths: row.enrolmentMonths,
    craStatus: row.craStatus,
    status: row.status,
    issuedAt: row.issuedAt,
  });
  return { pdf, filename: taxPdfFilename(row.docType, row.taxYear) };
}

export async function generateT2202(user: SessionClaims, body: z.infer<typeof GenerateTaxBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
    include: { person: true },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);

  const finance = await studentCtx(user, student.id, "view");
  const yearPrefix = String(body.taxYear);
  const eligibleTuitionCad = Number(
    finance.book.charges
      .filter((charge) => charge.tuition && !charge.hidden && charge.postedAt.toISOString().startsWith(yearPrefix))
      .reduce((total, charge) => total + Math.max(0, charge.paid), 0)
      .toFixed(2),
  );
  const enrolments = await prisma.enrolment.findMany({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
      status: { in: ["enrolled", "completed"] },
    },
    include: { section: { include: { term: true } } },
  });
  const months = new Set<number>();
  for (const enrolment of enrolments) {
    const term = enrolment.section.term;
    for (let month = 1; month <= 12; month++) {
      const start = `${yearPrefix}-${String(month).padStart(2, "0")}-01`;
      const end = `${yearPrefix}-${String(month).padStart(2, "0")}-31`;
      if (term.startsOn <= end && term.endsOn >= start) months.add(month);
    }
  }
  const enrolmentMonths = months.size;

  const existing = await prisma.taxDocument.findFirst({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
      docType: "T2202",
      taxYear: body.taxYear,
    },
  });
  if (existing && !body.regenerate) {
    throw httpError("T2202 already exists for this year — set regenerate=true", "CONFLICT", 409);
  }

  const payload = {
    title: `T2202 Tuition and Enrolment Certificate — ${body.taxYear}`,
    status: "available",
    eligibleTuitionCad,
    enrolmentMonths,
    craStatus: "generated",
    issuedAt: new Date(),
  };

  let doc = existing
    ? await prisma.taxDocument.update({
        where: { id: existing.id },
        data: { ...payload, rowVersion: { increment: 1 } },
      })
    : await prisma.taxDocument.create({
        data: {
          institutionId: user.institutionId,
          studentId: student.id,
          docType: "T2202",
          taxYear: body.taxYear,
          ...payload,
        },
      });

  const downloadUrl = `/student/tax-documents/${doc.id}/pdf`;
  if (doc.downloadUrl !== downloadUrl) {
    doc = await prisma.taxDocument.update({
      where: { id: doc.id },
      data: { downloadUrl },
    });
  }

  await audit(user, "TaxDocument.generated", "finance_tax", existing, doc, "admin.tax.generate");
  return doc;
}

export async function listExtracurricularAdmin(institutionId: string, studentId?: string) {
  const rows = await prisma.extracurricularRecord.findMany({
    where: { institutionId, ...(studentId ? { studentId } : {}) },
    include: { student: { include: { person: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.person.givenName} ${r.student.person.familyName}`,
      termCode: r.termCode,
      category: r.category,
      title: r.title,
      detail: r.detail,
      status: r.status,
    })),
  };
}

export async function upsertExtracurricular(user: SessionClaims, body: z.infer<typeof ExtracurricularBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);

  if (body.id) {
    const existing = await prisma.extracurricularRecord.findFirst({
      where: { id: body.id, institutionId: user.institutionId },
    });
    if (!existing) throw httpError("Record not found", "NOT_FOUND", 404);
    const updated = await prisma.extracurricularRecord.update({
      where: { id: existing.id },
      data: {
        termCode: body.termCode ?? null,
        category: body.category,
        title: body.title,
        detail: body.detail ?? null,
        status: body.status,
        rowVersion: { increment: 1 },
      },
    });
    await audit(user, "Extracurricular.updated", "student_records", existing, updated, "admin.extracurricular");
    return updated;
  }

  const created = await prisma.extracurricularRecord.create({
    data: {
      institutionId: user.institutionId,
      studentId: body.studentId,
      termCode: body.termCode ?? null,
      category: body.category,
      title: body.title,
      detail: body.detail ?? null,
      status: body.status,
    },
  });
  await audit(user, "Extracurricular.created", "student_records", null, created, "admin.extracurricular");
  return created;
}

export async function deleteExtracurricular(user: SessionClaims, id: string) {
  const existing = await prisma.extracurricularRecord.findFirst({
    where: { id, institutionId: user.institutionId },
  });
  if (!existing) throw httpError("Record not found", "NOT_FOUND", 404);
  await prisma.extracurricularRecord.delete({ where: { id } });
  await audit(user, "Extracurricular.deleted", "student_records", existing, null, "admin.extracurricular");
  return { ok: true };
}

export async function listStudentDocumentsAdmin(institutionId: string, studentId?: string) {
  const rows = await prisma.studentDocument.findMany({
    where: { institutionId, ...(studentId ? { studentId } : {}) },
    include: { student: { include: { person: true } } },
    orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.person.givenName} ${r.student.person.familyName}`,
      studentNumber: r.student.studentNumber,
      recordName: r.recordName,
      recordDate: r.recordDate,
      docLabel: r.docLabel,
      downloadUrl: r.downloadUrl,
      status: r.status,
      note: r.note,
    })),
  };
}

export async function upsertStudentDocument(user: SessionClaims, body: z.infer<typeof StudentDocumentBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);

  if (body.id) {
    const existing = await prisma.studentDocument.findFirst({
      where: { id: body.id, institutionId: user.institutionId },
    });
    if (!existing) throw httpError("Document not found", "NOT_FOUND", 404);
    const updated = await prisma.studentDocument.update({
      where: { id: existing.id },
      data: {
        recordName: body.recordName,
        recordDate: body.recordDate ?? null,
        docLabel: body.docLabel ?? null,
        downloadUrl: body.downloadUrl ?? null,
        status: body.status,
        note: body.note ?? null,
        rowVersion: { increment: 1 },
      },
    });
    await audit(user, "StudentDocument.updated", "student_documents", existing, updated, "admin.documents");
    return updated;
  }

  const created = await prisma.studentDocument.create({
    data: {
      institutionId: user.institutionId,
      studentId: body.studentId,
      recordName: body.recordName,
      recordDate: body.recordDate ?? null,
      docLabel: body.docLabel ?? null,
      downloadUrl: body.downloadUrl ?? null,
      status: body.status,
      note: body.note ?? null,
    },
  });
  await audit(user, "StudentDocument.created", "student_documents", null, created, "admin.documents");
  return created;
}

export async function deleteStudentDocument(user: SessionClaims, id: string) {
  const existing = await prisma.studentDocument.findFirst({
    where: { id, institutionId: user.institutionId },
  });
  if (!existing) throw httpError("Document not found", "NOT_FOUND", 404);
  await prisma.studentDocument.delete({ where: { id } });
  await audit(user, "StudentDocument.deleted", "student_documents", existing, null, "admin.documents");
  return { ok: true };
}

export async function listStudentDocumentsForStudent(institutionId: string, studentId: string) {
  const rows = await prisma.studentDocument.findMany({
    where: { institutionId, studentId },
    orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      recordName: r.recordName,
      recordDate: r.recordDate,
      docLabel: r.docLabel,
      downloadUrl: r.status === "available" && r.downloadUrl && isSafeLink(r.downloadUrl) ? r.downloadUrl : null,
      status: r.status,
    })),
  };
}

export async function listRetakes(institutionId: string) {
  const rows = await prisma.enrolment.findMany({
    where: { institutionId, attemptNumber: { gt: 1 } },
    include: {
      student: { include: { person: true } },
      section: { include: { course: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    items: rows.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      studentName: `${e.student.person.givenName} ${e.student.person.familyName}`,
      studentNumber: e.student.studentNumber,
      sectionId: e.sectionId,
      sectionCode: e.section.code,
      courseCode: e.section.course.code,
      courseTitle: e.section.course.title,
      attemptNumber: e.attemptNumber,
      originalEnrolmentId: e.originalEnrolmentId,
      countsTowardCgpa: e.countsTowardCgpa,
      creditAwarded: e.creditAwarded,
      continuous: e.continuous,
      status: e.status,
    })),
  };
}

export async function createRetake(user: SessionClaims, body: z.infer<typeof RetakeBody>) {
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId: user.institutionId },
    include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } },
  });
  if (!student) throw httpError("Student not found", "NOT_FOUND", 404);
  const section = await prisma.section.findFirst({
    where: { id: body.sectionId, institutionId: user.institutionId },
    include: { course: true },
  });
  if (!section) throw httpError("Section not found", "NOT_FOUND", 404);

  const prior = await prisma.enrolment.findMany({
    where: {
      institutionId: user.institutionId,
      studentId: body.studentId,
      section: { courseId: section.courseId },
    },
    orderBy: { attemptNumber: "desc" },
  });
  if (prior.some((e) => e.sectionId === body.sectionId && (e.status === "enrolled" || e.status === "waitlisted"))) {
    throw httpError("This student is already actively enrolled in this section", "CONFLICT", 409);
  }
  if (body.originalEnrolmentId && !prior.some((e) => e.id === body.originalEnrolmentId)) {
    throw httpError("Original enrolment must be an earlier attempt of this course by the same student", "VALIDATION_ERROR", 400);
  }
  const attemptNumber = (prior[0]?.attemptNumber ?? 0) + 1;
  const originalEnrolmentId = body.originalEnrolmentId ?? prior[prior.length - 1]?.id ?? null;

  const enrolment = await prisma.$transaction(async (tx) => {
    const status = await assertSeat(tx, user.institutionId, section.id, `${section.course.code} ${section.code}`);
    const created = await tx.enrolment.create({
      data: {
        institutionId: user.institutionId,
        sectionId: body.sectionId,
        studentId: body.studentId,
        status,
        attemptNumber,
        countsTowardCgpa: body.countsTowardCgpa,
        creditAwarded: body.creditAwarded,
        continuous: body.continuous,
        originalEnrolmentId,
      },
    });
    await tx.financeLedgerEntry.create({
      data: {
        institutionId: user.institutionId,
        studentId: student.id,
        label: `Retake fee — ${section.course.code}`,
        amountCad: body.feeCad,
        kind: "charge",
        status: "open",
        source: "retake_enrolment",
        note: `Attempt ${attemptNumber} · ${section.code}`,
        courseId: section.courseId,
        sectionId: section.id,
      },
    });
    for (const account of student.person.accounts) {
      await tx.notification.create({
        data: {
          institutionId: user.institutionId,
          recipientAccountId: account.id,
          channel: "in_app",
          title: "Retake enrolment created",
          body: `${section.course.code} ${section.code} · attempt ${attemptNumber}. A CAD ${body.feeCad.toFixed(2)} retake fee was posted.`,
          templateKey: "enrolment.retake.created",
        },
      });
    }

    if (body.addMakeupPlanItem) {
      const plan = await tx.programPlan.findFirst({
        where: { institutionId: user.institutionId, studentId: body.studentId, status: "active" },
        include: { items: { orderBy: { sortOrder: "desc" }, take: 1 } },
      });
      if (plan) {
        await tx.programPlanItem.create({
          data: {
            institutionId: user.institutionId,
            planId: plan.id,
            courseId: section.courseId,
            courseCode: section.course.code,
            title: `${section.course.title} (Retake ${attemptNumber})`,
            credits: section.course.credits,
            sortOrder: (plan.items[0]?.sortOrder ?? 0) + 1,
            category: "makeup",
            status: "in_progress",
            sectionId: section.id,
          },
        });
      }
    }
    return created;
  });

  await audit(user, "Enrolment.retakeCreated", "registrar_retake", null, enrolment, "admin.retakes");
  return { ...enrolment, attemptNumber, feeCad: body.feeCad };
}

export async function getMailPolicy(institutionId: string) {
  const row = await prisma.institutionMailPolicy.findUnique({ where: { institutionId } });
  if (!row) return {
    id: null,
    institutionId,
    allowStudentForwarding: false,
    allowSmsForwarding: false,
    requireRegistrarAudit: true,
    maxForwardAddressLength: 254,
    note: null,
  };
  return {
    id: row.id,
    institutionId: row.institutionId,
    allowStudentForwarding: row.allowStudentForwarding,
    allowSmsForwarding: row.allowSmsForwarding,
    requireRegistrarAudit: row.requireRegistrarAudit,
    maxForwardAddressLength: row.maxForwardAddressLength,
    note: row.note,
  };
}

export async function updateMailPolicy(user: SessionClaims, body: z.infer<typeof MailPolicyBody>) {
  const before = await getMailPolicy(user.institutionId);
  const updated = await prisma.institutionMailPolicy.upsert({
    where: { institutionId: user.institutionId },
    create: {
      institutionId: user.institutionId,
      ...body,
      note: body.note ?? null,
    },
    update: {
      ...body,
      note: body.note ?? null,
      rowVersion: { increment: 1 },
    },
  });
  await audit(user, "MailPolicy.updated", "mail_policy", before, updated, "admin.mailPolicy");
  return updated;
}

export async function applyStudentProfileChange(
  institutionId: string,
  studentId: string,
  diff: Record<string, unknown>,
  tx: Tx,
) {
  const student = await tx.student.findFirst({
    where: { id: studentId, institutionId },
    include: { person: true },
  });
  if (!student) return;

  const personData: Record<string, string | null> = {};
  if (typeof diff.givenName === "string") personData.givenName = diff.givenName;
  if (typeof diff.familyName === "string") personData.familyName = diff.familyName;
  if (typeof diff.middleName === "string") personData.middleName = diff.middleName;
  if (typeof diff.preferredName === "string") personData.preferredName = diff.preferredName;
  if (typeof diff.primaryEmail === "string") personData.email = diff.primaryEmail;
  if (typeof diff.personalEmail === "string") personData.personalEmail = diff.personalEmail;
  if (typeof diff.phone === "string") personData.phone = diff.phone;
  if (typeof diff.dateOfBirth === "string") personData.dateOfBirth = diff.dateOfBirth;
  if (typeof diff.emergencyContactName === "string") personData.emergencyContactName = diff.emergencyContactName;
  if (typeof diff.emergencyContactPhone === "string") personData.emergencyContactPhone = diff.emergencyContactPhone;
  if (Object.keys(personData).length) {
    await tx.person.update({
      where: { id: student.personId },
      data: { ...personData, rowVersion: { increment: 1 } },
    });
  }
}

export async function listProgramsLite(institutionId: string) {
  const rows = await prisma.program.findMany({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map((p) => ({ id: p.id, code: p.code, name: p.name })) };
}

export async function listStudentsLite(institutionId: string) {
  const rows = await prisma.student.findMany({
    where: { institutionId },
    include: { person: true },
    orderBy: { studentNumber: "asc" },
    take: 500,
  });
  return {
    items: rows.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      name: `${s.person.givenName} ${s.person.familyName}`,
      programName: s.programName,
      cohortId: s.cohortId,
    })),
  };
}

export async function listSectionsLite(institutionId: string) {
  const rows = await prisma.section.findMany({
    where: { institutionId },
    include: { course: true },
    orderBy: { code: "asc" },
    take: 300,
  });
  return {
    items: rows.map((s) => ({
      id: s.id,
      code: s.code,
      courseCode: s.course.code,
      courseTitle: s.course.title,
    })),
  };
}

export async function listFinancialTerms(institutionId: string) {
  const rows = await prisma.financialTerm.findMany({
    where: { institutionId },
    orderBy: { startsOn: "desc" },
  });
  return {
    items: rows.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      startsOn: t.startsOn,
      endsOn: t.endsOn,
    })),
  };
}
