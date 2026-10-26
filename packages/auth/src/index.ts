import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { SessionClaims as SessionClaimsSchema } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";

const encoder = new TextEncoder();

function secretKey() {
  const configured = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!configured || configured === "dev-jwt-secret-change-me" || configured.length < 32)) {
    throw new Error("JWT_SECRET must be configured with at least 32 non-default characters in production");
  }
  return encoder.encode(configured || "dev-jwt-secret-change-me");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Access-token lifetime kept long for campus retest / day-to-day portal use. */
const SESSION_TTL_LONG = "30d";
const SESSION_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SHORT = "12h";
const SESSION_TTL_SHORT_MS = 12 * 60 * 60 * 1000;

type Settings = Record<string, unknown>;

async function securitySettings(institutionId: string, key: "session" | "password" | "mfa"): Promise<Settings> {
  const row = await prisma.heritageRecord.findFirst({
    where: { institutionId, screenId: "SYS:SETTINGS", contextKey: "", singletonKey: key, deletedAt: null },
    select: { dataJson: true },
  });
  try {
    const parsed = JSON.parse(row?.dataJson || "{}") as unknown;
    return parsed && typeof parsed === "object" ? parsed as Settings : {};
  } catch {
    return {};
  }
}

export function sessionDuration(settings: Settings, rememberRequested: boolean) {
  const keepAllowed = settings.keepLoggedIn !== false;
  const remember = rememberRequested && keepAllowed;
  const expiry = String(settings.expiry || "");
  const inactivityMs = expiry === "30 minutes of inactivity" ? 30 * 60_000
    : expiry === "1 hour of inactivity" ? 60 * 60_000
      : expiry === "4 hours of inactivity" ? 4 * 60 * 60_000
        : expiry === "5 hours of inactivity" ? 5 * 60 * 60_000
          : expiry === "8 hours of inactivity" ? 8 * 60 * 60_000
            : expiry === "24 hours of inactivity" ? 24 * 60 * 60_000
              : null;
  const ttlMs = inactivityMs ?? (remember ? SESSION_TTL_LONG_MS : SESSION_TTL_SHORT_MS);
  return { remember, ttlMs, ttl: Math.max(60, Math.floor(ttlMs / 1000)) };
}

function ipv4Number(ip: string) {
  const plain = ip.replace(/^::ffff:/, "");
  const parts = plain.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((out, part) => ((out << 8) | part) >>> 0, 0) >>> 0;
}

export function ipAllowed(ip: string, rules: string[]) {
  const value = ipv4Number(ip);
  if (value === null) return false;
  return rules.some((rule) => {
    const [networkRaw, prefixRaw = "32"] = rule.trim().split("/");
    const network = ipv4Number(networkRaw || "");
    const prefix = Number(prefixRaw);
    if (network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) === (network & mask);
  });
}

export async function validateInstitutionPassword(institutionId: string, password: string, identity?: { givenName?: string; familyName?: string; login?: string }) {
  const [stored, policy] = await Promise.all([
    securitySettings(institutionId, "password"),
    prisma.securityPolicy.findUnique({ where: { institutionId } }),
  ]);
  const min = Math.max(Number(stored.minLength) || policy?.passwordMinLength || 10, 6);
  const errors: string[] = [];
  if (password.length < min) errors.push(`at least ${min} characters`);
  if (stored.upper === "Yes" && !/[A-Z]/.test(password)) errors.push("an uppercase letter");
  if (stored.lower === "Yes" && !/[a-z]/.test(password)) errors.push("a lowercase letter");
  if (stored.number === "Yes" && !/\d/.test(password)) errors.push("a number");
  if (stored.symbol === "Yes" && !/[^A-Za-z0-9]/.test(password)) errors.push("a symbol");
  if (stored.nameMatching === "Not Allowed") {
    const lower = password.toLowerCase();
    const pieces = [identity?.givenName, identity?.familyName, identity?.login]
      .map((value) => String(value || "").trim().toLowerCase()).filter((value) => value.length >= 3);
    if (pieces.some((piece) => lower.includes(piece))) errors.push("must not contain your name or login");
  }
  if (errors.length) {
    throw Object.assign(new Error(`Password must contain ${errors.join(", ")}.`), { code: "PASSWORD_POLICY", status: 400 });
  }
}

export async function signSession(claims: SessionClaims, ttl: string | number = SESSION_TTL_LONG) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // jose treats a numeric expiration as an absolute Unix timestamp. Our numeric values are TTL seconds.
    .setExpirationTime(typeof ttl === "number" ? `${ttl}s` : ttl)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      // Tolerate small host/container NTP skew without accepting truly expired sessions.
      clockTolerance: "2m",
    });
    return SessionClaimsSchema.parse(payload);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED" || /"exp" claim timestamp check failed/i.test(String(err))) {
      throw Object.assign(new Error("Session expired. Please sign in again."), {
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
    throw err;
  }
}

export function hasRole(roles: RoleName[], needed: RoleName | RoleName[]) {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((r) => roles.includes(r));
}

/** "User Login" names configured by super admins live in the super:user-meta store (accountId → { login }). */
async function findAccountIdByUserLogin(login: string, institutionId?: string) {
  const rows = await prisma.sisScreenState.findMany({ where: { path: "super:user-meta", ...(institutionId ? { institutionId } : {}) } });
  const needle = login.toLowerCase();
  const matches: string[] = [];
  for (const row of rows) {
    try {
      const meta = JSON.parse(row.payloadJson) as Record<string, { login?: string }>;
      const hit = Object.entries(meta).find(([, m]) => m.login?.toLowerCase() === needle);
      if (hit) matches.push(hit[0]);
    } catch {
      continue;
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

const invalidCredentials = () => Object.assign(new Error("Invalid credentials"), { code: "UNAUTHORIZED", status: 401 });

async function uniqueAccount(where: Record<string, unknown>) {
  const accounts = await prisma.account.findMany({ where, include: { person: true }, take: 2 });
  if (accounts.length !== 1) return null;
  return accounts[0];
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  remember?: boolean;
  institutionId?: string;
}) {
  const identifier = input.email.trim();
  const looksLikeEmail = identifier.includes("@");
  let account = looksLikeEmail
    ? await uniqueAccount({ email: identifier.toLowerCase(), ...(input.institutionId ? { institutionId: input.institutionId } : {}) })
    : null;

  if (!account && !looksLikeEmail) {
    const students = await prisma.student.findMany({
      where: { studentNumber: { equals: identifier, mode: "insensitive" }, ...(input.institutionId ? { institutionId: input.institutionId } : {}) },
      include: { person: { include: { accounts: true } } },
      take: 2,
    });
    const student = students.length === 1 ? students[0] : null;
    const linked = student?.person.accounts.find((a) => a.status === "active") ?? student?.person.accounts[0];
    if (linked) {
      account = await prisma.account.findFirst({
        where: { id: linked.id },
        include: { person: true },
      });
    }
  }

  if (!account && !looksLikeEmail) {
    const accountId = await findAccountIdByUserLogin(identifier, input.institutionId);
    if (accountId) {
      account = await prisma.account.findFirst({
        where: { id: accountId },
        include: { person: true },
      });
    }
  }

  if (!account || (account.status !== "active" && account.status !== "paused")) {
    throw invalidCredentials();
  }
  const ok = await verifyPassword(input.password, account.passwordHash);
  if (!ok) {
    throw invalidCredentials();
  }
  const sessionSettings = await securitySettings(account.institutionId, "session");
  if (sessionSettings.ipAuthentication === "Enabled") {
    const rules = String(sessionSettings.allowedIps || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!ipAllowed(input.ipAddress, rules)) {
      throw Object.assign(new Error("Sign-in is not allowed from this IP address"), { code: "IP_NOT_ALLOWED", status: 403 });
    }
  }
  const { remember, ttl, ttlMs } = sessionDuration(sessionSettings, input.remember !== false);

  const policy = await prisma.securityPolicy.findUnique({ where: { institutionId: account.institutionId } });
  const max = policy?.maxConcurrentSessions ?? 3;
  const active = await prisma.session.count({
    where: { accountId: account.id, expiresAt: { gt: new Date() } },
  });
  if (active >= max) {
    const oldest = await prisma.session.findFirst({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
    });
    // deleteMany: a concurrent login may already have removed this session.
    if (oldest) await prisma.session.deleteMany({ where: { id: oldest.id } });
  }

  const roles = JSON.parse(account.rolesJson) as RoleName[];
  const correlationId = randomUUID();
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        institutionId: account.institutionId,
        accountId: account.id,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        geoLocation: "Surrey, BC",
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: account.institutionId,
      actorId: account.id,
      eventName: "Account.login",
      purpose: "authentication",
      before: null,
      after: { sessionId: created.id, ip: input.ipAddress, remember, accountStatus: account.status },
      source: "auth.login",
      correlationId,
    });
    return created;
  });

  const accountStatus = account.status === "paused" ? ("paused" as const) : ("active" as const);
  const claims: SessionClaims = {
    sub: account.id,
    accountId: account.id,
    personId: account.personId,
    institutionId: account.institutionId,
    roles,
    sessionId: session.id,
    accountStatus,
  };

  const accessToken = await signSession(claims, ttl);
  return {
    accessToken,
    accountId: account.id,
    personId: account.personId,
    institutionId: account.institutionId,
    roles,
    givenName: account.person.givenName,
    familyName: account.person.familyName,
    // MFA has no enrolled/verified challenge provider yet, so its configuration must not block sign-in.
    requiresMfa: false,
    accountStatus,
    pauseGate: accountStatus === "paused",
  };
}

export async function changePassword(input: {
  accountId: string;
  institutionId: string;
  currentPassword: string;
  newPassword: string;
  keepSessionId?: string;
}) {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, institutionId: input.institutionId },
    include: { person: true },
  });
  if (!account || account.status !== "active") {
    throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND", status: 404 });
  }
  const ok = await verifyPassword(input.currentPassword, account.passwordHash);
  if (!ok) {
    await writeAuditAndOutbox(prisma, {
      institutionId: input.institutionId,
      actorId: input.accountId,
      eventName: "Account.passwordChangeFailed",
      purpose: "authentication",
      before: null,
      after: { reason: "current_password_incorrect" },
      source: "auth.password.change",
      correlationId: randomUUID(),
    });
    throw Object.assign(new Error("Current password is incorrect"), { code: "VALIDATION_ERROR", status: 400 });
  }
  if (input.currentPassword === input.newPassword) {
    throw Object.assign(new Error("New password must be different"), { code: "VALIDATION_ERROR", status: 400 });
  }
  await validateInstitutionPassword(input.institutionId, input.newPassword, {
    givenName: account.person.givenName,
    familyName: account.person.familyName,
    login: account.email,
  });
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: account.id }, data: { passwordHash } });
    await tx.session.deleteMany({
      where: { accountId: account.id, ...(input.keepSessionId ? { id: { not: input.keepSessionId } } : {}) },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.accountId,
      eventName: "Account.passwordChanged",
      purpose: "authentication",
      before: null,
      after: { revokedOtherSessions: true },
      source: "auth.password.change",
      correlationId: randomUUID(),
    });
  });
  return { ok: true as const };
}

export * from "./approvals.js";
