import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims, StudentGradesResponse as StudentGradesPayload } from "@myheritage/contracts";
import { StudentGradesResponse } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testClaims = vi.hoisted(
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

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn(), findMany: vi.fn() },
  enrolment: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
  auditEvent: { create: vi.fn() },
  institution: { findFirst: vi.fn() },
  term: { findFirst: vi.fn(), findMany: vi.fn() },
  gradeItem: { findMany: vi.fn() },
  portalRecord: { findMany: vi.fn() },
}));

const transcript = vi.hoisted(() => ({
  getTranscriptSummary: vi.fn(),
  weightedPercent: vi.fn((items: Array<{ score: number | null; maxScore: number; weightPercent: number }>) => {
    const weighted = items.filter((item) => item.score != null && item.maxScore > 0);
    if (!weighted.length) return null;
    const totalWeight = weighted.reduce((sum, item) => sum + item.weightPercent, 0);
    return totalWeight ? weighted.reduce((sum, item) => sum + (item.score! / item.maxScore) * item.weightPercent, 0) / totalWeight * 100 : null;
  }),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../academic/program-plan.service.js", () => transcript);
vi.mock("../../lib/gradingScheme.js", () => ({ letterForSection: vi.fn(async () => "A-") }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: testClaims, correlationId: "test-correlation" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { buildPortalView } from "../portal/portal.service.js";
import { gradesRouter } from "./grades.router.js";

const midtermAssignment = {
  id: "50000000-0000-4000-8000-000000000001",
  title: "Midterm Exam",
  weightPercent: 30,
  maxScore: 100,
};

const projectAssignment = {
  id: "50000000-0000-4000-8000-000000000002",
  title: "Programming Project",
  weightPercent: 40,
  maxScore: 100,
};

const publishedGrade = {
  id: "10000000-0000-4000-8000-000000000001",
  assignmentId: midtermAssignment.id,
  score: 88,
  maxScore: 100,
  letter: "A-",
  status: "published",
  publishedAt: new Date("2026-10-01T12:00:00.000Z"),
  assignment: {
    title: "Midterm Exam",
    weightPercent: 30,
    section: { course: { code: "CS301" } },
  },
};

const draftGrade = {
  id: "10000000-0000-4000-8000-000000000002",
  assignmentId: projectAssignment.id,
  score: 92,
  maxScore: 100,
  letter: "A",
  status: "draft",
  publishedAt: null,
  assignment: {
    title: "Programming Project",
    weightPercent: 40,
    section: { course: { code: "CS301" } },
  },
};

let server: Server;
let apiBaseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/grades", gradesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  apiBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  db.student.findMany.mockResolvedValue([
    { id: "20000000-0000-4000-8000-000000000001", _count: { enrolments: 1 } },
  ]);
  db.student.findFirst.mockResolvedValue({ id: "20000000-0000-4000-8000-000000000001", standing: "good" });
  db.enrolment.findMany.mockResolvedValue([
    {
      sectionId: "30000000-0000-4000-8000-000000000001",
      section: {
        instructorPersonId: "40000000-0000-4000-8000-000000000001",
        course: { code: "CS301", title: "Algorithms", credits: 3 },
        assignments: [midtermAssignment, projectAssignment],
      },
      // Deliberately include a draft to prove the response guard does not trust
      // only the ORM relation filter.
      gradeItems: [publishedGrade, draftGrade],
    },
  ]);
  db.person.findMany.mockResolvedValue([
    { id: "40000000-0000-4000-8000-000000000001", givenName: "Elena", familyName: "Vance" },
  ]);
  db.auditEvent.create.mockResolvedValue({});
  db.institution.findFirst.mockResolvedValue({ name: "Heritage Community College", city: "Surrey", region: "BC" });
  db.term.findFirst.mockResolvedValue({ name: "Fall 2026", code: "2026F" });
  db.term.findMany.mockResolvedValue([{ name: "Fall 2026", code: "2026F", startsOn: "2026-09-01", endsOn: "2026-12-18" }]);
  db.gradeItem.findMany.mockResolvedValue([publishedGrade, draftGrade]);
  transcript.getTranscriptSummary.mockResolvedValue({ cgpa: 3.67 });
});

describe("ST-07 student grade visibility", () => {
  it("returns only the signed-in student's published grades", async () => {
    const response = await fetch(`${apiBaseUrl}/grades/me`);
    expect(response.status).toBe(200);

    const payload: StudentGradesPayload = StudentGradesResponse.parse(await response.json());
    expect(payload.courses).toHaveLength(1);
    const course = payload.courses[0]!;
    expect(course.items.map((item) => item.title)).toEqual(["Midterm Exam", "Programming Project"]);
    expect(course.items[0]).toMatchObject({ id: publishedGrade.id, score: 88, letter: "A-", status: "published" });
    expect(course.items[1]).toEqual(
      expect.objectContaining({
        id: projectAssignment.id,
        score: null,
        letter: null,
        status: "draft",
        publishedAt: null,
      }),
    );
    expect(course.currentPercent).toBe(88);
    expect(payload.cumulativeGpa).toBe(3.67);
    expect(transcript.getTranscriptSummary).toHaveBeenCalledWith(testClaims.institutionId, "20000000-0000-4000-8000-000000000001");
    expect(JSON.stringify(payload)).not.toContain(draftGrade.id);
    expect(JSON.stringify(payload)).not.toContain('"score":92');
    expect(db.enrolment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          institutionId: testClaims.institutionId,
          studentId: "20000000-0000-4000-8000-000000000001",
        }),
        include: expect.objectContaining({
          gradeItems: expect.objectContaining({
            where: expect.objectContaining({ institutionId: testClaims.institutionId }),
          }),
        }),
      }),
    );
  });

  it("never falls back to draft grades on the generic student portal", async () => {
    const view = await buildPortalView(testClaims, "/student/grades");

    expect(view.sections[0]?.rows.map((row) => row.primary)).toEqual(["CS301 · Midterm Exam"]);
    expect(JSON.stringify(view)).not.toContain("Programming Project");
    expect(JSON.stringify(view)).not.toContain("Status: draft");
    expect(view.metrics).toContainEqual({ label: "Items", value: "1" });
    expect(db.gradeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          institutionId: testClaims.institutionId,
          studentId: "20000000-0000-4000-8000-000000000001",
          status: "published",
        },
      }),
    );
  });
});
