import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { findUnique, verifySession } = vi.hoisted(() => ({ findUnique: vi.fn(), verifySession: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: { session: { findUnique } } }));
vi.mock("@myheritage/auth", () => ({ verifySession, hasRole: vi.fn() }));

import { requireAuth } from "./auth.js";

const claims = {
  sub: "10000000-0000-4000-8000-000000000001",
  accountId: "10000000-0000-4000-8000-000000000001",
  personId: "10000000-0000-4000-8000-000000000002",
  institutionId: "10000000-0000-4000-8000-000000000003",
  roles: ["student"],
  sessionId: "10000000-0000-4000-8000-000000000004",
};

function request(baseUrl = "/student", path = "/courses") {
  return {
    baseUrl,
    path,
    header: (name: string) => name === "authorization" ? "Bearer token" : undefined,
  } as unknown as Request;
}

async function run(req: Request) {
  let result: unknown = "not-called";
  await requireAuth(req, {} as Response, ((error?: unknown) => { result = error; }) as NextFunction);
  return result;
}

describe("requireAuth live session enforcement", () => {
  beforeEach(() => {
    findUnique.mockReset();
    verifySession.mockReset().mockResolvedValue(claims);
  });

  it("checks revocation on every request instead of trusting a process cache", async () => {
    findUnique
      .mockResolvedValueOnce({ expiresAt: new Date(Date.now() + 60_000), updatedAt: new Date(), account: { status: "active" } })
      .mockResolvedValueOnce(null);
    expect(await run(request())).toBeUndefined();
    expect(await run(request())).toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("blocks paused accounts outside the compliance recovery allowlist", async () => {
    findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), updatedAt: new Date(), account: { status: "paused" } });
    expect(await run(request())).toMatchObject({ code: "ACCOUNT_PAUSED", status: 403 });
    expect(await run(request("/compliance", "/explain"))).toBeUndefined();
  });
});
