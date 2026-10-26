import type { SessionClaims } from "@myheritage/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(
  () =>
    ({
      sub: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
      personId: "00000000-0000-4000-8000-000000000003",
      institutionId: "00000000-0000-4000-8000-000000000004",
      roles: ["registrar"],
      sessionId: "00000000-0000-4000-8000-000000000005",
    }) satisfies SessionClaims,
);

const db = vi.hoisted(() => ({
  financeLedgerEntry: { groupBy: vi.fn(), create: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../superAdmin.service.js", () => ({
  CAMPUSES: [],
  STUDENT_STATUSES: [],
  assertPermission: vi.fn(),
  patchStudentMeta: vi.fn(),
  studentMetaMap: vi.fn(),
}));

import { WRITE_THROUGH } from "./domain.js";

const studentId = "10000000-0000-4000-8000-000000000001";

function ledgerSums(payment: number | null, refund: number | null) {
  return [
    ...(payment == null ? [] : [{ kind: "payment", _sum: { amountCad: payment } }]),
    ...(refund == null ? [] : [{ kind: "refund", _sum: { amountCad: refund } }]),
  ];
}

const refund = (amount: unknown) => WRITE_THROUGH.SF04!(user, { refund_amount: amount }, studentId);

beforeEach(() => {
  vi.clearAllMocks();
  db.financeLedgerEntry.groupBy.mockResolvedValue(ledgerSums(500, 120));
  db.financeLedgerEntry.create.mockResolvedValue({ id: "20000000-0000-4000-8000-000000000001" });
});

describe("Heritage SF04 refund", () => {
  it("rejects a refund larger than payments minus earlier refunds", async () => {
    await expect(refund(380.01)).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    await expect(refund(380.01)).rejects.toThrow("$380.00");
    expect(db.financeLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("rejects any refund when nothing has been paid", async () => {
    db.financeLedgerEntry.groupBy.mockResolvedValue(ledgerSums(null, null));

    await expect(refund(10)).rejects.toMatchObject({ status: 400 });
    expect(db.financeLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("only sums live payments and refunds for this student", async () => {
    await refund(50);

    expect(db.financeLedgerEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          institutionId: user.institutionId,
          studentId,
          kind: { in: ["payment", "refund"] },
          status: { not: "waived" },
        },
      }),
    );
  });

  it("allows a refund of exactly the refundable amount", async () => {
    await expect(refund("380")).resolves.toMatchObject({ domainId: "ledger:20000000-0000-4000-8000-000000000001" });
    expect(db.financeLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId, kind: "refund", amountCad: 380, institutionId: user.institutionId }),
    });
  });

  it.each([0, -25, "abc"])("rejects a non-positive refund amount %j", async (amount) => {
    await expect(refund(amount)).rejects.toMatchObject({ status: 400 });
    expect(db.financeLedgerEntry.groupBy).not.toHaveBeenCalled();
  });

  it("serialises concurrent refunds so both cannot pass the cap", async () => {
    let refunded = 0;
    db.financeLedgerEntry.groupBy.mockImplementation(async () => ledgerSums(100, refunded));
    db.financeLedgerEntry.create.mockImplementation(async ({ data }: { data: { amountCad: number } }) => {
      refunded += data.amountCad;
      return { id: "20000000-0000-4000-8000-000000000002" };
    });

    const results = await Promise.allSettled([refund(80), refund(80)]);

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(db.financeLedgerEntry.create).toHaveBeenCalledTimes(1);
    expect(refunded).toBe(80);
  });
});
