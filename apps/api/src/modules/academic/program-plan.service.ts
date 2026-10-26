import { prisma } from "@myheritage/db";
import { courseStatus, gradePointsOrNull, hasFinalMark, passingLetter, type CourseStatus } from "../../lib/courseStatus.js";
import { institutionTerms, sectionTerm, termLabel } from "../../lib/sectionTerm.js";
import { ymdIn } from "../../lib/workshopPolicy.js";
import { sectionOfferings } from "../courses/sectionOffering.js";
import {
  DEFAULT_TZ,
  dateBoundsFromSessions,
  instructorDisplayName,
  roomFromSessions,
  scheduleTextFromSessions,
} from "../courses/sectionSchedule.js";

function letterFromPct(p: number | null) {
  if (p == null) return "—";
  if (p >= 90) return "A";
  if (p >= 85) return "A-";
  if (p >= 80) return "B+";
  if (p >= 75) return "B";
  if (p >= 70) return "B-";
  if (p >= 65) return "C+";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  return "F";
}

function displayLetter(row: {
  status: string;
  letter: string;
  averagePercent: number | null;
}) {
  if (row.status === "enrolled" && (row.averagePercent == null || row.letter === "—")) return "IP";
  if (row.status === "withdrawn") return row.letter === "—" ? "W" : row.letter;
  return row.letter === "—" ? (row.averagePercent == null ? "I" : letterFromPct(row.averagePercent)) : row.letter;
}

export { hasFinalMark };

type CourseHistory = Awaited<ReturnType<typeof getCourseHistory>>;
type HistoryRow = CourseHistory["all"][number];
type FactsRow = Pick<HistoryRow, "courseId" | "courseCode" | "status" | "courseStatus" | "attemptNumber" | "startsOn" | "endsOn" | "scheduleText" | "sectionId" | "letter" | "averagePercent">;

const STATUS_RANK: Record<CourseStatus, number> = { completed: 0, failed: 1, in_progress: 2, not_started: 3, dropped: 4 };

/**
 * What the student's enrolments say about one plan course: the latest non-dropped attempt (a dropped attempt only
 * when nothing else exists) with its status, the section's dates / timetable, and the final grade once completed.
 * Null when the student never enrolled in the course.
 */
export function planItemFacts(course: { courseId?: string | null; courseCode: string }, rows: FactsRow[]) {
  const code = course.courseCode.trim().toUpperCase();
  const mine = rows.filter((r) => r.status !== "waitlisted" && ((course.courseId && r.courseId === course.courseId) || r.courseCode.trim().toUpperCase() === code));
  if (!mine.length) return null;
  const best = [...mine].sort(
    (a, b) => Number(a.courseStatus === "dropped") - Number(b.courseStatus === "dropped") || b.attemptNumber - a.attemptNumber || STATUS_RANK[a.courseStatus] - STATUS_RANK[b.courseStatus],
  )[0]!;
  return {
    status: best.courseStatus,
    startsOn: best.startsOn ?? null,
    endsOn: best.endsOn ?? null,
    scheduleText: best.scheduleText ?? null,
    sectionId: best.sectionId,
    grade: best.courseStatus === "completed" || best.courseStatus === "failed" ? displayLetter({ ...best, status: "completed" }) : null,
  };
}

export type PlanCourse = { courseId: string | null; courseCode: string; title: string; credits: number; sortOrder: number; category: string };

/** Plan rows for a list of program courses, filled from real enrolments (Not Started with the fallback dates otherwise). */
export function planItemRows<T extends PlanCourse>(courses: T[], rows: FactsRow[], fallback: { startsOn: string | null; endsOn: string | null }) {
  return courses.map((c) => {
    const f = planItemFacts(c, rows);
    return {
      ...c,
      status: f?.status ?? ("not_started" as CourseStatus),
      startsOn: f ? f.startsOn : fallback.startsOn,
      endsOn: f ? f.endsOn : fallback.endsOn,
      scheduleText: f?.scheduleText ?? null,
      sectionId: f?.sectionId ?? null,
    };
  });
}

/**
 * Creates the student's active program plan from their program version's requirements, or brings an existing plan's
 * rows in line with their enrolments (adding missing program courses). Safe to call repeatedly; returns null when
 * the student has no program version with requirements.
 */
export async function ensureStudentProgramPlan(institutionId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    select: {
      cohortId: true,
      cohort: { select: { startDate: true, endDate: true } },
      programVersion: { select: { requirements: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  const requirements = student?.programVersion?.requirements ?? [];
  if (!student || !requirements.length) return null;
  const history = await getCourseHistory(institutionId, studentId);
  const courses: PlanCourse[] = requirements.map((r, i) => ({ courseId: r.courseId, courseCode: r.courseCode, title: r.title, credits: r.credits, sortOrder: r.sortOrder ?? i, category: "main" }));
  const rows = planItemRows(courses, history.all, { startsOn: student.cohort?.startDate ?? null, endsOn: student.cohort?.endDate ?? null });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.programPlan.findFirst({ where: { institutionId, studentId, status: "active" }, include: { items: true } });
    if (!existing) {
      const created = await tx.programPlan.create({
        data: { institutionId, studentId, cohortId: student.cohortId, status: "active", items: { create: rows.map((r) => ({ institutionId, ...r })) } },
      });
      return { planId: created.id, created: true };
    }
    for (const r of rows) {
      const item = existing.items.find((i) => i.category === r.category && ((r.courseId && i.courseId === r.courseId) || i.courseCode === r.courseCode));
      if (!item) {
        await tx.programPlanItem.create({ data: { institutionId, planId: existing.id, ...r } });
        continue;
      }
      const facts = { status: r.status, startsOn: r.startsOn, endsOn: r.endsOn, scheduleText: r.scheduleText, sectionId: r.sectionId };
      const linked = Boolean(r.sectionId);
      const changed = linked ? (Object.keys(facts) as Array<keyof typeof facts>).some((k) => item[k] !== facts[k]) : false;
      if (changed) await tx.programPlanItem.update({ where: { id: item.id }, data: { ...facts, rowVersion: { increment: 1 } } });
    }
    const inProgram = (i: { courseId: string | null; courseCode: string }) => rows.some((r) => (r.courseId && i.courseId === r.courseId) || i.courseCode === r.courseCode);
    const stale = existing.items.filter((i) => i.category === "main" && i.status === "not_started" && !inProgram(i) && !planItemFacts(i, history.all)).map((i) => i.id);
    if (stale.length) await tx.programPlanItem.deleteMany({ where: { id: { in: stale }, planId: existing.id } });
    return { planId: existing.id, created: false };
  });
}

export async function getProgramPlan(institutionId: string, studentId: string, known?: CourseHistory) {
  const [plan, student] = await Promise.all([
    prisma.programPlan.findFirst({
      where: { institutionId, studentId, status: "active" },
      include: {
        cohort: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.student.findFirst({
      where: { institutionId, id: studentId },
      select: { cohort: true },
    }),
  ]);
  if (!plan) {
    return {
      planId: null as string | null,
      status: "missing",
      cohort: student?.cohort
        ? {
            code: student.cohort.code,
            label: student.cohort.label,
            intakeYear: student.cohort.intakeYear,
            intakeMonth: student.cohort.intakeMonth,
            sectionLabel: student.cohort.sectionLabel,
          }
        : null,
      summary: {
        totalCredits: 0,
        earnedCredits: 0,
        averagePercent: null as number | null,
        cgpa: null as number | null,
        completed: 0,
        failed: 0,
        inProgress: 0,
        notStarted: 0,
        dropped: 0,
      },
      main: [] as Array<Record<string, unknown>>,
      practicum: [] as Array<Record<string, unknown>>,
      makeup: [] as Array<Record<string, unknown>>,
    };
  }

  const courseIds = [...new Set(plan.items.map((i) => i.courseId).filter(Boolean))] as string[];
  const courseCodes = [...new Set(plan.items.map((i) => i.courseCode).filter(Boolean))];
  const courses = await prisma.course.findMany({
    where: {
      institutionId,
      OR: [
        ...(courseIds.length ? [{ id: { in: courseIds } }] : []),
        ...(courseCodes.length ? [{ code: { in: courseCodes } }] : []),
      ],
    },
    select: { id: true, code: true, title: true },
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const history = known ?? (await getCourseHistory(institutionId, studentId));

  const looksLikeId = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()) ||
    value.trim().length > 40;

  const mapItem = (item: (typeof plan.items)[number]) => {
    const fromCourse =
      (item.courseId ? courseById.get(item.courseId) : undefined) || courseByCode.get(item.courseCode);
    const rawTitle = (item.title || "").trim();
    const title =
      fromCourse?.title ||
      (!rawTitle || looksLikeId(rawTitle) || rawTitle === item.courseCode || rawTitle === item.courseId
        ? fromCourse?.title || item.courseCode
        : rawTitle);
    const courseCode = fromCourse?.code || item.courseCode;
    const live = planItemFacts({ courseId: item.courseId ?? fromCourse?.id, courseCode }, history.all);
    return {
      id: item.id,
      courseCode,
      title,
      credits: item.credits,
      category: item.category,
      status: live?.status ?? item.status,
      grade: live?.grade ?? null,
      startsOn: live ? live.startsOn : item.startsOn,
      endsOn: live ? live.endsOn : item.endsOn,
      scheduleText: live ? live.scheduleText : item.scheduleText,
      sectionId: live?.sectionId ?? item.sectionId,
      sortOrder: item.sortOrder,
    };
  };

  const items = plan.items.map(mapItem);
  const main = items.filter((i) => i.category === "main");
  const practicum = items.filter((i) => i.category === "practicum");
  const makeup = items.filter((i) => i.category === "makeup");

  const earnedCredits = items.filter((i) => i.status === "completed").reduce((n, i) => n + i.credits, 0);
  const totalCredits = items.reduce((n, i) => n + i.credits, 0);
  const { averagePercent, cgpa } = summarizeCourses(transcriptCourses(history, ""));
  const cohort = plan.cohort ?? student?.cohort ?? null;

  return {
    planId: plan.id,
    status: plan.status,
    cohort: cohort
      ? {
          code: cohort.code,
          label: cohort.label,
          intakeYear: cohort.intakeYear,
          intakeMonth: cohort.intakeMonth,
          sectionLabel: cohort.sectionLabel,
        }
      : null,
    summary: {
      totalCredits,
      earnedCredits,
      averagePercent,
      cgpa,
      completed: items.filter((i) => i.status === "completed").length,
      failed: items.filter((i) => i.status === "failed").length,
      inProgress: items.filter((i) => i.status === "in_progress").length,
      notStarted: items.filter((i) => i.status === "not_started").length,
      dropped: items.filter((i) => i.status === "dropped").length,
    },
    main,
    practicum,
    makeup,
  };
}

/**
 * Course mark used by every role: published scores weighted by assignment weight, the same formula as the instructor
 * gradebook total and the student's course grades page. Falls back to an even weighting when no weights are set.
 */
export function weightedPercent(items: Array<{ score: number | null; maxScore: number; weightPercent?: number | null }>) {
  const scored = items.filter((g) => g.score != null && g.maxScore > 0);
  if (!scored.length) return null;
  const weight = scored.reduce((n, g) => n + Math.max(Number(g.weightPercent) || 0, 0), 0);
  const pct = weight
    ? scored.reduce((n, g) => n + ((g.score ?? 0) / g.maxScore) * Math.max(Number(g.weightPercent) || 0, 0), 0) / weight
    : scored.reduce((n, g) => n + (g.score ?? 0) / g.maxScore, 0) / scored.length;
  return Number((pct * 100).toFixed(1));
}

/** One enrolment's weighted percent and letter from its published grades (a single published grade keeps its own letter). */
export function enrolmentMark(
  status: string,
  gradeItems: Array<{ score: number | null; maxScore: number; letter: string | null; assignment: { weightPercent: number | null } }>,
) {
  const published = gradeItems.filter((g) => g.score != null && g.maxScore > 0);
  const averagePercent = weightedPercent(published.map((g) => ({ score: g.score, maxScore: g.maxScore, weightPercent: g.assignment.weightPercent })));
  const explicit = published.length === 1 ? published[0]!.letter : null;
  const letter = explicit || (averagePercent != null ? letterFromPct(averagePercent) : status === "withdrawn" ? "W" : "—");
  return { averagePercent, letter };
}

/** Credit-weighted mean; an all-zero-credit set falls back to a plain mean. */
export function creditWeighted(rows: Array<{ credits: number; value: number }>) {
  if (!rows.length) return null;
  const credits = rows.reduce((n, r) => n + Math.max(r.credits, 0), 0);
  const v = credits ? rows.reduce((n, r) => n + r.value * Math.max(r.credits, 0), 0) / credits : rows.reduce((n, r) => n + r.value, 0) / rows.length;
  return Number(v.toFixed(2));
}

export async function getCourseHistory(institutionId: string, studentId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId, studentId },
    include: {
      section: {
        include: {
          course: true,
          term: true,
          academicBlock: true,
          classSessions: { orderBy: { startsAt: "asc" } },
        },
      },
      gradeItems: { where: { status: "published" }, include: { assignment: { select: { weightPercent: true } } } },
    },
    orderBy: [{ attemptNumber: "asc" }, { createdAt: "desc" }],
  });
  const [offerings, institution, terms] = await Promise.all([
    sectionOfferings(institutionId, [...new Set(enrolments.map((e) => e.sectionId))]),
    prisma.institution.findFirst({ where: { id: institutionId }, select: { timezone: true } }),
    institutionTerms(institutionId),
  ]);
  const tz = institution?.timezone || DEFAULT_TZ;
  const today = ymdIn(new Date(), tz);

  const instructorIds = [...new Set(enrolments.map((e) => e.section.instructorPersonId))];
  const instructors = await prisma.person.findMany({
    where: { id: { in: instructorIds }, institutionId },
  });
  const instructorById = new Map(instructors.map((p) => [p.id, p]));

  const planItems = await prisma.programPlanItem.findMany({
    where: {
      institutionId,
      plan: { studentId, institutionId },
      OR: [
        { sectionId: { in: enrolments.map((e) => e.sectionId) } },
        { courseCode: { in: [...new Set(enrolments.map((e) => e.section.course.code))] } },
      ],
    },
  });
  const planBySection = new Map(planItems.filter((i) => i.sectionId).map((i) => [i.sectionId!, i]));
  const planByCode = new Map(planItems.map((i) => [i.courseCode, i]));

  const rows = enrolments.map((e) => {
    const { averagePercent: avgPct, letter } = enrolmentMark(e.status, e.gradeItems);
    const sessions = e.section.classSessions;
    const fromSessions = dateBoundsFromSessions(sessions, tz);
    const plan = planBySection.get(e.sectionId) ?? planByCode.get(e.section.course.code);
    const offering = offerings.get(e.sectionId);
    const startsOn =
      offering?.startsOn || plan?.startsOn || e.section.academicBlock?.startsOn || fromSessions.startsOn || e.section.term.startsOn;
    const endsOn =
      offering?.endsOn || plan?.endsOn || e.section.academicBlock?.endsOn || fromSessions.endsOn || e.section.term.endsOn;
    const term = sectionTerm(e.section.term, { startsOn, endsOn }, terms);
    return {
      enrolmentId: e.id,
      courseId: e.section.courseId,
      courseCode: e.section.course.code,
      title: e.section.course.title,
      credits: e.section.course.credits,
      termCode: term?.code ?? "",
      termName: termLabel(term),
      courseStatus: courseStatus({ status: e.status, startsOn, endsOn, averagePercent: avgPct, letter }, today),
      sectionCode: e.section.code,
      status: e.status,
      attemptNumber: e.attemptNumber,
      isRetake: e.attemptNumber > 1,
      countsTowardCgpa: e.countsTowardCgpa,
      continuous: e.continuous,
      averagePercent: avgPct,
      letter,
      sectionId: e.sectionId,
      instructorName: instructorDisplayName(instructorById.get(e.section.instructorPersonId)),
      room: offering?.location || roomFromSessions(sessions),
      deliveryMethod: offering?.deliveryMethod ?? null,
      scheduleText: offering?.scheduleText || scheduleTextFromSessions(sessions, tz) || plan?.scheduleText || null,
      startsOn,
      endsOn,
    };
  });

  return {
    previous: rows.filter((r) => r.status === "completed" && !r.isRetake),
    current: rows.filter((r) => r.status === "enrolled"),
    withdrawn: rows.filter((r) => r.status === "withdrawn"),
    retakes: rows.filter((r) => r.isRetake),
    all: rows,
    today,
  };
}

/** Final Marks / transcript rows: IP until a final mark exists, then the letter and grade points. */
export function transcriptCourses(history: Pick<CourseHistory, "all" | "today">, programName: string) {
  return history.all.filter((r) => r.status !== "waitlisted").map((r) => {
    const final = hasFinalMark(r, history.today);
    const letter = r.status === "enrolled" && !final ? "IP" : displayLetter({ ...r, status: final ? "completed" : r.status });
    return {
      enrolmentId: r.enrolmentId,
      sectionId: r.sectionId,
      courseCode: r.courseCode,
      title: r.title,
      credits: r.credits,
      termCode: r.termCode,
      termName: r.termName,
      programName,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      status: r.status,
      courseStatus: r.courseStatus,
      final,
      letter,
      averagePercent: r.averagePercent,
      gradePoints: final ? gradePointsOrNull(letter) : null,
      attemptNumber: r.attemptNumber,
      isRetake: r.isRetake,
      countsTowardCgpa: r.countsTowardCgpa,
    };
  });
}

export async function getTranscriptSummary(institutionId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    include: { cohort: true, programVersion: { include: { program: true } } },
  });
  const history = await getCourseHistory(institutionId, studentId);
  const plan = await getProgramPlan(institutionId, studentId, history);

  const assigned = student?.programName && student.programName !== "Not assigned" ? student.programName : null;
  const programName = assigned ?? student?.programVersion?.program.name ?? plan.cohort?.label ?? student?.programName ?? "Programme";

  const courses = transcriptCourses(history, programName);
  const totals = summarizeCourses(courses);

  const termMap = new Map<string, string>();
  for (const c of courses) {
    if (c.termCode) termMap.set(c.termCode, c.termName || c.termCode);
  }

  return {
    studentNumber: student?.studentNumber ?? null,
    programName,
    programs: [
      { id: "all", name: "All" },
      { id: "primary", name: programName },
    ],
    terms: [
      { code: "all", name: "All Terms" },
      ...[...termMap.entries()].map(([code, name]) => ({ code, name })),
    ],
    cohort: student?.cohort
      ? {
          code: student.cohort.code,
          label: student.cohort.label,
        }
      : plan.cohort
        ? { code: plan.cohort.code, label: plan.cohort.label }
        : null,
    ...totals,
    courses,
  };
}

type SummaryRow = { status: string; final: boolean; credits: number; letter: string; averagePercent: number | null; gradePoints: number | null; countsTowardCgpa: boolean };

/** Credits, average and CGPA from the same per-course rows the Final Marks tables show (any subset, e.g. one term). */
export function summarizeCourses(rows: SummaryRow[]) {
  const finals = rows.filter((r) => r.final && r.countsTowardCgpa);
  const current = rows.filter((r) => r.status === "enrolled" && !r.final && r.averagePercent != null);
  return {
    earnedCredits: finals.filter((r) => passingLetter(r.letter)).reduce((n, r) => n + r.credits, 0),
    attemptedCredits: rows.filter((r) => r.status !== "withdrawn" && r.status !== "waitlisted").reduce((n, r) => n + r.credits, 0),
    averagePercent: creditWeighted(finals.filter((r) => r.averagePercent != null).map((r) => ({ credits: r.credits, value: r.averagePercent! }))),
    cgpa: creditWeighted(finals.filter((r) => r.gradePoints != null).map((r) => ({ credits: r.credits, value: r.gradePoints! }))),
    currentAverage: creditWeighted(current.map((r) => ({ credits: r.credits, value: r.averagePercent! }))),
  };
}
