import type { NextFunction, Request, Response } from "express";
import { ErrorEnvelope } from "@myheritage/contracts";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const e = (err ?? {}) as {
    status?: number;
    code?: string;
    message?: string;
    issues?: Array<{ path?: Array<string | number>; message?: string }>;
    name?: string;
    type?: string;
  };
  const correlationId = (req as Request & { correlationId?: string }).correlationId ?? "unknown";
  const isValidationError = e.name === "ZodError";
  const isTooLarge = e.type === "entity.too.large";
  const isUniqueConflict = e.code === "P2002";
  const status = isTooLarge ? 413 : isUniqueConflict ? 409 : (e.status ?? (isValidationError ? 400 : 500));
  const firstIssue = isValidationError ? e.issues?.[0] : undefined;
  const issueHint = firstIssue
    ? `${firstIssue.path?.length ? `${firstIssue.path.join(".")}: ` : ""}${firstIssue.message ?? "invalid"}`
    : null;
  let code = e.code ?? (isValidationError ? "VALIDATION_ERROR" : "INTERNAL");
  let message = isValidationError
    ? issueHint
      ? `Invalid request (${issueHint})`
      : "Invalid request"
    : (e.message ?? "Unexpected error");
  let details: unknown = e.issues;
  if (isTooLarge) {
    code = "PAYLOAD_TOO_LARGE";
    message = "Files must be 10 MB or smaller";
  } else if (isUniqueConflict) {
    code = "CONFLICT";
    message = "This record was changed at the same time by another request. Refresh and try again.";
    details = undefined;
  } else if (status >= 500) {
    console.error(`[${correlationId}] ${req.method} ${req.originalUrl} failed`, err);
    // Only deliberately thrown upstream failures (explicit 5xx status) keep their message; anything unexpected
    // (Prisma, filesystem, programming errors) can carry schema details or absolute paths.
    if (e.status === undefined) {
      code = "INTERNAL";
      message = "Something went wrong";
      details = undefined;
    }
  }
  const body = ErrorEnvelope.parse({ error: { code, message, details, correlationId } });
  res.status(status).json(body);
}
