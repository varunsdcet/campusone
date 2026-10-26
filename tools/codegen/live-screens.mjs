#!/usr/bin/env node
/**
 * Rewrites fixture/hybrid portal pages to LiveScreen (API-driven, white/green shell).
 * Skips auth, design-system, catalogues, and already-custom interactive flows.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("../../apps/web/src/app/", import.meta.url).pathname;

const SKIP = new Set([
  "/login",
  "/m/login",
  "/mfa",
  "/reset",
  "/role-select",
  "/verify",
  "/design-system",
  "/screens",
  "/archive",
  "/help",
  "/privacy",
  "/accessibility",
  "/offline",
  "/denied",
  "/",
  "/student",
  "/instructor",
  "/admin",
  "/m/student",
  "/student/grades",
  "/instructor/gradebook",
  "/admin/approvals",
  "/admin/search",
]);

const KEEP_IF_CUSTOM = [
  "/student/all",
  "/instructor/all",
  "/admin/all",
  "/applicant/all",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

function pathFromFile(file) {
  const rel = file.slice(appRoot.length).replace(/\/page\.tsx$/, "");
  return "/" + (rel === "" ? "" : rel).replace(/\\/g, "/");
}

function roleGuess(urlPath) {
  if (urlPath.startsWith("/admin")) return "admin";
  if (urlPath.startsWith("/instructor") || urlPath.startsWith("/m/instructor")) return "instructor";
  if (urlPath.startsWith("/applicant")) return "applicant";
  if (urlPath.startsWith("/employer")) return "employer";
  return "student";
}

function mobileActive(urlPath) {
  if (urlPath.includes("/courses")) return "Courses";
  if (urlPath.includes("/grades")) return "Grades";
  if (urlPath.includes("/profile") || urlPath.includes("/fees") || urlPath.includes("/library") || urlPath.includes("/documents"))
    return "More";
  return "Home";
}

function renderPage(urlPath) {
  const mobile = urlPath.startsWith("/m/") && urlPath !== "/m/login";
  if (mobile) {
    return `"use client";

import { LiveScreen } from "@/components/LiveScreen";

export default function Page() {
  return <LiveScreen path="${urlPath}" mobile mobileTitle="Heritage" mobileActive="${mobileActive(urlPath)}" />;
}
`;
  }
  return `"use client";

import { LiveScreen } from "@/components/LiveScreen";

export default function Page() {
  return <LiveScreen path="${urlPath}" />;
}
`;
}

const pages = walk(appRoot);
let rewritten = 0;
let skipped = 0;

for (const file of pages) {
  const urlPath = pathFromFile(file).replace(/\/$/, "") || "/";
  if (SKIP.has(urlPath) || KEEP_IF_CUSTOM.some((p) => urlPath === p)) {
    skipped++;
    continue;
  }
  // Skip dynamic segment folders handled specially
  if (urlPath.includes("[")) {
    skipped++;
    continue;
  }
  const src = readFileSync(file, "utf8");
  const isFixture =
    src.includes("FixtureNotice") ||
    src.includes("FD07") ||
    src.includes('from "@/lib/fixtures"') ||
    src.includes("const rows =") ||
    src.includes('/me/home');
  const alreadyLive = src.includes("LiveScreen");
  if (alreadyLive) {
    skipped++;
    continue;
  }
  // Always rewrite role portal pages under these roots
  const underPortal =
    urlPath.startsWith("/student") ||
    urlPath.startsWith("/instructor") ||
    urlPath.startsWith("/admin") ||
    urlPath.startsWith("/applicant") ||
    urlPath.startsWith("/employer") ||
    urlPath.startsWith("/m/");
  if (!underPortal && !isFixture) {
    skipped++;
    continue;
  }
  writeFileSync(file, renderPage(urlPath));
  rewritten++;
  console.log("rewrote", urlPath);
}

console.log(`Done. rewritten=${rewritten} skipped=${skipped}`);
