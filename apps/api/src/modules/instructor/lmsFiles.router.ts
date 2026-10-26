import { Router } from "express";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { bytesMatchMime, decodeBase64 } from "../../lib/fileSniff.js";
import { lmsFileIsReferenced, studentCanAccessLmsFile } from "./lmsAccessRestrictions.js";
import { loadSectionOverlay } from "./lmsQuiz.js";
import { isFacultyAssigned } from "./sectionFaculty.js";

/** Files attached to course activities (FILE / FOLDER). Stored per section; readable by the section's teacher, admins and its students. */
export const lmsFilesRouter: Router = Router();

const SCREEN = "LMS:FILE";
const FILE_MAX = 8 * 1024 * 1024;
const FILE_TYPES =
  /^(image\/(png|jpe?g|gif|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)|application\/vnd\.ms-(powerpoint|excel)|text\/(plain|csv))$/;

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

type SectionAccess = { mode: "manage" } | { mode: "read"; studentId: string };

async function sectionAccess(user: SessionClaims, sectionId: string): Promise<SectionAccess> {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: user.institutionId },
    select: { id: true, instructorPersonId: true },
  });
  if (!section) throw httpError("Course section not found", "NOT_FOUND", 404);
  if (await isFacultyAssigned(user, section)) return { mode: "manage" };
  const enrolled = await prisma.enrolment.findFirst({
    where: {
      institutionId: user.institutionId,
      sectionId,
      status: { in: ["enrolled", "completed"] },
      student: { personId: user.personId },
    },
    select: { studentId: true },
  });
  if (enrolled) return { mode: "read", studentId: enrolled.studentId };
  throw httpError("You are not part of this course", "FORBIDDEN", 403);
}

const UploadBody = z.object({
  sectionId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(200),
  base64: z.string().min(1).max(12_000_000),
});

lmsFilesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = UploadBody.parse(req.body);
    if ((await sectionAccess(user, body.sectionId)).mode !== "manage") {
      throw httpError("Only the course instructor or an administrator can upload course files", "FORBIDDEN", 403);
    }
    const mime = body.mime.toLowerCase();
    if (!FILE_TYPES.test(mime)) {
      throw httpError("Unsupported file type. Upload a PDF, Office document, text file or image.", "VALIDATION_ERROR", 400);
    }
    const b64 = body.base64.replace(/^data:[^,]*,/, "");
    const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
    if (!size) throw httpError("The file is empty", "VALIDATION_ERROR", 400);
    if (size > FILE_MAX) throw httpError("Files must be 8 MB or smaller", "VALIDATION_ERROR", 400);
    if (!bytesMatchMime(decodeBase64(b64), mime)) {
      throw httpError("The file contents do not match its declared type", "VALIDATION_ERROR", 400);
    }
    const name = body.name.replace(/[\\/]/g, "_");
    const rec = await prisma.heritageRecord.create({
      data: {
        institutionId: user.institutionId,
        screenId: SCREEN,
        contextKey: body.sectionId,
        dataJson: JSON.stringify({ name, mime, size, base64: b64 }),
        createdById: user.accountId,
        updatedById: user.accountId,
      },
    });
    res.status(201).json({ id: rec.id, name, mime, size });
  } catch (err) {
    next(err);
  }
});

lmsFilesRouter.get("/:sectionId/:fileId", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const sectionId = String(req.params.sectionId);
    const fileId = String(req.params.fileId);
    const access = await sectionAccess(user, sectionId);
    const rec = await prisma.heritageRecord.findFirst({
      where: {
        id: fileId,
        institutionId: user.institutionId,
        deletedAt: null,
        OR: [{ screenId: SCREEN, contextKey: sectionId }, { screenId: "CM:FILE" }],
      },
      select: { dataJson: true, screenId: true },
    });
    if (!rec) throw httpError("This file is no longer available", "NOT_FOUND", 404);
    const overlay = await loadSectionOverlay(user.institutionId, sectionId);
    if (rec.screenId === "CM:FILE" && !lmsFileIsReferenced(overlay, fileId)) {
      throw httpError("This file is not available in this course", "NOT_FOUND", 404);
    }
    if (access.mode === "read") {
      if (!studentCanAccessLmsFile(overlay, fileId, access.studentId)) {
        throw httpError("This file is not available", "NOT_FOUND", 404);
      }
    }
    const d = JSON.parse(rec.dataJson) as { name?: string; mime?: string; base64?: string };
    res.json({ name: d.name || "file", mime: d.mime || "application/octet-stream", base64: d.base64 || "" });
  } catch (err) {
    next(err);
  }
});
