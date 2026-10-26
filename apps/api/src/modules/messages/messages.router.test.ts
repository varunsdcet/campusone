import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { AskAboutGradeResponse } from "@myheritage/contracts";
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

const tx = vi.hoisted(() => ({
  messageThread: { create: vi.fn() },
  message: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  gradeItem: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../admin/superAdmin.service.js", () => ({ assertPermission: vi.fn().mockResolvedValue({}) }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: testClaims, correlationId: "message-test-correlation" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { messagesRouter } from "./messages.router.js";

const gradeItemId = "10000000-0000-4000-8000-000000000001";
const threadId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const instructorAccountId = "40000000-0000-4000-8000-000000000001";

let server: Server;
let apiBaseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/messages", messagesRouter);
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
  db.gradeItem.findFirst.mockResolvedValue({
    id: gradeItemId,
    student: { personId: testClaims.personId },
    assignment: { section: { instructorPersonId: "50000000-0000-4000-8000-000000000001" } },
  });
  db.account.findFirst.mockResolvedValue({ id: instructorAccountId });
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.messageThread.create.mockResolvedValue({ id: threadId });
  tx.message.create.mockResolvedValue({
    id: messageId,
    institutionId: testClaims.institutionId,
    threadId,
    senderAccountId: testClaims.accountId,
    body: "Can you explain this grade?",
    relatedGradeItemId: gradeItemId,
    createdAt: new Date("2026-09-15T20:00:00.000Z"),
    updatedAt: new Date("2026-09-15T20:00:00.000Z"),
    rowVersion: 1,
  });
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
});

describe("ST-21 ask about grade", () => {
  it("creates the student/instructor thread, message, audit, and outbox atomically", async () => {
    const response = await fetch(`${apiBaseUrl}/messages/ask-grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: "Can you explain this grade?",
        subject: "Question about Midterm Exam",
        relatedGradeItemId: gradeItemId,
      }),
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(() => AskAboutGradeResponse.parse(payload)).not.toThrow();
    expect(tx.messageThread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: testClaims.institutionId,
        participantAccountIdsJson: JSON.stringify([testClaims.accountId, instructorAccountId]),
      }),
    });
    expect(tx.message.create).toHaveBeenCalledOnce();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: testClaims.institutionId,
        eventName: "Message.sent",
        correlationId: "message-test-correlation",
      }),
    });
    expect(tx.eventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: testClaims.institutionId,
        eventName: "Message.sent",
      }),
    });
  });

  it("does not create an undeliverable thread when the instructor account is missing", async () => {
    db.account.findFirst.mockResolvedValue(null);

    const response = await fetch(`${apiBaseUrl}/messages/ask-grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Please explain", relatedGradeItemId: gradeItemId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
