import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import type { AuthedRequest } from "../../middleware/auth.js";
import { readSubmissionFile } from "../../lib/submissionFiles.js";
import { isFacultyAssigned } from "./sectionFaculty.js";

/** Student work for one section, readable only by the section's instructor or an admin/registrar. */
export const submissionsRouter: Router = Router();

const SubmissionAction = z.object({
  action: z.enum(["return", "unsubmit", "grant_extension", "apply_penalty"]),
  reason: z.string().trim().min(3).max(1000),
  extensionUntil: z.string().datetime().optional(),
  penaltyPercent: z.number().min(0).max(100).optional(),
});

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

async function sectionForReviewer(user: SessionClaims, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: user.institutionId },
    select: { id: true, instructorPersonId: true, course: { select: { code: true, title: true } } },
  });
  if (!section) throw httpError("Course section not found", "NOT_FOUND", 404);
  if (!(await isFacultyAssigned(user, section))) {
    throw httpError("You do not teach this course section", "FORBIDDEN", 403);
  }
  return section;
}

submissionsRouter.get("/sections/:sectionId/submissions", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const section = await sectionForReviewer(user, String(req.params.sectionId));
    const assignments = await prisma.assignment.findMany({
      where: { institutionId: user.institutionId, sectionId: section.id },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, dueAt: true, maxScore: true, hidden: true },
    });
    const wanted = typeof req.query.assignmentId === "string" ? req.query.assignmentId : "";
    const selected = assignments.find((a) => a.id === wanted) ?? assignments[0] ?? null;
    if (wanted && selected?.id !== wanted) throw httpError("Assignment not found in this section", "NOT_FOUND", 404);

    const enrolments = await prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, sectionId: section.id, status: { in: ["enrolled", "completed"] } },
      select: {
        studentId: true,
        student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } },
      },
      orderBy: { student: { person: { familyName: "asc" } } },
    });
    const [submissions, grades] = selected
      ? await Promise.all([
          prisma.submission.findMany({
            where: { institutionId: user.institutionId, assignmentId: selected.id },
            include: { files: { where: { archivedAt: null }, orderBy: { version: "asc" } } },
          }),
          prisma.gradeItem.findMany({
            where: { institutionId: user.institutionId, assignmentId: selected.id },
            select: { studentId: true, score: true, maxScore: true, status: true, feedback: true },
          }),
        ])
      : [[], []];
    const reviewStates = submissions.length
      ? await prisma.sisScreenState.findMany({
          where: { institutionId: user.institutionId, path: { in: submissions.map((submission) => `submission:review:${submission.id}`) } },
        })
      : [];
    const reviewBySubmission = new Map(reviewStates.map((state) => {
      try {
        const parsed = JSON.parse(state.payloadJson) as { history?: unknown[] };
        return [state.path.slice("submission:review:".length), Array.isArray(parsed.history) ? parsed.history : []] as const;
      } catch {
        return [state.path.slice("submission:review:".length), [] as unknown[]] as const;
      }
    }));
    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const gradeByStudent = new Map(grades.map((g) => [g.studentId, g]));

    res.json({
      section: { id: section.id, code: section.course.code, title: section.course.title },
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt?.toISOString() ?? null,
        maxScore: Number(a.maxScore),
        hidden: a.hidden,
      })),
      assignmentId: selected?.id ?? null,
      rows: enrolments.map((e) => {
        const submission = submissionByStudent.get(e.studentId);
        const grade = gradeByStudent.get(e.studentId);
        return {
          studentId: e.studentId,
          name: `${e.student.person.givenName} ${e.student.person.familyName}`.trim(),
          studentNumber: e.student.studentNumber,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                submittedAt: submission.submittedAt?.toISOString() ?? null,
                textBody: submission.textBody ?? null,
                reviewHistory: reviewBySubmission.get(submission.id) ?? [],
                files: submission.files.map((f) => ({
                  id: f.id,
                  filename: f.filename,
                  mimeType: f.mimeType,
                  sizeBytes: f.sizeBytes,
                  version: f.version,
                  createdAt: f.createdAt.toISOString(),
                })),
              }
            : null,
          grade: grade
            ? {
                score: grade.score == null ? null : Number(grade.score),
                maxScore: Number(grade.maxScore),
                status: grade.status,
                feedback: grade.feedback ?? null,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.get("/submission-files/:fileId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const file = await prisma.fileObject.findFirst({
      where: { id: String(req.params.fileId), institutionId: user.institutionId, archivedAt: null },
      include: { submission: { select: { assignment: { select: { sectionId: true } } } } },
    });
    if (!file) throw httpError("Submission file not found", "NOT_FOUND", 404);
    await sectionForReviewer(user, file.submission.assignment.sectionId);
    const content = await readSubmissionFile(file.path);
    res.json({ name: file.filename, mime: file.mimeType, base64: content.toString("base64") });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.post("/submissions/:submissionId/action", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const body = SubmissionAction.parse(req.body);
    if (body.action === "grant_extension" && !body.extensionUntil) {
      throw httpError("Extension date is required", "VALIDATION_ERROR", 400);
    }
    if (body.action === "apply_penalty" && body.penaltyPercent == null) {
      throw httpError("Penalty percentage is required", "VALIDATION_ERROR", 400);
    }
    const submission = await prisma.submission.findFirst({
      where: { id: String(req.params.submissionId), institutionId: user.institutionId },
      include: { assignment: { select: { sectionId: true } } },
    });
    if (!submission) throw httpError("Submission not found", "NOT_FOUND", 404);
    await sectionForReviewer(user, submission.assignment.sectionId);
    const status = body.action === "return" ? "returned" : body.action === "unsubmit" ? "draft" : submission.status;
    const metadataPath = `submission:review:${submission.id}`;
    let adjustedScore: number | null = null;
    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submission.id },
        data: { status, submittedAt: body.action === "unsubmit" ? null : submission.submittedAt, rowVersion: { increment: 1 } },
      });
      if (body.action === "apply_penalty" && body.penaltyPercent) {
        const grade = await tx.gradeItem.findFirst({
          where: { institutionId: user.institutionId, assignmentId: submission.assignmentId, studentId: submission.studentId },
        });
        if (grade?.score != null) {
          adjustedScore = Math.max(0, Math.round(Number(grade.score) * (1 - body.penaltyPercent / 100) * 100) / 100);
          await tx.gradeItem.update({
            where: { id: grade.id },
            data: {
              score: adjustedScore,
              feedback: [grade.feedback, `${body.penaltyPercent}% late penalty: ${body.reason}`].filter(Boolean).join("\n"),
              rowVersion: { increment: 1 },
            },
          });
        }
      }
      const prior = await tx.sisScreenState.findUnique({
        where: { institutionId_path: { institutionId: user.institutionId, path: metadataPath } },
      });
      let history: unknown[] = [];
      try {
        const parsed = prior ? JSON.parse(prior.payloadJson) as { history?: unknown[] } : null;
        history = Array.isArray(parsed?.history) ? parsed.history : [];
      } catch { /* start a clean review history if legacy data is invalid */ }
      const review = { ...body, status, actedAt: new Date().toISOString(), actorId: user.accountId };
      const payloadJson = JSON.stringify({ history: [...history, review].slice(-100) });
      await tx.sisScreenState.upsert({
        where: { institutionId_path: { institutionId: user.institutionId, path: metadataPath } },
        create: { institutionId: user.institutionId, path: metadataPath, payloadJson },
        update: { payloadJson, rowVersion: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          id: randomUUID(), institutionId: user.institutionId, actorId: user.accountId,
          eventName: `Submission.${body.action}`, purpose: "instructor_mutation",
          beforeJson: JSON.stringify({ status: submission.status }), afterJson: JSON.stringify({ status, ...body }),
          source: "instructor.submissions", correlationId: (req as unknown as AuthedRequest).correlationId,
        },
      });
    });
    res.json({ ok: true, status, action: body.action, adjustedScore });
  } catch (error) {
    next(error);
  }
});
