/* Financial Management configuration rules (F12–F21) and the captured seed data, plugged into the System Configuration engine. */

import type { SessionClaims } from "@myheritage/contracts";
import { entityIsEmpty, entityRecords, registerEntityHooks, registerSeed, seedRecord, type Rec } from "./sysconfig.js";
import {
  SEED_AGENTS,
  SEED_DISBURSEMENT_TYPES,
  SEED_LEDGER_CATEGORIES,
  SEED_LEDGER_TYPES,
  SEED_PAYMENT_METHODS,
  SEED_TAX_RATES,
  SHARED_TRIGGERS,
} from "./finance.spec.js";
import { S, arr, httpError, rows, s, save } from "./finance.core.js";

const conflict = (message: string) => httpError(409, message, "CONFLICT");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

registerSeed("fin-1", async (user: SessionClaims) => {
  const inst = user.institutionId;
  if (await entityIsEmpty(inst, "paymentMethods")) for (const [name, creditCard] of SEED_PAYMENT_METHODS) await seedRecord(user, "paymentMethods", { name, creditCard });
  if (await entityIsEmpty(inst, "taxRates")) for (const [name, rate, code] of SEED_TAX_RATES) await seedRecord(user, "taxRates", { name, rate, code });
  if (await entityIsEmpty(inst, "ledgerCategories")) for (const name of SEED_LEDGER_CATEGORIES) await seedRecord(user, "ledgerCategories", { name });
  if (await entityIsEmpty(inst, "ledgerTypes")) {
    const [cats, taxes] = await Promise.all([entityRecords(inst, "ledgerCategories"), entityRecords(inst, "taxRates")]);
    const catId = (name: string) => cats.find((c) => c.data.name === name)?.id;
    const taxIds = taxes.map((t) => t.id);
    for (const [name, code, trigger, category, domestic, international, taxed] of SEED_LEDGER_TYPES) {
      const cat = catId(category);
      await seedRecord(user, "ledgerTypes", { name, code, trigger, categories: cat ? [cat] : [], overridable: "Yes", domestic, international, taxes: taxed ? taxIds : [] });
    }
  }
  if (await entityIsEmpty(inst, "rateCategories")) {
    await seedRecord(user, "rateCategories", { name: "Domestic", active: "Yes", defaultRate: "Yes", _order: 0 });
    await seedRecord(user, "rateCategories", { name: "International", active: "Yes", defaultRate: "No", _order: 1 });
  }
  if (await entityIsEmpty(inst, "disbursementTypes")) for (const [name, description, kind] of SEED_DISBURSEMENT_TYPES) await seedRecord(user, "disbursementTypes", { name, description, kind });
  if (await entityIsEmpty(inst, "agents")) for (const a of SEED_AGENTS) await seedRecord(user, "agents", a);
});

registerSeed("fin-promotion-allocations-1", async (user: SessionClaims) => {
  if (await entityIsEmpty(user.institutionId, "promotionAllocations")) {
    await seedRecord(user, "promotionAllocations", {
      name: "During enrolment only",
      status: "Active",
      description: "Allocate the promotion while the student is enrolled.",
    });
  }
});

/** Records (of any Financial Management store) whose data matches. */
async function usage(inst: string, screen: string, match: (d: Record<string, unknown>) => boolean) {
  return (await rows(inst, screen)).filter((r) => match(r.data)).length;
}

/** Only one record of a list may carry the "default" flag: saving a new default clears the others. */
function singleDefault(entity: "rateCategories" | "collectionAgencies", key: string, on: string, off: string) {
  return async (user: SessionClaims, id: string, _before: unknown, after: Record<string, unknown>) => {
    if (after[key] !== on) return;
    for (const r of await entityRecords(user.institutionId, entity)) if (r.id !== id && r.data[key] === on) await save(user, r.id, { ...r.data, [key]: off });
  };
}

/** The rate field doubles as a CAD amount for "Fixed"; a percentage above 100 would pay out more than the money it is taken from. */
async function commissionRateValid(_user: SessionClaims, d: Record<string, unknown>) {
  const rate = Number(d.commissionRate);
  if ((s(d.commissionType) || "Percentage") === "Percentage" && rate > 100) throw httpError(400, "Commission Rate cannot exceed 100%");
  if (s(d.commissionType) === "Fixed" && rate > 100_000) throw httpError(400, "A fixed commission cannot exceed $100,000");
}

const names = (ids: unknown, list: Rec[]) => arr<string>(ids).map((id) => s(list.find((r) => r.id === id)?.data.name)).filter(Boolean);

registerEntityHooks({
  lockouts: {
    validate: async (_user, d) => {
      if (s(d.startDate) && s(d.endDate) && s(d.endDate) < s(d.startDate)) throw httpError(400, "Lock-Out End Date must be on or after the Lock-Out Start Date");
    },
  },
  ledgerTypes: {
    validate: async (user, d, selfId) => {
      const trigger = s(d.trigger);
      if (!trigger || SHARED_TRIGGERS.includes(trigger)) return;
      const clash = (await entityRecords(user.institutionId, "ledgerTypes")).find((r) => r.id !== selfId && r.data.trigger === trigger);
      if (clash) throw conflict(`The fee trigger "${trigger}" is already used by "${s(clash.data.name)}". Each fee trigger can belong to one tuition / ledger type only.`);
    },
    beforeDelete: async (user, rec) => {
      const n = await usage(user.institutionId, S.META, (d) => d.ledgerTypeId === rec.id);
      if (n) throw conflict(`"${s(rec.data.name)}" is used by ${plural(n, "fee")} and cannot be deleted.`);
    },
    decorate: async (user, recs) => {
      const [cats, taxes] = await Promise.all([entityRecords(user.institutionId, "ledgerCategories"), entityRecords(user.institutionId, "taxRates")]);
      return recs.map((r) => ({ _categoryNames: names(r.data.categories, cats), _taxNames: names(r.data.taxes, taxes) }));
    },
  },
  ledgerCategories: {
    beforeDelete: async (user, rec) => {
      for (const t of await entityRecords(user.institutionId, "ledgerTypes")) {
        const cats = arr<string>(t.data.categories);
        if (cats.includes(rec.id)) await save(user, t.id, { ...t.data, categories: cats.filter((c) => c !== rec.id) });
      }
    },
  },
  taxRates: {
    beforeDelete: async (user, rec) => {
      const used = (await entityRecords(user.institutionId, "ledgerTypes")).filter((t) => arr<string>(t.data.taxes).includes(rec.id));
      if (used.length) throw conflict(`"${s(rec.data.name)}" is applied to ${plural(used.length, "tuition / ledger type")} (${used.map((t) => s(t.data.name)).join(", ")}). Remove it from those types first.`);
    },
  },
  paymentMethods: {
    beforeDelete: async (user, rec) => {
      const n = (await usage(user.institutionId, S.META, (d) => d.methodId === rec.id)) + (await usage(user.institutionId, S.FUND, (d) => d.methodId === rec.id));
      if (n) throw conflict(`"${s(rec.data.name)}" has been used for ${plural(n, "payment")} and cannot be deleted.`);
    },
  },
  rateCategories: { afterSave: singleDefault("rateCategories", "defaultRate", "Yes", "No") },
  collectionAgencies: {
    validate: commissionRateValid,
    afterSave: singleDefault("collectionAgencies", "defaultAgency", "Enabled", "Disabled"),
    beforeDelete: async (user, rec) => {
      const n = await usage(user.institutionId, S.COLLECTION, (d) => d.agencyId === rec.id && d.status === "Active");
      if (n) throw conflict(`"${s(rec.data.name)}" holds ${plural(n, "active collection account")}. Recall them before deleting the agency.`);
    },
  },
  disbursementTypes: {
    beforeDelete: async (user, rec) => {
      const n = await usage(user.institutionId, S.META, (d) => d.typeId === rec.id);
      if (n) throw conflict(`"${s(rec.data.name)}" is used by ${plural(n, "disbursement")} and cannot be deleted.`);
      const promos = (await entityRecords(user.institutionId, "promotions")).filter((p) => p.data.disbursementType === rec.id);
      if (promos.length) throw conflict(`"${s(rec.data.name)}" is the disbursement type of ${plural(promos.length, "promotion")} (${promos.map((p) => s(p.data.name)).join(", ")}).`);
    },
  },
  promotionAllocations: {
    validate: async (user, data, selfId) => {
      if (!selfId) return;
      const current = (await entityRecords(user.institutionId, "promotionAllocations")).find((r) => r.id === selfId);
      const oldName = s(current?.data.name);
      if (!oldName || oldName === s(data.name)) return;
      const n = await usage(user.institutionId, S.AWARD, (d) => d.allocation === oldName);
      if (n) throw conflict(`"${oldName}" is used by ${plural(n, "student award")} and cannot be renamed. Create a new option and set this one to Inactive instead.`);
    },
    beforeDelete: async (user, rec) => {
      const n = await usage(user.institutionId, S.AWARD, (d) => d.allocation === rec.data.name);
      if (n) throw conflict(`"${s(rec.data.name)}" is used by ${plural(n, "student award")} and cannot be deleted. Set it to Inactive instead.`);
    },
  },
  promotions: {
    beforeDelete: async (user, rec) => {
      const n = await usage(user.institutionId, S.AWARD, (d) => d.promotionId === rec.id);
      if (n) throw conflict(`"${s(rec.data.name)}" has been awarded to ${plural(n, "student")} and cannot be deleted. Set it to Inactive instead.`);
    },
    decorate: async (_user, recs) => recs.map((r) => ({ _requirements: promotionRequirements(r.data) })),
  },
  fundingSources: {
    beforeDelete: async (user, rec) => {
      const n = (await usage(user.institutionId, S.FUND, (d) => d.fundingSourceId === rec.id)) + (await usage(user.institutionId, S.INVOICE, (d) => d.fundingSourceId === rec.id));
      if (n) throw conflict(`"${s(rec.data.name)}" is linked to ${plural(n, "fund or invoice", "funds or invoices")} and cannot be deleted. Set it to Inactive instead.`);
    },
  },
  agents: {
    validate: commissionRateValid,
    beforeDelete: async (user, rec) => {
      const n = (await usage(user.institutionId, S.STUDENT_AGENT, (d) => d.agentId === rec.id)) + (await usage(user.institutionId, S.COMMISSION, (d) => d.agentId === rec.id));
      if (n) throw conflict(`Agent ${s(rec.data.agentNumber)} is assigned to students or has commissions on record and cannot be deleted.`);
    },
  },
});

/** One-line summary of a promotion's requirements for the Manage Promotions list. */
export function promotionRequirements(d: Record<string, unknown>) {
  const out: string[] = [];
  if (d.enrolment === "Custom") out.push(`Min. ${s(d.minCourses)} course(s) per term`);
  else if (d.enrolment && d.enrolment !== "None") out.push(s(d.enrolment));
  if (d.completion === "Terms Completed") out.push(`${s(d.termsCompleted)} term(s) completed`);
  if (d.completion === "Courses Completed") out.push(`${s(d.coursesCompleted)} course(s) completed`);
  if (d.academic === "Grade Point Average") out.push(`GPA ≥ ${s(d.requiredAverage)}`);
  if (d.academic === "Average Percentage") out.push(`Average ≥ ${s(d.requiredAverage)}%`);
  if (d.uses && d.uses !== "Unlimited") out.push(s(d.uses));
  if (d.specifyDates) out.push(`${s(d.startDate)} – ${s(d.endDate)}`);
  return out.length ? out.join(" · ") : "None";
}
