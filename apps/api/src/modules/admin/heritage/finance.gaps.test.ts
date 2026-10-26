import { describe, expect, it } from "vitest";
import { feeTotals } from "./finance.ledger.js";
import { planSchedule } from "./finance.records.js";
import type { Config, StudentInfo } from "./finance.core.js";
import type { Rec } from "./sysconfig.js";

const rec = (id: string, data: Record<string, unknown>): Rec => ({
  id,
  contextKey: "",
  data,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  updatedById: null,
});

function config() {
  const gst = rec("gst", { name: "GST", rate: 5, inclusive: "No", regionalize: "No" });
  const pst = rec("pst", { name: "PST", rate: 7, inclusive: "No", regionalize: "Yes", regions: ["British Columbia"] });
  const type = rec("tuition", { name: "Tuition", taxes: [gst.id, pst.id] });
  const cfg = {
    ledgerTypes: [type], taxRates: [gst, pst], byId: new Map([[gst.id, gst], [pst.id, pst], [type.id, type]]),
    lockouts: [], ledgerCategories: [], paymentMethods: [], rateCategories: [], planTemplates: [], disbursementTypes: [], promotionAllocations: [], promotions: [], fundingSources: [], collectionAgencies: [], agents: [],
  } as Config;
  return { cfg, type };
}

const student = (province: string) => ({ province, country: "Canada" }) as Pick<StudentInfo, "province" | "country">;

describe("finance gap regressions", () => {
  it("applies GST and only the matching regional PST", () => {
    const { cfg, type } = config();
    expect(feeTotals(cfg, type, 100, 1, student("British Columbia"))).toMatchObject({ total: 112, taxes: [{ name: "GST", amount: 5 }, { name: "PST", amount: 7 }] });
    expect(feeTotals(cfg, type, 100, 1, student("Alberta"))).toMatchObject({ total: 105, taxes: [{ name: "GST", amount: 5 }] });
  });

  it("keeps a configured down payment as the first instalment", () => {
    const result = planSchedule({ startDate: "2026-10-15", scheduleType: "Fixed Instalment Frequency", frequency: "1 month", instalmentAmount: 200, downPaymentCad: 100, applyInterest: false }, 500);
    expect(result.list).toEqual([
      { date: "2026-10-15", amount: 100 },
      { date: "2026-11-15", amount: 200 },
      { date: "2026-12-15", amount: 200 },
    ]);
  });
});
