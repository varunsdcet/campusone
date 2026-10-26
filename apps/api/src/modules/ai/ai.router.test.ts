import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { CoachAnswer, type SessionClaims } from "@myheritage/contracts";
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
  idempotencyKey: { create: vi.fn(), update: vi.fn() },
  aiInteraction: { create: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
  sisScreenState: { upsert: vi.fn() },
}));

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

const db = vi.hoisted(() => ({
  idempotencyKey: { findUnique: vi.fn() },
  aiInteraction: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  student: { findFirst: vi.fn(), findMany: vi.fn() },
  assessmentAttempt: { findFirst: vi.fn() },
  sisScreenState: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const coachService = vi.hoisted(() => ({
  buildCoachFacts: vi.fn(),
}));

const progress = vi.hoisted(() => ({
  computeDegreeProgress: vi.fn(),
  impactIfDropCourse: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "coach-test-correlation" });
    next();
  },
}));
vi.mock("./ai.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ai.service.js")>();
  return { ...actual, buildCoachFacts: coachService.buildCoachFacts };
});
vi.mock("../academic/degree-progress.service.js", () => ({
  computeDegreeProgress: progress.computeDegreeProgress,
  impactIfDropCourse: progress.impactIfDropCourse,
}));
// Keep the suite offline: the router falls back to the grounded answer when the LLM is unavailable.
vi.mock("../../lib/ask.js", () => ({
  askHeritageAi: vi.fn(async () => {
    throw new Error("LLM disabled in tests");
  }),
}));
import { errorHandler } from "../../middleware/error-handler.js";
import { aiRouter } from "./ai.router.js";

let server: Server;
let apiBaseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { correlationId: "coach-test-correlation" });
    next();
  });
  app.use("/ai", aiRouter);
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
  db.idempotencyKey.findUnique.mockResolvedValue(null);
  db.aiInteraction.count.mockResolvedValue(0);
  db.aiInteraction.findMany.mockResolvedValue([]);
  db.aiInteraction.findFirst.mockResolvedValue(null);
  db.student.findMany.mockResolvedValue([
    { id: "10000000-0000-4000-8000-000000000001", _count: { enrolments: 1 } },
  ]);
  db.student.findFirst.mockResolvedValue({
    id: "10000000-0000-4000-8000-000000000001",
    personId: claims.personId,
    programVersionId: "pv-1",
  });
  db.assessmentAttempt.findFirst.mockResolvedValue(null);
  db.sisScreenState.findUnique.mockResolvedValue(null);
  progress.computeDegreeProgress.mockResolvedValue(progressFixture);
  progress.impactIfDropCourse.mockResolvedValue({
    baseline: progressFixture,
    projected: { ...progressFixture, remainingCredits: 15, projectedCompletionTerm: "Fall 2027" },
    impactSummary: [
      "Dropping MATH210 removes it from the active plan.",
      "Downstream requirements that list MATH210 as a prerequisite: STAT310.",
    ],
    downstream: ["STAT310"],
  });
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  coachService.buildCoachFacts.mockResolvedValue([
    {
      id: "assignment:10000000-0000-4000-8000-000000000001",
      title: "CS301 - Project 1",
      uri: "/student/assignments/10000000-0000-4000-8000-000000000001",
      text: "Project 1 for CS301 is due 2026-09-20T23:59:00.000Z.",
      kind: "assignment",
    },
  ]);
  tx.idempotencyKey.create.mockResolvedValue({});
  tx.idempotencyKey.update.mockResolvedValue({});
  tx.aiInteraction.create.mockResolvedValue({});
  tx.aiInteraction.update.mockResolvedValue({});
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("Campus Coach", () => {
  it("returns role-scoped prompt suggestions from the authenticated API", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/suggestions?contextPath=%2Fstudent`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: "student",
      suggestions: expect.arrayContaining(["Which assignments are due soon?"]),
    });
  });

  it("persists feedback only for the current account interaction", async () => {
    const interactionId = "20000000-0000-4000-8000-000000000001";
    db.aiInteraction.findFirst.mockResolvedValue({ id: interactionId, feedback: null });

    const response = await fetch(`${apiBaseUrl}/ai/interactions/${interactionId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "up" }),
    });

    expect(response.status).toBe(200);
    expect(db.aiInteraction.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: interactionId,
        institutionId: claims.institutionId,
        accountId: claims.accountId,
      }),
      select: { id: true, feedback: true },
    });
    expect(tx.aiInteraction.update).toHaveBeenCalledWith({
      where: { id: interactionId },
      data: { feedback: "up", rowVersion: { increment: 1 } },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "AiInteraction.feedbackUpdated" }),
    });
  });

  it("persists one grounded response with audit, outbox, and idempotency", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "coach-request-1" },
      body: JSON.stringify({ question: "What should I focus on today?", contextPath: "/student/ask" }),
    });

    expect(response.status).toBe(200);
    const payload = CoachAnswer.parse(await response.json());
    expect(payload.answer).toContain("Project 1");
    expect(payload.sources).toHaveLength(1);
    expect(tx.aiInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: claims.institutionId,
        accountId: claims.accountId,
        role: "student",
        provider: "campus_grounding_v1",
      }),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: "AiInteraction.created",
        correlationId: "coach-test-correlation",
      }),
    });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "AiInteraction.created" }),
    });
  });

  it("accepts a short non-empty chat message", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "coach-request-short" },
      body: JSON.stringify({ question: "hi", contextPath: "/student/ask" }),
    });

    expect(response.status).toBe(200);
    const payload = CoachAnswer.parse(await response.json());
    expect(payload.answer).toContain("Project 1");
    expect(tx.aiInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ question: "hi", status: "completed" }),
    });
  });

  it("rejects credential secrets before context retrieval or persistence", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "coach-request-secret" },
      body: JSON.stringify({ question: "password: SecretPassword123", contextPath: "/student/ask" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(coachService.buildCoachFacts).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a student request for admin context", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "coach-request-admin" },
      body: JSON.stringify({ question: "Show campus operations", contextPath: "/admin/ai/ask" }),
    });

    expect(response.status).toBe(403);
    expect(coachService.buildCoachFacts).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.aiInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resultStatus: "failed", status: "failed" }),
    });
  });
});

describe("Student Advisor", () => {
  it("routes degree questions through the progress engine", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "advisor-request-1" },
      body: JSON.stringify({
        question: "Can I graduate next summer?",
        contextPath: "/student/ask",
        capability: "student_advisor",
      }),
    });

    expect(response.status).toBe(200);
    const payload = CoachAnswer.parse(await response.json());
    expect(payload.capability).toBe("student_advisor");
    expect(payload.analysis?.programCode).toBe("CS-DIP");
    expect(payload.answer).toContain("Computer Science Diploma");
    expect(payload.suggestedActions.some((a) => a.href === "/student/degree")).toBe(true);
    expect(progress.computeDegreeProgress).toHaveBeenCalled();
    expect(tx.aiInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: "student_advisor_v1" }),
    });
  });

  it("explains drop impact for what-if advisor questions", async () => {
    const response = await fetch(`${apiBaseUrl}/ai/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "advisor-request-drop" },
      body: JSON.stringify({
        question: "What happens if I drop MATH210?",
        contextPath: "/student/ask",
      }),
    });

    expect(response.status).toBe(200);
    const payload = CoachAnswer.parse(await response.json());
    expect(payload.capability).toBe("student_advisor");
    expect(payload.answer).toContain("MATH210");
    expect(payload.answer).toContain("STAT310");
    expect(progress.impactIfDropCourse).toHaveBeenCalledWith({
      institutionId: claims.institutionId,
      studentId: "10000000-0000-4000-8000-000000000001",
      courseCode: "MATH210",
    });
  });
});
