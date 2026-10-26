import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { StudentAssignmentsResponse, UploadStudentSubmissionFileResponse } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const claims = vi.hoisted(
  () =>
    ({
      sub: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
      personId: "00000000-0000-4000-8000-000000000003",
      institutionId: "00000000-0000-4000-8000-000000000004",
      roles: ["student"],
      sessionId: "00000000-0000-4000-8000-000000000005",
    }) satisfies SessionClaims,
);

const tx = vi.hoisted(() => ({
  submission: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  fileObject: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn(), findMany: vi.fn() },
  assignment: { findMany: vi.fn() },
  sisScreenState: { findMany: vi.fn(), findUnique: vi.fn() },
  fileObject: { findFirst: vi.fn() },
  institution: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "student-journey-correlation" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { studentRouter } from "./student.router.js";

const studentId = "10000000-0000-4000-8000-000000000001";
const assignmentId = "20000000-0000-4000-8000-000000000001";
const submissionId = "30000000-0000-4000-8000-000000000001";

const assignment = {
  id: assignmentId,
  institutionId: claims.institutionId,
  sectionId: "40000000-0000-4000-8000-000000000001",
  title: "Project 1",
  maxScore: 100,
  weightPercent: 20,
  dueAt: new Date("2099-10-15T23:59:00.000Z"),
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  rowVersion: 1,
  section: {
    course: { code: "CS301", title: "Algorithms" },
  },
  submissions: [
    {
      id: submissionId,
      institutionId: claims.institutionId,
      assignmentId,
      studentId,
      submittedAt: null,
      status: "draft",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      rowVersion: 1,
      files: [],
    },
  ],
  gradeItems: [],
};

let server: Server;
let apiBaseUrl: string;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "heritage-student-test-"));
  process.env.FILE_STORAGE_ROOT = storageRoot;
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use("/student", studentRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  apiBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(storageRoot, { recursive: true, force: true });
  delete process.env.FILE_STORAGE_ROOT;
});

beforeEach(() => {
  vi.clearAllMocks();
  db.sisScreenState.findMany.mockResolvedValue([]);
  db.student.findMany.mockResolvedValue([{ id: studentId, _count: { enrolments: 1 } }]);
  db.student.findFirst.mockResolvedValue({ id: studentId });
  db.assignment.findMany.mockResolvedValue([assignment]);
  db.fileObject.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.submission.upsert.mockResolvedValue(assignment.submissions[0]);
  tx.fileObject.create.mockResolvedValue({});
  tx.fileObject.findFirst.mockResolvedValue(null);
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("student assignment journey", () => {
  it("lists only the assignments returned by the enrolment-scoped query", async () => {
    const response = await fetch(`${apiBaseUrl}/student/assignments`);
    expect(response.status).toBe(200);
    const payload = StudentAssignmentsResponse.parse(await response.json());
    expect(payload.assignments).toHaveLength(1);
    expect(payload.assignments[0]).toMatchObject({ id: assignmentId, courseCode: "CS301" });
    expect(db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          institutionId: claims.institutionId,
          section: expect.objectContaining({ institutionId: claims.institutionId }),
        }),
      }),
    );
  });

  it("does not list or open an assignment restricted to another student", async () => {
    const otherStudentId = "10000000-0000-4000-8000-000000000099";
    const restrictions = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [otherStudentId] }] });
    db.sisScreenState.findMany.mockResolvedValue([
      {
        path: `/instructor/sections/${assignment.sectionId}`,
        payloadJson: JSON.stringify({
          topicActivities: {
            "topic-1": [
              { id: "act-1", assignmentId, settings: { "Access restrictions": restrictions } },
            ],
          },
        }),
      },
    ]);

    const list = await fetch(`${apiBaseUrl}/student/assignments`);
    expect(list.status).toBe(200);
    expect(StudentAssignmentsResponse.parse(await list.json()).assignments).toHaveLength(0);

    const detail = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}`);
    expect(detail.status).toBe(404);
  });

  it("uploads a validated file and writes audit/outbox in the same transaction", async () => {
    const now = new Date("2026-09-15T20:00:00.000Z");
    tx.submission.findUniqueOrThrow.mockResolvedValue({
      ...assignment.submissions[0],
      files: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          filename: "project.pdf",
          mimeType: "application/pdf",
          sizeBytes: 9,
          version: 1,
          createdAt: now,
        },
      ],
    });
    const content = Buffer.from("%PDF-1.4\n");
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: "project.pdf",
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        contentBase64: content.toString("base64"),
      }),
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(() => UploadStudentSubmissionFileResponse.parse(payload)).not.toThrow();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: claims.institutionId,
        eventName: "StudentSubmission.fileUploaded",
        correlationId: "student-journey-correlation",
      }),
    });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "StudentSubmission.fileUploaded" }),
    });
  });

  it("rejects a disguised file before creating a database transaction", async () => {
    const content = Buffer.from("not a pdf");
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: "project.pdf",
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        contentBase64: content.toString("base64"),
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("turns a concurrent-upload version clash into a clean 409", async () => {
    tx.fileObject.create.mockRejectedValue(
      Object.assign(new Error("Invalid `tx.fileObject.create()` invocation in /srv/app/student.router.ts"), { code: "P2002" }),
    );
    const content = Buffer.from("%PDF-1.4\n");
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: "project.pdf",
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        contentBase64: content.toString("base64"),
      }),
    });
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message).toBe("This file is already being uploaded, refresh and try again");
    expect(JSON.stringify(payload)).not.toContain("/srv/");
  });

  it("refuses files over 10 MiB with 413 before touching the database", async () => {
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: "big.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
        contentBase64: "JVBERi0=",
      }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { message: "This file is 11 MB. Files must be 10 MB or smaller" },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not reveal or archive a file outside the student's ownership scope", async () => {
    db.fileObject.findFirst.mockResolvedValue(null);
    const response = await fetch(
      `${apiBaseUrl}/student/submission-files/60000000-0000-4000-8000-000000000001`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

async function uploadFile(filename: string, content: Buffer, mimeType = "application/pdf") {
  const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/files`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename,
      mimeType,
      sizeBytes: content.byteLength,
      contentBase64: content.toString("base64"),
    }),
  });
  return { status: response.status, body: (await response.json()) as { error?: { message: string; code: string } } };
}

describe("upload rejections explain the reason", () => {
  it("names a file type that is not accepted", async () => {
    const { status, body } = await uploadFile("notes.txt", Buffer.from("hello"), "text/plain");
    expect(status).toBe(400);
    expect(body.error?.message).toMatch(/^"\.txt" files are not accepted\. Upload a PDF, Word/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("says the content does not match the extension", async () => {
    const { status, body } = await uploadFile("report.pdf", Buffer.from("plain text pretending"));
    expect(status).toBe(400);
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(body.error?.message).toContain('The content of "report.pdf" does not match its .pdf type');
  });

  it("trusts the extension over an unreliable browser MIME type", async () => {
    tx.submission.findUniqueOrThrow.mockResolvedValue({ ...assignment.submissions[0], files: [] });
    const { status } = await uploadFile("marks.csv", Buffer.from("a,b\n1,2\n"), "application/vnd.ms-excel");
    expect(status).toBe(201);
    expect(tx.fileObject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ filename: "marks.csv", mimeType: "text/csv" }),
    });
  });

  it("accepts a real ZIP archive", async () => {
    tx.submission.findUniqueOrThrow.mockResolvedValue({ ...assignment.submissions[0], files: [] });
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    const { status } = await uploadFile("work.zip", zip, "application/x-zip-compressed");
    expect(status).toBe(201);
  });
});

describe("instructor assignment settings are enforced", () => {
  const pdf = Buffer.from("%PDF-1.4\n");

  it("rejects types outside the assignment's accepted list", async () => {
    db.assignment.findMany.mockResolvedValue([{ ...assignment, acceptedTypes: ".docx,.zip" }]);
    const { status, body } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(400);
    expect(body.error?.message).toBe('This assignment only accepts .docx, .zip files. ".pdf" is not one of them.');
  });

  it("rejects files above the assignment size limit", async () => {
    db.assignment.findMany.mockResolvedValue([{ ...assignment, maxFileBytes: 4 }]);
    const { status, body } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(413);
    expect(body.error?.message).toMatch(/This assignment accepts files up to/);
  });

  it("rejects uploads past the maximum number of files", async () => {
    const withFile = {
      ...assignment,
      maxFiles: 1,
      submissions: [{ ...assignment.submissions[0], files: [{ id: "f1", version: 1 }] }],
    };
    db.assignment.findMany.mockResolvedValue([withFile]);
    const { status, body } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(409);
    expect(body.error?.message).toBe("This assignment accepts at most 1 file. Remove a file before uploading another.");
  });

  it("rejects file uploads when only online text is allowed", async () => {
    db.assignment.findMany.mockResolvedValue([{ ...assignment, fileSubmissions: false, onlineText: true }]);
    const { status, body } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(400);
    expect(body.error?.message).toBe("This assignment accepts online text only, not file uploads");
  });

  it("keeps submissions closed before the open date", async () => {
    db.institution.findFirst.mockResolvedValue({ timezone: "America/Vancouver" });
    db.assignment.findMany.mockResolvedValue([{ ...assignment, availableFrom: new Date("2099-07-01T07:00:00.000Z") }]);
    const { status, body } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(409);
    expect(body.error?.message).toBe("Submissions open on Jul 1, 2099, 12:00 AM");
  });

  it("allows late uploads until the cut-off date", async () => {
    tx.submission.findUniqueOrThrow.mockResolvedValue({ ...assignment.submissions[0], files: [] });
    db.assignment.findMany.mockResolvedValue([
      { ...assignment, dueAt: new Date("2020-01-01T00:00:00.000Z"), cutoffAt: new Date("2099-01-01T00:00:00.000Z") },
    ]);
    const { status } = await uploadFile("essay.pdf", pdf);
    expect(status).toBe(201);
  });

  it("hides hidden assignments unless a published grade exists", async () => {
    await fetch(`${apiBaseUrl}/student/assignments`);
    expect(db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ hidden: false }, { gradeItems: { some: expect.objectContaining({ status: "published" }) } }],
        }),
      }),
    );
  });
});

describe("published marks and own files", () => {
  it("shows the published mark and feedback on the assignment detail", async () => {
    db.assignment.findMany.mockResolvedValue([
      {
        ...assignment,
        instructions: "Write 500 words",
        gradeItems: [
          { id: "g1", score: 42, maxScore: 50, letter: "A-", feedback: "Strong analysis", publishedAt: new Date("2026-10-01T00:00:00.000Z") },
        ],
      },
    ]);
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}`);
    expect(response.status).toBe(200);
    const { assignment: body } = (await response.json()) as { assignment: Record<string, unknown> };
    expect(body).toMatchObject({
      state: "graded",
      instructions: "Write 500 words",
      grade: { score: 42, maxScore: 50, letter: "A-", feedback: "Strong analysis" },
    });
    expect(db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          gradeItems: expect.objectContaining({ where: expect.objectContaining({ status: "published" }) }),
        }),
      }),
    );
  });

  it("does not return a grade before it is published", async () => {
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}`);
    const { assignment: body } = (await response.json()) as { assignment: Record<string, unknown> };
    expect(body.grade).toBeNull();
  });

  it("downloads only the student's own submission file", async () => {
    db.fileObject.findFirst.mockResolvedValue(null);
    const missing = await fetch(`${apiBaseUrl}/student/submission-files/60000000-0000-4000-8000-000000000001`);
    expect(missing.status).toBe(404);
    expect(db.fileObject.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ submission: { institutionId: claims.institutionId, studentId } }),
    });
  });

  it("returns the stored bytes for an owned file", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const relative = path.join("inst", "own-file-1");
    await mkdir(path.join(storageRoot, "inst"), { recursive: true });
    await writeFile(path.join(storageRoot, relative), "%PDF-1.4\n");
    db.fileObject.findFirst.mockResolvedValue({ id: "f1", filename: "mine.pdf", mimeType: "application/pdf", path: relative });
    const response = await fetch(`${apiBaseUrl}/student/submission-files/f1`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string; base64: string };
    expect(body.name).toBe("mine.pdf");
    expect(Buffer.from(body.base64, "base64").toString()).toBe("%PDF-1.4\n");
  });

  it("refuses a stored path that escapes the storage root", async () => {
    db.fileObject.findFirst.mockResolvedValue({ id: "f2", filename: "x.pdf", mimeType: "application/pdf", path: "../../etc/passwd" });
    const response = await fetch(`${apiBaseUrl}/student/submission-files/f2`);
    expect(response.status).toBe(404);
  });

  it("submits online text without a file when the assignment allows it", async () => {
    db.assignment.findMany.mockResolvedValue([
      {
        ...assignment,
        onlineText: true,
        submissions: [{ ...assignment.submissions[0], textBody: "My answer", files: [] }],
      },
    ]);
    tx.submission.updateMany.mockResolvedValue({ count: 1 });
    tx.submission.findUniqueOrThrow.mockResolvedValue({
      ...assignment.submissions[0],
      status: "submitted",
      submittedAt: new Date(),
      textBody: "My answer",
      files: [],
    });
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ submission: { status: "submitted", textBody: "My answer" } });
    expect(tx.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "submitted" }) }),
    );
  });

  it("still requires a file when online text is not enabled", async () => {
    const response = await fetch(`${apiBaseUrl}/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: "Upload at least one file before submitting" } });
  });
});
