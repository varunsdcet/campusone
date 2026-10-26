/* Course Management: shared helpers, lookups, validation and the configuration record engine. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { CAMPUSES, assertPermission } from "../superAdmin.service.js";
import { audit, refs } from "./service.js";
import { bytesMatchMime, decodeBase64 } from "../../../lib/fileSniff.js";
import type { TermRef } from "../../../lib/sectionTerm.js";
import {
  ANSWER_FIELDS,
  COURSE_FIELDS,
  COURSE_TEXTBOOK_FIELDS,
  ENTITIES,
  PRIMARY_CATEGORY,
  SESSION_FIELDS,
  ALL_PROGRAMS,
  type Data,
  type EntityKey,
  type Field,
} from "./courses.spec.js";
import * as V from "./courses.spec.js";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export const S = {
  courseSettings: "CM:COURSE",
  courseVersion: "CM:COURSE_VERSION",
  session: "CM:SESSION",
  change: "CM:CHANGE",
  repoLog: "CM:REPO_LOG",
  backup: "CM:BACKUP",
  assignment: "CM:EVAL_ASSIGN",
  file: "CM:FILE",
  seed: "CM:SEED",
  badgeExtra: "CM:BADGE",
} as const;
const SETTINGS = "settings";

export function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
export const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(s(v));
  return Number.isFinite(n) ? n : 0;
};
export function parse(json: string | null | undefined): Data {
  try {
    const v = JSON.parse(json ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
  } catch {
    return {};
  }
}
export const today = () => new Date().toISOString().slice(0, 10);
export const view = (user: SessionClaims) => assertPermission(user, "courseManagement", "view");
export const edit = (user: SessionClaims) => assertPermission(user, "courseManagement", "edit");

export type Rec = { id: string; contextKey: string; data: Data; createdAt: Date; updatedAt: Date; createdById: string; updatedById: string };

function toRec(r: { id: string; contextKey: string; dataJson: string; createdAt: Date; updatedAt: Date; createdById: string; updatedById: string }): Rec {
  return { id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt, createdById: r.createdById, updatedById: r.updatedById };
}

export async function list(inst: string, screen: string, contextKey?: string | string[]) {
  const rows = await prisma.heritageRecord.findMany({
    where: {
      institutionId: inst,
      screenId: screen,
      deletedAt: null,
      singletonKey: null,
      ...(contextKey === undefined ? {} : Array.isArray(contextKey) ? { contextKey: { in: contextKey } } : { contextKey }),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRec);
}

export async function find(inst: string, screen: string, id: string, label: string) {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return toRec(r);
}

export async function insert(user: SessionClaims, screen: string, data: Data, contextKey = "") {
  const r = await prisma.heritageRecord.create({
    data: { institutionId: user.institutionId, screenId: screen, contextKey, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
  });
  return toRec(r);
}

export async function update(user: SessionClaims, id: string, data: Data, contextKey?: string) {
  const r = await prisma.heritageRecord.update({
    where: { id },
    data: { dataJson: JSON.stringify(data), updatedById: user.accountId, rowVersion: { increment: 1 }, ...(contextKey !== undefined ? { contextKey } : {}) },
  });
  return toRec(r);
}

export async function softDelete(user: SessionClaims, ids: string[]) {
  if (!ids.length) return;
  await prisma.heritageRecord.updateMany({ where: { id: { in: ids }, institutionId: user.institutionId }, data: { deletedAt: new Date(), updatedById: user.accountId } });
}

/** One settings record per course / session (contextKey = owner id). */
export async function settingsOf(inst: string, screen: string, ownerIds: string[]) {
  if (!ownerIds.length) return new Map<string, Rec>();
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: screen, contextKey: { in: ownerIds }, singletonKey: SETTINGS, deletedAt: null } });
  return new Map(rows.map((r) => [r.contextKey, toRec(r)]));
}

export async function saveSettings(user: SessionClaims, screen: string, ownerId: string, data: Data) {
  const json = JSON.stringify(data);
  await prisma.heritageRecord.upsert({
    where: { institutionId_screenId_contextKey_singletonKey: { institutionId: user.institutionId, screenId: screen, contextKey: ownerId, singletonKey: SETTINGS } },
    create: { institutionId: user.institutionId, screenId: screen, contextKey: ownerId, singletonKey: SETTINGS, dataJson: json, createdById: user.accountId, updatedById: user.accountId },
    update: { dataJson: json, deletedAt: null, updatedById: user.accountId, rowVersion: { increment: 1 } },
  });
}

export async function dropSettings(user: SessionClaims, screen: string, ownerId: string) {
  await prisma.heritageRecord.updateMany({ where: { institutionId: user.institutionId, screenId: screen, contextKey: ownerId, singletonKey: SETTINGS }, data: { deletedAt: new Date() } });
}

/** Instructor course workspace overlay (shared with the instructor portal's section page). */
export const sectionPath = (sectionId: string) => `/instructor/sections/${sectionId}`;
export async function readOverlay(inst: string, sectionId: string): Promise<Data> {
  const row = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId: inst, path: sectionPath(sectionId) } } });
  return row ? parse(row.payloadJson) : {};
}
export async function writeOverlay(inst: string, sectionId: string, payload: Data) {
  const path = sectionPath(sectionId);
  const json = JSON.stringify(payload);
  await prisma.sisScreenState.upsert({ where: { institutionId_path: { institutionId: inst, path } }, create: { institutionId: inst, path, payloadJson: json }, update: { payloadJson: json } });
}

/* ------------------------------------------------------------------ */
/* Lookups (dropdown sources)                                           */
/* ------------------------------------------------------------------ */

export type Opt = { id: string; label: string; tag?: string };
export type Lookups = {
  lists: Record<string, string[]>;
  refs: Record<string, Opt[]>;
  users: Opt[];
  personOf: Map<string, string>;
  accountOfPerson: Map<string, string>;
  classroomSize: Map<string, number>;
  terms: TermRef[];
  label: (ref: string, id: unknown) => string;
  /** A stored campus id, or the id of the campus a legacy row stored by name. */
  campusId: (v: unknown) => string;
};

/** Accounts that can be assigned to teach or support a course session. */
export function isCourseStaffAccount(rolesJson: string) {
  return /instructor|faculty|teacher|admin|registrar|advisor|staff/i.test(rolesJson);
}

export async function staffAccounts(inst: string) {
  const accounts = await prisma.account.findMany({ where: { institutionId: inst, status: "active" }, include: { person: true } });
  return accounts
    .filter((a) => isCourseStaffAccount(a.rolesJson))
    .map((a) => ({ id: a.id, personId: a.personId, name: `${a.person.givenName} ${a.person.familyName}`.trim() || a.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function locationLookups(inst: string) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: ["LOC:CAMPUS", "LOC:CLASSROOM", "LOC:INSTITUTION"] }, deletedAt: null, singletonKey: null },
    orderBy: { createdAt: "asc" },
  });
  const active = (d: Data) => s(d.active || "Active") === "Active";
  const campusRows = rows.filter((r) => r.screenId === "LOC:CAMPUS").map((r) => ({ id: r.id, d: parse(r.dataJson) }));
  const campuses: Opt[] = campusRows.length ? campusRows.filter((c) => active(c.d)).map((c) => ({ id: c.id, label: s(c.d.name) })) : CAMPUSES.map((c) => ({ id: c, label: c }));
  const classroomSize = new Map<string, number>();
  const classrooms: Opt[] = rows
    .filter((r) => r.screenId === "LOC:CLASSROOM")
    .map((r) => ({ r, d: parse(r.dataJson) }))
    .filter(({ d }) => active(d))
    .map(({ r, d }) => {
      classroomSize.set(r.id, num(d.size));
      return { id: r.id, label: `${s(d.name)}${num(d.size) ? ` (${num(d.size)} seats)` : ""}`, tag: r.contextKey };
    });
  const institutions: Opt[] = rows.filter((r) => r.screenId === "LOC:INSTITUTION").map((r) => ({ id: r.id, label: s(parse(r.dataJson).name) }));
  return { campuses, classrooms, classroomSize, institutions };
}

const byLabel = (a: Opt, b: Opt) => a.label.localeCompare(b.label);

export function resolveCampusId(campuses: Opt[], v: unknown) {
  const raw = s(v).trim();
  if (!raw || campuses.some((c) => c.id === raw)) return raw;
  const norm = (x: string) => x.toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  return campuses.find((c) => norm(c.label) === norm(raw))?.id ?? raw;
}

export async function lookups(user: SessionClaims): Promise<Lookups> {
  const inst = user.institutionId;
  await ensureSeed(user);
  const [staff, loc, cm, courses, terms, sections, resCats, shared] = await Promise.all([
    staffAccounts(inst),
    locationLookups(inst),
    prisma.heritageRecord.findMany({
      where: { institutionId: inst, screenId: { in: ["CM:CATEGORY", "CM:GROUP", "CM:TYPE", "CM:GRADING", "CM:TEXTBOOK", "CM:COMPETENCY", "CM:QUESTION", "CM:EVALUATION"] }, deletedAt: null, singletonKey: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" }, select: { id: true, code: true, name: true, startsOn: true, endsOn: true } }),
    prisma.section.findMany({ where: { institutionId: inst }, include: { course: { select: { code: true } }, term: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }], take: 2000 }),
    prisma.courseResourceCategory.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } }),
    refs(user),
  ]);
  const of = (screen: string) => cm.filter((r) => r.screenId === screen).map((r) => ({ id: r.id, d: parse(r.dataJson) }));
  const named = (screen: string, onlyActive = false) =>
    of(screen)
      .filter((x) => !onlyActive || (x.d.active !== "Inactive" && x.d.status !== "Inactive"))
      .map((x) => ({ id: x.id, label: s(x.d.name) }))
      .sort(byLabel);
  const categories = of("CM:CATEGORY").map((x) => ({ id: x.id, label: s(x.d.name), tag: s(x.d.parent) }));
  const r: Record<string, Opt[]> = {
    courseCategories: categories.sort(byLabel),
    categoryParents: [{ id: PRIMARY_CATEGORY, label: "Primary Category" }, ...categories],
    courseGroups: named("CM:GROUP"),
    courseTypes: named("CM:TYPE", true),
    gradingSchemes: named("CM:GRADING", true),
    textbooks: of("CM:TEXTBOOK").map((x) => ({ id: x.id, label: `${s(x.d.name)}${s(x.d.isbn) ? ` (ISBN ${s(x.d.isbn)})` : ""}` })).sort(byLabel),
    competencies: named("CM:COMPETENCY", true),
    questions: of("CM:QUESTION").map((x) => ({ id: x.id, label: s(x.d.question), tag: s(x.d.type) })),
    evaluations: of("CM:EVALUATION").map((x) => ({ id: x.id, label: s(x.d.title) })).sort(byLabel),
    courses: courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` })),
    terms: terms.map((t) => ({ id: t.id, label: t.name })),
    sections: sections.map((x) => ({ id: x.id, label: `${x.course.code} ${x.code} · ${x.term.name}`, tag: x.courseId })),
    campuses: loc.campuses,
    classrooms: loc.classrooms,
    institutions: loc.institutions.sort(byLabel),
    resourceCategories: resCats.map((c) => ({ id: c.id, label: c.name })),
  };
  const users = staff.map((a) => ({ id: a.id, label: a.name }));
  const maps = new Map(Object.entries(r).map(([k, opts]) => [k, new Map(opts.map((o) => [o.id, o.label]))]));
  return {
    lists: { faculties: shared.faculties ?? [], programs: shared.programs ?? [] },
    refs: r,
    users,
    personOf: new Map(staff.map((a) => [a.id, a.personId])),
    accountOfPerson: new Map(staff.map((a) => [a.personId, a.id])),
    classroomSize: loc.classroomSize,
    terms,
    label: (ref, id) => (ref === "users" ? (users.find((u) => u.id === id)?.label ?? "") : (maps.get(ref)?.get(s(id)) ?? "")),
    campusId: (v) => resolveCampusId(loc.campuses, v),
  };
}

export async function courseMeta(user: SessionClaims) {
  await view(user);
  const lk = await lookups(user);
  return {
    entities: Object.fromEntries(Object.entries(ENTITIES).map(([k, d]) => [k, { label: d.label, fields: d.fields, save: d.save, parent: d.parent ?? null }])),
    forms: { course: COURSE_FIELDS, session: SESSION_FIELDS, courseTextbook: COURSE_TEXTBOOK_FIELDS, answer: ANSWER_FIELDS },
    lists: lk.lists,
    refs: lk.refs,
    users: lk.users,
    options: {
      weekdays: V.WEEKDAYS,
      sessionStatuses: V.SESSION_STATUSES,
      changeStatuses: V.CHANGE_STATUSES,
      changeTypes: V.CHANGE_TYPES,
      repositoryFilters: V.REPOSITORY_FILTERS,
      backupStatuses: V.BACKUP_STATUSES,
      bulkUpdates: V.BULK_UPDATES,
      learningStyles: V.LEARNING_STYLES,
      gradesVisibility: V.GRADES_VISIBILITY,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2024-13-45, 2023-02-29). */
export function isIsoDate(v: string) {
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function applies(f: Field, d: Data) {
  if (!f.when) return true;
  const v = d[f.when.key];
  const hit = Array.isArray(f.when.equals) ? f.when.equals.includes(v as string) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

export function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (["multi", "multiList", "people", "rows", "dual"].includes(f.kind)) return [];
  if (f.kind === "file") return null;
  if (f.kind === "number") return null;
  return "";
}

export function defaults(fields: Field[]): Data {
  return Object.fromEntries(fields.map((f) => [f.key, f.dflt !== undefined ? f.dflt : emptyOf(f)]));
}

export function sanitizeHtml(html: string) {
  const blocked = "script|style|iframe|object|embed|link|meta|template|form|input|button|textarea|select|svg|math";
  return html
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${blocked})\\b[^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("|')\s*data:(?!image\/(png|jpe?g|gif|webp))[^"']*\2/gi, '$1="#"');
}

/** Validates `input` against the field list; unknown keys are dropped. Throws 400 with every problem found. */
export async function clean(user: SessionClaims, fields: Field[], input: Data, lk: Lookups, base: Data = {}, prefix = ""): Promise<Data> {
  const out: Data = { ...defaults(fields), ...base };
  for (const f of fields) if (f.key in input) out[f.key] = input[f.key];
  const errors: string[] = [];
  const err = (f: Field, msg: string) => errors.push(`${prefix}${f.label} ${msg}`);
  for (const f of fields) {
    if (!applies(f, out)) {
      out[f.key] = f.dflt !== undefined ? f.dflt : emptyOf(f);
      continue;
    }
    const raw = out[f.key];
    switch (f.kind) {
      case "bool":
        out[f.key] = raw === true || raw === "true" || raw === "Yes";
        break;
      case "number": {
        const t = s(raw);
        if (!t) {
          out[f.key] = null;
          if (f.required) err(f, "is required");
          break;
        }
        const n = Number(t);
        if (!Number.isFinite(n)) err(f, "must be a number");
        else if (f.integer && !Number.isInteger(n)) err(f, "must be a whole number");
        else if (f.min !== undefined && n < f.min) err(f, `must be at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) err(f, `must be at most ${f.max}`);
        out[f.key] = n;
        break;
      }
      case "multi":
      case "multiList":
      case "dual":
      case "people": {
        const vals = [...new Set(arr(raw).map(s).filter(Boolean))];
        const allowed =
          f.kind === "people" ? lk.users.map((u) => u.id) : f.ref ? (lk.refs[f.ref] ?? []).map((o) => o.id) : f.options ? [...f.options] : f.dyn ? (lk.lists[f.dyn] ?? []) : null;
        const bad = allowed ? vals.filter((v) => !allowed.includes(v)) : [];
        if (bad.length) err(f, f.kind === "people" ? "contains a user who is no longer active" : "contains a choice that is no longer available");
        if (f.required && !vals.length) err(f, "needs at least one selection");
        out[f.key] = vals.slice(0, 500);
        break;
      }
      case "file": {
        if (!raw) {
          out[f.key] = null;
          if (f.required) err(f, "is required");
          break;
        }
        const ref = raw as Data;
        const stored = s(ref.id) ? await fileRef(user.institutionId, s(ref.id)) : null;
        if (!stored) err(f, "upload was not found — upload the file again");
        else if (!acceptsMime(f.accept, stored.mime)) err(f, acceptMessage(f.accept));
        out[f.key] = stored ?? { id: s(ref.id), name: s(ref.name).slice(0, 200), mime: s(ref.mime), size: num(ref.size) };
        break;
      }
      case "rows": {
        const rows = arr(raw).slice(0, 200);
        const cleaned: Data[] = [];
        for (const [i, row] of rows.entries()) {
          const r = (row && typeof row === "object" ? row : {}) as Data;
          const c = await clean(user, f.rowFields ?? [], r, lk, {}, `${f.rowLabel ?? "Row"} ${i + 1}: `).catch((e: Error) => {
            errors.push(e.message);
            return null;
          });
          if (c) cleaned.push({ id: s(r.id) || `r${Date.now().toString(36)}${i}`, ...c });
        }
        if (f.required && !cleaned.length) err(f, "needs at least one row");
        out[f.key] = cleaned;
        break;
      }
      default: {
        let v = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
        if (f.kind === "html") v = sanitizeHtml(v);
        const max = f.kind === "html" ? 100_000 : f.kind === "textarea" ? 20_000 : 500;
        if (v.length > max) err(f, `must be at most ${max} characters`);
        if (!v) {
          if (f.required) err(f, "is required");
          out[f.key] = "";
          break;
        }
        if (f.kind === "date" && !isIsoDate(v)) err(f, "must be a valid date (YYYY-MM-DD)");
        else if (f.kind === "time" && !TIME_RE.test(v)) err(f, "must be a time such as 09:30");
        else if (f.kind === "select") {
          const allowed = [...(f.dynExtra ?? []), ...(f.options ?? (f.dyn ? (lk.lists[f.dyn] ?? []) : []))];
          if (allowed.length && !allowed.includes(v)) err(f, `: "${v}" is not a valid choice`);
        } else if (f.kind === "ref" && !(lk.refs[f.ref ?? ""] ?? []).some((o) => o.id === v)) err(f, "is no longer available — choose another");
        out[f.key] = v;
      }
    }
  }
  if (errors.length) throw httpError(400, errors.join("; "));
  return out;
}

/** Field labels whose values differ between two snapshots. */
export function changedLabels(fields: Field[], before: Data, after: Data) {
  return fields.filter((f) => JSON.stringify(before[f.key] ?? emptyOf(f)) !== JSON.stringify(after[f.key] ?? emptyOf(f))).map((f) => f.label);
}

/* ------------------------------------------------------------------ */
/* Files (course syllabus, badge image)                                 */
/* ------------------------------------------------------------------ */

const FILE_MAX = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/;
const EXT_MIME: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".txt": ["text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg", "image/jpg"],
  ".jpeg": ["image/jpeg", "image/jpg"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
};

/** Whether a stored file's MIME type satisfies a field's `accept` list (HTML input syntax); no list means any supported type. */
function acceptsMime(accept: string | undefined, mime: string) {
  const m = mime.toLowerCase();
  if (!FILE_TYPES.test(m)) return false;
  const tokens = (accept ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.some((t) => (t.endsWith("/*") ? m.startsWith(t.slice(0, -1)) : t.startsWith(".") ? (EXT_MIME[t] ?? []).includes(m) : t === m));
}

function acceptMessage(accept: string | undefined) {
  if (accept === "image/*") return "must be an image (PNG, JPEG, GIF or WebP)";
  const kinds = (accept ?? "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => (t === "image/*" ? "image" : t.replace(/^\./, "").toUpperCase()));
  return kinds.length ? `must be one of these file types: ${kinds.join(", ")}` : "is not a supported file type";
}

export async function uploadFile(user: SessionClaims, body: { name: string; mime: string; base64: string; accept?: string }) {
  await edit(user);
  const name = s(body.name).replace(/[\\/]/g, "_").slice(0, 200);
  const mime = s(body.mime).toLowerCase();
  if (!name) throw httpError(400, "File name is required");
  if (!FILE_TYPES.test(mime)) throw httpError(400, "Unsupported file type. Upload a PDF, Word document, text file or image.");
  if (body.accept && !acceptsMime(body.accept, mime)) throw httpError(400, `This file ${acceptMessage(body.accept)}`);
  const b64 = s(body.base64).replace(/^data:[^,]*,/, "");
  const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (!size) throw httpError(400, "The file is empty");
  if (size > FILE_MAX) throw httpError(400, "Files must be 8 MB or smaller");
  if (!bytesMatchMime(decodeBase64(b64), mime)) throw httpError(400, "The file's contents do not match its type. Upload a genuine PDF, Word document, text file or image.");
  const rec = await insert(user, S.file, { name, mime, size, base64: b64 });
  return { id: rec.id, name, mime, size };
}

export async function downloadFile(user: SessionClaims, id: string) {
  await view(user);
  const rec = await find(user.institutionId, S.file, id, "File");
  return { name: s(rec.data.name), mime: s(rec.data.mime), base64: s(rec.data.base64) };
}

export async function fileRef(inst: string, id: string) {
  if (!id) return null;
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: S.file, deletedAt: null }, select: { id: true, dataJson: true } });
  if (!r) return null;
  const d = parse(r.dataJson);
  return { id: r.id, name: s(d.name), mime: s(d.mime), size: num(d.size) };
}

/* ------------------------------------------------------------------ */
/* Configuration records (generic engine with table adapters)           */
/* ------------------------------------------------------------------ */

type Item = Data & { id: string; createdAt: string; updatedAt: string };

/** Converts the legacy literal `None` into the empty value used by reference dropdowns. */
export function normalizeQuestionReferences<T extends Data>(item: T): T {
  if (!Array.isArray(item.answers)) return item;
  return {
    ...item,
    answers: item.answers.map((answer) => {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return answer;
      const row = answer as Data;
      return s(row.referencing).toLowerCase() === "none" ? { ...row, referencing: "" } : row;
    }),
  };
}

function entityOf(key: string): EntityKey {
  if (!Object.hasOwn(ENTITIES, key)) throw httpError(404, "Unknown Course Management list", "NOT_FOUND");
  return key as EntityKey;
}

async function parentCourse(inst: string, entity: EntityKey, parentId: string | undefined) {
  if (ENTITIES[entity].parent !== "course") return "";
  if (!parentId) throw httpError(400, "Course is required");
  const c = await prisma.course.findFirst({ where: { id: parentId, institutionId: inst }, select: { id: true } });
  if (!c) throw httpError(404, "Course not found", "NOT_FOUND");
  return c.id;
}

const recItem = (r: Rec): Item => ({ ...r.data, id: r.id, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), _createdBy: r.createdById, _updatedBy: r.updatedById });

async function tableItems(user: SessionClaims, entity: EntityKey, parentId: string): Promise<Item[]> {
  const inst = user.institutionId;
  const t = ENTITIES[entity].table;
  if (t === "resourceCategory") {
    const rows = await prisma.courseResourceCategory.findMany({ where: { institutionId: inst }, include: { _count: { select: { resources: true } } }, orderBy: { name: "asc" } });
    return rows.map((c) => ({ id: c.id, name: c.name, _resources: c._count.resources, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }));
  }
  if (t === "resource") {
    const rows = await prisma.courseResource.findMany({ where: { institutionId: inst }, include: { course: true, category: true }, orderBy: { name: "asc" } });
    return rows.map((x) => ({
      id: x.id,
      name: x.name,
      course: x.courseId ?? "",
      category: x.categoryId ?? "",
      allowQuantities: x.allowQuantities ? "Yes" : "No",
      _course: x.course ? `${x.course.code} — ${x.course.title}` : "",
      _category: x.category?.name ?? "",
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    }));
  }
  if (t === "badge") {
    const rows = await prisma.badgeDefinition.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } });
    const extras = await settingsOf(inst, S.badgeExtra, rows.map((b) => b.id));
    return Promise.all(
      rows.map(async (b) => {
        const programs = b.programsRule === ALL_PROGRAMS ? [] : b.programsRule.split(" | ").filter(Boolean);
        return {
          id: b.id,
          name: b.name,
          description: b.description,
          badgeText: s(extras.get(b.id)?.data.badgeText) || b.badgeText,
          image: b.imageUrl?.startsWith("cmfile:") ? await fileRef(inst, b.imageUrl.slice(7)) : null,
          approval: b.approvalMode,
          badgeType: b.badgeType,
          programsMode: programs.length ? "Select Programs" : ALL_PROGRAMS,
          programs,
          coursesCompleted: b.coursesRule,
          termsCompleted: b.termsRule,
          averageType: b.averageType,
          _status: b.status,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        };
      }),
    );
  }
  if (t === "transfer") {
    const [rows, loc] = await Promise.all([list(inst, ENTITIES.transferCourses.screen), locationLookups(inst)]);
    const instName = new Map(loc.institutions.map((o) => [o.id, o.label]));
    return rows
      .filter((r) => s(r.data.equivalentCourse) === parentId)
      .map((r) => ({ ...recItem(r), institution: r.contextKey, _institution: instName.get(r.contextKey) ?? "Institution no longer available" }));
  }
  return [];
}

async function decorate(user: SessionClaims, entity: EntityKey, items: Item[], lk: Lookups): Promise<Item[]> {
  const inst = user.institutionId;
  const who = (id: unknown) => lk.label("users", id) || "System";
  if (entity === "categories") {
    const settings = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: S.courseSettings, deletedAt: null }, select: { dataJson: true } });
    const used = new Map<string, number>();
    for (const r of settings) {
      const c = s(parse(r.dataJson).category);
      used.set(c, (used.get(c) ?? 0) + 1);
    }
    return items.map((i) => ({ ...i, _parent: s(i.parent) === PRIMARY_CATEGORY ? "Primary Category" : lk.label("courseCategories", i.parent), _courses: used.get(i.id) ?? 0 }));
  }
  if (entity === "linkedCourses" || entity === "repository") return items.map((i) => ({ ...i, _course: lk.label("courses", i.course) || "Course no longer in catalogue" }));
  if (entity === "textbooks") return items.map((i) => ({ ...i, _courses: arr(i.courses).map((c) => lk.label("courses", (c as Data).course)).filter(Boolean) }));
  if (entity === "tests") return items.map((i) => ({ ...i, _scheme: lk.label("gradingSchemes", i.gradingScheme), _instructors: arr(i.instructors).map((id) => lk.label("users", id)).filter(Boolean) }));
  if (entity === "evaluations") return items.map((i) => ({ ...i, _createdBy: who(i._createdBy), _updatedBy: who(i._updatedBy) }));
  if (entity === "questions") return items.map((i) => normalizeQuestionReferences({ ...i, _createdBy: who(i._createdBy), _updatedBy: who(i._updatedBy) }));
  return items;
}

export async function listEntity(user: SessionClaims, key: string, opts: { parentId?: string; q?: string }) {
  await view(user);
  const entity = entityOf(key);
  const def = ENTITIES[entity];
  const lk = await lookups(user);
  const parentId = def.parent ? await parentCourse(user.institutionId, entity, opts.parentId) : "";
  const raw = def.table ? await tableItems(user, entity, parentId) : (await list(user.institutionId, def.screen, def.parent ? parentId : undefined)).map(recItem);
  let items = await decorate(user, entity, raw, lk);
  const q = s(opts.q).toLowerCase();
  if (q) items = items.filter((i) => def.search.some((k) => s(i[k]).toLowerCase().includes(q)));
  if (!def.parent && entity !== "questions" && entity !== "evaluations") items.sort((a, b) => s(a.name || a.title).localeCompare(s(b.name || b.title)));
  return { items, total: items.length };
}

export async function getEntity(user: SessionClaims, key: string, id: string) {
  await view(user);
  const entity = entityOf(key);
  const def = ENTITIES[entity];
  if (def.table) {
    const parentId = def.table === "transfer" ? s((await find(user.institutionId, def.screen, id, def.label)).data.equivalentCourse) : "";
    const item = (await tableItems(user, entity, parentId)).find((i) => i.id === id);
    if (!item) throw httpError(404, `${def.label} not found`, "NOT_FOUND");
    return item;
  }
  const rec = await find(user.institutionId, def.screen, id, def.label);
  return (await decorate(user, entity, [recItem(rec)], await lookups(user)))[0];
}

async function assertUnique(user: SessionClaims, entity: EntityKey, data: Data, selfId: string | null, parentId: string) {
  const def = ENTITIES[entity];
  if (!def.unique.length) return;
  const existing = def.table ? await tableItems(user, entity, parentId) : (await list(user.institutionId, def.screen, def.parent ? parentId : undefined)).map(recItem);
  for (const u of def.unique) {
    const v = s(data[u.key]).toLowerCase();
    if (!v) continue;
    if (existing.some((r) => r.id !== selfId && s(r[u.key]).toLowerCase() === v)) throw httpError(409, `${u.label} "${s(data[u.key])}" is already in use`, "DUPLICATE");
  }
}

async function validateEntity(user: SessionClaims, entity: EntityKey, data: Data, selfId: string | null, parentId: string, body: Data) {
  const inst = user.institutionId;
  if (entity === "categories" && selfId && s(data.parent) !== PRIMARY_CATEGORY) {
    const cats = await list(inst, ENTITIES.categories.screen);
    let cur: string | undefined = s(data.parent);
    for (let guard = 0; cur && cur !== PRIMARY_CATEGORY && guard < 50; guard++) {
      if (cur === selfId) throw httpError(400, "A category cannot be placed under itself or one of its sub-categories");
      cur = s(cats.find((c) => c.id === cur)?.data.parent);
    }
  }
  if (entity === "gradingSchemes") {
    const letters = arr(data.grades).map((g) => s((g as Data).letter).toLowerCase());
    if (new Set(letters).size !== letters.length) throw httpError(400, "Each grade letter can be used once per grading scheme");
  }
  if (entity === "linkedCourses" && s(data.course) === parentId) throw httpError(400, "A course cannot be linked to itself");
  if (entity === "repository" && data.isDefault === "Yes") {
    const others = (await list(inst, ENTITIES.repository.screen)).filter((r) => r.id !== selfId && s(r.data.course) === s(data.course) && r.data.isDefault === "Yes");
    const scope = (d: Data) => (d.campusesMode === V.ALL_CAMPUSES ? null : arr(d.campuses).map(s));
    const mine = scope(data);
    const clash = others.find((o) => {
      const theirs = scope(o.data);
      return !mine || !theirs || mine.some((c) => theirs.includes(c));
    });
    if (clash)
      throw httpError(409, `"${s(clash.data.name) || "Another content course"}" is already the default repository for this course on an overlapping campus. Set one of them to Default: No or customise the campuses.`, "DUPLICATE");
  }
  if (entity === "evaluations") {
    const questions = new Set((await list(inst, ENTITIES.questions.screen)).map((q) => q.id));
    const items = arr(body.items)
      .slice(0, 300)
      .map((raw) => {
        const it = (raw && typeof raw === "object" ? raw : {}) as Data;
        if (it.kind === "section") {
          const title = s(it.title).slice(0, 300);
          if (!title) throw httpError(400, "Every evaluation section needs a title");
          return { kind: "section", id: s(it.id) || `sec-${Math.random().toString(36).slice(2, 9)}`, title };
        }
        const questionId = s(it.questionId);
        if (!questions.has(questionId)) throw httpError(400, "One of the evaluation questions is no longer in the Question Bank");
        return { kind: "question", id: s(it.id) || `q-${Math.random().toString(36).slice(2, 9)}`, questionId };
      });
    data.items = items;
  }
}

async function afterSave(user: SessionClaims, entity: EntityKey, id: string, data: Data) {
  if (entity === "gradingSchemes" && data.isDefault === true) {
    for (const r of await list(user.institutionId, ENTITIES.gradingSchemes.screen)) {
      if (r.id !== id && r.data.isDefault === true) await update(user, r.id, { ...r.data, isDefault: false });
    }
  }
}

async function writeTable(user: SessionClaims, entity: EntityKey, id: string | null, data: Data, parentId: string) {
  const inst = user.institutionId;
  const t = ENTITIES[entity].table;
  if (t === "resourceCategory") {
    const row = id
      ? await prisma.courseResourceCategory.update({ where: { id }, data: { name: s(data.name), rowVersion: { increment: 1 } } })
      : await prisma.courseResourceCategory.create({ data: { institutionId: inst, name: s(data.name), language: "English" } });
    return row.id;
  }
  if (t === "resource") {
    const values = { name: s(data.name), courseId: s(data.course) || null, categoryId: s(data.category) || null, allowQuantities: data.allowQuantities === "Yes" };
    const row = id
      ? await prisma.courseResource.update({ where: { id }, data: { ...values, rowVersion: { increment: 1 } } })
      : await prisma.courseResource.create({ data: { institutionId: inst, language: "English", ...values } });
    return row.id;
  }
  if (t === "badge") {
    const image = data.image as Data | null;
    const values = {
      name: s(data.name),
      description: s(data.description),
      badgeText: s(data.badgeText).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000),
      imageUrl: image ? `cmfile:${s(image.id)}` : null,
      approvalMode: s(data.approval),
      badgeType: s(data.badgeType),
      programsRule: data.programsMode === ALL_PROGRAMS ? ALL_PROGRAMS : arr(data.programs).map(s).join(" | "),
      coursesRule: s(data.coursesCompleted),
      termsRule: s(data.termsCompleted),
      averageType: s(data.averageType),
    };
    const row = id ? await prisma.badgeDefinition.update({ where: { id }, data: { ...values, rowVersion: { increment: 1 } } }) : await prisma.badgeDefinition.create({ data: { institutionId: inst, ...values } });
    await saveSettings(user, S.badgeExtra, row.id, { badgeText: s(data.badgeText) });
    return row.id;
  }
  if (t === "transfer") {
    const screen = ENTITIES.transferCourses.screen;
    const others = (await list(inst, screen, s(data.institution))).filter((r) => r.id !== id);
    if (others.some((r) => s(r.data.number).toLowerCase() === s(data.number).toLowerCase()))
      throw httpError(409, `Transfer Course Number "${s(data.number)}" already exists for this institution`, "DUPLICATE");
    const core = { name: s(data.name), number: s(data.number), credits: data.credits ?? null, equivalentCourse: parentId };
    if (id) {
      const rec = await find(inst, screen, id, "Transfer course");
      await update(user, id, { ...rec.data, ...core }, s(data.institution));
      return id;
    }
    const rec = await insert(user, screen, { lengthValue: null, lengthUnit: "days", outline: null, countCredits: "Normal", countGradePoints: "No", ...core }, s(data.institution));
    return rec.id;
  }
  throw httpError(500, "Unknown table");
}

export async function saveEntity(user: SessionClaims, key: string, id: string | null, body: Data & { parentId?: string }) {
  await edit(user);
  const entity = entityOf(key);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const lk = await lookups(user);
  let before: Data | null = null;
  let parentId = "";
  if (id) {
    before = await getEntity(user, entity, id);
    parentId = def.table === "transfer" ? s(before.equivalentCourse) : def.parent ? (await find(inst, def.screen, id, def.label)).contextKey : "";
  } else parentId = await parentCourse(inst, entity, s(body.parentId) || undefined);
  const base: Data = {};
  if (before)
    for (const [k, v] of Object.entries(before))
      if (!k.startsWith("_") && !["id", "createdAt", "updatedAt"].includes(k) && (!def.table || def.fields.some((f) => f.key === k))) base[k] = v;
  const fields = id ? def.fields.filter((f) => !f.createOnly) : def.fields;
  const data = await clean(user, fields, body, lk, base);
  await assertUnique(user, entity, data, id, parentId);
  await validateEntity(user, entity, data, id, parentId, body);
  if (entity === "repository" && !id) {
    const n = num(data.sections) || 1;
    const label = data.format === "Weekly" ? "Week" : "Topic";
    data.topics = Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, title: `${label} ${i + 1}`, summary: "", activities: [] }));
  }
  let savedId: string;
  if (def.table) savedId = await writeTable(user, entity, id, data, parentId);
  else if (id) savedId = (await update(user, id, data)).id;
  else savedId = (await insert(user, def.screen, data, parentId)).id;
  await afterSave(user, entity, savedId, data);
  await audit(user, def.audit, parentId, id ? `Updated ${def.label.toLowerCase()}` : `Created ${def.label.toLowerCase()}`, { recordId: savedId, before, after: data });
  const title = s(data.name || data.title || data.question).slice(0, 80) || def.label;
  return { id: savedId, message: `${def.label.charAt(0).toUpperCase()}${def.label.slice(1)} "${title}" ${id ? "updated" : "created"}` };
}

async function usage(user: SessionClaims, entity: EntityKey, id: string): Promise<string | null> {
  const inst = user.institutionId;
  const courseSettings = async () => (await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: S.courseSettings, deletedAt: null }, select: { dataJson: true } })).map((r) => parse(r.dataJson));
  const sessionSettings = async () => (await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: S.session, deletedAt: null }, select: { dataJson: true } })).map((r) => parse(r.dataJson));
  if (entity === "categories") {
    if ((await courseSettings()).some((d) => d.category === id)) return "Courses are still assigned to this category. Move them to another category first, or set the category to Inactive.";
    if ((await list(inst, ENTITIES.categories.screen)).some((c) => c.data.parent === id)) return "This category has sub-categories. Move or delete them first.";
  }
  if (entity === "groups" && (await courseSettings()).some((d) => d.group === id)) return "Courses are still assigned to this course group. Change their Course Group first.";
  if (entity === "types") {
    if ((await sessionSettings()).some((d) => d.sessionType === id)) return "Sessions / offerings use this course type. Set it to Inactive instead.";
    if ((await list(inst, ENTITIES.repository.screen)).some((r) => arr(r.data.types).includes(id))) return "A content repository is limited to this course type. Update the repository first.";
  }
  if (entity === "gradingSchemes") {
    if ((await courseSettings()).some((d) => d.gradingScheme === id) || (await sessionSettings()).some((d) => d.gradingScheme === id)) return "Courses or sessions use this grading scheme. Set it to Inactive instead.";
    if ((await list(inst, ENTITIES.tests.screen)).some((t) => t.data.gradingScheme === id)) return "An entry / progress test uses this grading scheme. Set it to Inactive instead.";
  }
  if (entity === "textbooks") {
    const rec = await find(inst, ENTITIES.textbooks.screen, id, "Textbook");
    if (arr(rec.data.courses).length) return "This textbook is still associated with courses. Remove the course associations first.";
  }
  if (entity === "evaluations" && (await list(inst, S.assignment)).some((a) => a.data.evaluationId === id)) return "This evaluation has been assigned to course sessions. Unassign it first, or set it to Inactive.";
  if (entity === "questions" && (await list(inst, ENTITIES.evaluations.screen)).some((e) => arr(e.data.items).some((it) => (it as Data).questionId === id)))
    return "This question is used by an evaluation. Remove it from the evaluation first.";
  if (entity === "resourceCategories" && (await prisma.courseResource.count({ where: { institutionId: inst, categoryId: id } }))) return "Resources still belong to this category. Move or delete them first.";
  return null;
}

export async function deleteEntity(user: SessionClaims, key: string, id: string) {
  await edit(user);
  const entity = entityOf(key);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const before = await getEntity(user, entity, id);
  const blocked = await usage(user, entity, id);
  if (blocked) throw httpError(409, blocked, "IN_USE");
  if (def.table === "resourceCategory") await prisma.courseResourceCategory.delete({ where: { id } });
  else if (def.table === "resource") await prisma.courseResource.delete({ where: { id } });
  else if (def.table === "badge") {
    await prisma.badgeDefinition.delete({ where: { id } });
    await dropSettings(user, S.badgeExtra, id);
  } else {
    const rec = await find(inst, def.screen, id, def.label);
    await softDelete(user, [rec.id]);
    if (entity === "repository") await softDelete(user, (await list(inst, S.repoLog, id)).map((r) => r.id));
  }
  await audit(user, def.audit, def.parent ? s(before.equivalentCourse) || "" : "", `Deleted ${def.label.toLowerCase()}`, { recordId: id, before });
  return { message: `${def.label.charAt(0).toUpperCase()}${def.label.slice(1)} "${s(before.name || before.title || before.question || before._course).slice(0, 80)}" deleted` };
}

/* ------------------------------------------------------------------ */
/* First-run seed                                                       */
/* ------------------------------------------------------------------ */

const seeding = new Map<string, Promise<void>>();

export async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  if ((await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: S.seed } })) > 0) return;
  if (!seeding.has(inst)) {
    seeding.set(
      inst,
      seed(user).finally(() => seeding.delete(inst)),
    );
  }
  await seeding.get(inst);
}

const CATEGORY_SEED: Array<[string, string, string[]]> = [
  ["Accounting & Payroll", "ACCT", ["ACC", "DAP", "CAPA"]],
  ["Business & Management", "BUS", ["BMGT", "BETH", "ECON", "EMPL"]],
  ["Community & Social Services", "CSS", ["ACSW", "SOCI", "PSYC", "ECEA", "SFCS"]],
  ["Computing & Technology", "TECH", ["COMP", "CS", "DATA"]],
  ["Marketing & Communications", "MKTG", ["MARK", "COMC"]],
  ["Health Sciences", "HLTH", ["NURS", "PHRM"]],
  ["General Studies", "GEN", ["ENG", "MATH", "STAT"]],
];

const LIKERT = ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"];
const QUESTION_SEED: Array<[string, "Multiple Choice" | "Text Comments"]> = [
  ["Comments (Overall Experience).", "Text Comments"],
  ["Exams related to the course learning outcomes.", "Multiple Choice"],
  ["Information about the assessment was communicated clearly.", "Multiple Choice"],
  ["Instructor gave guidance on where to find resources.", "Multiple Choice"],
  ["Overall, how do you rate your experience in this course?", "Multiple Choice"],
  ["Projects/assignments related to the course learning outcomes.", "Multiple Choice"],
  ["The course was delivered as outlined in the syllabus.", "Multiple Choice"],
  ["The instructor demonstrated in-depth knowledge of the subject.", "Multiple Choice"],
  ["The instructor encouraged discussions and responded to questions.", "Multiple Choice"],
  ["The instructor explained the grading criteria of the course.", "Multiple Choice"],
  ["The instructor managed classroom time and pace well.", "Multiple Choice"],
  ["The instructor provided feedback that showed how to improve my work, such as corrections and comments.", "Multiple Choice"],
  ["The instructor provided feedback within the stated timeframe.", "Multiple Choice"],
  ["The instructor stimulated my interest in the subject.", "Multiple Choice"],
  ["The instructor used a variety of instructional methods to reach the course objectives.", "Multiple Choice"],
  ["The instructor was accessible outside of class.", "Multiple Choice"],
  ["The instructor was organized and prepared for every class.", "Multiple Choice"],
  ["The syllabus was explained at the beginning of the course.", "Multiple Choice"],
  ["What changes would you recommend to improve this course?", "Text Comments"],
];

async function seed(user: SessionClaims) {
  const inst = user.institutionId;
  const put = (screen: string, data: Data, ctx = "") => insert(user, screen, data, ctx);
  const grade = (letter: string, percent: number, gradePoint: number, credit: "Yes" | "No", condition: string) => ({ id: `g-${letter}`, letter, percent, gradePoint, credit, condition });

  const existingSchemes = await list(inst, ENTITIES.gradingSchemes.screen);
  let standardId = existingSchemes[0]?.id ?? "";
  if (!existingSchemes.length) {
    const std = await put(ENTITIES.gradingSchemes.screen, {
      name: "Standard Letter Grades",
      isDefault: true,
      useLetters: "Yes",
      usePercentages: "Yes",
      roundUp: false,
      useGradePoints: "Yes",
      active: "Active",
      grades: [
        grade("A+", 95, 4.33, "Yes", "Pass"),
        grade("A", 90, 4, "Yes", "Pass"),
        grade("A-", 85, 3.67, "Yes", "Pass"),
        grade("B+", 80, 3.33, "Yes", "Pass"),
        grade("B", 75, 3, "Yes", "Pass"),
        grade("B-", 70, 2.67, "Yes", "Pass"),
        grade("C+", 65, 2.33, "Yes", "Pass"),
        grade("C", 60, 2, "Yes", "Pass"),
        grade("D", 50, 1, "Yes", "Pass"),
        grade("F", 0, 0, "No", "Fail"),
      ],
    });
    standardId = std.id;
    await put(ENTITIES.gradingSchemes.screen, {
      name: "Pass / Fail",
      isDefault: false,
      useLetters: "Yes",
      usePercentages: "No",
      roundUp: false,
      useGradePoints: "No",
      active: "Active",
      grades: [grade("P", 50, 0, "Yes", "Pass"), grade("F", 0, 0, "No", "Fail")],
    });
  }

  if (!(await list(inst, ENTITIES.types.screen)).length) {
    for (const [name, abbreviation, learningStyle] of [
      ["Face to Face", "F2F", "Face to Face"],
      ["Online", "ONL", "Online"],
      ["Blended", "BLD", "Blended / Hybrid"],
    ])
      await put(ENTITIES.types.screen, { name, abbreviation, active: "Active", learningStyle, asynchronous: "No", customizePermissions: false });
  }

  if (!(await list(inst, ENTITIES.categories.screen)).length) {
    const ids = new Map<string, string>();
    for (const [name, abbreviation] of CATEGORY_SEED) {
      const rec = await put(ENTITIES.categories.screen, { parent: PRIMARY_CATEGORY, faculty: V.UNASSIGNED, name, abbreviation, active: "Active", academicChair: [], courseLead: [] });
      ids.set(name, rec.id);
    }
    const courses = await prisma.course.findMany({ where: { institutionId: inst } });
    const existing = await settingsOf(inst, S.courseSettings, courses.map((c) => c.id));
    for (const c of courses) {
      if (existing.has(c.id)) continue;
      const prefix = c.code.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "";
      const cat = CATEGORY_SEED.find(([, , prefixes]) => prefixes.includes(prefix))?.[0] ?? "General Studies";
      await saveSettings(user, S.courseSettings, c.id, { ...defaults(COURSE_FIELDS), category: ids.get(cat), gradingScheme: standardId, name: c.title, number: c.code, credits: c.credits });
    }
  }

  if (!(await list(inst, ENTITIES.questions.screen)).length) {
    const items: Data[] = [];
    for (const [question, type] of QUESTION_SEED) {
      const answers =
        type === "Multiple Choice" ? LIKERT.map((answer, i) => ({ id: `a${i + 1}`, answer, dflt: "Not Default", referencing: "", score: LIKERT.length - i })) : [];
      const q = await put(ENTITIES.questions.screen, { type, question, answers });
      items.push({ kind: "question", id: `q-${q.id.slice(0, 8)}`, questionId: q.id });
    }
    await put(ENTITIES.evaluations.screen, {
      title: "End of Course Evaluation",
      description: "<p>Please share your experience of this course. Responses are anonymous and are released to instructors after the course is complete.</p>",
      active: "Active",
      autoAssign: "Disabled",
      availabilityDays: 2,
      expiresDays: 14,
      campuses: [],
      courses: [],
      autoRelease: "Disabled",
      releaseDays: 1,
      gradesVisibility: "Evaluation optional",
      items,
    });
  }

  await prisma.heritageRecord.create({
    data: { institutionId: inst, screenId: S.seed, contextKey: "", singletonKey: "v1", dataJson: JSON.stringify({ at: new Date().toISOString() }), createdById: user.accountId, updatedById: user.accountId },
  });
}

export async function courseCounts(user: SessionClaims) {
  await view(user);
  const inst = user.institutionId;
  const [changes, backups] = await Promise.all([list(inst, S.change), prisma.heritageRecord.count({ where: { institutionId: inst, screenId: S.backup, deletedAt: null } })]);
  return { pending: changes.filter((c) => c.data.status === "Pending Review").length, backups };
}
