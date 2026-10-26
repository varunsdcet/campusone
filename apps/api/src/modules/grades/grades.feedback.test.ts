import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { GradebookResponse } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const claims = vi.hoisted(
  () =>
    ({
      sub: "00000000-0000-4000-8000-000000000011",
      accountId: "00000000-0000-4000-8000-000000000012",
      personId: "00000000-0000-4000-8000-000000000013",
      institutionId: "00000000-0000-4000-8000-000000000014",
      roles: ["instructor"],
      sessionId: "00000000-0000-4000-8000-000000000015",
    }) satisfies SessionClaims,
);

const tx = vi.hoisted(() => ({ gradeItem: { update: vi.fn(), create: vi.fn() } }));
const db = vi.hoisted(() => ({
  gradeItem: { findFirst: vi.fn() },
  assignment: { findFirst: vi.fn() },
  enrolment: { findFirst: vi.fn() },
  heritageRecord: { findFirst: vi.fn(), findMany: vi.fn() },
  section: { findFirst: vi.fn(), findMany: vi.fn() },
  submission: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const openApprovals = vi.hoisted(() => ({ ids: new Set<string>() }));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../lib/gradeApprovals.js", () => ({
  gradeItemsInOpenApproval: vi.fn(async () => openApprovals.ids),
  gradeAwaitingApprovalError: () =>
    Object.assign(new Error("This grade is awaiting approval"), { status: 409, code: "GRADE_AWAITING_APPROVAL" }),
}));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "feedback-correlation" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { gradesRouter } from "./grades.router.js";

const gradeId = "10000000-0000-4000-8000-000000000021";
const sectionId = "30000000-0000-4000-8000-000000000021";
const assignmentId = "50000000-0000-4000-8000-000000000021";
const studentId = "20000000-0000-4000-8000-000000000021";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/grades", gradesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

beforeEach(() => {
  vi.clearAllMocks();
  openApprovals.ids = new Set();
  db.gradeItem.findFirst.mockResolvedValue({
    id: gradeId,
    status: "draft",
    rowVersion: 3,
    maxScore: 100,
    assignment: { sectionId, section: { courseId: "course-1" } },
  });
  db.heritageRecord.findMany.mockResolvedValue([]);
  db.heritageRecord.findFirst.mockResolvedValue(null);
  db.section.findMany.mockResolvedValue([{ id: sectionId }]);
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.gradeItem.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: gradeId, ...data }));
  tx.gradeItem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: gradeId, ...data }));
});

function patch(body: Record<string, unknown>) {
  return fetch(`${baseUrl}/grades/${gradeId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("grading feedback", () => {
  it("persists trimmed feedback with the score", async () => {
    const response = await patch({ score: 80, rowVersion: 3, feedback: "  Clear argument, cite sources.  " });
    expect(response.status).toBe(200);
    expect(tx.gradeItem.update).toHaveBeenCalledWith({
      where: { id: gradeId },
      data: expect.objectContaining({ score: 80, feedback: "Clear argument, cite sources.", status: "draft" }),
    });
  });

  it("leaves existing feedback untouched when the field is omitted", async () => {
    await patch({ score: 70, rowVersion: 3 });
    expect(tx.gradeItem.update.mock.calls[0]![0].data.feedback).toBeUndefined();
  });

  it("clears feedback when an empty string is sent", async () => {
    await patch({ score: 70, rowVersion: 3, feedback: "   " });
    expect(tx.gradeItem.update.mock.calls[0]![0].data.feedback).toBeNull();
  });

  it("stores feedback on a newly created grade", async () => {
    db.assignment.findFirst.mockResolvedValue({
      id: assignmentId,
      sectionId,
      maxScore: 100,
      section: { courseId: "course-1" },
    });
    db.enrolment.findFirst.mockResolvedValue({ id: "e1" });
    db.gradeItem.findFirst.mockResolvedValue(null);
    const response = await fetch(`${baseUrl}/grades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignmentId, studentId, score: 90, feedback: "Excellent" }),
    });
    expect(response.status).toBe(201);
    expect(tx.gradeItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ feedback: "Excellent" }) });
  });

  it("keeps grades inside an open publish approval locked", async () => {
    openApprovals.ids = new Set([gradeId]);
    const response = await patch({ score: 80, rowVersion: 3, feedback: "late change" });
    expect(response.status).toBe(409);
    expect(tx.gradeItem.update).not.toHaveBeenCalled();
  });
});

describe("gradebook shows real submission status", () => {
  it("reports a submitted file and feedback per cell", async () => {
    db.section.findFirst.mockResolvedValue({
      id: sectionId,
      course: { code: "CS301", title: "Algorithms" },
      assignments: [{ id: assignmentId, title: "Essay", maxScore: 100, weightPercent: 20 }],
      enrolments: [
        {
          studentId,
          student: { studentNumber: "S1", person: { givenName: "Ada", familyName: "Lovelace" } },
          gradeItems: [
            { id: gradeId, assignmentId, score: null, status: "draft", rowVersion: 1, feedback: "Draft note" },
          ],
        },
      ],
    });
    db.submission.findMany.mockResolvedValue([
      {
        id: "60000000-0000-4000-8000-000000000021",
        assignmentId,
        studentId,
        status: "submitted",
        submittedAt: new Date("2026-10-05T10:00:00.000Z"),
        _count: { files: 2 },
      },
    ]);
    const response = await fetch(`${baseUrl}/grades/${sectionId}`);
    expect(response.status).toBe(200);
    const book = GradebookResponse.parse(await response.json());
    expect(book.rows[0]!.cells[0]).toMatchObject({
      feedback: "Draft note",
      submission: { id: "60000000-0000-4000-8000-000000000021", status: "submitted", fileCount: 2 },
    });
    expect(db.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { institutionId: claims.institutionId, assignmentId: { in: [assignmentId] } },
      }),
    );
  });
});
