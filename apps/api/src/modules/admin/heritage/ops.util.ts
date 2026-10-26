import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import type { Data, EntityKey, OpsRef } from "./ops.spec.js";

export type Row = Data & { id: string; updatedAt: string };
export type Opt = { id: string; label: string };

export type Adapter = {
  list(inst: string, user?: SessionClaims): Promise<Row[]>;
  /** Returns the new id, or the id plus a custom confirmation when one request creates several rows. */
  create?(inst: string, d: Data, user: SessionClaims): Promise<string | { id: string; message: string }>;
  update(inst: string, id: string, d: Data, user: SessionClaims): Promise<void>;
  remove?(inst: string, id: string): Promise<void>;
};

export type Change = { id: string; data: Data; before: Row | null };

/** Shared request context handed to rules, hooks, custom actions and dashboards. */
export type Ctx = {
  user: SessionClaims;
  inst: string;
  labels(ref: OpsRef): Promise<Map<string, string>>;
  rows(entity: EntityKey): Promise<Row[]>;
};

export function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
export const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
export const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const parse = (json: string | null | undefined): Data => {
  try {
    const v = JSON.parse(json ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
  } catch {
    return {};
  }
};
export const strList = (json: string | null | undefined) => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.map(s).filter(Boolean) : [];
  } catch {
    return [];
  }
};
/** Date/time values are wall-clock strings; they are stored as UTC so they round-trip unchanged. */
export const dayOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const stampOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16) : "");
export const toDay = (v: unknown) => (s(v) ? new Date(`${s(v)}T00:00:00Z`) : null);
export const toStamp = (v: unknown) => (s(v) ? new Date(`${s(v)}:00Z`) : null);
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (days: number, from = today()) => new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const personName = (p: { givenName: string; familyName: string } | null | undefined) => (p ? `${p.givenName} ${p.familyName}`.trim() : "");
export const bump = { rowVersion: { increment: 1 } };
export const take = <T>(xs: T[], k = 6) => xs.slice(0, k);
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export async function records(inst: string, screen: string): Promise<Row[]> {
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ ...parse(r.dataJson), id: r.id, updatedAt: r.updatedAt.toISOString(), _createdAt: r.createdAt.toISOString() }));
}

export function age(from: Date | string) {
  const ms = Date.now() - new Date(from).getTime();
  const h = ms / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(ms / 60_000))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`;
}
