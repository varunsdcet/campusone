import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { hashPassword, loginWithPassword, changePassword, validateInstitutionPassword, verifyPassword } from "@myheritage/auth";
import { LoginRequest, LoginResponse } from "@myheritage/contracts";
import { sendMailViaHumanitix, mailConfigured } from "../../lib/mailer.js";
import { forgetSessionRevocation, requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { signPortalCookie } from "../../lib/portalCookie.js";

export const authRouter: Router = Router();

authRouter.post("/login", async (req, res, next) => {
  let attemptedLogin = "";
  try {
    const body = LoginRequest.parse(req.body);
    attemptedLogin = body.email.trim().toLowerCase();
    const result = await loginWithPassword({
      ...body,
      ipAddress: req.ip ?? "127.0.0.1",
      userAgent: req.header("user-agent") ?? "unknown",
    });
    const maxAge = body.remember === false ? 12 * 60 * 60 : 30 * 24 * 60 * 60;
    res.cookie("mh_roles", signPortalCookie(result.roles, maxAge), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAge * 1000,
    });
    res.json(LoginResponse.parse(result));
  } catch (err) {
    if ((err as { code?: string }).code === "UNAUTHORIZED" && attemptedLogin) {
      const account = await accountForLoginAudit(attemptedLogin).catch(() => null);
      if (account) {
        await writeAuditAndOutbox(prisma, {
          institutionId: account.institutionId,
          actorId: account.id,
          eventName: "Account.loginFailed",
          purpose: "authentication",
          before: null,
          after: { ip: req.ip ?? "127.0.0.1", reason: "invalid_credentials" },
          source: "auth.login",
          correlationId: randomUUID(),
        }).catch(() => undefined);
      }
    }
    next(err);
  }
});

const ForgotBody = z.object({
  email: z.string().email(),
  studentNumber: z.string().min(3).optional(),
});

const ResetBody = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const VerifyPasswordBody = z.object({
  password: z.string().min(1).max(1024),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function accountForLoginAudit(login: string) {
  const byEmail = await prisma.account.findFirst({ where: { email: login }, select: { id: true, institutionId: true } });
  if (byEmail) return byEmail;
  const student = await prisma.student.findFirst({
    where: { studentNumber: { equals: login, mode: "insensitive" } },
    select: { person: { select: { accounts: { select: { id: true, institutionId: true }, take: 1 } } } },
  });
  return student?.person.accounts[0] ?? null;
}

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const body = ForgotBody.parse(req.body);
    const email = body.email.trim().toLowerCase();
    const account = await prisma.account.findFirst({
      where: { email, status: "active" },
      include: { person: { include: { students: true } } },
    });

    // Always return ok to avoid account enumeration.
    if (!account) {
      res.json({ ok: true, mailed: false });
      return;
    }

    if (body.studentNumber) {
      const match = account.person.students.some(
        (s) => s.studentNumber.toLowerCase() === body.studentNumber!.trim().toLowerCase(),
      );
      if (!match) {
        res.json({ ok: true, mailed: false });
        return;
      }
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({ data: { accountId: account.id, tokenHash, expiresAt } });
      await writeAuditAndOutbox(tx, {
        institutionId: account.institutionId,
        actorId: account.id,
        eventName: "Account.passwordResetRequested",
        purpose: "authentication",
        before: null,
        after: { expiresAt: expiresAt.toISOString() },
        source: "auth.password.forgot",
        correlationId: randomUUID(),
      });
    });

    const webOrigin = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",")[0]?.trim() || "http://localhost:3000";
    const resetUrl = `${webOrigin.replace(/\/$/, "")}/reset?token=${rawToken}`;
    const title = "Reset your Campus One password";
    const message = [
      `Hello ${account.person.givenName},`,
      "",
      "We received a request to reset your Campus One password.",
      "",
      `Reset link (valid 60 minutes):`,
      `  ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
      "",
      "— Campus One",
    ].join("\n");

    let mailed = false;
    if (mailConfigured()) {
      try {
        await sendMailViaHumanitix({ email: account.email, title, message });
        mailed = true;
      } catch (err) {
        console.error("forgot-password mail failed", err);
      }
    }

    res.json({
      ok: true,
      mailed,
      ...(process.env.NODE_ENV === "test" && process.env.EXPOSE_RESET_TOKEN === "1"
        ? { resetToken: rawToken, resetUrl }
        : {}),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = ChangePasswordBody.parse(req.body);
    await changePassword({
      accountId: user.accountId,
      institutionId: user.institutionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      keepSessionId: user.sessionId,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-password", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = VerifyPasswordBody.parse(req.body);
    const account = await prisma.account.findFirst({
      where: { id: user.accountId, institutionId: user.institutionId, status: "active" },
      select: { passwordHash: true },
    });
    const valid = account ? await verifyPassword(body.password, account.passwordHash) : false;
    if (!valid) {
      throw Object.assign(new Error("That password does not match our records."), {
        code: "INVALID_CREDENTIALS",
        status: 401,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/session", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  res.json({
    accountId: user.accountId,
    institutionId: user.institutionId,
    personId: user.personId,
    roles: user.roles,
  });
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const body = ResetBody.parse(req.body);
    const tokenHash = hashToken(body.token);
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: { message: "Reset link is invalid or expired" } });
      return;
    }
    const passwordHash = await hashPassword(body.password);
    const account = await prisma.account.findUnique({ where: { id: row.accountId }, include: { person: true } });
    if (!account) throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND", status: 404 });
    await validateInstitutionPassword(account.institutionId, body.password, {
      givenName: account.person.givenName,
      familyName: account.person.familyName,
      login: account.email,
    });
    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: row.accountId }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      await tx.session.deleteMany({ where: { accountId: row.accountId } });
      await writeAuditAndOutbox(tx, {
        institutionId: account.institutionId,
        actorId: row.accountId,
        eventName: "Account.passwordReset",
        purpose: "authentication",
        before: null,
        after: { revokedSessions: true },
        source: "auth.password.reset",
        correlationId: randomUUID(),
      });
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    await prisma.session.deleteMany({
      where: { id: user.sessionId, accountId: user.accountId, institutionId: user.institutionId },
    });
    forgetSessionRevocation(user.sessionId);
    await prisma.auditEvent.create({
      data: {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "Account.logout",
        purpose: "authentication",
        beforeJson: JSON.stringify({ sessionId: user.sessionId }),
        afterJson: null,
        source: "auth.logout",
        correlationId: randomUUID(),
        version: 1,
      },
    });
    res.clearCookie("mh_roles", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
