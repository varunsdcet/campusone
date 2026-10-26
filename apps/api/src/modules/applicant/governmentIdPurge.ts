import path from "node:path";
import { rm } from "node:fs/promises";
import { prisma } from "@myheritage/db";
import { isGovernmentIdDocument } from "./applicationForm.js";

/** Form keys that held a government identifier before the privacy rule; they must never be kept. */
export const GOVERNMENT_ID_KEY = /^(sin|ssn|sin_?number|social_?insurance.*|social_?security.*|passport.*|government_?id.*)$/i;

export function stripGovernmentIdKeys(formJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(formJson || "{}");
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed as Record<string, unknown>);
  const kept = entries.filter(([k]) => !GOVERNMENT_ID_KEY.test(k));
  return kept.length === entries.length ? null : JSON.stringify(Object.fromEntries(kept));
}

/** Application rows as shown to staff or AI tools: no government-ID values or documents. */
export function redactApplication<T extends { formJson?: string; documents?: Array<{ label: string }> }>(app: T): T {
  const formJson = app.formJson === undefined ? undefined : (stripGovernmentIdKeys(app.formJson) ?? app.formJson);
  return {
    ...app,
    ...(formJson === undefined ? {} : { formJson }),
    ...(app.documents ? { documents: app.documents.filter((d) => !isGovernmentIdDocument(d.label)) } : {}),
  };
}

/**
 * Removes government-ID data collected before the privacy rule: the identifier values in
 * application forms, and passport / SIN / government-ID checklist rows with their uploaded files.
 * Idempotent, so it is safe to run on every start.
 */
export async function purgeLegacyGovernmentIdData() {
  const storageRoot = path.resolve(process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), "var", "uploads"));
  const docs = (await prisma.applicationDocument.findMany({ select: { id: true, institutionId: true, applicationId: true, label: true, fileName: true } })).filter((d) =>
    isGovernmentIdDocument(d.label),
  );
  let files = 0;
  for (const d of docs) {
    if (d.fileName) {
      const stored = path.resolve(storageRoot, d.institutionId, "applicant", d.applicationId, `${d.id}-${path.basename(d.fileName)}`);
      if (stored.startsWith(`${storageRoot}${path.sep}`)) {
        await rm(stored, { force: true });
        files++;
      }
    }
  }
  if (docs.length) await prisma.applicationDocument.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });

  const apps = await prisma.admissionsApplication.findMany({ select: { id: true, formJson: true } });
  let forms = 0;
  for (const a of apps) {
    const cleaned = stripGovernmentIdKeys(a.formJson);
    if (cleaned === null) continue;
    await prisma.admissionsApplication.update({ where: { id: a.id }, data: { formJson: cleaned } });
    forms++;
  }
  return { documents: docs.length, files, forms };
}
