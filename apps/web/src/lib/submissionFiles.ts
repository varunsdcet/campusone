import { api, loadSession } from "@/lib/api";

export const SUBMISSION_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".zip"];

/** Mirrors the server checks so students see the reason before the upload starts. */
export function submissionFileProblem(
  file: File,
  rules: { acceptedTypes?: string[]; maxFileBytes?: number | null; fileSubmissions?: boolean } = {},
): string | null {
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (rules.fileSubmissions === false) return "This assignment accepts online text only, not file uploads";
  if (!SUBMISSION_EXTENSIONS.includes(extension)) {
    return `${extension ? `"${extension}" files are` : "Files without an extension are"} not accepted. Upload a PDF, Word (.doc, .docx), Excel (.xls, .xlsx), CSV, PNG, JPEG or ZIP file.`;
  }
  const accepted = rules.acceptedTypes ?? [];
  if (accepted.length && !accepted.includes(extension)) {
    return `This assignment only accepts ${accepted.join(", ")} files. "${extension}" is not one of them.`;
  }
  if (file.size === 0) return "The file is empty. Choose another file.";
  const limit = Math.min(rules.maxFileBytes || Infinity, 10 * 1024 * 1024);
  if (file.size > limit) {
    return `This file is ${formatMegabytes(file.size)}. ${
      limit < 10 * 1024 * 1024 ? `This assignment accepts files up to ${formatMegabytes(limit)}.` : "Files must be 10 MB or smaller"
    }`;
  }
  return null;
}

export function formatMegabytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** Fetches a stored submission file (JSON name/mime/base64) and either opens it in a new tab or saves it. */
export async function fetchSubmissionFile(apiPath: string, mode: "open" | "download") {
  const session = loadSession();
  if (!session) throw new Error("Sign in again to open files");
  const popup = mode === "open" ? window.open("", "_blank") : null;
  try {
    const file = await api<{ name: string; mime: string; base64: string }>(apiPath, {}, session.accessToken);
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.mime || "application/octet-stream" }));
    if (popup) {
      popup.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}
