import type { SessionClaims } from "@myheritage/contracts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  admissionsApplication: { findFirst: vi.fn(), update: vi.fn() },
  applicationDocument: { update: vi.fn() },
  applicationTimelineEvent: { create: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));

import { runApplicantAction } from "./applicant.service.js";

const user: SessionClaims = {
  sub: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
  personId: "00000000-0000-4000-8000-000000000003",
  institutionId: "00000000-0000-4000-8000-000000000004",
  roles: ["applicant"],
  sessionId: "00000000-0000-4000-8000-000000000005",
};

const documentId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  vi.clearAllMocks();
  db.admissionsApplication.findFirst.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000020",
    status: "draft",
    documents: [{ id: documentId, label: "Transcript", status: "missing", fileName: null }],
    offers: [],
    timeline: [],
  });
});

afterEach(() => {
  delete process.env.FILE_STORAGE_ROOT;
});

describe("applicant upload_document validation", () => {
  it("rejects an empty file with a clear message", async () => {
    await expect(
      runApplicantAction(user, "upload_document", {
        documentId,
        filename: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        contentBase64: "",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "The selected file is empty (0 bytes). Choose a file that has content.",
    });
  });

  it("lists the allowed file types when the type is not allowed", async () => {
    await expect(
      runApplicantAction(user, "upload_document", {
        documentId,
        filename: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        contentBase64: Buffer.from("test").toString("base64"),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "File type not allowed. Allowed file types: .pdf, .doc, .docx, .png, .jpg, .jpeg",
    });
  });

  it("rejects files larger than 10 MB before writing them", async () => {
    await expect(
      runApplicantAction(user, "upload_document", {
        documentId,
        filename: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10 * 1024 * 1024 + 1,
        contentBase64: "AAAA",
      }),
    ).rejects.toMatchObject({
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "Files must be 10 MB or smaller",
    });
  });

  it("writes a valid document to the configured persistent storage root", async () => {
    const storageRoot = await mkdtemp(path.join(os.tmpdir(), "heritage-applicant-upload-"));
    process.env.FILE_STORAGE_ROOT = storageRoot;
    const content = Buffer.from("%PDF-1.4\n");
    try {
      await expect(
        runApplicantAction(user, "upload_document", {
          documentId,
          filename: "transcript.pdf",
          mimeType: "application/pdf",
          sizeBytes: content.byteLength,
          contentBase64: content.toString("base64"),
        }),
      ).resolves.toMatchObject({ ok: true, documentId, status: "uploaded", fileName: "transcript.pdf" });

      const stored = path.join(
        storageRoot,
        user.institutionId,
        "applicant",
        "00000000-0000-4000-8000-000000000020",
        `${documentId}-transcript.pdf`,
      );
      await expect(readFile(stored)).resolves.toEqual(content);
      expect(db.applicationDocument.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: { status: "uploaded", fileName: "transcript.pdf" },
      });
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
