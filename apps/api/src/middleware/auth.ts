import type { NextFunction, Request, Response } from "express";
import { verifySession, hasRole } from "@myheritage/auth";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

export type AuthedRequest = Request & {
  user: SessionClaims;
  correlationId: string;
};

/**
 * Every token is minted at login alongside a session row. Logout, disabling an account, password resets,
 * role changes and the concurrent-session limit delete that row; an administrator revoking a session
 * expires it. Always read the row: a per-process cache let a revoked token survive on another API replica.
 */
async function activeSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  return prisma.session.findUnique({
    where: { id: sessionId },
    select: { expiresAt: true, updatedAt: true, account: { select: { status: true } } },
  });
}

export function forgetSessionRevocation(_sessionId: string) {}

const PAUSED_ALLOWED = new Set([
  "/compliance/inbox",
  "/compliance/explain",
  "/compliance/pause-status",
  "/auth/session",
  "/auth/logout",
  "/auth/change-password",
]);

function requestPath(req: Request) {
  return `${req.baseUrl || ""}${req.path || ""}`.replace(/\/$/, "") || "/";
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw Object.assign(new Error("Missing bearer token"), { code: "UNAUTHORIZED", status: 401 });
    }
    const token = header.slice("Bearer ".length);
    const user = await verifySession(token);
    const session = await activeSession(user.sessionId);
    if (!session || session.expiresAt.getTime() <= Date.now()) throw new Error("This session has been signed out. Please sign in again.");
    if (session.account.status === "paused" && !PAUSED_ALLOWED.has(requestPath(req))) {
      throw Object.assign(new Error("This account is paused. Submit the compliance explanation for staff review."), {
        code: "ACCOUNT_PAUSED",
        status: 403,
      });
    }
    (req as AuthedRequest).user = user;
    next();
  } catch (err) {
    const authError = err instanceof Error ? err : new Error("Unauthorized");
    const tagged = authError as Error & { code?: string; status?: number };
    if (!tagged.code) tagged.code = "UNAUTHORIZED";
    if (!tagged.status) tagged.status = 401;
    next(tagged);
  }
}

export function requireRoles(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || !hasRole(user.roles, roles)) {
      next(Object.assign(new Error("Forbidden"), { code: "FORBIDDEN", status: 403 }));
      return;
    }
    next();
  };
}
