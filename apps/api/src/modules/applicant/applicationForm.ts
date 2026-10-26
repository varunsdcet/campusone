export type ApplicationSection = "personal" | "academic" | "program";

export type ApplicationField = {
  key: string;
  label: string;
  section: ApplicationSection;
  required: boolean;
  kind: "text" | "email" | "date" | "year" | "tel" | "select";
  max?: number;
  options?: string[];
  /** Options come from the institution's programs / intakes at request time. */
  dynamic?: "programs" | "intakes";
};

export const SECTION_LABELS: Record<ApplicationSection, string> = {
  personal: "Personal details",
  academic: "Academic history",
  program: "Program choice",
};

export const APPLICATION_FIELDS: ApplicationField[] = [
  { key: "givenName", label: "First name", section: "personal", required: true, kind: "text", max: 80 },
  { key: "middleName", label: "Middle name", section: "personal", required: false, kind: "text", max: 80 },
  { key: "familyName", label: "Last name", section: "personal", required: true, kind: "text", max: 80 },
  { key: "email", label: "Email", section: "personal", required: true, kind: "email", max: 200 },
  { key: "dateOfBirth", label: "Date of birth", section: "personal", required: true, kind: "date" },
  { key: "gender", label: "Gender", section: "personal", required: true, kind: "select", options: ["Female", "Male", "Non-binary", "Prefer not to say", "Other"] },
  { key: "phone", label: "Phone number", section: "personal", required: true, kind: "tel", max: 30 },
  { key: "addressLine1", label: "Street address", section: "personal", required: true, kind: "text", max: 160 },
  { key: "addressLine2", label: "Apartment / unit", section: "personal", required: false, kind: "text", max: 80 },
  { key: "city", label: "City", section: "personal", required: true, kind: "text", max: 80 },
  { key: "region", label: "Province / state", section: "personal", required: false, kind: "text", max: 80 },
  { key: "postalCode", label: "Postal code", section: "personal", required: false, kind: "text", max: 20 },
  { key: "country", label: "Country", section: "personal", required: true, kind: "text", max: 80 },
  {
    key: "residency",
    label: "Residency status",
    section: "personal",
    required: true,
    kind: "select",
    options: ["Canadian citizen", "Permanent resident", "Study permit", "Work permit", "Visitor", "Other"],
  },
  {
    key: "highestEducation",
    label: "Highest level of education",
    section: "academic",
    required: true,
    kind: "select",
    options: ["Secondary school", "Certificate", "Diploma", "Bachelor's degree", "Master's degree or higher", "Other"],
  },
  { key: "institutionName", label: "School or institution", section: "academic", required: true, kind: "text", max: 160 },
  { key: "graduationYear", label: "Year completed", section: "academic", required: true, kind: "year" },
  { key: "gpa", label: "Final average / GPA", section: "academic", required: false, kind: "text", max: 20 },
  {
    key: "englishProficiency",
    label: "English proficiency",
    section: "academic",
    required: false,
    kind: "select",
    options: ["First language", "IELTS", "TOEFL", "Duolingo", "Other test", "Not yet taken"],
  },
  {
    key: "languageDocumentAcknowledgement",
    label: "Language-test document is current and can be verified",
    section: "academic",
    required: true,
    kind: "select",
    options: ["Confirmed"],
  },
  { key: "programCategory", label: "Category", section: "program", required: true, kind: "select", options: ["Business", "Health", "Trades", "Technology", "Other"] },
  { key: "programName", label: "Program", section: "program", required: true, kind: "select", dynamic: "programs" },
  { key: "intakeTerm", label: "Admission term", section: "program", required: true, kind: "select", dynamic: "intakes" },
  { key: "campus", label: "Campus", section: "program", required: true, kind: "select", options: ["Surrey", "Victoria", "Online"] },
  { key: "applicationAcknowledgement", label: "I confirm this application is complete and correct", section: "program", required: true, kind: "select", options: ["Confirmed"] },
];

export const REQUIRED_APPLICANT_DOCUMENTS = [
  "Grade 10 Certificate / Transcript",
  "Grade 12 Certificate / Transcript",
  "Post-Secondary Education Document",
  "Language Proficiency Test Report",
];

/** Privacy rule: the college never asks for a passport, SIN or other government ID, even on checklists created before this rule. */
export function isGovernmentIdDocument(label: string) {
  return /passport|social insurance|\bsin\b|government id/i.test(label);
}

export type FormValues = Record<string, string>;
export type FormOptions = { programs: string[]; intakes: string[] };

export function parseFormJson(raw: string | null | undefined): FormValues {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: FormValues = {};
    for (const f of APPLICATION_FIELDS) {
      const v = (parsed as Record<string, unknown>)[f.key];
      if (typeof v === "string") out[f.key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function optionsFor(f: ApplicationField, opts: FormOptions) {
  if (f.dynamic === "programs") return opts.programs;
  if (f.dynamic === "intakes") return opts.intakes;
  return f.options ?? [];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^[+()\d][\d\s()+.-]{5,29}$/;

/**
 * Validates a partial save. Blank required fields are allowed (the applicant can save as they go);
 * malformed values are rejected. `keep` lets a value chosen before the option list changed stay valid.
 */
export function cleanApplicationForm(input: unknown, opts: FormOptions, keep: FormValues = {}, now = new Date()) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const values: FormValues = {};
  const errors: Record<string, string> = {};
  for (const f of APPLICATION_FIELDS) {
    const raw = body[f.key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string" && typeof raw !== "number") {
      errors[f.key] = `${f.label} is not valid`;
      continue;
    }
    const v = String(raw).trim();
    values[f.key] = v;
    if (!v) continue;
    if (f.max && v.length > f.max) errors[f.key] = `${f.label} must be ${f.max} characters or fewer`;
    else if (f.kind === "date") {
      const d = new Date(`${v}T00:00:00Z`);
      const age = (now.getTime() - d.getTime()) / (365.25 * 86_400_000);
      if (!DATE_RE.test(v) || Number.isNaN(d.getTime())) errors[f.key] = `${f.label} must be a valid date`;
      else if (age < 14 || age > 100) errors[f.key] = `${f.label} must be a real date of birth`;
    } else if (f.kind === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.key] = `${f.label} must be a valid email address`;
    } else if (f.kind === "year") {
      const y = Number(v);
      if (!/^\d{4}$/.test(v) || y < 1950 || y > now.getUTCFullYear() + 1) errors[f.key] = `${f.label} must be a year between 1950 and ${now.getUTCFullYear() + 1}`;
    } else if (f.kind === "tel") {
      if (!PHONE_RE.test(v)) errors[f.key] = `${f.label} must be a valid phone number`;
    } else if (f.kind === "select") {
      const allowed = optionsFor(f, opts);
      if (allowed.length && !allowed.includes(v) && keep[f.key] !== v) errors[f.key] = `Choose a ${f.label.toLowerCase()} from the list`;
    }
  }
  return { values, errors };
}

export type Completeness = {
  sections: Record<ApplicationSection, { done: boolean; missing: string[] }>;
  documentsMissing: string[];
  missing: string[];
  pct: number;
};

export function applicationCompleteness(values: FormValues, documents: Array<{ label: string; status: string }>): Completeness {
  const sections = {
    personal: { done: true, missing: [] as string[] },
    academic: { done: true, missing: [] as string[] },
    program: { done: true, missing: [] as string[] },
  };
  const required = APPLICATION_FIELDS.filter((f) => f.required);
  let filled = 0;
  for (const f of required) {
    if ((values[f.key] ?? "").trim()) filled += 1;
    else {
      sections[f.section].missing.push(f.label);
      sections[f.section].done = false;
    }
  }
  const docs = (documents.length ? documents : REQUIRED_APPLICANT_DOCUMENTS.map((label) => ({ label, status: "missing" }))).filter(
    (d) => !isGovernmentIdDocument(d.label),
  );
  const documentsMissing = docs.filter((d) => d.status === "missing" || d.status === "rejected").map((d) => d.label);
  const total = required.length + docs.length;
  const done = filled + docs.length - documentsMissing.length;
  const missing = [
    ...(Object.keys(sections) as ApplicationSection[]).flatMap((s) => sections[s].missing.map((m) => `${SECTION_LABELS[s]}: ${m}`)),
    ...documentsMissing.map((d) => `Document: ${d}`),
  ];
  return { sections, documentsMissing, missing, pct: total ? Math.round((done / total) * 100) : 0 };
}
