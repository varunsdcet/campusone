import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const claims = vi.hoisted(
  () =>
    ({
      sub: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
      personId: "00000000-0000-4000-8000-000000000003",
      institutionId: "00000000-0000-4000-8000-000000000004",
      roles: ["registrar"],
      sessionId: "00000000-0000-4000-8000-000000000005",
    }) satisfies SessionClaims,
);

const db = vi.hoisted(() => ({
  account: { findFirst: vi.fn() },
  section: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const access = vi.hoisted(() => ({
  assertPermission: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    Object.assign(req, { user: claims, correlationId: "admin-test-correlation" });
    next();
  },
  requireRoles(..._roles: RoleName[]) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));
vi.mock("./superAdmin.service.js", () => ({ assertPermission: access.assertPermission }));
vi.mock("./superAdmin.router.js", async () => ({ superAdminRouter: (await import("express")).Router() }));
vi.mock("./heritage/heritage.router.js", async () => ({ heritageRouter: (await import("express")).Router() }));
vi.mock("./sis.service.js", () => ({}));
vi.mock("./registrar-gaps.service.js", () => ({}));

import { errorHandler } from "../../middleware/error-handler.js";
import { adminRouter } from "./admin.router.js";

let server: Server;
let apiBaseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
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
  access.assertPermission.mockResolvedValue({ administrator: false, superAdmin: false });
  db.account.findFirst.mockResolvedValue(null);
  db.section.findFirst.mockResolvedValue(null);
});

function post(path: string, body: unknown) {
  return fetch(`${apiBaseUrl}/admin${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const newUser = (role: string) => ({
  email: "new.person@heritage.test",
  givenName: "New",
  familyName: "Person",
  role,
  password: "Sufficiently-long-1",
});

describe("legacy admin user creation", () => {
  it.each(["admin", "registrar"])("refuses a non-administrator registrar creating a %s account", async (role) => {
    const response = await post("/users", newUser(role));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(access.assertPermission).toHaveBeenCalledWith(claims, "userManagement", "edit");
    expect(db.account.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("lets the same registrar continue to create a non-privileged account", async () => {
    db.account.findFirst.mockResolvedValue({ id: "existing-account" });

    const response = await post("/users", newUser("instructor"));

    expect(response.status).toBe(409);
    expect(db.account.findFirst).toHaveBeenCalled();
  });

  it("returns the permission error when the access level cannot edit users", async () => {
    access.assertPermission.mockRejectedValue(
      Object.assign(new Error("Your access level does not allow changing User Management."), {
        status: 403,
        code: "FORBIDDEN",
      }),
    );

    const response = await post("/users", newUser("student"));

    expect(response.status).toBe(403);
    expect(db.account.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("legacy admin assignment creation", () => {
  it("rejects a weight above 100% before touching the database", async () => {
    const response = await post("/assignments", {
      sectionId: "10000000-0000-4000-8000-000000000001",
      title: "Final Project",
      maxScore: 100,
      weightPercent: 500,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(access.assertPermission).toHaveBeenCalledWith(claims, "courseManagement", "edit");
    expect(db.section.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("accepts a valid weight and proceeds to the section lookup", async () => {
    const response = await post("/assignments", {
      sectionId: "10000000-0000-4000-8000-000000000001",
      title: "Final Project",
      weightPercent: 40,
    });

    expect(response.status).toBe(404);
    expect(db.section.findFirst).toHaveBeenCalled();
  });
});
