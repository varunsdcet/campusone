type InterviewRow = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * Only scheduled video interviews may expose a launch action. Room names and
 * phone details stay as plain location text, even if they happen to resemble a
 * URL. Meeting links must use HTTPS because they open outside Campus One.
 */
export function interviewStartUrl(row: InterviewRow): string | null {
  if (text(row.status).toLowerCase() !== "scheduled" || text(row.mode).toLowerCase() !== "video") return null;

  const raw = text(row.location);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

