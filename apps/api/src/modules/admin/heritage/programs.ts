import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { CAMPUSES, STUDENT_STATUSES, assertPermission } from "../superAdmin.service.js";
import { audit } from "./service.js";
import { DEFAULT_FACULTIES, DEFAULT_FACULTY_PROGRAMS } from "../../instructor/facultiesPrograms.js";
import {
  BULK_CATEGORIES,
  CAPTURED_LEDGER_TYPES,
  ENTITIES,
  PASS_FAIL_ROWS,
  PM,
  SEED_PROGRAM_TYPES,
  WEEKDAYS,
  type Data,
  type EntityDef,
  type EntityKey,
  type Field,
  type RefTarget,
} from "./programs.spec.js";
import { releaseSessionSection, sessionSectionRemovalBlockers, syncSessionSection } from "./programs.sections.js";

export { ENTITIES, type EntityKey };

const LOC_CAMPUS = "LOC:CAMPUS";
const LOC_CLASSROOM = "LOC:CLASSROOM";
const AUDIT_PROGRAM = "PR02";

type Rec = { id: string; contextKey: string; data: Data; createdAt: Date; updatedAt: Date };

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const parse = (json: string | null | undefined): Data => {
  try {
    const v = JSON.parse(json ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
  } catch {
    return {};
  }
};
const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const lc = (v: unknown) => s(v).trim().toLowerCase();
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
const order = (d: Data) => (typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER);
const clone = <T>(v: T): T => (v && typeof v === "object" ? (JSON.parse(JSON.stringify(v)) as T) : v);
const byName = (a: Rec, b: Rec) => s(a.data.name).localeCompare(s(b.data.name), undefined, { sensitivity: "base", numeric: true });

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

async function list(inst: string, screen: string, contextKey?: string): Promise<Rec[]> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null, ...(contextKey !== undefined ? { contextKey } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt }));
}

async function find(inst: string, screen: string, id: string, label: string): Promise<Rec> {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return { id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt };
}

async function insert(inst: string, actorId: string, screen: string, data: Data, contextKey = "") {
  return prisma.heritageRecord.create({ data: { institutionId: inst, screenId: screen, contextKey, dataJson: JSON.stringify(data), createdById: actorId, updatedById: actorId } });
}

async function write(actorId: string, id: string, data: Data, contextKey?: string) {
  await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(data), updatedById: actorId, rowVersion: { increment: 1 }, ...(contextKey !== undefined ? { contextKey } : {}) } });
}

async function remove(inst: string, actorId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.heritageRecord.updateMany({ where: { id: { in: ids }, institutionId: inst }, data: { deletedAt: new Date(), updatedById: actorId, status: "deleted" } });
}

/* ------------------------------------------------------------------ */
/* Reference lists                                                      */
/* ------------------------------------------------------------------ */

type Lists = Record<string, string[]>;

function title(d: Data) {
  for (const k of ["name", "title", "type", "label"]) if (typeof d[k] === "string" && s(d[k]).trim()) return s(d[k]).trim();
  const first = Object.entries(d).find(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim());
  return first ? s(first[1]).trim() : "";
}
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

async function loadLists(inst: string): Promise<Lists> {
  const screens = [LOC_CAMPUS, "SYS:STUDENT_STATUS", "SYS:FLAG_TEMPLATE", "F13", "F15", "C26", "CM:GRADING", PM.program];
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: screens }, deletedAt: null, singletonKey: null },
    select: { screenId: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  const of = (screen: string) => rows.filter((r) => r.screenId === screen).map((r) => parse(r.dataJson));
  const campuses = of(LOC_CAMPUS).map((d) => s(d.name));
  const statuses = of("SYS:STUDENT_STATUS")
    .sort((a, b) => order(a) - order(b))
    .map((d) => s(d.name));
  const rates = of("F15").map(title);
  return {
    campuses: uniq(campuses.length ? campuses : [...CAMPUSES]),
    statuses: uniq(statuses.length ? statuses : [...STUDENT_STATUSES]),
    flags: uniq(of("SYS:FLAG_TEMPLATE").map((d) => s(d.name))),
    ledgerTypes: uniq([...of("F13").map(title), ...CAPTURED_LEDGER_TYPES]),
    rateCategories: uniq(rates.length ? rates : ["Domestic", "International"]),
    gradingSchemes: uniq([
      ...of("CM:GRADING")
        .filter((d) => d.active !== "Inactive" && d.status !== "Inactive")
        .map((d) => s(d.name)),
      "Pass / Fail",
      ...of("C26").map(title),
    ]),
    programNames: uniq(of(PM.program).map((d) => s(d.name))).sort((a, b) => a.localeCompare(b)),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function applies(f: Field, d: Data) {
  if (!f.when) return true;
  const v = d[f.when.key];
  const hit = Array.isArray(f.when.equals) ? (f.when.equals as readonly unknown[]).includes(v) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (["multi", "refMulti", "people", "rows"].includes(f.kind)) return [];
  if (f.kind === "weekly") return {};
  if (f.kind === "number") return null;
  return "";
}

function sanitizeHtml(html: string) {
  const blocked = "script|style|iframe|object|embed|link|meta|template|form|input|button|textarea|select|svg|math";
  return html
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${blocked})\\b[^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("|')\s*data:(?!image\/(png|jpe?g|gif|webp))[^"']*\2/gi, '$1="#"');
}

const REF_SCREEN: Record<Exclude<RefTarget, "course">, string> = {
  faculties: PM.faculty,
  programTypes: PM.programType,
  programs: PM.program,
  terms: PM.term,
  tiers: PM.tier,
  electiveGroups: PM.electiveGroup,
  feeTerms: PM.feeTerm,
  scheduleFeeTerms: PM.scheduleFeeTerm,
  schedules: PM.schedule,
  classroom: LOC_CLASSROOM,
};
/** References that must belong to the same parent record (pathway, program or schedule). */
const SCOPED = new Set<RefTarget>(["tiers", "electiveGroups", "feeTerms", "scheduleFeeTerms"]);

type Ctx = { inst: string; parentKey: string; lists: () => Promise<Lists>; extra?: Lists };

function ctxFor(inst: string, parentKey = ""): Ctx {
  let cache: Promise<Lists> | null = null;
  return { inst, parentKey, lists: () => (cache ??= loadLists(inst)) };
}

async function refOk(ctx: Ctx, target: RefTarget, id: string) {
  if (target === "course") return (await prisma.course.count({ where: { id, institutionId: ctx.inst } })) > 0;
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: ctx.inst, screenId: REF_SCREEN[target], deletedAt: null, singletonKey: null }, select: { contextKey: true } });
  if (!r) return false;
  return SCOPED.has(target) ? r.contextKey === ctx.parentKey : true;
}

async function clean(fields: Field[], input: Data, base: Data, ctx: Ctx, prefix = ""): Promise<Data> {
  const out: Data = { ...base };
  for (const f of fields) {
    if (f.key in input) out[f.key] = input[f.key];
    else if (!(f.key in out) && f.dflt !== undefined) out[f.key] = clone(f.dflt);
  }
  const errors: string[] = [];
  const err = (f: Field, msg: string) => errors.push(`${prefix}${f.label} ${msg}`);
  for (const f of fields) {
    if (!applies(f, out)) {
      out[f.key] = f.dflt !== undefined ? clone(f.dflt) : emptyOf(f);
      continue;
    }
    const raw = out[f.key];
    switch (f.kind) {
      case "text":
      case "textarea":
      case "html":
      case "select":
      case "date":
      case "datetime": {
        let v = s(raw).trim();
        const max = f.kind === "html" ? 100_000 : f.kind === "textarea" ? 4000 : 200;
        if (v.length > max) err(f, "is too long");
        if (f.kind === "html") v = sanitizeHtml(v);
        if (!v) {
          if (f.required) err(f, "is required");
        } else if (f.kind === "date" && (!DATE_RE.test(v) || !realDate(v))) err(f, "must be a valid date");
        else if (f.kind === "datetime" && (!DATETIME_RE.test(v) || !realDate(v.slice(0, 10)) || Number.isNaN(Date.parse(v)))) err(f, "must be a valid date and time");
        else if (f.kind === "select") {
          const allowed = f.options ? [...f.options] : f.dyn ? [...(f.dynExtra ?? []), ...((ctx.extra?.[f.dyn] ?? (await ctx.lists())[f.dyn]) ?? [])] : [];
          if (allowed.length && !allowed.includes(v)) err(f, `: "${v}" is not a valid choice`);
        }
        out[f.key] = v;
        break;
      }
      case "number": {
        if (raw === "" || raw === null || raw === undefined) {
          if (f.required) err(f, "is required");
          out[f.key] = null;
          break;
        }
        const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw.trim()) : NaN;
        if (!Number.isFinite(n)) err(f, "must be a number");
        else if (f.integer && !Number.isInteger(n)) err(f, "must be a whole number");
        else if (f.min !== undefined && n < f.min) err(f, `must be at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) err(f, `must be at most ${f.max}`);
        out[f.key] = Number.isFinite(n) ? n : null;
        break;
      }
      case "bool":
        out[f.key] = raw === true || raw === "true";
        break;
      case "multi": {
        const vals = uniq(arr(raw).map((x) => s(x).trim()));
        const allowed = f.options ? [...f.options] : f.dyn ? ((await ctx.lists())[f.dyn] ?? []) : [];
        const bad = allowed.length ? vals.filter((x) => !allowed.includes(x)) : [];
        if (bad.length) err(f, `: invalid choice ${bad.slice(0, 3).join(", ")}`);
        if (f.required && !vals.length) err(f, ": select at least one");
        out[f.key] = vals.slice(0, 200);
        break;
      }
      case "ref": {
        const v = s(raw).trim();
        if (!v) {
          if (f.required) err(f, "is required");
          out[f.key] = "";
        } else if (!(await refOk(ctx, f.ref!, v))) err(f, ": the selected item no longer exists");
        else out[f.key] = v;
        break;
      }
      case "refMulti": {
        const ids = uniq(arr(raw).map(s)).slice(0, 300);
        const found = ids.length ? await prisma.heritageRecord.count({ where: { id: { in: ids }, institutionId: ctx.inst, screenId: REF_SCREEN[f.ref as Exclude<RefTarget, "course">], deletedAt: null } }) : 0;
        if (found !== ids.length) err(f, ": some selected items no longer exist");
        if (f.required && !ids.length) err(f, ": select at least one");
        out[f.key] = ids;
        break;
      }
      case "person":
      case "people": {
        const ids = (f.kind === "person" ? (s(raw) ? [s(raw)] : []) : uniq(arr(raw).map(s))).slice(0, 100);
        const found = ids.length ? await prisma.account.count({ where: { id: { in: ids }, institutionId: ctx.inst } }) : 0;
        if (found !== ids.length) err(f, ": a selected user no longer exists");
        if (f.required && !ids.length) err(f, "is required");
        out[f.key] = f.kind === "person" ? (ids[0] ?? "") : ids;
        break;
      }
      case "weekly": {
        const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Data) : {};
        const w: Record<string, { start: string; end: string }> = {};
        for (const day of WEEKDAYS) {
          const e = src[day];
          if (!e || typeof e !== "object") continue;
          const start = s((e as Data).start);
          const end = s((e as Data).end);
          if (!start && !end) {
            w[day] = { start: "", end: "" };
            continue;
          }
          if (!TIME_RE.test(start) || !TIME_RE.test(end)) err(f, `: ${day} needs a start and finish time`);
          else if (end <= start) err(f, `: ${day} finish time must be after the start time`);
          w[day] = { start, end };
        }
        out[f.key] = w;
        break;
      }
      case "rows": {
        const rows = arr(raw).slice(0, 100) as Data[];
        const labels = f.key === "designations" ? rows.map((r) => s(r?.label).trim()).filter(Boolean) : [];
        const cleaned: Data[] = [];
        for (const [i, r] of rows.entries()) {
          if (!r || typeof r !== "object") continue;
          const rowCtx: Ctx = f.key === "designations" ? { ...ctx, extra: { designationLabels: labels.filter((l) => l !== s(r.label).trim()) } } : ctx;
          try {
            const c = await clean(f.rowFields ?? [], r, {}, rowCtx, `${f.label} row ${i + 1}: `);
            cleaned.push({ id: s(r.id) || randomUUID(), ...c });
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
        out[f.key] = cleaned;
        break;
      }
    }
  }
  for (const k of Object.keys(out)) if (!k.startsWith("_") && !fields.some((x) => x.key === k)) delete out[k];
  if (errors.length) throw httpError(400, errors.join("; "));
  return out;
}

function defaults(fields: Field[]): Data {
  const out: Data = {};
  for (const f of fields) out[f.key] = f.dflt !== undefined ? clone(f.dflt) : emptyOf(f);
  return out;
}

/* ------------------------------------------------------------------ */
/* Prisma sync (programs and academic terms are shared with the SIS)    */
/* ------------------------------------------------------------------ */

async function linkedIds(inst: string, screen: string, exceptId?: string) {
  return new Set((await list(inst, screen)).filter((r) => r.id !== exceptId).map((r) => s(r.data._prismaId)).filter(Boolean));
}

async function syncProgram(inst: string, recId: string | undefined, data: Data) {
  const code = s(data.abbreviation).trim() || "PROGRAM";
  const name = s(data.name).trim();
  const type = data.programType ? await prisma.heritageRecord.findFirst({ where: { id: s(data.programType) } }) : null;
  const awardLevel = lc(type ? parse(type.dataJson).name : "") || "diploma";
  const current = s(data._prismaId) ? await prisma.program.findFirst({ where: { id: s(data._prismaId), institutionId: inst } }) : null;
  if (current) {
    let nextCode = current.code;
    if (lc(code) !== lc(current.code) && !(await prisma.program.findFirst({ where: { institutionId: inst, code, NOT: { id: current.id } } }))) nextCode = code;
    await prisma.program.update({ where: { id: current.id }, data: { name, code: nextCode, awardLevel, rowVersion: { increment: 1 } } });
    return current.id;
  }
  const taken = await linkedIds(inst, PM.program, recId);
  const existing = await prisma.program.findFirst({ where: { institutionId: inst, code: { equals: code, mode: "insensitive" } } });
  if (existing && !taken.has(existing.id)) {
    await prisma.program.update({ where: { id: existing.id }, data: { name, awardLevel, rowVersion: { increment: 1 } } });
    return existing.id;
  }
  let candidate = code;
  for (let n = 2; await prisma.program.findFirst({ where: { institutionId: inst, code: candidate } }); n++) candidate = `${code}-${n}`;
  return (await prisma.program.create({ data: { institutionId: inst, code: candidate, name, awardLevel } })).id;
}

async function syncTerm(inst: string, recId: string | undefined, data: Data) {
  const code = s(data.abbreviation).trim();
  const payload = { name: s(data.name).trim(), startsOn: s(data.startDate), endsOn: s(data.endDate) };
  const current = s(data._prismaId) ? await prisma.term.findFirst({ where: { id: s(data._prismaId), institutionId: inst } }) : null;
  if (current) {
    const clash = lc(code) !== lc(current.code) ? await prisma.term.findFirst({ where: { institutionId: inst, code, NOT: { id: current.id } } }) : null;
    if (clash) throw httpError(409, `Term Abbreviation "${code}" is already used by another academic term`, "CONFLICT");
    await prisma.term.update({ where: { id: current.id }, data: { ...payload, code, rowVersion: { increment: 1 } } });
    return current.id;
  }
  const taken = await linkedIds(inst, PM.term, recId);
  const existing = await prisma.term.findFirst({ where: { institutionId: inst, code } });
  if (existing) {
    if (taken.has(existing.id)) throw httpError(409, `Term Abbreviation "${code}" is already used by another academic term`, "CONFLICT");
    await prisma.term.update({ where: { id: existing.id }, data: { ...payload, rowVersion: { increment: 1 } } });
    return existing.id;
  }
  return (await prisma.term.create({ data: { institutionId: inst, code, ...payload } })).id;
}

/* ------------------------------------------------------------------ */
/* Seed: records visible on the captured screens                        */
/* ------------------------------------------------------------------ */

const DAP_HOURS: Array<[string, number]> = [
  ["BCOM 105", 80],
  ["COMP 102", 40],
  ["MATH 100", 40],
  ["DAP 101", 40],
  ["DAP 105", 40],
  ["DAP 106", 40],
  ["DAP 110", 40],
  ["BMGT 101", 80],
  ["EMPL 111", 40],
  ["DAP 108", 80],
  ["DIB 115", 40],
  ["COMP 101", 20],
];
const WEEKDAY_9_TO_1 = Object.fromEntries(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => [d, { start: "09:00", end: "13:00" }]));

async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  if (await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PM.seed, singletonKey: "seed" } })) return;
  try {
    await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: PM.seed, singletonKey: "seed", dataJson: "{}", createdById: user.accountId, updatedById: user.accountId } });
  } catch {
    return;
  }
  const a = user.accountId;
  const types = new Map<string, string>();
  for (const [i, [name, abbreviation]] of SEED_PROGRAM_TYPES.entries()) types.set(name, (await insert(inst, a, PM.programType, { name, abbreviation, active: "Active", _order: i })).id);

  const faculties = new Map<string, string>();
  for (const fac of DEFAULT_FACULTIES) faculties.set(fac.id, (await insert(inst, a, PM.faculty, { name: fac.name, abbreviation: fac.abbreviation, active: fac.active ? "Active" : "Inactive" })).id);

  const base = defaults(ENTITIES.programs.fields);
  const dbPrograms = await prisma.program.findMany({ where: { institutionId: inst } });
  const used = new Set<string>();
  const programIds = new Map<string, string>();
  const createProgram = async (facultyId: string, name: string, abbreviation: string, extra: Data = {}) => {
    const match = dbPrograms.find((p) => !used.has(p.id) && (lc(p.code) === lc(abbreviation) || lc(p.name) === lc(name)));
    if (match) used.add(match.id);
    const typeName = /diploma/i.test(name) ? "Diploma" : "Certificate";
    const data: Data = { ...base, faculty: facultyId, name, abbreviation, programType: types.get(typeName) ?? "", active: "Active", ...extra, _prismaId: match?.id ?? "" };
    const rec = await insert(inst, a, PM.program, data, facultyId);
    await audit(user, AUDIT_PROGRAM, rec.id, "create program", { recordId: rec.id, after: data });
    return rec.id;
  };
  const specifics: Record<string, Data> = {
    CAPA: { scheduleType: "Sequential", financialUtilization: "Hours Completed", completionDateCalc: "By course schedule", programLength: 5, programLengthUnit: "Months" },
    DAP: { scheduleType: "Sequential", financialUtilization: "Hours Completed", completionDateCalc: "By course schedule", prerequisiteProgram: "Yes", fullTimeMin: "1", programLength: 48, programLengthUnit: "Months" },
    BTT: { scheduleType: "Self-Paced", financialUtilization: "Hours Completed", maxCourseAttempts: "1", fullTimeMin: "22", programLength: 48, programLengthUnit: "Months" },
  };
  for (const p of DEFAULT_FACULTY_PROGRAMS) programIds.set(p.abbreviation, await createProgram(faculties.get(p.facultyId) ?? "", p.name, p.abbreviation, specifics[p.abbreviation] ?? { programLength: 48, programLengthUnit: "Months" }));
  const fallbackFaculty = faculties.get("fac-computer-science") ?? [...faculties.values()][0] ?? "";
  for (const p of dbPrograms.filter((x) => !used.has(x.id))) {
    used.add(p.id);
    const data: Data = { ...base, faculty: fallbackFaculty, name: p.name, abbreviation: p.code, programType: types.get(/diploma/i.test(p.name) ? "Diploma" : "Certificate") ?? "", _prismaId: p.id };
    const rec = await insert(inst, a, PM.program, data, fallbackFaculty);
    await audit(user, AUDIT_PROGRAM, rec.id, "create program", { recordId: rec.id, after: data });
  }

  const courses = await prisma.course.findMany({ where: { institutionId: inst } });
  const courseBy = (code: string) => courses.find((c) => lc(c.code) === lc(code));
  const pathwayBase = { ...defaults(ENTITIES.pathways.fields), type: "Major", name: "Default", defaultOutline: true, status: "Active" };
  for (const abbr of ["CAPA", "DAP", "BTT"]) {
    const programId = programIds.get(abbr);
    if (!programId) continue;
    const pw = await insert(inst, a, PM.pathway, { ...pathwayBase, abbreviation: abbr }, programId);
    const rows: Array<[string, number | null]> = abbr === "DAP" ? DAP_HOURS : abbr === "BTT" ? [["BTT 101", null]] : [];
    let i = 0;
    for (const [code, hours] of rows) {
      const c = courseBy(code);
      if (!c) continue;
      await insert(inst, a, PM.pathwayCourse, { course: c.id, tier: "", hours, _order: i++ }, pw.id);
      if (abbr === "DAP" && !(await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PM.courseSchedule, contextKey: c.id, singletonKey: "weekly" } })))
        await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: PM.courseSchedule, contextKey: c.id, singletonKey: "weekly", dataJson: JSON.stringify({ weekly: WEEKDAY_9_TO_1 }), createdById: a, updatedById: a } });
    }
  }
  const btt = programIds.get("BTT");
  if (btt) {
    await insert(inst, a, PM.fee, { ledgerType: "Application Fee", feeTerm: "", domestic: 50, international: 50, _order: 0 }, btt);
    await insert(inst, a, PM.fee, { ledgerType: "Tuition Fee", feeTerm: "", domestic: 400, international: 400, _order: 1 }, btt);
  }

  const campuses = (await loadLists(inst)).campuses ?? [];
  const termBase = defaults(ENTITIES.terms.fields);
  for (const t of await prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "asc" } }))
    await insert(inst, a, PM.term, { ...termBase, name: t.name, abbreviation: t.code, campuses, startDate: t.startsOn.slice(0, 10), endDate: t.endsOn.slice(0, 10), _prismaId: t.id });
  await audit(user, "PR01", "", "seed program management", { note: "Captured program types, faculties, programs, pathways, fees and existing academic terms" });
}

/* ------------------------------------------------------------------ */
/* Meta                                                                 */
/* ------------------------------------------------------------------ */

async function accountNames(inst: string, ids?: string[]) {
  const accounts = await prisma.account.findMany({ where: { institutionId: inst, ...(ids ? { id: { in: ids } } : {}) }, include: { person: true }, take: 3000 });
  return accounts.map((acc) => ({ id: acc.id, label: `${acc.person.givenName} ${acc.person.familyName}`.trim(), roles: acc.rolesJson }));
}

async function campusOfClassrooms(inst: string) {
  const [campuses, rooms] = await Promise.all([list(inst, LOC_CAMPUS), list(inst, LOC_CLASSROOM)]);
  const campusName = new Map(campuses.map((c) => [c.id, s(c.data.name)]));
  return rooms
    .filter((r) => s(r.data.active) !== "Inactive")
    .map((r) => ({ id: r.id, name: s(r.data.name), campus: campusName.get(r.contextKey) ?? campusName.get(s(r.data.campus)) ?? "", size: Number(r.data.size) || 0 }))
    .map((r) => ({ ...r, label: `${r.name} (${r.size})` }))
    .sort((x, y) => x.campus.localeCompare(y.campus) || x.name.localeCompare(y.name, undefined, { numeric: true }));
}

export async function programMeta(user: SessionClaims) {
  await assertPermission(user, "programManagement", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const [lists, faculties, types, programs, terms, schedules, classrooms, courses, people, holidays] = await Promise.all([
    loadLists(inst),
    list(inst, PM.faculty),
    list(inst, PM.programType),
    list(inst, PM.program),
    list(inst, PM.term),
    list(inst, PM.schedule),
    campusOfClassrooms(inst),
    prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true, credits: true } }),
    accountNames(inst),
    list(inst, "SYS:HOLIDAY"),
  ]);
  const termLabel = new Map(terms.map((t) => [t.id, s(t.data.name)]));
  const programLabel = new Map(programs.map((p) => [p.id, s(p.data.abbreviation) || s(p.data.name)]));
  return {
    entities: Object.fromEntries(Object.entries(ENTITIES).map(([k, e]) => [k, { label: e.label, fields: e.fields }])),
    lists,
    faculties: faculties.sort(byName).map((r) => ({ id: r.id, label: s(r.data.name), active: s(r.data.active) })),
    programTypes: types.sort((x, y) => order(x.data) - order(y.data)).map((r) => ({ id: r.id, label: s(r.data.name), active: s(r.data.active) })),
    programs: programs.sort(byName).map((r) => ({ id: r.id, label: s(r.data.name), abbreviation: s(r.data.abbreviation), facultyId: s(r.data.faculty), scheduleType: s(r.data.scheduleType), active: s(r.data.active) })),
    terms: terms
      .sort((x, y) => s(y.data.startDate).localeCompare(s(x.data.startDate)))
      .map((r) => ({ id: r.id, label: s(r.data.name), abbreviation: s(r.data.abbreviation), startDate: s(r.data.startDate), endDate: s(r.data.endDate) })),
    schedules: schedules.map((r) => ({ id: r.id, label: r.data._kind === "term" ? `Term: ${termLabel.get(s(r.data.term)) ?? ""}` : `${s(r.data.abbreviation)} (${programLabel.get(s(r.data.program)) ?? ""})` })),
    classrooms,
    courses: courses.map((c) => ({ id: c.id, label: `${c.code}: ${c.title}`, code: c.code, title: c.title, credits: c.credits })),
    staff: people.filter((p) => /instructor|admin|registrar|advisor|staff|faculty/i.test(p.roles)).map(({ id, label }) => ({ id, label })),
    holidays: holidays.map((h) => ({ name: s(h.data.name), date: s(h.data.date) })).filter((h) => h.date),
    weekdays: WEEKDAYS,
    bulkCategories: BULK_CATEGORIES,
    passFailRows: PASS_FAIL_ROWS,
  };
}

/* ------------------------------------------------------------------ */
/* Generic CRUD                                                         */
/* ------------------------------------------------------------------ */

const isSchedule = (e: EntityKey) => e === "programSchedules" || e === "termSchedules";

async function parentScreenOf(def: EntityDef) {
  if (!def.parent) return null;
  return def.parent.entity === "schedule" ? PM.schedule : ENTITIES[def.parent.entity].screen;
}

async function decorate(inst: string, entity: EntityKey, recs: Rec[]): Promise<Data[]> {
  if (!recs.length) return [];
  const names = async (screen: string) => new Map((await list(inst, screen)).map((r) => [r.id, s(r.data.name)]));
  if (entity === "programs") {
    const [fac, types] = await Promise.all([names(PM.faculty), names(PM.programType)]);
    return recs.map((r) => ({ _facultyLabel: fac.get(s(r.data.faculty)) ?? "", _typeLabel: types.get(s(r.data.programType)) ?? "" }));
  }
  if (entity === "fees" || entity === "scheduleFees") {
    const terms = await names(entity === "fees" ? PM.feeTerm : PM.scheduleFeeTerm);
    return recs.map((r) => ({ _termLabel: terms.get(s(r.data.feeTerm)) ?? "" }));
  }
  return recs.map(() => ({}));
}

function sortRecs(entity: EntityKey, recs: Rec[]) {
  const def = ENTITIES[entity];
  if (def.sortable) return recs.sort((x, y) => order(x.data) - order(y.data) || x.createdAt.getTime() - y.createdAt.getTime());
  if (entity === "terms" || entity === "calendars") return recs.sort((x, y) => s(y.data.startDate).localeCompare(s(x.data.startDate)));
  if (entity === "deadlines" || entity === "commissions") return recs;
  return recs.sort(byName);
}

const view = (r: Rec, extra: Data = {}): Data & { id: string; parentId: string; updatedAt: string } => ({ ...r.data, ...extra, id: r.id, parentId: r.contextKey, updatedAt: r.updatedAt.toISOString() });

export async function listEntity(user: SessionClaims, entity: EntityKey, opts: { parentId?: string; q?: string }) {
  await assertPermission(user, "programManagement", "view");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const parentScreen = await parentScreenOf(def);
  if (parentScreen) {
    if (!opts.parentId) throw httpError(400, `${def.parent!.label} is required`);
    await find(inst, parentScreen, opts.parentId, def.parent!.label);
  }
  let recs = await list(inst, def.screen, parentScreen ? opts.parentId : undefined);
  if (isSchedule(entity)) recs = recs.filter((r) => r.data._kind === (entity === "termSchedules" ? "term" : "program"));
  const needle = lc(opts.q);
  if (needle) recs = recs.filter((r) => def.search.some((k) => lc(r.data[k]).includes(needle)));
  recs = sortRecs(entity, recs);
  const extras = await decorate(inst, entity, recs);
  return { items: recs.map((r, i) => view(r, extras[i])), total: recs.length };
}

export async function getEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, "programManagement", "view");
  const def = ENTITIES[entity];
  const rec = await find(user.institutionId, def.screen, id, def.label);
  const [extra] = await decorate(user.institutionId, entity, [rec]);
  return view(rec, extra);
}

export function uniqueClash(def: Pick<EntityDef, "unique">, all: Array<Pick<Rec, "id" | "contextKey" | "data">>, data: Data, parentKey: string, exceptId?: string) {
  for (const u of def.unique) {
    const v = lc(data[u.key]);
    if (!v) continue;
    const clash = all.find((r) => r.id !== exceptId && (u.scope === "all" || r.contextKey === parentKey) && (!u.within || s(r.data[u.within]) === s(data[u.within])) && lc(r.data[u.key]) === v);
    if (clash) return u.key === "term" ? "A term schedule already exists for this term" : `${u.label} "${s(data[u.key])}" is already in use${u.scope === "parent" || u.within ? " here" : ""}`;
  }
  return null;
}

async function assertUnique(inst: string, def: EntityDef, data: Data, parentKey: string, exceptId?: string) {
  if (!def.unique.length) return;
  const clash = uniqueClash(def, await list(inst, def.screen), data, parentKey, exceptId);
  if (clash) throw httpError(409, clash, "CONFLICT");
}

function dateOrder(data: Data, from: string, to: string, label: string) {
  if (s(data[from]) && s(data[to]) && s(data[to]) < s(data[from])) throw httpError(400, label);
}

async function validateCross(inst: string, entity: EntityKey, data: Data) {
  if (entity === "terms") {
    dateOrder(data, "startDate", "endDate", "End Date must be on or after the Start Date");
    dateOrder(data, "examStartDate", "examEndDate", "Exam End Date must be on or after the Exam Start Date");
    for (const [i, c] of arr(data.enrolmentConditions).entries()) {
      const row = c as Data;
      if (row.customEnd && s(row.enrolEnd) < s(row.enrolStart)) throw httpError(400, `Enrolment condition ${i + 1}: Enrolment Deadline must be after the Enrolment Start Date`);
    }
  }
  if (entity === "calendars" || entity === "sessions") dateOrder(data, "startDate", "endDate", "End Date must be on or after the Start Date");
  if (entity === "commissions") {
    if (data.calculation === "Percentage" && (Number(data.domestic) > 100 || Number(data.international) > 100)) throw httpError(400, "Percentage commission rates must be 100% or less");
    if (data.condition === "Number of Courses" && Number(data.courseTo) < Number(data.courseFrom)) throw httpError(400, "Course Range: To must not be less than From");
  }
  if (entity === "sessions" && s(data.classroom)) {
    const room = (await campusOfClassrooms(inst)).find((r) => r.id === s(data.classroom));
    if (!room) throw httpError(400, "Classroom: the selected classroom is inactive or no longer exists");
    if (!data.campus || data.campus === "Not Set") data.campus = room.campus;
    else if (room.campus && room.campus !== data.campus) throw httpError(400, `Classroom ${room.name} belongs to ${room.campus}, not ${s(data.campus)}`);
    if (data.sameAsClassroom) data.maxEnrolments = room.size;
  }
}

async function nextOrder(inst: string, screen: string, parentKey: string) {
  const sib = await list(inst, screen, parentKey);
  return sib.reduce((m, r) => Math.max(m, typeof r.data._order === "number" ? r.data._order : -1), -1) + 1;
}

/** Fee-term "Term Order": "top", "bottom" or the id of the term to place it after. */
async function placeFeeTerm(inst: string, actorId: string, screen: string, parentKey: string, id: string, position: string) {
  const sib = (await list(inst, screen, parentKey)).sort((x, y) => order(x.data) - order(y.data));
  const others = sib.filter((r) => r.id !== id);
  const at = position === "top" ? 0 : position && position !== "bottom" ? others.findIndex((r) => r.id === position) + 1 : others.length;
  const ids = [...others.map((r) => r.id)];
  ids.splice(at < 0 ? others.length : at, 0, id);
  for (const [i, rid] of ids.entries()) {
    const r = sib.find((x) => x.id === rid);
    if (r && r.data._order !== i) await write(actorId, rid, { ...r.data, _order: i });
  }
}

function keyLabel(entity: EntityKey, data: Data) {
  return s(data.name) || s(data.sessionName) || s(data.label) || s(data.ledgerType) || s(data.abbreviation) || s(data.type) || ENTITIES[entity].label;
}

async function sessionLabel(inst: string, data: Data, schedule: Rec | null) {
  if (s(data.sessionName)) return s(data.sessionName);
  const course = await prisma.course.findFirst({ where: { id: s(data.course), institutionId: inst }, select: { code: true } });
  return [s(schedule?.data.abbreviation), course?.code, String(data._number ?? 1).padStart(2, "0")].filter(Boolean).join(" ");
}

/** Active schedule sessions are backed by a real Section (see programs.sections.ts); keeps the link on the record. */
async function linkSessionSection(user: SessionClaims, sessionId: string, schedule: Rec | null) {
  const rec = await find(user.institutionId, PM.session, sessionId, "Session");
  if (rec.data._status !== "active") return null;
  const out = await syncSessionSection(user, rec, s(schedule?.data.abbreviation));
  if (!out) return null;
  if (out.sectionId !== s(rec.data._sectionId) || (!s(rec.data.gradingScheme) && out.gradingScheme))
    await write(user.accountId, rec.id, { ...rec.data, _sectionId: out.sectionId, gradingScheme: s(rec.data.gradingScheme) || out.gradingScheme }, rec.contextKey);
  return out.sectionId;
}

export async function linkScheduleSections(user: SessionClaims, scheduleId: string) {
  const schedule = await find(user.institutionId, PM.schedule, scheduleId, "Schedule");
  for (const r of await list(user.institutionId, PM.session, scheduleId)) if (r.data._status === "active") await linkSessionSection(user, r.id, schedule);
}

export async function createEntity(user: SessionClaims, entity: EntityKey, body: Data & { parentId?: string; position?: string }) {
  await assertPermission(user, "programManagement", "edit");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const parentScreen = await parentScreenOf(def);
  let parent: Rec | null = null;
  if (parentScreen) {
    if (!body.parentId) throw httpError(400, `${def.parent!.label} is required`);
    parent = await find(inst, parentScreen, s(body.parentId), def.parent!.label);
  }
  const parentKey = parent?.id ?? "";
  let input: Data = body;
  if (entity === "sessions" && parent?.data._kind === "term") input = { ...body, term: parent.data.term };
  if (entity === "sessions" && parent?.data._kind === "program" && !arr(body.instructors).map(s).filter(Boolean).length) {
    const programId = s(parent.data.program);
    const program = programId ? await find(inst, PM.program, programId, "Program") : null;
    const instructors = program ? arr(program.data.instructors).map(s).filter(Boolean) : [];
    if (instructors.length) input = { ...input, instructors };
  }
  const data = await clean(def.fields, input, {}, ctxFor(inst, parentKey));
  await validateCross(inst, entity, data);
  const ctxKey = entity === "programs" ? s(data.faculty) : parentKey;
  await assertUnique(inst, def, data, ctxKey);
  if (def.sortable) data._order = await nextOrder(inst, def.screen, ctxKey);
  if (isSchedule(entity)) {
    data._kind = entity === "termSchedules" ? "term" : "program";
    data._status = entity === "termSchedules" ? "draft" : "active";
    data._removed = 0;
  }
  if (entity === "sessions") {
    const sib = await list(inst, PM.session, parentKey);
    data._number = sib.filter((r) => r.data.course === data.course).reduce((m, r) => Math.max(m, Number(r.data._number) || 0), 0) + 1;
    data._origin = "new";
    data._status = parent?.data._kind === "program" ? "active" : "pending";
  }
  if (entity === "programs") data._prismaId = await syncProgram(inst, undefined, data);
  if (entity === "terms") data._prismaId = await syncTerm(inst, undefined, data);
  const rec = await insert(inst, user.accountId, def.screen, data, ctxKey);
  if ((entity === "feeTerms" || entity === "scheduleFeeTerms") && body.position) await placeFeeTerm(inst, user.accountId, def.screen, ctxKey, rec.id, s(body.position));
  if (entity === "pathways" && data.defaultOutline) await clearOtherDefaults(inst, user.accountId, ctxKey, rec.id);
  if (entity === "programSchedules") await copyProgramFees(inst, user.accountId, s(data.program), rec.id);
  const sectionId = entity === "sessions" ? await linkSessionSection(user, rec.id, parent) : null;
  await audit(user, def.audit, entity === "programs" ? rec.id : ctxKey, `create ${def.label.toLowerCase()}`, { recordId: rec.id, after: sectionId ? { ...data, _sectionId: sectionId } : data });
  const label = entity === "sessions" ? await sessionLabel(inst, data, parent) : keyLabel(entity, data);
  return { ok: true, id: rec.id, ...(sectionId ? { sectionId } : {}), message: `${def.label.replace(/^\w/, (c) => c.toUpperCase())} "${label}" saved` };
}

async function clearOtherDefaults(inst: string, actorId: string, programId: string, keepId: string) {
  for (const r of await list(inst, PM.pathway, programId)) if (r.id !== keepId && r.data.defaultOutline) await write(actorId, r.id, { ...r.data, defaultOutline: false });
}

/** A new program master schedule starts from the program's default fee list (a one-time copy, not a live link). */
async function copyProgramFees(inst: string, actorId: string, programId: string, scheduleId: string) {
  const terms = (await list(inst, PM.feeTerm, programId)).sort((x, y) => order(x.data) - order(y.data));
  const map = new Map<string, string>();
  for (const t of terms) {
    const { rateScope: _r, rateCategories: _c, ...rest } = t.data;
    void _r;
    void _c;
    map.set(t.id, (await insert(inst, actorId, PM.scheduleFeeTerm, rest, scheduleId)).id);
  }
  for (const fee of (await list(inst, PM.fee, programId)).sort((x, y) => order(x.data) - order(y.data)))
    await insert(inst, actorId, PM.scheduleFee, { ...fee.data, feeTerm: map.get(s(fee.data.feeTerm)) ?? "" }, scheduleId);
}

export async function updateEntity(user: SessionClaims, entity: EntityKey, id: string, body: Data & { position?: string }) {
  await assertPermission(user, "programManagement", "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  if (isSchedule(entity) && rec.data._kind !== (entity === "termSchedules" ? "term" : "program")) throw httpError(400, "Schedule type does not match");
  let input: Data = body;
  let parent: Rec | null = null;
  if (entity === "sessions") {
    parent = await find(inst, PM.schedule, rec.contextKey, "Schedule");
    input = { ...body, course: rec.data.course, ...(parent.data._kind === "term" ? { term: parent.data.term } : {}) };
  }
  if (entity === "pathwayCourses") input = { ...body, course: rec.data.course };
  const data = await clean(def.fields, input, rec.data, ctxFor(inst, entity === "programs" ? "" : rec.contextKey));
  await validateCross(inst, entity, data);
  const ctxKey = entity === "programs" ? s(data.faculty) : rec.contextKey;
  await assertUnique(inst, def, data, ctxKey, id);
  if (entity === "programs") data._prismaId = await syncProgram(inst, id, data);
  if (entity === "terms") data._prismaId = await syncTerm(inst, id, data);
  if (entity === "sessions" && parent?.data._kind === "term" && rec.data._status === "active") data._changed = true;
  await write(user.accountId, id, data, ctxKey);
  if ((entity === "feeTerms" || entity === "scheduleFeeTerms") && body.position) await placeFeeTerm(inst, user.accountId, def.screen, ctxKey, id, s(body.position));
  if (entity === "pathways" && data.defaultOutline) await clearOtherDefaults(inst, user.accountId, ctxKey, id);
  if (entity === "sessions" && parent?.data._kind === "program") await linkSessionSection(user, id, parent);
  await audit(user, def.audit, entity === "programs" ? id : ctxKey, `update ${def.label.toLowerCase()}`, { recordId: id, before: rec.data, after: data });
  const label = entity === "sessions" ? await sessionLabel(inst, data, parent) : keyLabel(entity, data);
  return { ok: true, id, message: `${def.label.replace(/^\w/, (c) => c.toUpperCase())} "${label}" saved` };
}

export async function reorderEntity(user: SessionClaims, entity: EntityKey, ids: string[]) {
  await assertPermission(user, "programManagement", "edit");
  const def = ENTITIES[entity];
  if (!def.sortable) throw httpError(400, `${def.label} records cannot be reordered`);
  const recs = await prisma.heritageRecord.findMany({ where: { id: { in: ids }, institutionId: user.institutionId, screenId: def.screen, deletedAt: null } });
  if (recs.length !== ids.length || new Set(recs.map((r) => r.contextKey)).size > 1) throw httpError(400, "Some records could not be reordered");
  for (const [i, rid] of ids.entries()) {
    const r = recs.find((x) => x.id === rid)!;
    await write(user.accountId, rid, { ...parse(r.dataJson), _order: i });
  }
  await audit(user, def.audit, recs[0]?.contextKey ?? "", `reorder ${def.label.toLowerCase()}s`, { note: `${ids.length} record(s)` });
  return { ok: true, message: "Order saved" };
}

async function childrenOfPathway(inst: string, pathwayId: string) {
  const out: string[] = [];
  for (const sc of [PM.pathwayCourse, PM.tier, PM.electiveGroup, PM.elective]) out.push(...(await list(inst, sc, pathwayId)).map((r) => r.id));
  return out;
}

export async function deleteEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, "programManagement", "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  const name = keyLabel(entity, rec.data);
  const cascade: string[] = [];
  const block = (msg: string) => {
    throw httpError(409, msg, "CONFLICT");
  };
  if (entity === "faculties") {
    const programs = await list(inst, PM.program, id);
    if (programs.length) block(`The faculty "${name}" cannot be deleted while programs, categories and/or students are assigned to it (${programs.length} program${programs.length === 1 ? "" : "s"}).`);
  }
  if (entity === "programTypes") {
    const usedBy = (await list(inst, PM.program)).filter((p) => p.data.programType === id);
    if (usedBy.length) block(`The program type "${name}" is used by ${usedBy.length} program${usedBy.length === 1 ? "" : "s"} (${usedBy.slice(0, 3).map((p) => s(p.data.abbreviation) || s(p.data.name)).join(", ")}${usedBy.length > 3 ? ", …" : ""}). Change their Program Type first.`);
  }
  if (entity === "programs") {
    const { students, schedules } = await programUsage(inst, rec);
    if (students || schedules) block(`The program "${name}" cannot be deleted while ${students} student record(s) and ${schedules} schedule record(s) are assigned to it.`);
    for (const pw of await list(inst, PM.pathway, id)) cascade.push(pw.id, ...(await childrenOfPathway(inst, pw.id)));
    for (const sc of [PM.feeTerm, PM.fee, PM.deadline, PM.commission]) cascade.push(...(await list(inst, sc, id)).map((r) => r.id));
  }
  if (entity === "pathways") cascade.push(...(await childrenOfPathway(inst, id)));
  if (entity === "tiers") for (const c of (await list(inst, PM.pathwayCourse, rec.contextKey)).filter((c) => c.data.tier === id)) await write(user.accountId, c.id, { ...c.data, tier: "" });
  if (entity === "electiveGroups") for (const e of (await list(inst, PM.elective, rec.contextKey)).filter((e) => e.data.group === id)) await write(user.accountId, e.id, { ...e.data, group: "" });
  if (entity === "feeTerms" || entity === "scheduleFeeTerms") {
    const feeScreen = entity === "feeTerms" ? PM.fee : PM.scheduleFee;
    for (const fee of (await list(inst, feeScreen, rec.contextKey)).filter((x) => x.data.feeTerm === id)) await write(user.accountId, fee.id, { ...fee.data, feeTerm: "" });
  }
  if (entity === "terms") {
    const used = (await list(inst, PM.schedule)).filter((sch) => sch.data.term === id);
    if (used.length) block(`The term "${name}" is used by a term schedule. Delete the schedule first.`);
    const prismaId = s(rec.data._prismaId);
    if (prismaId) {
      const sections = await prisma.section.count({ where: { institutionId: inst, termId: prismaId } });
      if (sections) block(`The term "${name}" cannot be deleted while ${sections} course section(s) are scheduled in it.`);
      await prisma.term.deleteMany({ where: { id: prismaId, institutionId: inst } }).catch(() => undefined);
    }
  }
  if (isSchedule(entity)) for (const sc of [PM.session, PM.scheduleFeeTerm, PM.scheduleFee]) cascade.push(...(await list(inst, sc, id)).map((r) => r.id));
  if (entity === "sessions") {
    const sch = await find(inst, PM.schedule, rec.contextKey, "Schedule");
    if (sch.data._status === "draft" && rec.data._origin === "copied") await write(user.accountId, sch.id, { ...sch.data, _removed: (Number(sch.data._removed) || 0) + 1 });
  }
  const linkedSections =
    entity === "sessions"
      ? [s(rec.data._sectionId)]
      : isSchedule(entity)
        ? (await list(inst, PM.session, id)).map((r) => s(r.data._sectionId))
        : [];
  const protectedSections: Array<{ sectionId: string; reasons: string[] }> = [];
  for (const sectionId of [...new Set(linkedSections.filter(Boolean))]) {
    const reasons = await sessionSectionRemovalBlockers(inst, sectionId);
    if (reasons.length) protectedSections.push({ sectionId, reasons });
  }
  if (protectedSections.length) {
    const details = protectedSections
      .slice(0, 3)
      .map((row) => row.reasons.join(", "))
      .join("; ");
    const noun = entity === "sessions" ? "course session" : "schedule";
    block(
      `The ${noun} cannot be deleted because its linked course offering contains ${details}. Remove or formally withdraw the dependent records first. Nothing was deleted.`,
    );
  }
  await remove(inst, user.accountId, [id, ...cascade]);
  for (const sectionId of linkedSections.filter(Boolean)) await releaseSessionSection(user, sectionId);
  if (entity === "programs" && s(rec.data._prismaId)) {
    const pid = s(rec.data._prismaId);
    const [cohorts, versions] = await Promise.all([prisma.cohort.count({ where: { programId: pid } }), prisma.programVersion.count({ where: { programId: pid } })]);
    if (!cohorts && !versions) await prisma.program.deleteMany({ where: { id: pid, institutionId: inst } }).catch(() => undefined);
  }
  await audit(user, def.audit, entity === "programs" ? id : rec.contextKey, `delete ${def.label.toLowerCase()}`, { recordId: id, before: rec.data, note: cascade.length ? `${cascade.length} related record(s) removed` : undefined });
  return { ok: true, message: `${def.label.replace(/^\w/, (c) => c.toUpperCase())} "${name}" deleted` };
}

/* ------------------------------------------------------------------ */
/* Faculties & Programs directory                                       */
/* ------------------------------------------------------------------ */

export async function directory(user: SessionClaims) {
  await assertPermission(user, "programManagement", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const [faculties, programs] = await Promise.all([list(inst, PM.faculty), list(inst, PM.program)]);
  return {
    faculties: faculties.sort(byName).map((f) => ({
      id: f.id,
      name: s(f.data.name),
      abbreviation: s(f.data.abbreviation),
      active: s(f.data.active) || "Active",
      programs: programs
        .filter((p) => p.contextKey === f.id)
        .sort(byName)
        .map((p) => ({ id: p.id, name: s(p.data.name), abbreviation: s(p.data.abbreviation), active: s(p.data.active) || "Active" })),
    })),
  };
}

async function programUsage(inst: string, program: Rec) {
  const pid = s(program.data._prismaId);
  const [students, schedules] = await Promise.all([
    pid ? prisma.student.count({ where: { institutionId: inst, cohort: { programId: pid } } }) : Promise.resolve(0),
    list(inst, PM.schedule).then((rows) => rows.filter((r) => r.data.program === program.id).length),
  ]);
  return { students, schedules };
}

/* ------------------------------------------------------------------ */
/* Program Audit Changes: review / records / restore                    */
/* ------------------------------------------------------------------ */

const PROGRAM_FIELDS = ENTITIES.programs.fields;

function changedFields(before: Data, after: Data) {
  return PROGRAM_FIELDS.filter((f) => JSON.stringify(before[f.key] ?? null) !== JSON.stringify(after[f.key] ?? null));
}

async function formatter(inst: string) {
  const [fac, types, people] = await Promise.all([list(inst, PM.faculty), list(inst, PM.programType), accountNames(inst)]);
  const names = new Map([...fac, ...types].map((r) => [r.id, s(r.data.name)]));
  const person = new Map(people.map((p) => [p.id, p.label]));
  return (f: Field, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (f.kind === "ref") return names.get(s(v)) ?? "(deleted)";
    if (f.kind === "person") return person.get(s(v)) ?? "(user removed)";
    if (f.kind === "people") return arr(v).map((id) => person.get(s(id)) ?? "(user removed)").join(", ") || "—";
    if (f.kind === "bool") return v ? "Yes" : "No";
    if (f.kind === "multi") return arr(v).map(s).join(", ") || "—";
    if (f.kind === "rows") return `${arr(v).length} designation(s): ${arr(v).map((r) => s((r as Data).label)).join(", ")}`;
    return s(v);
  };
}

export async function programAudit(user: SessionClaims, programId: string) {
  await assertPermission(user, "programManagement", "view");
  const inst = user.institutionId;
  const program = await find(inst, PM.program, programId, "Program");
  const entries = await prisma.heritageAuditEntry.findMany({ where: { institutionId: inst, screenId: AUDIT_PROGRAM, recordId: programId }, orderBy: { createdAt: "desc" }, take: 200 });
  return {
    program: { id: program.id, name: s(program.data.name) },
    rows: entries.map((e, i) => {
      const before = parse(e.beforeJson);
      const after = parse(e.afterJson);
      const labels = changedFields(before, after).map((f) => f.label);
      const changes = e.action === "create program" ? "Program Created" : e.action === "restore program" ? `Restored: ${labels.join(", ") || "no field changes"}` : labels.join(", ") || "No field changes";
      return { id: e.id, date: e.createdAt.toISOString(), current: i === 0, changedBy: e.actorName || "System User", changes, canRestore: i > 0 && Boolean(e.afterJson) };
    }),
  };
}

export async function auditReview(user: SessionClaims, programId: string, entryId: string) {
  await assertPermission(user, "programManagement", "view");
  const inst = user.institutionId;
  await find(inst, PM.program, programId, "Program");
  const e = await prisma.heritageAuditEntry.findFirst({ where: { id: entryId, institutionId: inst, screenId: AUDIT_PROGRAM, recordId: programId } });
  if (!e) throw httpError(404, "Audit entry not found", "NOT_FOUND");
  const before = parse(e.beforeJson);
  const after = parse(e.afterJson);
  const fmt = await formatter(inst);
  const fields = e.action === "create program" ? PROGRAM_FIELDS.filter((f) => after[f.key] !== undefined && after[f.key] !== "" && !(Array.isArray(after[f.key]) && !arr(after[f.key]).length)) : changedFields(before, after);
  return {
    date: e.createdAt.toISOString(),
    changedBy: e.actorName || "System User",
    note: e.note ?? "",
    rows: fields.map((f) => ({ field: f.label, former: e.action === "create program" ? "—" : fmt(f, before[f.key]), updated: fmt(f, after[f.key]) })),
  };
}

export async function auditRecords(user: SessionClaims, programId: string) {
  await assertPermission(user, "programManagement", "view");
  const program = await find(user.institutionId, PM.program, programId, "Program");
  const usage = await programUsage(user.institutionId, program);
  return { ...usage, program: s(program.data.name) };
}

export async function auditRestore(user: SessionClaims, programId: string, entryId: string) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const rec = await find(inst, PM.program, programId, "Program");
  const e = await prisma.heritageAuditEntry.findFirst({ where: { id: entryId, institutionId: inst, screenId: AUDIT_PROGRAM, recordId: programId } });
  if (!e?.afterJson) throw httpError(404, "That version cannot be restored", "NOT_FOUND");
  const snapshot = parse(e.afterJson);
  const data = await clean(PROGRAM_FIELDS, snapshot, { _prismaId: rec.data._prismaId ?? "" }, ctxFor(inst));
  await assertUnique(inst, ENTITIES.programs, data, s(data.faculty), programId);
  data._prismaId = await syncProgram(inst, programId, data);
  await write(user.accountId, programId, data, s(data.faculty));
  const when = e.createdAt.toISOString().replace("T", " ").slice(0, 19);
  await audit(user, AUDIT_PROGRAM, programId, "restore program", { recordId: programId, before: rec.data, after: data, note: `Restored version from ${when}` });
  return { ok: true, message: `Program "${s(data.name)}" restored to the version from ${when}` };
}

/* ------------------------------------------------------------------ */
/* Program Pathway                                                      */
/* ------------------------------------------------------------------ */

async function weeklyFor(inst: string, courseIds: string[]) {
  const rows = courseIds.length ? await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: PM.courseSchedule, singletonKey: "weekly", contextKey: { in: courseIds }, deletedAt: null } }) : [];
  return new Map(rows.map((r) => [r.contextKey, (parse(r.dataJson).weekly as Data) ?? {}]));
}

export async function pathwayOutline(user: SessionClaims, pathwayId: string) {
  await assertPermission(user, "programManagement", "view");
  const inst = user.institutionId;
  const pathway = await find(inst, PM.pathway, pathwayId, "Program pathway");
  const program = await find(inst, PM.program, pathway.contextKey, "Program");
  const [courses, tiers, groups, electives] = await Promise.all([list(inst, PM.pathwayCourse, pathwayId), list(inst, PM.tier, pathwayId), list(inst, PM.electiveGroup, pathwayId), list(inst, PM.elective, pathwayId)]);
  const ids = uniq([...courses, ...electives].map((r) => s(r.data.course)));
  const catalog = await prisma.course.findMany({
    where: { id: { in: ids }, institutionId: inst },
    include: { prereqFor: { include: { prerequisiteCourse: { select: { code: true } } } } },
  });
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const weekly = await weeklyFor(inst, ids);
  const courseView = (r: Rec) => {
    const c = byId.get(s(r.data.course));
    return {
      id: r.id,
      courseId: s(r.data.course),
      code: c?.code ?? "(removed course)",
      title: c?.title ?? "",
      credits: c?.credits ?? 0,
      prerequisites: c ? c.prereqFor.map((p) => p.prerequisiteCourse.code).join(", ") : "",
      weekly: weekly.get(s(r.data.course)) ?? {},
    };
  };
  return {
    pathway: view(pathway),
    program: { id: program.id, name: s(program.data.name), abbreviation: s(program.data.abbreviation), scheduleType: s(program.data.scheduleType) },
    courses: courses.sort((x, y) => order(x.data) - order(y.data)).map((r) => ({ ...courseView(r), hours: r.data.hours ?? null, tier: s(r.data.tier) })),
    tiers: tiers.sort((x, y) => order(x.data) - order(y.data)).map((r) => view(r)),
    groups: groups.sort(byName).map((r) => view(r)),
    electives: electives.map((r) => ({ ...courseView(r), group: s(r.data.group) })),
  };
}

export async function addPathwayCourses(user: SessionClaims, pathwayId: string, body: { courseIds: string[]; group?: { mode: "none" | "existing" | "new"; tier?: string; name?: string } }) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  await find(inst, PM.pathway, pathwayId, "Program pathway");
  const ids = uniq(body.courseIds.map(s));
  if (!ids.length) throw httpError(400, "Select at least one course and click Add before saving");
  const found = await prisma.course.findMany({ where: { id: { in: ids }, institutionId: inst }, select: { id: true } });
  if (found.length !== ids.length) throw httpError(400, "Some selected courses no longer exist");
  let tier = "";
  const g = body.group;
  if (g?.mode === "existing") {
    if (!(await refOk(ctxFor(inst, pathwayId), "tiers", s(g.tier)))) throw httpError(400, "Select an existing group");
    tier = s(g.tier);
  } else if (g?.mode === "new") {
    const name = s(g.name).trim();
    if (!name) throw httpError(400, "Enter a name for the new group");
    await assertUnique(inst, ENTITIES.tiers, { name }, pathwayId);
    tier = (await insert(inst, user.accountId, PM.tier, { ...defaults(ENTITIES.tiers.fields), name, _order: await nextOrder(inst, PM.tier, pathwayId) }, pathwayId)).id;
  }
  const existing = new Set((await list(inst, PM.pathwayCourse, pathwayId)).map((r) => s(r.data.course)));
  let next = await nextOrder(inst, PM.pathwayCourse, pathwayId);
  let added = 0;
  for (const cid of ids) {
    if (existing.has(cid)) continue;
    await insert(inst, user.accountId, PM.pathwayCourse, { course: cid, tier, hours: null, _order: next++ }, pathwayId);
    added++;
  }
  await audit(user, "PR04", pathwayId, "add pathway courses", { note: `${added} course(s) added` });
  return { ok: true, message: added ? `${added} course${added === 1 ? "" : "s"} added to the program pathway` : "Those courses are already in this pathway" };
}

export async function copyPathway(user: SessionClaims, pathwayId: string, body: Data & { copyElectives?: boolean }) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const src = await find(inst, PM.pathway, pathwayId, "Program pathway");
  const data = await clean(ENTITIES.pathways.fields, body, {}, ctxFor(inst, src.contextKey));
  await assertUnique(inst, ENTITIES.pathways, data, src.contextKey);
  const copy = await insert(inst, user.accountId, PM.pathway, data, src.contextKey);
  if (data.defaultOutline) await clearOtherDefaults(inst, user.accountId, src.contextKey, copy.id);
  const tierMap = new Map<string, string>();
  for (const t of await list(inst, PM.tier, pathwayId)) tierMap.set(t.id, (await insert(inst, user.accountId, PM.tier, t.data, copy.id)).id);
  for (const c of await list(inst, PM.pathwayCourse, pathwayId)) await insert(inst, user.accountId, PM.pathwayCourse, { ...c.data, tier: tierMap.get(s(c.data.tier)) ?? "" }, copy.id);
  if (body.copyElectives) {
    const groupMap = new Map<string, string>();
    for (const g of await list(inst, PM.electiveGroup, pathwayId)) groupMap.set(g.id, (await insert(inst, user.accountId, PM.electiveGroup, g.data, copy.id)).id);
    for (const e of await list(inst, PM.elective, pathwayId)) await insert(inst, user.accountId, PM.elective, { ...e.data, group: groupMap.get(s(e.data.group)) ?? "" }, copy.id);
  }
  await audit(user, "PR06", src.contextKey, "copy program pathway", { recordId: copy.id, after: data, note: `Copied from ${s(src.data.name)}` });
  return { ok: true, id: copy.id, message: `Program pathway "${s(data.name)}" copied from "${s(src.data.name)}"` };
}

export async function addElectives(user: SessionClaims, pathwayId: string, body: { group?: string; courseIds: string[] }) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  await find(inst, PM.pathway, pathwayId, "Program pathway");
  const ids = uniq(body.courseIds.map(s));
  if (!ids.length) throw httpError(400, "Select at least one elective course");
  const group = s(body.group);
  if (group && !(await refOk(ctxFor(inst, pathwayId), "electiveGroups", group))) throw httpError(400, "Elective Group: the selected group no longer exists");
  const found = await prisma.course.count({ where: { id: { in: ids }, institutionId: inst } });
  if (found !== ids.length) throw httpError(400, "Some selected courses no longer exist");
  const existing = new Set((await list(inst, PM.elective, pathwayId)).map((r) => s(r.data.course)));
  let added = 0;
  for (const cid of ids) {
    if (existing.has(cid)) continue;
    await insert(inst, user.accountId, PM.elective, { course: cid, group }, pathwayId);
    added++;
  }
  await audit(user, "PR12", pathwayId, "add electives", { note: `${added} elective(s)` });
  return { ok: true, message: added ? `${added} elective${added === 1 ? "" : "s"} saved` : "Those courses are already electives in this outline" };
}

export async function saveCourseSchedule(user: SessionClaims, courseId: string, body: Data) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const course = await prisma.course.findFirst({ where: { id: courseId, institutionId: inst } });
  if (!course) throw httpError(404, "Course not found", "NOT_FOUND");
  const weeklyField = ENTITIES.sessions.fields.find((f) => f.key === "weekly")!;
  const cleaned = await clean([weeklyField], body, {}, ctxFor(inst));
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PM.courseSchedule, contextKey: courseId, singletonKey: "weekly" } });
  const before = row ? parse(row.dataJson) : {};
  if (row) await write(user.accountId, row.id, cleaned);
  else await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: PM.courseSchedule, contextKey: courseId, singletonKey: "weekly", dataJson: JSON.stringify(cleaned), createdById: user.accountId, updatedById: user.accountId } });
  const pathways = await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: PM.pathwayCourse, deletedAt: null, dataJson: { contains: courseId } } });
  await audit(user, "PR05", courseId, "edit course schedule", { before, after: cleaned });
  return { ok: true, message: `Schedule for ${course.code} saved — updated in ${pathways} program pathway${pathways === 1 ? "" : "s"}` };
}

/* ------------------------------------------------------------------ */
/* Master Scheduling                                                    */
/* ------------------------------------------------------------------ */

type Slot = { day: string; start: string; end: string };
const slotsOf = (w: unknown): Slot[] => {
  const src = w && typeof w === "object" ? (w as Data) : {};
  return WEEKDAYS.flatMap((day) => {
    const e = src[day] as Data | undefined;
    return e && s(e.start) && s(e.end) ? [{ day, start: s(e.start), end: s(e.end) }] : [];
  });
};
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};

async function scheduleContext(inst: string) {
  const [schedules, sessions, terms, programs, rooms, people, courses] = await Promise.all([
    list(inst, PM.schedule),
    list(inst, PM.session),
    list(inst, PM.term),
    list(inst, PM.program),
    campusOfClassrooms(inst),
    accountNames(inst),
    prisma.course.findMany({ where: { institutionId: inst }, select: { id: true, code: true, title: true } }),
  ]);
  return {
    schedules,
    sessions,
    term: new Map(terms.map((t) => [t.id, t])),
    program: new Map(programs.map((p) => [p.id, p])),
    room: new Map(rooms.map((r) => [r.id, r])),
    person: new Map(people.map((p) => [p.id, p.label])),
    course: new Map(courses.map((c) => [c.id, c])),
  };
}
type SchedCtx = Awaited<ReturnType<typeof scheduleContext>>;

function scheduleCode(sch: Rec, ctx: SchedCtx) {
  return sch.data._kind === "term" ? s(ctx.term.get(s(sch.data.term))?.data.abbreviation) || "TERM" : s(sch.data.abbreviation);
}

function sessionDates(sess: Rec, sch: Rec | undefined, ctx: SchedCtx) {
  const term = sch?.data._kind === "term" ? ctx.term.get(s(sch.data.term)) : s(sess.data.term) ? ctx.term.get(s(sess.data.term)) : undefined;
  return { start: s(sess.data.startDate) || s(term?.data.startDate), end: s(sess.data.endDate) || s(term?.data.endDate) };
}

/** Room or instructor double-bookings on the same weekday with overlapping times and dates. */
function conflictMap(ctx: SchedCtx) {
  const schedById = new Map(ctx.schedules.map((r) => [r.id, r]));
  const live = ctx.sessions.filter((r) => schedById.has(r.contextKey));
  const info = live.map((r) => {
    const sch = schedById.get(r.contextKey);
    const c = ctx.course.get(s(r.data.course));
    return {
      id: r.id,
      schedule: r.contextKey,
      room: s(r.data.classroom),
      people: arr(r.data.instructors).map(s),
      dates: sessionDates(r, sch, ctx),
      slots: slotsOf(r.data.weekly),
      label: `${c?.code ?? "Course"} ${sch ? scheduleCode(sch, ctx) : ""}-${String(r.data._number ?? 1).padStart(2, "0")}`,
    };
  });
  const out = new Map<string, string[]>();
  for (let i = 0; i < info.length; i++)
    for (let j = i + 1; j < info.length; j++) {
      const a = info[i]!;
      const b = info[j]!;
      const datesKnown = a.dates.start && a.dates.end && b.dates.start && b.dates.end;
      if (datesKnown ? !(a.dates.start <= b.dates.end && b.dates.start <= a.dates.end) : a.schedule !== b.schedule) continue;
      const room = a.room && a.room === b.room;
      const shared = a.people.filter((p) => b.people.includes(p));
      if (!room && !shared.length) continue;
      for (const sa of a.slots)
        for (const sb of b.slots) {
          if (sa.day !== sb.day || !(sa.start < sb.end && sb.start < sa.end)) continue;
          const what = room ? `Room ${ctx.room.get(a.room)?.name ?? ""}` : `Instructor ${shared.map((p) => ctx.person.get(p) ?? "").join(", ")}`;
          const when = `${sa.day.slice(0, 3)} ${fmtTime(sa.start > sb.start ? sa.start : sb.start)}`;
          out.set(a.id, [...(out.get(a.id) ?? []), `${what} also booked by ${b.label} (${when})`]);
          out.set(b.id, [...(out.get(b.id) ?? []), `${what} also booked by ${a.label} (${when})`]);
        }
    }
  return out;
}

function scheduleSummary(sch: Rec, ctx: SchedCtx) {
  const sess = ctx.sessions.filter((r) => r.contextKey === sch.id);
  let start = "";
  let end = "";
  if (sch.data._kind === "term") {
    const t = ctx.term.get(s(sch.data.term));
    start = s(t?.data.startDate);
    end = s(t?.data.endDate);
  } else
    for (const r of sess) {
      const d = sessionDates(r, sch, ctx);
      if (d.start && (!start || d.start < start)) start = d.start;
      if (d.end && (!end || d.end > end)) end = d.end;
    }
  const program = ctx.program.get(s(sch.data.program));
  const term = ctx.term.get(s(sch.data.term));
  return {
    id: sch.id,
    kind: s(sch.data._kind),
    status: s(sch.data._status),
    code: scheduleCode(sch, ctx),
    name: sch.data._kind === "term" ? s(term?.data.name) : s(program?.data.name),
    description: s(sch.data.description),
    programId: s(sch.data.program),
    programCode: s(program?.data.abbreviation),
    programName: s(program?.data.name),
    termName: s(term?.data.name),
    startDate: start,
    endDate: end,
    sessions: sess.length,
  };
}

export async function listSchedules(user: SessionClaims, opts: { program?: string }) {
  await assertPermission(user, "programManagement", "view");
  await ensureSeed(user);
  const ctx = await scheduleContext(user.institutionId);
  const rows = ctx.schedules
    .filter((r) => !opts.program || r.data.program === opts.program)
    .map((r) => scheduleSummary(r, ctx))
    .sort((x, y) => (y.startDate || "").localeCompare(x.startDate || "") || x.code.localeCompare(y.code));
  return { items: rows, total: rows.length };
}

export async function scheduleDetail(user: SessionClaims, id: string) {
  await assertPermission(user, "programManagement", "view");
  const inst = user.institutionId;
  const ctx = await scheduleContext(inst);
  const sch = ctx.schedules.find((r) => r.id === id);
  if (!sch) throw httpError(404, "Schedule not found", "NOT_FOUND");
  const conflicts = conflictMap(ctx);
  const code = scheduleCode(sch, ctx);
  const sessions = ctx.sessions
    .filter((r) => r.contextKey === id)
    .map((r) => {
      const c = ctx.course.get(s(r.data.course));
      const room = ctx.room.get(s(r.data.classroom));
      const d = sessionDates(r, sch, ctx);
      return {
        ...view(r),
        number: Number(r.data._number) || 1,
        offering: `${code}-${String(r.data._number ?? 1).padStart(2, "0")}`,
        courseCode: c?.code ?? "(removed course)",
        courseTitle: c?.title ?? "",
        classroomLabel: room ? room.label : "",
        location: [s(r.data.campus) === "Not Set" ? "" : s(r.data.campus), room?.name ? `Room ${room.name}` : ""].filter(Boolean).join(" · "),
        instructorNames: arr(r.data.instructors).map((p) => ctx.person.get(s(p)) ?? "(user removed)"),
        effectiveStart: d.start,
        effectiveEnd: d.end,
        conflicts: conflicts.get(r.id) ?? [],
      };
    })
    .sort((x, y) => x.courseCode.localeCompare(y.courseCode, undefined, { numeric: true }) || x.number - y.number);
  const raw = ctx.sessions.filter((r) => r.contextKey === id).map((r) => r.data);
  const pid = s(ctx.program.get(s(sch.data.program))?.data._prismaId);
  const enrolled = sch.data._kind === "program" && pid ? await prisma.student.count({ where: { institutionId: inst, cohort: { programId: pid } } }) : 0;
  const holidays = (await list(inst, "SYS:HOLIDAY")).map((h) => ({ name: s(h.data.name), date: s(h.data.date) })).filter((h) => h.date);
  return {
    schedule: { ...view(sch), ...scheduleSummary(sch, ctx), removed: Number(sch.data._removed) || 0 },
    sessions,
    counters: {
      totalCourses: new Set(raw.map((x) => s(x.course))).size,
      totalSessions: sessions.length,
      conflicts: sessions.filter((x) => x.conflicts.length).length,
      enrolledStudents: enrolled,
      pendingSessions: raw.filter((x) => x._status === "pending").length,
      pendingChanges: raw.filter((x) => x._changed === true).length,
      activeSessions: raw.filter((x) => x._status === "active").length,
      newSessions: raw.filter((x) => x._origin === "new" && x._status === "pending").length,
      copiedSessions: raw.filter((x) => x._origin === "copied" && x._status === "pending").length,
      removedSessions: Number(sch.data._removed) || 0,
    },
    holidays,
  };
}

export async function confirmSchedule(user: SessionClaims, id: string) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const sch = await find(inst, PM.schedule, id, "Schedule");
  const sessions = await list(inst, PM.session, id);
  let n = 0;
  for (const r of sessions)
    if (r.data._status !== "active" || r.data._changed) {
      await write(user.accountId, r.id, { ...r.data, _status: "active", _changed: false });
      n++;
    }
  await write(user.accountId, id, { ...sch.data, _status: "active", _removed: 0, _confirmedAt: new Date().toISOString() });
  await linkScheduleSections(user, id);
  await audit(user, "PR19", id, "confirm schedule", { note: `${n} session(s) activated` });
  return { ok: true, message: `Schedule confirmed — ${sessions.length} session${sessions.length === 1 ? "" : "s"} active` };
}

const ADD_SESSION_KEYS = ["campus", "classroom", "deliveryMethod", "instructors"] as const;

export async function addSessions(user: SessionClaims, scheduleId: string, body: Data) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const sch = await find(inst, PM.schedule, scheduleId, "Schedule");
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw httpError(400, "Number of Sessions must be between 1 and 20");
  const fields = ENTITIES.sessions.fields;
  const pick = fields.filter((f) => f.key === "course" || (ADD_SESSION_KEYS as readonly string[]).includes(f.key));
  const settings = await clean(pick, body, {}, ctxFor(inst, scheduleId));
  await validateCross(inst, "sessions", settings);
  const term = sch.data._kind === "term" ? await find(inst, PM.term, s(sch.data.term), "Term") : null;
  const base = {
    ...defaults(fields),
    ...settings,
    enableLms: s(sch.data.enableLms) || "Disabled",
    attendanceGrading: s(sch.data.attendanceGrading) || "Disabled",
    ...(term ? { term: term.id, startDate: s(term.data.startDate), endDate: s(term.data.endDate) } : {}),
  };
  const sib = await list(inst, PM.session, scheduleId);
  let num = sib.filter((r) => r.data.course === settings.course).reduce((m, r) => Math.max(m, Number(r.data._number) || 0), 0);
  for (let i = 0; i < count; i++) {
    const rec = await insert(inst, user.accountId, PM.session, { ...base, _number: ++num, _origin: "new", _status: sch.data._kind === "program" ? "active" : "pending" }, scheduleId);
    if (sch.data._kind === "program") await linkSessionSection(user, rec.id, sch);
  }
  const course = await prisma.course.findFirst({ where: { id: s(settings.course) }, select: { code: true } });
  await audit(user, "PR19", scheduleId, "add course sessions", { note: `${count} session(s) of ${course?.code ?? ""}` });
  return { ok: true, message: `${count} session${count === 1 ? "" : "s"} of ${course?.code ?? "the course"} added` };
}

export async function copySchedule(user: SessionClaims, id: string, body: Data) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const src = await find(inst, PM.schedule, id, "Schedule");
  const kind = src.data._kind === "term" ? "termSchedules" : "programSchedules";
  const def = ENTITIES[kind];
  const data = await clean(def.fields, { ...src.data, ...body }, {}, ctxFor(inst));
  await assertUnique(inst, def, data, "");
  let shift = 0;
  if (kind === "termSchedules") {
    const [from, to] = await Promise.all([find(inst, PM.term, s(src.data.term), "Term"), find(inst, PM.term, s(data.term), "Term")]);
    shift = Math.round((Date.parse(s(to.data.startDate)) - Date.parse(s(from.data.startDate))) / 86_400_000) || 0;
  }
  const move = (d: unknown) => (s(d) && shift ? new Date(Date.parse(s(d)) + shift * 86_400_000).toISOString().slice(0, 10) : s(d));
  const status = kind === "termSchedules" ? "draft" : "active";
  const copy = await insert(inst, user.accountId, PM.schedule, { ...data, _kind: src.data._kind, _status: status, _removed: 0, _copiedFrom: id }, "");
  for (const r of await list(inst, PM.session, id))
    await insert(
      inst,
      user.accountId,
      PM.session,
      { ...r.data, startDate: move(r.data.startDate), endDate: move(r.data.endDate), ...(kind === "termSchedules" ? { term: data.term } : {}), _origin: "copied", _status: kind === "termSchedules" ? "pending" : "active", _changed: false, _sectionId: "" },
      copy.id,
    );
  if (kind === "programSchedules") await linkScheduleSections(user, copy.id);
  const feeMap = new Map<string, string>();
  for (const t of await list(inst, PM.scheduleFeeTerm, id)) feeMap.set(t.id, (await insert(inst, user.accountId, PM.scheduleFeeTerm, t.data, copy.id)).id);
  for (const fee of await list(inst, PM.scheduleFee, id)) await insert(inst, user.accountId, PM.scheduleFee, { ...fee.data, feeTerm: feeMap.get(s(fee.data.feeTerm)) ?? "" }, copy.id);
  await audit(user, def.audit, copy.id, "copy schedule", { recordId: copy.id, note: `Copied from schedule ${id}` });
  return { ok: true, id: copy.id, kind: src.data._kind, message: "Schedule copied" };
}

const BULK_FIELDS: Record<string, string[]> = {
  "Change Dates": ["startDate", "endDate"],
  "Course Size / Limit": ["maxEnrolments"],
  "Delivery Method": ["deliveryMethod"],
  "LMS / Import Options": ["enableLms"],
  "Grading Scheme": ["gradingScheme"],
  "Instructor(s)": ["instructors"],
  "Location / Room": ["campus", "classroom"],
  "Wait List Settings": ["waitlist", "waitlistSize"],
};

export async function bulkUpdate(user: SessionClaims, scheduleId: string, body: { category: string; sessionIds: string[]; values: Data }) {
  await assertPermission(user, "programManagement", "edit");
  const inst = user.institutionId;
  const sch = await find(inst, PM.schedule, scheduleId, "Schedule");
  const keys = BULK_FIELDS[body.category];
  if (!keys) throw httpError(400, "Choose a Bulk Updates category");
  const ids = uniq(body.sessionIds.map(s));
  if (!ids.length) throw httpError(400, "Select at least one session");
  const sessions = (await list(inst, PM.session, scheduleId)).filter((r) => ids.includes(r.id));
  if (sessions.length !== ids.length) throw httpError(400, "Some selected sessions are no longer in this schedule");
  const fields = ENTITIES.sessions.fields;
  const patch = Object.fromEntries(keys.map((k) => [k, body.values[k]]));
  if (body.category === "Location / Room" && !s(patch.classroom)) patch.classroom = "";
  for (const r of sessions) {
    const data = await clean(fields, patch, r.data, ctxFor(inst, scheduleId));
    await validateCross(inst, "sessions", data);
    if (sch.data._kind === "term" && r.data._status === "active") data._changed = true;
    await write(user.accountId, r.id, data);
    if (sch.data._kind === "program" && r.data._status === "active") await linkSessionSection(user, r.id, sch);
  }
  await audit(user, "PR20", scheduleId, `bulk update: ${body.category.toLowerCase()}`, { after: patch, note: `${sessions.length} session(s)` });
  return { ok: true, message: `${body.category} updated on ${sessions.length} session${sessions.length === 1 ? "" : "s"}` };
}

/** Courses offered by the program behind a schedule (the PROGRAM SPECIFIC COURSES group in Add Session). */
export async function scheduleCourses(user: SessionClaims, scheduleId: string) {
  await assertPermission(user, "programManagement", "view");
  const inst = user.institutionId;
  const sch = await find(inst, PM.schedule, scheduleId, "Schedule");
  const programId = s(sch.data.program);
  const ids = new Set<string>();
  if (programId) for (const pw of await list(inst, PM.pathway, programId)) for (const c of await list(inst, PM.pathwayCourse, pw.id)) ids.add(s(c.data.course));
  return { programCourseIds: [...ids] };
}
