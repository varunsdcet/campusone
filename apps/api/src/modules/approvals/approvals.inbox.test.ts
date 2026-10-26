import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const claims = vi.hoisted(
  () =>
    ({
      sub: "00000000-0000-4000-8000-000000000041",
      accountId: "00000000-0000-4000-8000-000000000042",
      personId: "00000000-0000-4000-8000-000000000043",
      institutionId: "00000000-0000-4000-8000-000000000044",
      roles: ["registrar"],
      sessionId: "00000000-0000-4000-8000-000000000045",
    }) satisfies SessionClaims,
);

const access = vi.hoisted(() => ({ assertPermission: vi.fn() }));

const decide = vi.hoisted(() => vi.fn());

const db = vi.hoisted(() => ({
  approvalRequest: { findMany: vi.fn() },
  student: { findMany: vi.fn() },
  section: { findMany: vi.fn() },
  account: { findMany: vi.fn() },
  gradeItem: { findMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("./approvals.service.js", () => ({ applyApprovedRequest: vi.fn(), settleRejectedApproval: vi.fn() }));
vi.mock("../admin/superAdmin.service.js", () => ({ assertPermission: access.assertPermission }));
vi.mock("@myheritage/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@myheritage/auth")>()), decideApproval: decide }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "approvals-inbox" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

import { errorHandler } from "../../middleware/error-handler.js";
import { approvalsRouter } from "./approvals.router.js";

const requesterId = "20000000-0000-4000-8000-000000000041";
const gradeA = "10000000-0000-4000-8000-000000000041";
const gradeB = "10000000-0000-4000-8000-000000000042";

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-4000-8000-000000000041",
    institutionId: claims.institutionId,
    createdAt: new Date("2026-10-05T10:00:00.000Z"),
    updatedAt: new Date("2026-10-05T10:00:00.000Z"),
    rowVersion: 1,
    type: "grade_publish",
    subjectRef: "40000000-0000-4000-8000-000000000041",
    proposedDiffJson: JSON.stringify({ gradeItemIds: [gradeA, gradeB], studentIds: ["s1", "s2"] }),
    requestedBy: requesterId,
    requiredApproverRolesJson: JSON.stringify(["admin", "registrar"]),
    requiredCount: 1,
    status: "pending",
    decisionsJson: "[]",
    ...overrides,
  };
}

const section = { id: "40000000-0000-4000-8000-000000000041", code: "QA-101", course: { code: "CS301", title: "Algorithms" } };

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/approvals", approvalsRouter);
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
  access.assertPermission.mockResolvedValue({});
  db.approvalRequest.findMany.mockResolvedValue([approvalRow()]);
  db.student.findMany.mockResolvedValue([]);
  db.section.findMany.mockResolvedValue([]);
  db.account.findMany.mockResolvedValue([
    { id: requesterId, email: "teacher@example.test", person: { givenName: "Elena", familyName: "Vance" } },
  ]);
  db.gradeItem.findMany.mockResolvedValue([
    {
      id: gradeA,
      score: 88,
      maxScore: 100,
      letter: "A-",
      feedback: "Well argued",
      student: { studentNumber: "S1", person: { givenName: "Ada", familyName: "Lovelace" } },
      assignment: { title: "Essay", section },
    },
    {
      id: gradeB,
      score: 61,
      maxScore: 100,
      letter: "C",
      feedback: null,
      student: { studentNumber: "S2", person: { givenName: "Alan", familyName: "Turing" } },
      assignment: { title: "Essay", section },
    },
  ]);
});

async function inbox() {
  const response = await fetch(`${baseUrl}/approvals`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { items: Array<{ proposedDiff: { _meta: Record<string, unknown> } }> }).items;
}

describe("approval inbox detail", () => {
  it("shows the section, students, scores and letters behind a grade publication", async () => {
    const [item] = await inbox();
    expect(item!.proposedDiff._meta).toMatchObject({
      subjectLabel: "CS301 QA-101 — Algorithms",
      requestedByName: "Elena Vance",
      gradeRows: [
        { studentName: "Ada Lovelace", studentNumber: "S1", assignment: "Essay", score: 88, maxScore: 100, letter: "A-", feedback: "Well argued" },
        { studentName: "Alan Turing", studentNumber: "S2", assignment: "Essay", score: 61, maxScore: 100, letter: "C", feedback: null },
      ],
    });
    expect(db.gradeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { institutionId: claims.institutionId, id: { in: [gradeA, gradeB] } } }),
    );
  });

  it("flags requests made by the viewer so the UI hides Approve and Reject", async () => {
    db.approvalRequest.findMany.mockResolvedValue([approvalRow({ requestedBy: claims.accountId })]);
    const [item] = await inbox();
    expect(item!.proposedDiff._meta).toMatchObject({ requestedByMe: true, decidedByMe: false });
  });

  it("flags requests the viewer already decided", async () => {
    db.approvalRequest.findMany.mockResolvedValue([
      approvalRow({
        requiredCount: 2,
        decisionsJson: JSON.stringify([{ actorId: claims.accountId, decision: "approve", decidedAt: "2026-10-05T11:00:00.000Z" }]),
      }),
    ]);
    const [item] = await inbox();
    expect(item!.proposedDiff._meta).toMatchObject({ requestedByMe: false, decidedByMe: true });
  });

  it("does not query grades for non-grade requests", async () => {
    db.approvalRequest.findMany.mockResolvedValue([
      approvalRow({ type: "leave_of_absence", proposedDiffJson: JSON.stringify({ from: "2026-11-01", to: "2026-12-01" }) }),
    ]);
    const [item] = await inbox();
    expect(db.gradeItem.findMany).not.toHaveBeenCalled();
    expect(item!.proposedDiff).toMatchObject({ from: "2026-11-01", to: "2026-12-01" });
  });
});

describe("approval access level", () => {
  const denied = () =>
    access.assertPermission.mockRejectedValue(Object.assign(new Error("Your access level does not allow changing User Requests."), { status: 403, code: "FORBIDDEN" }));

  it("requires User Requests view to open the inbox", async () => {
    denied();
    const response = await fetch(`${baseUrl}/approvals`);
    expect(response.status).toBe(403);
    expect(access.assertPermission).toHaveBeenCalledWith(claims, "userRequests", "view");
    expect(db.approvalRequest.findMany).not.toHaveBeenCalled();
  });

  it("stops a Staff level without User Requests edit from deciding", async () => {
    denied();
    const response = await fetch(`${baseUrl}/approvals/${approvalRow().id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(response.status).toBe(403);
    expect(access.assertPermission).toHaveBeenCalledWith(claims, "userRequests", "edit");
    expect(decide).not.toHaveBeenCalled();
  });
});
