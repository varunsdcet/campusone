/** Reject labelled government identifiers and credential material without blocking ordinary 9-digit campus numbers. */
export function containsRestrictedSecret(question: string) {
  return (
    /\b(?:ssn|sin|social security|social insurance)(?: number)?\s*[:=#-]?\s*\d{3}[- ]?\d{2,3}[- ]?\d{3,4}\b/i.test(question) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(question) ||
    /\b(?:passport(?: number)?|password|access[_ -]?token)\s*[:=]\s*\S{4,}/i.test(question) ||
    /\bbearer\s+[A-Za-z0-9._~-]{12,}/i.test(question)
  );
}
