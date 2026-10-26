import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { hashPassword } from "@myheritage/auth";
import type { RoleName, SessionClaims } from "@myheritage/contracts";
import {
  DELIVERY_OPTIONS,
  PROGRAM_GROUPS,
  RESIDENCY_OPTIONS,
  STATUS_OPTIONS,
  admissionTermOptions,
  deliveryMatches,
  key as catalogKey,
  termMatches,
} from "./studentSearchCatalog.js";
import { currentStudentId } from "../me/studentAlignment.js";

/* ------------------------------------------------------------------ */
/* Key-value store on SisScreenState (paths never start with /admin,  */
/* so the generic /admin/sis/screen reader cannot expose them).        */
/* ------------------------------------------------------------------ */

const KV_PREFIX = "super:";

async function kvGet<T>(institutionId: string, key: string, fallback: T): Promise<T> {
  const row = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path: `${KV_PREFIX}${key}` } },
  });
  if (!row) return fallback;
  try {
    return JSON.parse(row.payloadJson) as T;
  } catch {
    return fallback;
  }
}

async function kvSet(institutionId: string, key: string, value: unknown) {
  const path = `${KV_PREFIX}${key}`;
  const payloadJson = JSON.stringify(value);
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path } },
    create: { institutionId, path, payloadJson },
    update: { payloadJson, rowVersion: { increment: 1 } },
  });
}

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

async function audit(user: SessionClaims, eventName: string, after: unknown) {
  await prisma.auditEvent.create({
    data: {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName,
      purpose: "super_admin",
      afterJson: JSON.stringify(after),
      source: "api",
      correlationId: randomUUID(),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Permissions / access levels                                          */
/* ------------------------------------------------------------------ */

export const PERMISSION_MODULES = [
  { key: "systemConfiguration", label: "System Configuration" },
  { key: "userManagement", label: "User Management" },
  { key: "programManagement", label: "Program Management" },
  { key: "courseManagement", label: "Course Management" },
  { key: "locationManagement", label: "Location Management" },
  { key: "studentRecords", label: "Student Records" },
  { key: "facultyProfiles", label: "Faculty Profiles" },
  { key: "agentManagement", label: "Agent Management" },
  { key: "housingManagement", label: "Housing Management" },
  { key: "financialManagement", label: "Financial Management" },
  { key: "userRequests", label: "User Requests" },
  { key: "reporting", label: "Reporting" },
  { key: "emailMessaging", label: "E-mail / Messaging" },
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number]["key"];

const PermissionLevel = z.enum(["full", "read", "none", "custom"]);

const PermissionEntry = z.object({
  override: z.boolean().default(false),
  level: PermissionLevel.default("none"),
  custom: z
    .object({
      view: z.boolean().default(false),
      create: z.boolean().default(false),
      edit: z.boolean().default(false),
      delete: z.boolean().default(false),
    })
    .optional(),
});

type PermissionEntry = z.infer<typeof PermissionEntry>;
type PermissionMap = Record<PermissionModuleKey, PermissionEntry>;

const PermissionMapSchema = z
  .record(z.string(), PermissionEntry)
  .transform((raw) => normalizePermissions(raw as Partial<PermissionMap>));

function normalizePermissions(raw: Partial<Record<string, PermissionEntry>> | undefined, fallback: PermissionEntry["level"] = "none"): PermissionMap {
  const out = {} as PermissionMap;
  for (const m of PERMISSION_MODULES) {
    const entry = raw?.[m.key];
    out[m.key] = {
      override: Boolean(entry?.override),
      level: entry?.level ?? fallback,
      ...(entry?.level === "custom"
        ? {
            custom: {
              view: Boolean(entry.custom?.view),
              create: Boolean(entry.custom?.create),
              edit: Boolean(entry.custom?.edit),
              delete: Boolean(entry.custom?.delete),
            },
          }
        : {}),
    };
  }
  return out;
}

function permissionsWith(levels: Partial<Record<PermissionModuleKey, PermissionEntry["level"]>>, fallback: PermissionEntry["level"]) {
  const raw: Partial<Record<string, PermissionEntry>> = {};
  for (const m of PERMISSION_MODULES) raw[m.key] = { override: false, level: levels[m.key] ?? fallback };
  return normalizePermissions(raw, fallback);
}

export const PROFILE_TYPES = ["Staff", "Faculty", "Student"] as const;

export type AccessLevel = {
  id: string;
  name: string;
  profileType: (typeof PROFILE_TYPES)[number];
  assignableByNonAdmins: boolean;
  permissions: PermissionMap;
};

function defaultAccessLevels(): AccessLevel[] {
  return [
    {
      id: "admin",
      name: "Admin",
      profileType: "Staff",
      assignableByNonAdmins: false,
      permissions: permissionsWith({ systemConfiguration: "read" }, "full"),
    },
    {
      id: "faculty",
      name: "Faculty",
      profileType: "Faculty",
      assignableByNonAdmins: true,
      permissions: permissionsWith(
        {
          programManagement: "read",
          courseManagement: "read",
          studentRecords: "read",
          facultyProfiles: "full",
          emailMessaging: "full",
          userRequests: "read",
        },
        "none",
      ),
    },
    {
      id: "ptru",
      name: "PTRU",
      profileType: "Staff",
      assignableByNonAdmins: true,
      permissions: permissionsWith(
        {
          programManagement: "read",
          courseManagement: "read",
          locationManagement: "read",
          studentRecords: "read",
          facultyProfiles: "read",
          reporting: "read",
        },
        "none",
      ),
    },
    {
      id: "student",
      name: "Student",
      profileType: "Student",
      assignableByNonAdmins: false,
      permissions: permissionsWith(
        { courseManagement: "read", studentRecords: "read", financialManagement: "read", userRequests: "full", emailMessaging: "full" },
        "none",
      ),
    },
    {
      id: "system-administrator",
      name: "System Administrator",
      profileType: "Staff",
      assignableByNonAdmins: false,
      permissions: permissionsWith({}, "full"),
    },
    registrarAccessLevel(),
  ];
}

/** Registrar's office: student lifecycle (admissions, records, enrolment, grades, requests); no system or user administration. */
function registrarAccessLevel(): AccessLevel {
  return {
    id: "registrar",
    name: "Registrar",
    profileType: "Staff",
    assignableByNonAdmins: false,
    permissions: permissionsWith(
      {
        userManagement: "read",
        programManagement: "full",
        courseManagement: "full",
        locationManagement: "read",
        studentRecords: "full",
        facultyProfiles: "read",
        agentManagement: "read",
        housingManagement: "read",
        financialManagement: "read",
        userRequests: "full",
        reporting: "full",
        emailMessaging: "full",
      },
      "none",
    ),
  };
}

export async function listAccessLevels(institutionId: string): Promise<AccessLevel[]> {
  const stored = await kvGet<AccessLevel[] | null>(institutionId, "access-levels", null);
  if (!stored) return defaultAccessLevels();
  const levels = stored.map((l) => ({ ...l, permissions: normalizePermissions(l.permissions) }));
  return levels.some((l) => l.id === "registrar") ? levels : [...levels, registrarAccessLevel()];
}

async function syncAccessLevelDefinition(institutionId: string, level: AccessLevel) {
  return prisma.accessLevelDefinition.upsert({
    where: { institutionId_key: { institutionId, key: level.id } },
    create: {
      institutionId,
      key: level.id,
      name: level.name,
      profileType: level.profileType,
      assignableByNonAdmins: level.assignableByNonAdmins,
      permissionsJson: JSON.stringify(level.permissions),
    },
    update: {
      name: level.name,
      profileType: level.profileType,
      assignableByNonAdmins: level.assignableByNonAdmins,
      permissionsJson: JSON.stringify(level.permissions),
      active: true,
    },
  });
}

async function assignNormalizedAccessLevel(institutionId: string, accountId: string, level: AccessLevel, actorId: string) {
  const definition = await syncAccessLevelDefinition(institutionId, level);
  const current = await prisma.accountAccessLevelAssignment.findUnique({
    where: { institutionId_accountId: { institutionId, accountId } },
  });
  if (current?.accessLevelId === definition.id) return;
  await prisma.$transaction([
    prisma.accountAccessLevelAssignment.upsert({
      where: { institutionId_accountId: { institutionId, accountId } },
      create: { institutionId, accountId, accessLevelId: definition.id, assignedById: actorId },
      update: { accessLevelId: definition.id, assignedAt: new Date(), assignedById: actorId },
    }),
    prisma.accountAccessLevelHistory.create({
      data: { institutionId, accountId, accessLevelId: definition.id, changedById: actorId },
    }),
  ]);
}

export const AccessLevelBody = z.object({
  name: z.string().trim().min(1).max(80),
  profileType: z.enum(PROFILE_TYPES),
  assignableByNonAdmins: z.boolean(),
  permissions: PermissionMapSchema,
});

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "level";
}

async function assertAdministrator(user: SessionClaims, what: string) {
  const actor = await effectiveAccess(user.institutionId, user.accountId);
  if (!actor.administrator) throw httpError(403, `Only administrators can ${what}`, "FORBIDDEN");
  return actor;
}

/** The KV blobs are read-modify-write; concurrent saves on one API process must not drop each other's changes. */
const blobLocks = new Map<string, Promise<unknown>>();
function withBlobLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const prev = blobLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(run);
  const tail = next.catch(() => undefined);
  blobLocks.set(key, tail);
  void tail.then(() => {
    if (blobLocks.get(key) === tail) blobLocks.delete(key);
  });
  return next;
}

/** Built-in levels the platform depends on; only their name can change so nobody can lock administrators out. */
const PROTECTED_LEVELS = new Set(["admin", "system-administrator"]);

export function upsertAccessLevel(user: SessionClaims, id: string | null, body: z.infer<typeof AccessLevelBody>) {
  return withBlobLock(`access-levels:${user.institutionId}`, () => upsertAccessLevelLocked(user, id, body));
}

async function upsertAccessLevelLocked(user: SessionClaims, id: string | null, body: z.infer<typeof AccessLevelBody>) {
  await assertAdministrator(user, "change access levels");
  const levels = await listAccessLevels(user.institutionId);
  const clash = levels.find((l) => l.name.toLowerCase() === body.name.toLowerCase() && l.id !== id);
  if (clash) throw httpError(409, "An access level with this name already exists", "CONFLICT");
  let saved: AccessLevel;
  if (id) {
    const idx = levels.findIndex((l) => l.id === id);
    if (idx < 0) throw httpError(404, "Access level not found", "NOT_FOUND");
    saved = PROTECTED_LEVELS.has(id) ? { ...levels[idx], name: body.name, id } : { ...levels[idx], ...body, id };
    levels[idx] = saved;
  } else {
    let newId = slug(body.name);
    while (levels.some((l) => l.id === newId)) newId = `${slug(body.name)}-${randomUUID().slice(0, 4)}`;
    saved = { id: newId, ...body };
    levels.push(saved);
  }
  await kvSet(user.institutionId, "access-levels", levels);
  await syncAccessLevelDefinition(user.institutionId, saved);
  await audit(user, id ? "admin.access_level.update" : "admin.access_level.create", { id: saved.id, name: saved.name });
  return saved;
}

export function deleteAccessLevel(user: SessionClaims, id: string) {
  return withBlobLock(`access-levels:${user.institutionId}`, () => deleteAccessLevelLocked(user, id));
}

async function deleteAccessLevelLocked(user: SessionClaims, id: string) {
  await assertAdministrator(user, "delete access levels");
  const levels = await listAccessLevels(user.institutionId);
  const level = levels.find((l) => l.id === id);
  if (!level) throw httpError(404, "Access level not found", "NOT_FOUND");
  if (PROTECTED_LEVELS.has(id)) throw httpError(409, `${level.name} is a built-in access level and cannot be deleted`, "CONFLICT");
  const { assigned } = await accessLevelAssignments(user.institutionId);
  const inUse = assigned.get(id) ?? 0;
  if (inUse > 0) {
    throw httpError(409, `${level.name} is assigned to ${inUse} user${inUse === 1 ? "" : "s"}. Reassign them before deleting.`, "CONFLICT");
  }
  await kvSet(
    user.institutionId,
    "access-levels",
    levels.filter((l) => l.id !== id),
  );
  await prisma.accessLevelDefinition.updateMany({ where: { institutionId: user.institutionId, key: id }, data: { active: false } });
  await audit(user, "admin.access_level.delete", { id, name: level.name });
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const CAMPUSES = [
  "Heritage College – Surrey",
  "Heritage Community College – Distance",
  "Heritage Community College – Victoria",
  "Online",
] as const;

type UserMeta = {
  title?: string;
  postNominals?: string;
  employeeNumber?: string;
  login?: string;
  instructing?: boolean;
  accessLevelId?: string;
  customizeAccess?: boolean;
  permissions?: PermissionMap;
  customizeRegional?: boolean;
  campuses?: string[];
};

type UserMetaMap = Record<string, UserMeta>;

async function loadUserMeta(institutionId: string) {
  return kvGet<UserMetaMap>(institutionId, "user-meta", {});
}

function derivedAccessLevelId(roles: string[]) {
  if (roles.includes("admin")) return "system-administrator";
  if (roles.includes("registrar")) return "registrar";
  if (roles.includes("instructor")) return "faculty";
  if (roles.includes("student")) return "student";
  return null;
}

function rolesFor(level: AccessLevel | undefined, instructing: boolean): RoleName[] {
  const roles = new Set<RoleName>();
  if (level) {
    if (level.id === "system-administrator") roles.add("admin");
    else if (level.profileType === "Staff") roles.add(level.id === "admin" ? "admin" : "registrar");
    else if (level.profileType === "Faculty") roles.add("instructor");
    else if (level.profileType === "Student") roles.add("student");
  }
  if (instructing) roles.add("instructor");
  return [...roles];
}

async function accessLevelAssignments(institutionId: string) {
  const [accounts, meta] = await Promise.all([
    prisma.account.findMany({ where: { institutionId }, select: { id: true, rolesJson: true } }),
    loadUserMeta(institutionId),
  ]);
  const assigned = new Map<string, number>();
  for (const a of accounts) {
    const id = meta[a.id]?.accessLevelId ?? derivedAccessLevelId(safeRoles(a.rolesJson));
    if (id) assigned.set(id, (assigned.get(id) ?? 0) + 1);
  }
  return { assigned };
}

export type EffectiveAccess = {
  accessLevelId: string | null;
  accessLevel: string | null;
  profileType: string | null;
  superAdmin: boolean;
  /** Holds the admin role (not just an admin-like access level); only these may grant admin-only levels. */
  administrator: boolean;
  permissions: PermissionMap;
  campuses: string[];
};

export function canView(entry: PermissionEntry | undefined) {
  if (!entry) return false;
  return entry.level === "full" || entry.level === "read" || (entry.level === "custom" && Boolean(entry.custom?.view));
}

export function canEdit(entry: PermissionEntry | undefined) {
  if (!entry) return false;
  if (entry.level === "full") return true;
  return entry.level === "custom" && Boolean(entry.custom?.create || entry.custom?.edit || entry.custom?.delete);
}

export async function effectiveAccess(institutionId: string, accountId: string): Promise<EffectiveAccess> {
  const [account, meta, levels] = await Promise.all([
    prisma.account.findFirst({ where: { id: accountId, institutionId }, select: { rolesJson: true } }),
    loadUserMeta(institutionId),
    listAccessLevels(institutionId),
  ]);
  const roles = safeRoles(account?.rolesJson ?? "[]");
  const m = meta[accountId] ?? {};
  const level = levels.find((l) => l.id === (m.accessLevelId ?? derivedAccessLevelId(roles)));
  const superAdmin = roles.includes("admin") && (!level || level.id === "system-administrator");
  let permissions: PermissionMap;
  if (superAdmin) {
    permissions = permissionsWith({}, "full");
  } else {
    permissions = normalizePermissions(level?.permissions);
    if (m.customizeAccess && m.permissions) {
      for (const mod of PERMISSION_MODULES) {
        const own = m.permissions[mod.key];
        if (own?.override) permissions[mod.key] = { ...own };
      }
    }
  }
  return {
    accessLevelId: level?.id ?? null,
    accessLevel: level?.name ?? null,
    profileType: level?.profileType ?? null,
    superAdmin,
    administrator: roles.includes("admin") && (superAdmin || level?.id === "admin"),
    permissions,
    campuses: m.customizeRegional ? m.campuses ?? [] : [...CAMPUSES],
  };
}

export async function assertPermission(user: SessionClaims, module: PermissionModuleKey, mode: "view" | "edit") {
  const access = await effectiveAccess(user.institutionId, user.accountId);
  const entry = access.permissions[module];
  const ok = mode === "view" ? canView(entry) : canEdit(entry);
  if (!ok) {
    const label = PERMISSION_MODULES.find((m) => m.key === module)?.label ?? module;
    throw httpError(403, `Your access level does not allow ${mode === "view" ? "viewing" : "changing"} ${label}.`, "FORBIDDEN");
  }
  return access;
}

async function ensureStudentRecord(institutionId: string, personId: string) {
  const existing = await prisma.student.findFirst({ where: { institutionId, personId } });
  if (existing) return existing;
  const year = new Date().getFullYear();
  const prefix = `ST-${year}-`;
  const taken = new Set(
    (await prisma.student.findMany({ where: { institutionId, studentNumber: { startsWith: prefix } }, select: { studentNumber: true } })).map(
      (s) => s.studentNumber,
    ),
  );
  let n = taken.size + 1;
  while (taken.has(`${prefix}${String(n).padStart(3, "0")}`)) n++;
  return prisma.student.create({
    data: { institutionId, personId, studentNumber: `${prefix}${String(n).padStart(3, "0")}`, programName: "Not assigned" },
  });
}

function safeRoles(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export const UserListQuery = z.object({
  q: z.string().trim().optional(),
  accessLevel: z.string().trim().optional(),
  letter: z
    .string()
    .trim()
    .regex(/^[A-Za-z]$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(200).default(50),
});

export async function listUsers(institutionId: string, query: z.infer<typeof UserListQuery>) {
  const [accounts, meta, levels] = await Promise.all([
    prisma.account.findMany({ where: { institutionId }, include: { person: true } }),
    loadUserMeta(institutionId),
    listAccessLevels(institutionId),
  ]);
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  const q = query.q?.toLowerCase();
  const rows = accounts
    .map((a) => {
      const m = meta[a.id] ?? {};
      const roles = safeRoles(a.rolesJson);
      const accessLevelId = m.accessLevelId ?? derivedAccessLevelId(roles);
      return {
        accountId: a.id,
        givenName: a.person.givenName,
        familyName: a.person.familyName,
        preferredName: a.person.preferredName,
        email: a.email,
        login: m.login ?? null,
        accessLevelId,
        accessLevel: accessLevelId ? levelName.get(accessLevelId) ?? accessLevelId : "—",
        roles,
        disabled: a.status === "disabled",
      };
    })
    .filter((r) => {
      if (query.accessLevel && r.accessLevelId !== query.accessLevel) return false;
      if (query.letter && !r.familyName.toUpperCase().startsWith(query.letter.toUpperCase())) return false;
      if (q) {
        const hay = `${r.givenName} ${r.familyName} ${r.preferredName ?? ""} ${r.email} ${r.login ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));
  const total = rows.length;
  const start = (query.page - 1) * query.perPage;
  return { total, page: query.page, perPage: query.perPage, items: rows.slice(start, start + query.perPage) };
}

export async function getUser(institutionId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, institutionId },
    include: { person: true },
  });
  if (!account) throw httpError(404, "User not found", "NOT_FOUND");
  const meta = (await loadUserMeta(institutionId))[account.id] ?? {};
  const roles = safeRoles(account.rolesJson);
  const [levels, store] = await Promise.all([listAccessLevels(institutionId), loadFacultyStore(institutionId, account.id)]);
  const accessLevelId = meta.accessLevelId ?? derivedAccessLevelId(roles);
  const level = levels.find((l) => l.id === accessLevelId);
  return {
    accountId: account.id,
    givenName: account.person.givenName,
    familyName: account.person.familyName,
    preferredName: account.person.preferredName ?? "",
    email: account.email,
    phone: account.person.phone ?? "",
    title: meta.title ?? "",
    department: store.department,
    postNominals: meta.postNominals ?? "",
    employeeNumber: meta.employeeNumber ?? "",
    login: meta.login ?? "",
    instructing: meta.instructing ?? roles.includes("instructor"),
    disabled: account.status === "disabled",
    accessLevelId: accessLevelId ?? "",
    customizeAccess: Boolean(meta.customizeAccess),
    permissions: meta.customizeAccess && meta.permissions ? normalizePermissions(meta.permissions) : level?.permissions ?? permissionsWith({}, "none"),
    customizeRegional: Boolean(meta.customizeRegional),
    campuses: meta.customizeRegional ? meta.campuses ?? [] : [...CAMPUSES],
    roles,
  };
}

const LoginName = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, "User login may only contain letters, numbers, dots, dashes and underscores");

export const UserBody = z.object({
  givenName: z.string().trim().min(1).max(80),
  familyName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().default(""),
  title: z.string().trim().max(120).optional().default(""),
  department: z.string().trim().max(120).optional(),
  postNominals: z.string().trim().max(80).optional().default(""),
  employeeNumber: z.string().trim().max(40).optional().default(""),
  login: LoginName,
  password: z.string().min(8).max(200).optional(),
  instructing: z.boolean().default(false),
  disabled: z.boolean().default(false),
  accessLevelId: z.string().trim().min(1, "Select an access level"),
  customizeAccess: z.boolean().default(false),
  permissions: PermissionMapSchema.optional(),
  customizeRegional: z.boolean().default(false),
  campuses: z.array(z.enum(CAMPUSES)).default([]),
});

export function saveUser(user: SessionClaims, accountId: string | null, body: z.infer<typeof UserBody>) {
  return withBlobLock(`user-meta:${user.institutionId}`, () => saveUserLocked(user, accountId, body));
}

async function saveUserLocked(user: SessionClaims, accountId: string | null, body: z.infer<typeof UserBody>) {
  const institutionId = user.institutionId;
  const email = body.email.toLowerCase();
  const [levels, meta] = await Promise.all([listAccessLevels(institutionId), loadUserMeta(institutionId)]);
  const level = levels.find((l) => l.id === body.accessLevelId);
  if (!level) throw httpError(400, "Unknown access level");
  if (!accountId && !body.password) throw httpError(400, "Password is required for a new user");

  const loginLower = body.login.toLowerCase();
  const loginClash = Object.entries(meta).find(([id, m]) => id !== accountId && m.login?.toLowerCase() === loginLower);
  if (loginClash) throw httpError(409, "That user login is already taken", "CONFLICT");

  const emailClash = await prisma.account.findFirst({
    where: { institutionId, email, ...(accountId ? { id: { not: accountId } } : {}) },
  });
  if (emailClash) throw httpError(409, "Another user already uses this e-mail address", "CONFLICT");

  if (accountId === user.accountId && body.disabled) throw httpError(400, "You cannot disable your own account");

  const actor = await effectiveAccess(institutionId, user.accountId);
  const target = accountId
    ? await prisma.account.findFirst({ where: { id: accountId, institutionId }, select: { rolesJson: true } })
    : null;
  if (accountId && !target) throw httpError(404, "User not found", "NOT_FOUND");
  const targetRoles = safeRoles(target?.rolesJson ?? "[]");
  const roles = rolesFor(level, body.instructing);
  if (!actor.administrator) {
    if (!level.assignableByNonAdmins || roles.includes("admin")) {
      throw httpError(403, `Only administrators can assign the ${level.name} access level`, "FORBIDDEN");
    }
    if (accountId) {
      const currentId = meta[accountId]?.accessLevelId ?? derivedAccessLevelId(targetRoles);
      const current = levels.find((l) => l.id === currentId);
      if (targetRoles.includes("admin") || (current && !current.assignableByNonAdmins)) {
        throw httpError(403, `Only administrators can edit users with the ${current?.name ?? "Admin"} access level`, "FORBIDDEN");
      }
    }
    if (body.customizeAccess && body.permissions) {
      for (const mod of PERMISSION_MODULES) {
        const wanted = body.permissions[mod.key];
        if (!wanted.override) continue;
        const own = actor.permissions[mod.key];
        if ((canEdit(wanted) && !canEdit(own)) || (canView(wanted) && !canView(own))) {
          throw httpError(403, `You cannot grant more ${mod.label} access than you have`, "FORBIDDEN");
        }
      }
    }
  }
  const rolesChanged = Boolean(target) && [...new Set(roles)].sort().join() !== targetRoles.filter((r) => r !== "applicant" && r !== "employer").sort().join();

  const passwordHash = body.password ? await hashPassword(body.password) : null;
  let id = accountId;

  await prisma.$transaction(async (tx) => {
    if (accountId) {
      const existing = await tx.account.findFirst({ where: { id: accountId, institutionId } });
      if (!existing) throw httpError(404, "User not found", "NOT_FOUND");
      const existingRoles = safeRoles(existing.rolesJson);
      const keep = existingRoles.filter((r) => r === "applicant" || r === "employer");
      await tx.person.update({
        where: { id: existing.personId },
        data: {
          givenName: body.givenName,
          familyName: body.familyName,
          preferredName: body.preferredName || null,
          phone: body.phone || null,
          email,
        },
      });
      await tx.account.update({
        where: { id: accountId },
        data: {
          email,
          status: body.disabled ? "disabled" : existing.status === "disabled" ? "active" : existing.status,
          rolesJson: JSON.stringify([...new Set([...roles, ...keep])]),
          ...(passwordHash ? { passwordHash } : {}),
          rowVersion: { increment: 1 },
        },
      });
      if (body.disabled || passwordHash || rolesChanged) {
        await tx.session.deleteMany({ where: { accountId } });
      }
    } else {
      // A registrar-created student (or any profile) already owns this e-mail's Person; the login joins that person.
      const person = await tx.person.findFirst({ where: { institutionId, email: { equals: email, mode: "insensitive" } }, include: { accounts: { select: { id: true } } } });
      if (person?.accounts.length) throw httpError(409, "Another user already uses this e-mail address", "CONFLICT");
      const personId = person?.id ?? randomUUID();
      id = randomUUID();
      if (person)
        await tx.person.update({
          where: { id: person.id },
          data: {
            givenName: body.givenName,
            familyName: body.familyName,
            ...(body.preferredName ? { preferredName: body.preferredName } : {}),
            ...(body.phone ? { phone: body.phone } : {}),
            rowVersion: { increment: 1 },
          },
        });
      else
        await tx.person.create({
          data: {
            id: personId,
            institutionId,
            givenName: body.givenName,
            familyName: body.familyName,
            preferredName: body.preferredName || null,
            phone: body.phone || null,
            email,
          },
        });
      await tx.account.create({
        data: {
          id,
          institutionId,
          personId,
          email,
          passwordHash: passwordHash!,
          status: body.disabled ? "disabled" : "active",
          rolesJson: JSON.stringify(roles),
        },
      });
    }
  });

  meta[id!] = {
    title: body.title,
    postNominals: body.postNominals,
    employeeNumber: body.employeeNumber,
    login: body.login,
    instructing: body.instructing,
    accessLevelId: level.id,
    customizeAccess: body.customizeAccess,
    ...(body.customizeAccess && body.permissions ? { permissions: body.permissions } : {}),
    customizeRegional: body.customizeRegional,
    ...(body.customizeRegional ? { campuses: body.campuses } : {}),
  };
  await kvSet(institutionId, "user-meta", meta);
  await assignNormalizedAccessLevel(institutionId, id!, level, user.accountId);
  if (level.profileType === "Student") {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: id! }, select: { personId: true } });
    await ensureStudentRecord(institutionId, account.personId);
  }
  if (body.department !== undefined) {
    const store = await loadFacultyStore(institutionId, id!);
    if (store.department !== body.department) {
      store.department = body.department;
      await kvSet(institutionId, `faculty-profile:${id}`, store);
    }
  }
  await audit(user, accountId ? "admin.user.update" : "admin.user.create", {
    accountId: id,
    email,
    accessLevel: level.name,
    roles,
    disabled: body.disabled,
  });
  return getUser(institutionId, id!);
}

/* ------------------------------------------------------------------ */
/* Student search                                                       */
/* ------------------------------------------------------------------ */

export const STUDENT_STATUSES = [
  "New Inquiry",
  "Approved Application",
  "Pre-enrolment Application",
  "Cancelled / Did not proceed",
  "CLOA",
  "Duplicate profiles",
  "Follow Up",
  "In-active Leads",
  "LOA",
  "Declined Application",
  "Registered Student",
  "Active Student",
  "Leave of Absence",
  "On-Hold",
  "Graduated",
  "Incomplete",
  "Withdrawn Students",
  "Dismissed",
] as const;

export const STUDENT_PROGRAMS = [
  { code: "CAPA", name: "Certificate in Accounting and Payroll Administrator" },
  { code: "DAP", name: "Diploma in Accounting and Payroll Administrator" },
  { code: "BTT", name: "Bank Teller Training" },
  { code: "COA", name: "Certificate Office Administration" },
  { code: "CSMS", name: "Corporate Sales Management Strategies Certificate" },
  { code: "DIB", name: "Diploma in International Business" },
  { code: "DMM", name: "Digital Marketing Management" },
  { code: "HRA", name: "Human Resources Administration" },
  { code: "MA", name: "Marketing Administration" },
  { code: "OA", name: "Office Administration" },
  { code: "RSMS", name: "Retail Sales Management Strategies Certificate" },
  { code: "NSA", name: "Network Support Administrator" },
  { code: "NST", name: "Network Support Technician" },
  { code: "ECEA (Option 2)", name: "Child Growth Development Part I & II + Interpersonal Communication" },
  { code: "ECEA option 1", name: "Child Growth Development Part 1 & 2" },
  { code: "ACSW", name: "Addictions Community Support Worker" },
  { code: "HCA", name: "Health Care Assistant" },
  { code: "HCA-3", name: "Interpersonal Communication (HCA-3)" },
  { code: "MOA", name: "Medical Office Assistant" },
  { code: "SSSW", name: "Social Services Support Worker" },
  { code: "DHM", name: "Diploma in Hospitality Management" },
  { code: "ESC", name: "English Skills for College" },
] as const;

export const DELIVERY_METHODS = ["In-Class", "Online", "Blended"] as const;
export const RESIDENCY = ["Domestic", "International"] as const;

type StudentMeta = {
  status?: string;
  residency?: string;
  street?: string;
  city?: string;
  postal?: string;
  discountCode?: string;
  campus?: string;
  delivery?: string;
  admissionTerm?: string;
  country?: string;
  rateCategory?: string;
  pathway?: string;
  schedule?: string;
  loaStartDate?: string;
  loaReturnDate?: string;
  loaReturnStatus?: string;
};

export async function studentMetaMap(institutionId: string) {
  return kvGet<Record<string, StudentMeta>>(institutionId, "student-meta", {});
}

/** Merges a patch into a student's meta. Empty strings and undefined leave a field as is; null clears it. */
export async function patchStudentMeta(institutionId: string, studentId: string, patch: { [K in keyof StudentMeta]?: StudentMeta[K] | null }) {
  return withBlobLock(`student-meta:${institutionId}`, async () => {
    const map = await studentMetaMap(institutionId);
    const next: Record<string, string | undefined> = { ...(map[studentId] ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else if (v !== undefined && v !== "") next[k] = v;
    }
    map[studentId] = next as StudentMeta;
    await kvSet(institutionId, "student-meta", map);
    const status = patch.status && patch.status.trim();
    if (status) {
      const key = catalogKey(status) || status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const definition = await prisma.studentStatusDefinition.upsert({
        where: { institutionId_key: { institutionId, key } },
        create: { institutionId, key, name: status },
        update: { name: status, active: true },
      });
      const current = await prisma.studentLifecycleStatus.findUnique({ where: { institutionId_studentId: { institutionId, studentId } } });
      if (current?.statusDefinitionId !== definition.id) {
        await prisma.$transaction([
          prisma.studentLifecycleStatus.upsert({
            where: { institutionId_studentId: { institutionId, studentId } },
            create: { institutionId, studentId, statusDefinitionId: definition.id },
            update: { statusDefinitionId: definition.id, assignedAt: new Date() },
          }),
          prisma.studentLifecycleStatusHistory.create({ data: { institutionId, studentId, statusDefinitionId: definition.id } }),
        ]);
      }
    }
    return map[studentId];
  });
}

export async function studentSearchOptions(institutionId: string) {
  const terms = await prisma.term.findMany({ where: { institutionId }, orderBy: { startsOn: "desc" }, select: { name: true, startsOn: true, endsOn: true } });
  return {
    statuses: STATUS_OPTIONS,
    campuses: CAMPUSES,
    programGroups: PROGRAM_GROUPS,
    deliveryMethods: DELIVERY_OPTIONS,
    residency: RESIDENCY_OPTIONS,
    admissionTerms: admissionTermOptions(terms),
  };
}

export const StudentSearchQuery = z.object({
  q: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sisEmail: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  preferredName: z.string().trim().optional(),
  dobMonth: z.string().trim().optional(),
  dobDay: z.string().trim().optional(),
  dobYear: z.string().trim().optional(),
  residency: z.string().trim().optional(),
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postal: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  discountCode: z.string().trim().optional(),
  campus: z.string().trim().optional(),
  delivery: z.string().trim().optional(),
  program: z.string().trim().optional(),
  admissionTerm: z.string().trim().optional(),
});

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().trim();
const has = (hay: string | null | undefined, needle: string | undefined) => !needle || norm(hay).includes(norm(needle));
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export async function searchStudents(user: SessionClaims, query: z.infer<typeof StudentSearchQuery>) {
  const institutionId = user.institutionId;
  const [students, metaMap, access] = await Promise.all([
    prisma.student.findMany({
      where: { institutionId },
      include: {
        person: true,
        enrolments: { where: { status: "enrolled" }, select: { id: true } },
      },
    }),
    kvGet<Record<string, StudentMeta>>(institutionId, "student-meta", {}),
    assertPermission(user, "studentRecords", "view"),
  ]);

  const programFilter = query.program
    ? STUDENT_PROGRAMS.find((p) => p.code === query.program) ?? { code: query.program, name: query.program }
    : null;

  const campusScoped = access.superAdmin || access.campuses.length === CAMPUSES.length
    ? students
    : students.filter((student) => access.campuses.includes(metaMap[student.id]?.campus ?? ""));
  const rows = campusScoped
    .map((s) => {
      const m = metaMap[s.id] ?? {};
      const status = m.status ?? (s.enrolments.length ? "Active Student" : "Registered Student");
      const [y, mo, d] = (s.person.dateOfBirth ?? "").split("-");
      return { s, m, status, dob: { year: y ?? "", month: mo ?? "", day: d ?? "" } };
    })
    .filter(({ s, m, status, dob }) => {
      const p = s.person;
      if (query.q) {
        const q = norm(query.q);
        if (!norm(s.studentNumber).includes(q) && !norm(p.familyName).startsWith(q)) return false;
      }
      if (query.status && catalogKey(query.status) !== catalogKey(status)) return false;
      if (!has(p.email, query.sisEmail)) return false;
      if (!has(p.familyName, query.lastName)) return false;
      if (!has(p.givenName, query.firstName)) return false;
      if (!has(p.middleName, query.middleName)) return false;
      if (!has(p.preferredName, query.preferredName)) return false;
      if (query.dobMonth && Number(dob.month) !== Number(query.dobMonth)) return false;
      if (query.dobDay && Number(dob.day) !== Number(query.dobDay)) return false;
      if (query.dobYear && dob.year !== query.dobYear) return false;
      if (query.residency && norm(m.residency) !== norm(query.residency)) return false;
      if (!has(m.street, query.street)) return false;
      if (!has(m.city, query.city)) return false;
      if (query.postal && !norm(m.postal).replace(/\s/g, "").includes(norm(query.postal).replace(/\s/g, ""))) return false;
      if (query.phone && !digits(p.phone).includes(digits(query.phone))) return false;
      if (query.email && !has(p.personalEmail, query.email) && !has(p.email, query.email)) return false;
      if (query.discountCode && norm(m.discountCode) !== norm(query.discountCode)) return false;
      if (query.campus && m.campus !== query.campus) return false;
      if (query.delivery && !deliveryMatches(m.delivery, query.delivery)) return false;
      if (programFilter) {
        const prog = norm(s.programName);
        if (!prog.includes(norm(programFilter.name)) && !prog.includes(norm(programFilter.code))) return false;
      }
      if (query.admissionTerm && !termMatches(m.admissionTerm, query.admissionTerm)) return false;
      return true;
    })
    .sort((a, b) => a.s.person.familyName.localeCompare(b.s.person.familyName));

  return {
    total: rows.length,
    items: rows.slice(0, 200).map(({ s, m, status }) => ({
      studentId: s.id,
      studentNumber: s.studentNumber,
      name: `${s.person.familyName}, ${s.person.givenName}`,
      preferredName: s.person.preferredName,
      sisEmail: s.person.email,
      program: s.programName,
      campus: m.campus ?? null,
      status,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Faculty profile                                                      */
/* ------------------------------------------------------------------ */

const AvailabilityRecord = z.object({
  id: z.string().optional(),
  title: z.string().trim().max(120).optional().default(""),
  type: z.string().trim().min(1).max(60),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().default(false),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  days: z.array(z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])).default([]),
  note: z.string().max(2000).optional().default(""),
});

const Contract = z.object({
  contract: z.string().max(200),
  compensation: z.string().max(200),
  requirements: z.string().max(500),
  earnings: z.string().max(200),
});

const RichText = z.string().max(20000);

const FacultyProfileStore = z.object({
  photo: z.string().nullable().default(null),
  department: z.string().default(""),
  phone: z.string().default(""),
  connectEmail: z.string().default(""),
  education: z
    .object({ background: RichText.default(""), experience: RichText.default(""), organizations: RichText.default("") })
    .default({}),
  academicChair: z.string().default(""),
  academicLead: z.string().default(""),
  officeHours: RichText.default(""),
  generalInfo: RichText.default(""),
  availability: z.array(AvailabilityRecord.extend({ id: z.string() })).default([]),
  contracts: z.object({ previous: z.array(Contract).default([]), current: z.array(Contract).default([]) }).default({}),
});

type FacultyProfileStore = z.infer<typeof FacultyProfileStore>;

export const FacultyProfilePatch = z.discriminatedUnion("section", [
  z.object({ section: z.literal("connect"), phone: z.string().trim().max(40), email: z.string().trim().email().or(z.literal("")) }),
  z.object({
    section: z.literal("education"),
    background: RichText,
    experience: RichText,
    organizations: RichText,
  }),
  z.object({ section: z.literal("officeHours"), content: RichText }),
  z.object({ section: z.literal("generalInfo"), content: RichText }),
  z.object({ section: z.literal("department"), department: z.string().trim().max(120) }),
  z.object({
    section: z.literal("photo"),
    photo: z
      .string()
      .max(1_500_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Photo must be a PNG, JPEG or WebP image")
      .nullable(),
  }),
  z.object({ section: z.literal("availability.upsert"), record: AvailabilityRecord }),
  z.object({ section: z.literal("availability.delete"), id: z.string().min(1) }),
]);

async function loadFacultyStore(institutionId: string, accountId: string): Promise<FacultyProfileStore> {
  const raw = await kvGet<unknown>(institutionId, `faculty-profile:${accountId}`, {});
  const parsed = FacultyProfileStore.safeParse(raw);
  return parsed.success ? parsed.data : FacultyProfileStore.parse({});
}

function weekdayShort(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function hhmm(date: Date) {
  return date.toISOString().slice(11, 16);
}

export async function getFacultyProfile(institutionId: string, accountId: string) {
  const account = await prisma.account.findFirst({ where: { id: accountId, institutionId }, include: { person: true } });
  if (!account) throw httpError(404, "User not found", "NOT_FOUND");
  const [store, meta] = await Promise.all([loadFacultyStore(institutionId, accountId), loadUserMeta(institutionId)]);
  const sections = await prisma.section.findMany({
    where: { institutionId, instructorPersonId: account.personId },
    include: {
      course: true,
      term: true,
      classSessions: { orderBy: { startsAt: "asc" }, take: 200 },
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const current = sections.filter((s) => s.term.endsOn >= today);
  const previous = sections.filter((s) => s.term.endsOn < today);
  const label = (s: (typeof sections)[number]) => `${s.course.code} – ${s.course.title} (${s.code})`;

  const deliveryLabel: Record<string, string> = { in_person: "In-Class", online: "Online", hybrid: "Blended" };
  const teachingSchedule = current.map((s) => {
    const sessions = s.classSessions;
    const patterns = new Set(
      sessions.map((cs) => `${weekdayShort(cs.startsAt)} ${hhmm(cs.startsAt)}${cs.endsAt ? `–${hhmm(cs.endsAt)}` : ""}`),
    );
    return {
      sectionId: s.id,
      course: label(s),
      deliveryMethod: sessions[0] ? deliveryLabel[sessions[0].deliveryMode] ?? sessions[0].deliveryMode : "—",
      location: sessions.find((cs) => cs.location)?.location ?? "—",
      schedule: `${s.term.startsOn} – ${s.term.endsOn}${patterns.size ? `\n${[...patterns].slice(0, 4).join(", ")}` : ""}`,
    };
  });

  const teachingSessions = current.flatMap((s) =>
    s.classSessions.map((cs) => ({
      id: cs.id,
      title: `${s.course.code} – ${s.course.title}`,
      section: s.code,
      start: cs.startsAt.toISOString(),
      end: cs.endsAt ? cs.endsAt.toISOString() : null,
      location: cs.location ?? null,
      deliveryMethod: deliveryLabel[cs.deliveryMode] ?? cs.deliveryMode,
    })),
  );

  const m = meta[accountId] ?? {};
  return {
    accountId,
    name: `${account.person.givenName} ${account.person.familyName}`,
    preferredName: account.person.preferredName,
    title: m.title ?? "",
    employeeNumber: m.employeeNumber ?? "",
    email: account.email,
    status: account.status === "disabled" ? "Disabled" : account.status === "paused" ? "Paused" : "Active",
    department: store.department,
    photo: store.photo,
    connect: { phone: store.phone || account.person.phone || "", email: store.connectEmail || account.email },
    education: store.education,
    topics: {
      currentCourses: current.map(label),
      previousCourses: previous.map(label),
      academicChair: store.academicChair,
      academicLead: store.academicLead,
      teachingSchedule,
      teachingSessions,
    },
    officeHours: store.officeHours,
    generalInfo: store.generalInfo,
    availability: store.availability,
    contracts: store.contracts,
  };
}

export async function patchFacultyProfile(user: SessionClaims, accountId: string, patch: z.infer<typeof FacultyProfilePatch>) {
  const account = await prisma.account.findFirst({ where: { id: accountId, institutionId: user.institutionId } });
  if (!account) throw httpError(404, "User not found", "NOT_FOUND");
  const store = await loadFacultyStore(user.institutionId, accountId);
  switch (patch.section) {
    case "connect":
      store.phone = patch.phone;
      store.connectEmail = patch.email;
      break;
    case "education":
      store.education = { background: patch.background, experience: patch.experience, organizations: patch.organizations };
      break;
    case "officeHours":
      store.officeHours = patch.content;
      break;
    case "generalInfo":
      store.generalInfo = patch.content;
      break;
    case "department":
      store.department = patch.department;
      break;
    case "photo":
      store.photo = patch.photo;
      break;
    case "availability.upsert": {
      const r = patch.record;
      if (r.endTime <= r.startTime) throw httpError(400, "End time must be after start time");
      if (r.recurring) {
        if (!r.endDate) throw httpError(400, "Recurring availability needs an end date");
        if (r.endDate < r.startDate) throw httpError(400, "End date must be on or after start date");
        if (!r.days.length) throw httpError(400, "Pick at least one day of the week");
      }
      const record = { ...r, id: r.id || randomUUID(), endDate: r.recurring ? r.endDate : "" };
      const idx = store.availability.findIndex((a) => a.id === record.id);
      if (idx >= 0) store.availability[idx] = record;
      else store.availability.push(record);
      break;
    }
    case "availability.delete":
      store.availability = store.availability.filter((a) => a.id !== patch.id);
      break;
  }
  await kvSet(user.institutionId, `faculty-profile:${accountId}`, store);
  await audit(user, "admin.faculty_profile.update", { accountId, section: patch.section });
  return getFacultyProfile(user.institutionId, accountId);
}

/* ------------------------------------------------------------------ */
/* My account                                                           */
/* ------------------------------------------------------------------ */

export const PasswordBody = z
  .object({ newPassword: z.string().min(8).max(200), confirmPassword: z.string() })
  .refine((b) => b.newPassword === b.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export async function changeOwnPassword(user: SessionClaims, body: z.infer<typeof PasswordBody>) {
  const policy = await prisma.securityPolicy.findUnique({ where: { institutionId: user.institutionId } });
  const min = policy?.passwordMinLength ?? 10;
  if (body.newPassword.length < min) throw httpError(400, `Password must be at least ${min} characters`);
  const rulesRow = await prisma.heritageRecord.findFirst({ where: { institutionId: user.institutionId, screenId: "SYS:SETTINGS", contextKey: "", singletonKey: "password" } });
  const rules = rulesRow ? (JSON.parse(rulesRow.dataJson) as Record<string, unknown>) : {};
  if (rules.enforce !== "Disabled") {
    const missing = [
      rules.upper === "Yes" && !/[A-Z]/.test(body.newPassword) ? "an uppercase letter" : "",
      rules.lower === "Yes" && !/[a-z]/.test(body.newPassword) ? "a lowercase letter" : "",
      rules.number === "Yes" && !/\d/.test(body.newPassword) ? "a number" : "",
      rules.symbol === "Yes" && !/[^A-Za-z0-9]/.test(body.newPassword) ? "a symbol" : "",
    ].filter(Boolean);
    if (missing.length) throw httpError(400, `Password must include ${missing.join(", ")}`);
    if (rules.nameMatching === "Not Allowed") {
      const account = await prisma.account.findUnique({ where: { id: user.accountId }, include: { person: true } });
      const lowered = body.newPassword.toLowerCase();
      const parts = [account?.person.givenName, account?.person.familyName, account?.email.split("@")[0]].map((x) => (x ?? "").toLowerCase()).filter((x) => x.length >= 3);
      if (parts.some((x) => lowered.includes(x))) throw httpError(400, "Password must not contain your name or login");
    }
  }
  const passwordHash = await hashPassword(body.newPassword);
  await prisma.$transaction([
    prisma.account.update({ where: { id: user.accountId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { accountId: user.accountId, id: { not: user.sessionId } } }),
  ]);
  await audit(user, "account.password.change", { accountId: user.accountId });
  return { ok: true as const };
}

type StoredQuestion = { question: string; answerHash: string };

export const SECURITY_QUESTION_OPTIONS = [
  "Which city did you go to highschool?",
  "What was the name of your first pet?",
  "What is your favourite sports team?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
  "What street did you grow up on?",
] as const;

/** The question bank is managed under System Configuration → Security Management → Security Questions. */
async function securityQuestionOptions(institutionId: string, stored: StoredQuestion[]) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId, screenId: { in: ["SYS:SEC_CATEGORY", "SYS:SEC_QUESTION"] }, deletedAt: null, singletonKey: null },
    orderBy: { createdAt: "asc" },
  });
  const data = (json: string) => JSON.parse(json) as Record<string, unknown>;
  const categories = rows.filter((r) => r.screenId === "SYS:SEC_CATEGORY").map((r) => ({ id: r.id, name: String(data(r.dataJson).name ?? "") }));
  categories.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const questions = rows.filter((r) => r.screenId === "SYS:SEC_QUESTION").map((r) => data(r.dataJson));
  const bank = categories.flatMap((c) => questions.filter((q) => q.category === c.id).map((q) => String(q.question ?? "")).sort());
  const base: string[] = bank.length ? bank : [...SECURITY_QUESTION_OPTIONS];
  return [...new Set([...base, ...stored.map((q) => q.question).filter(Boolean)])];
}

export async function getSecurityQuestions(user: SessionClaims) {
  const stored = await kvGet<StoredQuestion[]>(user.institutionId, `security-questions:${user.accountId}`, []);
  return {
    options: await securityQuestionOptions(user.institutionId, stored),
    questions: [0, 1, 2].map((i) => ({ question: stored[i]?.question ?? "", answered: Boolean(stored[i]?.answerHash) })),
  };
}

export const SecurityQuestionsBody = z.object({
  questions: z
    .array(z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().max(200) }))
    .length(3),
});

export async function saveSecurityQuestions(user: SessionClaims, body: z.infer<typeof SecurityQuestionsBody>) {
  const key = `security-questions:${user.accountId}`;
  const stored = await kvGet<StoredQuestion[]>(user.institutionId, key, []);
  const distinct = new Set(body.questions.map((q) => q.question.toLowerCase()));
  if (distinct.size !== 3) throw httpError(400, "Choose three different questions");
  const next: StoredQuestion[] = [];
  for (let i = 0; i < 3; i++) {
    const q = body.questions[i];
    const prev = stored[i];
    if (q.answer) {
      next.push({ question: q.question, answerHash: await hashPassword(q.answer.toLowerCase()) });
    } else if (prev?.answerHash && prev.question === q.question) {
      next.push(prev);
    } else {
      throw httpError(400, `Answer is required for security question ${i + 1}`);
    }
  }
  await kvSet(user.institutionId, key, next);
  await audit(user, "account.security_questions.update", { accountId: user.accountId });
  return getSecurityQuestions(user);
}

export async function getTimeZone(user: SessionClaims) {
  const account = await prisma.account.findUnique({ where: { id: user.accountId }, select: { timezone: true } });
  return { timezone: account?.timezone ?? "America/Vancouver" };
}

export const TimeZoneBody = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
});

export async function saveTimeZone(user: SessionClaims, body: z.infer<typeof TimeZoneBody>) {
  await prisma.account.update({ where: { id: user.accountId }, data: { timezone: body.timezone } });
  await audit(user, "account.timezone.update", { timezone: body.timezone });
  return { timezone: body.timezone };
}

export async function listAccomplishments(user: SessionClaims) {
  const student = await prisma.student.findFirst({ where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId } });
  const badges = student
    ? await prisma.studentBadge.findMany({ where: { studentId: student.id, status: "earned" }, orderBy: { earnedAt: "desc" } })
    : [];
  return {
    items: badges.map((b) => ({ id: b.id, title: b.title, description: b.description, earnedAt: b.earnedAt?.toISOString() ?? null })),
  };
}
