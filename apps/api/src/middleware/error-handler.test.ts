import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler.js";

function run(err: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const req = { method: "POST", originalUrl: "/student/assignments/a/files", correlationId: "corr-1" } as unknown as Request;
  errorHandler(err, req, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0]?.[0] as number, body: res.json.mock.calls[0]?.[0] as { error: { code: string; message: string; details?: unknown } } };
}

describe("errorHandler", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  afterEach(() => consoleError.mockClear());

  it("masks unexpected 5xx errors and logs the detail server-side", () => {
    const err = new Error("Invalid `tx.fileObject.findFirst()` invocation in\n/Users/someone/Heritage/apps/api/src/modules/student/student.router.ts:282:27");
    const { status, body } = run(err);
    expect(status).toBe(500);
    expect(body.error).toMatchObject({ code: "INTERNAL", message: "Something went wrong" });
    expect(JSON.stringify(body)).not.toContain("/Users/");
    expect(consoleError).toHaveBeenCalled();
  });

  it("maps Prisma unique-constraint violations to 409 without leaking the Prisma message", () => {
    const err = Object.assign(new Error("\nInvalid `tx.fileObject.create()` invocation in\n/abs/path/student.router.ts:282:27\nUnique constraint failed on the fields: (`submissionId`,`version`)"), { code: "P2002" });
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).not.toMatch(/Invalid|Unique constraint|\/abs\//);
  });

  it("returns 413 for request bodies over the parser limit", () => {
    const err = Object.assign(new Error("request entity too large"), { status: 413, type: "entity.too.large" });
    const { status, body } = run(err);
    expect(status).toBe(413);
    expect(body.error.message).toBe("Files must be 10 MB or smaller");
  });

  it("keeps deliberate client errors as thrown", () => {
    const { status, body } = run(Object.assign(new Error("Assignment not found"), { code: "NOT_FOUND", status: 404 }));
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND", message: "Assignment not found" });
  });
});
