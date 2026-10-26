import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

async function signedRoleCookie(roles: string[]) {
  const payload = Buffer.from(JSON.stringify({ roles, exp: Math.floor(Date.now() / 1000) + 60 }), "utf8").toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("dev-portal-cookie-secret-change-me"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))).toString("base64url");
  return `${payload}.${signature}`;
}

async function request(path: string, roles: string) {
  const cookie = await signedRoleCookie([roles]);
  return new NextRequest(`https://appslure.app${path}`, {
    headers: { cookie: `mh_roles=${encodeURIComponent(cookie)}` },
  });
}

describe("portal middleware", () => {
  it.each(["/instructor/gradebook?sectionId=section-1", "/instructor/submissions?sectionId=section-1"])(
    "allows an admin to review course work at %s",
    async (path) => {
      const response = await middleware(await request(path, "admin"));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("does not grant an admin general access to the instructor portal", async () => {
    const response = await middleware(await request("/instructor/sections", "admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://appslure.app/admin");
  });

  it("keeps the full instructor portal available to instructors", async () => {
    const response = await middleware(await request("/instructor/gradebook?sectionId=section-1", "instructor"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not trust an unsigned role cookie", async () => {
    const response = await middleware(new NextRequest("https://appslure.app/admin", { headers: { cookie: "mh_roles=admin" } }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://appslure.app/login?next=%2Fadmin");
  });
});
