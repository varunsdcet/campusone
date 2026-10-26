/* Student Management shared layer: permissions, catalogues, per-student profile assembly, section audit and files. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { CAMPUSES, STUDENT_PROGRAMS, assertPermission, patchStudentMeta, studentMetaMap } from "../superAdmin.service.js";
import { audit } from "./service.js";
import { ensureSeed, entityRecords, type Rec } from "./sysconfig.js";
import { add, arr, getSingle, httpError, nextNumber, putSingle, rows, s, studentsInfo, type Data, type Db, type Row, type StudentInfo } from "./finance.core.js";
import { STATUS_TREE, STU, auditScreen, type AuditSection } from "./students.spec.js";
import { bytesMatchMime, decodeBase64 } from "../../../lib/fileSniff.js";

export { add, arr, drop, getSingle, httpError, putSingle, row, rows, s, save, day, today, DATE_RE, type Data, type Db, type Row } from "./finance.core.js";

export async function canStudents(user: SessionClaims, level: "view" | "edit") {
  return assertPermission(user, "studentRecords", level);
}

/** Enforces the user's regional campus scope before any student record is read or changed. */
export async function assertStudentCampusAccess(user: SessionClaims, studentId: string) {
  const access = await assertPermission(user, "studentRecords", "view");
  if (access.superAdmin || access.campuses.length === CAMPUSES.length) return;
  const meta = await studentMetaMap(user.institutionId);
  const campus = s(meta[studentId]?.campus);
  if (!campus || !access.campuses.includes(campus)) {
    throw httpError(403, "This student is outside your assigned campus scope", "FORBIDDEN");
  }
}

/** Returns student display facts after applying the same campus boundary used by student routes. */
export async function scopedStudentsInfo(user: SessionClaims, ids?: string[]): Promise<Map<string, StudentInfo>> {
  const access = await canStudents(user, "view");
  const info = await studentsInfo(user.institutionId, ids);
  if (access.superAdmin || access.campuses.length === CAMPUSES.length) return info;
  for (const [studentId, student] of info) {
    if (!student.campus || !access.campuses.includes(student.campus)) info.delete(studentId);
  }
  return info;
}

export const text = (v: unknown, max = 2000) => s(v).trim().slice(0, max);
export const bool = (v: unknown) => v === true || v === "true" || v === "Yes" || v === "on" || v === 1;
export const oneOf = <T extends string>(v: unknown, list: readonly T[], label: string, fallback?: T): T => {
  const t = s(v).trim();
  if (!t && fallback !== undefined) return fallback;
  if (!(list as readonly string[]).includes(t)) throw httpError(400, `${label} must be one of: ${list.join(", ")}`);
  return t as T;
};
export function required(v: unknown, label: string, max = 200) {
  const t = text(v, max);
  if (!t) throw httpError(400, `${label} is required`);
  return t;
}
export function optDate(v: unknown, label: string) {
  const t = s(v).trim();
  if (!t) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) throw httpError(400, `${label} must be a valid date`);
  return t;
}
export const fullName = (p: { givenName: string; familyName: string; preferredName?: string | null }) => `${p.familyName}, ${p.givenName}`.trim();
export const fmtStamp = (d: Date) => d.toISOString();

/* ------------------------------------------------------------------ */
/* Catalogues                                                           */
/* ------------------------------------------------------------------ */

export type StatusNode = { name: string; parent: string | null; children: string[] };

/** Status tree from System Configuration › Student Statuses (seeded on first use), with the captured tree as fallback. */
export async function statusTree(user: SessionClaims): Promise<StatusNode[]> {
  await ensureSeed(user);
  const recs = await entityRecords(user.institutionId, "studentStatuses");
  if (!recs.length) return STATUS_TREE.map((x) => ({ name: x.name, parent: null, children: x.children ?? [] }));
  const order = (r: Rec) => Number(r.data._order ?? 0);
  const roots = recs.filter((r) => !s(r.data.parent)).sort((a, b) => order(a) - order(b));
  return roots.map((r) => ({
    name: s(r.data.name),
    parent: null,
    children: recs
      .filter((c) => s(c.data.parent) === r.id)
      .sort((a, b) => order(a) - order(b))
      .map((c) => s(c.data.name)),
  }));
}

export const flatStatuses = (tree: StatusNode[]) => tree.flatMap((n) => [n.name, ...n.children]);

export type StudentStatusPolicy = {
  name: string;
  generateNumber: boolean;
  grantsAdmission: boolean;
  enablesRegistration: boolean;
  locksPlan: boolean;
  createLogin: boolean;
  transferIn: string;
  leaveOfAbsence: boolean;
  withdrawn: boolean;
  completes: boolean;
};

/** Resolves the saved status flags used by mutations; a child inherits omitted settings from its parent. */
export async function studentStatusPolicy(inst: string, status: string): Promise<StudentStatusPolicy | null> {
  const rows = await entityRecords(inst, "studentStatuses");
  const row = rows.find((candidate) => s(candidate.data.name) === status);
  if (!row) return null;
  const parent = row.data.parent ? rows.find((candidate) => candidate.id === s(row.data.parent)) : null;
  const value = (key: string) => row.data[key] ?? parent?.data[key];
  const yes = (key: string) => value(key) === true || s(value(key)).toLowerCase() === "yes" || s(value(key)).toLowerCase() === "enabled";
  return { name: status, generateNumber: yes("generateNumber"), grantsAdmission: yes("grantsAdmission"), enablesRegistration: yes("enablesRegistration"), locksPlan: yes("locksPlan"), createLogin: yes("createLogin"), transferIn: s(value("transferIn")) || "Not Applicable", leaveOfAbsence: yes("leaveOfAbsence"), withdrawn: yes("withdrawn"), completes: yes("completes") };
}

export async function programCatalogue(inst: string) {
  const [programs, schedules, pathways, terms] = await Promise.all([rows(inst, "PM:PROGRAM"), rows(inst, "PM:SCHEDULE"), rows(inst, "PM:PATHWAY"), rows(inst, "PM:TERM")]);
  const progs = programs.map((p) => ({ id: p.id, name: s(p.data.name), abbreviation: s(p.data.abbreviation) })).filter((p) => p.name);
  const list = progs.length ? progs : STUDENT_PROGRAMS.map((p) => ({ id: p.code, name: p.name, abbreviation: p.code }));
  return {
    programs: list.sort((a, b) => a.name.localeCompare(b.name)),
    schedules: schedules
      .map((x) => ({ id: x.id, program: s(x.data.program), name: s(x.data.abbreviation) || s(x.data.description), description: s(x.data.description) }))
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
    pathways: pathways.map((x) => ({ id: x.id, program: x.contextKey, name: s(x.data.name) })).filter((x) => x.name),
    terms: terms
      .map((t) => ({ id: t.id, name: s(t.data.name), startDate: s(t.data.startDate), endDate: s(t.data.endDate) }))
      .filter((t) => t.name)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  };
}

export async function campusNames(inst: string) {
  const recs = await rows(inst, "LOC:CAMPUS");
  const names = recs.map((r) => s(r.data.name)).filter(Boolean);
  return (names.length ? names : [...CAMPUSES]).sort((a, b) => a.localeCompare(b));
}

export async function countryCatalogue(inst: string) {
  const [countries, regions] = await Promise.all([entityRecords(inst, "countries"), entityRecords(inst, "countryRegions")]);
  const out = countries
    .map((c) => ({ name: s(c.data.name), regions: regions.filter((r) => r.contextKey === c.id).map((r) => s(r.data.name)).filter(Boolean).sort((a, b) => a.localeCompare(b)) }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Staff accounts that can be assigned as advisors (anything other than a pure student login). */
export async function staffAccounts(inst: string) {
  const accounts = await prisma.account.findMany({ where: { institutionId: inst, status: "active" }, include: { person: true }, take: 3000 });
  return accounts
    .filter((a) => {
      try {
        const roles = JSON.parse(a.rolesJson) as string[];
        return roles.some((r) => r !== "student" && r !== "applicant");
      } catch {
        return false;
      }
    })
    .map((a) => ({ id: a.id, name: `${a.person.familyName}, ${a.person.givenName}`.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function agentCatalogue(inst: string) {
  const recs = await entityRecords(inst, "agents");
  return recs.map((r) => ({ id: r.id, name: `${s(r.data.lastName)}, ${s(r.data.firstName)} (${s(r.data.agentNumber)})` })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function admissionTerms(inst: string) {
  const [pm, terms] = await Promise.all([programCatalogue(inst), prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" }, select: { name: true } })]);
  return [...new Set([...pm.terms.map((t) => t.name), ...terms.map((t) => t.name)])];
}

/* ------------------------------------------------------------------ */
/* Students                                                             */
/* ------------------------------------------------------------------ */

export type Profile = {
  gender: string;
  province: string;
  visaStatus: string;
  visaExpiry: string;
  academicHistory: string;
  transcripts: Array<{ id: string; name: string; size: number }>;
  declarationBy: string;
  acknowledgements: boolean[];
  advisors: string[];
  agentId: string;
  language: string;
  applicationNumber: string;
  programId: string;
  scheduleStart: string;
  scheduleEnd: string;
  feedIn: string;
};

const EMPTY_PROFILE: Profile = {
  gender: "",
  province: "",
  visaStatus: "",
  visaExpiry: "",
  academicHistory: "",
  transcripts: [],
  declarationBy: "",
  acknowledgements: [false, false],
  advisors: [],
  agentId: "",
  language: "",
  applicationNumber: "",
  programId: "",
  scheduleStart: "",
  scheduleEnd: "",
  feedIn: "",
};

export async function loadProfile(inst: string, studentId: string): Promise<Profile> {
  const r = await getSingle(inst, STU.PROFILE, studentId, "profile");
  return { ...EMPTY_PROFILE, ...((r?.data ?? {}) as Partial<Profile>) };
}

export async function profilesFor(inst: string, ids: string[]) {
  const list = ids.length ? await rows(inst, STU.PROFILE, ids) : [];
  return new Map(list.map((r) => [r.contextKey, { ...EMPTY_PROFILE, ...(r.data as Partial<Profile>) }]));
}

export async function saveProfile(user: SessionClaims, studentId: string, patch: Partial<Profile>, db: Db = prisma) {
  const current = await loadProfile(user.institutionId, studentId);
  const next = { ...current, ...patch };
  await putSingle(user, STU.PROFILE, studentId, "profile", next as unknown as Data, db);
  return next;
}

export async function requireStudentRow(inst: string, id: string) {
  const st = await prisma.student.findFirst({ where: { id, institutionId: inst }, include: { person: true, cohort: true, _count: { select: { enrolments: { where: { status: "enrolled" } } } } } });
  if (!st) throw httpError(404, "Student not found", "NOT_FOUND");
  return st;
}

export type StudentMetaRow = Record<string, string | undefined>;

export async function metaOf(inst: string, id: string): Promise<StudentMetaRow> {
  return ((await studentMetaMap(inst))[id] ?? {}) as StudentMetaRow;
}

export const statusOf = (meta: StudentMetaRow, enrolled: number) => meta.status ?? (enrolled ? "Active Student" : "Registered Student");

export async function patchMetaLoose(inst: string, id: string, patch: Record<string, string | undefined>) {
  return patchStudentMeta(inst, id, patch as Parameters<typeof patchStudentMeta>[2]);
}

/** Running numbers for application / assessment-case references. */
export async function seq(inst: string, kind: string) {
  return nextNumber(inst, `stu:${kind}`);
}

/* ------------------------------------------------------------------ */
/* Audit                                                                */
/* ------------------------------------------------------------------ */

export async function stuAudit(user: SessionClaims, section: AuditSection, studentId: string, action: string, details: Data, recordId?: string | null, before?: Data) {
  await audit(user, auditScreen(section), studentId, action, { recordId: recordId ?? null, before, after: details });
}

/* ------------------------------------------------------------------ */
/* Files                                                                */
/* ------------------------------------------------------------------ */

const FILE_MAX = 8 * 1024 * 1024;
const FILE_TYPES =
  /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel)$/;

export type FileRef = { id: string; name: string; size: number; mime: string };

type FileBody = { name?: unknown; mime?: unknown; base64?: unknown };
export type ValidFile = { name: string; mime: string; size: number; base64: string };

export function validateFile(body: FileBody): ValidFile {
  const name = s(body.name).replace(/[\\/]/g, "_").trim().slice(0, 200);
  const mime = s(body.mime).toLowerCase();
  if (!name) throw httpError(400, "File name is required");
  if (!FILE_TYPES.test(mime)) throw httpError(400, "Unsupported file type. Upload a PDF, image, Word, Excel or text file.");
  const b64 = s(body.base64).replace(/^data:[^,]*,/, "");
  const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (!size) throw httpError(400, "The file is empty");
  if (size > FILE_MAX) throw httpError(400, "Files must be 8 MB or smaller");
  if (!bytesMatchMime(decodeBase64(b64), mime)) throw httpError(400, "The file's contents do not match its type. Upload a genuine PDF, image, Word, Excel or text file.");
  return { name, mime, size, base64: b64 };
}

export async function storeValidFile(user: SessionClaims, studentId: string, file: ValidFile, db: Db = prisma): Promise<FileRef> {
  const rec = await add(user, STU.FILE, file, studentId, null, db);
  return { id: rec.id, name: file.name, size: file.size, mime: file.mime };
}

export async function storeFile(user: SessionClaims, studentId: string, body: FileBody): Promise<FileRef> {
  return storeValidFile(user, studentId, validateFile(body));
}

/** Validates file references posted with a record against files uploaded for the same student. */
export async function fileRefs(inst: string, studentId: string, v: unknown): Promise<FileRef[]> {
  const ids = arr<{ id?: unknown } | string>(v)
    .map((x) => (typeof x === "string" ? x : s(x?.id)))
    .filter(Boolean);
  if (!ids.length) return [];
  const found = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: STU.FILE, contextKey: studentId, id: { in: ids }, deletedAt: null } });
  if (found.length !== new Set(ids).size) throw httpError(400, "One or more attached files were not found");
  return found.map((f) => {
    const d = JSON.parse(f.dataJson) as Data;
    return { id: f.id, name: s(d.name), size: Number(d.size) || 0, mime: s(d.mime) };
  });
}

export async function readFile(inst: string, studentId: string, fileId: string) {
  const f = await prisma.heritageRecord.findFirst({ where: { id: fileId, institutionId: inst, screenId: STU.FILE, contextKey: studentId, deletedAt: null } });
  if (!f) throw httpError(404, "File not found", "NOT_FOUND");
  const d = JSON.parse(f.dataJson) as Data;
  return { name: s(d.name), mime: s(d.mime), base64: s(d.base64) };
}

export type { Rec, Row as StoredRow };
