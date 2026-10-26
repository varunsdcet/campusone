import type { DegreePlanAnalysis, AiClaim } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { passingLetter } from "../../lib/courseStatus.js";
import { ensureProgramVersion } from "./program-version.js";
import { getCourseHistory, transcriptCourses } from "./program-plan.service.js";

type ProgressOptions = {
  institutionId: string;
  studentId: string;
  dropCourseCodes?: string[];
  failCourseCodes?: string[];
  addCourseCodes?: string[];
};

function unique(codes: string[]) {
  return [...new Set(codes.map((c) => c.toUpperCase()))];
}

type Standing = { credits: number; status: "satisfied" | "in_progress" };

export function projectedTermFromCalendar(
  terms: Array<{ name: string; startsOn: string; endsOn: string }>,
  termsNeeded: number,
  today = new Date().toISOString().slice(0, 10),
) {
  const available = terms
    .filter((term) => term.endsOn.slice(0, 10) >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn));
  if (!available.length) return null;
  return available[Math.max(termsNeeded, 1) - 1]?.name ?? null;
}

/**
 * Per course code: satisfied only by a final, passing mark that earns credit (the Final Marks / transcript rule);
 * in progress while an enrolment has no final mark yet. Failed and withdrawn attempts count for nothing.
 */
export function courseStanding(
  rows: Array<{ courseCode: string; credits: number; status: string; final: boolean; letter: string; gradePoints: number | null; countsTowardCgpa: boolean }>,
  drop: Set<string> = new Set(),
  fail: Set<string> = new Set(),
) {
  const out = new Map<string, Standing>();
  for (const r of rows) {
    const code = r.courseCode.toUpperCase();
    if (drop.has(code) || fail.has(code)) continue;
    if (r.final && r.countsTowardCgpa && passingLetter(r.letter)) out.set(code, { credits: r.credits, status: "satisfied" });
    else if (!r.final && r.status === "enrolled" && out.get(code)?.status !== "satisfied") out.set(code, { credits: r.credits, status: "in_progress" });
  }
  return out;
}

export async function computeDegreeProgress(input: ProgressOptions): Promise<DegreePlanAnalysis> {
  await ensureProgramVersion(input.institutionId, input.studentId);
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, institutionId: input.institutionId },
    include: {
      programVersion: {
        include: {
          program: true,
          requirements: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!student) {
    throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
  }
  if (!student.programVersion) {
    throw Object.assign(new Error("No program with a course outline is assigned for this student. Enrol the student in a program whose pathway lists its courses."), {
      code: "NO_PROGRAM",
      status: 404,
    });
  }

  const version = student.programVersion;
  const drop = new Set(unique(input.dropCourseCodes ?? []));
  const fail = new Set(unique(input.failCourseCodes ?? []));
  const add = unique(input.addCourseCodes ?? []);

  const history = await getCourseHistory(input.institutionId, student.id);
  const enrolments = history.all.filter((r) => r.status === "enrolled" || r.status === "completed");
  const completedByCourse = courseStanding(transcriptCourses(history, version.program.name), drop, fail);
  const failedCourseCodes = unique(
    transcriptCourses(history, version.program.name)
      .filter((row) => row.final && !passingLetter(row.letter))
      .map((row) => row.courseCode),
  ).filter((code) => completedByCourse.get(code)?.status !== "satisfied");
  const transfers = await prisma.transferCredit.findMany({
    where: { institutionId: input.institutionId, studentId: student.id, status: "accepted" },
    include: { course: true },
  });
  for (const transfer of transfers) {
    const code = (transfer.course?.code ?? transfer.externalCode).toUpperCase();
    if (drop.has(code) || fail.has(code)) continue;
    if (!completedByCourse.has(code)) {
      completedByCourse.set(code, { credits: transfer.credits, status: "satisfied" });
    }
  }
  for (const code of add) {
    if (drop.has(code) || fail.has(code)) continue;
    if (!completedByCourse.has(code)) {
      const course = await prisma.course.findFirst({
        where: { institutionId: input.institutionId, code },
      });
      completedByCourse.set(code, {
        credits: course?.credits ?? 3,
        status: "in_progress",
      });
    }
  }

  const programCodes = version.requirements.map((r) => r.courseCode);
  const prereqRows = programCodes.length
    ? await prisma.coursePrerequisite.findMany({
        where: { institutionId: input.institutionId, course: { code: { in: programCodes } } },
        include: { course: true, prerequisiteCourse: true },
      })
    : [];
  const prerequisiteGraph = prereqRows.map((row) => ({
    courseCode: row.course.code,
    requiresCourseCode: row.prerequisiteCourse.code,
  }));
  const prereqsByCourse = new Map<string, string[]>();
  for (const edge of prerequisiteGraph) {
    const list = prereqsByCourse.get(edge.courseCode) ?? [];
    list.push(edge.requiresCourseCode);
    prereqsByCourse.set(edge.courseCode, list);
  }

  const remainingRequirements: DegreePlanAnalysis["remainingRequirements"] = [];
  const satisfiedRequirements: DegreePlanAnalysis["satisfiedRequirements"] = [];
  const prerequisiteConflicts: DegreePlanAnalysis["prerequisiteConflicts"] = [];

  for (const req of version.requirements) {
    const code = req.courseCode.toUpperCase();
    const owned = completedByCourse.get(code);
    const needed = prereqsByCourse.get(code) ?? [];
    const missingPrereqs = needed.filter((p) => {
      const state = completedByCourse.get(p.toUpperCase());
      return !state || state.status !== "satisfied";
    });
    if (owned?.status === "satisfied") {
      satisfiedRequirements.push({
        id: req.id,
        code: req.courseCode,
        title: req.title,
        credits: req.credits,
        kind: req.kind as "required" | "elective" | "capstone",
        status: "satisfied",
        satisfiedByCourseCode: req.courseCode,
        blockedByCourseCodes: [],
      });
      continue;
    }
    if (owned?.status === "in_progress") {
      const item = {
        id: req.id,
        code: req.courseCode,
        title: req.title,
        credits: req.credits,
        kind: req.kind as "required" | "elective" | "capstone",
        status: missingPrereqs.length ? ("blocked" as const) : ("in_progress" as const),
        satisfiedByCourseCode: null,
        blockedByCourseCodes: missingPrereqs,
      };
      remainingRequirements.push(item);
      if (missingPrereqs.length) {
        prerequisiteConflicts.push({ courseCode: req.courseCode, missingPrerequisites: missingPrereqs });
      }
      continue;
    }
    const status = missingPrereqs.length ? ("blocked" as const) : ("missing" as const);
    remainingRequirements.push({
      id: req.id,
      code: req.courseCode,
      title: req.title,
      credits: req.credits,
      kind: req.kind as "required" | "elective" | "capstone",
      status,
      satisfiedByCourseCode: null,
      blockedByCourseCodes: missingPrereqs,
    });
    if (missingPrereqs.length) {
      prerequisiteConflicts.push({ courseCode: req.courseCode, missingPrerequisites: missingPrereqs });
    }
  }

  const completedCredits = [...completedByCourse.values()]
    .filter((v) => v.status === "satisfied")
    .reduce((sum, v) => sum + v.credits, 0);
  const remainingCredits = remainingRequirements.reduce((sum, r) => sum + r.credits, 0);
  const warnings: string[] = [];
  if (drop.size) warnings.push(`Scenario drops: ${[...drop].join(", ")}`);
  if (fail.size) warnings.push(`Scenario treats as failed: ${[...fail].join(", ")}`);
  if (prerequisiteConflicts.length) {
    warnings.push(`${prerequisiteConflicts.length} prerequisite conflict(s) remain.`);
  }

  const termsNeeded = Math.max(1, Math.ceil(remainingRequirements.filter((r) => r.status !== "in_progress").length / 3));
  const terms = await prisma.term.findMany({
    where: { institutionId: input.institutionId },
    select: { name: true, startsOn: true, endsOn: true },
  });
  const projectedCompletionTerm = projectedTermFromCalendar(terms, remainingCredits <= 0 ? 1 : termsNeeded);
  if (!projectedCompletionTerm) warnings.push("No published academic term covers the projected completion window.");

  const suggestedOptions: string[] = [];
  for (const req of remainingRequirements.filter((r) => r.status === "missing").slice(0, 3)) {
    suggestedOptions.push(`Take ${req.code} next available term (${req.credits} credits).`);
  }
  if (prerequisiteConflicts[0]) {
    suggestedOptions.push(
      `Clear ${prerequisiteConflicts[0].missingPrerequisites.join(", ")} before ${prerequisiteConflicts[0].courseCode}.`,
    );
  }

  const evidence = [
    {
      id: `programVersion:${version.id}`,
      title: `${version.program.name} · ${version.label}`,
      uri: "/student/degree",
    },
    {
      id: `student:${student.id}`,
      title: `Student ${student.studentNumber}`,
      uri: "/student/profile",
    },
    ...enrolments.slice(0, 6).map((e) => ({
      id: `enrolment:${e.enrolmentId}`,
      title: `${e.courseCode} enrolment`,
      uri: `/student/courses/${e.sectionId}`,
    })),
  ];

  const claims: AiClaim[] = [
    {
      kind: "fact",
      text: `${completedCredits} of ${version.totalCredits} required credits are satisfied by final, passing marks.`,
      evidenceIds: evidence.map((e) => e.id),
    },
    {
      kind: "fact",
      text: `${remainingRequirements.length} catalog requirement(s) remain open.`,
      evidenceIds: [`programVersion:${version.id}`],
    },
    {
      kind: remainingCredits <= 0 ? "inference" : "inference",
      text:
        remainingCredits <= 0
          ? "Based on current satisfied requirements, catalog completion is reachable in the current cycle."
          : `Based on remaining requirements and a 3-course term load, projected completion is ${projectedCompletionTerm}.`,
      evidenceIds: [`programVersion:${version.id}`],
    },
  ];
  if (prerequisiteConflicts.length) {
    claims.push({
      kind: "uncertainty",
      text: "Course offering terms beyond the currently published academic calendar are not confirmed in this analysis.",
      evidenceIds: [],
    });
  }

  return {
    studentId: student.id,
    programCode: version.program.code,
    programName: version.program.name,
    programVersionLabel: version.label,
    remainingCredits,
    completedCredits,
    requiredCredits: version.totalCredits,
    remainingRequirements,
    satisfiedRequirements,
    prerequisiteConflicts,
    prerequisiteGraph,
    failedCourseCodes,
    projectedCompletionTerm,
    warnings,
    suggestedOptions,
    evidence,
    claims,
  };
}

export async function impactIfDropCourse(input: {
  institutionId: string;
  studentId: string;
  courseCode: string;
}) {
  const baseline = await computeDegreeProgress({
    institutionId: input.institutionId,
    studentId: input.studentId,
  });
  const projected = await computeDegreeProgress({
    institutionId: input.institutionId,
    studentId: input.studentId,
    dropCourseCodes: [input.courseCode],
  });
  const code = input.courseCode.toUpperCase();
  const downstream = projected.prerequisiteGraph
    .filter((e) => e.requiresCourseCode.toUpperCase() === code)
    .map((e) => e.courseCode);
  const impactSummary = [
    `Dropping ${code} removes it from the active plan.`,
    ...(downstream.length
      ? [`Downstream requirements that list ${code} as a prerequisite: ${downstream.join(", ")}.`]
      : [`No catalog courses list ${code} as a prerequisite.`]),
    `Projected completion moves from ${baseline.projectedCompletionTerm ?? "unknown"} to ${projected.projectedCompletionTerm ?? "unknown"}.`,
  ];
  return { baseline, projected, impactSummary, downstream };
}
