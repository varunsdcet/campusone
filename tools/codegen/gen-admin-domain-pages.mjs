#!/usr/bin/env node
/**
 * Generate admin domain page wrappers from Figma inventory.
 * Each /admin/f/* page uses AdminDomainScreen with inferred archetype.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const inv = JSON.parse(readFileSync(join(ROOT, "tools/register/figma_inventory.json"), "utf8"));
const appRoot = join(ROOT, "apps/web/src/app");

function slugify(name) {
  return name
    .replace(/&amp;/g, "and")
    .replace(/[—–]/g, "-")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function archetype(name) {
  const n = name.toLowerCase();
  if (/dashboard|home|overview|analytics|funnel|conversion|intelligence/.test(n)) return "dashboard";
  if (/queue|list|registry|inbox|catalogue|catalog|runs|submissions|equipment-list|leads$|campaigns$|events$|charges|payments|holds|refund/.test(n))
    return "queue";
  if (/360|detail|case|session|workspace|account|notebook|incident|opportunity|agreement|evaluation|version/.test(n))
    return "detail";
  if (/builder|designer|setup|create|policy|matrix|simulator|templates|form-designer|workflow-designer|rule-designer/.test(n))
    return "builder";
  return "queue";
}

const SKIP = new Set(["canvas", "dev-handoff-canvas", "fd-07-fixture-data-set"]);

let written = 0;
for (const frame of inv.admin) {
  const raw = frame.name.replace(/&amp;/g, "&").trim();
  const key = raw.toLowerCase();
  if (SKIP.has(key) || key.includes("dev-handoff") || key === "canvas") continue;
  if (/^sh-01-login/.test(key)) continue;

  const slug = slugify(raw);
  // Prefer existing special paths from screens sync for known duplicates
  let pathSlug = slug;
  if (slug === "ad-09-loa-builder" && frame.id === "134:9") pathSlug = "ad-09-loa-builder";
  const dir = join(appRoot, "admin/f", pathSlug);
  mkdirSync(dir, { recursive: true });
  const pagePath = join(dir, "page.tsx");
  const type = archetype(raw);
  const content = `"use client";

import { AdminDomainScreen } from "@/components/AdminDomainScreen";

export default function Page() {
  return (
    <AdminDomainScreen
      path="/admin/f/${pathSlug}"
      title=${JSON.stringify(raw)}
      figmaId=${JSON.stringify(frame.id)}
      archetype=${JSON.stringify(type)}
    />
  );
}
`;
  // Keep hand-built queue page
  if (pathSlug === "ad-02-application-queue" && existsSync(pagePath)) {
    const existing = readFileSync(pagePath, "utf8");
    if (!existing.includes("LiveScreen") && existing.includes("AdminPageHeader")) {
      console.log("skip hand-built", pathSlug);
      continue;
    }
  }
  writeFileSync(pagePath, content);
  written += 1;
}

console.log("wrote", written, "admin domain pages");
