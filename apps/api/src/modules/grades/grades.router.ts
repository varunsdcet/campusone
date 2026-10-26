import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  CreateGradeItemRequest,
  GradebookResponse,
  PublishGradesRequest,
  StudentGradesResponse,
  UpsertGradeRequest,
  Uuid,
} from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { requireApproval } from "@myheritage/auth";
import { writeAuditAndOutbox } from "@myheritage/events";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { gradeAwaitingApprovalError, gradeItemsInOpenApproval } from "../../lib/gradeApprovals.js";
import { getTranscriptSummary } from "../academic/program-plan.service.js";
import { currentStudentId } from "../me/studentAlignment.js";
import { facultySectionIds } from "../instructor/sectionFaculty.js";
import { weightedPercent } from "../academic/program-plan.service.js";
import { letterForSection } from "../../lib/gradingScheme.js";

export const gradesRouter: Router = Router();

function parseSectionId(raw: string) {
  const parsed = Uuid.safeParse(String(raw ?? "").trim());
  if (!parsed.success) {
    throw Object.assign(
      new Error("Invalid section id — open gradebook from Grades Submission or pick a section tab"),
      { code: "VALIDATION_ERROR", status: 400 },
    );
  }
  return parsed.data;
}

gradesRouter.get("/me", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await prisma.student.findFirst({
      where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
    });
    if (!student) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND", status: 404 });

    const enrolments = await prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, studentId: student.id, status: { in: ["enrolled", "completed"] } },
      include: {
        section: { include: { course: true, assignments: { orderBy: { dueAt: "asc" } } } },
        gradeItems: {
          where: { institutionId: user.institutionId },
          include: { assignment: true },
        },
      },
    });

    const instructorIds = [...new Set(enrolments.map((e) => e.section.instructorPersonId))];
    const instructors = await prisma.person.findMany({
      where: { id: { in: instructorIds }, institutionId: user.institutionId },
    });
    const instructorMap = new Map(instructors.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));

    const courses = await Promise.all(enrolments.map(async (e) => {
      // Published scores only; assignment shells still list so students see the gradebook structure.
      const publishedByAssignment = new Map(
        e.gradeItems.filter((g) => g.status === "published").map((g) => [g.assignmentId, g]),
      );
      const items = e.section.assignments
        .filter((a) => !a.hidden || publishedByAssignment.has(a.id))
        .map((a) => {
          const g = publishedByAssignment.get(a.id);
          return {
            id: g?.id ?? a.id,
            title: a.title,
            weightPercent: a.weightPercent,
            score: g && g.status === "published" ? g.score : null,
            maxScore: g?.maxScore ?? a.maxScore,
            letter: g && g.status === "published" ? g.letter : null,
            status: (g?.status === "published" ? "published" : "draft") as "draft" | "published",
            publishedAt: g?.status === "published" ? (g.publishedAt?.toISOString() ?? null) : null,
            underReview: false,
            feedback: g?.status === "published" ? (g.feedback ?? null) : null,
          };
        });
      const currentPercent = weightedPercent(items.filter((item) => item.status === "published"));
      return {
        sectionId: e.sectionId,
        code: e.section.course.code,
        title: e.section.course.title,
        instructorName: instructorMap.get(e.section.instructorPersonId) ?? "Instructor",
        credits: e.section.course.credits,
        currentPercent,
        letter: currentPercent == null ? null : await letterForSection(user.institutionId, e.sectionId, e.section.course.id, currentPercent, 100),
        items,
      };
    }));

    const cumulativeGpa = (await getTranscriptSummary(user.institutionId, student.id)).cgpa ?? 0;

    await prisma.auditEvent.create({
      data: {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "Student.grades.view",
        purpose: "read",
        beforeJson: null,
        afterJson: JSON.stringify({ studentId: student.id }),
        source: "grades.me",
        correlationId: (req as AuthedRequest).correlationId,
        version: 1,
      },
    });

    res.json(
      StudentGradesResponse.parse({
        cumulativeGpa,
        standing: student.standing as "good" | "warning" | "probation" | "alert",
        courses,
      }),
    );
  } catch (err) {
    next(err);
  }
});

const GRADE_STATUSES = new Set(["draft", "pending_publish", "published", "under_review"]);

function normalizeGradeStatus(status: string | null | undefined) {
  const raw = (status ?? "draft").trim().toLowerCase();
  return (GRADE_STATUSES.has(raw) ? raw : "draft") as
    | "draft"
    | "pending_publish"
    | "published"
    | "under_review";
}

/** Guarantee at least one assessable column so instructors can enter grades for enrolled students. */
async function ensureSectionAssignments(
  institutionId: string,
  sectionId: string,
  existing: Array<{ id: string; title: string; maxScore: unknown; weightPercent: unknown; createdAt?: Date }>,
) {
  if (existing.length > 0) return existing;
  const created = await prisma.assignment.create({
    data: {
      id: randomUUID(),
      institutionId,
      sectionId,
      title: "Final Grade",
      maxScore: 100,
      weightPercent: 100,
      dueAt: null,
    },
  });
  return [created];
}

gradesRouter.get(
  "/:sectionId",
  requireAuth,
  requireRoles("instructor", "admin"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const sectionId = parseSectionId(String(req.params.sectionId ?? ""));
      const assigned = user.roles.includes("admin") ? null : await facultySectionIds(user);
      let section = await prisma.section.findFirst({
        where: {
          id: sectionId,
          institutionId: user.institutionId,
          ...(assigned ? { id: { in: [...assigned] } } : {}),
        },
        include: {
          course: true,
          assignments: { orderBy: { createdAt: "asc" } },
          enrolments: {
            where: { status: "enrolled" },
            include: { student: { include: { person: true } }, gradeItems: true },
            orderBy: { student: { person: { familyName: "asc" } } },
          },
        },
      });
      if (!section) throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND", status: 404 });

      const assignments = await ensureSectionAssignments(
        user.institutionId,
        section.id,
        section.assignments,
      );
      if (assignments !== section.assignments) {
        section = {
          ...section,
          assignments: assignments as typeof section.assignments,
        };
      }

      const submissions = await prisma.submission.findMany({
        where: { institutionId: user.institutionId, assignmentId: { in: assignments.map((a) => a.id) } },
        select: {
          id: true,
          assignmentId: true,
          studentId: true,
          status: true,
          submittedAt: true,
          _count: { select: { files: { where: { archivedAt: null } } } },
        },
      });
      const submissionFor = new Map(submissions.map((s) => [`${s.assignmentId}:${s.studentId}`, s]));

      const rows = section.enrolments.map((e) => {
        const cells = assignments.map((a) => {
          const cell = e.gradeItems.find((g) => g.assignmentId === a.id);
          const sub = submissionFor.get(`${a.id}:${e.studentId}`);
          return {
            gradeItemId: cell?.id ?? "00000000-0000-4000-8000-000000000000",
            assignmentId: a.id,
            score: cell?.score == null ? null : Number(cell.score),
            maxScore: Number(a.maxScore),
            status: normalizeGradeStatus(cell?.status),
            rowVersion: Number(cell?.rowVersion ?? 1) || 1,
            feedback: cell?.feedback ?? null,
            submission: sub
              ? {
                  id: sub.id,
                  status: (["draft", "submitted", "returned"].includes(sub.status) ? sub.status : "draft") as
                    | "draft"
                    | "submitted"
                    | "returned",
                  submittedAt: sub.submittedAt?.toISOString() ?? null,
                  fileCount: sub._count.files,
                }
              : null,
          };
        });
        const needsAttention = cells.some(
          (c) => c.score == null || c.status === "draft" || c.status === "pending_publish",
        );
        return {
          studentId: e.studentId,
          studentNumber: e.student.studentNumber || "—",
          name: `${e.student.person?.givenName ?? ""} ${e.student.person?.familyName ?? ""}`.trim() || "Student",
          needsAttention,
          cells,
        };
      });

      // Students who still need grades first so the roster matches the submit-grades workflow.
      rows.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || a.name.localeCompare(b.name));

      const payload = GradebookResponse.parse({
        sectionId: section.id,
        courseCode: section.course.code,
        courseTitle: section.course.title,
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          maxScore: Number(a.maxScore),
          weightPercent: Number(a.weightPercent),
        })),
        rows,
      });
      res.json(payload);
    } catch (err) {
      next(err);
    }
  },
);

gradesRouter.post("/", requireAuth, requireRoles("instructor", "admin"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CreateGradeItemRequest.parse(req.body);
    const assigned = user.roles.includes("admin") ? null : await facultySectionIds(user);
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: body.assignmentId,
        institutionId: user.institutionId,
        ...(user.roles.includes("admin")
          ? {}
          : { sectionId: { in: [...(assigned ?? [])] } }),
      },
      include: { section: { select: { courseId: true } } },
    });
    if (!assignment) throw Object.assign(new Error("Assignment not found"), { code: "NOT_FOUND", status: 404 });
    const enrolment = await prisma.enrolment.findFirst({
      where: {
        institutionId: user.institutionId,
        sectionId: assignment.sectionId,
        studentId: body.studentId,
        status: "enrolled",
      },
    });
    if (!enrolment) throw Object.assign(new Error("Enrolment not found"), { code: "NOT_FOUND", status: 404 });
    if (body.score > assignment.maxScore) {
      throw Object.assign(new Error("Score cannot exceed the maximum score"), {
        code: "VALIDATION_ERROR",
        status: 400,
      });
    }
    const letter = await letterForSection(user.institutionId, assignment.sectionId, assignment.section.courseId, body.score, assignment.maxScore);
    const feedback = body.feedback === undefined ? undefined : body.feedback?.trim() || null;
    const existing = await prisma.gradeItem.findFirst({
      where: { assignmentId: assignment.id, studentId: body.studentId, institutionId: user.institutionId },
    });
    if (existing) {
      if (existing.status === "published") {
        throw Object.assign(new Error("Published grades are read-only"), { code: "CONFLICT", status: 409 });
      }
      if ((await gradeItemsInOpenApproval(user.institutionId, [existing.id])).size) throw gradeAwaitingApprovalError();
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.gradeItem.update({
          where: { id: existing.id },
          data: { score: body.score, letter, feedback, status: "draft", rowVersion: { increment: 1 } },
        });
        await writeAuditAndOutbox(tx, {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "GradeItem.updated",
          purpose: "gradebook_edit",
          before: existing,
          after: row,
          source: "grade-items.post",
          correlationId: (req as AuthedRequest).correlationId,
        });
        return row;
      });
      res.json(updated);
      return;
    }
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.gradeItem.create({
        data: {
          institutionId: user.institutionId,
          assignmentId: assignment.id,
          studentId: body.studentId,
          enrolmentId: enrolment.id,
          score: body.score,
          maxScore: assignment.maxScore,
          letter,
          feedback: feedback ?? null,
          status: "draft",
        },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "GradeItem.created",
        purpose: "gradebook_edit",
        before: null,
        after: row,
        source: "grade-items.post",
        correlationId: (req as AuthedRequest).correlationId,
      });
      return row;
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

gradesRouter.patch("/:id", requireAuth, requireRoles("instructor", "admin"), async (req, res, next) => {
  try {
      const user = (req as AuthedRequest).user;
      const id = parseSectionId(String(req.params.id ?? ""));
      const body = UpsertGradeRequest.parse(req.body);
    const assigned = user.roles.includes("admin") ? null : await facultySectionIds(user);
    const existing = await prisma.gradeItem.findFirst({
      where: {
        id,
        institutionId: user.institutionId,
        ...(user.roles.includes("admin")
          ? {}
          : {
              assignment: {
                institutionId: user.institutionId,
                sectionId: { in: [...(assigned ?? [])] },
              },
            }),
      },
      include: { assignment: { include: { section: { select: { courseId: true } } } } },
    });
    if (!existing) throw Object.assign(new Error("Grade not found"), { code: "NOT_FOUND", status: 404 });
    if (existing.status === "published") {
      throw Object.assign(new Error("Published grades are read-only"), { code: "CONFLICT", status: 409 });
    }
    if ((await gradeItemsInOpenApproval(user.institutionId, [existing.id])).size) throw gradeAwaitingApprovalError();
    if (existing.rowVersion !== body.rowVersion) {
      throw Object.assign(new Error("Stale row_version — refresh and try again"), { code: "CONFLICT", status: 409 });
    }
    if (body.score > existing.maxScore) {
      throw Object.assign(new Error("Score cannot exceed the maximum score"), {
        code: "VALIDATION_ERROR",
        status: 400,
      });
    }
    const letter = await letterForSection(user.institutionId, existing.assignment.sectionId, existing.assignment.section.courseId, body.score, existing.maxScore);
    const feedback = body.feedback === undefined ? undefined : body.feedback?.trim() || null;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.gradeItem.update({
        where: { id },
        data: { score: body.score, letter, feedback, status: "draft", rowVersion: { increment: 1 } },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "GradeItem.updated",
        purpose: "gradebook_edit",
        before: existing,
        after: row,
        source: "grade-items.patch",
        correlationId: (req as AuthedRequest).correlationId,
      });
      return row;
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const GradeCorrectionRequest = z.object({
  score: z.number().nonnegative(),
  feedback: z.string().trim().max(4000).nullable().optional(),
  reason: z.string().trim().min(5).max(1000),
  rowVersion: z.number().int().positive(),
});

/** Published marks stay visible while a separately audited correction waits for approval. */
gradesRouter.post("/:id/corrections", requireAuth, requireRoles("instructor", "admin"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const id = parseSectionId(String(req.params.id ?? ""));
    const body = GradeCorrectionRequest.parse(req.body);
    const assigned = user.roles.includes("admin") ? null : await facultySectionIds(user);
    const grade = await prisma.gradeItem.findFirst({
      where: {
        id,
        institutionId: user.institutionId,
        ...(assigned ? { assignment: { sectionId: { in: [...assigned] } } } : {}),
      },
      include: { assignment: { select: { sectionId: true, section: { select: { courseId: true } } } } },
    });
    if (!grade) throw Object.assign(new Error("Grade not found"), { code: "NOT_FOUND", status: 404 });
    if (grade.status !== "published") throw Object.assign(new Error("Only a published grade needs a correction request"), { code: "CONFLICT", status: 409 });
    if (grade.rowVersion !== body.rowVersion) throw Object.assign(new Error("Stale row_version — refresh and try again"), { code: "CONFLICT", status: 409 });
    if (body.score > grade.maxScore) throw Object.assign(new Error("Score cannot exceed the maximum score"), { code: "VALIDATION_ERROR", status: 400 });
    if ((await gradeItemsInOpenApproval(user.institutionId, [grade.id])).size) throw gradeAwaitingApprovalError();
    const approval = await requireApproval({
      institutionId: user.institutionId,
      type: "grade.correct",
      subjectRef: `section:${grade.assignment.sectionId}`,
      proposedDiff: {
        gradeItemIds: [grade.id],
        studentIds: [grade.studentId],
        correction: { gradeItemId: grade.id, score: body.score, letter: await letterForSection(user.institutionId, grade.assignment.sectionId, grade.assignment.section.courseId, body.score, grade.maxScore), feedback: body.feedback, reason: body.reason, expectedRowVersion: grade.rowVersion },
      },
      requestedBy: user.accountId,
      requiredApproverRoles: ["admin", "registrar"],
      requiredCount: 1,
      correlationId: (req as AuthedRequest).correlationId,
      source: "grade-items.correction",
    });
    res.status(202).json({ approvalRequestId: approval.id, status: approval.status });
  } catch (error) {
    next(error);
  }
});

gradesRouter.post(
  "/:sectionId/publish",
  requireAuth,
  requireRoles("instructor", "admin"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const sectionId = parseSectionId(String(req.params.sectionId ?? ""));
      const body = PublishGradesRequest.parse(req.body);
      const assigned = user.roles.includes("admin") ? null : await facultySectionIds(user);
      const idempotencyKey = req.header("idempotency-key")?.trim();
      if (!idempotencyKey) {
        throw Object.assign(new Error("Idempotency-Key header is required"), {
          code: "VALIDATION_ERROR",
          status: 400,
        });
      }
      const idempotencyPath = `/gradebooks/${sectionId}/publish`;
      const existingRequest = await prisma.idempotencyKey.findUnique({
        where: {
          institutionId_key_method_path: {
            institutionId: user.institutionId,
            key: idempotencyKey,
            method: "POST",
            path: idempotencyPath,
          },
        },
      });
      if (existingRequest) {
        if (existingRequest.statusCode === 0) {
          throw Object.assign(new Error("An identical publish request is still processing"), {
            code: "CONFLICT",
            status: 409,
          });
        }
        res.status(existingRequest.statusCode).json(JSON.parse(existingRequest.responseJson));
        return;
      }
      const section = await prisma.section.findFirst({
        where: {
          id: sectionId,
          institutionId: user.institutionId,
          ...(assigned ? { id: { in: [...assigned] } } : {}),
        },
        select: { id: true, assignments: { select: { weightPercent: true } } },
      });
      if (!section) throw Object.assign(new Error("Section not found"), { code: "NOT_FOUND", status: 404 });
      const totalWeight = section.assignments.reduce((sum, assignment) => sum + Number(assignment.weightPercent), 0);
      if (Math.abs(totalWeight - 100) > 0.001) {
        throw Object.assign(new Error(`Assignment weights must total 100% before final marks can be published (currently ${totalWeight}%).`), {
          code: "VALIDATION_ERROR",
          status: 400,
        });
      }
      const grades = await prisma.gradeItem.findMany({
        where: {
          id: { in: body.gradeItemIds },
          institutionId: user.institutionId,
          assignment: { sectionId },
        },
      });
      if (grades.length !== body.gradeItemIds.length) {
        throw Object.assign(new Error("One or more grade items not found"), { code: "NOT_FOUND", status: 404 });
      }
      if (grades.some((g) => g.status === "published")) {
        throw Object.assign(new Error("Published grades are read-only"), { code: "CONFLICT", status: 409 });
      }
      if ((await gradeItemsInOpenApproval(user.institutionId, body.gradeItemIds)).size) {
        throw Object.assign(new Error("One or more of these grades are already awaiting approval in another request"), {
          code: "CONFLICT",
          status: 409,
        });
      }
      try {
        const response = await prisma.$transaction(async (tx) => {
          await tx.idempotencyKey.create({
            data: {
              institutionId: user.institutionId,
              key: idempotencyKey,
              method: "POST",
              path: idempotencyPath,
              responseJson: "{}",
              statusCode: 0,
            },
          });
          await tx.gradeItem.updateMany({
            where: { id: { in: body.gradeItemIds }, institutionId: user.institutionId },
            data: { status: "pending_publish" },
          });
          const approval = await requireApproval({
            institutionId: user.institutionId,
            type: "grade.publish",
            subjectRef: `section:${sectionId}`,
            proposedDiff: {
              gradeItemIds: body.gradeItemIds,
              studentIds: [...new Set(grades.map((g) => g.studentId))],
            },
            requestedBy: user.accountId,
            requiredApproverRoles: ["admin", "registrar"],
            requiredCount: 1,
            correlationId: (req as AuthedRequest).correlationId,
            tx,
          });
          const storedResponse = { approvalRequestId: approval.id, status: approval.status };
          await tx.idempotencyKey.update({
            where: {
              institutionId_key_method_path: {
                institutionId: user.institutionId,
                key: idempotencyKey,
                method: "POST",
                path: idempotencyPath,
              },
            },
            data: { responseJson: JSON.stringify(storedResponse), statusCode: 202 },
          });
          return storedResponse;
        });
        res.status(202).json(response);
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          const completed = await prisma.idempotencyKey.findUnique({
            where: {
              institutionId_key_method_path: {
                institutionId: user.institutionId,
                key: idempotencyKey,
                method: "POST",
                path: idempotencyPath,
              },
            },
          });
          if (completed && completed.statusCode > 0) {
            res.status(completed.statusCode).json(JSON.parse(completed.responseJson));
            return;
          }
          throw Object.assign(new Error("An identical publish request is already processing"), {
            code: "CONFLICT",
            status: 409,
          });
        }
        throw error;
      }
    } catch (err) {
      next(err);
    }
  },
);
