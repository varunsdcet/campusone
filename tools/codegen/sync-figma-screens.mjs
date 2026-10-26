#!/usr/bin/env node
/**
 * Sync every unique Figma screen into screens.ts + page.tsx (LiveScreen).
 * Dedupes by normalized Figma name. Skips canvas/dev-handoff meta frames.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const inv = JSON.parse(readFileSync(join(ROOT, "tools/register/figma_inventory.json"), "utf8"));
const appRoot = join(ROOT, "apps/web/src/app");

const SKIP_NAMES = new Set([
  "canvas",
  "dev-handoff-canvas",
  "fd-07-fixture-data-set",
]);

function slugify(name) {
  return name
    .replace(/&amp;/g, "and")
    .replace(/[—–]/g, "-")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function mapScreen(section, id, name) {
  const raw = name.replace(/&amp;/g, "&").trim();
  const key = raw.toLowerCase();
  if (SKIP_NAMES.has(key) || key.includes("dev-handoff") || key === "canvas") return null;

  // Prefer stable IDs from names like ad-09-loa-builder, st-01-..., T01, SH-03
  let code = "";
  const m =
    raw.match(/^([A-Za-z]{1,3}[-_]?\d{1,3})\b/) ||
    raw.match(/^([a-z]{1,3}-\d{1,3})\b/i) ||
    raw.match(/^(SS|FN|LB|PR|WF|RL|FM|AI|PL|AC|RG|CP|CRM|AD|IN|ST|AP|MB|SH|DC|XX)[-_]?\d+/i);
  if (m) code = m[1].toUpperCase().replace(/_/g, "-");

  const slug = slugify(raw);

  if (section === "admin") {
    return {
      id: code || `AD-${slug.slice(0, 24)}`,
      role: "admin",
      path: `/admin/f/${slug}`,
      title: raw,
      group: "Admin",
      figmaId: id,
    };
  }
  if (section === "teacher") {
    // Keep gradebook etc on canonical paths when obvious
    const special = {
      "t01-teacher-dashboard": "/instructor",
      "t07-my-courses-list": "/instructor/sections",
      "t10-assessments-and-gradebook": "/instructor/gradebook",
      "t09-attendance-session": "/instructor/attendance",
      "t16-teacher-messages-and-chat": "/instructor/messages",
      "t17-notification-center": "/instructor/notifications",
      "t18-full-calendar-timetable": "/instructor/calendar",
      "t28-login-page": "/login",
      "sh-01-login-teacher": "/login",
      "in-07-gradebook": "/instructor/gradebook",
      "in-02-my-courses": "/instructor/sections",
      "in-05-attendance": "/instructor/attendance",
    };
    const path = special[slug] || `/instructor/f/${slug}`;
    return {
      id: code || `IN-${slug.slice(0, 24)}`,
      role: "instructor",
      path,
      title: raw,
      group: "Teacher",
      figmaId: id,
    };
  }
  if (section === "student") {
    const special = {
      "st-01-student-dashboard": "/student",
      "st-02-my-courses": "/student/courses",
      "st-03-course-detail": "/student/courses/demo",
      "st-07-grades": "/student/grades",
      "st-08-attendance": "/student/attendance",
      "st-09-schedule": "/student/calendar",
      "st-10-lectures": "/student/lectures",
      "st-12-labs": "/student/labs",
      "st-14-ai-tutor": "/student/ask",
      "st-15-advising": "/student/advising",
      "st-18-finance": "/student/fees",
      "st-21-messages": "/student/messages",
      "st-22-resources": "/student/library",
      "ap-01-applicant-dashboard": "/applicant",
      "ap-02-application-wizard": "/applicant/application",
      "ap-04-documents": "/applicant/documents",
      "ap-07-offer": "/applicant/offers",
    };
    let path = special[slug] || (slug.startsWith("ap-") ? `/applicant/f/${slug}` : `/student/f/${slug}`);
    return {
      id: code || `ST-${slug.slice(0, 24)}`,
      role: slug.startsWith("ap-") ? "applicant" : "student",
      path,
      title: raw,
      group: slug.startsWith("ap-") ? "Applicant" : "Student",
      figmaId: id,
    };
  }
  if (section === "auth") {
    const special = {
      "sh-01-login": "/login",
      "sh-01-login-student": "/login",
      "sh-02-mfa": "/mfa",
      "sh-03-reset-password": "/reset",
      "sh-04-role-selection": "/role-select",
      "sh-11-administration-home": "/admin",
      "sh-12-approval-inbox": "/admin/approvals",
      "sh-13-analytics-home": "/admin/analytics",
      "sh-14-error-404": "/denied",
      "sh-15-error-5xx": "/offline",
      "sh-16-session-expired": "/login",
      "sh-17-help-centre": "/help",
      "sh-18-accessibility-statement": "/accessibility",
      "sh-19-privacy-policy": "/privacy",
      "sh-06-universal-search": "/admin/search",
      "sh-05-notifications": "/admin/notifications",
      "sh-07-calendar": "/admin/calendar",
      "sh-08-profile": "/admin/profile",
      "sh-09-security": "/admin/security",
      "sh-10-privacy": "/privacy",
      "mobile-student-home": "/m/student",
      "mobile-course": "/m/student/courses",
      "mobile-ask-myheritage": "/m/student",
      "mb-04-mobile-grades": "/m/student/grades",
      "mb-08-mobile-fees": "/m/student/fees",
      "mb-09-mobile-library": "/m/student/library",
      "mb-10-mobile-documents": "/m/student/documents",
      "mb-07-mobile-profile": "/m/student/profile",
      "mb-06-instructor-home": "/m/instructor/home",
      "mb-07-instructor-attendance": "/m/instructor/attendance",
      "mb-08-instructor-grading": "/m/instructor/grades",
    };
    const path = special[slug] || (slug.startsWith("mb-") || slug.startsWith("mobile-")
      ? `/m/f/${slug}`
      : slug.startsWith("dc-")
        ? `/docs/f/${slug}`
        : `/shared/f/${slug}`);
    const role = path.startsWith("/m/")
      ? "mobile"
      : path.startsWith("/admin")
        ? "admin"
        : "shared";
    return {
      id: code || `SH-${slug.slice(0, 24)}`,
      role,
      path,
      title: raw,
      group: path.startsWith("/m/") ? "Mobile" : path.startsWith("/docs") ? "Documents" : "Shared",
      figmaId: id,
    };
  }
  if (section === "components") {
    const special = {
      "component-library-buttons-inputs": "/design-system",
      "component-library-cards-tables-status": "/design-system/cards",
      "component-library-patterns-states": "/design-system/patterns",
      "design-tokens-sheet": "/design-system/tokens",
      "admin-shell-component": "/design-system/shell",
      "state-loading": "/design-system/state-loading",
      "state-empty": "/design-system/state-empty",
      "state-error": "/design-system/state-error",
      "state-permission-denied": "/denied",
      "state-offline": "/offline",
      "state-archived": "/archive",
      "fd-05-responsive-breakpoints": "/design-system/breakpoints",
      "fd-06-accessibility-annotations": "/accessibility",
    };
    return {
      id: code || `UI-${slug.slice(0, 24)}`,
      role: "shared",
      path: special[slug] || `/design-system/f/${slug}`,
      title: raw,
      group: "Design System",
      figmaId: id,
    };
  }
  return null;
}

const entries = [];
const byPath = new Map();

for (const [section, frames] of Object.entries(inv)) {
  for (const { id, name } of frames) {
    const mapped = mapScreen(section, id, name);
    if (!mapped) continue;
    if (byPath.has(mapped.path)) {
      // keep first; record alias
      const prev = byPath.get(mapped.path);
      prev.aliases = prev.aliases || [];
      prev.aliases.push({ id, name, section });
      continue;
    }
    byPath.set(mapped.path, mapped);
    entries.push(mapped);
  }
}

// Ensure essential canonical routes exist
const essentials = [
  { id: "SH-01", role: "shared", path: "/login", title: "Sign in", group: "Shared" },
  { id: "MB-11", role: "mobile", path: "/m/login", title: "Mobile sign in", group: "Mobile" },
  { id: "ST-01", role: "student", path: "/student", title: "Student home", group: "Student" },
  { id: "IN-01", role: "instructor", path: "/instructor", title: "Teacher home", group: "Teacher" },
  { id: "AD-HOME", role: "admin", path: "/admin", title: "Administration home", group: "Admin" },
  { id: "SH-12", role: "admin", path: "/admin/approvals", title: "Approval inbox", group: "Admin" },
  { id: "IN-07", role: "instructor", path: "/instructor/gradebook", title: "Gradebook", group: "Teacher" },
  { id: "ST-07", role: "student", path: "/student/grades", title: "Grades", group: "Student" },
  { id: "ST-DEG", role: "student", path: "/student/degree", title: "Degree progress", group: "Student" },
  { id: "UI-LIB", role: "shared", path: "/design-system", title: "Component library", group: "Design System" },
  { id: "AD-USERS", role: "admin", path: "/admin/users", title: "Users & roles", group: "Admin" },
  { id: "AD-CREATE-USER", role: "admin", path: "/admin/users/create", title: "Create user", group: "Admin" },
  { id: "AD-CREATE-SECTION", role: "admin", path: "/admin/sections/create", title: "Create section", group: "Admin" },
  { id: "AD-ENROL", role: "admin", path: "/admin/enrolments", title: "Enrolments", group: "Admin" },
];
for (const e of essentials) {
  if (!byPath.has(e.path)) {
    byPath.set(e.path, e);
    entries.push(e);
  }
}

entries.sort((a, b) => a.path.localeCompare(b.path));

// Write screens.ts
const screensTs = `/** Canonical MyHeritage screen catalogue — synced from Figma inventory (deduped by path). */

export type ScreenEntry = {
  id: string;
  role: "student" | "instructor" | "admin" | "applicant" | "employer" | "shared" | "mobile" | "public";
  path: string;
  title: string;
  group: string;
  figmaId?: string;
};

export const ALL_SCREENS: ScreenEntry[] = [
${entries
  .map(
    (e) =>
      `  { id: ${JSON.stringify(e.id)}, role: ${JSON.stringify(e.role)}, path: ${JSON.stringify(e.path)}, title: ${JSON.stringify(e.title)}, group: ${JSON.stringify(e.group)}${e.figmaId ? `, figmaId: ${JSON.stringify(e.figmaId)}` : ""} },`,
  )
  .join("\n")}
];

export function screensForGroup(group: string) {
  return ALL_SCREENS.filter((s) => s.group === group);
}

export const FIGMA_COUNTS = {
  adminUnique: ${inv.admin.length},
  teacherUnique: ${inv.teacher.length},
  studentUnique: ${inv.student.length},
  authUnique: ${inv.auth.length},
  componentsUnique: ${inv.components.length},
  catalogPaths: ${entries.length},
} as const;
`;

writeFileSync(join(ROOT, "apps/web/src/lib/screens.ts"), screensTs);

const CUSTOM = new Set([
  "/login",
  "/m/login",
  "/mfa",
  "/reset",
  "/role-select",
  "/verify",
  "/student",
  "/instructor",
  "/admin",
  "/m/student",
  "/student/grades",
  "/instructor/gradebook",
  "/admin/approvals",
  "/admin/search",
  "/admin/users/create",
  "/admin/sections/create",
  "/admin/enrolments",
  "/design-system",
  "/help",
  "/privacy",
  "/accessibility",
  "/offline",
  "/denied",
  "/archive",
]);

function pageContent(path) {
  const mobile = path.startsWith("/m/");
  if (mobile) {
    return `"use client";

import { LiveScreen } from "@/components/LiveScreen";

export default function Page() {
  return <LiveScreen path="${path}" mobile mobileTitle="Heritage" />;
}
`;
  }
  return `"use client";

import { LiveScreen } from "@/components/LiveScreen";

export default function Page() {
  return <LiveScreen path="${path}" />;
}
`;
}

let created = 0;
let skipped = 0;
for (const e of entries) {
  if (CUSTOM.has(e.path) || e.path.includes("[")) {
    skipped++;
    continue;
  }
  const rel = e.path.replace(/^\//, "");
  const dir = join(appRoot, rel);
  const file = join(dir, "page.tsx");
  mkdirSync(dir, { recursive: true });
  if (existsSync(file)) {
    const cur = readFileSync(file, "utf8");
    // Don't clobber hand-built interactive pages
    if (!cur.includes("LiveScreen") && (cur.includes("useState") || cur.includes("api<") || cur.includes("AppShell"))) {
      skipped++;
      continue;
    }
  }
  writeFileSync(file, pageContent(e.path));
  created++;
}

const summary = {
  catalogPaths: entries.length,
  createdPages: created,
  skippedCustom: skipped,
  byGroup: Object.fromEntries(
    [...new Set(entries.map((e) => e.group))].map((g) => [g, entries.filter((e) => e.group === g).length]),
  ),
};
writeFileSync(join(ROOT, "tools/register/figma_sync_summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
