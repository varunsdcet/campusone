/* Student Management: captured option lists, profile tab map and storage keys. */

export type Data = Record<string, unknown>;

export const STU = {
  PROFILE: "STU:PROFILE",
  FILE: "STU:FILE",
  FLAG: "STU:FLAG",
  CORR: "STU:CORR",
  REQ: "STU:REQ",
  ACTION: "STU:ACTION",
  ASSESS: "STU:ASSESS",
  TEST: "STU:TEST",
  ENROL: "STU:ENROL",
  ALERT: "STU:ALERT",
  TRANSCRIPT_CHANGE: "STU:TRANSCRIPT_CHANGE",
  BULK_LOG: "STU:BULK_LOG",
  SEQ: "STU:SEQ",
} as const;

/** Audit sections of Status & Profile › Audit Trail, each stored under its own screen id. */
export const AUDIT_SECTIONS = [
  "Course Enrolments",
  "Profile Changes",
  "Program Plan",
  "Transcripts/Final Marks",
  "Tuition/Finance",
  "Assessments",
  "Workflows/Requirements",
] as const;
export type AuditSection = (typeof AUDIT_SECTIONS)[number];
export const auditScreen = (section: AuditSection) => `STU:AUD:${AUDIT_SECTIONS.indexOf(section)}`;
export const FINANCE_AUDIT_SCREEN = "FIN:STUDENT";

/** Fallback status tree when System Configuration › Student Statuses has not been opened yet. */
export const STATUS_TREE: Array<{ name: string; children?: string[] }> = [
  { name: "New Inquiry" },
  { name: "Approved Application" },
  { name: "Pre-enrolment Application", children: ["CLOA", "LOA", "Cancelled / Did not proceed", "Follow Up", "In-active Leads", "Duplicate profiles"] },
  { name: "Declined Application" },
  { name: "Registered Student" },
  { name: "Active Student", children: ["On-Hold", "Leave of Absence"] },
  { name: "Graduated" },
  { name: "Incomplete" },
  { name: "Withdrawn Students" },
  { name: "Dismissed" },
  { name: "Refused Visa" },
  { name: "File not Logged (Offshore student)" },
  { name: "Prospective Student (Marketing team)" },
];

export const GENDERS = ["Male", "Female", "Other"] as const;
export const RESIDENCY = ["Domestic", "International"] as const;
export const VISA_STATUSES = ["Permanent Resident", "Student VISA", "Visitor", "Work Permit", "Distance", "Citizen"] as const;
export const DELIVERY_METHODS = ["In-person", "Blended", "Online"] as const;
/** Older student records store the original UI misspelling "Bleded". */
export const normalizeDelivery = (v: unknown) => (v === "Bleded" ? "Blended" : v);
export const DECLARATION_BY = ["Applicant", "Agent or Representative", "Student"] as const;
export const DECLARATION_ACKS = [
  "I certify that the information provided is accurate and complete.",
  "I acknowledge that false or misleading information or documents may result in the rejection of the application or withdrawal of admission.",
] as const;
export const RATE_CATEGORIES = ["Domestic", "International"] as const;

/** Statuses offered by the Program Plan enrolment form. */
export const ENROLMENT_STATUSES = ["Registered Student", "Active Student", "Graduated"] as const;
/** Statuses that cannot be set while Rate Category / Fee Status is missing. */
export const RATE_REQUIRED_STATUSES = new Set<string>(ENROLMENT_STATUSES);
export const RATE_REQUIRED_MESSAGE = "Student cannot be changed to this status. Field required: Rate Category / Fee Status.";

export const FLAG_STATUSES = ["Active", "Dismissed"] as const;
export const RESOLVED = ["All", "No", "Yes"] as const;

export const ACTION_STATUSES = ["All", "Pending", "Applied", "Revoked", "Dismissed"] as const;
export const ASSESSMENT_STATUSES = ["Pending Assignment", "Approved", "Declined", "Pending Review", "Completed"] as const;

export const REQ_DATA_TYPES = ["Document Required", "Form", "Fee / Payment", "Agreement / Contract", "Entry / Progress Test"] as const;
export const REQ_DATA_COLLECTION = ["Navigation link only", "Prompt student at login", "Show on screen"] as const;
export const REQ_EXPIRY = [
  "None",
  "When student becomes active in a course",
  "When student status is changed",
  "When a new term starts that the student is enrolled in",
  "When the student graduates or withdraws",
  "When student changes statuses",
] as const;
export const REQ_RECURRENCE = ["Disabled", "By Timeframe", "By Enrolment Term"] as const;
/** Only the selected values seen in the capture; the remaining choices of these selectors were not opened. */
export const REQ_DOC_APPROVAL = ["Instant Approval"] as const;
export const REQ_EXPIRY_UNITS = ["Years"] as const;
export const REQ_EXPIRY_ACTIONS = ["Re-Create Requirement"] as const;
export const REQ_STATUSES = ["Pending", "Approved", "Declined"] as const;
export const REQ_SUBMISSIONS = ["No Response", "Skipped", "Submitted"] as const;

export const CORR_VISIBILITY = ["Hidden from student", "Visible to student"] as const;
export const CORR_MISC_CATEGORY = "Miscellaneous";
export const NOTIFICATION_METHODS = ["External E-mail"] as const;
/** Notification templates offered in the captured Send Notification modal. */
export const CAPTURED_NOTIFICATION_TEMPLATES = ["New Application", "Payment Received", "Student e-mail"] as const;

/** Document Type groups seen in the opened Generate Document dropdown. */
export const CAPTURED_DOCUMENT_GROUPS = [
  "Warning letters",
  "LOA / CLOA",
  "Certificate / Diploma",
  "Student handbooks",
  "Confirmation of enrolment",
  "Fee-due notices",
  "Offer letters",
  "Student activity / enrolment documents",
  "Termination-related templates",
] as const;

export const TRANSCRIPT_OPTIONS = [
  { key: "inProgress", label: "Show courses in progress" },
  { key: "transfer", label: "Show transfer courses" },
  { key: "challenge", label: "Show challenge courses" },
  { key: "tests", label: "Show entry/progress tests" },
  { key: "noCredit", label: "Show courses without passing credit" },
  { key: "droppedPenalty", label: "Show courses that have been dropped with penalties" },
  { key: "overlapping", label: "Show overlapping courses completed in previous in-takes" },
] as const;

export const LOA_STATUSES = ["Pending", "Approved", "Active", "Completed", "Declined"] as const;
export const WITHDRAW_STATUSES = ["Pending", "Approved", "Declined"] as const;
export const BADGE_STATUSES = ["Pending", "Approved", "Declined"] as const;

export const EXPORT_OPTIONS = ["Student Photos"] as const;
export const BULK_ACTIONS = [
  "Change Student Status",
  "Course Enrolment",
  "Program Enrolment",
  "Lock / Unlock Program Plan",
  "Flags / Holds",
  "Add / Insert Fees",
  "Add / Insert Transactions",
] as const;

/* Finance (student profile) */
export const PAYEES = ["Student", "Institution"] as const;
export const PAYMENT_TYPES = ["Standard", "Deposit", "Correction"] as const;
export const REFUND_TYPES = ["Cash Back", "Apply Credit"] as const;
export const INVOICE_ITEM_TYPES = ["Course", "Textbook", "Other Fee / Ledger Item", "Credit / Disbursement"] as const;
export const AWARD_STATUSES = ["Active", "Inactive"] as const;
export const AWARD_ALLOCATION = ["During enrolment only"] as const;
export const AWARD_ELIGIBILITY = ["Manual", "Automated"] as const;
export const PLAN_SYNC = ["Disabled", "With term balance", "With total fees balance"] as const;
export const PLAN_SCHEDULE_TYPES = ["Fixed Instalment Frequency", "Manual / Advanced Instalments"] as const;
export const PLAN_FREQUENCIES = [
  ...[1, 2, 3, 4, 5, 6].map((n) => `${n} day${n > 1 ? "s" : ""}`),
  ...[1, 2, 3, 4].map((n) => `${n} week${n > 1 ? "s" : ""}`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `${n} month${n > 1 ? "s" : ""}`),
];
export const FALLBACK_DISBURSEMENT_TYPES = ["Assessment Fee", "Bursary", "Discount", "Registration Fee", "Scholarship", "Student Loans"] as const;
export const TAX_DOCUMENTS = ["T2202 Slip – 2024", "T2202 Slip – 2025", "Student Financial Statement"] as const;

/** Notices shown wherever the source capture stops short of a complete flow. */
export const SOURCE_CONFIRMATION = "Source confirmation required";
