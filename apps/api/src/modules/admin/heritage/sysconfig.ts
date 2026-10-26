import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import { hashPassword } from "@myheritage/auth";
import type { SessionClaims } from "@myheritage/contracts";
import { assertPermission, canEdit, effectiveAccess, patchStudentMeta, studentMetaMap } from "../superAdmin.service.js";
import { audit, refs } from "./service.js";
import { bytesMatchMime, decodeBase64 } from "../../../lib/fileSniff.js";
import { encryptConfigSecret } from "../../../lib/configSecrets.js";
import {
  COLOURS,
  ENTITIES,
  NAV_ICONS,
  OUTCOME_ICONS,
  SEED_COUNTRIES,
  SEED_CORRESPONDENCE,
  SEED_CORRESPONDENCE_MISC,
  SEED_CURRENCIES,
  SEED_DOCUMENT_INPUTS,
  SEED_FORMS,
  SEED_HOLIDAYS_2026,
  SEED_LANGUAGES,
  SEED_PLUGINS,
  SEED_RUNNING_ELEMENTS,
  SEED_SECTIONS,
  SEED_SECURITY_QUESTIONS,
  SEED_STUDENT_STATUSES,
  SEED_TIMEZONES,
  SETTINGS,
  type Data,
  type EntityDef,
  type EntityKey,
  type Field,
  type SettingsKey,
} from "./sysconfig.spec.js";

export { ENTITIES, SETTINGS, type EntityKey, type SettingsKey };

const SETTINGS_SCREEN = "SYS:SETTINGS";
const FILE_SCREEN = "SYS:FILE";
const VERSION_SCREEN = "SYS:DOC_TPL_VER";
const ACCESS_LOG_SCREEN = "SYS:ACCESS_LOG";
const SEED_SCREEN = "SYS:SEED";
const SEED_VERSION = "1";

export type Rec = { id: string; contextKey: string; data: Data; createdAt: Date; updatedAt: Date; updatedById: string | null };

/** Rules owned by other modules (Financial Management) for entities served by this engine. */
export type EntityHooks = {
  validate?: (user: SessionClaims, data: Data, selfId: string | null) => Promise<void>;
  afterSave?: (user: SessionClaims, id: string, before: Data | null, after: Data) => Promise<void>;
  beforeDelete?: (user: SessionClaims, rec: Rec) => Promise<void>;
  decorate?: (user: SessionClaims, recs: Rec[]) => Promise<Data[]>;
};
const HOOKS: Partial<Record<EntityKey, EntityHooks>> = {};
const EXTRA_SEEDS: Array<{ key: string; run: (user: SessionClaims) => Promise<void> }> = [];
export function registerEntityHooks(map: Partial<Record<EntityKey, EntityHooks>>) {
  Object.assign(HOOKS, map);
}
/** One-time seed that runs (once per institution) the first time any configuration list is opened. */
export function registerSeed(key: string, run: (user: SessionClaims) => Promise<void>) {
  if (!EXTRA_SEEDS.some((x) => x.key === key)) EXTRA_SEEDS.push({ key, run });
}

const permOf = (entity: EntityKey) => ENTITIES[entity].perm ?? "systemConfiguration";

/** Meta and shared lists are needed by every module that edits records through this engine. */
async function assertAnyView(user: SessionClaims) {
  let last: unknown;
  for (const mod of ["systemConfiguration", "financialManagement", "agentManagement"] as const) {
    try {
      await assertPermission(user, mod, "view");
      return;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const parse = (json: string): Data => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Data) : {};
  } catch {
    return {};
  }
};
const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const lc = (v: unknown) => s(v).trim().toLowerCase();
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
const order = (d: Data) => (typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER);

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

async function list(inst: string, screen: string, contextKey?: string): Promise<Rec[]> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null, ...(contextKey !== undefined ? { contextKey } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt, updatedById: r.updatedById }));
}

async function find(inst: string, screen: string, id: string, label: string): Promise<Rec> {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return { id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt, updatedById: r.updatedById };
}

async function insert(inst: string, actorId: string, screen: string, data: Data, contextKey = "") {
  return prisma.heritageRecord.create({ data: { institutionId: inst, screenId: screen, contextKey, dataJson: JSON.stringify(data), createdById: actorId, updatedById: actorId } });
}

async function write(actorId: string, id: string, data: Data, contextKey?: string) {
  await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(data), updatedById: actorId, rowVersion: { increment: 1 }, ...(contextKey !== undefined ? { contextKey } : {}) } });
}

async function remove(actorId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.heritageRecord.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), updatedById: actorId, status: "deleted" } });
}

async function getSettingsRow(inst: string, key: string) {
  return prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: SETTINGS_SCREEN, contextKey: "", singletonKey: key } });
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?=.{3,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function applies(f: Field, d: Data) {
  if (!f.when) return true;
  const v = d[f.when.key];
  const hit = Array.isArray(f.when.equals) ? (f.when.equals as readonly unknown[]).includes(v) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (["multi", "multiList", "dual", "files", "refMulti", "people", "rows"].includes(f.kind)) return [];
  if (f.kind === "file" || f.kind === "number") return null;
  return "";
}

export function sanitizeHtml(html: string) {
  const blocked = "script|style|iframe|object|embed|link|meta|template|form|input|button|textarea|select|svg|math";
  return html
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${blocked})\\b[^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("|')\s*data:(?!image\/(png|jpe?g|gif|webp))[^"']*\2/gi, '$1="#"');
}

type Ctx = { inst: string; lists: () => Promise<Record<string, string[]>>; regions: () => Promise<Record<string, string[]>> };

async function refExists(inst: string, entity: EntityKey, id: string) {
  return (await prisma.heritageRecord.count({ where: { id, institutionId: inst, screenId: ENTITIES[entity].screen, deletedAt: null, singletonKey: null } })) > 0;
}

async function clean(fields: Field[], input: Data, base: Data, ctx: Ctx, prefix = ""): Promise<Data> {
  const out: Data = { ...base };
  for (const f of fields) {
    if (f.readonly && f.key in base) continue;
    if (f.key in input) out[f.key] = input[f.key];
    else if (!(f.key in out) && f.dflt !== undefined) out[f.key] = f.dflt;
  }
  const errors: string[] = [];
  const err = (f: Field, msg: string) => errors.push(`${prefix}${f.label} ${msg}`);
  for (const f of fields) {
    if (!applies(f, out)) {
      if (f.kind !== "secret" && f.kind !== "password") out[f.key] = f.dflt !== undefined ? f.dflt : emptyOf(f);
      continue;
    }
    const raw = out[f.key];
    switch (f.kind) {
      case "text":
      case "textarea":
      case "html":
      case "code":
      case "email":
      case "domain":
      case "select":
      case "radio":
      case "icon":
      case "date":
      case "time":
      case "color": {
        let v = s(raw).trim();
        const maxLen = f.kind === "html" ? 200_000 : f.kind === "code" ? 20_000 : f.kind === "textarea" ? 4000 : 200;
        if (v.length > maxLen) err(f, "is too long");
        if (f.kind === "html") v = sanitizeHtml(v);
        if (f.kind === "domain") v = v.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (!v) {
          if (f.required) err(f, "is required");
        } else if (f.kind === "email" && !EMAIL_RE.test(v)) err(f, "must be a valid e-mail address");
        else if (f.kind === "domain" && !DOMAIN_RE.test(v)) err(f, "must be a domain name such as txt.bell.ca");
        else if (f.kind === "date" && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) err(f, "must be a valid date");
        else if (f.kind === "time" && !TIME_RE.test(v)) err(f, "must be a time such as 09:30");
        else if (f.kind === "color" && !HEX_RE.test(v)) err(f, "must be a colour such as #1565c0");
        else if ((f.kind === "select" || f.kind === "radio" || f.kind === "icon") && f.options && !f.options.includes(v)) err(f, `: "${v}" is not a valid choice`);
        else if (f.kind === "select" && f.dependsOn) {
          const allowed = (await ctx.regions())[s(out[f.dependsOn])] ?? [];
          if (allowed.length && !allowed.includes(v)) err(f, `: "${v}" is not a region of ${s(out[f.dependsOn]) || "the selected country"}`);
        } else if (f.kind === "select" && f.dyn) {
          const allowed = [...(f.dynExtra ?? []), ...((await ctx.lists())[f.dyn] ?? [])];
          if (allowed.length && !allowed.includes(v)) err(f, `: "${v}" is not a valid choice`);
        }
        out[f.key] = v;
        break;
      }
      case "secret": {
        const v = s(raw);
        if (v.length > 500) err(f, "is too long");
        out[f.key] = v ? encryptConfigSecret(v) : s(base[f.key]);
        break;
      }
      case "password": {
        const v = s(raw);
        if (!v) {
          if (!base[f.key] && f.required) err(f, "is required");
          out[f.key] = s(base[f.key]);
          break;
        }
        if (v.length < 10 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) err(f, "must be at least 10 characters with letters and numbers");
        else if (v.length > 128) err(f, "is too long");
        else if (f.confirm && s(input[`${f.key}Confirm`]) !== v) errors.push(`${prefix}Confirm Password does not match ${f.label}`);
        else out[f.key] = await hashPassword(v);
        break;
      }
      case "number": {
        if (raw === "" || raw === null || raw === undefined) {
          if (f.required) err(f, "is required");
          out[f.key] = null;
          break;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) err(f, "must be a number");
        else if (f.integer && !Number.isInteger(n)) err(f, "must be a whole number");
        else if (f.min !== undefined && n < f.min) err(f, `must be at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) err(f, `must be at most ${f.max}`);
        out[f.key] = Number.isFinite(n) ? n : null;
        break;
      }
      case "bool":
        out[f.key] = raw === true || raw === "true" || raw === "Yes";
        break;
      case "multi":
      case "multiList":
      case "dual": {
        const vals = [...new Set(arr(raw).map((x) => s(x).trim()).filter(Boolean))];
        const allowed = f.options ? [...f.options] : f.dyn ? (await ctx.lists())[f.dyn] ?? [] : [];
        const bad = allowed.length ? vals.filter((x) => !allowed.includes(x)) : [];
        if (bad.length) err(f, `: invalid choice ${bad.slice(0, 3).join(", ")}`);
        if (f.required && !vals.length) err(f, ": select at least one");
        out[f.key] = vals.slice(0, 500);
        break;
      }
      case "ref": {
        const v = s(raw).trim();
        if (!v) {
          if (f.required) err(f, "is required");
          out[f.key] = "";
        } else if (!(await refExists(ctx.inst, f.ref!, v))) err(f, ": the selected item no longer exists");
        else out[f.key] = v;
        break;
      }
      case "refMulti": {
        const ids = [...new Set(arr(raw).map((x) => s(x)).filter(Boolean))].slice(0, 200);
        const found = ids.length ? await prisma.heritageRecord.count({ where: { id: { in: ids }, institutionId: ctx.inst, screenId: ENTITIES[f.ref!].screen, deletedAt: null } }) : 0;
        if (found !== ids.length) err(f, ": some selected items no longer exist");
        if (f.required && !ids.length) err(f, ": select at least one");
        out[f.key] = ids;
        break;
      }
      case "person":
      case "people": {
        const ids = (f.kind === "person" ? (s(raw) ? [s(raw)] : []) : [...new Set(arr(raw).map((x) => s(x)).filter(Boolean))]).slice(0, 200);
        const found = ids.length ? await prisma.account.count({ where: { id: { in: ids }, institutionId: ctx.inst } }) : 0;
        if (found !== ids.length) err(f, ": a selected user no longer exists");
        if (f.required && !ids.length) err(f, "is required");
        out[f.key] = f.kind === "person" ? (ids[0] ?? "") : ids;
        break;
      }
      case "file":
      case "files": {
        const items = (f.kind === "file" ? (raw ? [raw] : []) : arr(raw)) as Data[];
        const kept: Array<{ id: string; name: string; size: number; mime: string }> = [];
        for (const it of items.slice(0, 20)) {
          const id = s(it?.id);
          if (!id) continue;
          if (!(await prisma.heritageRecord.count({ where: { id, institutionId: ctx.inst, screenId: FILE_SCREEN, deletedAt: null } }))) {
            err(f, ": an attached file is no longer available, please upload it again");
            continue;
          }
          kept.push({ id, name: s(it.name).slice(0, 200), size: Number(it.size) || 0, mime: s(it.mime).slice(0, 120) });
        }
        if (f.required && !kept.length) err(f, "is required");
        out[f.key] = f.kind === "file" ? (kept[0] ?? null) : kept;
        break;
      }
      case "rows": {
        const rows = arr(raw).slice(0, 100) as Data[];
        const kept: Data[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] && typeof rows[i] === "object" ? rows[i]! : {};
          try {
            const cleaned = await clean(f.rowFields ?? [], row, {}, ctx, `${f.rowLabel ?? "Row"} ${i + 1}: `);
            kept.push({ id: s(row.id) || randomUUID(), ...cleaned });
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
        out[f.key] = kept;
        break;
      }
    }
  }
  for (const k of Object.keys(out)) if (!fields.some((x) => x.key === k)) delete out[k];
  if (errors.length) throw httpError(400, errors.join("; "));
  return out;
}

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function validateCross(entity: EntityKey, d: Data, self?: string) {
  const bad = (m: string) => {
    throw httpError(400, m);
  };
  if (entity === "holidays" && !d.singleDay && s(d.endDate) && s(d.endDate) < s(d.date)) bad("End Date must be on or after the Holiday / Closure Date");
  if (entity === "timezones") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: s(d.zone) });
    } catch {
      bad(`Time Zone "${s(d.zone)}" is not a recognised IANA identifier, e.g. America/Vancouver`);
    }
  }
  if (entity === "currencies") {
    d.code = s(d.code).toUpperCase();
    if (!/^[A-Z]{3}$/.test(s(d.code))) bad("Currency Code must be three letters, e.g. CAD");
    if (!/^\d{3}$/.test(s(d.iso))) bad("Currency ISO must be the three-digit ISO 4217 number, e.g. 124");
    if (s(d.unicode) && !/^[0-9a-f]{4,6}$/i.test(s(d.unicode))) bad("Currency Unicode must be a hex code point such as 0024");
    d.unicode = s(d.unicode).toUpperCase();
  }
  if (entity === "countries") {
    d.code = s(d.code).toUpperCase();
    d.iso = s(d.iso).toUpperCase();
    if (!/^[A-Z]{2}$/.test(s(d.code))) bad("Country Code must be two letters, e.g. CA");
    if (!/^[A-Z]{3}$/.test(s(d.iso))) bad("Country ISO must be three letters, e.g. CAN");
  }
  if (entity === "languages" && !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(s(d.code))) bad("Language Code must look like en, fr or pt-BR");
  if (entity === "documentInputs" && !/^[a-z0-9_]+$/.test(s(d.name))) bad("Input Name may only contain lowercase letters, numbers and underscores");
  if (entity === "serviceAccounts" && !/^[a-z0-9._-]{3,60}$/i.test(s(d.login))) bad("Account Login must be 3–60 letters, numbers, dots, dashes or underscores");
  if ((entity === "customEndpoints" && !URL_RE.test(s(d.url))) || (entity === "plugins" && s(d.endpoint) && !URL_RE.test(s(d.endpoint)))) bad("Enter a full URL starting with https://");
  if (entity === "sections" && s(d.url) && !URL_RE.test(s(d.url))) bad("Link URL must start with http:// or https://");
  if (entity === "studentStatuses" && self && s(d.parent) === self) bad("A status cannot be its own parent");
}

/* ------------------------------------------------------------------ */
/* Seed                                                                 */
/* ------------------------------------------------------------------ */

const seeding = new Map<string, Promise<void>>();
const VERSION_FIX = "2";

export async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  const keys = [SEED_VERSION, VERSION_FIX, ...EXTRA_SEEDS.map((x) => x.key)];
  const markers = await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: SEED_SCREEN, singletonKey: { in: keys } } });
  if (markers === keys.length) return;
  if (!seeding.has(inst)) seeding.set(inst, seedAll(user).finally(() => seeding.delete(inst)));
  await seeding.get(inst);
}

async function mark(inst: string, actorId: string, key: string) {
  await prisma.heritageRecord.upsert({
    where: { institutionId_screenId_contextKey_singletonKey: { institutionId: inst, screenId: SEED_SCREEN, contextKey: "", singletonKey: key } },
    create: { institutionId: inst, screenId: SEED_SCREEN, contextKey: "", singletonKey: key, dataJson: "{}", createdById: actorId, updatedById: actorId },
    update: {},
  });
}

async function seedAll(user: SessionClaims) {
  const inst = user.institutionId;
  const has = async (key: string) => (await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: SEED_SCREEN, singletonKey: key } })) > 0;
  if (!(await has(SEED_VERSION))) await seed(user);
  if (!(await has(VERSION_FIX))) {
    await fixSeededVersions(inst);
    await mark(inst, user.accountId, VERSION_FIX);
  }
  for (const extra of EXTRA_SEEDS) {
    if (await has(extra.key)) continue;
    await extra.run(user);
    await mark(inst, user.accountId, extra.key);
  }
}

/** The seeded "Template created" snapshot: before the header, footer and module paragraph were added. */
function originalTemplate(d: Data): Data {
  const content = s(d.content)
    .replace(/<p>\[\[Module:[^\]]*\]\]<\/p>/g, "")
    .replace(/ starting \{input:start_date\}/g, "");
  return { ...d, header: "None", headerElement: "", footer: "None", footerElement: "", content };
}

/** Versions seeded before `seq` existed were all stamped at once with identical snapshots. */
async function fixSeededVersions(inst: string) {
  for (const tpl of await list(inst, ENTITIES.documentTemplates.screen)) {
    const versions = await list(inst, VERSION_SCREEN, tpl.id);
    if (!versions.length || versions.some((v) => typeof v.data.seq === "number")) continue;
    const ordered = [...versions.filter(isFirstVersion), ...versions.filter((v) => !isFirstVersion(v))];
    const seeded = ordered.length > 1 && ordered.every((v) => s(v.data.by) === "System" && v.createdAt.getTime() === ordered[0]!.createdAt.getTime());
    for (const [i, v] of ordered.entries()) {
      const older = seeded && i < ordered.length - 1;
      const data = { ...v.data, seq: i + 1, ...(older ? { snapshot: originalTemplate((v.data.snapshot ?? {}) as Data) } : {}) };
      await prisma.heritageRecord.update({
        where: { id: v.id },
        data: { dataJson: JSON.stringify(data), ...(older ? { createdAt: new Date(v.createdAt.getTime() - (ordered.length - 1 - i) * 3 * 86_400_000) } : {}) },
      });
    }
  }
}

/** Live (non-deleted) records of one configuration list. */
export async function entityRecords(inst: string, entity: EntityKey, contextKey?: string) {
  return list(inst, ENTITIES[entity].screen, contextKey);
}

/** Inserts a seed record with every field defaulted, then the given values. */
export async function seedRecord(user: SessionClaims, entity: EntityKey, values: Data, contextKey = "") {
  const out: Data = {};
  for (const f of ENTITIES[entity].fields) out[f.key] = f.dflt !== undefined ? f.dflt : emptyOf(f);
  return insert(user.institutionId, user.accountId, ENTITIES[entity].screen, { ...out, ...values }, contextKey);
}

export async function entityIsEmpty(inst: string, entity: EntityKey) {
  return (await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: ENTITIES[entity].screen } })) === 0;
}

async function seed(user: SessionClaims) {
  const inst = user.institutionId;
  const a = user.accountId;
  const put = (entity: EntityKey, data: Data, ctx = "") => insert(inst, a, ENTITIES[entity].screen, data, ctx);
  const empty = async (entity: EntityKey) => (await prisma.heritageRecord.count({ where: { institutionId: inst, screenId: ENTITIES[entity].screen } })) === 0;
  const defaults = (entity: EntityKey, extra: Data): Data => {
    const out: Data = {};
    for (const f of ENTITIES[entity].fields) out[f.key] = f.dflt !== undefined ? f.dflt : emptyOf(f);
    return { ...out, ...extra };
  };
  const r = await refs(user);
  const programs = r.programs ?? [];

  if (await empty("studentStatuses")) {
    let i = 0;
    for (const st of SEED_STUDENT_STATUSES) {
      const parent = await put("studentStatuses", defaults("studentStatuses", { name: st.name, colour: st.colour, ...(st.extra ?? {}), _order: i++ }));
      let j = 0;
      for (const child of st.children ?? []) await put("studentStatuses", defaults("studentStatuses", { name: child, colour: st.colour, parent: parent.id, _order: j++ }));
    }
  }
  if (await empty("agentStatuses")) {
    const rows: Array<[string, string, string, string]> = [
      ["Current", "#2e7d32", "Active", "No"],
      ["Awaiting Contract", "#ef6c00", "Active", "No"],
      ["Terminated", "#c62828", "Inactive", "No"],
      ["Inactive", "#9e9e9e", "Inactive", "Yes"],
    ];
    for (const [i, [name, colour, statusType, def]] of rows.entries()) await put("agentStatuses", defaults("agentStatuses", { name, colour, statusType, defaultStatus: def, createLogin: name === "Current" ? "Yes" : "No", _order: i }));
  }
  if (await empty("documentTypes")) {
    for (const [i, name] of ["Fees Due notice", "New Application"].entries()) await put("documentTypes", defaults("documentTypes", { name, fileTypes: "Images", _order: i }));
  }
  if (await empty("flagTemplates")) {
    await put("flagTemplates", defaults("flagTemplates", { name: "Eligible to Graduate", code: "GRAD", flagType: "Academic", message: "<p>This student has met all program requirements and is eligible to graduate.</p>" }));
    await put(
      "flagTemplates",
      defaults("flagTemplates", {
        name: "Late Tuition",
        code: "LATE-TUITION",
        flagType: "Financial",
        message: "<p>Your tuition payment is past due. Please contact the Finance Office to avoid restrictions on your account.</p>",
        financialType: "Late Tuition: Program Deadlines",
        fees: "All Fees",
        balance: "Any Owing Balance",
        leewayDays: 7,
        applyHold: "Yes",
        studentRestrictions: ["Restrict / disable course registration", "Disable request forms"],
        registrationLimit: "No Registration Allowed",
        staffRestrictions: ["Restrict / disable course registration"],
        programs: programs.length ? "Select Programs" : "All Programs",
        selectPrograms: programs.slice(0, 2),
      }),
    );
  }
  if (await empty("forms")) {
    for (const [name, formType, visibility] of SEED_FORMS) await put("forms", defaults("forms", { name, formType, visibility: visibility ?? "Private" }));
  }
  if (await empty("userAgreements")) {
    const body = (t: string) => `<p><strong>${t}</strong></p><p>By accepting this agreement you confirm that you have read and understood its terms.</p>`;
    await put("userAgreements", defaults("userAgreements", { name: "Media Release Agreement", content: body("Media Release Agreement"), agreementForm: "Media Release Form", prompts: ["Upon successful login"] }));
    await put(
      "userAgreements",
      defaults("userAgreements", {
        name: "Studen Handbook Receipt",
        content: body("Student Handbook Receipt"),
        applyCampuses: "Customize",
        campuses: (r.campuses ?? []).slice(0, 1),
        applyAccess: "Customize",
        accessLevels: (r.accessLevels ?? []).filter((x) => /student/i.test(x)).slice(0, 1).concat((r.accessLevels ?? []).filter((x) => /student/i.test(x)).length ? [] : (r.accessLevels ?? []).slice(0, 1)),
        agreementForm: "Media Release Form",
        prompts: ["Upon successful login", "Upon accessing course content"],
      }),
    );
    await put("userAgreements", defaults("userAgreements", { name: "Student Enrolment Contract", content: body("Student Enrolment Contract"), signature: "Typed Signature", agreementForm: "Student Enrollment Contract", prompts: ["Upon registering for courses"] }));
    await put("userAgreements", defaults("userAgreements", { name: "Student Statement of Rights", content: body("Student Statement of Rights"), prompts: ["Upon successful login"] }));
  }
  if (await empty("correspondenceCategories")) {
    const ids = new Map<string, string>();
    for (const [name, types] of Object.entries(SEED_CORRESPONDENCE)) {
      const c = await put("correspondenceCategories", defaults("correspondenceCategories", { name, availableTo: "Staff & Faculty", recordTypes: ["Student Profiles", "Applications"] }));
      ids.set(name, c.id);
      for (const t of types) await put("correspondenceTypes", defaults("correspondenceTypes", { name: t, categories: [c.id] }));
    }
    for (const t of SEED_CORRESPONDENCE_MISC) await put("correspondenceTypes", defaults("correspondenceTypes", { name: t, categories: [] }));
  }
  if (await empty("runningElements")) for (const [name, type, content] of SEED_RUNNING_ELEMENTS) await put("runningElements", defaults("runningElements", { name, type, content }));
  if (await empty("documentInputs")) for (const [label, name, type] of SEED_DOCUMENT_INPUTS) await put("documentInputs", defaults("documentInputs", { label, name, type, autoSave: type === "Date" ? "No" : "Yes" }));
  if (await empty("documentFonts")) for (const name of ["Arial", "Courier New", "Helvetica", "Times New Roman"]) await put("documentFonts", defaults("documentFonts", { name, embedded: "No" }));
  if (await empty("templateModules")) {
    await put("templateModules", defaults("templateModules", { name: "Program Conditions", conditions: [{ id: randomUUID(), programs: [], statuses: ["Pre-enrolment Application"], rates: [], countries: [], content: "<p>Your admission is conditional on submitting your final transcripts before the program start date.</p>" }] }));
    await put("templateModules", defaults("templateModules", { name: "Attendance Policy", conditions: [{ id: randomUUID(), programs: [], statuses: [], rates: ["International"], countries: [], content: "<p>International students must maintain at least 90% attendance to remain in good standing.</p>" }] }));
  }
  if (await empty("documentTemplates")) {
    const elements = await list(inst, ENTITIES.runningElements.screen);
    const el = (n: string) => elements.find((e) => e.data.name === n)?.id ?? "";
    const letter = (title: string, body: string) => `<p>{student.first_name} {student.last_name}<br>{student.address}</p><p>{date}</p><p><strong>${title}</strong></p>${body}<p>Sincerely,<br>Office of the Registrar</p>`;
    const mk = async (data: Data, revisions: string[]) => {
      const full = defaults("documentTemplates", data);
      const rec = await put("documentTemplates", full);
      for (const [i, note] of revisions.entries()) {
        const last = i === revisions.length - 1;
        const v = await insert(inst, a, VERSION_SCREEN, { snapshot: last ? full : originalTemplate(full), changes: [note], seq: i + 1, by: "System" }, rec.id);
        if (!last) await prisma.heritageRecord.update({ where: { id: v.id }, data: { createdAt: new Date(v.createdAt.getTime() - (revisions.length - 1 - i) * 3 * 86_400_000) } });
      }
    };
    await mk(
      {
        name: "1st Warning Letter – Attendance",
        documentType: "Letter",
        header: "Select Element",
        headerElement: el("Header for Templates"),
        footer: "Select Element",
        footerElement: el("Footer for Templates"),
        content: letter("1st Warning Letter – Attendance", "<p>Our records show that your attendance has fallen below the required level.</p><p>[[Module: Attendance Policy]]</p>"),
      },
      ["Template created"],
    );
    await mk(
      {
        name: "Conditional Letter of Acceptance – HRA",
        documentType: "Letter",
        header: "Select Element",
        headerElement: el("Standard Header"),
        footer: "Select Element",
        footerElement: el("Standard Footer"),
        content: letter("Conditional Letter of Acceptance", "<p>We are pleased to offer you conditional admission to the Human Resources Administration program starting {input:start_date}.</p><p>[[Module: Program Conditions]]</p>"),
      },
      ["Template created", "Updated content, header and footer"],
    );
    await mk({ name: "Letter of Acceptance", documentType: "Letter", content: letter("Letter of Acceptance", "<p>Congratulations! You have been accepted into {student.program}.</p>") }, ["Template created"]);
    await mk({ name: "Official Fee Receipt", documentType: "Invoice / Receipt", content: "<p><strong>Official Fee Receipt</strong></p><p>Received from {student.first_name} {student.last_name}: {payment.amount} on {payment.date}.</p>" }, ["Template created"]);
  }
  if (await empty("notificationTemplates")) {
    await put("notificationTemplates", defaults("notificationTemplates", { name: "Application Received", event: "Application Submitted", subject: "We received your application", body: "<p>Hi {student.first_name}, thank you for applying to Heritage College. We will be in touch shortly.</p>" }));
    await put("notificationTemplates", defaults("notificationTemplates", { name: "Request Approved", event: "Request Approved", subject: "Your request was approved", body: "<p>Hi {student.first_name}, your request \"{request.type}\" has been approved.</p>" }));
    await put("notificationTemplates", defaults("notificationTemplates", { name: "Password Reset", event: "Password Reset", channel: "E-mail & SMS", subject: "Reset your MyHeritage password", body: "<p>Use the link below to reset your password: {reset.link}</p>", sms: "MyHeritage: reset your password at {reset.link}" }));
  }
  if (await empty("sections")) {
    for (const [i, name] of SEED_SECTIONS.entries()) await put("sections", defaults("sections", { functionType: "Defined System Function", name, systemFunction: name, _order: i }));
  }
  if (await empty("plugins")) {
    for (const g of SEED_PLUGINS) for (const name of g.names) await put("plugins", defaults("plugins", { name, group: g.group, description: g.describe, status: name === "Moodle" ? "Enabled" : "Disabled" }));
  }
  if (await empty("holidays")) {
    for (const [name, date, endDate, province] of SEED_HOLIDAYS_2026)
      await put("holidays", defaults("holidays", { name, date, type: endDate ? "Closure" : "Holiday", scope: province ? "Provincial" : "National", province: province ?? "", singleDay: !endDate, endDate: endDate ?? "" }));
  }
  if (await empty("smsProviders")) {
    for (const [name, domain] of [
      ["Bell", "txt.bell.ca"],
      ["Fido", "fido.ca"],
      ["Koodo", "msg.koodomobile.com"],
      ["Rogers", "pcs.rogers.com"],
      ["Telus", "msg.telus.com"],
      ["Virgin Plus", "vmobile.ca"],
    ])
      await put("smsProviders", { name, domain });
  }
  if (await empty("bounces")) {
    for (const [email, context, stamp] of [
      ["jsmith@gmial.com", "User E-mail", "2026-09-28 14:22"],
      ["admissions@heritage-old.ca", "E-mail Forwarding", "2026-10-01 09:05"],
      ["maria.lopez@yaho.com", "User E-mail", "2026-10-03 17:48"],
    ])
      await put("bounces", { email, type: "Bounced", context, stamp });
  }
  if (await empty("securityCategories")) {
    for (const [cat, questions] of Object.entries(SEED_SECURITY_QUESTIONS)) {
      const c = await put("securityCategories", { name: cat });
      for (const question of questions) await put("securityQuestions", { question, category: c.id });
    }
  }
  const currencyIds = new Map<string, string>();
  if (await empty("currencies")) {
    for (const [name, code, iso, unicode] of SEED_CURRENCIES) currencyIds.set(code, (await put("currencies", { name, code, iso, unicode, symbolPosition: "Use localization settings", active: "Yes" })).id);
  } else for (const c of await list(inst, ENTITIES.currencies.screen)) currencyIds.set(s(c.data.code), c.id);
  if (await empty("countries")) {
    for (const c of SEED_COUNTRIES) {
      const rec = await put("countries", { name: c.name, code: c.code, iso: c.iso, currency: c.currency ? (currencyIds.get(c.currency) ?? "") : "" });
      for (const [name, code] of c.regions ?? []) await put("countryRegions", { name, code }, rec.id);
    }
  }
  const languageIds = new Map<string, string>();
  if (await empty("languages")) {
    for (const [name, code, displayName] of SEED_LANGUAGES) languageIds.set(name, (await put("languages", { name, code, displayName, status: "Active" })).id);
  } else for (const l of await list(inst, ENTITIES.languages.screen)) languageIds.set(s(l.data.name), l.id);
  if (await empty("timezones")) for (const [i, [name, zone]] of SEED_TIMEZONES.entries()) await put("timezones", { name, zone, _order: i });
  if (!(await getSettingsRow(inst, "localization")))
    await prisma.heritageRecord.create({
      data: {
        institutionId: inst,
        screenId: SETTINGS_SCREEN,
        contextKey: "",
        singletonKey: "localization",
        dataJson: JSON.stringify({ defaultLanguage: languageIds.get("English") ?? "", defaultCurrency: currencyIds.get("CAD") ?? "" }),
        createdById: a,
        updatedById: a,
      },
    });

  await prisma.heritageRecord.upsert({
    where: { institutionId_screenId_contextKey_singletonKey: { institutionId: inst, screenId: SEED_SCREEN, contextKey: "", singletonKey: SEED_VERSION } },
    create: { institutionId: inst, screenId: SEED_SCREEN, contextKey: "", singletonKey: SEED_VERSION, dataJson: "{}", createdById: a, updatedById: a },
    update: {},
  });
}

/* ------------------------------------------------------------------ */
/* Meta                                                                 */
/* ------------------------------------------------------------------ */

async function userList(inst: string) {
  const accounts = await prisma.account.findMany({ where: { institutionId: inst }, include: { person: true }, take: 2000 });
  return accounts
    .map((a) => ({ id: a.id, label: `${a.person.givenName} ${a.person.familyName}`.trim() || a.email, email: a.email }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

async function dynLists(user: SessionClaims): Promise<Record<string, string[]>> {
  const r = await refs(user);
  const [forms, ledgerTypes] = await Promise.all([list(user.institutionId, ENTITIES.forms.screen), list(user.institutionId, ENTITIES.ledgerTypes.screen)]);
  return {
    planFees: ledgerTypes.filter((t) => t.data.trigger === "Payment Plan").map((t) => s(t.data.name)),
    statuses: r.statuses ?? [],
    programs: r.programs ?? [],
    campuses: r.campuses ?? [],
    rateCategories: r.rateCategories ?? [],
    countries: r.countries ?? [],
    accessLevels: r.accessLevels ?? [],
    languages: r.languages ?? [],
    timezones: r.timezones ?? [],
    terms: r.terms ?? [],
    provinces: r.provinces ?? [],
    courses: r.courses ?? [],
    schedules: r.schedules ?? [],
    agents: r.agents ?? [],
    agreementForms: forms.filter((x) => x.data.formType === "Agreement Form").map((x) => s(x.data.name)),
  };
}

/** Country name → its region names (System Configuration › Countries & Regions). */
async function regionMap(inst: string): Promise<Record<string, string[]>> {
  const [countries, regions] = await Promise.all([list(inst, ENTITIES.countries.screen), list(inst, ENTITIES.countryRegions.screen)]);
  const out: Record<string, string[]> = {};
  for (const c of countries) {
    const names = regions.filter((r) => r.contextKey === c.id).map((r) => s(r.data.name)).filter(Boolean).sort((a, b) => a.localeCompare(b));
    if (names.length) out[s(c.data.name)] = names;
  }
  return out;
}

export const ctxFor = (user: SessionClaims): Ctx => {
  let cache: Promise<Record<string, string[]>> | null = null;
  let regions: Promise<Record<string, string[]>> | null = null;
  return { inst: user.institutionId, lists: () => (cache ??= dynLists(user)), regions: () => (regions ??= regionMap(user.institutionId)) };
};

export async function sysMeta(user: SessionClaims) {
  await assertAnyView(user);
  await ensureSeed(user);
  const [lists, users, regions, access] = await Promise.all([
    dynLists(user),
    userList(user.institutionId),
    regionMap(user.institutionId),
    effectiveAccess(user.institutionId, user.accountId),
  ]);
  const editable = (perm: "systemConfiguration" | "financialManagement" | "agentManagement") => canEdit(access.permissions[perm]);
  return {
    regions,
    entities: Object.fromEntries(
      Object.entries(ENTITIES).map(([k, e]) => [
        k,
        { label: e.label, fields: e.fields, sortable: Boolean(e.sortable), noCreate: Boolean(e.noCreate), canEdit: editable(e.perm ?? "systemConfiguration") },
      ]),
    ),
    canEditSettings: editable("systemConfiguration"),
    settings: Object.fromEntries(Object.entries(SETTINGS).map(([k, t]) => [k, { label: t.label, save: t.save, fields: t.fields }])),
    lists,
    users: users.map((u) => ({ id: u.id, label: `${u.label} (${u.email})` })),
    courses: [],
    weekdays: [],
    colours: COLOURS,
    icons: NAV_ICONS,
    outcomeIcons: OUTCOME_ICONS,
  };
}

/* ------------------------------------------------------------------ */
/* Generic CRUD                                                         */
/* ------------------------------------------------------------------ */

function publicData(def: EntityDef, data: Data): Data {
  const out: Data = { ...data };
  for (const f of def.fields)
    if (f.kind === "secret" || f.kind === "password") {
      out[`_has_${f.key}`] = Boolean(out[f.key]);
      delete out[f.key];
    }
  return out;
}

async function decorate(user: SessionClaims, entity: EntityKey, recs: Rec[]) {
  const inst = user.institutionId;
  const def = ENTITIES[entity];
  const labelCache = new Map<EntityKey, Map<string, string>>();
  const labels = async (target: EntityKey) => {
    if (!labelCache.has(target)) labelCache.set(target, new Map((await list(inst, ENTITIES[target].screen)).map((r) => [r.id, s(r.data.name || r.data.question || r.data.email)])));
    return labelCache.get(target)!;
  };
  const needsUsers = def.fields.some((f) => f.kind === "person" || f.kind === "people");
  const users = needsUsers ? new Map((await userList(inst)).map((u) => [u.id, u.label])) : new Map<string, string>();
  const extras: Data[] = recs.map(() => ({}));
  for (const f of def.fields) {
    if (f.kind === "ref") {
      const m = await labels(f.ref!);
      recs.forEach((r, i) => (extras[i]![`_${f.key}Label`] = m.get(s(r.data[f.key])) ?? ""));
    }
    if (f.kind === "refMulti") {
      const m = await labels(f.ref!);
      recs.forEach((r, i) => (extras[i]![`_${f.key}Labels`] = arr(r.data[f.key]).map((id) => m.get(s(id)) ?? "").filter(Boolean)));
    }
    if (f.kind === "person") recs.forEach((r, i) => (extras[i]![`_${f.key}Label`] = users.get(s(r.data[f.key])) ?? ""));
    if (f.kind === "people") recs.forEach((r, i) => (extras[i]![`_${f.key}Labels`] = arr(r.data[f.key]).map((id) => users.get(s(id)) ?? "").filter(Boolean)));
  }
  if (entity === "blockedUsers") recs.forEach((r, i) => (extras[i]!._userLabel = users.get(s(r.data.user)) ?? "(removed user)"));
  if (entity === "countries") {
    const counts = await prisma.heritageRecord.groupBy({ by: ["contextKey"], where: { institutionId: inst, screenId: ENTITIES.countryRegions.screen, deletedAt: null }, _count: { _all: true } });
    const by = new Map(counts.map((c) => [c.contextKey, c._count._all]));
    recs.forEach((r, i) => (extras[i]!._regions = by.get(r.id) ?? 0));
  }
  if (entity === "currencies") recs.forEach((r, i) => (extras[i]!._symbol = s(r.data.unicode) ? String.fromCodePoint(parseInt(s(r.data.unicode), 16)) : ""));
  if (entity === "documentTemplates") {
    const counts = await prisma.heritageRecord.groupBy({ by: ["contextKey"], where: { institutionId: inst, screenId: VERSION_SCREEN, deletedAt: null }, _count: { _all: true } });
    const by = new Map(counts.map((c) => [c.contextKey, c._count._all]));
    recs.forEach((r, i) => (extras[i]!._versions = by.get(r.id) ?? 0));
  }
  if (entity === "languages" || entity === "currencies") {
    const loc = await getSettingsRow(inst, "localization");
    const d = loc ? parse(loc.dataJson) : {};
    const def = entity === "languages" ? s(d.defaultLanguage) : s(d.defaultCurrency);
    recs.forEach((r, i) => {
      if (r.id === def) extras[i]!._protected = `Default ${entity === "languages" ? "language" : "currency"} — change it in General Settings first`;
    });
  }
  if (entity === "plugins") recs.forEach((_, i) => (extras[i]!._protected = "Catalogue plug-ins cannot be deleted"));
  const hook = HOOKS[entity]?.decorate;
  if (hook) (await hook(user, recs)).forEach((more, i) => Object.assign(extras[i]!, more));
  return extras;
}

function shape(def: EntityDef, r: Rec, extra: Data = {}) {
  return { id: r.id, parentId: r.contextKey, ...publicData(def, r.data), ...extra, updatedAt: r.updatedAt.toISOString() };
}

function sortRecs(def: EntityDef, recs: Rec[]) {
  if (def.sortable) return [...recs].sort((x, y) => order(x.data) - order(y.data) || x.createdAt.getTime() - y.createdAt.getTime());
  const key = (r: Rec) => s(r.data.name ?? r.data.question ?? r.data.email ?? r.data.date);
  return [...recs].sort((x, y) => key(x).localeCompare(key(y), undefined, { sensitivity: "base", numeric: true }));
}

export async function listEntity(user: SessionClaims, entity: EntityKey, opts: { parentId?: string; q?: string }) {
  await assertPermission(user, permOf(entity), "view");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  if (def.parent && !opts.parentId) throw httpError(400, `${def.parent.label} is required`);
  if (def.parent) await find(inst, ENTITIES[def.parent.entity].screen, opts.parentId!, def.parent.label);
  const recs = sortRecs(def, await list(inst, def.screen, def.parent ? opts.parentId : undefined));
  const extras = await decorate(user, entity, recs);
  let items = recs.map((r, i) => shape(def, r, extras[i])) as Array<Data & { id: string }>;
  const needle = lc(opts.q);
  if (needle) items = items.filter((it) => def.search.some((k) => lc(it[k]).includes(needle)));
  return { items, total: items.length };
}

export async function getEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, permOf(entity), "view");
  const def = ENTITIES[entity];
  const rec = await find(user.institutionId, def.screen, id, def.label);
  const [extra] = await decorate(user, entity, [rec]);
  return shape(def, rec, extra);
}

async function assertUnique(inst: string, def: EntityDef, data: Data, parentKey: string, exceptId?: string) {
  if (!def.unique.length) return;
  const all = await list(inst, def.screen);
  for (const u of def.unique) {
    const v = lc(data[u.key]);
    if (!v) continue;
    const clash = all.find((r) => r.id !== exceptId && (u.scope === "all" || r.contextKey === parentKey) && lc(r.data[u.key]) === v);
    if (clash) throw httpError(409, `${u.label} "${s(data[u.key])}" is already in use${u.scope === "parent" ? " here" : ""}`, "CONFLICT");
  }
}

const titleOf = (d: Data, fallback: string) => s(d.name || d.question || d.email || d.label) || (s(d.startDate) && s(d.endDate) ? `${s(d.startDate)} – ${s(d.endDate)}` : "") || fallback;

async function afterSave(user: SessionClaims, entity: EntityKey, id: string, before: Data | null, after: Data) {
  const inst = user.institutionId;
  if ((entity === "agentStatuses" || entity === "studentStatuses") && after.defaultStatus === "Yes") {
    for (const r of await list(inst, ENTITIES[entity].screen)) if (r.id !== id && r.data.defaultStatus === "Yes") await write(user.accountId, r.id, { ...r.data, defaultStatus: "No" });
  }
  if (entity === "studentStatuses" && before && s(before.name) !== s(after.name)) await renameStatus(user, s(before.name), s(after.name));
  await HOOKS[entity]?.afterSave?.(user, id, before, after);
}

/** Status names are referenced by name across configuration records and student profiles. */
async function renameStatus(user: SessionClaims, from: string, to: string) {
  const inst = user.institutionId;
  const swap = (fields: Field[], d: Data): boolean => {
    let changed = false;
    for (const f of fields) {
      if (f.dyn === "statuses" && (f.kind === "select" || f.kind === "multiList")) {
        if (f.kind === "select" && d[f.key] === from) {
          d[f.key] = to;
          changed = true;
        }
        if (f.kind === "multiList" && arr(d[f.key]).includes(from)) {
          d[f.key] = arr(d[f.key]).map((x) => (x === from ? to : x));
          changed = true;
        }
      }
      if (f.kind === "rows") for (const row of arr(d[f.key]) as Data[]) if (swap(f.rowFields ?? [], row)) changed = true;
    }
    return changed;
  };
  for (const def of Object.values(ENTITIES)) {
    if (!def.fields.some((f) => f.dyn === "statuses" || f.kind === "rows")) continue;
    for (const r of await list(inst, def.screen)) if (swap(def.fields, r.data)) await write(user.accountId, r.id, r.data);
  }
  const meta = await studentMetaMap(inst);
  for (const [studentId, m] of Object.entries(meta)) if (m.status === from) await patchStudentMeta(inst, studentId, { status: to });
}

export async function createEntity(user: SessionClaims, entity: EntityKey, body: Data & { parentId?: string }) {
  await assertPermission(user, permOf(entity), "edit");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  if (def.noCreate) throw httpError(400, `${def.label} records are provided by the system and cannot be added here`);
  const inst = user.institutionId;
  if (def.parent) {
    if (!body.parentId) throw httpError(400, `${def.parent.label} is required`);
    await find(inst, ENTITIES[def.parent.entity].screen, s(body.parentId), def.parent.label);
  }
  const data = await clean(def.fields, body, {}, ctxFor(user));
  validateCross(entity, data);
  await HOOKS[entity]?.validate?.(user, data, null);
  if (entity === "studentStatuses") await checkStatusParent(inst, data, null);
  const ctx = def.parent ? s(body.parentId) : "";
  await assertUnique(inst, def, data, ctx);
  if (def.sortable) {
    const siblings = (await list(inst, def.screen, def.parent ? ctx : undefined)).filter((r) => entity !== "studentStatuses" || s(r.data.parent) === s(data.parent));
    data._order = siblings.reduce((m, r) => Math.max(m, typeof r.data._order === "number" ? r.data._order : -1), -1) + 1;
  }
  const rec = await insert(inst, user.accountId, def.screen, data, ctx);
  await afterSave(user, entity, rec.id, null, data);
  if (entity === "documentTemplates") await addVersion(user, rec.id, data, ["Template created"]);
  await audit(user, def.audit, ctx, `create ${def.label.toLowerCase()}`, { recordId: rec.id, after: publicData(def, data) });
  return { ok: true, id: rec.id, message: `${capital(def.label)} "${titleOf(data, def.label)}" saved` };
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

async function checkStatusParent(inst: string, data: Data, selfId: string | null) {
  const parentId = s(data.parent);
  if (!parentId) return;
  const parent = await find(inst, ENTITIES.studentStatuses.screen, parentId, "Parent Status");
  if (s(parent.data.parent)) throw httpError(400, "Parent Status must be a top-level status");
  if (selfId) {
    const children = (await list(inst, ENTITIES.studentStatuses.screen)).filter((r) => s(r.data.parent) === selfId);
    if (children.length) throw httpError(400, "This status has sub-statuses, so it must stay a top-level status");
  }
}

export async function updateEntity(user: SessionClaims, entity: EntityKey, id: string, body: Data) {
  await assertPermission(user, permOf(entity), "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  const data = await clean(def.fields, body, rec.data, ctxFor(user));
  validateCross(entity, data, id);
  await HOOKS[entity]?.validate?.(user, data, id);
  if (entity === "studentStatuses") await checkStatusParent(inst, data, id);
  await assertUnique(inst, def, data, rec.contextKey, id);
  if (typeof rec.data._order === "number") data._order = rec.data._order;
  if (entity === "studentStatuses" && s(rec.data.parent) !== s(data.parent)) {
    const siblings = (await list(inst, def.screen)).filter((r) => r.id !== id && s(r.data.parent) === s(data.parent));
    data._order = siblings.reduce((m, r) => Math.max(m, order(r.data) === Number.MAX_SAFE_INTEGER ? -1 : order(r.data)), -1) + 1;
  }
  await write(user.accountId, id, data);
  await afterSave(user, entity, id, rec.data, data);
  if (entity === "documentTemplates") {
    const changes = def.fields.filter((f) => JSON.stringify(rec.data[f.key] ?? null) !== JSON.stringify(data[f.key] ?? null)).map((f) => f.label);
    if (changes.length) await addVersion(user, id, data, [`Updated ${changes.slice(0, 6).join(", ")}${changes.length > 6 ? ` and ${changes.length - 6} more` : ""}`]);
  }
  await audit(user, def.audit, rec.contextKey, `update ${def.label.toLowerCase()}`, { recordId: id, before: publicData(def, rec.data), after: publicData(def, data) });
  return { ok: true, id, message: `${capital(def.label)} "${titleOf(data, def.label)}" saved` };
}

async function usedBy(inst: string, entity: EntityKey, test: (d: Data) => boolean) {
  return (await list(inst, ENTITIES[entity].screen)).filter((r) => test(r.data));
}

export async function deleteEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, permOf(entity), "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  const name = titleOf(rec.data, def.label);
  const block = (used: Rec[], what: string) => {
    if (used.length)
      throw httpError(409, `"${name}" is still used by ${used.length} ${what}${used.length === 1 ? "" : "s"} (${used.slice(0, 3).map((u) => titleOf(u.data, what)).join(", ")}${used.length > 3 ? ", …" : ""}). Update ${used.length === 1 ? "it" : "them"} first.`, "CONFLICT");
  };
  const [extra] = await decorate(user, entity, [rec]);
  if (extra?._protected) throw httpError(409, s(extra._protected), "CONFLICT");
  const cascade: string[] = [];
  let note = "";
  const rowsUse = (key: string, field: string) => (d: Data) => arr(d[key]).some((row) => s((row as Data)[field]) === id);
  if (entity === "studentStatuses") {
    block(await usedBy(inst, "studentStatuses", (d) => s(d.parent) === id), "sub-status");
    const meta = await studentMetaMap(inst);
    const students = Object.values(meta).filter((m) => m.status === name).length;
    if (students) throw httpError(409, `"${name}" is the current status of ${students} student${students === 1 ? "" : "s"}. Change their status first.`, "CONFLICT");
  }
  if (entity === "securityCategories") block(await usedBy(inst, "securityQuestions", (d) => s(d.category) === id), "security question");
  if (entity === "runningElements") block(await usedBy(inst, "documentTemplates", (d) => s(d.headerElement) === id || s(d.footerElement) === id), "document template");
  if (entity === "correspondenceTypes") block(await usedBy(inst, "documentTemplates", (d) => s(d.correspondenceType) === id), "document template");
  if (entity === "correspondenceCategories") {
    block(await usedBy(inst, "documentTemplates", (d) => s(d.correspondenceCategory) === id), "document template");
    const linked = await usedBy(inst, "correspondenceTypes", (d) => arr(d.categories).includes(id));
    for (const t of linked) await write(user.accountId, t.id, { ...t.data, categories: arr(t.data.categories).filter((c) => c !== id) });
    if (linked.length) note = `; ${linked.length} correspondence type(s) unlinked`;
  }
  if (entity === "emailDepartments") block(await usedBy(inst, "emailFilters", (d) => s(d.department) === id), "e-mail filter");
  if (entity === "forms") {
    block(await usedBy(inst, "userAgreements", (d) => s(d.agreementForm) === name), "user agreement");
    block(await usedBy(inst, "workflows", rowsUse("items", "form")), "requirement / workflow");
  }
  if (entity === "documentTypes") block(await usedBy(inst, "workflows", rowsUse("items", "documentType")), "requirement / workflow");
  if (entity === "flagTemplates") block(await usedBy(inst, "workflows", (d) => s(d.actionFlag) === id), "requirement / workflow");
  if (entity === "notificationTemplates") block(await usedBy(inst, "workflows", (d) => s(d.actionNotification) === id), "requirement / workflow");
  if (entity === "assessmentCategories") block(await usedBy(inst, "assessments", rowsUse("cases", "category")), "assessment");
  if (entity === "currencies") block(await usedBy(inst, "countries", (d) => s(d.currency) === id), "country");
  if (entity === "countries") cascade.push(...(await list(inst, ENTITIES.countryRegions.screen, id)).map((r) => r.id));
  if (entity === "documentTemplates") cascade.push(...(await list(inst, VERSION_SCREEN, id)).map((r) => r.id));
  await HOOKS[entity]?.beforeDelete?.(user, rec);
  await remove(user.accountId, [id, ...cascade]);
  await audit(user, def.audit, rec.contextKey, entity === "bounces" ? "dismiss bounce" : `delete ${def.label.toLowerCase()}`, {
    recordId: id,
    before: publicData(def, rec.data),
    note: cascade.length ? `${cascade.length} related record(s) removed` : undefined,
  });
  const tail = entity === "countries" && cascade.length ? ` with ${cascade.length} region(s)` : "";
  return { ok: true, message: entity === "bounces" ? `"${name}" dismissed` : `${capital(def.label)} "${name}" deleted${tail}${note}` };
}

export async function reorderEntity(user: SessionClaims, entity: EntityKey, ids: string[]) {
  await assertPermission(user, permOf(entity), "edit");
  const def = ENTITIES[entity];
  if (!def.sortable) throw httpError(400, `${capital(def.label)} records cannot be reordered`);
  const inst = user.institutionId;
  const all = await list(inst, def.screen);
  const recs = ids.map((id) => all.find((r) => r.id === id));
  if (recs.some((r) => !r) || new Set(ids).size !== ids.length) throw httpError(400, "The list changed — reload and try again");
  if (entity === "studentStatuses" && new Set(recs.map((r) => s(r!.data.parent))).size > 1) throw httpError(400, "Statuses can only be reordered within the same parent");
  for (const [i, r] of recs.entries()) if (r!.data._order !== i) await write(user.accountId, r!.id, { ...r!.data, _order: i });
  await audit(user, def.audit, "", `reorder ${def.label.toLowerCase()}s`, { after: recs.map((r) => titleOf(r!.data, def.label)) });
  return { ok: true, message: "Order saved" };
}

/* ------------------------------------------------------------------ */
/* Settings pages                                                       */
/* ------------------------------------------------------------------ */

export async function getSettings(user: SessionClaims, key: SettingsKey) {
  await assertPermission(user, "systemConfiguration", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const t = SETTINGS[key];
  const row = await getSettingsRow(inst, key);
  const stored = row ? parse(row.dataJson) : {};
  if (key === "password" && !("minLength" in stored)) {
    const policy = await prisma.securityPolicy.findUnique({ where: { institutionId: inst } });
    if (policy) stored.minLength = policy.passwordMinLength;
  }
  const values: Data = {};
  for (const f of t.fields) values[f.key] = f.key in stored ? stored[f.key] : f.dflt !== undefined ? f.dflt : emptyOf(f);
  return { key, values, updatedAt: row?.updatedAt.toISOString() ?? null };
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/;

export async function saveSettings(user: SessionClaims, key: SettingsKey, body: Data) {
  await assertPermission(user, "systemConfiguration", "edit");
  const inst = user.institutionId;
  const t = SETTINGS[key];
  const row = await getSettingsRow(inst, key);
  const before = row ? parse(row.dataJson) : {};
  const data = await clean(t.fields, body, before, ctxFor(user));
  if (key === "global") {
    const mins = (v: unknown) => {
      const [h, m] = s(v).split(":").map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    if (!(mins(data.morningBoundary) < mins(data.afternoonBoundary) && mins(data.afternoonBoundary) < mins(data.eveningBoundary)))
      throw httpError(400, "Boundary times must run in order: Morning before Afternoon before Evening");
  }
  if (key === "session" && data.ipAuthentication === "Enabled") {
    const lines = s(data.allowedIps).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bad = lines.filter((l) => !IPV4.test(l));
    if (bad.length) throw httpError(400, `Not a valid IPv4 address or CIDR range: ${bad.slice(0, 3).join(", ")}`);
    data.allowedIps = lines.join("\n");
  }
  if (row) await write(user.accountId, row.id, data);
  else await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: SETTINGS_SCREEN, contextKey: "", singletonKey: key, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId } });
  if (key === "password") {
    const min = Number(data.minLength) || 10;
    await prisma.securityPolicy.upsert({ where: { institutionId: inst }, create: { institutionId: inst, passwordMinLength: min }, update: { passwordMinLength: min } });
  }
  await audit(user, t.audit, "", `save ${t.label.toLowerCase()}`, { before, after: data });
  return { ok: true, message: `${t.label} saved` };
}

export async function settingsHistory(user: SessionClaims, key: SettingsKey) {
  await assertPermission(user, "systemConfiguration", "view");
  const t = SETTINGS[key];
  const rows = await prisma.heritageAuditEntry.findMany({
    where: { institutionId: user.institutionId, screenId: t.audit },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actorName || "System",
      at: row.createdAt.toISOString(),
      before: row.beforeJson ? parse(row.beforeJson) : null,
      after: row.afterJson ? parse(row.afterJson) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Document template versions, copy and restore                         */
/* ------------------------------------------------------------------ */

async function actorName(accountId: string) {
  const a = await prisma.account.findUnique({ where: { id: accountId }, include: { person: true } });
  return a ? `${a.person.givenName} ${a.person.familyName}`.trim() || a.email : "System";
}

const isFirstVersion = (v: Rec) => /^(Template created|Copied from)/.test(s(arr(v.data.changes)[0]));

/** Newest first. Seeded versions can share a timestamp, so `seq` and the "created" note break ties. */
async function versionsOf(inst: string, templateId: string) {
  const seq = (v: Rec) => (typeof v.data.seq === "number" ? v.data.seq : isFirstVersion(v) ? 0 : 1);
  return (await list(inst, VERSION_SCREEN, templateId)).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime() || seq(y) - seq(x));
}

async function addVersion(user: SessionClaims, templateId: string, snapshot: Data, changes: string[]) {
  const top = (await versionsOf(user.institutionId, templateId))[0];
  const seq = top && typeof top.data.seq === "number" ? top.data.seq + 1 : top ? 2 : 1;
  await insert(user.institutionId, user.accountId, VERSION_SCREEN, { snapshot, changes, seq, by: await actorName(user.accountId) }, templateId);
}

const TEMPLATE_REFS = ["headerElement", "footerElement", "correspondenceCategory", "correspondenceType"] as const;

async function templateRefLabels(inst: string, data: Data) {
  const out: Record<string, string> = {};
  for (const key of TEMPLATE_REFS) {
    const id = s(data[key]);
    if (!id) continue;
    const row = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst }, select: { dataJson: true, deletedAt: true } });
    out[key] = row ? `${s(parse(row.dataJson).name)}${row.deletedAt ? " (deleted)" : ""}` : "(deleted)";
  }
  return out;
}

export async function templateHistory(user: SessionClaims, id: string) {
  await assertPermission(user, "systemConfiguration", "view");
  const rec = await find(user.institutionId, ENTITIES.documentTemplates.screen, id, "Document template");
  const versions = await versionsOf(user.institutionId, id);
  return {
    template: { id: rec.id, name: s(rec.data.name) },
    items: versions.map((v, i) => ({ id: v.id, date: v.createdAt.toISOString(), by: s(v.data.by) || "System", changes: arr(v.data.changes).map(s), current: i === 0 })),
  };
}

export async function templateVersion(user: SessionClaims, id: string, versionId: string) {
  await assertPermission(user, "systemConfiguration", "view");
  const rec = await find(user.institutionId, ENTITIES.documentTemplates.screen, id, "Document template");
  const v = await find(user.institutionId, VERSION_SCREEN, versionId, "Version");
  if (v.contextKey !== id) throw httpError(404, "Version not found", "NOT_FOUND");
  const snap = (v.data.snapshot ?? {}) as Data;
  return {
    id: v.id,
    date: v.createdAt.toISOString(),
    by: s(v.data.by),
    changes: arr(v.data.changes).map(s),
    name: s(snap.name),
    content: s(snap.content),
    snapshot: snap,
    labels: await templateRefLabels(user.institutionId, snap),
    currentLabels: await templateRefLabels(user.institutionId, rec.data),
  };
}

export async function restoreTemplate(user: SessionClaims, id: string, versionId: string) {
  await assertPermission(user, "systemConfiguration", "edit");
  const inst = user.institutionId;
  const def = ENTITIES.documentTemplates;
  const rec = await find(inst, def.screen, id, def.label);
  const v = await find(inst, VERSION_SCREEN, versionId, "Version");
  if (v.contextKey !== id) throw httpError(404, "Version not found", "NOT_FOUND");
  const versions = await versionsOf(inst, id);
  if (versions[0]?.id === versionId) throw httpError(400, "This is already the current version");
  let data: Data;
  try {
    data = await clean(def.fields, (v.data.snapshot ?? {}) as Data, {}, ctxFor(user));
  } catch (e) {
    throw httpError(400, `This version can't be restored as-is: ${(e as Error).message}`);
  }
  await assertUnique(inst, def, data, "", id);
  await write(user.accountId, id, data);
  const stamp = v.createdAt.toISOString().slice(0, 16).replace("T", " ");
  await addVersion(user, id, data, [`Restored the version from ${stamp} UTC`]);
  await audit(user, def.audit, "", "restore document template", { recordId: id, before: rec.data, after: data, note: `Restored version ${versionId}` });
  return { ok: true, message: `"${s(data.name)}" restored to the version from ${stamp} UTC` };
}

export async function copyTemplate(user: SessionClaims, id: string) {
  await assertPermission(user, "systemConfiguration", "edit");
  const inst = user.institutionId;
  const def = ENTITIES.documentTemplates;
  const rec = await find(inst, def.screen, id, def.label);
  const names = new Set((await list(inst, def.screen)).map((r) => lc(r.data.name)));
  let name = `Copy of ${s(rec.data.name)}`.slice(0, 200);
  for (let n = 2; names.has(lc(name)); n++) name = `Copy ${n} of ${s(rec.data.name)}`.slice(0, 200);
  const data = { ...rec.data, name, defaultType: false };
  const created = await insert(inst, user.accountId, def.screen, data);
  await addVersion(user, created.id, data, [`Copied from "${s(rec.data.name)}"`]);
  await audit(user, def.audit, "", "copy document template", { recordId: created.id, after: data, note: `Copied from ${id}` });
  return { ok: true, id: created.id, message: `Template copied as "${name}"` };
}

/* ------------------------------------------------------------------ */
/* Campus access logs                                                   */
/* ------------------------------------------------------------------ */

export async function accessLogs(user: SessionClaims, q: { from?: string; to?: string; campus?: string; user?: string; outcome?: string }) {
  await assertPermission(user, "systemConfiguration", "view");
  if (q.from && !DATE_RE.test(q.from)) throw httpError(400, "Start Datestamp must be a valid date");
  if (q.to && !DATE_RE.test(q.to)) throw httpError(400, "End Datestamp must be a valid date");
  if (q.from && q.to && q.to < q.from) throw httpError(400, "End Datestamp must be on or after the Start Datestamp");
  const needle = lc(q.user);
  const [scannerRows, configurationRows] = await Promise.all([
    list(user.institutionId, ACCESS_LOG_SCREEN),
    prisma.heritageAuditEntry.findMany({
      where: { institutionId: user.institutionId, screenId: ENTITIES.accessOutcomes.audit },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const items = [
    ...scannerRows.map((r) => ({ id: r.id, location: s(r.data.location), date: s(r.data.date) || r.createdAt.toISOString(), user: s(r.data.user), outcome: s(r.data.outcome), source: "Card reader / kiosk" })),
    ...configurationRows.map((r) => {
      const after = r.afterJson ? parse(r.afterJson) : {};
      const before = r.beforeJson ? parse(r.beforeJson) : {};
      const snapshot = Object.keys(after).length ? after : before;
      return {
        id: r.id,
        location: s(snapshot.campus) || "All campuses",
        date: r.createdAt.toISOString(),
        user: r.actorName || "System",
        outcome: s(snapshot.outcomeType) || r.action,
        source: "Configuration change",
      };
    }),
  ]
    .filter((r) => (!q.from || r.date.slice(0, 10) >= q.from) && (!q.to || r.date.slice(0, 10) <= q.to))
    .filter((r) => (!q.campus || r.location === q.campus) && (!q.outcome || r.outcome === q.outcome) && (!needle || r.user.toLowerCase().includes(needle)))
    .sort((x, y) => y.date.localeCompare(x.date));
  return { items, total: items.length };
}

/* ------------------------------------------------------------------ */
/* Files (font files, login imagery, custom outcome icons)              */
/* ------------------------------------------------------------------ */

const FILE_MAX = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|font\/(ttf|otf|woff2?)|application\/(x-font-ttf|x-font-otf|font-woff|vnd\.ms-opentype)|application\/octet-stream)$/;

export async function uploadFile(user: SessionClaims, body: { name: string; mime: string; base64: string }) {
  await assertPermission(user, "systemConfiguration", "edit");
  const name = s(body.name).replace(/[\\/]/g, "_").slice(0, 200);
  let mime = s(body.mime).toLowerCase();
  if (mime === "application/octet-stream" || !mime) {
    const ext = name.toLowerCase().split(".").pop() ?? "";
    mime = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" }[ext] ?? "";
  }
  if (!name) throw httpError(400, "File name is required");
  if (!FILE_TYPES.test(mime) || mime === "application/octet-stream") throw httpError(400, "Unsupported file type. Upload a PNG, JPG, GIF, WebP, PDF or font (TTF, OTF, WOFF) file.");
  const b64 = s(body.base64).replace(/^data:[^,]*,/, "");
  const bytes = decodeBase64(b64);
  const size = bytes.length;
  if (!size) throw httpError(400, "The file is empty");
  if (size > FILE_MAX) throw httpError(400, "Files must be 8 MB or smaller");
  if (!bytesMatchMime(bytes, mime)) throw httpError(400, "File contents do not match the declared file type");
  const rec = await insert(user.institutionId, user.accountId, FILE_SCREEN, { name, mime, size, base64: b64 });
  return { id: rec.id, name, mime, size };
}

export async function downloadFile(user: SessionClaims, id: string) {
  await assertPermission(user, "systemConfiguration", "view");
  const rec = await find(user.institutionId, FILE_SCREEN, id, "File");
  return { name: s(rec.data.name), mime: s(rec.data.mime), base64: s(rec.data.base64) };
}
