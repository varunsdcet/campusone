/** MySIS Advanced Search — dropdown catalogs (labels match campus screenshots). */

export type SearchOption = { label: string; value: string; indent?: boolean; group?: string };

export const SEARCH_STATUS_OPTIONS: SearchOption[] = [
  { label: "All Statuses", value: "" },
  { label: "New Inquiry", value: "New Inquiry" },
  { label: "Approved Application", value: "Approved Application" },
  { label: "Pre-enrolment Application", value: "Pre-enrolment Application" },
  { label: "Cancelled/ Did not proceed", value: "Cancelled/ Did not proceed", indent: true },
  { label: "CLOA", value: "CLOA", indent: true },
  { label: "Duplicate profiles", value: "Duplicate profiles", indent: true },
  { label: "Follow Up", value: "Follow Up", indent: true },
  { label: "In-active Leads", value: "In-active Leads", indent: true },
  { label: "LOA", value: "LOA", indent: true },
  { label: "Declined Application", value: "Declined Application" },
  { label: "Registered Student", value: "Registered Student" },
  { label: "Active Student", value: "Active Student" },
  { label: "Leave of Absence", value: "Leave of Absence", indent: true },
  { label: "On-Hold", value: "On-Hold", indent: true },
  { label: "Graduated", value: "Graduated" },
  { label: "Incomplete", value: "Incomplete" },
  { label: "Withdrawn Students", value: "Withdrawn Students" },
  { label: "Dismissed", value: "Dismissed" },
];

export const SEARCH_CAMPUS_OPTIONS: SearchOption[] = [
  { label: "All Campuses", value: "" },
  { label: "#110 Heritage College - Surrey", value: "#110 Heritage College - Surrey" },
  { label: "Heritage Community College - Distance", value: "Heritage Community College - Distance" },
  { label: "Heritage Community College - Victoria", value: "Heritage Community College - Victoria" },
  { label: "Online", value: "Online" },
];

export const SEARCH_DELIVERY_OPTIONS: SearchOption[] = [
  { label: "All", value: "" },
  { label: "In-Person", value: "In-Person" },
  { label: "Online", value: "Online" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "Distance", value: "Distance" },
];

export const SEARCH_DOMESTIC_OPTIONS: SearchOption[] = [
  { label: "All", value: "" },
  { label: "Domestic", value: "Domestic" },
  { label: "International", value: "International" },
];

/** Screenshot-parity program list; live DB programs are merged at runtime. */
export const SEARCH_PROGRAM_CATALOG: Array<{ group: string; code: string; label: string }> = [
  { group: "ACCOUNTING/PAYROLL", code: "CAPA", label: "Certificate in Accounting and Payroll Administrator" },
  { group: "ACCOUNTING/PAYROLL", code: "DAP", label: "Diploma in Accounting and Payroll administrator" },
  { group: "BUSINESS", code: "BTT", label: "Bank Teller Training" },
  { group: "BUSINESS", code: "COA", label: "Certificate Office Administration" },
  { group: "BUSINESS", code: "CSMS", label: "Corporate Sales Management Strategies Certificate" },
  { group: "BUSINESS", code: "DIB", label: "Diploma in International Business" },
  { group: "BUSINESS", code: "DMM", label: "Digital Marketing Management" },
  { group: "BUSINESS", code: "HRA", label: "Human Resources Administration" },
  { group: "BUSINESS", code: "MA", label: "Marketing Administration" },
  { group: "BUSINESS", code: "OA", label: "Office Administration" },
  { group: "BUSINESS", code: "RSMS", label: "Retail Sales Management Strategies Certificate" },
  { group: "COMPUTER SCIENCE", code: "NSA", label: "Network Support Administrator" },
  { group: "COMPUTER SCIENCE", code: "NST", label: "Network Support Technician" },
  { group: "COMPUTER SCIENCE", code: "CS-DIP", label: "Computer Science Diploma" },
  {
    group: "EARLY CHILDHOOD EDUCATOR ASSISTANT",
    code: "ECEA2",
    label: "ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication",
  },
  {
    group: "EARLY CHILDHOOD EDUCATOR ASSISTANT",
    code: "ECEA1",
    label: "ECEA option1: Child Growth Development part 1 & 2",
  },
  { group: "HEALTH SCIENCE", code: "ACSW", label: "Addictions Community Support Worker" },
  { group: "HEALTH SCIENCE", code: "HCA", label: "Health Care Assistant" },
  { group: "HEALTH SCIENCE", code: "HCA_2", label: "Interpersonal Communication (HCA_2)" },
];

export const MONTH_OPTIONS: SearchOption[] = [
  { label: "-- Month --", value: "" },
  ...[
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((label, i) => ({ label, value: String(i + 1).padStart(2, "0") })),
];

export function dayOptions(): SearchOption[] {
  return [
    { label: "-- Day --", value: "" },
    ...Array.from({ length: 31 }, (_, i) => {
      const v = String(i + 1).padStart(2, "0");
      return { label: v, value: v };
    }),
  ];
}

export function yearOptions(now = new Date().getFullYear()): SearchOption[] {
  const years: SearchOption[] = [{ label: "-- Year --", value: "" }];
  for (let y = now; y >= now - 80; y -= 1) {
    years.push({ label: String(y), value: String(y) });
  }
  return years;
}

/** Normalize lifecycle labels so screenshot + LIFECYCLE_STATUSES both match. */
export function normalizeLifecycleLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  if (v.includes("pre-enrol") || v.includes("pre-enroll")) return "Pre-enrolment Application";
  if (v.includes("cancelled") || v.includes("did not proceed")) return "Cancelled/ Did not proceed";
  if (v === "cloa") return "CLOA";
  if (v.includes("duplicate")) return "Duplicate profiles";
  if (v.includes("inactive") || v.includes("in-active")) return "In-active Leads";
  if (v === "loa") return "LOA";
  if (v.includes("leave of absence")) return "Leave of Absence";
  if (v.includes("on-hold") || v.includes("on hold")) return "On-Hold";
  if (v.includes("withdrawn")) return "Withdrawn Students";
  if (v.includes("active student")) return "Active Student";
  if (v.includes("registered")) return "Registered Student";
  if (v.includes("new inquiry")) return "New Inquiry";
  if (v.includes("approved")) return "Approved Application";
  if (v.includes("declined")) return "Declined Application";
  if (v.includes("graduated")) return "Graduated";
  if (v.includes("incomplete")) return "Incomplete";
  if (v.includes("dismissed")) return "Dismissed";
  if (v.includes("follow")) return "Follow Up";
  return value.trim();
}
