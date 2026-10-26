/** SEARCH STUDENTS (Advanced Search) dropdowns, spelled exactly as on the source screens. */

export type Option = { label: string; value: string; indent?: boolean };

export const STATUS_OPTIONS: Option[] = [
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
  { label: "Refused Visa", value: "Refused Visa" },
  { label: "File not Logged (Offshore student)", value: "File not Logged (Offshore student)" },
  { label: "Prospective Student (Marketing team)", value: "Prospective Student (Marketing team)" },
];

export const RESIDENCY_OPTIONS: Option[] = [
  { label: "Domestic", value: "Domestic" },
  { label: "International", value: "International" },
];

/** "Blended" also matches records stored as Bleded (the original UI spelling) or Hybrid. */
export const DELIVERY_OPTIONS: Option[] = [
  { label: "In-person", value: "In-person" },
  { label: "Blended", value: "Blended" },
  { label: "Online", value: "Online" },
];

/** `value` is the STUDENT_PROGRAMS code used by the search filter. */
export const PROGRAM_GROUPS: Array<{ group: string; options: Option[] }> = [
  {
    group: "ACCOUNTING/PAYROLL",
    options: [
      { value: "CAPA", label: "CAPA: Certificate in Accounting and Payroll Administrator" },
      { value: "DAP", label: "DAP: Diploma in Accounting and Payroll administrator" },
    ],
  },
  {
    group: "BUSINESS",
    options: [
      { value: "BTT", label: "BTT: Bank Teller Training" },
      { value: "COA", label: "COA: Certificate Office Administration" },
      { value: "CSMS", label: "CSMS: Corporate Sales Management Strategies Certificate" },
      { value: "DIB", label: "DIB: Diploma in International Business" },
      { value: "DMM", label: "DMM: Digital Marketing Management" },
      { value: "HRA", label: "HRA: Human Resources Administration" },
      { value: "MA", label: "MA: Marketing Administration" },
      { value: "OA", label: "OA: Office Administration" },
      { value: "RSMS", label: "RSMS: Retail Sales Management Strategies Certificate" },
    ],
  },
  {
    group: "COMPUTER SCIENCE",
    options: [
      { value: "NSA", label: "NSA: Network Support Administrator" },
      { value: "NST", label: "NST: Network Support Technician" },
    ],
  },
  {
    group: "EARLY CHILDHOOD EDUCATOR ASSISTANT",
    options: [
      { value: "ECEA (Option 2)", label: "ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication" },
      { value: "ECEA option 1", label: "ECEA option1: Child Growth Development part 1 & 2" },
    ],
  },
  {
    group: "HEALTH SCIENCE",
    options: [
      { value: "ACSW", label: "ACSW: Addictions Community Support Worker" },
      { value: "HCA", label: "HCA: Health Care Assistant" },
      { value: "HCA-3", label: "HCA: Interpersonal Communication (HCA-3)" },
      { value: "MOA", label: "MOA: Medical Office Assistant" },
      { value: "SSSW", label: "SSSW: Social Services Support Worker" },
    ],
  },
  { group: "HOSPITALITY MANAGEMENT", options: [{ value: "DHM", label: "DHM: Diploma in Hospitality Management" }] },
  { group: "LANGUAGES", options: [{ value: "ESC", label: "ESC: English Skills for College" }] },
];

/** Source term records: [name, start, end]. Same-name records differ only by date range. */
const ADMISSION_TERMS: Array<[string, string, string]> = [
  ["3rd Term-2026", "2026-09-01", "2026-12-31"],
  ["2nd Term-2026", "2026-05-01", "2026-08-31"],
  ["1st Term-2026", "2026-01-01", "2026-04-30"],
  ["3rd Term-2025", "2025-09-01", "2025-12-31"],
  ["2nd Term-2025", "2025-05-01", "2025-08-31"],
  ["1st Term-2025", "2025-01-01", "2025-04-30"],
  ["2024-03-18", "2024-03-18", "2024-12-31"],
  ["2024-03-16", "2024-03-18", "2024-10-06"],
  ["2024-02-12", "2024-02-12", "2024-10-11"],
  ["2024-02-05", "2024-02-05", "2024-12-31"],
  ["2024-02-05", "2024-02-05", "2024-11-01"],
  ["2024-02-05", "2024-02-05", "2024-10-10"],
  ["2024-02-05", "2024-02-05", "2024-10-09"],
  ["2023-12-04", "2023-12-04", "2024-10-11"],
  ["2023-11-06", "2023-11-06", "2024-08-30"],
  ["2023-11-06", "2023-11-06", "2024-05-23"],
  ["Bank Teller Program - September 13 to September 21", "2023-09-12", "2023-09-23"],
  ["Bank Teller Program", "2022-07-24", "2022-08-02"],
  ["April 2021", "2021-04-01", "2021-04-30"],
  ["March 2021", "2021-03-01", "2021-03-31"],
  ["February 2021", "2021-02-01", "2021-02-28"],
  ["January 2021", "2021-01-01", "2021-01-31"],
  ["PBMLT-HCA Cohort (Dec 2020-Sep 2021)", "2020-12-14", "2021-09-03"],
  ["December 2020", "2020-12-01", "2020-12-31"],
  ["November 2020", "2020-11-01", "2020-11-30"],
  ["October 2020", "2020-10-01", "2020-10-31"],
  ["September 2020", "2020-09-01", "2020-09-30"],
  ["August 2020", "2020-08-01", "2020-08-31"],
  ["July 2020", "2020-07-01", "2020-07-31"],
  ["June 2020", "2020-06-01", "2020-06-30"],
  ["May 2020", "2020-05-01", "2020-05-31"],
  ["March 2020", "2020-03-01", "2020-03-31"],
  ["February 2020", "2020-02-01", "2020-02-29"],
  ["PBLMT HCA cohort", "2020-02-18", "2020-10-13"],
];

const termLabel = (name: string, start: string, end: string) => `${name}: ${start} - ${end}`;

/** Catalog terms first, then any live terms whose name is not already listed. */
export function admissionTermOptions(live: Array<{ name: string; startsOn: string; endsOn: string }>): Option[] {
  const out = ADMISSION_TERMS.map(([n, s, e]) => ({ label: termLabel(n, s, e), value: termLabel(n, s, e) }));
  const known = new Set(ADMISSION_TERMS.map(([n]) => key(n)));
  for (const t of live) {
    if (known.has(key(t.name))) continue;
    known.add(key(t.name));
    out.push({ label: t.startsOn && t.endsOn ? termLabel(t.name, t.startsOn, t.endsOn) : t.name, value: t.name });
  }
  return out;
}

/** Case/spacing/punctuation-insensitive key, so "3rd Term 2026" matches "3rd Term-2026". */
export function key(v: string | null | undefined) {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function termMatches(stored: string | undefined, wanted: string) {
  if (!stored) return false;
  const name = wanted.replace(/:\s*\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}$/, "");
  return key(stored) === key(wanted) || key(stored) === key(name);
}

function deliveryKind(v: string | undefined) {
  const k = key(v);
  if (/^(inperson|inclass|onsite|campus)/.test(k)) return "in-person";
  if (/^(bleded|blended|hybrid)/.test(k)) return "blended";
  if (k.startsWith("online")) return "online";
  return k;
}

export function deliveryMatches(stored: string | undefined, wanted: string) {
  return deliveryKind(stored) === deliveryKind(wanted);
}
