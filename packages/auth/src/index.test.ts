import { describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { hasRole, ipAllowed, sessionDuration, signSession } from "./index.js";

describe("auth helpers", () => {
  it("checks roles", () => {
    expect(hasRole(["student"], "student")).toBe(true);
    expect(hasRole(["student"], ["instructor", "admin"])).toBe(false);
  });

  it("treats numeric session TTL as relative seconds", async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await signSession({
      sub: "account-1",
      accountId: "account-1",
      personId: "person-1",
      institutionId: "institution-1",
      roles: ["student"],
      sessionId: "session-1",
      accountStatus: "active",
    }, 60);
    const payload = decodeJwt(token);
    expect(payload.exp).toBeGreaterThanOrEqual(issuedAt + 59);
    expect(payload.exp).toBeLessThanOrEqual(issuedAt + 61);
  });

  it("supports a five-hour session setting", () => {
    expect(sessionDuration({ expiry: "5 hours of inactivity" }, true)).toEqual({
      remember: true,
      ttlMs: 5 * 60 * 60_000,
      ttl: 5 * 60 * 60,
    });
  });
});

describe("institution IP policy", () => {
  it("supports exact IPv4 addresses and CIDR ranges", () => {
    expect(ipAllowed("203.0.113.8", ["203.0.113.8"])).toBe(true);
    expect(ipAllowed("203.0.113.25", ["203.0.113.0/24"])).toBe(true);
    expect(ipAllowed("203.0.114.25", ["203.0.113.0/24"])).toBe(false);
    expect(ipAllowed("::ffff:10.2.3.4", ["10.0.0.0/8"])).toBe(true);
  });

  it("fails closed for malformed addresses and rules", () => {
    expect(ipAllowed("not-an-ip", ["0.0.0.0/0"])).toBe(false);
    expect(ipAllowed("203.0.113.8", ["203.0.113.0/99", "invalid"])).toBe(false);
  });
});
