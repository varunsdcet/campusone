/* Financial Management configurations (F12–F21) and the agent registry, served by the System Configuration engine. */

import type { Data, EntityDef, Field, Kind } from "./sysconfig.spec.js";

export type FinEntityKey =
  | "lockouts"
  | "ledgerTypes"
  | "ledgerCategories"
  | "paymentMethods"
  | "rateCategories"
  | "planTemplates"
  | "taxRates"
  | "disbursementTypes"
  | "promotionAllocations"
  | "promotions"
  | "fundingSources"
  | "collectionAgencies"
  | "agents";

const ACTIVE = ["Active", "Inactive"] as const;
const YES_NO = ["Yes", "No"] as const;
const NO_YES = ["No", "Yes"] as const;
const DIS_EN = ["Disabled", "Enabled"] as const;

export const FEE_TRIGGERS = [
  "None",
  "Application",
  "Registration / Deposit",
  "Course Tuition",
  "Drop Course",
  "Re-Take Course",
  "Extend Course",
  "Program Tuition",
  "Other Tuition",
  "Entry / Progress Test",
  "Workshop",
  "Request Form",
  "Textbooks",
  "Payment Plan",
  "Processing Fee",
  "Late Fee",
  "Benefit Plan",
] as const;
/** Triggers that may be shared by several ledger types; every other trigger belongs to one type only. */
export const SHARED_TRIGGERS = ["None", "Benefit Plan"];

export const DISBURSEMENT_KINDS = ["Fund only", "Scholarship / Bursary", "Student Loan", "Promotion / Award"] as const;
export const PROMOTION_TYPES = ["Promotion / Discount", "Scholarship / Bursary", "Grant / Award", "Waiver Code"] as const;
export const ACADEMIC_STANDING = ["Good Standing", "Academic Warning", "Academic Probation", "Academic Suspension"] as const;
export const PLAN_FREQUENCIES = [
  ...[1, 2, 3, 4, 5, 6].map((n) => `${n} day${n > 1 ? "s" : ""}`),
  ...[1, 2, 3, 4].map((n) => `${n} week${n > 1 ? "s" : ""}`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `${n} month${n > 1 ? "s" : ""}`),
];
export const DOWN_PAYMENTS = ["No Down Payment", "5%", "10%", "15%", "20%", "25%", "50%", "First Instalment Amount"] as const;

const f = (key: string, label: string, kind: Kind, extra: Partial<Field> = {}): Field => ({ key, label, kind, ...extra });
const sel = (key: string, label: string, options: readonly string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "select", options, dflt: options[0], required: true, ...extra });
const money = (key: string, label: string, extra: Partial<Field> = {}): Field => f(key, label, "number", { min: 0, max: 10_000_000, suffix: "CAD", ...extra });

/** "All …" / "Selected …" dropdown plus the multi-select list it unlocks. */
function condition(key: string, noun: string, list: { dyn?: string; options?: readonly string[] }, section: string): Field[] {
  const all = `All ${noun}`;
  const some = `Selected ${noun}`;
  return [
    sel(`${key}Mode`, noun, [all, some], { section }),
    f(key, `Selected ${noun}`, "multiList", { ...list, required: true, section, when: { key: `${key}Mode`, equals: some }, hint: "Hold Ctrl (Cmd on Mac) and click to select several." }),
  ];
}

const address = (section: string): Field[] => [
  f("country", "Country", "select", { dyn: "countries", section }),
  f("province", "Province / State", "select", { dependsOn: "country", section, hint: "Options follow the selected country." }),
  f("city", "City", "text", { section }),
];

export const FIN_ENTITIES: Record<FinEntityKey, EntityDef> = {
  lockouts: {
    screen: "FIN:LOCKOUT",
    audit: "F12",
    label: "Lock-out period",
    perm: "financialManagement",
    search: ["startDate", "endDate", "lockStatus", "note"],
    unique: [],
    fields: [
      f("campuses", "Campuses", "multi", { dyn: "campuses", required: true, section: "Lock-Out Period" }),
      f("startDate", "Lock-Out Start Date", "date", { required: true, section: "Lock-Out Period" }),
      f("endDate", "Lock-Out End Date", "date", { required: true, section: "Lock-Out Period" }),
      sel("lockStatus", "Period Lock Status", ["Unlocked", "Locked"], { dflt: "Locked", section: "Lock-Out Period" }),
      sel("overrideAccess", "Override Access", ["No Override Access", "Customize Access"], { section: "Lock-Out Period" }),
      f("note", "Note", "textarea", { section: "Lock-Out Period" }),
      f("accessUsers", "Access by Individual", "people", { section: "Customize Access", placeholder: "Start typing a user name", when: { key: "overrideAccess", equals: "Customize Access" } }),
      f("accessLevels", "Access by Level", "multiList", {
        dyn: "accessLevels",
        section: "Customize Access",
        hint: "Ctrl + Click to select multiple access levels.",
        when: { key: "overrideAccess", equals: "Customize Access" },
      }),
    ],
  },
  ledgerCategories: {
    screen: "FIN:LEDGER_CATEGORY",
    audit: "F13",
    label: "Ledger category",
    perm: "financialManagement",
    search: ["name"],
    unique: [{ key: "name", label: "Category Name", scope: "all" }],
    fields: [f("name", "Category Name", "text", { required: true, lang: true })],
  },
  ledgerTypes: {
    screen: "FIN:LEDGER_TYPE",
    audit: "F13",
    label: "Tuition / ledger type",
    perm: "financialManagement",
    search: ["name", "code", "trigger"],
    unique: [
      { key: "name", label: "Name", scope: "all" },
      { key: "code", label: "Code", scope: "all" },
    ],
    fields: [
      f("name", "Tuition / Ledger Type Name", "text", { required: true, lang: true, section: "Tuition / Ledger Type" }),
      f("categories", "Categories", "refMulti", { ref: "ledgerCategories", display: "list", section: "Tuition / Ledger Type", hint: "Ctrl + Click to select multiple categories." }),
      f("code", "Tuition / Ledger Code", "text", { section: "Tuition / Ledger Type", placeholder: "e.g. TUIT" }),
      sel("trigger", "Fee Trigger", FEE_TRIGGERS, { section: "Tuition / Ledger Type", hint: "Each trigger can be used by one type only (Benefit Plan may be shared)." }),
      sel("overridable", "Overridable / Customizable", YES_NO, { section: "Tuition / Ledger Type" }),
      money("domestic", "Domestic", { group: "Default Fee Values", sub: "Domestic", section: "Default Fee Values" }),
      money("international", "International", { group: "Default Fee Values", sub: "International", section: "Default Fee Values" }),
      f("taxes", "Tax Rates", "refMulti", { ref: "taxRates", display: "checks", section: "Applicable Taxes" }),
    ],
  },
  paymentMethods: {
    screen: "FIN:PAYMENT_METHOD",
    audit: "F14",
    label: "Payment method",
    perm: "financialManagement",
    search: ["name"],
    unique: [{ key: "name", label: "Payment Method Name", scope: "all" }],
    fields: [
      f("name", "Payment Method Name", "text", { required: true, lang: true }),
      f("creditCard", "Payment method can be used as an available credit card selection for online payments", "bool"),
      f("excludeProcessing", "Exclude payment method from processing fees", "bool"),
    ],
  },
  rateCategories: {
    screen: "FIN:RATE_CATEGORY",
    audit: "F15",
    label: "Rate category",
    perm: "financialManagement",
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Rate Category Name", "text", { required: true, lang: true }),
      sel("active", "Active", YES_NO),
      f("effectiveDating", "Enable effective dating", "bool"),
      f("effectiveFrom", "Effective From", "date", { required: true, when: { key: "effectiveDating", equals: true } }),
      f("effectiveTo", "Effective To", "date", { when: { key: "effectiveDating", equals: true } }),
      sel("defaultRate", "Default Rate", NO_YES, { hint: "The default rate is used when a student has no rate category." }),
      sel("regionalize", "Regionalize", NO_YES, { hint: "Regionalized rates only apply to students living in the selected provinces / states." }),
      f("regions", "Provinces / States", "multiList", { dyn: "provinces", required: true, when: { key: "regionalize", equals: "Yes" }, hint: "Ctrl + Click to select several." }),
    ],
  },
  planTemplates: {
    screen: "FIN:PLAN_TEMPLATE",
    audit: "F16",
    label: "Payment plan template",
    perm: "financialManagement",
    search: ["name", "code", "status"],
    unique: [
      { key: "name", label: "Name", scope: "all" },
      { key: "code", label: "Code", scope: "all" },
    ],
    fields: [
      f("name", "Template Name", "text", { required: true, section: "Template Details" }),
      f("description", "Template Description", "textarea", { section: "Template Details" }),
      f("code", "Template Code", "text", { section: "Template Details" }),
      sel("status", "Template Status", ACTIVE, { section: "Template Details" }),
      sel("scheduleType", "Schedule Type", ["Fixed Instalment Frequency", "Manual / Advanced Instalments"], { section: "Payment Plan Schedule" }),
      sel("frequency", "Instalment Frequency", PLAN_FREQUENCIES, { dflt: "1 month", section: "Payment Plan Schedule", when: { key: "scheduleType", equals: "Fixed Instalment Frequency" } }),
      f("totalInstalments", "Total Instalments", "number", { integer: true, min: 1, max: 60, required: true, dflt: 4, section: "Payment Plan Schedule" }),
      sel("startDate", "Default Start Date", ["Immediately", "Term Start Date", "Student Start Date", "Posting Date"], { section: "Payment Plan Schedule" }),
      f("firstOnStart", "First instalment due on start date", "bool", { section: "Payment Plan Schedule" }),
      sel("balanceSync", "Balance Synchronization", ["Fixed Amount", "With term balance", "With total balance"], { section: "Balances & Collection" }),
      money("fixedAmount", "Debt Amount", { required: true, section: "Balances & Collection", when: { key: "balanceSync", equals: "Fixed Amount" } }),
      sel("downPayment", "Down Payment", DOWN_PAYMENTS, { section: "Balances & Collection" }),
      f("planFee", "Payment Plan Fee", "select", { dyn: "planFees", dynExtra: ["No Fee"], dflt: "No Fee", required: true, section: "Balances & Collection", hint: "Ledger types with the Payment Plan fee trigger, charged when a plan is created from this template." }),
      f("owingOnly", "Synchronize payment plan creation with owing balance only", "bool", { section: "Balances & Collection" }),
      f("offsetCredit", "Offset payment plan balance by pre-payment / credit balance", "bool", { section: "Balances & Collection" }),
      f("prompts", "Enable automated prompts for overdue instalments", "bool", { section: "Balances & Collection" }),
      sel("skipPrompt", "Skip Prompt?", NO_YES, { section: "Balances & Collection", when: { key: "prompts", equals: true }, hint: "Yes skips the overdue prompt for the first missed instalment." }),
      f("autoPayments", "Enable automated payments", "bool", { section: "Balances & Collection", hint: "Payment plug-in required (System Configuration › Manage Plug-ins)." }),
      ...condition("studentStatuses", "Student Status", { dyn: "statuses" }, "Conditions / Filters"),
      ...condition("programs", "Program(s)", { dyn: "programs" }, "Conditions / Filters"),
      ...condition("rateCategories", "Rate Category", { dyn: "rateCategories" }, "Conditions / Filters"),
      ...condition("countries", "Countries", { dyn: "countries" }, "Conditions / Filters"),
    ],
  },
  taxRates: {
    screen: "FIN:TAX_RATE",
    audit: "F17",
    label: "Tax rate",
    perm: "financialManagement",
    search: ["name", "rate", "code"],
    unique: [{ key: "name", label: "Tax Name", scope: "all" }],
    fields: [
      f("name", "Tax Name", "text", { required: true, lang: true }),
      f("rate", "Tax Rate", "number", { required: true, min: 0, max: 100, suffix: "%" }),
      f("code", "Ledger / Tax Code", "text"),
      sel("inclusive", "Inclusive", NO_YES, { hint: "Inclusive taxes are already part of the fee amount." }),
      sel("regionalize", "Regionalize", NO_YES, { hint: "Only charge this tax to students living in the selected provinces / states." }),
      f("regions", "Provinces / States", "multiList", { dyn: "provinces", required: true, when: { key: "regionalize", equals: "Yes" }, hint: "Ctrl + Click to select several." }),
    ],
  },
  disbursementTypes: {
    screen: "FIN:DISB_TYPE",
    audit: "F18",
    label: "Disbursement type",
    perm: "financialManagement",
    search: ["name", "description"],
    unique: [{ key: "name", label: "Type Name", scope: "all" }],
    fields: [
      f("name", "Type Name", "text", { required: true, lang: true }),
      f("description", "Type Description", "textarea"),
      { key: "kind", label: "Disbursement Type", kind: "radio", options: DISBURSEMENT_KINDS, dflt: DISBURSEMENT_KINDS[0], required: true },
    ],
  },
  promotionAllocations: {
    screen: "FIN:PROMOTION_ALLOCATION",
    audit: "F22",
    label: "Promotion allocation",
    perm: "financialManagement",
    search: ["name", "status", "description"],
    unique: [{ key: "name", label: "Allocation Name", scope: "all" }],
    fields: [
      f("name", "Allocation Name", "text", { required: true, lang: true }),
      sel("status", "Status", ACTIVE),
      f("description", "Description", "textarea", { hint: "Explain when this allocation option should be selected." }),
    ],
  },
  promotions: {
    screen: "FIN:PROMOTION",
    audit: "F19",
    label: "Promotion",
    perm: "financialManagement",
    search: ["name", "type", "status", "description"],
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Promotion Name", "text", { required: true, section: "Promotion Template Details" }),
      f("description", "Promotion Description", "textarea", { section: "Promotion Template Details" }),
      sel("status", "Promotion Status", ACTIVE, { section: "Promotion Template Details" }),
      sel("type", "Promotion Type", PROMOTION_TYPES, { section: "Promotion Template Details" }),
      f("waiverCode", "Waiver Code", "text", { required: true, section: "Promotion Template Details", when: { key: "type", equals: "Waiver Code" } }),
      sel("value", "Promotion Value", ["Fixed Amount", "Percentage", "Pro-Rated"], { section: "Promotion Template Details" }),
      money("amount", "Total Amount", { required: true, section: "Promotion Template Details", when: { key: "value", equals: "Percentage", not: true } }),
      f("percentage", "Percentage", "number", { required: true, min: 0.01, max: 100, suffix: "%", section: "Promotion Template Details", when: { key: "value", equals: "Percentage" } }),
      f("customizeMax", "Customize maximum amount per use", "bool", { section: "Promotion Template Details" }),
      money("maxPerUse", "Maximum Amount per Use", { required: true, section: "Promotion Template Details", when: { key: "customizeMax", equals: true } }),
      sel("eligibility", "Promotion Eligibility", ["Manual", "Automated"], { section: "Promotion Template Details", hint: "Automated promotions are offered to every student who meets the requirements and conditions." }),
      sel("applyTo", "Apply Promotion To", ["All Fees", "Tuition Only", "Select Fees"], { section: "Promotion Template Details" }),
      f("applyFees", "Selected Fees", "refMulti", { ref: "ledgerTypes", display: "list", required: true, section: "Promotion Template Details", when: { key: "applyTo", equals: "Select Fees" } }),
      sel("enrolment", "Full / Part-time Condition", ["None", "Part-time", "Full Time", "Custom"], { section: "Promotion Requirements" }),
      f("minCourses", "Minimum Courses per Term", "number", { integer: true, min: 1, max: 20, required: true, section: "Promotion Requirements", when: { key: "enrolment", equals: "Custom" } }),
      sel("completion", "Completion Condition", ["None", "Terms Completed", "Courses Completed"], { section: "Promotion Requirements" }),
      sel("termsCompleted", "Terms Completed", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], { section: "Promotion Requirements", when: { key: "completion", equals: "Terms Completed" } }),
      f("coursesCompleted", "Courses Completed", "number", { integer: true, min: 1, max: 100, required: true, section: "Promotion Requirements", when: { key: "completion", equals: "Courses Completed" } }),
      f("includeInProgress", "Include terms in progress", "bool", { section: "Promotion Requirements", when: { key: "completion", equals: "None", not: true } }),
      sel("academic", "Academic Condition", ["None", "Grade Point Average", "Average Percentage"], { section: "Promotion Requirements" }),
      f("requiredAverage", "Required Average", "number", { required: true, min: 0, max: 100, section: "Promotion Requirements", when: { key: "academic", equals: "None", not: true }, hint: "GPA on the 4.33 scale, or a percentage." }),
      sel("uses", "Distribution / Uses", ["Once per Student", "Once per Term", "Once per Program", "Unlimited"], { section: "Promotion Requirements" }),
      f("maxUses", "Maximum Total Uses", "number", { integer: true, min: 1, max: 100_000, section: "Promotion Requirements", hint: "Leave blank for no limit across all students." }),
      f("includePrereq", "Include qualifying / prerequisite programs", "bool", { section: "Promotion Requirements" }),
      f("specifyDates", "Specify dates for this promotion", "bool", { section: "Promotion Conditions" }),
      f("startDate", "Start Date", "date", { required: true, section: "Promotion Conditions", when: { key: "specifyDates", equals: true } }),
      f("endDate", "End Date", "date", { required: true, section: "Promotion Conditions", when: { key: "specifyDates", equals: true } }),
      ...condition("campuses", "Campuses", { dyn: "campuses" }, "Promotion Conditions"),
      ...condition("programs", "Program of Study", { dyn: "programs" }, "Promotion Conditions"),
      ...condition("schedules", "Master Schedules", { dyn: "schedules" }, "Promotion Conditions"),
      ...condition("studentStatuses", "Student Statuses", { dyn: "statuses" }, "Promotion Conditions"),
      ...condition("standing", "Academic Standing", { options: ACADEMIC_STANDING }, "Promotion Conditions"),
      ...condition("rateCategories", "Rate Categories", { dyn: "rateCategories" }, "Promotion Conditions"),
      ...condition("nationality", "Nationality", { dyn: "countries" }, "Promotion Conditions"),
      ...condition("agents", "Assigned Agent", { dyn: "agents" }, "Promotion Conditions"),
      ...condition("terms", "Enrolment Term", { dyn: "terms" }, "Promotion Conditions"),
      ...condition("courses", "Enrolled Courses", { dyn: "courses" }, "Promotion Conditions"),
      { key: "distribution", label: "Distribution Method", kind: "radio", options: ["Apply as Disbursement Payment", "Reduce Fees / Receivables"], dflt: "Apply as Disbursement Payment", required: true, section: "Distribution Method" },
      f("disbursementType", "Disbursement Type", "ref", { ref: "disbursementTypes", required: true, section: "Distribution Method", when: { key: "distribution", equals: "Apply as Disbursement Payment" } }),
      sel("disbursementCommission", "Disbursement Commissions", ["Exclude from agent commissions", "Include in agent commissions"], {
        section: "Distribution Method",
        when: { key: "distribution", equals: "Apply as Disbursement Payment" },
      }),
      sel("proRateBasis", "Pro-Rated Calculation", ["Total courses in program", "Total courses in term", "Total credits in program"], { section: "Pro-Rated Calculation", hint: "Used when Promotion Value is Pro-Rated." }),
      f("offsetCompletion", "Offset program/term course count by completion conditions", "bool", { section: "Pro-Rated Calculation" }),
      f("excludeInternal", "Exclude internal transfer program courses", "bool", { section: "Pro-Rated Calculation" }),
      f("excludeExternal", "Exclude external transfer and prior experience courses", "bool", { section: "Pro-Rated Calculation" }),
      f("excludeRepeated", "Exclude repeated courses", "bool", { section: "Pro-Rated Calculation" }),
      f("allocateRemaining", "Always allocate remaining promotion balance", "bool", { section: "Pro-Rated Calculation" }),
    ],
  },
  fundingSources: {
    screen: "FIN:FUNDING_SOURCE",
    audit: "F20",
    label: "Funding source",
    perm: "financialManagement",
    search: ["name", "status", "contactFirst", "contactLast", "email"],
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Funding Source Name", "text", { required: true, section: "Template Details" }),
      sel("status", "Funding Source Status", ACTIVE, { section: "Template Details" }),
      f("notes", "Funding Source Notes", "textarea", { section: "Template Details" }),
      f("contactFirst", "First Name", "text", { section: "Contact Information" }),
      f("contactLast", "Last Name", "text", { section: "Contact Information" }),
      f("email", "Email Address", "email", { section: "Contact Information" }),
      f("phone", "Phone Number", "text", { section: "Contact Information" }),
      f("street", "Street Address", "text", { section: "Address" }),
      f("city", "City", "text", { section: "Address" }),
      ...address("Address").filter((x) => x.key !== "city"),
      f("postal", "Zip / Postal Code", "text", { section: "Address" }),
    ],
  },
  collectionAgencies: {
    screen: "FIN:COLLECTION_AGENCY",
    audit: "F21",
    label: "Collection agency",
    perm: "financialManagement",
    search: ["name", "city", "email", "phone"],
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Name", "text", { required: true, section: "Agency Details" }),
      f("address1", "Primary Address", "text", { section: "Agency Details" }),
      f("address2", "Secondary Address", "text", { section: "Agency Details" }),
      ...address("Agency Details"),
      f("postal", "Postal / Zip Code", "text", { section: "Agency Details" }),
      f("phone", "Phone Number", "text", { section: "Agency Details" }),
      f("email", "E-mail Address", "email", { section: "Agency Details" }),
      sel("commissionType", "Commission Type", ["Percentage", "Fixed"], { section: "Commission Details" }),
      f("commissionRate", "Commission Rate", "number", { required: true, min: 0, max: 1_000_000, suffix: "%", section: "Commission Details", hint: "Percentage of the amount sent to collections, or a fixed CAD amount per account." }),
      sel("defaultAgency", "Default Agency", DIS_EN, { section: "Automated Aging Settings", hint: "The default agency is pre-selected when an account is sent to collections. Only one agency can be the default." }),
    ],
  },
  agents: {
    screen: "FIN:AGENT",
    audit: "F07",
    label: "Agent",
    perm: "agentManagement",
    search: ["agentNumber", "firstName", "lastName", "company", "email"],
    unique: [
      { key: "agentNumber", label: "Agent #", scope: "all" },
      { key: "email", label: "E-mail", scope: "all" },
    ],
    fields: [
      f("agentNumber", "Agent #", "text", { required: true, section: "Agent" }),
      f("firstName", "First Name", "text", { required: true, section: "Agent" }),
      f("lastName", "Last Name", "text", { required: true, section: "Agent" }),
      f("company", "Agency / Company", "text", { section: "Agent" }),
      f("email", "E-mail", "email", { section: "Agent" }),
      f("phone", "Phone", "text", { section: "Agent" }),
      f("status", "Agent Status", "ref", { ref: "agentStatuses", section: "Agent" }),
      sel("commissionType", "Commission Type", ["Percentage", "Fixed"], { section: "Commission" }),
      f("commissionRate", "Commission Rate", "number", { required: true, min: 0, max: 1_000_000, dflt: 10, section: "Commission", hint: "Percentage of tuition, or a fixed CAD amount per student." }),
      sel("commissionBasis", "Commission Basis", ["Tuition paid", "Tuition invoiced"], { section: "Commission", hint: "Earned commission follows tuition paid; expected commission follows total tuition." }),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Seeds (captured configuration)                                       */
/* ------------------------------------------------------------------ */

export const SEED_PAYMENT_METHODS: Array<[string, boolean]> = [
  ["American Express", true],
  ["Cash", false],
  ["Cheque", false],
  ["Debit", false],
  ["EFT", false],
  ["Flywire", false],
  ["Gratify", false],
  ["MasterCard", true],
  ["Referral Credit", false],
  ["Student Aid", false],
  ["VISA", true],
];

export const SEED_LEDGER_CATEGORIES = ["Tuition", "Fees", "Materials"];

/** [name, code, trigger, category, domestic, international, taxed] */
export const SEED_LEDGER_TYPES: Array<[string, string, string, string, number, number, boolean]> = [
  ["Application Fee", "APP", "Application", "Fees", 150, 250, false],
  ["Assessment Fee", "ASMT", "Entry / Progress Test", "Fees", 75, 75, false],
  ["Fine", "FINE", "Late Fee", "Fees", 25, 25, false],
  ["Lab, Books, Supplies, etc.", "LAB", "None", "Materials", 200, 200, true],
  ["Misc.", "MISC", "None", "Fees", 0, 0, false],
  ["Re-attempt Fees", "REATT", "Re-Take Course", "Fees", 300, 450, false],
  ["Shipping charges", "SHIP", "None", "Materials", 20, 45, true],
  ["Textbooks", "TXTB", "Textbooks", "Materials", 120, 120, true],
  ["Tuition Fee", "TUIT", "Course Tuition", "Tuition", 1200, 2400, false],
  ["Tuition Fees", "TUITP", "Program Tuition", "Tuition", 6500, 14500, false],
];

export const SEED_TAX_RATES: Array<[string, number, string]> = [
  ["GST", 5, "GST-100"],
  ["PST", 7, "PST-200"],
];

export const SEED_DISBURSEMENT_TYPES: Array<[string, string, (typeof DISBURSEMENT_KINDS)[number]]> = [
  ["Assessment Fee", "Credit applied against assessment fees", "Fund only"],
  ["Bursary", "Need-based bursary", "Scholarship / Bursary"],
  ["Discount", "Discount granted by the institution", "Promotion / Award"],
  ["Registration Fee", "Registration fee credit", "Fund only"],
  ["Scholarship", "Merit scholarship", "Scholarship / Bursary"],
  ["Student Loans", "Government student loan disbursement", "Student Loan"],
];

/** Built-in credit type created when a payment is refunded as account credit. */
export const ADVANCE_CREDIT = "Advance Payment Credit";

export const SEED_AGENTS: Array<Data> = [
  { agentNumber: "AG-1001", firstName: "Priya", lastName: "Sharma", company: "Maple Pathways Education", email: "priya@maplepathways.example", commissionType: "Percentage", commissionRate: 10, commissionBasis: "Tuition paid" },
  { agentNumber: "AG-1002", firstName: "Daniel", lastName: "Okafor", company: "Northbound Study Abroad", email: "daniel@northbound.example", commissionType: "Percentage", commissionRate: 12, commissionBasis: "Tuition paid" },
];
