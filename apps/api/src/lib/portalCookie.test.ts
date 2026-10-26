import { afterEach, describe, expect, it } from "vitest";
import { signPortalCookie, verifyPortalCookie } from "./portalCookie.js";

const originalSecret = process.env.PORTAL_COOKIE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.PORTAL_COOKIE_SECRET;
  else process.env.PORTAL_COOKIE_SECRET = originalSecret;
});

describe("signed portal role cookie", () => {
  it("round-trips roles and rejects tampering", () => {
    process.env.PORTAL_COOKIE_SECRET = "test-portal-secret-with-at-least-32-characters";
    const value = signPortalCookie(["admin", "registrar"], 60);
    expect(verifyPortalCookie(value)).toEqual(["admin", "registrar"]);
    expect(verifyPortalCookie(`${value.slice(0, -1)}x`)).toBeNull();
    expect(verifyPortalCookie("admin")).toBeNull();
  });

  it("rejects expired cookies", () => {
    process.env.PORTAL_COOKIE_SECRET = "test-portal-secret-with-at-least-32-characters";
    expect(verifyPortalCookie(signPortalCookie(["admin"], -1))).toBeNull();
  });
});
