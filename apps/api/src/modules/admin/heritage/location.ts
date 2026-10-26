import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { CAMPUSES, assertPermission, patchStudentMeta, studentMetaMap } from "../superAdmin.service.js";
import { audit, refs } from "./service.js";
import { courseRefLists } from "./courses.refs.js";
import { bytesMatchMime, decodeBase64 } from "../../../lib/fileSniff.js";
import { encryptConfigSecret } from "../../../lib/configSecrets.js";

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

export const LOC = {
  brand: "LOC:BRAND",
  brandSettings: "LOC:BRAND_SETTINGS",
  emailService: "LOC:EMAIL_SERVICE",
  region: "LOC:REGION",
  province: "LOC:PROVINCE",
  campus: "LOC:CAMPUS",
  classroom: "LOC:CLASSROOM",
  classroomType: "LOC:CLASSROOM_TYPE",
  ministry: "LOC:MINISTRY",
  institution: "LOC:INSTITUTION",
  agreement: "LOC:AGREEMENT",
  bridge: "LOC:BRIDGE",
  transferCourse: "LOC:TRANSFER_COURSE",
  file: "LOC:FILE",
  seed: "LOC:SEED",
} as const;

type Data = Record<string, unknown>;
type Rec = { id: string; contextKey: string; data: Data; createdAt: Date; updatedAt: Date };

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const parse = (json: string): Data => {
  try {
    return JSON.parse(json) as Data;
  } catch {
    return {};
  }
};
const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const lc = (v: unknown) => s(v).trim().toLowerCase();

/** Prefer current Course Management records while retaining legacy C19 data as a fallback. */
export function campusCourseCategories(managed?: string[], legacy?: string[]) {
  return [...new Set((managed?.length ? managed : legacy) ?? [])].filter(Boolean);
}

async function list(inst: string, screen: string, contextKey?: string): Promise<Rec[]> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null, ...(contextKey !== undefined ? { contextKey } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt }));
}

async function find(inst: string, screen: string, id: string, label: string): Promise<Rec> {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return { id: r.id, contextKey: r.contextKey, data: parse(r.dataJson), createdAt: r.createdAt, updatedAt: r.updatedAt };
}

async function insert(inst: string, actorId: string, screen: string, data: Data, contextKey = "") {
  return prisma.heritageRecord.create({ data: { institutionId: inst, screenId: screen, contextKey, dataJson: JSON.stringify(data), createdById: actorId, updatedById: actorId } });
}

async function update(actorId: string, id: string, data: Data, contextKey?: string) {
  await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(data), updatedById: actorId, rowVersion: { increment: 1 }, ...(contextKey !== undefined ? { contextKey } : {}) } });
}

async function remove(inst: string, actorId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.heritageRecord.updateMany({ where: { id: { in: ids }, institutionId: inst }, data: { deletedAt: new Date(), updatedById: actorId, status: "deleted" } });
}

/* ------------------------------------------------------------------ */
/* Field vocabulary                                                     */
/* ------------------------------------------------------------------ */

type Kind = "text" | "email" | "domain" | "number" | "date" | "select" | "bool" | "multi" | "textarea" | "html" | "file" | "files" | "ref" | "map" | "secret";
type RefTarget = "brands" | "regions" | "provinces" | "campuses" | "classroomTypes" | "course";
type Dyn = "languages" | "timezones" | "currencies" | "countries" | "programs" | "pathways" | "courseCategories";

export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: readonly string[];
  dyn?: Dyn;
  dynExtra?: readonly string[];
  ref?: RefTarget;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  /** Field only applies (and is only required) when this returns true. */
  when?: { key: string; equals: string | boolean | readonly string[]; not?: boolean };
  section?: string;
  group?: string;
  sub?: string;
  suffix?: string;
  hint?: string;
  lang?: boolean;
};

const ACTIVE = ["Active", "Inactive"] as const;
const YES_NO = ["Yes", "No"] as const;
const NO_YES = ["No", "Yes"] as const;
const EN_DIS = ["Enabled", "Disabled"] as const;
const DIS_EN = ["Disabled", "Enabled"] as const;
const SHOW_HIDE = ["Show", "Hide"] as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const EMAIL_CONDITIONS = ["Applications", "Requirements", "Requests", "Misc Notifications", "Reporting", "Email General Sending", "Email Forwarding"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?=.{3,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function applies(f: Field, d: Data) {
  if (!f.when) return true;
  const v = d[f.when.key];
  const hit = Array.isArray(f.when.equals) ? (f.when.equals as readonly unknown[]).includes(v) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

type RefLookup = (target: RefTarget, id: string) => Promise<boolean>;

async function clean(inst: string, fields: Field[], input: Data, base: Data, lookup: RefLookup): Promise<Data> {
  const out: Data = { ...base };
  for (const f of fields) {
    if (f.key in input) out[f.key] = input[f.key];
    else if (!(f.key in out) && f.dflt !== undefined) out[f.key] = f.dflt;
  }
  const errors: string[] = [];
  for (const f of fields) {
    if (!applies(f, out)) {
      if (f.kind !== "secret") out[f.key] = f.kind === "bool" ? false : f.kind === "multi" || f.kind === "files" ? [] : f.kind === "file" ? null : f.kind === "number" ? null : "";
      continue;
    }
    const raw = out[f.key];
    switch (f.kind) {
      case "text":
      case "textarea":
      case "html":
      case "email":
      case "domain":
      case "select":
      case "date": {
        let v = s(raw).trim();
        const maxLen = f.kind === "html" ? 100_000 : f.kind === "textarea" ? 4000 : 200;
        if (v.length > maxLen) errors.push(`${f.label} is too long`);
        if (f.kind === "html") v = sanitizeHtml(v);
        if (f.kind === "domain") v = v.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (!v) {
          if (f.required) errors.push(`${f.label} is required`);
        } else if (f.kind === "email" && !EMAIL_RE.test(v)) errors.push(`${f.label} must be a valid e-mail address`);
        else if (f.kind === "domain" && !DOMAIN_RE.test(v)) errors.push(`${f.label} must be a domain name such as myhccbc.com`);
        else if (f.kind === "date" && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) errors.push(`${f.label} must be a valid date`);
        else if (f.kind === "select" && f.options && !f.options.includes(v)) errors.push(`${f.label}: "${v}" is not a valid choice`);
        out[f.key] = v;
        break;
      }
      case "secret": {
        const v = s(raw);
        if (v.length > 200) errors.push(`${f.label} is too long`);
        out[f.key] = v ? encryptConfigSecret(v) : s(base[f.key]);
        break;
      }
      case "number": {
        if (raw === "" || raw === null || raw === undefined) {
          if (f.required) errors.push(`${f.label} is required`);
          out[f.key] = null;
          break;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) errors.push(`${f.label} must be a number`);
        else if (f.integer && !Number.isInteger(n)) errors.push(`${f.label} must be a whole number`);
        else if (f.min !== undefined && n < f.min) errors.push(`${f.label} must be at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) errors.push(`${f.label} must be at most ${f.max}`);
        out[f.key] = Number.isFinite(n) ? n : null;
        break;
      }
      case "bool":
        out[f.key] = raw === true || raw === "true" || raw === "Yes";
        break;
      case "multi": {
        const arr = Array.isArray(raw) ? [...new Set(raw.map((x) => s(x).trim()).filter(Boolean))] : [];
        const bad = f.options ? arr.filter((x) => !f.options!.includes(x)) : [];
        if (bad.length) errors.push(`${f.label}: invalid choice ${bad.join(", ")}`);
        if (f.required && !arr.length) errors.push(`${f.label}: select at least one`);
        out[f.key] = arr.slice(0, 200);
        break;
      }
      case "map": {
        const m: Record<string, string> = {};
        if (raw && typeof raw === "object" && !Array.isArray(raw))
          for (const [k, v] of Object.entries(raw as Data)) {
            const t = s(v).trim();
            if (t.length > 200) errors.push(`${f.label} entries must be 200 characters or fewer`);
            if (t) m[k.slice(0, 80)] = t.slice(0, 200);
          }
        out[f.key] = m;
        break;
      }
      case "file":
      case "files": {
        const items = (f.kind === "file" ? (raw ? [raw] : []) : Array.isArray(raw) ? raw : []) as Data[];
        const kept: Array<{ id: string; name: string; size: number; mime: string }> = [];
        for (const it of items.slice(0, 20)) {
          const id = s(it?.id);
          if (!id) continue;
          const exists = await prisma.heritageRecord.count({ where: { id, institutionId: inst, screenId: LOC.file, deletedAt: null } });
          if (!exists) {
            errors.push(`${f.label}: an attached file is no longer available, please upload it again`);
            continue;
          }
          kept.push({ id, name: s(it.name).slice(0, 200), size: Number(it.size) || 0, mime: s(it.mime).slice(0, 120) });
        }
        if (f.required && !kept.length) errors.push(`${f.label} is required`);
        out[f.key] = f.kind === "file" ? (kept[0] ?? null) : kept;
        break;
      }
      case "ref": {
        const v = s(raw).trim();
        if (!v) {
          if (f.required) errors.push(`${f.label} is required`);
          out[f.key] = "";
        } else if (!(await lookup(f.ref!, v))) errors.push(`${f.label}: the selected item no longer exists`);
        else out[f.key] = v;
        break;
      }
    }
  }
  for (const k of Object.keys(out)) if (!fields.some((f) => f.key === k)) delete out[k];
  if (errors.length) throw httpError(400, errors.join("; "));
  return out;
}

/** Server-side guard for the rich-text Accessibility Statement. */
function sanitizeHtml(html: string) {
  const blocked = "script|style|iframe|object|embed|link|meta|template|form|input|button|textarea|select|svg|math";
  return html
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${blocked})\\b[^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("|')\s*data:(?!image\/(png|jpe?g|gif|webp))[^"']*\2/gi, '$1="#"');
}

/* ------------------------------------------------------------------ */
/* Entities                                                             */
/* ------------------------------------------------------------------ */

export type EntityKey =
  | "brands"
  | "emailServices"
  | "regions"
  | "provinces"
  | "campuses"
  | "classrooms"
  | "classroomTypes"
  | "ministries"
  | "institutions"
  | "agreements"
  | "bridgePrograms"
  | "transferCourses";

type EntityDef = {
  screen: string;
  audit: string;
  label: string;
  parent?: { screen: string; label: string };
  fields: Field[];
  unique: Array<{ key: string; scope: "all" | "parent"; label: string }>;
  search: string[];
};

const CAMPUS_TYPES = ["Main Campus", "Satellite Campus", "Online / Distance", "Training Site"] as const;

export const ENTITIES: Record<EntityKey, EntityDef> = {
  brands: {
    screen: LOC.brand,
    audit: "L01",
    label: "Brand",
    search: ["name", "abbreviation"],
    unique: [
      { key: "name", scope: "all", label: "Brand Name" },
      { key: "abbreviation", scope: "all", label: "Abbreviation" },
    ],
    fields: [
      { key: "name", label: "Brand Name", kind: "text", required: true, lang: true, section: "Brand Details" },
      { key: "abbreviation", label: "Abbreviation", kind: "text", required: true, lang: true, section: "Brand Details" },
      { key: "active", label: "Active / Inactive", kind: "select", options: ACTIVE, dflt: "Active", required: true, section: "Brand Details" },
      { key: "interface", label: "Interface", kind: "select", options: ["Default Interface", "HCC"], dflt: "Default Interface", required: true, section: "Brand Specific Settings" },
      { key: "login", label: "Login", kind: "select", options: ["Use Generic Login Page", "Unique Domain Name"], dflt: "Use Generic Login Page", required: true, section: "Brand Specific Settings" },
      { key: "domain", label: "Domain", kind: "domain", required: true, when: { key: "login", equals: "Unique Domain Name" }, section: "Brand Specific Settings" },
    ],
  },
  emailServices: {
    screen: LOC.emailService,
    audit: "L07",
    label: "E-mail service",
    parent: { screen: LOC.brand, label: "Brand" },
    search: ["name", "fromName", "fromAddress"],
    unique: [{ key: "name", scope: "parent", label: "Service Name" }],
    fields: [
      { key: "name", label: "Service Name", kind: "text", required: true },
      { key: "method", label: "Sending Method", kind: "select", options: ["Web Server", "SMTP"], dflt: "Web Server", required: true },
      { key: "fromName", label: "E-mail From Name", kind: "text", required: true },
      { key: "fromAddress", label: "E-mail From Address", kind: "email", required: true },
      { key: "smtpHost", label: "SMTP Host", kind: "text", required: true, when: { key: "method", equals: "SMTP" } },
      { key: "smtpPort", label: "SMTP Port", kind: "number", integer: true, min: 1, max: 65535, dflt: 587, required: true, when: { key: "method", equals: "SMTP" } },
      { key: "smtpSecurity", label: "Encryption", kind: "select", options: ["TLS / STARTTLS", "SSL", "None"], dflt: "TLS / STARTTLS", when: { key: "method", equals: "SMTP" } },
      { key: "smtpUsername", label: "SMTP Username", kind: "text", when: { key: "method", equals: "SMTP" } },
      { key: "smtpPassword", label: "SMTP Password", kind: "secret", when: { key: "method", equals: "SMTP" } },
      { key: "conditions", label: "Send Email Condition", kind: "multi", options: EMAIL_CONDITIONS, dflt: [] },
    ],
  },
  regions: {
    screen: LOC.region,
    audit: "L08",
    label: "Region",
    search: ["name", "abbreviation"],
    unique: [
      { key: "name", scope: "all", label: "Region Name" },
      { key: "abbreviation", scope: "all", label: "Abbreviation" },
    ],
    fields: [
      { key: "name", label: "Region Name", kind: "text", required: true, lang: true },
      { key: "abbreviation", label: "Abbreviation", kind: "text", required: true, lang: true },
    ],
  },
  provinces: {
    screen: LOC.province,
    audit: "L09",
    label: "Province / State",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", scope: "all", label: "Province / State Name" }],
    fields: [
      { key: "name", label: "Province / State Name", kind: "text", required: true, lang: true },
      { key: "abbreviation", label: "Abbreviation", kind: "text", required: true, lang: true },
      { key: "active", label: "Active / Inactive", kind: "select", options: ACTIVE, dflt: "Active", required: true },
    ],
  },
  campuses: {
    screen: LOC.campus,
    audit: "L11",
    label: "Campus",
    search: ["name", "code", "city"],
    unique: [
      { key: "name", scope: "all", label: "Campus Name" },
      { key: "code", scope: "all", label: "Campus Code" },
    ],
    fields: [
      { key: "brand", label: "Campus Brand", kind: "ref", ref: "brands", required: true, section: "Campus Settings" },
      { key: "primaryLanguage", label: "Campus Primary Language", kind: "select", dyn: "languages", dflt: "English", required: true, section: "Campus Settings" },
      { key: "region", label: "Campus Region", kind: "ref", ref: "regions", section: "Campus Settings" },
      { key: "timezone", label: "Campus Timezone", kind: "select", dyn: "timezones", dflt: "America/Vancouver", required: true, section: "Campus Settings" },
      { key: "currency", label: "Campus Currency", kind: "select", dyn: "currencies", dflt: "CAD", required: true, section: "Campus Settings" },
      { key: "province", label: "Province / Territory", kind: "ref", ref: "provinces", section: "Campus Settings" },
      { key: "campusType", label: "Campus Type", kind: "select", options: CAMPUS_TYPES, dflt: "Main Campus", required: true, section: "Campus Settings" },
      { key: "onlineCampus", label: "Online Campus", kind: "select", options: NO_YES, dflt: "No", required: true, section: "Campus Settings" },
      { key: "studentActiveCondition", label: "Student Active Condition", kind: "select", options: ["Active Program Enrolment", "Active Course Enrolment", "Manual"], dflt: "Active Program Enrolment", required: true, section: "Campus Settings" },
      { key: "active", label: "Active / Inactive", kind: "select", options: ACTIVE, dflt: "Active", required: true, section: "Campus Settings" },
      { key: "name", label: "Campus Name", kind: "text", required: true, section: "Campus Details" },
      { key: "legalName", label: "Campus Legal Name", kind: "text", section: "Campus Details" },
      { key: "code", label: "Campus Code", kind: "text", section: "Campus Details" },
      { key: "logo", label: "Campus Logo", kind: "file", section: "Campus Details" },
      { key: "address", label: "Address", kind: "text", section: "Campus Location" },
      { key: "city", label: "City", kind: "text", section: "Campus Location" },
      { key: "country", label: "Country", kind: "text", section: "Campus Location" },
      { key: "postalCode", label: "Postal Code", kind: "text", section: "Campus Location" },
      { key: "phone", label: "Phone Number", kind: "text", section: "Campus Location" },
      { key: "fax", label: "Fax Number", kind: "text", section: "Campus Location" },
      { key: "openDays", label: "Open Days", kind: "multi", options: WEEKDAYS, dflt: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], section: "Campus Business Hours" },
      { key: "buildings", label: "Buildings", kind: "select", options: ["Single Building Campus", "Multiple Building Campus"], dflt: "Single Building Campus", required: true, section: "Campus Buildings" },
      { key: "coursesTaught", label: "Courses Taught", kind: "select", dyn: "courseCategories", dynExtra: ["All Course Categories"], dflt: "All Course Categories", required: true, section: "Campus Topics / Courses" },
      { key: "invoiceDating", label: "Invoice / Fee Dating", kind: "select", options: ["Enrolment Date", "Course Start Date", "Term Start Date", "Invoice Creation Date"], dflt: "Enrolment Date", required: true, section: "Financial Options" },
      { key: "automateInvoicing", label: "Automate Invoicing", kind: "select", options: DIS_EN, dflt: "Disabled", required: true, section: "Financial Options" },
      { key: "applyCredit", label: "Apply Credit Automatically", kind: "select", options: NO_YES, dflt: "No", required: true, section: "Financial Options" },
      { key: "automatedAdjustments", label: "Automated Adjustments", kind: "select", options: DIS_EN, dflt: "Disabled", required: true, section: "Financial Options" },
    ],
  },
  classrooms: {
    screen: LOC.classroom,
    audit: "L12",
    label: "Classroom",
    search: ["name"],
    unique: [{ key: "name", scope: "parent", label: "Classroom Name / Number" }],
    fields: [
      { key: "campus", label: "Campus", kind: "ref", ref: "campuses", required: true },
      { key: "name", label: "Classroom Name / Number", kind: "text", required: true },
      { key: "type", label: "Classroom Type", kind: "ref", ref: "classroomTypes" },
      { key: "size", label: "Classroom Size", kind: "number", integer: true, min: 0, max: 10000, required: true },
      { key: "notes", label: "Notes / Resources", kind: "textarea" },
      { key: "active", label: "Active / Inactive", kind: "select", options: ACTIVE, dflt: "Active", required: true },
    ],
  },
  classroomTypes: {
    screen: LOC.classroomType,
    audit: "L13",
    label: "Classroom type",
    search: ["name", "abbreviation"],
    unique: [
      { key: "name", scope: "all", label: "Name" },
      { key: "abbreviation", scope: "all", label: "Abbreviation" },
    ],
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, lang: true },
      { key: "abbreviation", label: "Abbreviation", kind: "text", required: true, lang: true },
    ],
  },
  ministries: {
    screen: LOC.ministry,
    audit: "L14",
    label: "Ministry",
    search: ["name", "type"],
    unique: [{ key: "name", scope: "all", label: "Ministry Name" }],
    fields: [
      { key: "name", label: "Ministry Name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "select", options: ["PTIB", "DQAB"], dflt: "PTIB", required: true },
      { key: "settings", label: "Settings", kind: "select", options: ["Brands", "Campuses"], dflt: "Brands", required: true },
      { key: "mapping", label: "Ministry Equivalent", kind: "map", dflt: {} },
    ],
  },
  institutions: {
    screen: LOC.institution,
    audit: "L15",
    label: "Institution",
    search: ["name", "city", "address", "stateProvince", "country"],
    unique: [{ key: "name", scope: "all", label: "Institution Name" }],
    fields: [
      { key: "primaryLanguage", label: "Primary Language", kind: "select", dyn: "languages", dflt: "English", required: true },
      { key: "timezone", label: "Time Zone", kind: "select", dyn: "timezones", dflt: "America/Vancouver", required: true },
      { key: "active", label: "Active / Inactive", kind: "select", options: ACTIVE, dflt: "Active", required: true },
      { key: "name", label: "Institution Name", kind: "text", required: true },
      { key: "address", label: "Address", kind: "text", required: true },
      { key: "city", label: "City", kind: "text", required: true },
      { key: "stateProvince", label: "State / Province", kind: "text", required: true },
      { key: "country", label: "Country", kind: "select", dyn: "countries", dflt: "Canada", required: true },
      { key: "postalCode", label: "Postal / Zip Code", kind: "text", required: true },
      { key: "phone", label: "Phone Number", kind: "text", required: true },
      { key: "fax", label: "Fax Number", kind: "text" },
      { key: "email", label: "E-mail Address", kind: "email", required: true },
      { key: "file", label: "File Upload", kind: "file" },
    ],
  },
  agreements: {
    screen: LOC.agreement,
    audit: "L16",
    label: "Agreement",
    parent: { screen: LOC.institution, label: "Institution" },
    search: ["status", "note"],
    unique: [],
    fields: [
      { key: "startDate", label: "Agreement Start Date", kind: "date", required: true },
      { key: "endDate", label: "Agreement End Date", kind: "date", required: true, when: { key: "openEnded", equals: false } },
      { key: "openEnded", label: "Open-ended", kind: "bool", dflt: false },
      { key: "status", label: "Agreement Status", kind: "select", options: ["Inactive", "Active", "Pending", "Expired"], dflt: "Inactive", required: true },
      { key: "gradePointExchange", label: "Grade Point Exchange", kind: "select", options: ["Inactive", "Active"], dflt: "Inactive", required: true },
      { key: "programs", label: "Programs", kind: "multi", dyn: "programs", dflt: [] },
      { key: "note", label: "Note", kind: "textarea" },
      { key: "documents", label: "Agreement Documents / Supporting Files", kind: "files", dflt: [] },
    ],
  },
  bridgePrograms: {
    screen: LOC.bridge,
    audit: "L17",
    label: "Bridge / qualifying program",
    parent: { screen: LOC.institution, label: "Institution" },
    search: ["name", "equivalentProgram", "description"],
    unique: [{ key: "name", scope: "parent", label: "Program Name" }],
    fields: [
      { key: "name", label: "Program Name", kind: "text", required: true, section: "Program Information" },
      { key: "description", label: "Program Description", kind: "textarea", section: "Program Information" },
      { key: "credits", label: "Program Credits", kind: "number", min: 0, max: 1000, section: "Program Information" },
      { key: "equivalentProgram", label: "Equivalent Program", kind: "select", dyn: "programs", required: true, section: "Program Pathway" },
      { key: "equivalentPathway", label: "Equivalent Pathway", kind: "select", dyn: "pathways", section: "Program Pathway" },
      { key: "status", label: "Status", kind: "select", options: ACTIVE, dflt: "Active", required: true, section: "Program Pathway" },
    ],
  },
  transferCourses: {
    screen: LOC.transferCourse,
    audit: "L19",
    label: "Transfer course",
    parent: { screen: LOC.institution, label: "Institution" },
    search: ["name", "number", "_equivalentLabel"],
    unique: [{ key: "number", scope: "parent", label: "Transfer Course Number" }],
    fields: [
      { key: "equivalentCourse", label: "Equivalent Course", kind: "ref", ref: "course", required: true, section: "Transfer Course Details" },
      { key: "name", label: "Transfer Course Name", kind: "text", required: true, section: "Transfer Course Details" },
      { key: "number", label: "Transfer Course Number", kind: "text", required: true, section: "Transfer Course Details" },
      { key: "credits", label: "Transfer Course Credits", kind: "number", min: 0, max: 100, section: "Transfer Course Details" },
      { key: "lengthValue", label: "Transfer Course Length", kind: "number", min: 0, max: 10000, section: "Transfer Course Details", group: "Transfer Course Length", sub: "Length" },
      { key: "lengthUnit", label: "Length Unit", kind: "select", options: ["days", "weeks", "months", "hours"], dflt: "days", required: true, section: "Transfer Course Details", group: "Transfer Course Length", sub: "Unit" },
      { key: "outline", label: "Transfer Course Outline", kind: "file", section: "Transfer Course Details" },
      { key: "countCredits", label: "Count Transfer Credits", kind: "select", options: ["Normal", "Elective Credit", "Do Not Count"], dflt: "Normal", required: true, section: "Transfer Course Settings" },
      { key: "countGradePoints", label: "Count Transfer Grade Points", kind: "select", options: NO_YES, dflt: "No", required: true, section: "Transfer Course Settings" },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Brand settings tabs (Profile / Academic / Financial / Accessibility) */
/* ------------------------------------------------------------------ */

const sel = (key: string, label: string, options: readonly string[], section: string, extra: Partial<Field> = {}): Field => ({
  key,
  label,
  kind: "select",
  options,
  dflt: options[0],
  required: true,
  section,
  ...extra,
});
const num = (key: string, label: string, section: string, extra: Partial<Field>): Field => ({ key, label, kind: "number", integer: true, min: 0, required: true, section, ...extra });

const PASSWORD_DEFAULTS = ["Date of Birth (YYYYMMDD)", "Student Number", "Random (e-mailed to the user)"] as const;
const VIS = "Program Plan Settings";
const CREDIT = "Credit Calculation Settings / Output";
const CREDIT_OPTS = ["Earned Credits", "Attempted Credits", "Earned + Transfer Credits", "Attempted + Transfer Credits"] as const;
const GPA = "GPA Calculation Settings / Output";
const GPA_OPTS = ["All Attempts", "Best Attempt", "Latest Attempt", "All Attempts + Transfer Grades"] as const;
const GRADE_TIMING = ["Any Time", "After Last Session", "Within 7 Days of Course End", "Within 14 Days of Course End"] as const;

export const SETTINGS_TABS: Record<"profile" | "academic" | "financial" | "accessibility", { label: string; audit: string; save: string; fields: Field[] }> = {
  profile: {
    label: "Profile Settings",
    audit: "L02",
    save: "Save Profile Settings",
    fields: [
      sel("studentNumbering", "Student Numbering", ["Year & Incremental", "Incremental", "Campus Code & Incremental", "Manual Entry"], "Profile Settings"),
      sel("passwordProgram", "Default User Password — Program Enrolments", PASSWORD_DEFAULTS, "Profile Settings"),
      sel("passwordWorkshop", "Default User Password — Workshop Enrolments", PASSWORD_DEFAULTS, "Profile Settings"),
      sel("emailServices", "User E-mail Services", EN_DIS, "Profile Settings"),
      sel("emailOptIn", "User E-mail Opt-in", ["Mandatory", "Optional", "Disabled"], "Profile Settings"),
      sel("showTuition", "Show Tuition", YES_NO, VIS),
      sel("showFinalMark", "Show Final Mark", YES_NO, VIS),
      sel("showPrerequisites", "Show Prerequisites", YES_NO, VIS),
      sel("cgpaStudents", "Show Cumulative GPA — Students", SHOW_HIDE, VIS, { group: "Show Cumulative GPA", sub: "Students" }),
      sel("cgpaStaff", "Show Cumulative GPA — Staff", SHOW_HIDE, VIS, { group: "Show Cumulative GPA", sub: "Staff" }),
      sel("totalCreditsStudents", "Show Total Credits — Students", SHOW_HIDE, VIS, { group: "Show Total Credits", sub: "Students" }),
      sel("totalCreditsStaff", "Show Total Credits — Staff", SHOW_HIDE, VIS, { group: "Show Total Credits", sub: "Staff" }),
      sel("programCreditsStudents", "Show Program Credits — Students", SHOW_HIDE, VIS, { group: "Show Program Credits", sub: "Students" }),
      sel("programCreditsStaff", "Show Program Credits — Staff", SHOW_HIDE, VIS, { group: "Show Program Credits", sub: "Staff" }),
      sel("transferCreditsStudents", "Show Transfer Credits — Students", SHOW_HIDE, VIS, { group: "Show Transfer Credits", sub: "Students" }),
      sel("transferCreditsStaff", "Show Transfer Credits — Staff", SHOW_HIDE, VIS, { group: "Show Transfer Credits", sub: "Staff" }),
      sel("studentPlanExport", "Student Plan Export", EN_DIS, VIS),
      sel("programChanges", "Program Changes", ["Requires Approval", "Allowed", "Not Allowed"], VIS),
      sel("transferInMethod", "Transfer-In Method", ["Transfer Credits", "Course Equivalencies", "Transfer Credits & Course Equivalencies"], VIS),
    ],
  },
  academic: {
    label: "Academic Settings",
    audit: "L03",
    save: "Save Academic Settings",
    fields: [
      sel("programPlan", "Program Plan", EN_DIS, "Academic / Enrolment Settings"),
      sel("applicationsEnrolments", "Applications & Enrolments", ["Applications & Enrolments", "Enrolments Only", "Applications Only"], "Academic / Enrolment Settings"),
      sel("electivesLinking", "Electives Linking", EN_DIS, "Academic / Enrolment Settings"),
      sel("electivesResync", "Electives Resynchronization", ["Automatic", "Manual", "Disabled"], "Academic / Enrolment Settings"),
      sel("syncTerms", "Synchronize Terms with Active Enrolments", EN_DIS, "Academic / Enrolment Settings"),
      sel("conditionalWithdrawal", "Conditional Course Enrolments Withdrawal", ["Automatic", "Manual", "Disabled"], "Academic / Enrolment Settings"),
      sel("selfEnrolmentList", "Self-Enrolment Course List", ["Program Plan Courses", "All Active Courses", "Disabled"], "Academic / Enrolment Settings"),
      sel("enrolmentMessage", "Enrolment Available Message", SHOW_HIDE, "Academic / Enrolment Settings"),
      sel("textbookFees", "Opt-in/out Textbook Fees", DIS_EN, "Academic / Enrolment Settings"),
      sel("standingTrigger", "Student Standing Trigger", ["Final Grade Submission", "Term End", "Manual"], "Academic / Enrolment Settings"),
      sel("cumulativeWeight", "Cumulative Grading Weight", EN_DIS, "Academic / Enrolment Settings"),
      num("weightFrom", "Grading Weight Threshold — From %", "Academic / Enrolment Settings", { max: 100, dflt: 0, group: "Grading Weight Threshold", sub: "From %" }),
      num("weightTo", "Grading Weight Threshold — To %", "Academic / Enrolment Settings", { max: 100, dflt: 100, group: "Grading Weight Threshold", sub: "To %" }),
      sel("ungraded", "Ungraded Activities", ["Exclude from Average", "Count as Zero"], "Academic / Enrolment Settings"),
      sel("creditProfileTotal", "Profile Total", CREDIT_OPTS, CREDIT),
      sel("creditCourseTransferTotal", "Course Transfer Total", CREDIT_OPTS, CREDIT),
      sel("creditProgramTransferTotal", "Program Transfer Total", CREDIT_OPTS, CREDIT),
      sel("creditSelfEnrolment", "Self-Enrolment Condition", CREDIT_OPTS, CREDIT),
      sel("creditPrerequisites", "Prerequisites Condition", CREDIT_OPTS, CREDIT),
      sel("creditRequests", "Requests Condition", CREDIT_OPTS, CREDIT),
      sel("creditStanding", "Standing Conditions", CREDIT_OPTS, CREDIT),
      sel("creditTranscript", "Transcript Summary", CREDIT_OPTS, CREDIT),
      sel("creditPlanSummary", "Program Plan Summary", CREDIT_OPTS, CREDIT),
      sel("creditTransferCourses", "Transfer Courses", ["Include", "Exclude"], CREDIT),
      sel("gpaProfile", "Profile CGPA", GPA_OPTS, GPA),
      sel("gpaPrerequisites", "Prerequisites Condition", GPA_OPTS, GPA),
      sel("gpaStanding", "Standing Conditions", GPA_OPTS, GPA),
      sel("gpaTranscript", "Transcript Summary", GPA_OPTS, GPA),
      sel("gpaPlanSummary", "Program Plan Summary", GPA_OPTS, GPA),
      sel("gradeWorkshop", "Workshop Grades", GRADE_TIMING, "Grade Submissions"),
      sel("gradeMidterm", "Midterm Grades", GRADE_TIMING, "Grade Submissions"),
      sel("gradeFinal", "Final Grades", GRADE_TIMING, "Grade Submissions"),
      sel("staffSessionApproval", "Staff Session Approval", ["Required", "Not Required"], "Scheduling Settings"),
      sel("facultySchedulingApproval", "Faculty Scheduling Approval", ["Required", "Not Required"], "Scheduling Settings"),
      sel("scheduleTimes", "Schedule Times", ["15 Minute Increments", "30 Minute Increments", "60 Minute Increments"], "Scheduling Settings"),
      sel("scheduleTerms", "Schedule Terms", ["Academic Terms", "Financial Terms", "Academic & Financial Terms"], "Scheduling Settings"),
      sel("attendanceInput", "Attendance Input", ["Present / Absent / Late", "Present / Absent", "Hours Attended", "Percentage"], "Attendance Settings"),
      sel("dailyDefault", "Daily Default Value", ["Blank", "Present", "Absent"], "Attendance Settings"),
      sel("sessionGrouping", "Session Grouping", ["By Session", "By Day", "By Week"], "Attendance Settings"),
      sel("suggestSession", "Suggest Session", EN_DIS, "Attendance Settings"),
      num("backDating", "Back-Dating Attendance", "Attendance Settings", { max: 365, dflt: 7, suffix: "days" }),
      sel("futureAttendance", "Future Attendance", ["Not Allowed", "Allowed"], "Attendance Settings"),
      sel("extraRosterRows", "Extra Roster Rows", ["0", "1", "2", "3", "5", "10"], "Attendance Settings"),
      sel("attendanceGrading", "Attendance Grading", DIS_EN, "Attendance Settings"),
      sel("scanner", "Attendance Scanner", DIS_EN, "Attendance Check-in Scanning Settings"),
      sel("scanLogin", "Attendance Login", ["Student Number", "Username", "Student Card / QR Code"], "Attendance Check-in Scanning Settings"),
      sel("scanAuth", "Authentication", ["Password", "PIN", "None"], "Attendance Check-in Scanning Settings"),
      num("leeway", "Login Time Leeway", "Attendance Check-in Scanning Settings", { max: 240, dflt: 15, suffix: "minutes" }),
      sel("scanSync", "Synchronize Attendance", ["Real-time", "Every 15 Minutes", "Hourly"], "Attendance Check-in Scanning Settings"),
      sel("refreshCheckIn", "Refresh Check In", ["Every Minute", "Every 30 Seconds", "Every 5 Minutes"], "Attendance Check-in Scanning Settings"),
      sel("autoCheckOut", "Automated Check Out", ["At Session End", "Disabled"], "Attendance Check-in Scanning Settings"),
      sel("autoLogOut", "Automated Log Out", ["After 5 Minutes Idle", "After 15 Minutes Idle", "Disabled"], "Attendance Check-in Scanning Settings"),
      sel("repoManual", "Repository Manual Creation", EN_DIS, "Course Content Settings"),
      sel("repoAuto", "Repository Auto-Creation", DIS_EN, "Course Content Settings"),
      num("repoPushDays", "Repository Push Deadline — Days", "Course Content Settings", { max: 365, dflt: 7, group: "Repository Push Deadline", sub: "Days" }),
      sel("repoPushWhen", "Repository Push Deadline — Before / After", ["Before Course Start", "After Course Start"], "Course Content Settings", { group: "Repository Push Deadline", sub: "Before / After Course Start" }),
      sel("archiveRepos", "Archive Faculty Repositories", ["After Course End", "Manual", "Never"], "Course Content Settings"),
      sel("blockImport", "Block Import/Restore", NO_YES, "Course Content Settings"),
      sel("courseNav", "Course List Navigations", ["Tabs", "Dropdown", "Sidebar"], "Course Navigation Settings"),
    ],
  },
  financial: {
    label: "Financial Settings",
    audit: "L05",
    save: "Save Financial Settings",
    fields: [
      sel("receivables", "Financial Receivables", EN_DIS, "Financial Settings"),
      sel("statements", "Student Statements", EN_DIS, "Financial Settings"),
      sel("statementByTerm", "Statement by Term", NO_YES, "Financial Settings"),
      sel("statementDisbursements", "Statement Disbursements", SHOW_HIDE, "Financial Settings"),
      sel("statementEstimates", "Statement Estimates", ["Hide", "Show"], "Financial Settings"),
      sel("paymentLinks", "Payment Links", EN_DIS, "Financial Settings"),
      sel("autoApplyOrder", "Auto-Apply Payments Order", ["Oldest Charge First", "Newest Charge First", "Tuition First", "Fees First"], "Financial Settings"),
      sel("syncPaymentPlans", "Synchronized Payment Plans", DIS_EN, "Financial Settings"),
      sel("duplicatePaymentPlan", "Duplicate Payment Plan", ["Not Allowed", "Allowed"], "Financial Settings"),
      sel("autoCollection", "Auto-Collection Accounts", DIS_EN, "Financial Settings"),
      sel("agentCommissions", "Calculate Agent Commissions", ["Manual", "Automatic", "Disabled"], "Financial Settings"),
      sel("agentPayee", "Agent Payee Commission", ["Agent", "Agency", "Sub-Agent"], "Financial Settings"),
      num("transactionLockout", "Transaction Lockout", "Financial Settings", { max: 3650, dflt: 0, suffix: "days" }),
    ],
  },
  accessibility: {
    label: "Accessibility Settings",
    audit: "L06",
    save: "Save Accessibility Settings",
    fields: [
      sel("integratedHelp", "Enable Integrated Help", YES_NO, "Accessibility Settings"),
      sel("widget", "Enable Accessibility Widget", NO_YES, "Accessibility Settings"),
      sel("widgetLocation", "Widget Location", ["Bottom Right", "Bottom Left", "Top Right", "Top Left"], "Accessibility Settings"),
      sel("widgetSize", "Widget Size", ["Medium", "Small", "Large"], "Accessibility Settings"),
      { key: "statement", label: "Accessibility Statement", kind: "html", section: "Accessibility Settings" },
    ],
  },
};
export type SettingsTab = keyof typeof SETTINGS_TABS;

/** Values visible on the captured Manage Brand → Profile Settings screen. */
const CAPTURED_PROFILE: Data = {
  studentNumbering: "Year & Incremental",
  passwordProgram: "Date of Birth (YYYYMMDD)",
  passwordWorkshop: "Date of Birth (YYYYMMDD)",
  emailServices: "Enabled",
  emailOptIn: "Mandatory",
};

/* ------------------------------------------------------------------ */
/* Seed: records visible on the captured screens                        */
/* ------------------------------------------------------------------ */

async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  if (await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: LOC.seed, singletonKey: "seed" } })) return;
  try {
    await prisma.heritageRecord.create({
      data: { institutionId: inst, screenId: LOC.seed, singletonKey: "seed", dataJson: "{}", createdById: user.accountId, updatedById: user.accountId },
    });
  } catch {
    return;
  }
  const a = user.accountId;
  const brand = await insert(inst, a, LOC.brand, { name: "Heritage College", abbreviation: "HCC", active: "Active", interface: "HCC", login: "Unique Domain Name", domain: "myhccbc.com" });
  await prisma.heritageRecord.create({
    data: { institutionId: inst, screenId: LOC.brandSettings, contextKey: brand.id, singletonKey: "profile", dataJson: JSON.stringify(CAPTURED_PROFILE), createdById: a, updatedById: a },
  });
  for (const [name, local, conditions] of [
    ["Forwarder", "forwarder", ["Email Forwarding"]],
    ["General E-mail", "info", ["Email General Sending", "Misc Notifications"]],
    ["Services", "services", ["Applications", "Requirements", "Requests", "Reporting"]],
  ] as const)
    await insert(
      inst,
      a,
      LOC.emailService,
      { name, method: "SMTP", fromName: "Heritage College", fromAddress: `${local}@myhccbc.com`, smtpHost: "", smtpPort: 587, smtpSecurity: "TLS / STARTTLS", smtpUsername: "", smtpPassword: "", conditions: [...conditions] },
      brand.id,
    );
  const region = await insert(inst, a, LOC.region, { name: "Canada", abbreviation: "CA" });
  const bc = await insert(inst, a, LOC.province, { name: "British Columbia", abbreviation: "BC", active: "Active" });
  const campusBase = {
    brand: brand.id,
    primaryLanguage: "English",
    region: region.id,
    timezone: "America/Vancouver",
    currency: "CAD",
    province: bc.id,
    studentActiveCondition: "Active Program Enrolment",
    active: "Active",
    legalName: "",
    logo: null,
    address: "",
    postalCode: "",
    phone: "",
    fax: "",
    country: "Canada",
    openDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    buildings: "Single Building Campus",
    coursesTaught: "All Course Categories",
    invoiceDating: "Enrolment Date",
    automateInvoicing: "Disabled",
    applyCredit: "No",
    automatedAdjustments: "Disabled",
  };
  const [surreyName, distanceName, victoriaName] = CAMPUSES;
  const surrey = await insert(inst, a, LOC.campus, { ...campusBase, name: surreyName, code: "110", city: "Surrey", campusType: "Main Campus", onlineCampus: "No" });
  await insert(inst, a, LOC.campus, { ...campusBase, name: distanceName, code: "", city: "", campusType: "Online / Distance", onlineCampus: "Yes" });
  await insert(inst, a, LOC.campus, { ...campusBase, name: victoriaName, code: "", city: "Victoria", campusType: "Satellite Campus", onlineCampus: "No" });
  await insert(inst, a, LOC.classroom, { campus: surrey.id, name: "1", type: "", size: 15, notes: "", active: "Active" }, surrey.id);

  const instBase = { primaryLanguage: "English", timezone: "America/Vancouver", active: "Active", address: "", city: "", stateProvince: "", country: "Canada", postalCode: "", phone: "", fax: "", email: "", file: null };
  await insert(inst, a, LOC.institution, { ...instBase, name: "Heritage Community College" });
  const seanco = await insert(inst, a, LOC.institution, { ...instBase, name: "SeanCo Development" });
  const courses = await prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" }, take: 2 });
  for (const [i, c] of courses.entries())
    await insert(
      inst,
      a,
      LOC.transferCourse,
      { equivalentCourse: c.id, name: c.title, number: `SCD-${101 + i}`, credits: Number(c.credits) || 3, lengthValue: null, lengthUnit: "days", outline: null, countCredits: "Normal", countGradePoints: "No" },
      seanco.id,
    );
  await audit(user, "L01", "", "seed location management", { note: "Captured brands, regions, provinces, campuses, classroom, institutions" });
}

/* ------------------------------------------------------------------ */
/* Meta / options                                                       */
/* ------------------------------------------------------------------ */

export async function locationMeta(user: SessionClaims) {
  await assertPermission(user, "locationManagement", "view");
  await ensureSeed(user);
  const [r, courseRefs, courses] = await Promise.all([
    refs(user),
    courseRefLists(user.institutionId),
    prisma.course.findMany({ where: { institutionId: user.institutionId }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);
  const strip = (fields: Field[]) => fields.map((f) => ({ ...f, when: f.when ?? undefined }));
  return {
    entities: Object.fromEntries(Object.entries(ENTITIES).map(([k, e]) => [k, { label: e.label, fields: strip(e.fields) }])),
    settings: Object.fromEntries(Object.entries(SETTINGS_TABS).map(([k, t]) => [k, { label: t.label, save: t.save, fields: strip(t.fields) }])),
    lists: {
      languages: r.languages ?? ["English", "French"],
      timezones: r.timezones ?? [],
      currencies: r.currencies ?? [],
      countries: r.countries ?? [],
      programs: r.programs ?? [],
      pathways: r.pathways ?? [],
      courseCategories: campusCourseCategories(courseRefs.courseCategories, r.courseCategories),
    },
    courses: courses.map((c) => ({ id: c.id, label: `${c.code} — ${c.title}` })),
    weekdays: WEEKDAYS,
  };
}

/* ------------------------------------------------------------------ */
/* Generic CRUD                                                         */
/* ------------------------------------------------------------------ */

function lookupFor(inst: string): RefLookup {
  const screens: Record<Exclude<RefTarget, "course">, string> = {
    brands: LOC.brand,
    regions: LOC.region,
    provinces: LOC.province,
    campuses: LOC.campus,
    classroomTypes: LOC.classroomType,
  };
  return async (target, id) => {
    if (target === "course") return (await prisma.course.count({ where: { id, institutionId: inst } })) > 0;
    return (await prisma.heritageRecord.count({ where: { id, institutionId: inst, screenId: screens[target], deletedAt: null } })) > 0;
  };
}

function publicData(entity: EntityKey, data: Data): Data {
  if (entity !== "emailServices") return data;
  const { smtpPassword, ...rest } = data;
  return { ...rest, hasPassword: Boolean(smtpPassword) };
}

async function decorate(inst: string, entity: EntityKey, recs: Rec[]) {
  const names = async (screen: string) => new Map((await list(inst, screen)).map((r) => [r.id, r.data]));
  if (entity === "campuses") {
    const [brands, regions, provinces] = await Promise.all([names(LOC.brand), names(LOC.region), names(LOC.province)]);
    return recs.map((r) => ({
      _brandLabel: s(brands.get(s(r.data.brand))?.name),
      _regionLabel: s(regions.get(s(r.data.region))?.name),
      _provinceLabel: s(provinces.get(s(r.data.province))?.name),
      _display: campusDisplay(r.data),
      _addressLine: addressLine(r.data, s(provinces.get(s(r.data.province))?.name)),
    }));
  }
  if (entity === "classrooms") {
    const [campuses, types] = await Promise.all([names(LOC.campus), names(LOC.classroomType)]);
    return recs.map((r) => ({ _campusLabel: campusDisplay(campuses.get(s(r.data.campus)) ?? {}), _typeLabel: s(types.get(s(r.data.type))?.name) }));
  }
  if (entity === "transferCourses") {
    const ids = [...new Set(recs.map((r) => s(r.data.equivalentCourse)).filter(Boolean))];
    const cs = await prisma.course.findMany({ where: { id: { in: ids }, institutionId: inst }, select: { id: true, code: true, title: true } });
    const by = new Map(cs.map((c) => [c.id, `${c.code} — ${c.title}`]));
    return recs.map((r) => ({ _equivalentLabel: by.get(s(r.data.equivalentCourse)) ?? "Course no longer in catalogue" }));
  }
  if (entity === "institutions") {
    const counts = await prisma.heritageRecord.groupBy({ by: ["contextKey"], where: { institutionId: inst, screenId: LOC.transferCourse, deletedAt: null }, _count: { _all: true } });
    const by = new Map(counts.map((c) => [c.contextKey, c._count._all]));
    return recs.map((r) => ({ _coursesCount: by.get(r.id) ?? 0, _addressLine: addressLine(r.data, s(r.data.stateProvince)) }));
  }
  return recs.map(() => ({}));
}

export function campusDisplay(d: Data) {
  const code = s(d.code).trim();
  return code ? `#${code} ${s(d.name)}` : s(d.name);
}
function addressLine(d: Data, region: string) {
  return [s(d.address), s(d.city), region, s(d.postalCode), s(d.country)].map((x) => x.trim()).filter(Boolean).join(", ");
}

export async function listEntity(user: SessionClaims, entity: EntityKey, opts: { parentId?: string; q?: string; page?: number; perPage?: number }) {
  await assertPermission(user, "locationManagement", "view");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  if (def.parent && !opts.parentId) throw httpError(400, `${def.parent.label} is required`);
  if (def.parent) await find(inst, def.parent.screen, opts.parentId!, def.parent.label);
  const recs = await list(inst, def.screen, def.parent ? opts.parentId : undefined);
  const extras = await decorate(inst, entity, recs);
  let items = recs.map((r, i) => ({ id: r.id, parentId: r.contextKey, ...publicData(entity, r.data), ...extras[i], updatedAt: r.updatedAt.toISOString() })) as Array<Data & { id: string }>;
  const needle = lc(opts.q);
  if (needle) items = items.filter((it) => def.search.some((k) => lc(it[k]).includes(needle)));
  items.sort((x, y) => s(x.name ?? x.startDate).localeCompare(s(y.name ?? y.startDate), undefined, { sensitivity: "base", numeric: true }));
  const total = items.length;
  const perPage = Math.min(Math.max(Number(opts.perPage) || 0, 0), 200);
  if (!perPage) return { items, total, page: 1, perPage: total, pages: 1 };
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Number(opts.page) || 1, 1), pages);
  return { items: items.slice((page - 1) * perPage, page * perPage), total, page, perPage, pages };
}

export async function getEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, "locationManagement", "view");
  const def = ENTITIES[entity];
  const rec = await find(user.institutionId, def.screen, id, def.label);
  const [extra] = await decorate(user.institutionId, entity, [rec]);
  return { id: rec.id, parentId: rec.contextKey, ...publicData(entity, rec.data), ...extra, updatedAt: rec.updatedAt.toISOString() };
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

function parentKeyFor(entity: EntityKey, data: Data, parentId?: string) {
  if (entity === "classrooms") return s(data.campus);
  return ENTITIES[entity].parent ? s(parentId) : "";
}

function validateCross(entity: EntityKey, data: Data) {
  if (entity === "agreements" && !data.openEnded && s(data.endDate) && s(data.endDate) < s(data.startDate)) throw httpError(400, "Agreement End Date must be on or after the Start Date");
}

export async function createEntity(user: SessionClaims, entity: EntityKey, body: Data & { parentId?: string }) {
  await assertPermission(user, "locationManagement", "edit");
  await ensureSeed(user);
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  if (def.parent) {
    if (!body.parentId) throw httpError(400, `${def.parent.label} is required`);
    await find(inst, def.parent.screen, s(body.parentId), def.parent.label);
  }
  const data = await clean(inst, def.fields, body, {}, lookupFor(inst));
  validateCross(entity, data);
  const ctx = parentKeyFor(entity, data, s(body.parentId));
  await assertUnique(inst, def, data, ctx);
  const rec = await insert(inst, user.accountId, def.screen, data, ctx);
  await audit(user, def.audit, ctx, `create ${def.label.toLowerCase()}`, { recordId: rec.id, after: publicData(entity, data) });
  return { ok: true, id: rec.id, message: `${def.label} "${s(data.name) || s(data.startDate)}" saved` };
}

export async function updateEntity(user: SessionClaims, entity: EntityKey, id: string, body: Data) {
  await assertPermission(user, "locationManagement", "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  const data = await clean(inst, def.fields, body, rec.data, lookupFor(inst));
  validateCross(entity, data);
  const ctx = entity === "classrooms" ? s(data.campus) : rec.contextKey;
  await assertUnique(inst, def, data, ctx, id);
  await update(user.accountId, id, data, ctx);
  if (entity === "campuses" && s(rec.data.name) !== s(data.name)) await renameCampusEverywhere(inst, s(rec.data.name), s(data.name));
  await audit(user, def.audit, ctx, `update ${def.label.toLowerCase()}`, { recordId: id, before: publicData(entity, rec.data), after: publicData(entity, data) });
  return { ok: true, id, message: `${def.label} "${s(data.name) || s(data.startDate)}" saved` };
}

async function renameCampusEverywhere(inst: string, from: string, to: string) {
  if (!from || !to) return;
  await prisma.cohort.updateMany({ where: { institutionId: inst, campus: from }, data: { campus: to } });
  const meta = await studentMetaMap(inst);
  for (const [studentId, m] of Object.entries(meta)) if (m.campus === from) await patchStudentMeta(inst, studentId, { campus: to });
}

async function usage(inst: string, screen: string, key: string, id: string) {
  return (await list(inst, screen)).filter((r) => s(r.data[key]) === id);
}

export async function deleteEntity(user: SessionClaims, entity: EntityKey, id: string) {
  await assertPermission(user, "locationManagement", "edit");
  const def = ENTITIES[entity];
  const inst = user.institutionId;
  const rec = await find(inst, def.screen, id, def.label);
  const name = s(rec.data.name) || s(rec.data.startDate) || def.label;
  const block = (what: string, used: Rec[]) => {
    if (used.length)
      throw httpError(
        409,
        `"${name}" is still used by ${used.length} ${what}${used.length === 1 ? "" : "s"} (${used
          .slice(0, 3)
          .map((u) => campusDisplay(u.data))
          .join(", ")}${used.length > 3 ? ", …" : ""}). Reassign ${used.length === 1 ? "it" : "them"} first.`,
        "CONFLICT",
      );
  };
  const cascade: string[] = [];
  if (entity === "brands") {
    block("campus", await usage(inst, LOC.campus, "brand", id));
    cascade.push(...(await list(inst, LOC.emailService, id)).map((r) => r.id));
    const settings = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: LOC.brandSettings, contextKey: id }, select: { id: true } });
    await prisma.heritageRecord.deleteMany({ where: { id: { in: settings.map((x) => x.id) } } });
  }
  if (entity === "regions") block("campus", await usage(inst, LOC.campus, "region", id));
  if (entity === "provinces") block("campus", await usage(inst, LOC.campus, "province", id));
  if (entity === "classroomTypes") block("classroom", await usage(inst, LOC.classroom, "type", id));
  if (entity === "campuses") {
    const campusName = s(rec.data.name);
    const [cohorts, meta] = await Promise.all([
      prisma.cohort.count({ where: { institutionId: inst, campus: campusName } }),
      studentMetaMap(inst),
    ]);
    const students = Object.values(meta).filter((m) => m.campus === campusName).length;
    if (cohorts || students) {
      throw httpError(
        409,
        `"${name}" is still assigned to ${cohorts} cohort(s) and ${students} student profile(s). Reassign them before deleting the campus.`,
        "CONFLICT",
      );
    }
    cascade.push(...(await list(inst, LOC.classroom, id)).map((r) => r.id));
  }
  if (entity === "institutions")
    for (const sc of [LOC.agreement, LOC.bridge, LOC.transferCourse]) cascade.push(...(await list(inst, sc, id)).map((r) => r.id));
  await remove(inst, user.accountId, [id, ...cascade]);
  await audit(user, def.audit, rec.contextKey, `delete ${def.label.toLowerCase()}`, { recordId: id, before: publicData(entity, rec.data), note: cascade.length ? `${cascade.length} related record(s) removed` : undefined });
  const extra =
    entity === "campuses" && cascade.length
      ? ` with ${cascade.length} classroom(s)`
      : entity === "brands" && cascade.length
        ? ` with ${cascade.length} e-mail service(s)`
        : entity === "institutions" && cascade.length
          ? ` with ${cascade.length} agreement / program / course record(s)`
          : "";
  return { ok: true, message: `${def.label} "${name}" deleted${extra}` };
}

/* ------------------------------------------------------------------ */
/* Brand settings tabs                                                  */
/* ------------------------------------------------------------------ */

export async function getBrandSettings(user: SessionClaims, brandId: string, tab: SettingsTab) {
  await assertPermission(user, "locationManagement", "view");
  const inst = user.institutionId;
  const brand = await find(inst, LOC.brand, brandId, "Brand");
  const t = SETTINGS_TABS[tab];
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: LOC.brandSettings, contextKey: brandId, singletonKey: tab } });
  const stored = row ? parse(row.dataJson) : {};
  const values: Data = {};
  for (const f of t.fields) values[f.key] = f.key in stored ? stored[f.key] : (f.dflt ?? "");
  return { brand: { id: brand.id, name: s(brand.data.name) }, tab, values, updatedAt: row?.updatedAt.toISOString() ?? null };
}

export async function saveBrandSettings(user: SessionClaims, brandId: string, tab: SettingsTab, body: Data) {
  await assertPermission(user, "locationManagement", "edit");
  const inst = user.institutionId;
  const brand = await find(inst, LOC.brand, brandId, "Brand");
  const t = SETTINGS_TABS[tab];
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: LOC.brandSettings, contextKey: brandId, singletonKey: tab } });
  const before = row ? parse(row.dataJson) : {};
  const data = await clean(inst, t.fields, body, before, lookupFor(inst));
  if (tab === "academic" && Number(data.weightFrom) > Number(data.weightTo)) throw httpError(400, "Grading Weight Threshold: From % must not be greater than To %");
  if (row) await update(user.accountId, row.id, data);
  else
    await prisma.heritageRecord.create({
      data: { institutionId: inst, screenId: LOC.brandSettings, contextKey: brandId, singletonKey: tab, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
    });
  await audit(user, t.audit, brandId, `save ${t.label.toLowerCase()}`, { recordId: brandId, before, after: data });
  return { ok: true, message: `${t.label} saved for ${s(brand.data.name)}` };
}

/* ------------------------------------------------------------------ */
/* Campuses & Classrooms grouped directory                              */
/* ------------------------------------------------------------------ */

export async function campusDirectory(user: SessionClaims, opts: { brand?: string; region?: string }) {
  await assertPermission(user, "locationManagement", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const [campuses, classrooms, types, brands, regions, provinces] = await Promise.all([
    list(inst, LOC.campus),
    list(inst, LOC.classroom),
    list(inst, LOC.classroomType),
    list(inst, LOC.brand),
    list(inst, LOC.region),
    list(inst, LOC.province),
  ]);
  const typeName = new Map(types.map((t) => [t.id, s(t.data.name)]));
  const provName = new Map(provinces.map((p) => [p.id, s(p.data.name)]));
  const shown = campuses
    .filter((c) => (!opts.brand || s(c.data.brand) === opts.brand) && (!opts.region || s(c.data.region) === opts.region))
    .sort((x, y) => campusDisplay(x.data).localeCompare(campusDisplay(y.data), undefined, { numeric: true, sensitivity: "base" }));
  return {
    brands: brands.map((b) => ({ id: b.id, name: s(b.data.name) })),
    regions: regions.map((r) => ({ id: r.id, name: s(r.data.name) })),
    classroomTypes: types.map((t) => ({ id: t.id, name: s(t.data.name), abbreviation: s(t.data.abbreviation) })),
    campuses: shown.map((c) => ({
      id: c.id,
      name: s(c.data.name),
      display: campusDisplay(c.data),
      active: s(c.data.active) || "Active",
      address: addressLine(c.data, provName.get(s(c.data.province)) ?? ""),
      classrooms: classrooms
        .filter((r) => r.contextKey === c.id)
        .map((r) => ({ id: r.id, name: s(r.data.name), type: typeName.get(s(r.data.type)) ?? "", seats: r.data.size ?? "", active: s(r.data.active) || "Active" }))
        .sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true })),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Files (campus logo, institution file, agreement documents, outline)  */
/* ------------------------------------------------------------------ */

const FILE_MAX = 8 * 1024 * 1024;
const FILE_TYPES = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/vnd\.ms-excel|text\/plain|text\/csv)$/;

export async function uploadFile(user: SessionClaims, body: { name: string; mime: string; base64: string }) {
  await assertPermission(user, "locationManagement", "edit");
  const name = s(body.name).replace(/[\\/]/g, "_").slice(0, 200);
  const mime = s(body.mime).toLowerCase();
  if (!name) throw httpError(400, "File name is required");
  if (!FILE_TYPES.test(mime)) throw httpError(400, "Unsupported file type. Upload an image, PDF, Word, Excel, PowerPoint, text or CSV file.");
  const b64 = s(body.base64).replace(/^data:[^,]*,/, "");
  const bytes = decodeBase64(b64);
  const size = bytes.length;
  if (!size) throw httpError(400, "The file is empty");
  if (size > FILE_MAX) throw httpError(400, "Files must be 8 MB or smaller");
  if (!bytesMatchMime(bytes, mime)) throw httpError(400, "File contents do not match the declared file type");
  const rec = await insert(user.institutionId, user.accountId, LOC.file, { name, mime, size, base64: b64 });
  return { id: rec.id, name, mime, size };
}

export async function downloadFile(user: SessionClaims, id: string) {
  await assertPermission(user, "locationManagement", "view");
  const rec = await find(user.institutionId, LOC.file, id, "File");
  return { name: s(rec.data.name), mime: s(rec.data.mime), base64: s(rec.data.base64) };
}
