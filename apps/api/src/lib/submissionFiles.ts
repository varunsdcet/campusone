import { readFile } from "node:fs/promises";
import path from "node:path";

export function submissionStorageRoot() {
  return path.resolve(process.env.OBJECT_STORAGE_ROOT ?? process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), "var", "uploads"));
}

/** Reads a stored submission file; the stored relative path must stay inside the storage root. */
export async function readSubmissionFile(relativePath: string): Promise<Buffer> {
  const root = submissionStorageRoot();
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("Submission file not found"), { status: 404, code: "NOT_FOUND" });
  }
  try {
    return await readFile(full);
  } catch {
    throw Object.assign(new Error("The stored copy of this file is missing. Ask the student to upload it again."), {
      status: 410,
      code: "FILE_MISSING",
    });
  }
}
