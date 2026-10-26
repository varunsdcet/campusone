import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  MAX_STUDENT_FILE_BYTES,
  StudentAssignmentSummary,
  StudentAssignmentsResponse,
  StudentQuizAttemptResponse,
  SubmitStudentAssignmentResponse,
  UploadStudentSubmissionFileRequest,
  UploadStudentSubmissionFileResponse,
} from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { confirmFeeCheckout, createFeeCheckout } from "./finance.payments.js";
import {
  createStudentServiceRequest,
  cancelStudentServiceRequest,
  getOrCreateLabNotebook,
  getStudentLecture,
  listStudentAssessments,
  listStudentAttendance,
  listStudentCredentials,
  listStudentFinance,
  listStudentPracticum,
  listStudentResources,
  listStudentServiceRequests,
  listStudentSessions,
  listStudentWorkshops,
  registerStudentWorkshop,
  cancelStudentWorkshop,
  joinStudentWorkshop,
  requireStudent,
  listLeaveOfAbsence,
  createLeaveOfAbsence,
  cancelLeaveOfAbsence,
  listRequiredTasks,
  completeRequiredTask,
  submitRequiredTaskEvidence,
  listTaxDocuments,
  getStudentTaxPdf,
  listExtracurricular,
  listStudentBadges,
  listStudentCareer,
  buildFinanceStatement,
  logPracticumHours,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  upsertLabNotebook,
} from "./surfaces.service.js";
import {
  composeMail,
  createCustomMailFolder,
  getCourseEvaluation,
  getMailboxSettings,
  getStudentCourseLms,
  listAudienceAccounts,
  listMailbox,
  listStudentCalendars,
  replyMail,
  submitStudentChoiceResponse,
  submitCourseEvaluation,
  updateMailboxSettings,
} from "./wave3.service.js";
import { sessionJoinUrl } from "../../lib/liveClass.js";
import { institutionTimezone } from "../../lib/workshopPolicy.js";
import { DEFAULT_TZ } from "../courses/sectionSchedule.js";
import { bytesMatchMime, decodeBase64 } from "../../lib/fileSniff.js";
import { readSubmissionFile, submissionStorageRoot } from "../../lib/submissionFiles.js";
import { currentStudentId } from "../me/studentAlignment.js";
import { submitQuizAttempt } from "../instructor/lmsQuiz.js";
import { studentCanAccessLinkedAssignment } from "../instructor/lmsAccessRestrictions.js";
import { assertPermission, type PermissionModuleKey } from "../admin/superAdmin.service.js";

export const studentRouter: Router = Router();

const STUDENT_ACCESS_PATHS: Array<[RegExp, PermissionModuleKey]> = [
  [/^\/(finance|tax-documents)(\/|$)/, "financialManagement"],
  [/^\/(documents|credentials|extracurricular|required-tasks|compliance)(\/|$)/, "studentRecords"],
  [/^\/(services|leave-of-absence)(\/|$)/, "userRequests"],
];

studentRouter.use(async (req, res, next) => {
  const hit = STUDENT_ACCESS_PATHS.find(([pattern]) => pattern.test(req.path));
  if (!hit) return next();
  return requireAuth(req, res, (authError?: unknown) => {
    if (authError) return next(authError);
    return requireRoles("student")(req, res, async (roleError?: unknown) => {
      if (roleError) return next(roleError);
      try { await assertPermission((req as AuthedRequest).user, hit[1], req.method === "GET" ? "view" : "edit"); next(); } catch (error) { next(error); }
    });
  });
});

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
};

const ALLOWED_TYPES_LABEL = "PDF, Word (.doc, .docx), Excel (.xls, .xlsx), CSV, PNG, JPEG or ZIP";

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

function formatMegabytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

function assertUploadSize(body: unknown) {
  const { sizeBytes, contentBase64 } = (body ?? {}) as { sizeBytes?: unknown; contentBase64?: unknown };
  const tooLarge =
    (typeof sizeBytes === "number" && sizeBytes > MAX_STUDENT_FILE_BYTES) ||
    (typeof contentBase64 === "string" && contentBase64.length > Math.ceil(MAX_STUDENT_FILE_BYTES / 3) * 4);
  if (tooLarge) {
    const size = typeof sizeBytes === "number" ? `This file is ${formatMegabytes(sizeBytes)}. ` : "";
    throw httpError(`${size}Files must be 10 MB or smaller`, "FILE_TOO_LARGE", 413);
  }
}

/**
 * Names the actual problem (type, size, content) instead of a generic validation failure. The file's
 * extension decides its type; the declared browser MIME type is unreliable (e.g. CSV sent as Excel).
 */
function parseUploadBody(body: unknown) {
  const raw = (body ?? {}) as { filename?: unknown; mimeType?: unknown };
  const filename = typeof raw.filename === "string" ? raw.filename.trim() : "";
  if (!filename) throw httpError("Choose a file to upload", "VALIDATION_ERROR", 400);
  if (path.basename(filename) !== filename || filename.includes("\0")) {
    throw httpError("The file name must not contain folder separators", "VALIDATION_ERROR", 400);
  }
  const extension = path.extname(filename).toLowerCase();
  const mimeType = mimeByExtension[extension];
  if (!mimeType) {
    throw httpError(
      `${extension ? `"${extension}" files are` : "Files without an extension are"} not accepted. Upload a ${ALLOWED_TYPES_LABEL} file.`,
      "VALIDATION_ERROR",
      400,
    );
  }
  const parsed = UploadStudentSubmissionFileRequest.safeParse({ ...(body as object), filename, mimeType });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    const message =
      field === "filename"
        ? "The file name must be 255 characters or fewer"
        : field === "sizeBytes"
          ? "The file is empty or its size could not be read. Choose the file again."
          : field === "contentBase64"
            ? "The file content was not received. Choose the file again."
            : "The upload could not be read. Choose the file again.";
    throw Object.assign(httpError(message, "VALIDATION_ERROR", 400), { issues: parsed.error.issues });
  }
  return parsed.data;
}

function decodeAndValidateFile(input: ReturnType<typeof parseUploadBody>) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64) || input.contentBase64.length % 4 !== 0) {
    throw httpError("The file content was damaged during upload. Choose the file again.", "VALIDATION_ERROR", 400);
  }
  const content = decodeBase64(input.contentBase64);
  if (content.byteLength !== input.sizeBytes) {
    throw httpError("The file was only partly received. Choose the file again.", "VALIDATION_ERROR", 400);
  }
  if (!bytesMatchMime(content, input.mimeType)) {
    const extension = path.extname(input.filename).toLowerCase();
    throw httpError(
      `The content of "${input.filename}" does not match its ${extension} type. It may have been renamed from another format or be damaged — export or save it again as a real ${extension} file.`,
      "VALIDATION_ERROR",
      400,
    );
  }
  return content;
}

type SubmissionRules = {
  fileSubmissions: boolean;
  maxFiles: number | null;
  maxFileBytes: number | null;
  acceptedTypes: string | null;
};

/** Per-assignment limits set by the instructor in the course workspace. */
function assertAssignmentFileRules(rules: SubmissionRules, input: { filename: string; sizeBytes: number }, activeFiles: number) {
  if (!rules.fileSubmissions) {
    throw httpError("This assignment accepts online text only, not file uploads", "VALIDATION_ERROR", 400);
  }
  const accepted = (rules.acceptedTypes || "").split(",").map((t) => t.trim()).filter(Boolean);
  const extension = path.extname(input.filename).toLowerCase();
  if (accepted.length && !accepted.includes(extension)) {
    throw httpError(
      `This assignment only accepts ${accepted.join(", ")} files. "${extension}" is not one of them.`,
      "VALIDATION_ERROR",
      400,
    );
  }
  if (rules.maxFileBytes && input.sizeBytes > rules.maxFileBytes) {
    throw httpError(
      `This file is ${formatMegabytes(input.sizeBytes)}. This assignment accepts files up to ${formatMegabytes(rules.maxFileBytes)}.`,
      "FILE_TOO_LARGE",
      413,
    );
  }
  if (rules.maxFiles && activeFiles >= rules.maxFiles) {
    throw httpError(
      `This assignment accepts at most ${rules.maxFiles} file${rules.maxFiles === 1 ? "" : "s"}. Remove a file before uploading another.`,
      "SUBMISSION_LOCKED",
      409,
    );
  }
}

function submissionDeadline(row: { dueAt: Date | null; cutoffAt?: Date | null }) {
  return row.cutoffAt ?? row.dueAt;
}

async function assertSubmissionWindow(institutionId: string, row: { dueAt: Date | null; cutoffAt?: Date | null; availableFrom?: Date | null }) {
  const now = Date.now();
  if (row.availableFrom && row.availableFrom.getTime() > now) {
    const tz = await institutionTimezone(institutionId).catch(() => DEFAULT_TZ);
    const opens = new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(row.availableFrom);
    throw httpError(`Submissions open on ${opens}`, "SUBMISSION_LOCKED", 409);
  }
  const deadline = submissionDeadline(row);
  if (deadline && deadline.getTime() < now) {
    throw httpError("The submission deadline has passed", "SUBMISSION_LOCKED", 409);
  }
}

async function getStudent(user: AuthedRequest["user"]) {
  const student = await prisma.student.findFirst({
    where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
  });
  if (!student) throw httpError("Student record not found", "NOT_FOUND", 404);
  return student;
}

type AssignmentRow = Awaited<ReturnType<typeof getAssignments>>[number];

async function getAssignments(institutionId: string, studentId: string, assignmentId?: string) {
  const rows = await prisma.assignment.findMany({
    where: {
      institutionId,
      ...(assignmentId ? { id: assignmentId } : {}),
      section: {
        institutionId,
        enrolments: { some: { institutionId, studentId, status: { in: ["enrolled", "completed"] } } },
      },
      OR: [{ hidden: false }, { gradeItems: { some: { institutionId, studentId, status: "published" } } }],
    },
    include: {
      section: { include: { course: true } },
      submissions: {
        where: { institutionId, studentId },
        include: { files: { where: { institutionId, archivedAt: null }, orderBy: { version: "asc" } } },
      },
      gradeItems: {
        where: { institutionId, studentId, status: "published" },
        select: { id: true, score: true, maxScore: true, letter: true, feedback: true, publishedAt: true },
      },
    },
    orderBy: [{ dueAt: "asc" }, { title: "asc" }],
  });
  const sectionIds = [...new Set(rows.map((row) => row.sectionId))];
  const candidatePaths = sectionIds.flatMap((sectionId) => [
    `/instructor/sections/${sectionId}`,
    `/instructor/f/t56-active-courses?view=${sectionId}`,
    `/instructor/f/t56-active-courses?view=${encodeURIComponent(sectionId)}`,
  ]);
  const states = candidatePaths.length
    ? await prisma.sisScreenState.findMany({
        where: { institutionId, path: { in: candidatePaths } },
        select: { path: true, payloadJson: true },
      })
    : [];
  const byPath = new Map(states.map((state) => [state.path, state.payloadJson]));
  return rows.filter((row) => {
    const raw =
      byPath.get(`/instructor/sections/${row.sectionId}`) ||
      byPath.get(`/instructor/f/t56-active-courses?view=${row.sectionId}`) ||
      byPath.get(`/instructor/f/t56-active-courses?view=${encodeURIComponent(row.sectionId)}`);
    if (!raw) return true;
    try {
      return studentCanAccessLinkedAssignment(JSON.parse(raw) as Record<string, unknown>, row.id, studentId);
    } catch {
      return false;
    }
  });
}

function presentSubmission(submission: AssignmentRow["submissions"][number] | undefined) {
  if (!submission) return null;
  return {
    id: submission.id,
    status: submission.status as "draft" | "submitted" | "returned",
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    files: submission.files.map((file) => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      version: file.version,
      createdAt: file.createdAt.toISOString(),
    })),
    textBody: submission.textBody ?? null,
  };
}

function presentAssignment(row: AssignmentRow) {
  const submission = row.submissions[0];
  const now = Date.now();
  const dueSoon = row.dueAt != null && row.dueAt.getTime() >= now && row.dueAt.getTime() - now < 72 * 60 * 60 * 1000;
  const deadline = submissionDeadline(row);
  const state = row.gradeItems.length
    ? "graded"
    : submission?.status === "submitted"
      ? "submitted"
      : submission
        ? "draft"
        : deadline && deadline.getTime() < now
          ? "overdue"
          : dueSoon
            ? "due"
            : "upcoming";
  const published = row.gradeItems[0];
  return {
    id: row.id,
    sectionId: row.sectionId,
    courseCode: row.section.course.code,
    courseTitle: row.section.course.title,
    title: row.title,
    dueAt: row.dueAt?.toISOString() ?? null,
    maxScore: row.maxScore,
    weightPercent: row.weightPercent,
    state,
    submission: presentSubmission(submission),
    instructions: row.instructions ?? null,
    availableFrom: row.availableFrom?.toISOString() ?? null,
    cutoffAt: row.cutoffAt?.toISOString() ?? null,
    maxFiles: row.maxFiles ?? null,
    maxFileBytes: row.maxFileBytes ?? null,
    acceptedTypes: (row.acceptedTypes || "").split(",").map((t) => t.trim()).filter(Boolean),
    fileSubmissions: row.fileSubmissions ?? true,
    onlineText: row.onlineText ?? false,
    grade: published
      ? {
          score: published.score,
          maxScore: published.maxScore,
          letter: published.letter,
          feedback: published.feedback ?? null,
          publishedAt: published.publishedAt?.toISOString() ?? null,
        }
      : null,
  };
}

studentRouter.use(requireAuth, requireRoles("student"));

studentRouter.get("/assignments", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const rows = await getAssignments(user.institutionId, student.id);
    res.json(StudentAssignmentsResponse.parse({ assignments: rows.map(presentAssignment) }));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/assignments/:assignmentId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const [row] = await getAssignments(user.institutionId, student.id, req.params.assignmentId);
    if (!row) throw httpError("Assignment not found", "NOT_FOUND", 404);
    res.json({ assignment: StudentAssignmentSummary.parse(presentAssignment(row)) });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/assignments/:assignmentId/files", async (req, res, next) => {
  let storedPath: string | undefined;
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    assertUploadSize(req.body);
    const input = parseUploadBody(req.body);
    const content = decodeAndValidateFile(input);
    const [assignment] = await getAssignments(user.institutionId, student.id, req.params.assignmentId);
    if (!assignment) throw httpError("Assignment not found", "NOT_FOUND", 404);
    if (assignment.gradeItems.length > 0) {
      throw httpError("Graded work is locked", "SUBMISSION_LOCKED", 409);
    }
    await assertSubmissionWindow(user.institutionId, assignment);
    const existing = assignment.submissions[0];
    if (existing?.status === "submitted") {
      throw httpError("The submission is already submitted", "SUBMISSION_LOCKED", 409);
    }
    assertAssignmentFileRules(
      {
        fileSubmissions: assignment.fileSubmissions ?? true,
        maxFiles: assignment.maxFiles ?? null,
        maxFileBytes: assignment.maxFileBytes ?? null,
        acceptedTypes: assignment.acceptedTypes ?? null,
      },
      input,
      existing?.files.length ?? 0,
    );

    const fileId = randomUUID();
    const storageRoot = submissionStorageRoot();

    const submission = await prisma.$transaction(async (tx) => {
      // The upsert locks the submission row, so concurrent uploads number their versions one after another.
      const row = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        create: {
          id: existing?.id ?? randomUUID(),
          institutionId: user.institutionId,
          assignmentId: assignment.id,
          studentId: student.id,
          status: "draft",
        },
        update: { rowVersion: { increment: 1 } },
      });
      const latestFile = await tx.fileObject.findFirst({
        where: { institutionId: user.institutionId, submissionId: row.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latestFile?.version ?? 0) + 1;
      const relativePath = path.join(user.institutionId, student.id, assignment.id, row.id, `${fileId}-${version}`);
      storedPath = path.resolve(storageRoot, relativePath);
      if (!storedPath.startsWith(`${storageRoot}${path.sep}`)) {
        throw httpError("Invalid storage path", "VALIDATION_ERROR", 400);
      }
      await mkdir(path.dirname(storedPath), { recursive: true });
      await writeFile(storedPath, content, { flag: "wx" });
      await tx.fileObject.create({
        data: {
          id: fileId,
          institutionId: user.institutionId,
          submissionId: row.id,
          path: relativePath,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          version,
        },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "StudentSubmission.fileUploaded",
        purpose: "assignment_submission",
        before: null,
        after: { submissionId: row.id, assignmentId: assignment.id, fileId, version },
        source: "student.assignments",
        correlationId: (req as unknown as AuthedRequest).correlationId,
      });
      return tx.submission.findUniqueOrThrow({
        where: { id: row.id },
        include: { files: { where: { archivedAt: null }, orderBy: { version: "asc" } } },
      });
    });

    res.status(201).json(
      UploadStudentSubmissionFileResponse.parse({ submission: presentSubmission(submission) }),
    );
  } catch (error) {
    if (storedPath) await unlink(storedPath).catch(() => undefined);
    next(
      (error as { code?: unknown }).code === "P2002"
        ? httpError("This file is already being uploaded, refresh and try again", "CONFLICT", 409)
        : error,
    );
  }
});

studentRouter.delete("/submission-files/:fileId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const file = await prisma.fileObject.findFirst({
      where: {
        id: req.params.fileId,
        institutionId: user.institutionId,
        archivedAt: null,
        submission: { institutionId: user.institutionId, studentId: student.id },
      },
      include: {
        submission: {
          include: {
            assignment: {
              include: {
                gradeItems: {
                  where: { institutionId: user.institutionId, studentId: student.id, status: "published" },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!file) throw httpError("Submission file not found", "NOT_FOUND", 404);
    if (
      file.submission.status !== "draft" ||
      file.submission.assignment.gradeItems.length > 0 ||
      (submissionDeadline(file.submission.assignment)?.getTime() ?? Infinity) < Date.now()
    ) {
      throw httpError("The submission file is locked", "SUBMISSION_LOCKED", 409);
    }

    const archivedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.fileObject.update({
        where: { id: file.id },
        data: { archivedAt, rowVersion: { increment: 1 } },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "StudentSubmission.fileArchived",
        purpose: "assignment_submission",
        before: { archivedAt: null },
        after: { archivedAt: archivedAt.toISOString(), fileId: file.id, submissionId: file.submissionId },
        source: "student.assignments",
        correlationId: (req as unknown as AuthedRequest).correlationId,
      });
    });
    res.json({ archived: true, fileId: file.id });
  } catch (error) {
    next(error);
  }
});

studentRouter.put("/assignments/:assignmentId/text", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const text = typeof req.body?.text === "string" ? req.body.text : null;
    if (text == null) throw httpError("Online text is required", "VALIDATION_ERROR", 400);
    if (text.length > 50_000) throw httpError("Online text must be 50,000 characters or fewer", "VALIDATION_ERROR", 400);
    const [assignment] = await getAssignments(user.institutionId, student.id, req.params.assignmentId);
    if (!assignment) throw httpError("Assignment not found", "NOT_FOUND", 404);
    if (!assignment.onlineText) {
      throw httpError("This assignment accepts file uploads only", "VALIDATION_ERROR", 400);
    }
    if (assignment.gradeItems.length > 0) throw httpError("Graded work is locked", "SUBMISSION_LOCKED", 409);
    await assertSubmissionWindow(user.institutionId, assignment);
    const existing = assignment.submissions[0];
    if (existing?.status === "submitted") {
      throw httpError("The submission is already submitted", "SUBMISSION_LOCKED", 409);
    }
    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        create: {
          id: existing?.id ?? randomUUID(),
          institutionId: user.institutionId,
          assignmentId: assignment.id,
          studentId: student.id,
          status: "draft",
          textBody: text,
        },
        update: { textBody: text, rowVersion: { increment: 1 } },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "StudentSubmission.textSaved",
        purpose: "assignment_submission",
        before: null,
        after: { submissionId: row.id, assignmentId: assignment.id, length: text.length },
        source: "student.assignments",
        correlationId: (req as unknown as AuthedRequest).correlationId,
      });
      return tx.submission.findUniqueOrThrow({
        where: { id: row.id },
        include: { files: { where: { archivedAt: null }, orderBy: { version: "asc" } } },
      });
    });
    res.json(UploadStudentSubmissionFileResponse.parse({ submission: presentSubmission(saved) }));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/submission-files/:fileId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const file = await prisma.fileObject.findFirst({
      where: {
        id: req.params.fileId,
        institutionId: user.institutionId,
        archivedAt: null,
        submission: { institutionId: user.institutionId, studentId: student.id },
      },
    });
    if (!file) throw httpError("Submission file not found", "NOT_FOUND", 404);
    const content = await readSubmissionFile(file.path);
    res.json({ name: file.filename, mime: file.mimeType, base64: content.toString("base64") });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/assignments/:assignmentId/submit", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const student = await getStudent(user);
    const [assignment] = await getAssignments(user.institutionId, student.id, req.params.assignmentId);
    if (!assignment) throw httpError("Assignment not found", "NOT_FOUND", 404);
    const submission = assignment.submissions[0];
    const emptyMessage = assignment.onlineText
      ? assignment.fileSubmissions === false
        ? "Write your online text before submitting"
        : "Upload a file or write your online text before submitting"
      : "Upload at least one file before submitting";
    if (!submission) throw httpError(emptyMessage, "VALIDATION_ERROR", 400);
    if (submission.status === "submitted") {
      res.json(SubmitStudentAssignmentResponse.parse({ submission: presentSubmission(submission), alreadySubmitted: true }));
      return;
    }
    if (assignment.gradeItems.length > 0) {
      throw httpError("Graded work is locked", "SUBMISSION_LOCKED", 409);
    }
    const hasText = Boolean(assignment.onlineText && submission.textBody?.trim());
    if (submission.files.length === 0 && !hasText) {
      throw httpError(emptyMessage, "VALIDATION_ERROR", 400);
    }
    await assertSubmissionWindow(user.institutionId, assignment);

    const submittedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.submission.updateMany({
        where: {
          id: submission.id,
          institutionId: user.institutionId,
          studentId: student.id,
          status: "draft",
        },
        data: { status: "submitted", submittedAt, rowVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw httpError("The submission changed; refresh and try again", "CONFLICT", 409);
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "StudentSubmission.submitted",
        purpose: "assignment_submission",
        before: { status: "draft" },
        after: { status: "submitted", submissionId: submission.id, assignmentId: assignment.id },
        source: "student.assignments",
        correlationId: (req as unknown as AuthedRequest).correlationId,
      });
      return tx.submission.findUniqueOrThrow({
        where: { id: submission.id },
        include: { files: { where: { archivedAt: null }, orderBy: { version: "asc" } } },
      });
    });
    res.json(SubmitStudentAssignmentResponse.parse({ submission: presentSubmission(updated), alreadySubmitted: false }));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/courses/:sectionId/content", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const sectionId = String(req.params.sectionId);
    const student = await requireStudent(user, sectionId).catch(() => null);
    if (!student) {
      res.status(404).json({ error: { message: "Student record not found" } });
      return;
    }
    const enrolment = await prisma.enrolment.findFirst({
      where: { institutionId: user.institutionId, studentId: student.id, sectionId, status: "enrolled" },
      include: {
        section: {
          include: {
            course: true,
            assignments: { orderBy: { dueAt: "asc" } },
            classSessions: { orderBy: { startsAt: "asc" } },
          },
        },
      },
    });
    if (!enrolment) {
      res.status(404).json({ error: { message: "Section not in your enrolment" } });
      return;
    }
    const progressPath = `/student/content-progress/${user.accountId}/${sectionId}`;
    const state = await prisma.sisScreenState.findUnique({
      where: { institutionId_path: { institutionId: user.institutionId, path: progressPath } },
    });
    const completed = new Set<string>(
      state ? ((JSON.parse(state.payloadJson) as { completed?: string[] }).completed ?? []) : [],
    );
    const accessStates = await prisma.sisScreenState.findMany({
      where: {
        institutionId: user.institutionId,
        path: {
          in: [
            `/instructor/sections/${sectionId}`,
            `/instructor/f/t56-active-courses?view=${sectionId}`,
            `/instructor/f/t56-active-courses?view=${encodeURIComponent(sectionId)}`,
          ],
        },
      },
      select: { path: true, payloadJson: true },
    });
    const preferredAccessState =
      accessStates.find((row) => row.path === `/instructor/sections/${sectionId}`) || accessStates[0];
    let accessOverlay: Record<string, unknown> | null = null;
    let accessOverlayInvalid = false;
    if (preferredAccessState) {
      try {
        accessOverlay = JSON.parse(preferredAccessState.payloadJson) as Record<string, unknown>;
      } catch {
        accessOverlayInvalid = true;
      }
    }
    const deletedActivityIds = new Set(Array.isArray(accessOverlay?.deletedActivityIds) ? accessOverlay.deletedActivityIds as string[] : []);
    const hiddenActivityIds = new Set(Array.isArray(accessOverlay?.hiddenActivityIds) ? accessOverlay.hiddenActivityIds as string[] : []);
    const topicActivities = accessOverlay?.topicActivities && typeof accessOverlay.topicActivities === "object"
      ? Object.values(accessOverlay.topicActivities as Record<string, unknown[]>).flat()
      : [];
    const extraActivities = Array.isArray(accessOverlay?.extraTopics)
      ? (accessOverlay.extraTopics as Array<{ activities?: unknown[] }>).flatMap((topic) => Array.isArray(topic.activities) ? topic.activities : [])
      : [];
    const overlayActivities = [...topicActivities, ...extraActivities]
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
      .filter((activity) => typeof activity.id === "string" && !deletedActivityIds.has(activity.id) && !hiddenActivityIds.has(activity.id) && activity.hidden !== true);
    const items = [
      ...enrolment.section.classSessions.map((session) => {
        const isLab = session.sessionKind === "lab";
        const detailHref = isLab
          ? `/student/labs`
          : `/student/f/st-11-lecture-detail?sessionId=${session.id}`;
        return {
          id: `session:${session.id}`,
          kind: (isLab ? "lab" : "lecture") as "lecture" | "lab",
          title: session.title,
          detail: `${session.startsAt.toISOString()}${session.location ? ` · ${session.location}` : ""}`,
          href: detailHref,
          joinUrl: sessionJoinUrl(session.sectionId, session.joinUrl),
          completed: completed.has(`session:${session.id}`),
        };
      }),
      ...enrolment.section.assignments
        .filter((assignment) => !accessOverlayInvalid && studentCanAccessLinkedAssignment(accessOverlay, assignment.id, student.id))
        .map((assignment) => ({
        id: `assignment:${assignment.id}`,
        kind: "resource" as const,
        title: assignment.title,
        detail: assignment.dueAt ? `Due ${assignment.dueAt.toISOString()}` : "Assignment resource",
        href: `/student/assignments/${assignment.id}`,
        joinUrl: null as string | null,
        completed: completed.has(`assignment:${assignment.id}`),
        })),
      ...overlayActivities.map((activity) => ({
        id: `activity:${String(activity.id)}`,
        kind: "resource" as const,
        title: String(activity.name || activity.title || "Course activity"),
        detail: String(activity.type || "Activity"),
        href: `/student/courses/${sectionId}?aid=${encodeURIComponent(String(activity.id))}`,
        joinUrl: null as string | null,
        completed: completed.has(`activity:${String(activity.id)}`),
      })),
    ];
    const done = items.filter((i) => i.completed).length;
    res.json({
      sectionId,
      courseCode: enrolment.section.course.code,
      courseTitle: enrolment.section.course.title,
      progressPct: items.length ? Math.round((done / items.length) * 100) : 0,
      completedCount: done,
      totalCount: items.length,
      items,
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/courses/:sectionId/content/:itemId/complete", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const sectionId = String(req.params.sectionId);
    const itemId = decodeURIComponent(String(req.params.itemId));
    const student = await requireStudent(user, sectionId).catch(() => null);
    if (!student) {
      res.status(404).json({ error: { message: "Student record not found" } });
      return;
    }
    const enrolment = await prisma.enrolment.findFirst({
      where: { institutionId: user.institutionId, studentId: student.id, sectionId, status: "enrolled" },
    });
    if (!enrolment) {
      res.status(404).json({ error: { message: "Section not in your enrolment" } });
      return;
    }
    const progressPath = `/student/content-progress/${user.accountId}/${sectionId}`;
    const existing = await prisma.sisScreenState.findUnique({
      where: { institutionId_path: { institutionId: user.institutionId, path: progressPath } },
    });
    const prev = existing ? (JSON.parse(existing.payloadJson) as { completed?: string[] }) : { completed: [] };
    const completed = new Set(prev.completed ?? []);
    completed.add(itemId);
    const payload = { completed: [...completed], updatedAt: new Date().toISOString() };
    await prisma.$transaction(async (tx) => {
      await tx.sisScreenState.upsert({
        where: { institutionId_path: { institutionId: user.institutionId, path: progressPath } },
        create: { institutionId: user.institutionId, path: progressPath, payloadJson: JSON.stringify(payload) },
        update: { payloadJson: JSON.stringify(payload) },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "StudentContent.completed",
        purpose: "course_consumption",
        before: { sectionId, completed: prev.completed ?? [] },
        after: { sectionId, itemId, completed: [...completed] },
        source: "student.content",
        correlationId: randomUUID(),
        outboxPayload: { sectionId, itemId },
      });
    });
    res.json({ ok: true, sectionId, itemId, completed: [...completed] });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/assessments", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentAssessments((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/assessments/:id/start", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(
      await startAssessmentAttempt(user, String(req.params.id), (req as AuthedRequest).correlationId),
    );
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/assessments/attempts/:id/submit", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(
      await submitAssessmentAttempt(user, String(req.params.id), req.body, (req as AuthedRequest).correlationId),
    );
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/attendance", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentAttendance((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/lectures", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentSessions((req as AuthedRequest).user, "lecture"));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/lectures/:id", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json({ lecture: await getStudentLecture((req as AuthedRequest).user, String(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/labs", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentSessions((req as AuthedRequest).user, "lab"));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/labs/access", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const { getStudentLabAccess } = await import("../labs/lab-flow.service.js");
    res.json(await getStudentLabAccess((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/labs/virtual/:id/launch", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const { launchStudentVirtualLab } = await import("../labs/lab-flow.service.js");
    res.json(await launchStudentVirtualLab((req as AuthedRequest).user, String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/labs/:sessionId/notebook", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await getOrCreateLabNotebook((req as AuthedRequest).user, String(req.params.sessionId)));
  } catch (error) {
    next(error);
  }
});

studentRouter.put("/labs/:sessionId/notebook", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(
      await upsertLabNotebook(
        user,
        String(req.params.sessionId),
        req.body,
        (req as AuthedRequest).correlationId,
      ),
    );
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/services", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentServiceRequests((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/services", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(
      await createStudentServiceRequest(user, req.body, (req as AuthedRequest).correlationId),
    );
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/services/:id/cancel", requireAuth, requireRoles("student"), async (req, res, next) => {
  try { const user = (req as AuthedRequest).user; res.json(await cancelStudentServiceRequest(user, String(req.params.id), (req as AuthedRequest).correlationId)); } catch (error) { next(error); }
});

studentRouter.get("/practicum", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentPracticum((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/practicum/hours", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(await logPracticumHours(user, req.body, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/finance", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const termId = typeof req.query.financialTermId === "string" ? req.query.financialTermId : null;
    res.json(await listStudentFinance((req as AuthedRequest).user, termId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/finance/checkout", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.status(201).json(await createFeeCheckout((req as AuthedRequest).user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/finance/checkout/confirm", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await confirmFeeCheckout((req as AuthedRequest).user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/finance/receipts/:entryId", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await getStudent(user);
    const { receipt } = await import("../admin/heritage/students.finance.js");
    const { sendPdf } = await import("../../lib/taxPdf.js");
    const document = await receipt(user, student.id, String(req.params.entryId));
    sendPdf(res, document.pdf, document.filename);
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/calendars", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentCalendars((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/courses/:sectionId/lms", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await getStudentCourseLms((req as AuthedRequest).user, String(req.params.sectionId)));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/courses/:sectionId/quizzes/:activityId/attempts", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await requireStudent(user, String(req.params.sectionId));
    const result = await submitQuizAttempt(
      user,
      student,
      String(req.params.sectionId),
      String(req.params.activityId),
      req.body,
      (req as AuthedRequest).correlationId,
    );
    res.status(201).json(StudentQuizAttemptResponse.parse(result));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/courses/:sectionId/choices/:activityId/responses", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const result = await submitStudentChoiceResponse(
      (req as AuthedRequest).user,
      String(req.params.sectionId),
      String(req.params.activityId),
      req.body,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/evaluations/:id", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json({ evaluation: await getCourseEvaluation((req as AuthedRequest).user, String(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/evaluations/:id/submit", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(
      await submitCourseEvaluation(user, String(req.params.id), req.body, (req as AuthedRequest).correlationId),
    );
  } catch (error) {
    next(error);
  }
});

const requireStudentMailAccess = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const { assertPermission } = await import("../admin/superAdmin.service.js");
    await assertPermission((req as AuthedRequest).user, "emailMessaging", req.method === "GET" ? "view" : "edit");
    next();
  } catch (error) {
    next(error);
  }
};

studentRouter.get("/mail", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    const folderId = typeof req.query.folderId === "string" ? req.query.folderId : null;
    res.json(await listMailbox((req as AuthedRequest).user, folderId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/mail/folders", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    res.status(201).json(await createCustomMailFolder((req as AuthedRequest).user, req.body));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/mail/compose", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(await composeMail(user, req.body, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/mail/threads/:threadId/reply", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const threadId = String(req.params.threadId || "");
    res.json(await replyMail(user, threadId, req.body, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/mail/settings", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    res.json({ settings: await getMailboxSettings((req as AuthedRequest).user) });
  } catch (error) {
    next(error);
  }
});

studentRouter.patch("/mail/settings", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    res.json({ settings: await updateMailboxSettings((req as AuthedRequest).user, req.body) });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/mail/audience", requireAuth, requireRoles("student"), requireStudentMailAccess, async (req, res, next) => {
  try {
    res.json(await listAudienceAccounts((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/credentials", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentCredentials((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/resources", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentResources((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/workshops", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentWorkshops((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/workshops/register", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(await registerStudentWorkshop(user, req.body, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/workshops/:id/cancel", requireAuth, requireRoles("student"), async (req, res, next) => {
  try { const user = (req as AuthedRequest).user; res.json(await cancelStudentWorkshop(user, String(req.params.id), (req as AuthedRequest).correlationId)); } catch (error) { next(error); }
});

studentRouter.post("/workshops/:id/join", requireAuth, requireRoles("student"), async (req, res, next) => {
  try { const user = (req as AuthedRequest).user; res.json(await joinStudentWorkshop(user, String(req.params.id), (req as AuthedRequest).correlationId)); } catch (error) { next(error); }
});

studentRouter.get("/leave-of-absence", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listLeaveOfAbsence((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/leave-of-absence", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(await createLeaveOfAbsence(user, req.body, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/leave-of-absence/:id/cancel", requireAuth, requireRoles("student"), async (req, res, next) => {
  try { const user = (req as AuthedRequest).user; res.json(await cancelLeaveOfAbsence(user, String(req.params.id), (req as AuthedRequest).correlationId)); } catch (error) { next(error); }
});

studentRouter.get("/required-tasks", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listRequiredTasks((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/required-tasks/:taskId/complete", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(await completeRequiredTask(user, String(req.params.taskId), (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/required-tasks/:taskId/evidence", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.status(201).json(await submitRequiredTaskEvidence(user, String(req.params.taskId), req.body ?? {}, (req as AuthedRequest).correlationId));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/tax-documents", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listTaxDocuments((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/tax-documents/:id/pdf", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const { sendPdf } = await import("../../lib/taxPdf.js");
    const { pdf, filename } = await getStudentTaxPdf((req as unknown as AuthedRequest).user, String(req.params.id));
    sendPdf(res, pdf, filename);
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/extracurricular", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listExtracurricular((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/documents", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await prisma.student.findFirst({
      where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
    });
    if (!student) {
      res.status(404).json({ error: { message: "Student not found" } });
      return;
    }
    const { listStudentDocumentsForStudent } = await import("../admin/registrar-gaps.service.js");
    res.json(await listStudentDocumentsForStudent(user.institutionId, student.id));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/compliance", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const { listStudentComplianceRecords } = await import("./compliance-records.service.js");
    res.json(await listStudentComplianceRecords((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/badges", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentBadges((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/career", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await listStudentCareer((req as AuthedRequest).user));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/finance/statement", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const termId = typeof req.query.financialTermId === "string" ? req.query.financialTermId : null;
    res.json(await buildFinanceStatement((req as AuthedRequest).user, termId));
  } catch (error) {
    next(error);
  }
});
