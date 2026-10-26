import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { SessionClaims } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  claims: {
    sub: "00000000-0000-4000-8000-000000000031",
    accountId: "00000000-0000-4000-8000-000000000032",
    personId: "00000000-0000-4000-8000-000000000033",
    institutionId: "00000000-0000-4000-8000-000000000034",
    roles: ["instructor"],
    sessionId: "00000000-0000-4000-8000-000000000035",
  } as SessionClaims,
}));

const db = vi.hoisted(() => ({
  section: { findFirst: vi.fn() },
  assignment: { findMany: vi.fn() },
  enrolment: { findMany: vi.fn() },
  submission: { findMany: vi.fn() },
  gradeItem: { findMany: vi.fn() },
  fileObject: { findFirst: vi.fn() },
  sisScreenState: { findMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("./sectionFaculty.js", () => ({
  isFacultyAssigned: vi.fn(async (user: SessionClaims, section: { instructorPersonId: string }) =>
    user.roles.includes("admin") || user.roles.includes("registrar") || section.instructorPersonId === user.personId),
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { submissionsRouter } from "./submissions.router.js";

const sectionId = "40000000-0000-4000-8000-000000000031";
const assignmentId = "50000000-0000-4000-8000-000000000031";
const studentId = "20000000-0000-4000-8000-000000000031";

let server: Server;
let baseUrl: string;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "heritage-submissions-test-"));
  process.env.FILE_STORAGE_ROOT = storageRoot;
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    Object.assign(req, { user: session.claims, correlationId: "submissions-test" });
    next();
  });
  app.use("/instructor", submissionsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await rm(storageRoot, { recursive: true, force: true });
  delete process.env.FILE_STORAGE_ROOT;
});

beforeEach(() => {
  vi.clearAllMocks();
  session.claims = { ...session.claims, roles: ["instructor"] };
  db.section.findFirst.mockResolvedValue({
    id: sectionId,
    instructorPersonId: session.claims.personId,
    course: { code: "CS301", title: "Algorithms" },
  });
  db.assignment.findMany.mockResolvedValue([
    { id: assignmentId, title: "Essay", dueAt: null, maxScore: 100, hidden: false },
  ]);
  db.enrolment.findMany.mockResolvedValue([
    { studentId, student: { studentNumber: "S1", person: { givenName: "Ada", familyName: "Lovelace" } } },
  ]);
  db.submission.findMany.mockResolvedValue([
    {
      id: "sub-1",
      studentId,
      status: "submitted",
      submittedAt: new Date("2026-10-05T10:00:00.000Z"),
      textBody: null,
      files: [
        {
          id: "file-1",
          filename: "essay.pdf",
          mimeType: "application/pdf",
          sizeBytes: 9,
          version: 1,
          createdAt: new Date("2026-10-05T09:00:00.000Z"),
        },
      ],
    },
  ]);
  db.gradeItem.findMany.mockResolvedValue([]);
  db.sisScreenState.findMany.mockResolvedValue([]);
});

describe("instructor submissions", () => {
  it("lists each enrolled student's submission and files for the section instructor", async () => {
    const response = await fetch(`${baseUrl}/instructor/sections/${sectionId}/submissions`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { assignmentId: string; rows: Array<Record<string, unknown>> };
    expect(body.assignmentId).toBe(assignmentId);
    expect(body.rows[0]).toMatchObject({
      name: "Ada Lovelace",
      submission: { status: "submitted", files: [{ id: "file-1", filename: "essay.pdf" }] },
    });
  });

  it("refuses an instructor who does not teach the section", async () => {
    db.section.findFirst.mockResolvedValue({
      id: sectionId,
      instructorPersonId: "someone-else",
      course: { code: "CS301", title: "Algorithms" },
    });
    const response = await fetch(`${baseUrl}/instructor/sections/${sectionId}/submissions`);
    expect(response.status).toBe(403);
    expect(db.submission.findMany).not.toHaveBeenCalled();
  });

  it("lets a registrar review any section", async () => {
    session.claims = { ...session.claims, roles: ["registrar"] };
    db.section.findFirst.mockResolvedValue({
      id: sectionId,
      instructorPersonId: "someone-else",
      course: { code: "CS301", title: "Algorithms" },
    });
    const response = await fetch(`${baseUrl}/instructor/sections/${sectionId}/submissions`);
    expect(response.status).toBe(200);
  });

  it("rejects an assignment from another section", async () => {
    const response = await fetch(
      `${baseUrl}/instructor/sections/${sectionId}/submissions?assignmentId=50000000-0000-4000-8000-000000000099`,
    );
    expect(response.status).toBe(404);
  });

  it("downloads a student file only for the section's instructor", async () => {
    await mkdir(path.join(storageRoot, "inst"), { recursive: true });
    await writeFile(path.join(storageRoot, "inst", "file-1-1"), "%PDF-1.4\n");
    db.fileObject.findFirst.mockResolvedValue({
      id: "file-1",
      filename: "essay.pdf",
      mimeType: "application/pdf",
      path: path.join("inst", "file-1-1"),
      submission: { assignment: { sectionId } },
    });
    const ok = await fetch(`${baseUrl}/instructor/submission-files/file-1`);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { name: string; base64: string };
    expect(body.name).toBe("essay.pdf");
    expect(Buffer.from(body.base64, "base64").toString()).toBe("%PDF-1.4\n");

    db.section.findFirst.mockResolvedValue({
      id: sectionId,
      instructorPersonId: "someone-else",
      course: { code: "CS301", title: "Algorithms" },
    });
    const denied = await fetch(`${baseUrl}/instructor/submission-files/file-1`);
    expect(denied.status).toBe(403);
  });
});
