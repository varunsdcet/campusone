import { prisma } from "@myheritage/db";
import { verifyPassword } from "@myheritage/auth";
import type { SessionClaims } from "@myheritage/contracts";
import {
  CAMPUSES,
  STUDENT_PROGRAMS,
  STUDENT_STATUSES,
  assertPermission,
  canView,
  effectiveAccess,
  listAccessLevels,
  type PermissionModuleKey,
} from "../superAdmin.service.js";
import { rawRegistry, screenSchema, screenSchemas, type ContextType, type FieldDef, type ScreenSchema } from "./registry.js";
import { DOMAIN_SOURCES, WRITE_THROUGH, domainStatus, updateDomainRecord, type DomainRow } from "./domain.js";
import { bytesMatchMime, decodeBase64 } from "../../../lib/fileSniff.js";

type Data = Record<string, unknown>;

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

/* Form screens whose saved entries belong to a parent list screen. */
export const STORE_ALIAS: Record<string, string> = {
  S05: "S04",
  S13: "S10",
  S17: "S16",
  S18: "S16",
  S22: "S21",
  P06: "P01",
  P07: "P05",
  SF06: "F03",
  SF07: "F04",
  SF08: "F05",
  SF09: "F08",
  R03: "R01",
  PR05: "PR04",
  PR06: "PR04",
  PR11: "PR04",
  PR12: "PR04",
  PR18: "PR17",
  PR19: "PR17",
  PR20: "PR17",
  C12: "C11",
  C18: "C17",
  C29: "C30",
  L12: "L10",
  L19: "L18",
  RP03: "RP02",
  SC11: "SC10",
  SC27: "SC35",
  LM09: "LM08",
};

/* Screens already built as dedicated pages earlier; the registry screen links to them. */
export const DEDICATED: Record<string, string> = {
  G04: "/admin/student-search",
  MC01: "/admin/my-courses",
  MC02: "/admin/my-courses/attendance",
  MC03: "/admin/my-courses/repository",
  MC04: "/admin/my-courses/pending-schedules",
  MC05: "/admin/my-courses/grades",
  MC06: "/admin/my-courses/history",
  P01: "/admin/faculty-profile/biography",
  P04: "/admin/faculty-profile/topics",
  P05: "/admin/faculty-profile/availability",
  P08: "/admin/faculty-profile/compensation",
  P09: "/admin/faculty-profile/schedule",
  P10: "/admin/account/accomplishments",
  P11: "/admin/account/security",
  P12: "/admin/account/timezone",
  U01: "/admin/user-management/new",
  U02: "/admin/user-management",
  U03: "/admin/access-levels",
  R01: "/admin/requests",
  R02: "/admin/requests?f.type=Student+Requests",
  R03: "/admin/requests?f.type=Student+Requests",
  R04: "/admin/requests?f.type=Profile+Changes",
  W01: "/admin/workshops/enrolments",
  W02: "/admin/workshops/mine",
  W03: "/admin/workshops/attendance",
  W04: "/admin/workshops/enrol",
  C17: "/admin/workshops/manage",
  C18: "/admin/workshops/manage/new",
  C23: "/admin/workshop-roles",
  RP01: "/admin/reporting/run",
  RP02: "/admin/reporting/templates",
  RP03: "/admin/reporting/templates/categories/new",
  RP04: "/admin/reporting/scheduled",
  L01: "/admin/location/brands",
  L02: "/admin/location/brands/manage?tab=profile",
  L03: "/admin/location/brands/manage?tab=academic",
  L04: "/admin/location/brands/manage?tab=academic",
  L05: "/admin/location/brands/manage?tab=financial",
  L06: "/admin/location/brands/manage?tab=accessibility",
  L07: "/admin/location/brands/manage?tab=email",
  L08: "/admin/location/regions",
  L09: "/admin/location/provinces",
  L10: "/admin/location/campuses",
  L11: "/admin/location/campuses/new",
  L12: "/admin/location/classrooms/new",
  L13: "/admin/location/campuses?types=1",
  L14: "/admin/location/ministries",
  L15: "/admin/location/institutions",
  L16: "/admin/location/institutions/manage?tab=agreements",
  L17: "/admin/location/institutions/manage?tab=bridge",
  L18: "/admin/location/institutions/manage?tab=courses",
  L19: "/admin/location/institutions/manage?tab=courses&add=1",
  SC01: "/admin/sysconfig/workflows",
  SC02: "/admin/sysconfig/assessments",
  SC03: "/admin/sysconfig/assessment-categories",
  SC04: "/admin/sysconfig/advisor-linking",
  SC05: "/admin/sysconfig/document-types",
  SC06: "/admin/sysconfig/flag-templates",
  SC07: "/admin/sysconfig/user-agreements",
  SC08: "/admin/sysconfig/agent-statuses",
  SC09: "/admin/sysconfig/student-statuses",
  SC10: "/admin/sysconfig/document-templates",
  SC11: "/admin/sysconfig/document-templates?popup=modules",
  SC12: "/admin/sysconfig/document-templates/audit",
  SC13: "/admin/sysconfig/correspondence",
  SC14: "/admin/sysconfig/forms",
  SC15: "/admin/sysconfig/sections",
  SC16: "/admin/sysconfig/sections/dashboard",
  SC17: "/admin/sysconfig/global-settings",
  SC18: "/admin/sysconfig/plugins",
  SC19: "/admin/sysconfig/reason-codes",
  SC20: "/admin/sysconfig/holidays",
  SC21: "/admin/sysconfig/email?tab=general",
  SC22: "/admin/sysconfig/email?tab=filters",
  SC23: "/admin/sysconfig/email?tab=bounces",
  SC24: "/admin/sysconfig/security?tab=session",
  SC25: "/admin/sysconfig/security?tab=password",
  SC26: "/admin/sysconfig/security?tab=mfa",
  SC27: "/admin/sysconfig/security?tab=questions",
  SC28: "/admin/sysconfig/security?tab=access",
  SC29: "/admin/sysconfig/security?tab=access&logs=1",
  SC30: "/admin/sysconfig/security?tab=service",
  SC31: "/admin/sysconfig/localization?tab=general",
  SC32: "/admin/sysconfig/localization?tab=countries",
  SC33: "/admin/sysconfig/localization?tab=currencies",
  SC34: "/admin/sysconfig/localization?tab=timezones",
  SC35: "/admin/sysconfig/security?tab=questions",
  SC36: "/admin/sysconfig/notification-templates",
  F01: "/admin/financial/transactions",
  F02: "/admin/financial/fees",
  F03: "/admin/financial/invoices",
  F04: "/admin/financial/disbursements",
  F05: "/admin/financial/awards",
  F06: "/admin/financial/adjustments",
  F07: "/admin/financial/agent-commissions",
  F08: "/admin/financial/payment-plans",
  F09: "/admin/financial/documents",
  F10: "/admin/financial/unallocated-funds",
  F11: "/admin/financial/alerts",
  F12: "/admin/financial/lockouts",
  F13: "/admin/financial/ledger-types",
  F14: "/admin/financial/payment-methods",
  F15: "/admin/financial/rate-categories",
  F16: "/admin/financial/plan-templates",
  F17: "/admin/financial/tax-rates",
  F18: "/admin/financial/disbursement-types",
  F19: "/admin/financial/promotions",
  F20: "/admin/financial/funding-sources",
  F21: "/admin/financial/collection-agencies",
  F22: "/admin/financial/promotion-allocations",
  F23: "/admin/financial/agents",
  SF01: "/admin/financial/student?tab=overview",
  SF02: "/admin/financial/student?tab=overview",
  SF03: "/admin/financial/student?tab=transactions",
  SF04: "/admin/financial/student?tab=transactions",
  SF05: "/admin/financial/student?tab=transactions",
  SF06: "/admin/financial/student?tab=invoices",
  SF07: "/admin/financial/student?tab=disbursements",
  SF08: "/admin/financial/student?tab=promotions",
  SF09: "/admin/financial/student?tab=plans",
  SF10: "/admin/financial/student?tab=documents",
};

const MODULE_PERMISSION: Record<string, PermissionModuleKey | null> = {
  "Global / Dashboard": "systemConfiguration",
  "My Profile / Settings": "facultyProfiles",
  "My Courses": "courseManagement",
  Workshops: "courseManagement",
  Students: "studentRecords",
  "Student Finance": "financialManagement",
  Requests: "userRequests",
  "Financial Management": "financialManagement",
  "Program Management": "programManagement",
  "Course Management": "courseManagement",
  "LMS / Course Delivery": "courseManagement",
  "LMS Activities & Resources": "courseManagement",
  Reporting: "reporting",
  "Location Management": "locationManagement",
  "User Management": "userManagement",
  "System Configuration": "systemConfiguration",
};

const SINGLETON_SCREENS = new Set(["S03"]);

function requireSchema(id: string) {
  const schema = screenSchema(id);
  if (!schema) throw httpError(404, `Unknown Heritage screen ${id}`, "NOT_FOUND");
  return schema;
}

async function guard(user: SessionClaims, schema: ScreenSchema, mode: "view" | "edit") {
  const key = MODULE_PERMISSION[schema.module];
  if (key) await assertPermission(user, key, mode);
}

/** Context ids come from the client; write-through hooks trust them, so confirm they belong to this institution. */
async function assertContextOwned(inst: string, ctx: { id: string | null; type: ContextType | null }) {
  if (!ctx.id || !ctx.type) return;
  const where = { id: ctx.id, institutionId: inst };
  const found =
    ctx.type === "student"
      ? await prisma.student.count({ where })
      : ctx.type === "course"
        ? await prisma.course.count({ where })
        : ctx.type === "program"
          ? await prisma.program.count({ where })
          : ctx.type === "term"
            ? await prisma.term.count({ where })
            : await prisma.heritageRecord.count({ where: { ...where, deletedAt: null } });
  if (!found) throw httpError(404, `That ${ctx.type} was not found`, "NOT_FOUND");
}

function storeOf(schema: ScreenSchema) {
  return STORE_ALIAS[schema.id] ?? schema.id;
}

function parseCtx(schema: ScreenSchema, raw: string | undefined): { key: string; id: string | null; type: ContextType | null } {
  const v = (raw ?? "").trim();
  if (!v) return { key: "", id: null, type: schema.context };
  const idx = v.indexOf(":");
  if (idx < 0) return { key: "", id: null, type: schema.context };
  return { key: v, id: v.slice(idx + 1), type: v.slice(0, idx) as ContextType };
}

async function actorName(user: SessionClaims) {
  const p = await prisma.person.findFirst({ where: { id: user.personId }, select: { givenName: true, familyName: true } });
  return p ? `${p.givenName} ${p.familyName}` : "Admin";
}

export async function audit(
  user: SessionClaims,
  screenId: string,
  contextKey: string,
  action: string,
  opts: { recordId?: string | null; before?: unknown; after?: unknown; note?: string | null } = {},
) {
  await prisma.heritageAuditEntry.create({
    data: {
      institutionId: user.institutionId,
      screenId,
      contextKey,
      recordId: opts.recordId ?? null,
      action,
      actorId: user.accountId,
      actorName: await actorName(user),
      beforeJson: opts.before === undefined ? null : JSON.stringify(stripFiles(opts.before)),
      afterJson: opts.after === undefined ? null : JSON.stringify(stripFiles(opts.after)),
      note: opts.note ?? null,
    },
  });
}

function stripFiles(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.entries(v as Data).map(([k, val]) =>
      val && typeof val === "object" && "dataUrl" in (val as Data) ? [k, { name: (val as Data).name, size: (val as Data).size }] : [k, val],
    ),
  );
}

function parseData(json: string): Data {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Data) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

export function registryOverview() {
  const raw = rawRegistry();
  const schemas = screenSchemas();
  return {
    source: raw.source,
    generatedFrom: raw.generatedFrom,
    counts: raw.counts,
    sidebar: raw.sidebar,
    modules: raw.modules.map((m) => ({
      name: m.name,
      dataPointCount: m.dataPointCount,
      screens: m.screens.map((s) => {
        const sc = schemas.get(s.id.toUpperCase())!;
        return {
          id: sc.id,
          name: sc.name,
          screenType: sc.screenType,
          mode: sc.mode,
          context: sc.context,
          partial: sc.partial,
          status: sc.status,
          dataPointCount: sc.dataPointCount,
          fields: sc.fields.length,
          filters: sc.filters.length,
          columns: sc.columns.length,
          actions: sc.actions.length,
          live: Boolean(DOMAIN_SOURCES[sc.id] || WRITE_THROUGH[sc.id]),
          dedicated: DEDICATED[sc.id] ?? null,
        };
      }),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Read                                                                 */
/* ------------------------------------------------------------------ */

export type ScreenQuery = {
  ctx?: string;
  q?: string;
  letter?: string;
  page?: number;
  perPage?: number;
  filters?: Record<string, string>;
};

type Row = {
  id: string;
  origin: "record" | "domain";
  status: string;
  data: Data;
  link?: { screen: string; ctx: string };
  contextKey?: string;
  updatedAt?: string;
  updatedBy?: string;
};

function effectiveColumns(schema: ScreenSchema, domainColumns?: Array<{ key: string; label: string }>) {
  const data = schema.columns.filter((c) => !c.feature).map((c) => ({ key: c.key, label: c.label }));
  if (data.length) return data;
  if (domainColumns?.length) return domainColumns;
  const cols = schema.fields
    .filter((f) => !["feature", "display", "file", "textarea", "password"].includes(f.kind))
    .slice(0, 6)
    .map((f) => ({ key: f.key, label: f.label }));
  if (!cols.length) {
    const firstText = schema.fields.find((f) => f.kind === "textarea");
    if (firstText) cols.push({ key: firstText.key, label: firstText.label });
  }
  return cols;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return String((v as Data).name ?? "");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function rowMatches(row: Row, filters: Record<string, string>, schema: ScreenSchema, q: string, letter: string, firstKey: string | undefined) {
  for (const [key, raw] of Object.entries(filters)) {
    const want = raw.trim();
    if (!want || /^all( types)?$/i.test(want)) continue;
    const def = schema.filters.find((f) => f.key === key);
    const value = cellText(row.data[key] ?? (key === "status" ? row.status : row.data[key.replace(/^f_/, "")]));
    if (def?.kind === "daterange" || want.includes("..")) {
      const [from, to] = want.split("..");
      const d = Object.values(row.data).map(cellText).find((x) => /^\d{4}-\d{2}-\d{2}/.test(x)) ?? "";
      if (from && d && d < from) return false;
      if (to && d && d.slice(0, 10) > to) return false;
      continue;
    }
    if (def?.kind === "date") {
      const d = value || Object.values(row.data).map(cellText).find((x) => /^\d{4}-\d{2}-\d{2}/.test(x)) || "";
      if (!d) continue;
      if (/end/i.test(def.label) ? d.slice(0, 10) > want : /start|from/i.test(def.label) ? d.slice(0, 10) < want : !d.startsWith(want)) return false;
      continue;
    }
    if (!value) {
      const hay = Object.values(row.data).map(cellText).join(" ").toLowerCase();
      if (!hay.includes(want.toLowerCase())) return false;
      continue;
    }
    if (key === "status" || /status|state|type|queue/.test(key)) {
      if (value.toLowerCase() !== want.toLowerCase() && !value.toLowerCase().includes(want.toLowerCase())) return false;
    } else if (!value.toLowerCase().includes(want.toLowerCase())) return false;
  }
  if (q) {
    const hay = `${Object.values(row.data).map(cellText).join(" ")} ${row.status}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  if (letter && firstKey) {
    const first = cellText(row.data[firstKey]).trim().charAt(0).toUpperCase();
    if (first !== letter.toUpperCase()) return false;
  }
  return true;
}

async function contextLabel(type: ContextType | null, id: string | null, institutionId: string) {
  if (!type || !id) return null;
  if (type === "student") {
    const s = await prisma.student.findFirst({ where: { id, institutionId }, include: { person: true } });
    return s ? `${s.person.familyName}, ${s.person.givenName} (${s.studentNumber})` : null;
  }
  if (type === "course") {
    const c = await prisma.course.findFirst({ where: { id, institutionId } });
    return c ? `${c.code} — ${c.title}` : null;
  }
  if (type === "program") {
    const p = await prisma.program.findFirst({ where: { id, institutionId } });
    return p ? `${p.code} — ${p.name}` : null;
  }
  if (type === "term") {
    const t = await prisma.term.findFirst({ where: { id, institutionId } });
    return t ? t.name : null;
  }
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId } });
  return r ? recordTitle(parseData(r.dataJson)) : null;
}

function recordTitle(data: Data) {
  const key = Object.keys(data).find((k) => /name|title/.test(k) && typeof data[k] === "string" && data[k]) ?? Object.keys(data).find((k) => typeof data[k] === "string" && data[k] && !k.startsWith("_"));
  return key ? String(data[key]) : "Untitled";
}

export async function getScreen(user: SessionClaims, id: string, query: ScreenQuery) {
  const schema = requireSchema(id);
  await guard(user, schema, "view");
  const canEdit = await guard(user, schema, "edit").then(
    () => true,
    () => false,
  );
  const store = storeOf(schema);
  const ctx = parseCtx(schema, query.ctx);
  const [records, overlays, auditCount, label] = await Promise.all([
    prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: store, deletedAt: null, singletonKey: null, ...(ctx.key ? { contextKey: ctx.key } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    }),
    prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: store, singletonKey: { startsWith: "overlay:" } },
    }),
    prisma.heritageAuditEntry.count({ where: { institutionId: user.institutionId, screenId: store, ...(ctx.key ? { contextKey: ctx.key } : {}) } }),
    contextLabel(ctx.type, ctx.id, user.institutionId),
  ]);

  const loader = DOMAIN_SOURCES[schema.id];
  const domain = loader ? await loader({ user, contextKey: ctx.key, contextId: ctx.id }) : null;
  const overlayMap = new Map(overlays.map((o) => [o.singletonKey!.slice("overlay:".length), o]));

  const rows: Row[] = [];
  for (const d of domain?.rows ?? ([] as DomainRow[])) {
    const o = overlayMap.get(d.id);
    if (o?.status === "deleted") continue;
    const data = o ? { ...d.data, ...parseData(o.dataJson) } : d.data;
    rows.push({ id: d.id, origin: "domain", status: o && o.status !== "active" ? o.status : d.status ?? "active", data, link: d.link, updatedAt: o?.updatedAt.toISOString() });
  }
  for (const r of records) {
    rows.push({ id: r.id, origin: "record", status: r.status, data: parseData(r.dataJson), contextKey: r.contextKey, updatedAt: r.updatedAt.toISOString(), updatedBy: r.updatedById });
  }

  let singleton: { id: string; data: Data; updatedAt: string } | null = null;
  if (schema.mode === "settings" || SINGLETON_SCREENS.has(schema.id)) {
    const s = await prisma.heritageRecord.findFirst({
      where: { institutionId: user.institutionId, screenId: store, contextKey: ctx.key, singletonKey: "singleton" },
    });
    singleton = s
      ? { id: s.id, data: { ...(domain?.summary ?? {}), ...parseData(s.dataJson) }, updatedAt: s.updatedAt.toISOString() }
      : domain?.summary
        ? { id: "", data: domain.summary, updatedAt: "" }
        : null;
  }

  const columns = effectiveColumns(schema, domain?.columns);
  const filtered = rows.filter((r) => rowMatches(r, query.filters ?? {}, schema, query.q ?? "", query.letter ?? "", columns[0]?.key));
  const perPage = query.perPage === -1 ? Math.max(filtered.length, 1) : Math.min(Math.max(query.perPage ?? 25, 5), 200);
  const page = Math.max(query.page ?? 1, 1);

  return {
    schema,
    store,
    dedicated: DEDICATED[schema.id] ?? null,
    writeThrough: Boolean(WRITE_THROUGH[schema.id]),
    source: domain?.source ?? null,
    context: ctx.type ? { type: ctx.type, key: ctx.key, id: ctx.id, label } : null,
    columns,
    rows: filtered.slice((page - 1) * perPage, page * perPage),
    total: filtered.length,
    unfilteredTotal: rows.length,
    page,
    perPage,
    singleton,
    summary: domain?.summary ?? null,
    auditCount,
    canEdit,
  };
}

/* ------------------------------------------------------------------ */
/* Write                                                                */
/* ------------------------------------------------------------------ */

const MAX_FILE = 3_000_000;

function coerce(schema: ScreenSchema, input: Data, partial: boolean, previous?: Data): Data {
  const out: Data = {};
  const missing: string[] = [];
  for (const f of schema.fields) {
    if (f.kind === "feature" || f.kind === "display") continue;
    const v = input[f.key];
    if (v === undefined) {
      if (!partial && f.required) missing.push(f.label);
      continue;
    }
    // Records saved before option checks existed may hold legacy values; resubmitting them unchanged stays allowed.
    const unchangedChoice = (f.kind === "select" || f.kind === "multiselect") && previous && JSON.stringify(previous[f.key]) === JSON.stringify(v);
    out[f.key] = unchangedChoice ? v : coerceValue(f, v);
    if (f.required && (out[f.key] === "" || out[f.key] === null || (Array.isArray(out[f.key]) && !(out[f.key] as unknown[]).length))) missing.push(f.label);
  }
  let extras = 0;
  for (const [k, v] of Object.entries(input)) {
    if (k in out || schema.fields.some((f) => f.key === k)) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k) || k === "__proto__" || /social_insurance|^sin(_|$)|_sin$|ssn|social_security|passport_(no|number)/i.test(k) || ++extras > 50) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = typeof v === "string" ? v.slice(0, 20000) : v;
  }
  if (missing.length) throw httpError(400, `Required: ${missing.join(", ")}`);
  return out;
}

function coerceValue(f: FieldDef, v: unknown): unknown {
  switch (f.kind) {
    case "checkbox":
      return v === true || v === "true" || v === "on" || v === "Yes";
    case "number":
    case "money":
    case "percent": {
      if (v === "" || v === null) return "";
      const n = Number(String(v).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) throw httpError(400, `${f.label} must be a number`);
      return n;
    }
    case "select": {
      const s = typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v);
      if (!s || !f.options?.length || f.ref) return s;
      const hit = f.options.find((o) => o.toLowerCase() === s.toLowerCase());
      if (!hit) throw httpError(400, `${f.label} must be one of: ${f.options.join(", ")}`);
      return hit;
    }
    case "multiselect": {
      const list = Array.isArray(v) ? v.map(String).slice(0, 200) : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!f.options?.length || f.ref) return list;
      return list.map((s) => {
        const hit = f.options!.find((o) => o.toLowerCase() === s.toLowerCase());
        if (!hit) throw httpError(400, `${f.label} must only contain: ${f.options!.join(", ")}`);
        return hit;
      });
    }
    case "email": {
      const s = String(v ?? "").trim();
      if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw httpError(400, `${f.label} must be a valid e-mail address`);
      return s;
    }
    case "url": {
      const s = String(v ?? "").trim();
      if (s && !/^(https?:\/\/|\/)/.test(s)) throw httpError(400, `${f.label} must start with http(s):// or /`);
      return s;
    }
    case "file": {
      if (!v) return null;
      if (typeof v === "object" && v && "dataUrl" in (v as Data)) {
        const file = v as { name?: string; size?: number; type?: string; dataUrl?: string };
        if ((file.dataUrl?.length ?? 0) > MAX_FILE * 1.4) throw httpError(400, `${f.label} must be under 3 MB`);
        const dataUrl = String(file.dataUrl ?? "");
        const mime = (/^data:([^;,]+)/.exec(dataUrl)?.[1] ?? String(file.type ?? "")).toLowerCase();
        if (dataUrl && !bytesMatchMime(decodeBase64(dataUrl), mime)) {
          throw httpError(400, `${f.label} must be a genuine image, PDF, Word, Excel or text file`);
        }
        return { name: String(file.name ?? "file"), size: Number(file.size ?? 0), type: String(file.type ?? ""), dataUrl: String(file.dataUrl ?? "") };
      }
      return typeof v === "object" ? v : String(v);
    }
    case "password":
      return String(v ?? "") ? "••••••••" : "";
    default:
      return typeof v === "string" ? v.slice(0, 20000) : v === null ? "" : String(v);
  }
}

export async function createRecord(user: SessionClaims, id: string, body: { ctx?: string; data: Data }) {
  const schema = requireSchema(id);
  await guard(user, schema, "edit");
  const store = storeOf(schema);
  const ctx = parseCtx(schema, body.ctx);
  const data = coerce(schema, body.data ?? {}, false);
  if (schema.context && !ctx.key && WRITE_THROUGH[schema.id]) throw httpError(400, `Select a ${schema.context} first`);
  await assertContextOwned(user.institutionId, ctx);

  const hook = WRITE_THROUGH[schema.id];
  const result = hook ? await hook(user, body.data ?? {}, ctx.id) : null;
  if (result?.domainId) {
    const merged = { ...data, ...(result.data ?? {}) };
    const overlay = await prisma.heritageRecord.create({
      data: {
        institutionId: user.institutionId,
        screenId: store,
        contextKey: ctx.key,
        singletonKey: `overlay:${result.domainId}`,
        dataJson: JSON.stringify(merged),
        createdById: user.accountId,
        updatedById: user.accountId,
      },
    });
    await audit(user, store, ctx.key, `create (${schema.submitLabel})`, { recordId: result.domainId, after: { ...merged, _overlayId: overlay.id }, note: result.message });
    return { ok: true, id: result.domainId, message: result.message ?? "Saved" };
  }

  const rec = await prisma.heritageRecord.create({
    data: {
      institutionId: user.institutionId,
      screenId: store,
      contextKey: ctx.key,
      dataJson: JSON.stringify(data),
      status: typeof data.active_inactive === "string" && data.active_inactive ? String(data.active_inactive) : "active",
      createdById: user.accountId,
      updatedById: user.accountId,
    },
  });
  await audit(user, store, ctx.key, `create (${schema.submitLabel})`, { recordId: rec.id, after: data, note: schema.id !== store ? `via ${schema.id}` : null });
  return { ok: true, id: rec.id, message: result?.message ?? `${schema.submitLabel} — saved` };
}

export async function saveSingleton(user: SessionClaims, id: string, body: { ctx?: string; data: Data }) {
  const schema = requireSchema(id);
  await guard(user, schema, "edit");
  const store = storeOf(schema);
  const ctx = parseCtx(schema, body.ctx);
  if (schema.context && !ctx.key) throw httpError(400, `Select a ${schema.context} first`);
  await assertContextOwned(user.institutionId, ctx);
  const data = coerce(schema, body.data ?? {}, false);
  const hook = WRITE_THROUGH[schema.id];
  const result = hook ? await hook(user, body.data ?? {}, ctx.id) : null;
  const existing = await prisma.heritageRecord.findFirst({
    where: { institutionId: user.institutionId, screenId: store, contextKey: ctx.key, singletonKey: "singleton" },
  });
  const saved = existing
    ? await prisma.heritageRecord.update({
        where: { id: existing.id },
        data: { dataJson: JSON.stringify({ ...parseData(existing.dataJson), ...data }), updatedById: user.accountId, rowVersion: { increment: 1 } },
      })
    : await prisma.heritageRecord.create({
        data: {
          institutionId: user.institutionId,
          screenId: store,
          contextKey: ctx.key,
          singletonKey: "singleton",
          dataJson: JSON.stringify(data),
          createdById: user.accountId,
          updatedById: user.accountId,
        },
      });
  await audit(user, store, ctx.key, `save (${schema.submitLabel})`, { recordId: saved.id, before: existing ? parseData(existing.dataJson) : undefined, after: data, note: result?.message });
  return { ok: true, id: saved.id, message: result?.message ?? `${schema.submitLabel} — saved` };
}

async function loadRecord(user: SessionClaims, store: string, recordId: string) {
  const rec = await prisma.heritageRecord.findFirst({ where: { id: recordId, institutionId: user.institutionId, screenId: store, deletedAt: null } });
  if (!rec) throw httpError(404, "Record not found", "NOT_FOUND");
  return rec;
}

async function upsertOverlay(user: SessionClaims, store: string, contextKey: string, domainId: string, patch: Data, status?: string) {
  const key = `overlay:${domainId}`;
  const existing = await prisma.heritageRecord.findFirst({ where: { institutionId: user.institutionId, screenId: store, singletonKey: key } });
  if (existing) {
    return prisma.heritageRecord.update({
      where: { id: existing.id },
      data: {
        dataJson: JSON.stringify({ ...parseData(existing.dataJson), ...patch }),
        ...(status ? { status } : {}),
        updatedById: user.accountId,
        rowVersion: { increment: 1 },
      },
    });
  }
  return prisma.heritageRecord.create({
    data: {
      institutionId: user.institutionId,
      screenId: store,
      contextKey,
      singletonKey: key,
      dataJson: JSON.stringify(patch),
      status: status ?? "active",
      createdById: user.accountId,
      updatedById: user.accountId,
    },
  });
}

const isDomainId = (recordId: string) => /^[a-z]+:/.test(recordId);

export async function updateRecord(user: SessionClaims, id: string, recordId: string, body: { ctx?: string; data: Data }) {
  const schema = requireSchema(id);
  await guard(user, schema, "edit");
  const store = storeOf(schema);
  const ctx = parseCtx(schema, body.ctx);
  if (isDomainId(recordId)) {
    const data = coerce(schema, body.data ?? {}, true);
    const message = await updateDomainRecord(user, recordId, data);
    if (!message) throw httpError(409, "This live record is read-only on this screen. Use its dedicated management page.", "DOMAIN_RECORD_READ_ONLY");
    await audit(user, store, ctx.key, "update", { recordId, after: data, note: "Persisted to domain table" });
    return { ok: true, id: recordId, message };
  }
  const rec = await loadRecord(user, store, recordId);
  const before = parseData(rec.dataJson);
  const data = coerce(schema, body.data ?? {}, true, before);
  const after = { ...before, ...data };
  await prisma.heritageRecord.update({
    where: { id: rec.id },
    data: {
      dataJson: JSON.stringify(after),
      ...(typeof data.active_inactive === "string" && data.active_inactive ? { status: String(data.active_inactive) } : {}),
      updatedById: user.accountId,
      rowVersion: { increment: 1 },
    },
  });
  await audit(user, store, rec.contextKey, "update", { recordId: rec.id, before, after });
  return { ok: true, id: rec.id, message: "Updated" };
}

export async function deleteRecord(user: SessionClaims, id: string, recordId: string, note?: string) {
  const schema = requireSchema(id);
  await guard(user, schema, "edit");
  const store = storeOf(schema);
  if (isDomainId(recordId)) {
    const msg = await domainStatus(user, recordId, "removed", note);
    const o = await upsertOverlay(user, store, "", recordId, {}, "deleted");
    await audit(user, store, "", "delete", { recordId, after: { _overlayId: o.id }, note: msg ?? null });
    return { ok: true, message: msg ?? "Removed from this list" };
  }
  const rec = await loadRecord(user, store, recordId);
  await prisma.heritageRecord.update({ where: { id: rec.id }, data: { deletedAt: new Date(), status: "deleted", updatedById: user.accountId, rowVersion: { increment: 1 } } });
  await audit(user, store, rec.contextKey, "delete", { recordId: rec.id, before: parseData(rec.dataJson), note: note ?? null });
  return { ok: true, message: "Deleted" };
}

export async function runAction(
  user: SessionClaims,
  id: string,
  body: { actionId: string; recordIds?: string[]; ctx?: string; note?: string; status?: string },
) {
  const schema = requireSchema(id);
  const action = schema.actions.find((a) => a.id === body.actionId);
  if (!action) throw httpError(404, "Unknown action", "NOT_FOUND");
  await guard(user, schema, ["view", "export", "search", "select", "cancel"].includes(action.kind) ? "view" : "edit");
  const store = storeOf(schema);
  const ctx = parseCtx(schema, body.ctx);
  const targets = body.recordIds ?? [];
  const messages: string[] = [];

  if (action.kind === "status" || (action.kind === "bulk" && body.status)) {
    const status = body.status ?? action.status ?? "Updated";
    for (const rid of targets) {
      if (isDomainId(rid)) {
        const msg = await domainStatus(user, rid, status, body.note);
        await upsertOverlay(user, store, ctx.key, rid, {}, status);
        if (msg) messages.push(msg);
      } else {
        const rec = await loadRecord(user, store, rid);
        await prisma.heritageRecord.update({ where: { id: rec.id }, data: { status, updatedById: user.accountId, rowVersion: { increment: 1 } } });
      }
      await audit(user, store, ctx.key, `${action.label} → ${status}`, { recordId: rid, note: body.note ?? null });
    }
    return { ok: true, message: messages[0] ?? `${action.label}: ${targets.length} record(s) set to ${status}` };
  }

  if (action.kind === "copy") {
    for (const rid of targets) {
      const source = isDomainId(rid) ? null : await loadRecord(user, store, rid);
      const data = source ? parseData(source.dataJson) : {};
      const nameKey = Object.keys(data).find((k) => /name|title/.test(k));
      if (nameKey) data[nameKey] = `${String(data[nameKey])} (copy)`;
      const copy = await prisma.heritageRecord.create({
        data: { institutionId: user.institutionId, screenId: store, contextKey: source?.contextKey ?? ctx.key, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
      });
      await audit(user, store, ctx.key, action.label, { recordId: copy.id, after: data, note: `copied from ${rid}` });
    }
    return { ok: true, message: `${targets.length} record(s) copied` };
  }

  if (action.kind === "run" && targets.length && /refund/i.test(action.label)) {
    for (const rid of targets) {
      const msg = await domainStatus(user, rid, "refund", body.note);
      await audit(user, store, ctx.key, action.label, { recordId: rid, note: msg ?? body.note ?? null });
    }
  } else {
    await audit(user, store, ctx.key, action.label, { recordId: targets[0] ?? null, note: body.note ?? (targets.length > 1 ? `${targets.length} records` : null) });
  }
  return { ok: true, message: `${action.label} — recorded${targets.length ? ` for ${targets.length} record(s)` : ""}` };
}

export async function listAudit(user: SessionClaims, id: string, query: { ctx?: string; recordId?: string }) {
  const schema = requireSchema(id);
  await guard(user, schema, "view");
  const store = storeOf(schema);
  const ctx = parseCtx(schema, query.ctx);
  const domainRecord = Boolean(query.recordId?.includes(":"));
  let screenScope: { screenId: string | { in: string[] } } = { screenId: store };
  if (domainRecord) {
    const access = await effectiveAccess(user.institutionId, user.accountId);
    const visible = new Set<string>();
    for (const s of screenSchemas().values()) {
      const key = MODULE_PERMISSION[s.module];
      if (!key || canView(access.permissions[key])) visible.add(storeOf(s));
    }
    screenScope = { screenId: { in: [...visible] } };
  }
  const rows = await prisma.heritageAuditEntry.findMany({
    where: {
      institutionId: user.institutionId,
      ...screenScope,
      ...(ctx.key && !domainRecord ? { contextKey: ctx.key } : {}),
      ...(query.recordId ? { OR: [{ recordId: query.recordId }, { note: query.recordId }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actorName,
      at: r.createdAt.toISOString(),
      note: r.note,
      before: r.beforeJson ? parseData(r.beforeJson) : null,
      after: r.afterJson ? parseData(r.afterJson) : null,
    })),
  };
}

export async function exportCsv(user: SessionClaims, id: string, query: ScreenQuery) {
  const view = await getScreen(user, id, { ...query, page: 1, perPage: -1 });
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const cols: Array<{ key: string; label: string }> = [...view.columns];
  const seen = new Set(cols.map((c) => c.key));
  for (const f of view.schema.fields) {
    if (f.kind === "feature" || seen.has(f.key)) continue;
    seen.add(f.key);
    cols.push({ key: f.key, label: f.label });
  }
  for (const r of view.rows)
    for (const k of Object.keys(r.data)) {
      if (k.startsWith("_") || seen.has(k)) continue;
      seen.add(k);
      cols.push({ key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    }
  const lines = [[...cols.map((c) => c.label), "Status"].map(esc).join(",")];
  for (const r of view.rows) lines.push([...cols.map((c) => cellText(r.data[c.key])), r.status].map(esc).join(","));
  await audit(user, view.store, view.context?.key ?? "", "export CSV", { note: `${view.rows.length} rows` });
  return { filename: `${view.schema.id}-${view.schema.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`, csv: lines.join("\n") };
}

/* ------------------------------------------------------------------ */
/* Reference lists and context pickers                                  */
/* ------------------------------------------------------------------ */

const REF_SCREENS: Record<string, string> = {
  paymentMethods: "F14",
  ledgerTypes: "F13",
  taxRates: "F17",
  rateCategories: "F15",
  disbursementTypes: "F18",
  fundingSources: "F20",
  programTypes: "PM:PROGRAM_TYPE",
  pathways: "PM:PATHWAY",
  courseCategories: "C19",
  courseGroups: "C20",
  courseTypes: "C21",
  gradingSchemes: "C26",
  competencies: "C25",
  badges: "C24",
  reasonCodes: "SC19",
  statuses: "SC09",
  templates: "SC10",
  currencies: "SC33",
  timezones: "SC34",
  languages: "SC31",
  faculties: "PM:FACULTY",
  assessmentCategories: "SC03",
  agents: "F07",
};

const DEFAULTS: Record<string, string[]> = {
  countries: ["Canada", "United States", "India", "Philippines", "China", "Mexico", "United Kingdom", "Nigeria", "Vietnam", "Brazil", "Colombia", "South Korea", "Iran", "Pakistan", "Nepal"],
  provinces: [
    "British Columbia",
    "Alberta",
    "Saskatchewan",
    "Manitoba",
    "Ontario",
    "Quebec",
    "New Brunswick",
    "Nova Scotia",
    "Prince Edward Island",
    "Newfoundland and Labrador",
    "Yukon",
    "Northwest Territories",
    "Nunavut",
  ],
  timezones: ["America/Vancouver", "America/Edmonton", "America/Regina", "America/Winnipeg", "America/Toronto", "America/Halifax", "America/St_Johns", "UTC", "Asia/Kolkata"],
  currencies: ["CAD", "USD", "INR", "EUR", "GBP"],
  languages: ["English", "French"],
  settingValues: ["Enabled", "Disabled", "Required", "Optional", "Automatic", "Manual", "Student", "Staff", "Student / Staff", "All", "None"],
  paymentMethods: ["Cash", "Cheque", "Credit Card", "Debit", "E-Transfer", "Wire Transfer"],
  rateCategories: ["Domestic", "International"],
};

/** System Configuration records (stored by sysconfig.ts) replace the built-in defaults once they exist. */
async function sysRefLists(inst: string) {
  const screens = ["SYS:STUDENT_STATUS", "SYS:REASON_CODE", "SYS:CURRENCY", "SYS:TIMEZONE", "SYS:LANGUAGE", "SYS:ASSESSMENT_CATEGORY", "SYS:DOC_TEMPLATE", "SYS:COUNTRY"];
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: screens }, deletedAt: null, singletonKey: null },
    select: { id: true, screenId: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  const of = (screen: string) => rows.filter((r) => r.screenId === screen).map((r) => ({ id: r.id, data: parseData(r.dataJson) }));
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const ord = (d: Data) => (typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER);
  const byName = (a: { data: Data }, b: { data: Data }) => str(a.data.name).localeCompare(str(b.data.name));
  const statuses = of("SYS:STUDENT_STATUS").sort((a, b) => ord(a.data) - ord(b.data));
  const statusTree = statuses.filter((r) => !str(r.data.parent)).flatMap((p) => [p, ...statuses.filter((c) => str(c.data.parent) === p.id)]);
  const out: Record<string, string[]> = {
    statuses: statusTree.map((r) => str(r.data.name)),
    reasonCodes: of("SYS:REASON_CODE").filter((r) => r.data.active !== "Inactive").sort(byName).map((r) => str(r.data.name)),
    currencies: of("SYS:CURRENCY").filter((r) => r.data.active !== "No").map((r) => str(r.data.code)).sort(),
    timezones: of("SYS:TIMEZONE").sort((a, b) => ord(a.data) - ord(b.data)).map((r) => str(r.data.zone)),
    languages: of("SYS:LANGUAGE").filter((r) => r.data.status !== "Inactive").sort(byName).map((r) => str(r.data.name)),
    assessmentCategories: of("SYS:ASSESSMENT_CATEGORY").sort(byName).map((r) => str(r.data.name)),
    templates: of("SYS:DOC_TEMPLATE").sort(byName).map((r) => str(r.data.name)),
    countries: of("SYS:COUNTRY").sort(byName).map((r) => str(r.data.name)),
  };
  return Object.fromEntries(Object.entries(out).filter(([, list]) => list.length));
}

/** Financial Management configuration (finance.spec.ts) replaces the generic F13–F20 lists once seeded. */
async function finRefLists(inst: string) {
  const screens = ["FIN:PAYMENT_METHOD", "FIN:LEDGER_TYPE", "FIN:TAX_RATE", "FIN:RATE_CATEGORY", "FIN:DISB_TYPE", "FIN:FUNDING_SOURCE", "FIN:AGENT", "FIN:COLLECTION_AGENCY", "FIN:PROMOTION"];
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: screens }, deletedAt: null, singletonKey: null },
    select: { screenId: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const of = (screen: string) => rows.filter((r) => r.screenId === screen).map((r) => parseData(r.dataJson));
  const names = (list: Data[]) => list.map((d) => str(d.name)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const ord = (d: Data) => (typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER);
  const out: Record<string, string[]> = {
    paymentMethods: names(of("FIN:PAYMENT_METHOD")),
    ledgerTypes: names(of("FIN:LEDGER_TYPE")),
    taxRates: names(of("FIN:TAX_RATE")),
    rateCategories: of("FIN:RATE_CATEGORY").filter((d) => d.active !== "No").sort((a, b) => ord(a) - ord(b)).map((d) => str(d.name)),
    disbursementTypes: names(of("FIN:DISB_TYPE")),
    fundingSources: names(of("FIN:FUNDING_SOURCE").filter((d) => d.status !== "Inactive")),
    agents: of("FIN:AGENT").map((d) => `${str(d.lastName)}, ${str(d.firstName)} (${str(d.agentNumber)})`).sort((a, b) => a.localeCompare(b)),
    collectionAgencies: names(of("FIN:COLLECTION_AGENCY")),
    promotions: names(of("FIN:PROMOTION")),
  };
  return Object.fromEntries(Object.entries(out).filter(([, list]) => list.length));
}

/** Location Management records (stored by location.ts) feed the campus / brand / room dropdowns everywhere. */
async function locationRefLists(inst: string) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: ["LOC:BRAND", "LOC:REGION", "LOC:PROVINCE", "LOC:CAMPUS", "LOC:CLASSROOM", "LOC:CLASSROOM_TYPE"] }, deletedAt: null, singletonKey: null },
    select: { id: true, screenId: true, contextKey: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  const of = (screen: string) => rows.filter((r) => r.screenId === screen).map((r) => ({ ...r, data: parseData(r.dataJson) }));
  const active = (d: Data) => String(d.active || "Active") === "Active";
  const name = (d: Data) => String(d.name ?? "");
  const campuses = of("LOC:CAMPUS");
  const campusName = new Map(campuses.map((c) => [c.id, name(c.data)]));
  return {
    brands: of("LOC:BRAND").filter((r) => active(r.data)).map((r) => name(r.data)),
    regions: of("LOC:REGION").map((r) => name(r.data)),
    provinces: of("LOC:PROVINCE").filter((r) => active(r.data)).map((r) => name(r.data)),
    campuses: campuses.filter((r) => active(r.data)).map((r) => name(r.data)),
    classrooms: of("LOC:CLASSROOM").filter((r) => active(r.data)).map((r) => `${campusName.get(r.contextKey) ?? ""} · ${name(r.data)}`),
    classroomTypes: of("LOC:CLASSROOM_TYPE").map((r) => name(r.data)),
    managed: campuses.length > 0,
  };
}

export async function refs(user: SessionClaims) {
  const inst = user.institutionId;
  const [loc, sys, fin] = await Promise.all([locationRefLists(inst), sysRefLists(inst), finRefLists(inst)]);
  const configRecords = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: [...new Set(Object.values(REF_SCREENS))] }, deletedAt: null, singletonKey: null },
    select: { screenId: true, dataJson: true },
  });
  const byScreen = new Map<string, string[]>();
  for (const r of configRecords) byScreen.set(r.screenId, [...(byScreen.get(r.screenId) ?? []), recordTitle(parseData(r.dataJson))]);

  const [programs, terms, fterms, courses, sections, students, accounts, workshops, cohorts, accessLevels] = await Promise.all([
    prisma.program.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } }),
    prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" } }),
    prisma.financialTerm.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" } }),
    prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" } }),
    prisma.section.findMany({ where: { institutionId: inst }, include: { course: true, term: true }, take: 500, orderBy: { createdAt: "desc" } }),
    prisma.student.findMany({ where: { institutionId: inst }, include: { person: true }, take: 1500, orderBy: { createdAt: "desc" } }),
    prisma.account.findMany({ where: { institutionId: inst }, include: { person: true }, take: 1500 }),
    prisma.workshop.findMany({ where: { institutionId: inst }, orderBy: { startsAt: "desc" } }),
    prisma.cohort.findMany({ where: { institutionId: inst }, select: { campus: true, label: true, code: true } }),
    listAccessLevels(inst),
  ]);
  const cohortLabels = cohorts.map((c) => ({ label: c.label || c.code }));
  const staff = accounts
    .filter((a) => /instructor|admin|registrar|advisor|staff/.test(a.rolesJson))
    .map((a) => `${a.person.givenName} ${a.person.familyName}`);
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const out: Record<string, string[]> = {
    campuses: uniq([...(loc.managed ? loc.campuses : CAMPUSES), ...cohorts.map((c) => c.campus ?? "")]),
    brands: loc.brands,
    regions: loc.regions,
    provinces: uniq([...loc.provinces, ...(DEFAULTS.provinces ?? [])]),
    classrooms: loc.classrooms,
    classroomTypes: loc.classroomTypes,
    programs: uniq([...programs.map((p) => p.name), ...STUDENT_PROGRAMS.map((p) => p.name)]),
    terms: uniq([...terms.map((t) => t.name), ...fterms.map((t) => t.name)]),
    courses: courses.map((c) => `${c.code} — ${c.title}`),
    sections: sections.map((s) => `${s.course.code} ${s.code} · ${s.term.name}`),
    students: students.map((s) => `${s.person.familyName}, ${s.person.givenName} (${s.studentNumber})`),
    staff: uniq(staff),
    workshops: workshops.map((w) => `${w.code} — ${w.title}`),
    accessLevels: accessLevels.map((l) => l.name),
    statuses: uniq([...STUDENT_STATUSES, ...(byScreen.get("SC09") ?? [])]),
    schedules: uniq(cohortLabels.map((c) => c.label)),
    ...sys,
    ...fin,
  };
  for (const [ref, screen] of Object.entries(REF_SCREENS)) {
    if (out[ref]) continue;
    out[ref] = uniq([...(DEFAULTS[ref] ?? []), ...(byScreen.get(screen) ?? [])]);
  }
  for (const [ref, list] of Object.entries(DEFAULTS)) if (!out[ref]) out[ref] = list;
  return out;
}

export async function contextOptions(user: SessionClaims, type: string, q: string) {
  const inst = user.institutionId;
  const term = q.trim();
  if (type === "student") {
    const list = await prisma.student.findMany({
      where: {
        institutionId: inst,
        ...(term
          ? { OR: [{ studentNumber: { contains: term, mode: "insensitive" } }, { person: { familyName: { contains: term, mode: "insensitive" } } }, { person: { givenName: { contains: term, mode: "insensitive" } } }] }
          : {}),
      },
      include: { person: true },
      take: 30,
      orderBy: { createdAt: "desc" },
    });
    return list.map((s) => ({ key: `student:${s.id}`, label: `${s.person.familyName}, ${s.person.givenName} (${s.studentNumber})` }));
  }
  if (type === "course") {
    const list = await prisma.course.findMany({
      where: { institutionId: inst, ...(term ? { OR: [{ code: { contains: term, mode: "insensitive" } }, { title: { contains: term, mode: "insensitive" } }] } : {}) },
      take: 30,
      orderBy: { code: "asc" },
    });
    return list.map((c) => ({ key: `course:${c.id}`, label: `${c.code} — ${c.title}` }));
  }
  if (type === "program") {
    const list = await prisma.program.findMany({ where: { institutionId: inst, ...(term ? { name: { contains: term, mode: "insensitive" } } : {}) }, take: 30 });
    return list.map((p) => ({ key: `program:${p.id}`, label: `${p.code} — ${p.name}` }));
  }
  if (type === "term") {
    const list = await prisma.term.findMany({ where: { institutionId: inst, ...(term ? { name: { contains: term, mode: "insensitive" } } : {}) }, take: 30, orderBy: { startsOn: "desc" } });
    return list.map((t) => ({ key: `term:${t.id}`, label: t.name }));
  }
  const screen = type === "brand" ? "LOC:BRAND" : type === "institution" ? "LOC:INSTITUTION" : null;
  if (!screen) return [];
  const recs = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null }, take: 100 });
  return recs
    .map((r) => ({ key: `${type}:${r.id}`, label: recordTitle(parseData(r.dataJson)) }))
    .filter((o) => !term || o.label.toLowerCase().includes(term.toLowerCase()));
}

const GATE_WINDOW_MS = 15 * 60_000;
const GATE_MAX_FAILURES = 5;
const gateFailures = new Map<string, number[]>();

export async function verifyGate(user: SessionClaims, password: string) {
  const now = Date.now();
  const recent = (gateFailures.get(user.accountId) ?? []).filter((t) => now - t < GATE_WINDOW_MS);
  if (recent.length >= GATE_MAX_FAILURES) throw httpError(429, "Too many incorrect attempts. Try again in 15 minutes.", "RATE_LIMITED");
  const account = await prisma.account.findFirst({ where: { id: user.accountId, institutionId: user.institutionId } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    gateFailures.set(user.accountId, [...recent, now]);
    if (gateFailures.size > 10_000) gateFailures.clear();
    throw httpError(400, "Current password is incorrect", "INVALID_PASSWORD");
  }
  gateFailures.delete(user.accountId);
  await audit(user, "P11", "", "Account verification passed");
  return { ok: true, message: "Account verified" };
}
