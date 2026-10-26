/**
 * Extracts live data blobs from ADMIN_SIS_SCREENS into packages/db/src/sis-seed.json
 * Run: pnpm --filter @myheritage/web exec tsx scripts/export-admin-sis-seed.ts
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_SIS_SCREENS } from "../src/lib/adminSisCatalog";

const CHROME = new Set([
  "path",
  "figmaId",
  "title",
  "subtitle",
  "breadcrumbs",
  "activeHref",
  "archetype",
  "primaryAction",
  "primaryActionHref",
  "secondaryAction",
  "secondaryActionHref",
  "secondaryActions",
  "secondaryActionHrefs",
  "platformNav",
  "labsNav",
  "aiNav",
  "complianceNav",
  "academicsNav",
  "searchPlaceholder",
  "filters",
  "columns",
  "columnTemplate",
  "hideRowAction",
  "rowHref",
  "workspacePanels",
]);

const out: Record<string, Record<string, unknown>> = {};
for (const [path, config] of Object.entries(ADMIN_SIS_SCREENS)) {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (CHROME.has(k) || v === undefined) continue;
    payload[k] = v;
  }
  out[path] = payload;
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../../../packages/db/src/sis-seed.json");
writeFileSync(target, JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} screens → ${target}`);
