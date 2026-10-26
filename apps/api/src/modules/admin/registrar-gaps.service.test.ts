import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  studentDocument: { findMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));
vi.mock("./heritage/enrolment.js", () => ({ assertSeat: vi.fn() }));

import { listStudentDocumentsForStudent } from "./registrar-gaps.service.js";

function doc(id: string, downloadUrl: string | null) {
  return { id, recordName: `Doc ${id}`, recordDate: null, docLabel: null, downloadUrl, status: "available" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listStudentDocumentsForStudent", () => {
  it("drops unsafe stored download links before returning them to students", async () => {
    db.studentDocument.findMany.mockResolvedValue([
      doc("1", "https://example.com/transcript.pdf"),
      doc("2", "/student/documents/letter"),
      doc("3", "javascript:alert(1)"),
      doc("4", "data:text/html,<script>alert(1)</script>"),
      doc("5", "//evil.example.com/x"),
      doc("6", null),
    ]);

    const { items } = await listStudentDocumentsForStudent("inst-1", "student-1");

    expect(items.map((i) => i.downloadUrl)).toEqual([
      "https://example.com/transcript.pdf",
      "/student/documents/letter",
      null,
      null,
      null,
      null,
    ]);
  });

  it("never exposes a restricted or archived vault file link", async () => {
    db.studentDocument.findMany.mockResolvedValue([
      { ...doc("restricted", "https://example.com/restricted.pdf"), status: "restricted" },
      { ...doc("archived", "/student/documents/archived"), status: "archived" },
    ]);

    const { items } = await listStudentDocumentsForStudent("inst-1", "student-1");

    expect(items.map((item) => item.downloadUrl)).toEqual([null, null]);
  });
});
