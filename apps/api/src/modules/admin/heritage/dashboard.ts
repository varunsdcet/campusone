import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { z } from "zod";
import { assertPermission, effectiveAccess } from "../superAdmin.service.js";
import { audit, refs } from "./service.js";
import { sanitizeHtml } from "./sysconfig.js";

const PAGE_SCREEN = "DASH:PAGE";
const BLOCK_SCREEN = "DASH:BLOCK";
const AUDIT_SCREEN = "G02";

export const PAGE_LAYOUTS = ["Full Screen", "Two Columns"] as const;
export const BLOCK_TYPES = ["Rich Text Content"] as const;
export const CONTENT_STATUSES = ["Active", "Inactive"] as const;
export const TIMEFRAMES = ["Immediately", "Define Dates"] as const;
export const CONTENT_ACCESS = ["Everyone", "Select Access Level"] as const;

/** Student Access Settings: key, label, "all" option, "select" option, reference list. */
export const STUDENT_SCOPES = [
  { key: "campus", label: "Campus", all: "All Campuses", select: "Select Campuses", list: "campuses" },
  { key: "status", label: "Status", all: "All Statuses", select: "Select Statuses", list: "statuses" },
  { key: "program", label: "Program of Study", all: "All Programs", select: "Select Programs", list: "programs" },
  { key: "rate", label: "Rate Category", all: "All Rates", select: "Select Rates", list: "rateCategories" },
  { key: "nationality", label: "Nationality", all: "All Nationalities", select: "Select Nationalities", list: "countries" },
  { key: "advisor", label: "Advisor", all: "All Advisors", select: "Select Advisors", list: "staff" },
] as const;

type ScopeKey = (typeof STUDENT_SCOPES)[number]["key"];
type Scope = { mode: "all" | "select"; values: string[] };
type Data = Record<string, unknown>;

export type DashboardSettings = { title: string; layout: (typeof PAGE_LAYOUTS)[number] };

export type DashboardBlock = {
  id: string;
  name: string;
  type: (typeof BLOCK_TYPES)[number];
  content: string;
  status: (typeof CONTENT_STATUSES)[number];
  timeframe: (typeof TIMEFRAMES)[number];
  startDate: string;
  endDate: string;
  access: (typeof CONTENT_ACCESS)[number];
  accessLevels: string[];
  studentAccess: Record<ScopeKey, Scope>;
  order: number;
  updatedAt: string;
};

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
const str = (v: unknown) => (typeof v === "string" ? v : "");
const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] => (list.includes(str(v)) ? (str(v) as T[number]) : fallback);

function allScopes(): Record<ScopeKey, Scope> {
  return Object.fromEntries(STUDENT_SCOPES.map((s) => [s.key, { mode: "all", values: [] } as Scope])) as Record<ScopeKey, Scope>;
}

/* ------------------------------------------------------------------ */
/* Seed: the original Heritage dashboard content                        */
/* ------------------------------------------------------------------ */

const ANNOUNCEMENT_HTML = `<div><h2>ANNOUNCEMENT:</h2><p>Your classes have been cancelled today...</p></div>`;

const PAGE_CONTENT_HTML = [
  `<div style="background-image: url('/brand/campus/hero.png'); background-size: cover; background-position: center; border-radius: 12px; padding: 48px 32px;">`,
  `<div style="background-color: rgba(10, 37, 25, 0.72); color: #ffffff; max-width: 620px; padding: 24px 28px; border-radius: 10px;">`,
  `<h1 style="font-size: 30px; letter-spacing: 0.04em; margin: 0 0 4px;">HERITAGE COMMUNITY COLLEGE</h1>`,
  `<h2 style="font-size: 20px; letter-spacing: 0.08em; color: #c7e59a; margin: 0 0 12px;">WELCOME STUDENTS</h2>`,
  `<p>Welcome to Heritage Community College. Every day is an opportunity to learn, grow, and take another step toward your goals.</p>`,
  `<p><em>“Education is the foundation that transforms dreams into achievements.”</em></p>`,
  `</div></div>`,
  `<div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px;">`,
  `<div style="flex: 1 1 280px;">`,
  `<div style="border: 1px solid #d9e3d0; border-radius: 10px; padding: 16px 20px; background-color: #f6faf2;">`,
  `<h3 style="color: #2f6b1f; margin: 0 0 8px;">Student Reminders</h3>`,
  `<ul><li>Check Moodle daily for updates.</li><li>Review assignments and upcoming deadlines.</li><li>Attend all scheduled classes.</li><li>Seek support early if you need assistance.</li></ul>`,
  `</div>`,
  `<div style="border: 1px solid #d9e3d0; border-radius: 10px; padding: 16px 20px; margin-top: 16px;">`,
  `<h3 style="color: #2f6b1f; margin: 0 0 8px;">Shaping Skills for the Future</h3>`,
  `<p>Your education today is building the foundation for tomorrow. Keep learning with purpose, confidence, and dedication.</p>`,
  `</div></div>`,
  `<div style="flex: 1 1 280px; border: 1px solid #d9e3d0; border-radius: 10px; padding: 16px 20px;">`,
  `<h3 style="color: #2f6b1f; margin: 0 0 8px;">Important Student Information</h3>`,
  `<p>You can access your course schedule at any time by going to <span><strong>My Records → Program Plan</strong></span>.</p>`,
  `<p>Your Program Plan shows:</p>`,
  `<ul><li>Course names</li><li>Start and end dates</li><li>Class timings</li><li>Course status updates</li></ul>`,
  `<p><strong>Important:</strong> Please check your Program Plan 5–7 days before each course starts.</p>`,
  `<p>Remember to check your college email regularly for important announcements and communications.</p>`,
  `</div></div>`,
].join("");

const seeding = new Map<string, Promise<void>>();

async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  const page = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PAGE_SCREEN, contextKey: "", singletonKey: "settings" } });
  if (page) return;
  if (!seeding.has(inst)) seeding.set(inst, seed(user).finally(() => seeding.delete(inst)));
  await seeding.get(inst);
}

async function seed(user: SessionClaims) {
  const inst = user.institutionId;
  const a = user.accountId;
  const settings: DashboardSettings = { title: "Dashboard", layout: "Full Screen" };
  const blocks: Data[] = [
    {
      name: "Announcement for Students",
      type: "Rich Text Content",
      content: ANNOUNCEMENT_HTML,
      status: "Inactive",
      timeframe: "Immediately",
      access: "Select Access Level",
      accessLevels: ["Student"],
      studentAccess: allScopes(),
      _order: 0,
    },
    {
      name: "Page Content",
      type: "Rich Text Content",
      content: PAGE_CONTENT_HTML,
      status: "Active",
      timeframe: "Immediately",
      access: "Everyone",
      accessLevels: [],
      studentAccess: allScopes(),
      _order: 1,
    },
  ];
  await prisma.$transaction(async (tx) => {
    const exists = await tx.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PAGE_SCREEN, contextKey: "", singletonKey: "settings" } });
    if (exists) return;
    await tx.heritageRecord.create({ data: { institutionId: inst, screenId: PAGE_SCREEN, contextKey: "", singletonKey: "settings", dataJson: JSON.stringify(settings), createdById: a, updatedById: a } });
    for (const b of blocks) {
      await tx.heritageRecord.create({ data: { institutionId: inst, screenId: BLOCK_SCREEN, contextKey: "", dataJson: JSON.stringify(b), status: String(b.status).toLowerCase(), createdById: a, updatedById: a } });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Read                                                                 */
/* ------------------------------------------------------------------ */

function toSettings(d: Data): DashboardSettings {
  return { title: str(d.title) || "Dashboard", layout: pick(PAGE_LAYOUTS, d.layout, "Full Screen") };
}

function toBlock(r: { id: string; dataJson: string; updatedAt: Date }): DashboardBlock {
  const d = parse(r.dataJson);
  const scopes = allScopes();
  const raw = (d.studentAccess ?? {}) as Data;
  for (const s of STUDENT_SCOPES) {
    const v = (raw[s.key] ?? {}) as Data;
    const values = Array.isArray(v.values) ? v.values.map(String) : [];
    scopes[s.key] = { mode: v.mode === "select" && values.length ? "select" : "all", values: v.mode === "select" ? values : [] };
  }
  return {
    id: r.id,
    name: str(d.name),
    type: pick(BLOCK_TYPES, d.type, "Rich Text Content"),
    content: str(d.content),
    status: pick(CONTENT_STATUSES, d.status, "Active"),
    timeframe: pick(TIMEFRAMES, d.timeframe, "Immediately"),
    startDate: str(d.startDate),
    endDate: str(d.endDate),
    access: pick(CONTENT_ACCESS, d.access, "Everyone"),
    accessLevels: Array.isArray(d.accessLevels) ? d.accessLevels.map(String) : [],
    studentAccess: scopes,
    order: typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER,
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function loadSettings(inst: string) {
  const row = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: PAGE_SCREEN, contextKey: "", singletonKey: "settings" } });
  return { row, settings: toSettings(row ? parse(row.dataJson) : {}) };
}

async function loadBlocks(inst: string) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: BLOCK_SCREEN, deletedAt: null, singletonKey: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toBlock).sort((x, y) => x.order - y.order);
}

async function assertDashboardEdit(user: SessionClaims) {
  await assertPermission(user, "systemConfiguration", "edit");
  const [policy, access] = await Promise.all([
    prisma.heritageRecord.findFirst({
      where: { institutionId: user.institutionId, screenId: "SYS:SETTINGS", contextKey: "", singletonKey: "dashboard", deletedAt: null },
      select: { dataJson: true },
    }),
    effectiveAccess(user.institutionId, user.accountId),
  ]);
  const configured = policy ? parse(policy.dataJson).managementAccess : [];
  const accountIds = Array.isArray(configured) ? configured.map(String).filter(Boolean) : [];
  if (accountIds.length && !access.superAdmin && !accountIds.includes(user.accountId)) {
    throw httpError(403, "Dashboard page management access is not assigned to this account", "FORBIDDEN");
  }
}

async function canEditDashboard(user: SessionClaims) {
  try {
    await assertDashboardEdit(user);
    return true;
  } catch {
    return false;
  }
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function availableNow(b: DashboardBlock, day: string) {
  if (b.status !== "Active") return false;
  if (b.timeframe === "Immediately") return true;
  if (b.startDate && day < b.startDate) return false;
  if (b.endDate && day > b.endDate) return false;
  return true;
}

/** Dashboard as the signed-in viewer sees it: active, in its timeframe, and open to their access level. */
export async function viewDashboard(user: SessionClaims) {
  await ensureSeed(user);
  const [{ settings }, blocks, access, canEdit] = await Promise.all([
    loadSettings(user.institutionId),
    loadBlocks(user.institutionId),
    effectiveAccess(user.institutionId, user.accountId),
    canEditDashboard(user),
  ]);
  const level = access.accessLevel ?? (access.superAdmin ? "System Administrator" : "");
  const day = today();
  const visible = blocks.filter((b) => availableNow(b, day) && (b.access === "Everyone" || b.accessLevels.includes(level)));
  return { settings, blocks: visible.map(({ id, name, content }) => ({ id, name, content })), canEdit };
}

export async function manageDashboard(user: SessionClaims) {
  await assertPermission(user, "systemConfiguration", "view");
  await ensureSeed(user);
  const [{ settings }, blocks, r, canEdit] = await Promise.all([loadSettings(user.institutionId), loadBlocks(user.institutionId), refs(user), canEditDashboard(user)]);
  return {
    settings,
    blocks,
    canEdit,
    options: {
      layouts: PAGE_LAYOUTS,
      blockTypes: BLOCK_TYPES,
      statuses: CONTENT_STATUSES,
      timeframes: TIMEFRAMES,
      access: CONTENT_ACCESS,
      accessLevels: r.accessLevels ?? [],
      studentScopes: STUDENT_SCOPES.map((s) => ({ key: s.key, label: s.label, all: s.all, select: s.select, values: r[s.list] ?? [] })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Write                                                                */
/* ------------------------------------------------------------------ */

export const SettingsBody = z.object({
  title: z.string().trim().min(1, "Heading / Title is required").max(150),
  layout: z.enum(PAGE_LAYOUTS),
});

export async function saveSettings(user: SessionClaims, body: z.infer<typeof SettingsBody>) {
  await assertDashboardEdit(user);
  await ensureSeed(user);
  const { row, settings: before } = await loadSettings(user.institutionId);
  const next: DashboardSettings = { title: body.title, layout: body.layout };
  if (row) await prisma.heritageRecord.update({ where: { id: row.id }, data: { dataJson: JSON.stringify(next), updatedById: user.accountId, rowVersion: { increment: 1 } } });
  await audit(user, AUDIT_SCREEN, "", "save (Save Page Details)", { recordId: row?.id ?? null, before, after: next });
  return { ok: true, settings: next, message: "Dashboard settings updated successfully." };
}

const Scope = z.object({ mode: z.enum(["all", "select"]), values: z.array(z.string().max(200)).max(500).default([]) });
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD").or(z.literal(""));

export const BlockBody = z.object({
  name: z.string().trim().min(1, "Content Reference Name is required").max(120),
  type: z.enum(BLOCK_TYPES, { errorMap: () => ({ message: "Select a Content Block Type" }) }),
  content: z.string().max(400_000).default(""),
  status: z.enum(CONTENT_STATUSES),
  timeframe: z.enum(TIMEFRAMES),
  startDate: DATE.default(""),
  endDate: DATE.default(""),
  access: z.enum(CONTENT_ACCESS),
  accessLevels: z.array(z.string().max(120)).max(50).default([]),
  studentAccess: z.record(z.string(), Scope).default({}),
});

type BlockInput = z.infer<typeof BlockBody>;

async function cleanBlock(user: SessionClaims, body: BlockInput): Promise<Data> {
  const errors: string[] = [];
  if (body.timeframe === "Define Dates") {
    if (!body.startDate) errors.push("Start Date is required when Available Timeframe is Define Dates");
    if (body.startDate && body.endDate && body.endDate < body.startDate) errors.push("End Date cannot be before Start Date");
  }
  const r = await refs(user);
  let accessLevels: string[] = [];
  const studentAccess = allScopes();
  if (body.access === "Select Access Level") {
    const known = new Set(r.accessLevels ?? []);
    accessLevels = [...new Set(body.accessLevels)].filter((l) => known.has(l));
    if (!accessLevels.length) errors.push("Select at least one access level");
    for (const s of STUDENT_SCOPES) {
      const v = body.studentAccess[s.key];
      if (v?.mode !== "select") continue;
      const allowed = new Set(r[s.list] ?? []);
      const values = [...new Set(v.values)].filter((x) => allowed.has(x));
      if (!values.length) errors.push(`${s.label}: choose at least one option or use ${s.all}`);
      studentAccess[s.key] = { mode: "select", values };
    }
  }
  if (errors.length) throw httpError(400, errors.join(". "));
  const dated = body.timeframe === "Define Dates";
  return {
    name: body.name,
    type: body.type,
    content: sanitizeHtml(body.content),
    status: body.status,
    timeframe: body.timeframe,
    startDate: dated ? body.startDate : "",
    endDate: dated ? body.endDate : "",
    access: body.access,
    accessLevels,
    studentAccess,
  };
}

async function findBlock(inst: string, id: string) {
  const row = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: BLOCK_SCREEN, deletedAt: null, singletonKey: null } });
  if (!row) throw httpError(404, "Content block not found", "NOT_FOUND");
  return row;
}

async function assertUniqueName(inst: string, name: string, self?: string) {
  const clash = (await loadBlocks(inst)).find((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase() && b.id !== self);
  if (clash) throw httpError(409, `A content block named “${clash.name}” already exists`, "CONFLICT");
}

export async function createBlock(user: SessionClaims, body: BlockInput) {
  await assertDashboardEdit(user);
  await ensureSeed(user);
  const inst = user.institutionId;
  await assertUniqueName(inst, body.name);
  const data = await cleanBlock(user, body);
  const blocks = await loadBlocks(inst);
  data._order = blocks.length ? Math.max(...blocks.map((b) => (Number.isFinite(b.order) ? b.order : 0))) + 1 : 0;
  const row = await prisma.heritageRecord.create({
    data: { institutionId: inst, screenId: BLOCK_SCREEN, contextKey: "", dataJson: JSON.stringify(data), status: String(data.status).toLowerCase(), createdById: user.accountId, updatedById: user.accountId },
  });
  await audit(user, AUDIT_SCREEN, "", "create (Save Content)", { recordId: row.id, after: { ...data, content: undefined } });
  return { ok: true, block: toBlock(row), message: `Content block “${body.name}” created.` };
}

export async function updateBlock(user: SessionClaims, id: string, body: BlockInput) {
  await assertDashboardEdit(user);
  const inst = user.institutionId;
  const row = await findBlock(inst, id);
  await assertUniqueName(inst, body.name, id);
  const before = parse(row.dataJson);
  const data: Data = { ...(await cleanBlock(user, body)), _order: before._order };
  const saved = await prisma.heritageRecord.update({
    where: { id },
    data: { dataJson: JSON.stringify(data), status: String(data.status).toLowerCase(), updatedById: user.accountId, rowVersion: { increment: 1 } },
  });
  await audit(user, AUDIT_SCREEN, "", "update (Save Content)", { recordId: id, before: { ...before, content: undefined }, after: { ...data, content: undefined } });
  return { ok: true, block: toBlock(saved), message: `Content block “${body.name}” saved.` };
}

export async function deleteBlock(user: SessionClaims, id: string) {
  await assertDashboardEdit(user);
  const row = await findBlock(user.institutionId, id);
  await prisma.heritageRecord.update({ where: { id }, data: { deletedAt: new Date(), status: "deleted", updatedById: user.accountId } });
  const name = str(parse(row.dataJson).name);
  await audit(user, AUDIT_SCREEN, "", "delete (Content Block)", { recordId: id, before: { name } });
  return { ok: true, message: `Content block “${name}” deleted.` };
}

export async function reorderBlocks(user: SessionClaims, ids: string[]) {
  await assertDashboardEdit(user);
  const inst = user.institutionId;
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: BLOCK_SCREEN, deletedAt: null, singletonKey: null } });
  const known = new Set(rows.map((r) => r.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) {
    throw httpError(409, "The block list changed. Reload the page and try again.", "CONFLICT");
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  await prisma.$transaction(
    ids.map((id, i) => prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify({ ...parse(byId.get(id)!.dataJson), _order: i }), updatedById: user.accountId } })),
  );
  await audit(user, AUDIT_SCREEN, "", "reorder (Content Blocks)", { after: ids });
  return { ok: true, message: "Content block order saved." };
}
