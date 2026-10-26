import type { AiRequestContext, AiToolName, EnrollmentMetricsSnapshot, MissingSubmissionRow, SessionClaims, StudentRiskAnalysis } from "@myheritage/contracts";
import { assertToolAllowed } from "@myheritage/ai";
import { prisma } from "@myheritage/db";
import { computeDegreeProgress, impactIfDropCourse } from "../academic/degree-progress.service.js";
import { assertPermission } from "../admin/superAdmin.service.js";
import { facultySectionIds } from "../instructor/sectionFaculty.js";
import { listKnowledgeDocuments } from "./knowledge.service.js";
import { getEnrollmentMetrics } from "./metrics.service.js";
import { getMissingSubmissionsForInstructor } from "./faculty-insight.service.js";
import { getStudentSuccessSignals } from "./success.service.js";

export async function executeAiTool(name: AiToolName, ctx: AiRequestContext, input: Record<string, unknown> = {}) {
  const tool = assertToolAllowed(name, ctx.roles);
  const institutionId = ctx.institutionId;

  if (STUDENT_SCOPED_TOOLS.has(name)) {
    await assertStudentToolAccess(ctx, requireStudentId(ctx, input));
  }

  switch (name) {
    case "get_degree_progress": {
      const studentId = requireStudentId(ctx, input);
      return computeDegreeProgress({ institutionId, studentId });
    }
    case "create_degree_plan_scenario": {
      const studentId = requireStudentId(ctx, input);
      const courseCode = String(input.courseCode ?? "").toUpperCase();
      if (!courseCode) {
        return computeDegreeProgress({ institutionId, studentId });
      }
      return impactIfDropCourse({ institutionId, studentId, courseCode });
    }
    case "get_prerequisite_graph": {
      const rows = await prisma.coursePrerequisite.findMany({
        where: { institutionId },
        include: { course: true, prerequisiteCourse: true },
      });
      return rows.map((row) => ({
        courseCode: row.course.code,
        requiresCourseCode: row.prerequisiteCourse.code,
      }));
    }
    case "get_knowledge_documents": {
      return listKnowledgeDocuments({
        institutionId,
        question: String(input.question ?? ""),
        docType: typeof input.docType === "string" ? input.docType : undefined,
      });
    }
    case "get_course_content": {
      return listCourseContentFacts(ctx);
    }
    case "get_enrollment_metrics": {
      return getEnrollmentMetrics(institutionId);
    }
    case "get_section_missing_submissions": {
      return getMissingSubmissionsForInstructor({
        institutionId,
        instructorPersonId: ctx.personId,
      });
    }
    case "get_student_success_signals": {
      const studentId = requireStudentId(ctx, input);
      return getStudentSuccessSignals({ institutionId, studentId });
    }
    case "get_student_profile": {
      const studentId = requireStudentId(ctx, input);
      return prisma.student.findFirst({
        where: { id: studentId, institutionId },
        select: { id: true, studentNumber: true, programName: true, standing: true, programVersionId: true },
      });
    }
    case "get_academic_record": {
      const studentId = requireStudentId(ctx, input);
      return prisma.enrolment.findMany({
        where: { institutionId, studentId, status: { in: ["enrolled", "completed"] } },
        include: { section: { include: { course: true } } },
        take: 40,
      });
    }
    case "get_degree_requirements": {
      const studentId = requireStudentId(ctx, input);
      const student = await prisma.student.findFirst({
        where: { id: studentId, institutionId },
        include: { programVersion: { include: { requirements: { orderBy: { sortOrder: "asc" } } } } },
      });
      return student?.programVersion?.requirements ?? [];
    }
    case "get_course_catalog": {
      return prisma.course.findMany({ where: { institutionId }, orderBy: { code: "asc" }, take: 100 });
    }
    case "get_admissions_application_summary": {
      const { redactApplication } = await import("../applicant/governmentIdPurge.js");
      const app = await prisma.admissionsApplication.findFirst({
        where: {
          institutionId,
          ...(ctx.roles.includes("applicant") ? { accountId: ctx.accountId } : {}),
        },
        include: { documents: true, offers: true },
      });
      return app ? redactApplication(app) : null;
    }
    case "get_rubric": {
      const { getRubricForAssignment } = await import("./domain-actions.service.js");
      return getRubricForAssignment({
        institutionId,
        assignmentId: String(input.assignmentId ?? ""),
        instructorPersonId: ctx.roles.includes("instructor") ? ctx.personId : undefined,
      });
    }
    case "draft_grading_suggestion": {
      const { draftGradingSuggestion } = await import("./domain-actions.service.js");
      return draftGradingSuggestion({
        institutionId,
        instructorPersonId: ctx.personId,
        assignmentId: String(input.assignmentId ?? ""),
        studentId: String(input.studentId ?? ""),
      });
    }
    case "create_advisor_appointment": {
      const { createAdvisorAppointment } = await import("./domain-actions.service.js");
      const studentId = requireStudentId(ctx, input);
      return createAdvisorAppointment({
        institutionId,
        studentId,
        topic: String(input.topic ?? "Degree plan review"),
        startsAt: String(input.startsAt ?? new Date(Date.now() + 86_400_000).toISOString()),
        notes: typeof input.notes === "string" ? input.notes : undefined,
        actorAccountId: ctx.accountId,
      });
    }
    case "create_student_success_case": {
      const { createSuccessCase } = await import("./domain-actions.service.js");
      return createSuccessCase({
        institutionId,
        studentId: String(input.studentId ?? requireStudentId(ctx, input)),
        level: input.level === "elevated" ? "elevated" : "watch",
        summary: String(input.summary ?? "Intervention opened from explainable academic signals."),
        signals: Array.isArray(input.signals) ? input.signals : [],
        actorAccountId: ctx.accountId,
        ownerPersonId: ctx.personId,
      });
    }
    case "get_executive_metrics": {
      const { getExecutiveMetrics } = await import("./metrics.service.js");
      return getExecutiveMetrics(institutionId);
    }
    case "get_career_opportunities": {
      return prisma.careerOpportunity.findMany({
        where: { institutionId, status: "open" },
        orderBy: { title: "asc" },
        take: 20,
      });
    }
    case "get_course_offerings": {
      return prisma.courseOffering.findMany({
        where: { institutionId, status: "published" },
        include: { course: true },
        take: 40,
      });
    }
    case "get_transfer_credits": {
      const studentId = requireStudentId(ctx, input);
      return prisma.transferCredit.findMany({
        where: { institutionId, studentId, status: "accepted" },
        include: { course: true },
      });
    }
    case "save_degree_plan_scenario": {
      throw Object.assign(new Error("Use POST /student/degree-scenarios with save=true for consequential saves"), {
        code: "VALIDATION_ERROR",
        status: 400,
      });
    }
    default: {
      const _exhaustive: never = name;
      throw Object.assign(new Error(`Unhandled AI tool: ${_exhaustive}`), { code: "VALIDATION_ERROR", status: 400 });
    }
  }
}

const STUDENT_SCOPED_TOOLS = new Set<AiToolName>([
  "get_degree_progress",
  "create_degree_plan_scenario",
  "get_transfer_credits",
  "get_student_success_signals",
  "get_student_profile",
  "get_academic_record",
  "get_degree_requirements",
  "create_advisor_appointment",
  "create_student_success_case",
]);

async function assertStudentToolAccess(ctx: AiRequestContext, studentId: string) {
  const user: SessionClaims = {
    sub: ctx.accountId,
    accountId: ctx.accountId,
    personId: ctx.personId,
    institutionId: ctx.institutionId,
    roles: ctx.roles,
    sessionId: ctx.sessionId,
  };
  const target = await prisma.student.findFirst({
    where: { id: studentId, institutionId: ctx.institutionId },
    select: { id: true, personId: true },
  });
  if (!target) {
    throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
  }

  if (ctx.roles.includes("student")) {
    if (target.personId !== ctx.personId || ctx.activeStudentId !== target.id) {
      throw Object.assign(new Error("Students may only access their own academic tools"), {
        code: "FORBIDDEN",
        status: 403,
      });
    }
    return;
  }

  if (ctx.roles.includes("admin") || ctx.roles.includes("registrar")) {
    await assertPermission(user, "studentRecords", "view");
    return;
  }

  if (ctx.roles.includes("instructor")) {
    const sectionIds = await facultySectionIds(user);
    const enrolment = sectionIds.size
      ? await prisma.enrolment.findFirst({
          where: {
            institutionId: ctx.institutionId,
            studentId,
            sectionId: { in: [...sectionIds] },
            status: { not: "withdrawn" },
          },
          select: { id: true },
        })
      : null;
    if (enrolment) return;
  }

  throw Object.assign(new Error("You do not have access to this student's academic data"), {
    code: "FORBIDDEN",
    status: 403,
  });
}

function requireStudentId(ctx: AiRequestContext, input: Record<string, unknown>) {
  const fromInput = typeof input.studentId === "string" ? input.studentId : undefined;
  const studentId = ctx.activeStudentId ?? fromInput;
  if (!studentId) {
    throw Object.assign(new Error("activeStudentId is required for this tool"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }
  if (ctx.roles.includes("student") && ctx.activeStudentId && fromInput && fromInput !== ctx.activeStudentId) {
    throw Object.assign(new Error("Students may only access their own academic tools"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return studentId;
}

async function listCourseContentFacts(ctx: AiRequestContext) {
  const student = ctx.activeStudentId
    ? await prisma.student.findFirst({ where: { id: ctx.activeStudentId, institutionId: ctx.institutionId } })
    : await prisma.student.findFirst({
        where: { institutionId: ctx.institutionId, personId: ctx.personId },
      });
  if (!student && ctx.roles.includes("student")) {
    return [];
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(ctx.activeSectionId ? { sectionId: ctx.activeSectionId } : {}),
      section: {
        institutionId: ctx.institutionId,
        ...(student
          ? {
              enrolments: {
                some: {
                  institutionId: ctx.institutionId,
                  studentId: student.id,
                  status: { in: ["enrolled", "completed"] },
                },
              },
            }
          : ctx.roles.includes("instructor")
            ? { instructorPersonId: ctx.personId }
            : {}),
      },
    },
    include: { section: { include: { course: true } } },
    orderBy: { dueAt: "asc" },
    take: 12,
  });

  return assignments.map((assignment) => ({
    id: `assignment:${assignment.id}`,
    title: `${assignment.section.course.code} · ${assignment.title}`,
    uri: `/student/assignments/${assignment.id}`,
    text: `${assignment.title} for ${assignment.section.course.code} (due ${assignment.dueAt?.toISOString() ?? "TBD"}). Use the assignment brief in the course workspace for approved detail.`,
  }));
}

export type { EnrollmentMetricsSnapshot, MissingSubmissionRow, StudentRiskAnalysis };
