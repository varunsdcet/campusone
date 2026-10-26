import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  financeLedgerEntry: { findFirst: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn(), create: vi.fn() },
  heritageRecord: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const createAdjustment = vi.hoisted(() => vi.fn());
const studentCtx = vi.hoisted(() => vi.fn());

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));
vi.mock("./heritage/enrolment.js", () => ({ assertSeat: vi.fn() }));
vi.mock("./heritage/finance.core.js", () => ({ S: { ADJUSTMENT: "FIN:ADJUSTMENT" } }));
vi.mock("./heritage/finance.records.js", () => ({ createAdjustment }));
vi.mock("./heritage/finance.ledger.js", () => ({ studentCtx }));

import type { SessionClaims } from "@myheritage/contracts";
import { adjustLedgerEntry } from "./registrar-gaps.service.js";

const user = { accountId: "acc-1", institutionId: "inst-1", roles: ["admin"] } as unknown as SessionClaims;
const entryId = "11111111-1111-4111-8111-111111111111";
const charge = { id: entryId, institutionId: "inst-1", studentId: "stu-1", label: "Legacy charge", amountCad: 1234.56, kind: "charge", status: "open", source: "manual_post", reversedFromId: null, note: null, financialTermId: null };
const adjustment = (status: string, number: number) => ({ dataJson: JSON.stringify({ status, number, ledgerEntryId: entryId }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.heritageRecord.findMany.mockResolvedValue([]);
  studentCtx.mockResolvedValue({ book: { charges: [{ id: entryId, owing: 1234.56 }] } });
  createAdjustment.mockResolvedValue({ id: "adj-1", number: 1004, message: "Financial adjustment submitted for approval" });
});

describe("adjustLedgerEntry write-offs", () => {
  it("turns a waive into a pending Financial Adjustment and leaves the charge open", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue(charge);
    const res = await adjustLedgerEntry(user, { entryId, action: "waive" });
    expect(res).toMatchObject({ pendingApproval: true, adjustmentId: "adj-1" });
    expect(createAdjustment).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ studentId: "stu-1", direction: "Decrease balance (credit)", amount: 1234.56, ledgerEntryId: entryId, ledgerAction: "waive" }),
    );
    expect(db.financeLedgerEntry.updateMany).not.toHaveBeenCalled();
  });

  it("writes off only what is still owed on a part-paid charge", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue(charge);
    studentCtx.mockResolvedValue({ book: { charges: [{ id: entryId, owing: 200 }] } });
    await adjustLedgerEntry(user, { entryId, action: "waive" });
    expect(createAdjustment).toHaveBeenCalledWith(user, expect.objectContaining({ amount: 200 }));
  });

  it("routes reversing a charge through the same approval", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue({ ...charge, status: "paid" });
    await expect(adjustLedgerEntry(user, { entryId, action: "reverse" })).resolves.toMatchObject({ pendingApproval: true });
    expect(db.financeLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("refuses to mark a charge paid without a payment", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue(charge);
    await expect(adjustLedgerEntry(user, { entryId, action: "mark_paid" })).rejects.toMatchObject({ status: 409 });
    expect(db.financeLedgerEntry.updateMany).not.toHaveBeenCalled();
    expect(createAdjustment).not.toHaveBeenCalled();
  });

  it("does not open a second request while one is pending", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue(charge);
    db.heritageRecord.findMany.mockResolvedValue([adjustment("Pending", 1003)]);
    await expect(adjustLedgerEntry(user, { entryId, action: "waive" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("#1003") });
    expect(createAdjustment).not.toHaveBeenCalled();
  });

  it("refuses a second write-off once one was approved", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue({ ...charge, status: "paid" });
    db.heritageRecord.findMany.mockResolvedValue([adjustment("Declined", 1001), adjustment("Approved / Complete", 1002)]);
    await expect(adjustLedgerEntry(user, { entryId, action: "reverse" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("#1002") });
    expect(createAdjustment).not.toHaveBeenCalled();
  });

  it("creates one adjustment when the same waive is sent five times at once", async () => {
    db.financeLedgerEntry.findFirst.mockResolvedValue(charge);
    const store: Array<{ dataJson: string }> = [];
    db.heritageRecord.findMany.mockImplementation(async () => [...store]);
    createAdjustment.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      store.push(adjustment("Pending", 1004 + store.length));
      return { id: `adj-${store.length}`, number: 1003 + store.length };
    });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => adjustLedgerEntry(user, { entryId, action: "waive" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(createAdjustment).toHaveBeenCalledTimes(1);
  });
});
