import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = (process.env.PORTAL_COOKIE_SECRET || process.env.JWT_SECRET || "").trim();
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    throw new Error("PORTAL_COOKIE_SECRET or JWT_SECRET must be at least 32 characters in production");
  }
  return value || "dev-portal-cookie-secret-change-me";
}

export function signPortalCookie(roles: string[], maxAgeSeconds: number) {
  const payload = Buffer.from(JSON.stringify({ roles: roles.map(String), exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPortalCookie(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { roles?: unknown; exp?: unknown };
    if (!Array.isArray(parsed.roles) || typeof parsed.exp !== "number" || parsed.exp <= Date.now() / 1000) return null;
    return parsed.roles.map(String);
  } catch { return null; }
}
