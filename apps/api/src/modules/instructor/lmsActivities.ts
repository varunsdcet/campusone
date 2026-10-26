import { randomUUID } from "node:crypto";
import { MAX_STUDENT_FILE_BYTES } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { isSafeLink } from "../../lib/safeLink.js";
import { sanitizeLessonHtml } from "./aiDraftContent.js";
import { LMS_ACCESS_RESTRICTIONS_KEY, serializeLmsAccessRestrictions } from "./lmsAccessRestrictions.js";

/** Extensions a student may upload (mirrors the submission upload whitelist). */
export const SUBMISSION_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".zip"];

/** Form keys that carry routing or upload plumbing rather than instructor-entered settings. */
const NON_SETTING_KEYS = new Set([
  "TopicId",
  "topicId",
  "ActivityType",
  "Code",
  "Id",
  "FileId",
  "Storyboard",
  "Body",
  "NotifyStudentIds",
  "PublishMeeting",
  "sectionId",
]);

export type LmsAssignmentSettings = {
  instructions?: string;
  availableFrom?: string;
  dueAt?: string;
  cutoffAt?: string;
  gradeBy?: string;
  maxScore: number;
  weightPercent: number;
  fileSubmissions: boolean;
  onlineText: boolean;
  maxFiles?: number;
  maxFileBytes?: number;
  acceptedTypes?: string;
};

export type LmsActivityContent = {
  body?: string;
  description?: string;
  url?: string;
  hidden: boolean;
  settings: Record<string, string>;
  assignment?: LmsAssignmentSettings;
};

function badRequest(message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status: 400, code });
}

const checked = (value: string | undefined) => /^(yes|true|on|1)$/i.test(String(value ?? "").trim());

function parseFormDate(fields: Record<string, string>, key: string): Date | null {
  const raw = (fields[key] || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw badRequest(`${key} is not a valid date`);
  return date;
}

/** Accepts `http(s)://` links only; site-relative paths are not meaningful as an external resource. */
export function parseExternalUrl(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) throw badRequest("External URL is required");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest("External URL must be a full address starting with https:// or http://");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !isSafeLink(url.href)) {
    throw badRequest("External URL must be a full address starting with https:// or http://");
  }
  return url.href;
}

export function parseSizeLimit(label: string | undefined): number | undefined {
  const match = /(\d+(?:\.\d+)?)\s*MB/i.exec(label || "");
  if (!match || /site upload limit/i.test(label || "")) return undefined;
  return Math.min(Math.round(Number(match[1]) * 1024 * 1024), MAX_STUDENT_FILE_BYTES);
}

export function parseAcceptedTypes(value: string | undefined): string | undefined {
  const items = (value || "")
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => (t.startsWith(".") ? t : `.${t}`));
  if (!items.length) return undefined;
  const unsupported = items.filter((t) => !SUBMISSION_EXTENSIONS.includes(t));
  if (unsupported.length) {
    throw badRequest(
      `Accepted file types can only include ${SUBMISSION_EXTENSIONS.join(", ")}. Remove ${unsupported.join(", ")}.`,
    );
  }
  return [...new Set(items)].join(",");
}

function parseNumber(value: string | undefined, fallback: number, label: string, min: number, max: number) {
  const raw = (value || "").trim().replace(/%$/, "");
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${label} must be a number from ${min} to ${max}`);
  return n;
}

export function parseAssignmentSettings(fields: Record<string, string>): LmsAssignmentSettings {
  const availableFrom = parseFormDate(fields, "Allow submissions from");
  const dueAt = parseFormDate(fields, "Due date");
  const cutoffAt = parseFormDate(fields, "Cut-off date");
  const gradeBy = parseFormDate(fields, "Remind me to grade by");
  if (availableFrom && dueAt && dueAt < availableFrom) {
    throw badRequest("Due date must be after the date submissions open");
  }
  if (dueAt && cutoffAt && cutoffAt < dueAt) {
    throw badRequest("Cut-off date must be on or after the due date");
  }
  const fileSubmissions = fields["File submissions"] === undefined ? true : checked(fields["File submissions"]);
  const onlineText = checked(fields["Online text"]);
  if (!fileSubmissions && !onlineText) {
    throw badRequest("Choose at least one submission type (file submissions or online text)");
  }
  const instructions = (fields["Activity instructions"] || "").trim().slice(0, 20_000);
  const maxFiles = fileSubmissions
    ? parseNumber(fields["Maximum number of uploaded files"], 20, "Maximum number of uploaded files", 1, 100)
    : undefined;
  return {
    ...(instructions ? { instructions } : {}),
    ...(availableFrom ? { availableFrom: availableFrom.toISOString() } : {}),
    ...(dueAt ? { dueAt: dueAt.toISOString() } : {}),
    ...(cutoffAt ? { cutoffAt: cutoffAt.toISOString() } : {}),
    ...(gradeBy ? { gradeBy: gradeBy.toISOString() } : {}),
    maxScore: parseNumber(fields["Maximum grade"], 100, "Maximum grade", 1, 10_000),
    weightPercent: parseNumber(fields["Course Mark Weight"], 0, "Course Mark Weight", 0, 100),
    fileSubmissions,
    onlineText,
    ...(maxFiles ? { maxFiles: Math.floor(maxFiles) } : {}),
    ...(fileSubmissions && parseSizeLimit(fields["Maximum submission size"])
      ? { maxFileBytes: parseSizeLimit(fields["Maximum submission size"]) }
      : {}),
    ...(fileSubmissions && parseAcceptedTypes(fields["Accepted file types"])
      ? { acceptedTypes: parseAcceptedTypes(fields["Accepted file types"]) }
      : {}),
  };
}

/** Everything the add/edit activity form sends, so the form reopens with what the instructor entered. */
export function activitySettings(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (NON_SETTING_KEYS.has(key) || typeof value !== "string") continue;
    if (Object.keys(out).length >= 120) break;
    out[key.slice(0, 120)] = value.slice(0, 20_000);
  }
  return out;
}

export function activityContentFromForm(type: string, fields: Record<string, string>): LmsActivityContent {
  const kind = type.toUpperCase();
  const content: LmsActivityContent = {
    hidden: /hide/i.test(fields.Availability || ""),
    settings: activitySettings(fields),
  };
  const restrictions = serializeLmsAccessRestrictions(fields[LMS_ACCESS_RESTRICTIONS_KEY]);
  if (restrictions) content.settings[LMS_ACCESS_RESTRICTIONS_KEY] = restrictions;
  else delete content.settings[LMS_ACCESS_RESTRICTIONS_KEY];
  const bodyHtml = (
    fields["Page content"] ||
    fields["Book content"] ||
    fields["Choice question"] ||
    fields["Activity content"] ||
    fields.Body ||
    ""
  ).trim();
  if (kind === "PAGE" && !bodyHtml && !fields.Storyboard) throw badRequest("Page content is required");
  if (bodyHtml) content.body = sanitizeLessonHtml(bodyHtml);
  const description = (fields.Description || "").trim();
  if (description) content.description = description.slice(0, 5000);
  if (kind === "URL") content.url = parseExternalUrl(fields["External URL"]);
  if (kind === "ASSIGNMENT") content.assignment = parseAssignmentSettings(fields);
  return content;
}

export function workspaceSectionId(path: string): string | null {
  return /^\/instructor\/sections\/([0-9a-f-]{36})(?:[/?]|$)/i.exec(path)?.[1] ?? null;
}

/**
 * Workspace assignments are real `Assignment` rows so students submit through the assignment
 * workflow and the work shows up in the gradebook and submissions queue.
 */
export async function saveLmsAssignment(input: {
  institutionId: string;
  sectionId: string;
  assignmentId?: string | null;
  title: string;
  settings: LmsAssignmentSettings;
  hidden: boolean;
}) {
  const data = {
    title: input.title.slice(0, 200),
    maxScore: input.settings.maxScore,
    weightPercent: input.settings.weightPercent,
    dueAt: input.settings.dueAt ? new Date(input.settings.dueAt) : null,
    instructions: input.settings.instructions ?? null,
    availableFrom: input.settings.availableFrom ? new Date(input.settings.availableFrom) : null,
    cutoffAt: input.settings.cutoffAt ? new Date(input.settings.cutoffAt) : null,
    maxFiles: input.settings.maxFiles ?? null,
    maxFileBytes: input.settings.maxFileBytes ?? null,
    acceptedTypes: input.settings.acceptedTypes ?? null,
    fileSubmissions: input.settings.fileSubmissions,
    onlineText: input.settings.onlineText,
    hidden: input.hidden,
  };
  if (input.assignmentId) {
    const updated = await prisma.assignment.updateMany({
      where: { id: input.assignmentId, institutionId: input.institutionId, sectionId: input.sectionId },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (updated.count === 1) return input.assignmentId;
  }
  const created = await prisma.assignment.create({
    data: { id: randomUUID(), institutionId: input.institutionId, sectionId: input.sectionId, ...data },
  });
  return created.id;
}

export async function setLmsAssignmentHidden(institutionId: string, sectionId: string, assignmentId: string, hidden: boolean) {
  await prisma.assignment.updateMany({
    where: { id: assignmentId, institutionId, sectionId },
    data: { hidden, rowVersion: { increment: 1 } },
  });
}

/** Removes the assignment when nothing was submitted or graded; otherwise hides it so the record survives. */
export async function retireLmsAssignment(institutionId: string, sectionId: string, assignmentId: string) {
  const [submissions, graded] = await Promise.all([
    prisma.submission.count({ where: { institutionId, assignmentId } }),
    prisma.gradeItem.count({ where: { institutionId, assignmentId, score: { not: null } } }),
  ]);
  if (submissions || graded) {
    await setLmsAssignmentHidden(institutionId, sectionId, assignmentId, true);
    return "hidden" as const;
  }
  await prisma.gradeItem.deleteMany({ where: { institutionId, assignmentId } });
  await prisma.assignment.deleteMany({ where: { id: assignmentId, institutionId, sectionId } });
  return "deleted" as const;
}

export async function loadLmsOverlay(institutionId: string, path: string) {
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path } },
  });
  return state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
}

/** The workspace `Assignment` row behind an activity, if the activity was created as a graded assignment. */
export async function linkedLmsAssignment(institutionId: string, path: string, activityId: string) {
  const sectionId = workspaceSectionId(path);
  if (!sectionId || !activityId) return null;
  const found = findOverlayActivity(await loadLmsOverlay(institutionId, path), activityId);
  const assignmentId = found?.activity.assignmentId;
  return typeof assignmentId === "string" ? { sectionId, assignmentId } : null;
}

type OverlayActivity = Record<string, unknown>;

export function findOverlayActivity(overlay: Record<string, unknown> | null | undefined, activityId: string) {
  const topics = (overlay?.topicActivities as Record<string, OverlayActivity[]> | undefined) || {};
  for (const [topicId, rows] of Object.entries(topics)) {
    const row = (rows || []).find((r) => String(r.id || "") === activityId);
    if (row) return { topicId, activity: row };
  }
  const edit = (overlay?.activityEdits as Record<string, OverlayActivity> | undefined)?.[activityId];
  return edit ? { topicId: null, activity: edit } : null;
}
