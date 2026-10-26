import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { DegreeProgressResponse, WhatIfScenarioResponse, type SessionClaims } from "@myheritage/contracts";
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

const progressFixture = vi.hoisted(() => ({
  studentId: "10000000-0000-4000-8000-000000000001",
  programCode: "CS-DIP",
  programName: "Computer Science Diploma",
  programVersionLabel: "2024.1",
  remainingCredits: 12,
  completedCredits: 15,
  requiredCredits: 27,
  remainingRequirements: [
    {
      id: "10000000-0000-4000-8000-000000000011",
      code: "DATA401",
      title: "Data Engineering",
      credits: 3,
      kind: "required" as const,
      status: "blocked" as const,
      satisfiedByCourseCode: null,
      blockedByCourseCodes: ["STAT310"],
    },
  ],
  satisfiedRequirements: [],
  prerequisiteConflicts: [{ courseCode: "DATA401", missingPrerequisites: ["STAT310"] }],
  prerequisiteGraph: [
    { courseCode: "STAT310", requiresCourseCode: "MATH210" },
    { courseCode: "DATA401", requiresCourseCode: "STAT310" },
  ],
  projectedCompletionTerm: "Summer 2027",
  warnings: [],
  suggestedOptions: ["Take STAT310 next available term (3 credits)."],
  evidence: [
    { id: "programVersion:pv-1", title: "CS Diploma · 2024.1", uri: "/student/degree" },
    { id: "student:student-1", title: "Student S1001", uri: "/student/profile" },
  ],
  claims: [
    {
      kind: "fact" as const,
      text: "15 of 27 required credits are satisfied from published/completed records.",
      evidenceIds: ["programVersion:pv-1"],
    },
  ],
}));

const tx = vi.hoisted(() => ({
  degreePlanScenario: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const progress = vi.hoisted(() => ({
  computeDegreeProgress: vi.fn(),
  impactIfDropCourse: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "academic-test-correlation" });
    next();
  },
  requireRoles() {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));
vi.mock("./degree-progress.service.js", () => ({
  computeDegreeProgress: progress.computeDegreeProgress,
  impactIfDropCourse: progress.impactIfDropCourse,
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { academicRouter } from "./academic.router.js";

let server: Server;
let apiBaseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { correlationId: "academic-test-correlation" });
    next();
  });
  app.use("/student", academicRouter);
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
});

beforeEach(() => {
  vi.clearAllMocks();
  db.student.findMany.mockResolvedValue([{ id: "student-1", _count: { enrolments: 1 } }]);
  db.student.findFirst.mockResolvedValue({ id: "student-1", programVersionId: "pv-1" });
  progress.computeDegreeProgress.mockResolvedValue(progressFixture);
  progress.impactIfDropCourse.mockResolvedValue({
    baseline: progressFixture,
    projected: { ...progressFixture, remainingCredits: 15, projectedCompletionTerm: "Fall 2027" },
    impactSummary: ["Dropping MATH210 removes it from the active plan."],
    downstream: ["STAT310"],
  });
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.degreePlanScenario.create.mockResolvedValue({});
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("student degree APIs", () => {
  it("returns degree progress for the authenticated student", async () => {
    const response = await fetch(`${apiBaseUrl}/student/degree-progress`);
    expect(response.status).toBe(200);
    const payload = DegreeProgressResponse.parse(await response.json());
    expect(payload).toMatchObject({ programCode: "CS-DIP", remainingCredits: 12 });
    expect(progress.computeDegreeProgress).toHaveBeenCalledWith({
      institutionId: claims.institutionId,
      studentId: "student-1",
    });
  });

  it("returns an empty state when the student has no program assigned", async () => {
    db.student.findFirst.mockResolvedValue({ id: progressFixture.studentId, programVersionId: null });
    progress.computeDegreeProgress.mockRejectedValue(
      Object.assign(new Error("No program"), { code: "NO_PROGRAM", status: 404 }),
    );
    const response = await fetch(`${apiBaseUrl}/student/degree-progress`);
    expect(response.status).toBe(200);
    const payload = DegreeProgressResponse.parse(await response.json());
    expect(payload).toEqual({
      studentId: progressFixture.studentId,
      programAssigned: false,
      message: "No program assigned yet",
    });
  });

  it("runs a what-if scenario without persisting when save=false", async () => {
    const response = await fetch(`${apiBaseUrl}/student/degree-scenarios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dropCourseCodes: ["MATH210"], save: false }),
    });
    expect(response.status).toBe(200);
    const payload = WhatIfScenarioResponse.parse(await response.json());
    expect(payload.scenarioId).toBeNull();
    expect(payload.impactSummary[0]).toContain("MATH210");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("persists a draft scenario when save=true", async () => {
    const response = await fetch(`${apiBaseUrl}/student/degree-scenarios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dropCourseCodes: ["MATH210"], save: true, label: "Drop MATH210" }),
    });
    expect(response.status).toBe(200);
    const payload = WhatIfScenarioResponse.parse(await response.json());
    expect(payload.scenarioId).toBeTruthy();
    expect(tx.degreePlanScenario.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "DegreePlanScenario.created" }),
    });
  });
});
