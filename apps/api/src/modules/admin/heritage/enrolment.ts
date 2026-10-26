/* Section enrolment shared by every enrolment path: seat / waitlist rules and the optional course fee posted with it. */

import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { S as CM, settingsOf } from "./courses.js";
import {
  EPS,
  assertPeriodOpen,
  cad,
  ensureFinancialTerm,
  finAudit,
  httpError,
  loadConfig,
  nameOf,
  num,
  postEntry,
  r2,
  requireStudent,
  s,
  type Config,
  type Data,
  type Db,
} from "./finance.core.js";
import { termLabel, type TermRef } from "../../../lib/sectionTerm.js";
import { loadSectionTerms } from "../../instructor/myCoursesFacts.js";
import { feeTotals, isInternational } from "./finance.ledger.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { studentMetaMap } from "../superAdmin.service.js";
import { studentStatusPolicy } from "./students.core.js";
import { assertNoActiveStudentHold } from "../../me/studentAlignment.js";

export type SeatRule = { capacity: number | null; waitlist: boolean; waitlistSize: number | null };
export type SeatStatus = "enrolled" | "waitlisted";

const blank = (v: unknown) => v === null || v === undefined || v === "";

/** Seat rule from the section's session settings (Maximum Enrolments, Enrolment Waitlist, Wait List Size). */
export function seatRule(st: Data | undefined): SeatRule {
  const capacity = !st || blank(st.maxEnrolments) ? null : Math.max(0, Math.floor(num(st.maxEnrolments)));
  const waitlistSize = !st || blank(st.waitlistSize) ? null : Math.max(0, Math.floor(num(st.waitlistSize)));
  return { capacity, waitlist: s(st?.waitlist || "Enabled") !== "Disabled", waitlistSize };
}

/** Enrolled while seats remain, waitlisted when the section is full and its waitlist is open, otherwise refused (409). */
export function seatDecision(rule: SeatRule, counts: { enrolled: number; waitlisted: number }, label: string): SeatStatus {
  if (rule.capacity === null || counts.enrolled < rule.capacity) return "enrolled";
  if (!rule.waitlist) throw httpError(409, `${label} is full (${counts.enrolled}/${rule.capacity} enrolled) and its waitlist is disabled`, "SECTION_FULL");
  if (rule.waitlistSize !== null && counts.waitlisted >= rule.waitlistSize) throw httpError(409, `${label} is full (${counts.enrolled}/${rule.capacity} enrolled) and its waitlist is full (${counts.waitlisted}/${rule.waitlistSize})`, "WAITLIST_FULL");
  return "waitlisted";
}

export type CourseFeeQuote = { amount: number; included: boolean; source: "session" | "course" | "none"; domestic: number; international: number };

/**
 * Course cost for a student: the session fee when the session is not covered by program tuition, else the course cost
 * (per credit / per hour as configured) when the course is not covered, else nothing (tuition is part of the program cost).
 */
export function courseFeeQuote(course: Data | undefined, session: Data | undefined, credits: number, international: boolean): CourseFeeQuote {
  if (session && session.tuitionIncluded === false) {
    const domestic = r2(num(session.domestic));
    const intl = r2(num(session.international));
    return { amount: international ? intl : domestic, included: false, source: "session", domestic, international: intl };
  }
  if (course && course.tuitionIncluded === false) {
    const calc = s(course.costCalculation);
    const factor = calc === "Per Credit" ? num(course.credits) || credits : calc === "Per Hour" ? num(course.totalHours) : 1;
    const domestic = r2(num(course.domestic) * factor);
    const intl = r2(num(course.international) * factor);
    return { amount: international ? intl : domestic, included: false, source: "course", domestic, international: intl };
  }
  return { amount: 0, included: true, source: "none", domestic: 0, international: 0 };
}

type LoadedSection = NonNullable<Awaited<ReturnType<typeof loadSection>>>;

function loadSection(inst: string, sectionId: string) {
  return prisma.section.findFirst({ where: { id: sectionId, institutionId: inst }, include: { course: true, term: true } });
}

async function sectionOr404(inst: string, sectionId: string) {
  const section = await loadSection(inst, sectionId);
  if (!section) throw httpError(404, "Section not found", "NOT_FOUND");
  return section;
}

async function settingsFor(inst: string, section: { id: string; courseId: string }) {
  const [ss, cs] = await Promise.all([settingsOf(inst, CM.session, [section.id]), settingsOf(inst, CM.courseSettings, [section.courseId])]);
  return { session: ss.get(section.id)?.data, course: cs.get(section.courseId)?.data };
}

async function seatCounts(db: Db, sectionId: string) {
  const [enrolled, waitlisted] = await Promise.all([
    db.enrolment.count({ where: { sectionId, status: "enrolled" } }),
    db.enrolment.count({ where: { sectionId, status: "waitlisted" } }),
  ]);
  return { enrolled, waitlisted };
}

/** What the "Post course fee" option would charge this student for the section, with the section's seat position. */
export async function quoteSectionFee(inst: string, sectionId: string, studentId?: string | null) {
  const section = await sectionOr404(inst, sectionId);
  const { session, course } = await settingsFor(inst, section);
  const st = studentId ? await requireStudent(inst, studentId) : null;
  const quote = courseFeeQuote(course, session, section.course.credits, st ? isInternational(st) : false);
  const term = (await loadSectionTerms(inst, [section])).get(section.id);
  return {
    sectionId: section.id,
    label: `${section.course.code} ${section.code}`,
    termName: termLabel(term),
    rateCategory: st?.rateCategory ?? null,
    ...quote,
    seats: { ...seatRule(session), ...(await seatCounts(prisma, section.id)) },
  };
}

function courseFeeType(cfg: Config) {
  return cfg.ledgerTypes.find((t) => /course\s*fee/i.test(nameOf(t))) ?? cfg.ledgerTypes.find((t) => /tuition/i.test(nameOf(t)));
}

export type EnrolOptions = {
  /** Post each section's course fee to the student's ledger in the same transaction as the enrolment. */
  postFee?: boolean;
  source: string;
  /** Leave an existing active enrolment in place instead of refusing (program enrolment). */
  skipExisting?: boolean;
  notify?: boolean;
};

export type EnrolResult = {
  enrolmentId: string;
  sectionId: string;
  studentId: string;
  courseCode: string;
  sectionCode: string;
  status: SeatStatus | "existing";
  fee: { id: string; number: number; amount: number } | null;
  feeNote: string | null;
};

type Plan = { section: LoadedSection; term: TermRef | null; label: string; rule: SeatRule; meetingDays: string[]; fee: number; feeNote: string | null };

type Requirement = { courseId: string; requiredCourseId: string; requiredCode: string; requiredTitle: string };

/** Returns human-readable missing prerequisite/corequisite requirements for the requested courses. */
export function missingCourseRequirements(
  requestedCourseIds: Set<string>,
  completedCourseIds: Set<string>,
  activeCourseIds: Set<string>,
  prerequisites: Requirement[],
  corequisites: Requirement[],
) {
  const missingPrerequisites = prerequisites.filter((r) => requestedCourseIds.has(r.courseId) && !completedCourseIds.has(r.requiredCourseId));
  const availableCorequisites = new Set([...completedCourseIds, ...activeCourseIds, ...requestedCourseIds]);
  const missingCorequisites = corequisites.filter((r) => requestedCourseIds.has(r.courseId) && !availableCorequisites.has(r.requiredCourseId));
  return { missingPrerequisites, missingCorequisites };
}

async function assertCourseRequirements(inst: string, studentId: string, plans: Plan[]) {
  const requestedCourseIds = new Set(plans.map((p) => p.section.courseId));
  const [prereqRows, coreqRows, history, transfers] = await Promise.all([
    prisma.coursePrerequisite.findMany({
      where: { institutionId: inst, courseId: { in: [...requestedCourseIds] } },
      include: { prerequisiteCourse: { select: { code: true, title: true } } },
    }),
    prisma.courseCorequisite.findMany({
      where: { institutionId: inst, courseId: { in: [...requestedCourseIds] } },
      include: { corequisiteCourse: { select: { code: true, title: true } } },
    }),
    prisma.enrolment.findMany({
      where: { institutionId: inst, studentId, status: { in: ["completed", "enrolled"] } },
      include: { section: { select: { courseId: true } } },
    }),
    prisma.transferCredit.findMany({
      where: { institutionId: inst, studentId, status: "accepted", courseId: { not: null } },
      select: { courseId: true },
    }),
  ]);
  const completed = new Set([
    ...history.filter((e) => e.status === "completed").map((e) => e.section.courseId),
    ...transfers.map((t) => t.courseId).filter((id): id is string => Boolean(id)),
  ]);
  const active = new Set(history.filter((e) => e.status === "enrolled").map((e) => e.section.courseId));
  const prerequisites = prereqRows.map((r) => ({ courseId: r.courseId, requiredCourseId: r.prerequisiteCourseId, requiredCode: r.prerequisiteCourse.code, requiredTitle: r.prerequisiteCourse.title }));
  const corequisites = coreqRows.map((r) => ({ courseId: r.courseId, requiredCourseId: r.corequisiteCourseId, requiredCode: r.corequisiteCourse.code, requiredTitle: r.corequisiteCourse.title }));
  const missing = missingCourseRequirements(requestedCourseIds, completed, active, prerequisites, corequisites);
  if (missing.missingPrerequisites.length || missing.missingCorequisites.length) {
    const parts = [
      ...missing.missingPrerequisites.map((r) => `prerequisite ${r.requiredCode} ${r.requiredTitle}`),
      ...missing.missingCorequisites.map((r) => `corequisite ${r.requiredCode} ${r.requiredTitle}`),
    ];
    throw httpError(409, `Cannot enrol: missing ${[...new Set(parts)].join(", ")}`, "COURSE_REQUIREMENTS_NOT_MET");
  }
}

const recordData = (raw: string) => {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {};
  } catch {
    return {};
  }
};

const configuredLimit = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

/** Applies the selected student's configured programme enrolment limits before seats or money are changed. */
async function assertProgramLimits(inst: string, studentId: string, plans: Plan[]) {
  const profile = await prisma.heritageRecord.findFirst({
    where: { institutionId: inst, screenId: "STU:PROFILE", contextKey: studentId, singletonKey: "profile", deletedAt: null },
    select: { dataJson: true },
  });
  const programId = s(recordData(profile?.dataJson || "{}").programId);
  if (!programId) return;
  const program = await prisma.heritageRecord.findFirst({
    where: { id: programId, institutionId: inst, screenId: "PM:PROGRAM", deletedAt: null },
    select: { dataJson: true },
  });
  if (!program) return;
  const settings = recordData(program.dataJson);
  const history = await prisma.enrolment.findMany({
    where: { institutionId: inst, studentId },
    include: { section: { include: { course: true } } },
  });
  const maxAttempts = configuredLimit(settings.maxCourseAttempts);
  const repeatCredited = s(settings.repeatCredited);
  const requestedCourseIds = new Set(plans.map((plan) => plan.section.courseId));
  for (const plan of plans) {
    const attempts = history.filter((row) => row.section.courseId === plan.section.courseId && row.status !== "waitlisted");
    if (maxAttempts !== null && attempts.length >= maxAttempts) {
      throw httpError(409, `Cannot enrol in ${plan.label}: programme limit of ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} reached`, "PROGRAM_ATTEMPT_LIMIT");
    }
    const credited = attempts.filter((row) => row.creditAwarded || row.status === "completed").length;
    if (credited && repeatCredited === "Disable self-enrolment") {
      throw httpError(409, `Cannot enrol in ${plan.label}: repeating a credited course requires staff approval`, "PROGRAM_REPEAT_RESTRICTED");
    }
    const creditedLimit = /^(\d+) Attempt/.exec(repeatCredited)?.[1];
    if (creditedLimit && attempts.length >= Number(creditedLimit)) {
      throw httpError(409, `Cannot enrol in ${plan.label}: credited-course repeat limit reached`, "PROGRAM_REPEAT_LIMIT");
    }
  }
  if (s(settings.repeatFailed) === "Must enrol") {
    const failedCourses = new Map(
      history
        .filter((row) => row.status === "completed" && !row.creditAwarded)
        .map((row) => [row.section.courseId, row.section.course.code] as const),
    );
    const omitted = [...failedCourses].filter(([courseId]) => !requestedCourseIds.has(courseId)).map(([, code]) => code);
    if (omitted.length) {
      throw httpError(409, `Cannot enrol: failed programme course${omitted.length === 1 ? "" : "s"} must be repeated first (${omitted.join(", ")})`, "PROGRAM_FAILED_REPEAT_REQUIRED");
    }
  }
  const maxEnrolled = configuredLimit(settings.maxEnrolledCourses);
  if (maxEnrolled !== null) {
    const unit = s(settings.maxEnrolledUnit) || "Courses";
    for (const termId of new Set(plans.map((plan) => plan.section.termId))) {
      const current = history.filter((row) => row.status === "enrolled" && row.section.termId === termId);
      const requested = plans.filter((plan) => plan.section.termId === termId);
      const total = unit === "Credits"
        ? current.reduce((sum, row) => sum + row.section.course.credits, 0) + requested.reduce((sum, plan) => sum + plan.section.course.credits, 0)
        : current.length + requested.length;
      if (total > maxEnrolled) {
        throw httpError(409, `Cannot enrol: programme maximum is ${maxEnrolled} ${unit.toLowerCase()} per term`, "PROGRAM_ENROLMENT_LIMIT");
      }
    }
  }
  const maxPerDay = configuredLimit(settings.maxEnrolledPerDay);
  if (maxPerDay !== null) {
    const active = history.filter((row) => row.status === "enrolled");
    const activeSettings = await settingsOf(inst, CM.session, active.map((row) => row.sectionId));
    const counts = new Map<string, number>();
    for (const row of active) {
      const days = new Set(
        (Array.isArray(activeSettings.get(row.sectionId)?.data.meetings) ? activeSettings.get(row.sectionId)!.data.meetings as Data[] : [])
          .map((meeting) => s(meeting.day)).filter(Boolean),
      );
      for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    for (const plan of plans) for (const day of new Set(plan.meetingDays)) counts.set(day, (counts.get(day) ?? 0) + 1);
    const exceeded = [...counts].find(([, count]) => count > maxPerDay);
    if (exceeded) throw httpError(409, `Cannot enrol: programme maximum is ${maxPerDay} courses on ${exceeded[0]}`, "PROGRAM_DAILY_LIMIT");
  }
}

/**
 * Enrols a student in one or more sections under the per-student money lock. Every seat check, enrolment and optional
 * course fee is written in a single transaction (all or nothing), serialised per section so two enrolments cannot
 * both take the last seat.
 */
export async function enrolInSections(user: SessionClaims, studentId: string, sectionIds: string[], opts: EnrolOptions): Promise<EnrolResult[]> {
  const inst = user.institutionId;
  const ids = [...new Set(sectionIds.filter(Boolean))].sort();
  if (!ids.length) return [];
  const student = await prisma.student.findFirst({ where: { id: studentId, institutionId: inst } });
  if (!student) throw httpError(404, "Student not found", "NOT_FOUND");
  const meta = (await studentMetaMap(inst))[student.id] ?? {};
  const policy = await studentStatusPolicy(inst, s(meta.status));
  if (policy && !policy.enablesRegistration) throw httpError(409, `Student status "${policy.name}" does not allow course registration`, "STUDENT_STATUS_BLOCKS_REGISTRATION");
  await assertNoActiveStudentHold(inst, student.id, "Course enrolment");
  const info = opts.postFee ? await requireStudent(inst, student.id) : null;
  const plans: Plan[] = [];
  for (const id of ids) {
    const section = await sectionOr404(inst, id);
    const { session, course } = await settingsFor(inst, section);
    const label = `${section.course.code} ${section.code}`;
    let fee = 0;
    let feeNote: string | null = null;
    if (info) {
      const quote = courseFeeQuote(course, session, section.course.credits, isInternational(info));
      if (quote.amount >= EPS) fee = quote.amount;
      else feeNote = quote.included ? `${label} tuition is included in the program cost; no course fee was posted.` : `${label} has no course cost set; no course fee was posted.`;
    }
    const meetingDays = (Array.isArray(session?.meetings) ? session.meetings as Data[] : []).map((meeting) => s(meeting.day)).filter(Boolean);
    plans.push({ section, term: null, label, rule: seatRule(session), meetingDays, fee, feeNote });
  }
  await Promise.all([
    assertCourseRequirements(inst, student.id, plans),
    assertProgramLimits(inst, student.id, plans),
  ]);
  if (plans.some((p) => p.fee >= EPS)) {
    const terms = await loadSectionTerms(inst, plans.map((p) => p.section));
    for (const p of plans) p.term = terms.get(p.section.id) ?? null;
  }
  let cfg: Config | null = null;
  if (info && plans.some((p) => p.fee >= EPS)) {
    cfg = await loadConfig(inst);
    await assertPeriodOpen(user, cfg, info.campus, new Date(), "This course fee");
  }
  const type = cfg ? courseFeeType(cfg) : undefined;
  const typeName = type ? nameOf(type) : "Course Fee";

  const written = await withStudentMoneyLock(inst, student.id, () =>
    prisma.$transaction(async (tx) => {
      const out: Array<{ plan: Plan; enrolmentId: string; status: SeatStatus | "existing"; fee: EnrolResult["fee"] }> = [];
      for (const plan of plans) {
        const { section, label } = plan;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`section-seats:${section.id}`}))`;
        const existing = await tx.enrolment.findFirst({ where: { institutionId: inst, sectionId: section.id, studentId: student.id }, orderBy: { attemptNumber: "desc" } });
        if (existing && existing.status !== "withdrawn") {
          if (opts.skipExisting) {
            out.push({ plan, enrolmentId: existing.id, status: "existing", fee: null });
            continue;
          }
          throw httpError(409, existing.status === "waitlisted" ? `The student is already on the waitlist for ${label}` : `The student is already enrolled in ${label}`, "ALREADY_ENROLLED");
        }
        const status = seatDecision(plan.rule, await seatCounts(tx, section.id), label);
        const enrolment = existing
          ? await tx.enrolment.update({ where: { id: existing.id }, data: { status, rowVersion: { increment: 1 } } })
          : await tx.enrolment.create({ data: { institutionId: inst, sectionId: section.id, studentId: student.id, status } });
        let fee: EnrolResult["fee"] = null;
        if (plan.fee >= EPS && status === "enrolled") {
          const term = plan.term ? await ensureFinancialTerm(inst, plan.term, tx) : null;
          const totals = feeTotals(cfg!, type, plan.fee, 1, info!);
          const { entry, number } = await postEntry(
            user,
            {
              studentId: student.id,
              kind: "charge",
              label: `${typeName} · ${label}`,
              amount: totals.total,
              termId: term?.id ?? null,
              note: `Course fee for ${section.course.code} ${section.course.title} (${section.code}), ${termLabel(plan.term)}`,
              courseId: section.courseId,
              sectionId: section.id,
            },
            { ledgerTypeId: type?.id ?? "", unitAmount: plan.fee, quantity: 1, subtotal: totals.subtotal, taxes: totals.taxes, paymentStatus: "Not Paid", courseId: section.courseId, sectionId: section.id, enrolmentId: enrolment.id, courseLabel: label },
            tx,
          );
          fee = { id: entry.id, number, amount: totals.total };
        } else if (plan.fee >= EPS) plan.feeNote = `${label} is full, so the student was waitlisted; post the course fee when a seat is confirmed.`;
        const after = { enrolmentId: enrolment.id, sectionId: section.id, studentId: student.id, status, feeEntryId: fee?.id ?? null };
        await writeAuditAndOutbox(tx, {
          institutionId: inst,
          actorId: user.accountId,
          eventName: status === "waitlisted" ? "Enrolment.waitlisted" : "Enrolment.created",
          purpose: "admin_mutation",
          before: existing ? { enrolmentId: existing.id, status: existing.status } : null,
          after,
          source: opts.source,
          correlationId: randomUUID(),
          outboxPayload: after,
        });
        out.push({ plan, enrolmentId: enrolment.id, status, fee });
      }
      return out;
    }),
  );

  for (const w of written)
    if (w.fee) await finAudit(user, student.id, "Receivable added", `Receivable #${w.fee.number}`, { type: `${typeName} · ${w.plan.label}`, amount: cad(w.fee.amount), quantity: 1, taxes: "None", note: "Posted with the course enrolment" }, w.fee.id);
  if (written.some((w) => w.fee)) {
    const { applyAutomatedPromotions } = await import("./finance.records.js");
    await applyAutomatedPromotions(user, student.id);
  }
  const fresh = written.filter((w) => w.status !== "existing");
  if (opts.notify !== false && fresh.length) {
    const account = await prisma.account.findFirst({ where: { institutionId: inst, personId: student.personId } });
    if (account)
      for (const w of fresh) {
        const { section } = w.plan;
        const waitlisted = w.status === "waitlisted";
        await prisma.notification.create({
          data: {
            institutionId: inst,
            recipientAccountId: account.id,
            channel: "in_app",
            title: `${waitlisted ? "Waitlisted" : "Enrolled"} · ${section.course.code}`,
            body: waitlisted ? `You are on the waitlist for ${section.code} ${section.course.title}.` : `You are enrolled in ${section.code} ${section.course.title}.`,
            templateKey: waitlisted ? "enrolment.waitlisted" : "enrolment.created",
          },
        });
      }
  }
  return written.map((w) => ({
    enrolmentId: w.enrolmentId,
    sectionId: w.plan.section.id,
    studentId: student.id,
    courseCode: w.plan.section.course.code,
    sectionCode: w.plan.section.code,
    status: w.status,
    fee: w.fee,
    feeNote: w.status === "existing" ? null : w.plan.feeNote,
  }));
}

export async function enrolInSection(user: SessionClaims, input: EnrolOptions & { studentId: string; sectionId: string }): Promise<EnrolResult> {
  const [result] = await enrolInSections(user, input.studentId, [input.sectionId], input);
  return result!;
}

/** Seat check for paths that create enrolments inside their own transaction (retakes, instructor-created profiles). */
export async function assertSeat(db: Db, inst: string, sectionId: string, label: string): Promise<SeatStatus> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`section-seats:${sectionId}`}))`;
  const st = (await settingsOf(inst, CM.session, [sectionId])).get(sectionId)?.data;
  return seatDecision(seatRule(st), await seatCounts(db, sectionId), label);
}

/** Promotes the oldest waitlisted student when a section seat becomes available. */
export async function promoteWaitlisted(user: SessionClaims, sectionId: string) {
  const inst = user.institutionId;
  const section = await sectionOr404(inst, sectionId);
  const { session } = await settingsFor(inst, section);
  const rule = seatRule(session);
  const first = await prisma.enrolment.findFirst({
    where: { institutionId: inst, sectionId, status: "waitlisted" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!first) return null;
  const promoted = await withStudentMoneyLock(inst, first.studentId, () =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`section-seats:${sectionId}`}))`;
      const counts = await seatCounts(tx, sectionId);
      if (rule.capacity !== null && counts.enrolled >= rule.capacity) return null;
      const candidate = await tx.enrolment.findFirst({
        where: { institutionId: inst, sectionId, status: "waitlisted" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (!candidate) return null;
      const claimed = await tx.enrolment.updateMany({
        where: { id: candidate.id, status: "waitlisted", rowVersion: candidate.rowVersion },
        data: { status: "enrolled", rowVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) return null;
      const after = { enrolmentId: candidate.id, sectionId, studentId: candidate.studentId, status: "enrolled" };
      await writeAuditAndOutbox(tx, {
        institutionId: inst,
        actorId: user.accountId,
        eventName: "Enrolment.waitlist_promoted",
        purpose: "admin_mutation",
        before: { status: "waitlisted" },
        after,
        source: "enrolment.waitlist",
        correlationId: randomUUID(),
        outboxPayload: { ...after, title: `Waitlist seat confirmed · ${section.course.code}`, body: `A seat opened and you are now enrolled in ${section.code} ${section.course.title}.` },
      });
      const promotedStudent = await tx.student.findFirst({ where: { id: candidate.studentId, institutionId: inst }, select: { personId: true } });
      const account = promotedStudent ? await tx.account.findFirst({ where: { institutionId: inst, personId: promotedStudent.personId }, select: { id: true } }) : null;
      if (account) {
        await tx.notification.create({
          data: {
            institutionId: inst,
            recipientAccountId: account.id,
            channel: "in_app",
            title: `Waitlist seat confirmed · ${section.course.code}`,
            body: `A seat opened and you are now enrolled in ${section.code} ${section.course.title}.`,
            templateKey: "enrolment.waitlist_promoted",
          },
        });
      }
      return candidate;
    }),
  );
  if (!promoted) return null;
  return { enrolmentId: promoted.id, studentId: promoted.studentId, sectionId };
}
