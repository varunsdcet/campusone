import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ studentBadge: { findFirst: vi.fn(), updateMany: vi.fn() } }));
const core = vi.hoisted(() => ({ canStudents: vi.fn(), assertStudentCampusAccess: vi.fn(), stuAudit: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("./students.core.js", () => ({
  ...core,
  s: (v: unknown) => (v == null ? "" : String(v)),
  text: (v: unknown, max: number) => (v == null ? "" : String(v).trim().slice(0, max)),
  httpError: (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, code }),
  add: vi.fn(),
  arr: vi.fn(),
  optDate: vi.fn(),
  rows: vi.fn(),
}));

import type { SessionClaims } from "@myheritage/contracts";
import { decideBadge } from "./students.queues.js";

const user = { accountId: "acc-1", institutionId: "inst-1", personId: "p-1", roles: ["admin"] } as unknown as SessionClaims;
const badge = { id: "b-1", institutionId: "inst-1", studentId: "s-1", title: "Dean's List", status: "pending", rowVersion: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  core.canStudents.mockResolvedValue(undefined);
  core.assertStudentCampusAccess.mockResolvedValue(undefined);
  db.studentBadge.findFirst.mockResolvedValue(badge);
  db.studentBadge.updateMany.mockResolvedValue({ count: 1 });
});

describe("decideBadge", () => {
  it("awards a pending badge with a row-version guard and audits it", async () => {
    await expect(decideBadge(user, "b-1", { decision: "approve" })).resolves.toEqual({ message: "Dean's List awarded", status: "Approved" });
    const call = db.studentBadge.updateMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: "b-1", rowVersion: 3, status: "pending" });
    expect(call.data.status).toBe("earned");
    expect(core.stuAudit).toHaveBeenCalledOnce();
  });

  it("declines without an earned date", async () => {
    await decideBadge(user, "b-1", { decision: "decline" });
    expect(db.studentBadge.updateMany.mock.calls[0]?.[0]?.data).toMatchObject({ status: "declined", earnedAt: null });
  });

  it("requires edit permission", async () => {
    core.canStudents.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    await expect(decideBadge(user, "b-1", { decision: "approve" })).rejects.toMatchObject({ status: 403 });
    expect(db.studentBadge.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown decisions, missing badges and already-reviewed badges", async () => {
    await expect(decideBadge(user, "b-1", { decision: "maybe" })).rejects.toMatchObject({ status: 400 });
    db.studentBadge.findFirst.mockResolvedValueOnce(null);
    await expect(decideBadge(user, "b-1", { decision: "approve" })).rejects.toMatchObject({ status: 404 });
    db.studentBadge.findFirst.mockResolvedValueOnce({ ...badge, status: "earned" });
    await expect(decideBadge(user, "b-1", { decision: "approve" })).rejects.toMatchObject({ status: 409 });
  });

  it("reports a concurrent review as a conflict", async () => {
    db.studentBadge.updateMany.mockResolvedValue({ count: 0 });
    await expect(decideBadge(user, "b-1", { decision: "approve" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(core.stuAudit).not.toHaveBeenCalled();
  });
});
