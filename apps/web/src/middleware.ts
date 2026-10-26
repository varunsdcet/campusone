import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  registrar: "/admin",
  instructor: "/instructor",
  student: "/student",
  applicant: "/applicant",
  employer: "/employer",
};

function portalForPath(pathname: string): string | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/archive" || pathname.startsWith("/archive/")) return "admin";
  if (pathname === "/design-system" || pathname.startsWith("/design-system/")) return "admin";
  if (pathname === "/instructor" || pathname.startsWith("/instructor/")) return "instructor";
  if (pathname === "/student" || pathname.startsWith("/student/")) return "student";
  if (pathname === "/applicant" || pathname.startsWith("/applicant/")) return "applicant";
  if (pathname === "/employer" || pathname.startsWith("/employer/")) return "employer";
  return null;
}

function decodeBase64Url(raw: string) {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
}

async function rolesFromCookie(raw: string | undefined): Promise<string[]> {
  if (!raw) return [];
  try {
    const [payload, signature] = raw.split(".");
    if (!payload || !signature) return [];
    const secret = (process.env.PORTAL_COOKIE_SECRET || process.env.JWT_SECRET || "dev-portal-cookie-secret-change-me").trim();
    if (process.env.NODE_ENV === "production" && secret.length < 32) return [];
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload)))) return [];
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { roles?: unknown; exp?: unknown };
    if (!Array.isArray(parsed.roles) || typeof parsed.exp !== "number" || parsed.exp <= Date.now() / 1000) return [];
    return parsed.roles.map(String);
  } catch {
    return [];
  }
}

function homeForRoles(roles: string[]): string {
  for (const role of ["admin", "registrar", "instructor", "applicant", "employer", "student"]) {
    if (roles.includes(role)) return ROLE_HOME[role] ?? "/login";
  }
  return "/login";
}

function canAccess(portal: string, roles: string[]): boolean {
  if (portal === "admin") return roles.includes("admin") || roles.includes("registrar");
  return roles.includes(portal);
}

function canReviewCourseWork(pathname: string, roles: string[]): boolean {
  if (!roles.includes("admin") && !roles.includes("registrar")) return false;
  return pathname === "/instructor/gradebook" || pathname === "/instructor/submissions";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const portal = portalForPath(pathname);
  if (!portal) return NextResponse.next();

  const roles = await rolesFromCookie(request.cookies.get("mh_roles")?.value);
  if (roles.length === 0) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (!canAccess(portal, roles) && !canReviewCourseWork(pathname, roles)) {
    const dest = request.nextUrl.clone();
    dest.pathname = homeForRoles(roles);
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/archive",
    "/archive/:path*",
    "/design-system",
    "/design-system/:path*",
    "/instructor",
    "/instructor/:path*",
    "/student",
    "/student/:path*",
    "/applicant",
    "/applicant/:path*",
    "/employer",
    "/employer/:path*",
  ],
};
