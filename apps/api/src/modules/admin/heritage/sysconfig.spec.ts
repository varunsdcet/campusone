/* System Configuration (SC01–SC36): field definitions, settings pages and captured seed data. */

import { FIN_ENTITIES, type FinEntityKey } from "./finance.spec.js";

export type Data = Record<string, unknown>;

export type Kind =
  | "text"
  | "email"
  | "domain"
  | "number"
  | "date"
  | "time"
  | "select"
  | "radio"
  | "bool"
  | "multi"
  | "multiList"
  | "dual"
  | "textarea"
  | "html"
  | "code"
  | "color"
  | "icon"
  | "file"
  | "files"
  | "ref"
  | "refMulti"
  | "people"
  | "person"
  | "secret"
  | "password"
  | "rows";

export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: readonly string[];
  /** Option list resolved from the shared reference lists (statuses, programs, campuses, …). */
  dyn?: string;
  dynExtra?: readonly string[];
  /** Target System Configuration list for ref / refMulti fields. */
  ref?: EntityKey;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  when?: { key: string; equals: string | boolean | readonly string[]; not?: boolean };
  section?: string;
  group?: string;
  sub?: string;
  suffix?: string;
  hint?: string;
  lang?: boolean;
  placeholder?: string;
  /** Kept from the stored record on update (catalogue entries such as plug-in names). */
  readonly?: boolean;
  rowFields?: Field[];
  rowLabel?: string;
  addLabel?: string;
  rowSave?: string;
  columns?: string[];
  confirm?: boolean;
  /** Select whose options are the regions of the country chosen in this field (free text when the country has none). */
  dependsOn?: string;
  /** refMulti rendering: checkbox list or multi-select list instead of the dual list. */
  display?: "checks" | "list";
};

export type EntityKey = SysEntityKey | FinEntityKey;

type SysEntityKey =
  | "workflows"
  | "assessments"
  | "assessmentCategories"
  | "advisorLinkings"
  | "documentTypes"
  | "flagTemplates"
  | "userAgreements"
  | "agentStatuses"
  | "studentStatuses"
  | "documentTemplates"
  | "templateModules"
  | "documentInputs"
  | "documentFonts"
  | "runningElements"
  | "notificationTemplates"
  | "correspondenceCategories"
  | "correspondenceTypes"
  | "forms"
  | "sections"
  | "plugins"
  | "customEndpoints"
  | "reasonCodes"
  | "holidays"
  | "emailFilters"
  | "emailDepartments"
  | "mailMergeTemplates"
  | "smsProviders"
  | "whitelist"
  | "blockedUsers"
  | "bounces"
  | "securityCategories"
  | "securityQuestions"
  | "accessOutcomes"
  | "serviceAccounts"
  | "countries"
  | "countryRegions"
  | "languages"
  | "currencies"
  | "timezones";

export type EntityDef = {
  screen: string;
  audit: string;
  label: string;
  parent?: { entity: EntityKey; label: string };
  fields: Field[];
  unique: Array<{ key: string; label: string; scope: "all" | "parent" }>;
  search: string[];
  sortable?: boolean;
  /** Records are created by the system (seed / catalogue) and cannot be added from the UI. */
  noCreate?: boolean;
  /** Permission module guarding the list (System Configuration when omitted). */
  perm?: "systemConfiguration" | "financialManagement" | "agentManagement";
};

const ACTIVE = ["Active", "Inactive"] as const;
const YES_NO = ["Yes", "No"] as const;
const NO_YES = ["No", "Yes"] as const;
const EN_DIS = ["Enabled", "Disabled"] as const;
const DIS_EN = ["Disabled", "Enabled"] as const;
const SHOW_HIDE = ["Show", "Hide"] as const;
const WORKFLOW_ACTIONS = ["Take No Action", "Change Student Status", "Apply Flag / Hold", "Send Notification"] as const;

export const COLOURS = ["#2e7d32", "#1565c0", "#c62828", "#ef6c00", "#6a1b9a", "#00838f", "#ad1457", "#f9a825", "#455a64", "#795548", "#9e9e9e", "#000000"] as const;
export const NAV_ICONS = ["home", "user", "book", "briefcase", "graduation", "bell", "dollar", "award", "list", "bar-chart", "calendar", "users", "settings", "folder", "file", "mail", "globe", "star"] as const;
export const OUTCOME_ICONS = ["Green Check", "Warning", "Red Minus", "Blue Question", "Custom"] as const;
export const SYSTEM_FUNCTIONS = [
  "My Profile / Settings",
  "My Courses",
  "Workshops",
  "My Records",
  "Request Forms",
  "Students",
  "Agents",
  "Requests",
  "Financial Management",
  "Program Management",
  "Course Management",
  "Reporting",
  "Location Management",
  "User Management",
  "System Configuration",
] as const;
export const RECORD_TYPES = ["Student Profiles", "Applications", "Leads / Inquiries", "Agents", "Staff / Faculty", "External Institutions", "Courses", "Programs"] as const;
export const FORM_TYPES = [
  "Application / Profile Form",
  "Agent Details Form",
  "Lead / Inquiry Form",
  "Request Form",
  "Student Break Form",
  "Agreement Form",
  "External Institution Form",
  "Requirement / Workflow Form",
] as const;

const RETENTION = ["Keep Forever", "30 Days", "90 Days", "6 Months", "1 Year", "2 Years", "5 Years"] as const;

const f = (key: string, label: string, kind: Kind, extra: Partial<Field> = {}): Field => ({ key, label, kind, ...extra });
const sel = (key: string, label: string, options: readonly string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "select", options, dflt: options[0], required: true, ...extra });
const dyn = (key: string, label: string, list: string, all: string, extra: Partial<Field> = {}): Field => ({ key, label, kind: "select", dyn: list, dynExtra: [all], dflt: all, required: true, ...extra });

/* ------------------------------------------------------------------ */
/* Entities                                                             */
/* ------------------------------------------------------------------ */

const SYS_ENTITIES: Record<SysEntityKey, EntityDef> = {
  workflows: {
    screen: "SYS:WORKFLOW",
    audit: "SC01",
    label: "Requirement / workflow",
    search: ["name", "description"],
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Name", "text", { required: true, section: "Requirement / Workflow Details" }),
      f("description", "Description", "textarea", { section: "Requirement / Workflow Details" }),
      sel("workflowStatus", "Workflow Status", DIS_EN, { section: "Requirement / Workflow Details" }),
      f("triggerStatuses", "Trigger Statuses", "multiList", { dyn: "statuses", section: "Status Conditions", hint: "Hold Ctrl (Cmd on Mac) and click to select multiple statuses." }),
      f("restrictedStatuses", "Restricted Statuses", "multiList", { dyn: "statuses", section: "Status Conditions", hint: "Hold Ctrl (Cmd on Mac) and click to select multiple statuses." }),
      sel("action", "Action", WORKFLOW_ACTIONS, { section: "Workflow Action" }),
      f("actionStatus", "Change Status To", "select", { dyn: "statuses", required: true, section: "Workflow Action", when: { key: "action", equals: "Change Student Status" } }),
      f("actionFlag", "Flag / Hold Template", "ref", { ref: "flagTemplates", required: true, section: "Workflow Action", when: { key: "action", equals: "Apply Flag / Hold" } }),
      f("actionNotification", "Notification Template", "ref", { ref: "notificationTemplates", required: true, section: "Workflow Action", when: { key: "action", equals: "Send Notification" } }),
      f("steps", "Workflow Steps", "rows", {
        section: "Workflow Steps",
        rowLabel: "Step",
        addLabel: "Add Step",
        columns: ["name", "assignedTo", "dueDays"],
        rowFields: [
          f("name", "Step Name", "text", { required: true }),
          sel("assignedTo", "Assigned To", ["Student", "Advisor", "Admissions", "Registrar", "Finance", "Agent"]),
          f("dueDays", "Due Within", "number", { integer: true, min: 0, max: 365, suffix: "days" }),
          f("instructions", "Instructions", "textarea"),
        ],
      }),
      f("items", "Requirement Items", "rows", {
        section: "Requirement Items",
        rowLabel: "Requirement Item",
        addLabel: "Add Requirement Item",
        columns: ["name", "conditions", "dataCollection"],
        rowFields: [
          f("name", "Requirement Name", "text", { required: true }),
          sel("conditions", "Conditions", ["Always Required", "International Students Only", "Domestic Students Only", "Under 19 Only", "Selected Programs Only"]),
          sel("dataCollection", "Data Collection", ["Document Upload", "Form Submission", "Staff Verification", "Acknowledgement"]),
          f("documentType", "Document Type", "ref", { ref: "documentTypes", when: { key: "dataCollection", equals: "Document Upload" } }),
          f("form", "Form", "ref", { ref: "forms", when: { key: "dataCollection", equals: "Form Submission" } }),
        ],
      }),
    ],
  },
  assessments: {
    screen: "SYS:ASSESSMENT",
    audit: "SC02",
    label: "Assessment",
    search: ["name"],
    unique: [{ key: "name", label: "Assessment Name", scope: "all" }],
    fields: [
      f("name", "Assessment Name", "text", { required: true, section: "Assessment Details" }),
      sel("status", "Assessment Status", DIS_EN, { section: "Assessment Details" }),
      sel("automatedAssignment", "Automated Assignment", DIS_EN, { section: "Assessment Details" }),
      sel("reviewProcess", "Review Process", ["Approval Required", "No Approval Required", "Review Only"], { section: "Review & Workflow Settings" }),
      sel("workflowProcessing", "Workflow Processing", ["No Impact", "Pause Workflow Until Complete", "Block Workflow If Failed"], { section: "Review & Workflow Settings" }),
      sel("action", "Action", WORKFLOW_ACTIONS, { section: "Review & Workflow Settings" }),
      f("actionStatus", "Change Status To", "select", { dyn: "statuses", required: true, section: "Review & Workflow Settings", when: { key: "action", equals: "Change Student Status" } }),
      f("summary", "Assessment Summary", "html", { section: "Assessment Summary" }),
      f("cases", "Cases", "rows", {
        section: "Cases",
        rowLabel: "Case",
        addLabel: "Add Case",
        columns: ["name", "category", "outcome"],
        rowFields: [
          f("name", "Case Name", "text", { required: true }),
          f("category", "Assessment Category", "ref", { ref: "assessmentCategories" }),
          sel("outcome", "Default Outcome", ["Pending Review", "Pass", "Fail", "Refer to Advisor"]),
          f("description", "Case Description", "textarea"),
        ],
      }),
    ],
  },
  assessmentCategories: {
    screen: "SYS:ASSESSMENT_CATEGORY",
    audit: "SC03",
    label: "Assessment category",
    search: ["name"],
    unique: [{ key: "name", label: "Category Name", scope: "all" }],
    fields: [
      f("name", "Category Name", "text", { required: true, lang: true }),
      f("colour", "Category Colour", "color", { required: true, options: COLOURS, dflt: COLOURS[1] }),
      sel("access", "Category Access", ["All Applicable Users", "Staff Only", "Faculty Only", "Administrators Only"]),
    ],
  },
  advisorLinkings: {
    screen: "SYS:ADVISOR_LINK",
    audit: "SC04",
    label: "Advisor linking",
    search: ["name"],
    unique: [{ key: "name", label: "Linking Name", scope: "all" }],
    fields: [
      f("name", "Linking Name", "text", { required: true, section: "Advisor Linking Details" }),
      f("advisor", "Advisor Name", "person", { required: true, section: "Advisor Linking Details", placeholder: "Start typing an advisor name" }),
      dyn("campus", "Campus", "campuses", "All Campuses", { section: "Linking Filters" }),
      dyn("status", "Status", "statuses", "All Statuses", { section: "Linking Filters" }),
      dyn("program", "Program of Study", "programs", "All Programs", { section: "Linking Filters" }),
      dyn("rateCategory", "Rate Category", "rateCategories", "All Rates", { section: "Linking Filters" }),
      dyn("nationality", "Nationality", "countries", "All Nationalities", { section: "Linking Filters" }),
    ],
  },
  documentTypes: {
    screen: "SYS:DOCUMENT_TYPE",
    audit: "SC05",
    label: "Document type",
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Document Name", scope: "all" }],
    fields: [
      f("name", "Document Name", "text", { required: true, lang: true }),
      sel("fileTypes", "File Types", ["Images", "Documents (PDF / Word)", "Images & Documents", "Any File Type"]),
    ],
  },
  flagTemplates: {
    screen: "SYS:FLAG_TEMPLATE",
    audit: "SC06",
    label: "Flag & hold template",
    search: ["name", "code"],
    unique: [
      { key: "name", label: "Flag / Hold Name", scope: "all" },
      { key: "code", label: "Flag Code", scope: "all" },
    ],
    fields: [
      f("name", "Flag / Hold Name", "text", { required: true, section: "Flag Details" }),
      f("message", "Flag / Hold Message", "html", { section: "Flag Details" }),
      f("code", "Flag Code", "text", { section: "Flag Details" }),
      sel("status", "Template Status", ACTIVE, { section: "Flag Details" }),
      sel("flagType", "Flag Type", ["General", "Financial", "Academic", "Attendance", "Immigration"], { section: "Flag Details" }),
      sel("financialType", "Financial Flag Type", ["Late Tuition: Program Deadlines", "Late Tuition: Payment Plan Deadlines", "Outstanding Balance", "Returned Payment"], {
        section: "Financial Conditions",
        when: { key: "flagType", equals: "Financial" },
      }),
      sel("fees", "Specify Tuition / Fees", ["All Fees", "Tuition Only", "Non-Tuition Fees Only"], { section: "Financial Conditions", when: { key: "flagType", equals: "Financial" } }),
      sel("balance", "Balance Options", ["Any Owing Balance", "Balance Over $100", "Balance Over $500", "Balance Over $1,000"], { section: "Financial Conditions", when: { key: "flagType", equals: "Financial" } }),
      f("leewayDays", "Leeway Days", "number", { integer: true, min: 0, max: 365, dflt: 0, suffix: "days", section: "Financial Conditions", when: { key: "flagType", equals: "Financial" } }),
      sel("applyHold", "Apply Hold", NO_YES, { section: "Hold Details" }),
      f("studentRestrictions", "Student Restrictions", "multi", {
        options: ["Restrict / disable course registration", "Disable access to courses", "Disable reviewing of transcript", "Disable request forms"],
        section: "Hold Details",
        when: { key: "applyHold", equals: "Yes" },
      }),
      sel("registrationLimit", "Course Registration Limit", ["No Registration Allowed", "Limit to 1 Course", "Limit to 2 Courses", "Limit to 3 Courses"], {
        section: "Hold Details",
        when: { key: "applyHold", equals: "Yes" },
      }),
      f("staffRestrictions", "Staff Restrictions", "multi", {
        options: ["Restrict / disable course registration", "Disable profile changes", "Disable status changes", "Disable program changes / withdrawing", "Disable changes to transcript"],
        section: "Hold Details",
        when: { key: "applyHold", equals: "Yes" },
      }),
      dyn("campus", "Campuses", "campuses", "All Campuses", { section: "Conditions / Filters" }),
      dyn("studentStatus", "Student Status", "statuses", "All Statuses", { section: "Conditions / Filters" }),
      sel("programs", "Program(s)", ["All Programs", "Select Programs"], { section: "Conditions / Filters" }),
      f("selectPrograms", "Select Program(s)", "multiList", { dyn: "programs", required: true, section: "Conditions / Filters", when: { key: "programs", equals: "Select Programs" }, hint: "Hold Ctrl (Cmd on Mac) and click to select multiple programs." }),
      dyn("rateCategory", "Rate Category", "rateCategories", "All Rates", { section: "Conditions / Filters" }),
      dyn("country", "Countries", "countries", "All Countries", { section: "Conditions / Filters" }),
    ],
  },
  userAgreements: {
    screen: "SYS:USER_AGREEMENT",
    audit: "SC07",
    label: "User agreement",
    search: ["name"],
    unique: [{ key: "name", label: "Agreement Name", scope: "all" }],
    fields: [
      f("name", "Agreement Name", "text", { required: true, section: "User Agreement Details" }),
      f("language", "Language", "select", { dyn: "languages", dflt: "English", required: true, section: "User Agreement Details" }),
      sel("condition", "Agreement Condition", ["Required", "Optional"], { section: "User Agreement Details" }),
      sel("signature", "Agreement Signature", ["Checkbox Acknowledgement", "Typed Signature", "Drawn Signature"], { section: "User Agreement Details" }),
      sel("allowSkip", "Allow Skip Agreement", NO_YES, { section: "User Agreement Details" }),
      sel("applyCampuses", "Apply to Campuses", ["All Campuses", "Customize"], { section: "User Agreement Details" }),
      f("campuses", "Select Campus(es)", "multiList", { dyn: "campuses", required: true, section: "User Agreement Details", when: { key: "applyCampuses", equals: "Customize" } }),
      sel("applyAccess", "Apply to Access Level", ["All Access Levels", "Customize"], { section: "User Agreement Details" }),
      f("accessLevels", "Access Level", "multiList", { dyn: "accessLevels", required: true, section: "User Agreement Details", when: { key: "applyAccess", equals: "Customize" } }),
      f("prompts", "Agreement Prompts", "multi", { options: ["Upon successful login", "Upon registering for courses", "Upon accessing course content"], section: "Agreement Prompts" }),
      dyn("studentStatuses", "Student Statuses", "statuses", "All Statuses", { section: "Student Agreement Settings" }),
      dyn("program", "Program of Study", "programs", "All Programs", { section: "Student Agreement Settings" }),
      dyn("schedule", "Schedules / In-takes", "terms", "All Schedules / In-takes", { section: "Student Agreement Settings" }),
      dyn("nationality", "Nationality", "countries", "All Nationalities", { section: "Student Agreement Settings" }),
      f("completion", "Completion Percentage", "number", { min: 0, max: 100, suffix: "%", section: "Student Agreement Settings", hint: "Prompt once the student has completed this share of their program." }),
      f("content", "Agreement Content", "html", { section: "Agreement Content" }),
      f("agreementForm", "Agreement Form", "select", { dyn: "agreementForms", dynExtra: ["No Form"], dflt: "No Form", required: true, section: "Agreement Form Options" }),
    ],
  },
  agentStatuses: {
    screen: "SYS:AGENT_STATUS",
    audit: "SC08",
    label: "Agent status",
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Status Name", scope: "all" }],
    fields: [
      f("name", "Status Name", "text", { required: true, lang: true }),
      f("colour", "Status Colour", "color", { required: true, options: COLOURS, dflt: COLOURS[0] }),
      sel("statusType", "Status Type", ["Active", "Inactive", "Pending"]),
      sel("defaultStatus", "Default Status", NO_YES),
      sel("createLogin", "Create User Login", NO_YES),
    ],
  },
  studentStatuses: {
    screen: "SYS:STUDENT_STATUS",
    audit: "SC09",
    label: "Student status",
    search: ["name", "description"],
    sortable: true,
    unique: [{ key: "name", label: "Status Name", scope: "all" }],
    fields: [
      f("parent", "Parent Status", "ref", { ref: "studentStatuses", section: "Status Details", hint: "Leave empty for a top-level status." }),
      f("name", "Status Name", "text", { required: true, lang: true, section: "Status Details" }),
      f("description", "Status Description", "text", { lang: true, section: "Status Details" }),
      f("colour", "Status Colour", "color", { required: true, options: COLOURS, dflt: COLOURS[1], section: "Status Details" }),
      sel("canChangeFrom", "Can Change From", ["Any Status", "Parent / Sibling Statuses Only", "Manual Change Only"], { section: "Status Settings" }),
      sel("canChangeTo", "Can Change To", ["Any Status", "Parent / Sibling Statuses Only", "Manual Change Only"], { section: "Status Settings" }),
      sel("generateNumber", "Generate Student Number", NO_YES, { section: "Status Settings" }),
      sel("grantsAdmission", "Grants Admission", NO_YES, { section: "Status Settings" }),
      sel("enablesRegistration", "Enables Course Registration", NO_YES, { section: "Status Settings" }),
      sel("locksPlan", "Locks Program Plan — if applicable", NO_YES, { section: "Status Settings" }),
      sel("createLogin", "Create User Login", NO_YES, { section: "Status Settings" }),
      sel("transferIn", "Transfer-In Management", ["Not Applicable", "Allow Transfer-In", "Require Transfer-In Review"], { section: "Status Settings" }),
      sel("leaveOfAbsence", "Leave of Absence", NO_YES, { section: "Status Settings" }),
      sel("withdrawn", "Withdrawn From Program", NO_YES, { section: "Status Settings" }),
      sel("completes", "Completes Program", NO_YES, { section: "Status Settings" }),
      sel("automatic", "Automatic Status Changes", DIS_EN, { section: "Status Settings" }),
      sel("defaultStatus", "Default Status", NO_YES, { section: "Status Settings" }),
    ],
  },
  documentTemplates: {
    screen: "SYS:DOC_TEMPLATE",
    audit: "SC10",
    label: "Document template",
    search: ["name"],
    unique: [{ key: "name", label: "Template Name", scope: "all" }],
    fields: [
      f("name", "Template Name", "text", { required: true, section: "Document Template Details" }),
      f("language", "Language", "select", { dyn: "languages", dflt: "English", required: true, section: "Document Template Details" }),
      sel("documentType", "Document Type", ["Letter", "Certificate", "Contract", "Invoice / Receipt", "Transcript", "Report", "Other"], { section: "Document Template Details" }),
      f("defaultType", "Default Document Type", "bool", { section: "Document Template Details" }),
      f("correspondenceCategory", "Correspondence Category", "ref", { ref: "correspondenceCategories", section: "Document Template Details" }),
      f("correspondenceType", "Correspondence Type", "ref", { ref: "correspondenceTypes", section: "Document Template Details" }),
      f("content", "Document Template Content", "html", { section: "Document Template Content" }),
      sel("header", "Header", ["None", "Select Element"], { section: "Header / Footer" }),
      f("headerElement", "Header Element", "ref", { ref: "runningElements", required: true, section: "Header / Footer", when: { key: "header", equals: "Select Element" } }),
      sel("footer", "Footer", ["None", "Select Element"], { section: "Header / Footer" }),
      f("footerElement", "Footer Element", "ref", { ref: "runningElements", required: true, section: "Header / Footer", when: { key: "footer", equals: "Select Element" } }),
      sel("pageSize", "Page Size", ["Letter", "Legal", "A4", "A5"], { section: "Document Page Settings" }),
      sel("orientation", "Page Orientation", ["Portrait", "Landscape"], { section: "Document Page Settings" }),
      f("marginTop", "Top", "number", { min: 0, max: 100, dflt: 20, suffix: "mm", group: "Page Margins", sub: "Top", section: "Document Page Settings" }),
      f("marginRight", "Right", "number", { min: 0, max: 100, dflt: 20, suffix: "mm", group: "Page Margins", sub: "Right", section: "Document Page Settings" }),
      f("marginBottom", "Bottom", "number", { min: 0, max: 100, dflt: 20, suffix: "mm", group: "Page Margins", sub: "Bottom", section: "Document Page Settings" }),
      f("marginLeft", "Left", "number", { min: 0, max: 100, dflt: 20, suffix: "mm", group: "Page Margins", sub: "Left", section: "Document Page Settings" }),
      sel("watermark", "Watermark", ["None", "Draft", "Confidential", "Copy", "Void"], { section: "Document Watermark" }),
      sel("naming", "Customize Naming", ["Default Naming", "Custom Naming"], { section: "Document Naming", hint: "Default naming uses the template name, student number and date." }),
      f("namingPattern", "Naming Pattern", "text", {
        required: true,
        section: "Document Naming",
        when: { key: "naming", equals: "Custom Naming" },
        hint: "Tokens: {template} {student_number} {last_name} {first_name} {date}",
        placeholder: "{student_number}_{template}_{date}",
      }),
      f("generation", "Document Generation", "rows", {
        section: "Document Generation",
        rowLabel: "Generation Option",
        addLabel: "Add",
        columns: ["trigger", "mode", "status"],
        rowFields: [
          sel("trigger", "Generate When", ["Application Submitted", "Student Status Changes", "Program Enrolment Created", "Request Approved", "Manually Requested"]),
          f("status", "Student Status", "select", { dyn: "statuses", required: true, when: { key: "trigger", equals: "Student Status Changes" } }),
          sel("mode", "Generation Mode", ["Automatic", "Prompt Staff"]),
          sel("attach", "Attach To", ["Student Documents", "Correspondence", "E-mail Notification"]),
        ],
      }),
      f("accessLevels", "Access Levels", "select", { dyn: "accessLevels", dynExtra: ["All Access Levels"], dflt: "All Access Levels", required: true, section: "Document Security" }),
      f("secure", "Secure / Encrypt Documents Generated", "bool", { section: "Document Security" }),
    ],
  },
  templateModules: {
    screen: "SYS:TEMPLATE_MODULE",
    audit: "SC11",
    label: "Template module",
    search: ["name"],
    unique: [{ key: "name", label: "Module Name", scope: "all" }],
    fields: [
      f("name", "Module Name", "text", { required: true }),
      f("conditions", "Module Conditions", "rows", {
        rowLabel: "Condition",
        addLabel: "Add Condition",
        columns: ["programs", "statuses", "rates", "countries"],
        rowFields: [
          f("programs", "Programs", "multiList", { dyn: "programs", hint: "Leave empty for all programs." }),
          f("statuses", "Statuses", "multiList", { dyn: "statuses", hint: "Leave empty for all statuses." }),
          f("rates", "Rates", "multiList", { dyn: "rateCategories", hint: "Leave empty for all rates." }),
          f("countries", "Countries", "multiList", { dyn: "countries", hint: "Leave empty for all countries." }),
          f("content", "Content", "html", { required: true }),
        ],
      }),
    ],
  },
  documentInputs: {
    screen: "SYS:DOC_INPUT",
    audit: "SC11",
    label: "Document input",
    search: ["label", "name"],
    unique: [{ key: "name", label: "Input Name", scope: "all" }],
    fields: [
      f("label", "Label", "text", { required: true, lang: true }),
      f("name", "Name", "text", { required: true, hint: "Placeholder key, e.g. start_date — used as {input:start_date}." }),
      sel("type", "Type", ["Text", "Text Area", "Date", "Number", "Dropdown", "Checkbox"]),
      f("choices", "Dropdown Options", "textarea", { required: true, when: { key: "type", equals: "Dropdown" }, hint: "One option per line." }),
      f("default", "Default", "text"),
      sel("autoSave", "Auto-Save", NO_YES, { hint: "Remember the last value entered for each student." }),
    ],
  },
  documentFonts: {
    screen: "SYS:DOC_FONT",
    audit: "SC11",
    label: "Font",
    search: ["name"],
    unique: [{ key: "name", label: "Font Name", scope: "all" }],
    fields: [
      f("name", "Font Name", "text", { required: true }),
      sel("embedded", "Embedded", NO_YES, { hint: "Embedded fonts are packaged into every generated PDF." }),
      f("fontFile", "Font File", "file", { required: true, when: { key: "embedded", equals: "Yes" } }),
    ],
  },
  runningElements: {
    screen: "SYS:RUNNING_ELEMENT",
    audit: "SC11",
    label: "Running element",
    search: ["name"],
    unique: [{ key: "name", label: "Element Name", scope: "all" }],
    fields: [f("name", "Element Name", "text", { required: true }), sel("type", "Type", ["Header", "Footer"]), f("content", "Element Content", "html")],
  },
  notificationTemplates: {
    screen: "SYS:NOTIFICATION_TEMPLATE",
    audit: "SC36",
    label: "Notification template",
    search: ["name", "subject"],
    unique: [{ key: "name", label: "Template Name", scope: "all" }],
    fields: [
      f("name", "Template Name", "text", { required: true, section: "Notification Details" }),
      sel("event", "Send When", ["Application Submitted", "Student Status Changes", "Request Submitted", "Request Approved", "Request Declined", "Flag / Hold Applied", "Account Created", "Password Reset", "Course Registration"], {
        section: "Notification Details",
      }),
      sel("channel", "Channel", ["E-mail", "SMS", "E-mail & SMS", "In-App"], { section: "Notification Details" }),
      f("language", "Language", "select", { dyn: "languages", dflt: "English", required: true, section: "Notification Details" }),
      sel("status", "Status", ACTIVE, { section: "Notification Details" }),
      f("subject", "Subject", "text", { required: true, section: "Message", when: { key: "channel", equals: ["E-mail", "E-mail & SMS", "In-App"] } }),
      f("body", "Message", "html", { required: true, section: "Message", when: { key: "channel", equals: ["E-mail", "E-mail & SMS", "In-App"] } }),
      f("sms", "SMS Text", "textarea", { required: true, section: "Message", when: { key: "channel", equals: ["SMS", "E-mail & SMS"] }, hint: "Keep under 160 characters." }),
    ],
  },
  correspondenceCategories: {
    screen: "SYS:CORR_CATEGORY",
    audit: "SC13",
    label: "Correspondence category",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Category Name", scope: "all" }],
    fields: [
      f("name", "Category Name", "text", { required: true, lang: true, section: "Correspondence Category Details" }),
      f("description", "Description", "textarea", { section: "Correspondence Category Details" }),
      f("abbreviation", "Abbreviation", "text", { section: "Correspondence Category Details" }),
      sel("status", "Status", ACTIVE, { section: "Correspondence Category Details" }),
      sel("availableTo", "Available To", ["Staff & Faculty", "Staff Only", "Students & Staff", "Agents & Staff", "Everyone"], { section: "Correspondence Category Details" }),
      f("recordTypes", "Record Types", "dual", { options: RECORD_TYPES, section: "Select Record Types" }),
    ],
  },
  correspondenceTypes: {
    screen: "SYS:CORR_TYPE",
    audit: "SC13",
    label: "Correspondence type",
    search: ["name"],
    unique: [{ key: "name", label: "Correspondence Type Name", scope: "all" }],
    fields: [
      f("name", "Correspondence Type Name", "text", { required: true, lang: true, section: "Correspondence Type Details" }),
      f("categories", "Categories", "refMulti", { ref: "correspondenceCategories", section: "Select Categories" }),
    ],
  },
  forms: {
    screen: "SYS:FORM",
    audit: "SC14",
    label: "Form",
    search: ["name", "formType"],
    unique: [{ key: "name", label: "Form Name", scope: "all" }],
    fields: [
      f("name", "Form Name", "text", { required: true, section: "Form Details" }),
      sel("formType", "Form Type", FORM_TYPES, { section: "Form Details" }),
      sel("defaultForm", "Default Form", NO_YES, { section: "Form Details" }),
      sel("visibility", "Visibility / Access", ["Private", "Public"], { section: "Form Details" }),
      sel("saveDraft", "Save Draft", DIS_EN, { section: "Form Details" }),
      sel("sendEmail", "Send E-mail", NO_YES, { section: "Form Details" }),
      sel("agentEdit", "Agent Edit Restrictions", ["No Restrictions", "Read Only After Submission", "No Agent Editing"], { section: "Form Details" }),
      sel("payments", "Form Payments / Fees", DIS_EN, { section: "Form Details" }),
      f("feeAmount", "Form Fee", "number", { required: true, min: 0, max: 100000, suffix: "CAD", section: "Form Details", when: { key: "payments", equals: "Enabled" } }),
      f("selfStatus", "Set Student / Profile Status — Self Applications", "select", { dyn: "statuses", dynExtra: ["System Default"], dflt: "System Default", required: true, section: "Form Details" }),
      f("agentStatus", "Set Student / Profile Status — Agent Applications", "select", { dyn: "statuses", dynExtra: ["System Default"], dflt: "System Default", required: true, section: "Form Details" }),
      f("programs", "Programs", "multiList", { dyn: "programs", section: "Form Details", hint: "Leave empty to offer the form for every program. Hold Ctrl (Cmd on Mac) to select multiple." }),
      f("fields", "Form Fields", "rows", {
        section: "Form Fields",
        rowLabel: "Form Field",
        addLabel: "Add Form Field",
        columns: ["label", "type", "required"],
        rowFields: [
          f("label", "Field Label", "text", { required: true }),
          sel("type", "Field Type", ["Text", "Text Area", "E-mail", "Phone", "Date", "Number", "Dropdown", "Checkbox", "File Upload"]),
          f("choices", "Dropdown Options", "textarea", { required: true, when: { key: "type", equals: "Dropdown" }, hint: "One option per line." }),
          sel("required", "Required", NO_YES),
          f("help", "Help Text", "text"),
        ],
      }),
    ],
  },
  sections: {
    screen: "SYS:SECTION",
    audit: "SC15",
    label: "Section / intranet",
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Name / Label", scope: "all" }],
    fields: [
      sel("functionType", "Function Type", ["Managed Intranet", "Defined System Function", "External Link"]),
      f("name", "Name / Label", "text", { required: true, lang: true }),
      f("systemFunction", "Select Function", "select", { options: SYSTEM_FUNCTIONS, required: true, when: { key: "functionType", equals: "Defined System Function" } }),
      f("tabAccess", "Customize Tab Settings", "people", { when: { key: "functionType", equals: "Defined System Function" }, hint: "Users who can manage this section's tabs. Leave empty to keep the system defaults." }),
      f("url", "Link URL", "text", { required: true, when: { key: "functionType", equals: "External Link" }, placeholder: "https://" }),
      f("icon", "Navigation Icon", "icon", { options: NAV_ICONS, dflt: "folder", required: true, when: { key: "functionType", equals: ["Managed Intranet", "External Link"] } }),
      sel("defaultAccess", "Default Access", ["All Users", "Staff & Faculty", "Students", "Agents", "No Access"], { section: "Access Management", when: { key: "functionType", equals: ["Managed Intranet", "External Link"] } }),
      f("intranetAccess", "Intranet / Tab Access", "people", { section: "Access Management", when: { key: "functionType", equals: ["Managed Intranet", "External Link"] } }),
    ],
  },
  plugins: {
    screen: "SYS:PLUGIN",
    audit: "SC18",
    label: "Plug-in",
    search: ["name", "group"],
    noCreate: true,
    unique: [{ key: "name", label: "Plug-in Name", scope: "all" }],
    fields: [
      f("name", "Plug-in Name", "text", { required: true, readonly: true }),
      f("group", "Group", "text", { readonly: true }),
      f("description", "Description", "text", { readonly: true }),
      sel("status", "Status", DIS_EN),
      sel("environment", "Environment", ["Production", "Sandbox / Test"], { when: { key: "status", equals: "Enabled" } }),
      f("endpoint", "API / Site URL", "text", { required: true, when: { key: "status", equals: "Enabled" }, placeholder: "https://" }),
      f("clientId", "Client ID / Username", "text", { when: { key: "status", equals: "Enabled" } }),
      f("apiKey", "API Key / Secret", "secret", { when: { key: "status", equals: "Enabled" } }),
      f("notes", "Notes", "textarea"),
    ],
  },
  customEndpoints: {
    screen: "SYS:CUSTOM_ENDPOINT",
    audit: "SC18",
    label: "Custom endpoint",
    search: ["name", "url"],
    unique: [{ key: "name", label: "Endpoint Name", scope: "all" }],
    fields: [
      f("name", "Endpoint Name", "text", { required: true }),
      sel("method", "Method", ["POST", "GET", "PUT", "PATCH", "DELETE"]),
      f("url", "Endpoint URL", "text", { required: true, placeholder: "https://" }),
      sel("authType", "Authentication", ["None", "API Key Header", "Bearer Token", "Basic Auth"]),
      f("credential", "Credential", "secret", { when: { key: "authType", equals: "None", not: true } }),
      sel("format", "Payload Format", ["JSON", "Form Data", "XML"]),
      sel("trigger", "Send When", ["Student Status Changes", "Application Submitted", "Payment Received", "Course Registration", "Manual Only"]),
      sel("status", "Status", DIS_EN),
    ],
  },
  reasonCodes: {
    screen: "SYS:REASON_CODE",
    audit: "SC19",
    label: "Reason code",
    search: ["name", "code"],
    unique: [
      { key: "name", label: "Reason Name", scope: "all" },
      { key: "code", label: "Reason Code", scope: "all" },
    ],
    fields: [
      f("name", "Reason Name", "text", { required: true, lang: true }),
      f("code", "Reason Code", "text", { required: true }),
      f("type", "Reason Type", "select", { options: ["Withdrawal", "Refund", "Leave of Absence", "Status Change", "Fee Adjustment", "Course Drop", "Dismissal"], required: true, placeholder: "Select Reason Type" }),
      sel("active", "Active / Inactive", ACTIVE),
    ],
  },
  holidays: {
    screen: "SYS:HOLIDAY",
    audit: "SC20",
    label: "Holiday / closure",
    search: ["name"],
    unique: [],
    fields: [
      f("name", "Holiday / Closure Name", "text", { required: true, lang: true }),
      sel("type", "Type", ["Holiday", "Closure", "Break"]),
      sel("scope", "National / Provincial", ["National", "Provincial"]),
      f("province", "Province / Territory", "select", { dyn: "provinces", required: true, when: { key: "scope", equals: "Provincial" } }),
      f("singleDay", "Single day holiday / closure.", "bool", { dflt: true }),
      f("date", "Holiday / Closure Date", "date", { required: true }),
      f("endDate", "End Date", "date", { required: true, when: { key: "singleDay", equals: false } }),
      f("adjustSchedules", "Adjust existing schedules", "bool", { hint: "Flags scheduled class sessions on these dates for rescheduling." }),
    ],
  },
  emailFilters: {
    screen: "SYS:EMAIL_FILTER",
    audit: "SC22",
    label: "E-mail filter",
    search: ["name", "content", "type"],
    unique: [{ key: "name", label: "Filter Name", scope: "all" }],
    fields: [
      f("name", "Filter Name", "text", { required: true }),
      sel("type", "Filter Type", ["Block Sender", "Mark as Spam", "Forward To Address", "Deliver To Department"]),
      sel("applyTo", "Apply Rule To", ["Sender Address", "Recipient Address", "Subject", "Message Body"]),
      f("content", "Filter Content", "text", { required: true, hint: "Use * to match all addresses." }),
      f("forwardTo", "Forward To", "email", { required: true, when: { key: "type", equals: "Forward To Address" } }),
      f("department", "Department", "ref", { ref: "emailDepartments", required: true, when: { key: "type", equals: "Deliver To Department" } }),
    ],
  },
  emailDepartments: {
    screen: "SYS:EMAIL_DEPARTMENT",
    audit: "SC22",
    label: "E-mail department",
    search: ["name"],
    unique: [{ key: "name", label: "Department Name", scope: "all" }],
    fields: [
      f("name", "Department Name", "text", { required: true }),
      f("users", "Department Users", "people", { placeholder: "Start typing a staff name" }),
      sel("access", "Access", ["All Staff/Faculty", "Department Users Only", "Administrators Only"]),
    ],
  },
  mailMergeTemplates: {
    screen: "SYS:MAIL_MERGE",
    audit: "SC22",
    label: "Mail merge template",
    search: ["name"],
    unique: [{ key: "name", label: "Template Name", scope: "all" }],
    fields: [
      f("name", "Template Name", "text", { required: true }),
      f("language", "Language", "select", { dyn: "languages", dflt: "English", required: true }),
      f("content", "Template Content", "html", { required: true }),
      sel("access", "Access", ["All Staff/Faculty", "Only Me", "Administrators Only"], { section: "Template Access" }),
    ],
  },
  smsProviders: {
    screen: "SYS:SMS_PROVIDER",
    audit: "SC23",
    label: "SMS provider",
    search: ["name", "domain"],
    unique: [
      { key: "name", label: "Provider Name", scope: "all" },
      { key: "domain", label: "Provider Domain", scope: "all" },
    ],
    fields: [f("name", "Provider Name", "text", { required: true }), f("domain", "Provider Domain", "domain", { required: true })],
  },
  whitelist: {
    screen: "SYS:WHITELIST",
    audit: "SC23",
    label: "Whitelisted e-mail",
    search: ["email"],
    unique: [{ key: "email", label: "E-mail Address", scope: "all" }],
    fields: [f("email", "E-mail Address", "email", { required: true })],
  },
  blockedUsers: {
    screen: "SYS:BLOCKED_USER",
    audit: "SC23",
    label: "Blocked user",
    search: ["_userLabel"],
    unique: [{ key: "user", label: "User", scope: "all" }],
    fields: [f("user", "User to Block", "person", { required: true, placeholder: "Start typing a first or last name" })],
  },
  bounces: {
    screen: "SYS:BOUNCE",
    audit: "SC23",
    label: "Bounce / complaint",
    search: ["email", "context"],
    noCreate: true,
    unique: [],
    fields: [
      f("email", "E-mail Address", "email", { required: true, readonly: true }),
      f("type", "Type", "select", { options: ["Bounced", "Complaint"], required: true, readonly: true }),
      f("context", "Context", "text", { readonly: true }),
      f("stamp", "Date Stamp", "text", { readonly: true }),
    ],
  },
  securityCategories: {
    screen: "SYS:SEC_CATEGORY",
    audit: "SC27",
    label: "Question category",
    search: ["name"],
    unique: [{ key: "name", label: "Category Name", scope: "all" }],
    fields: [f("name", "Category Name", "text", { required: true, lang: true })],
  },
  securityQuestions: {
    screen: "SYS:SEC_QUESTION",
    audit: "SC27",
    label: "Security question",
    search: ["question"],
    unique: [{ key: "question", label: "Question", scope: "all" }],
    fields: [f("question", "Question", "text", { required: true, lang: true }), f("category", "Category", "ref", { ref: "securityCategories", required: true })],
  },
  accessOutcomes: {
    screen: "SYS:ACCESS_OUTCOME",
    audit: "SC28",
    label: "Access outcome",
    search: ["campus", "outcomeType"],
    unique: [],
    fields: [
      f("campus", "Campus / Building", "select", { dyn: "campuses", required: true, section: "Access Outcome Details" }),
      sel("outcomeType", "Outcome Type", ["Access Granted", "Access Denied", "Warning", "Requires Review"], { section: "Access Outcome Details" }),
      f("icon", "Outcome Icon", "radio", { options: OUTCOME_ICONS, dflt: "Green Check", required: true, section: "Access Outcome Details" }),
      f("customIcon", "Custom Icon", "file", { required: true, section: "Access Outcome Details", when: { key: "icon", equals: "Custom" } }),
      sel("profilePhoto", "Profile Photo", ["Show", "Hide"], { section: "Access Outcome Details" }),
      f("resultsText", "Results Text", "html", { section: "Access Outcome Details" }),
      dyn("program", "Program Filter", "programs", "All Programs", { section: "Access Outcome Filters" }),
      dyn("status", "Status Filter", "statuses", "All Statuses", { section: "Access Outcome Filters" }),
      dyn("accessLevel", "Access Level Filter", "accessLevels", "All Access Levels", { section: "Access Outcome Filters" }),
      sel("flags", "Flags Filter", ["Any Flags", "No Active Flags", "Has Active Flags", "Has Active Holds"], { section: "Access Outcome Filters" }),
      sel("dailyActivity", "Daily Activity", ["Any Activity", "Has Class Today", "No Class Today"], { section: "Access Outcome Filters" }),
      sel("instructorStatus", "Instructor Status", ["Any", "Is an Instructor", "Is Not an Instructor"], { section: "Access Outcome Filters" }),
      sel("hasPhoto", "Has Photo", ["Any", "Yes", "No"], { section: "Access Outcome Filters" }),
    ],
  },
  serviceAccounts: {
    screen: "SYS:SERVICE_ACCOUNT",
    audit: "SC30",
    label: "Service account",
    search: ["name", "login"],
    unique: [
      { key: "name", label: "Account Name", scope: "all" },
      { key: "login", label: "Account Login", scope: "all" },
    ],
    fields: [
      f("name", "Account Name", "text", { required: true, section: "Service Account Details" }),
      f("timezone", "Account Time Zone", "select", { dyn: "timezones", dflt: "America/Vancouver", required: true, section: "Service Account Details" }),
      f("login", "Account Login", "text", { required: true, section: "Service Account Details" }),
      f("password", "Account Password", "password", { required: true, confirm: true, section: "Service Account Details" }),
      sel("serviceType", "Service Type", ["API Integration", "LMS Synchronization", "Payment Webhooks", "Reporting Export", "Directory Synchronization"], { section: "Service Account Functions" }),
    ],
  },
  countries: {
    screen: "SYS:COUNTRY",
    audit: "SC32",
    label: "Country",
    search: ["name", "code", "iso"],
    unique: [
      { key: "name", label: "Country Name", scope: "all" },
      { key: "code", label: "Country Code", scope: "all" },
    ],
    fields: [
      f("name", "Country Name", "text", { required: true, lang: true }),
      f("code", "Country Code", "text", { required: true, hint: "Two-letter code, e.g. CA" }),
      f("iso", "Country ISO", "text", { required: true, hint: "Three-letter ISO code, e.g. CAN" }),
      f("currency", "Currency", "ref", { ref: "currencies" }),
    ],
  },
  countryRegions: {
    screen: "SYS:COUNTRY_REGION",
    audit: "SC32",
    label: "Region",
    parent: { entity: "countries", label: "Country" },
    search: ["name", "code"],
    unique: [{ key: "name", label: "Region Name", scope: "parent" }],
    fields: [f("name", "Region Name", "text", { required: true, lang: true }), f("code", "Region Code", "text")],
  },
  languages: {
    screen: "SYS:LANGUAGE",
    audit: "SC31",
    label: "Language",
    search: ["name", "code", "displayName"],
    unique: [
      { key: "name", label: "Language Name", scope: "all" },
      { key: "code", label: "Language Code", scope: "all" },
    ],
    fields: [
      f("name", "Language Name", "text", { required: true }),
      f("code", "Language Code", "text", { required: true, hint: "e.g. en, fr, pa" }),
      f("displayName", "Display Name", "text", { required: true, hint: "How the language is shown to users, e.g. Français" }),
      sel("status", "Status", ACTIVE),
    ],
  },
  currencies: {
    screen: "SYS:CURRENCY",
    audit: "SC33",
    label: "Currency",
    search: ["name", "code", "iso"],
    unique: [
      { key: "name", label: "Currency Name", scope: "all" },
      { key: "code", label: "Currency Code", scope: "all" },
    ],
    fields: [
      f("name", "Currency Name", "text", { required: true }),
      f("code", "Currency Code", "text", { required: true, hint: "e.g. CAD" }),
      f("iso", "Currency ISO", "text", { required: true, hint: "Numeric ISO 4217 code, e.g. 124" }),
      f("unicode", "Currency Unicode", "text", { hint: "Required for symbol — hex code point, e.g. 0024 for $" }),
      sel("symbolPosition", "Symbol Position", ["Use localization settings", "Before Amount", "After Amount"]),
      sel("active", "Active", YES_NO),
    ],
  },
  timezones: {
    screen: "SYS:TIMEZONE",
    audit: "SC34",
    label: "Time zone",
    search: ["name", "zone"],
    sortable: true,
    unique: [
      { key: "name", label: "Time Zone Name", scope: "all" },
      { key: "zone", label: "Time Zone", scope: "all" },
    ],
    fields: [f("name", "Time Zone Name", "text", { required: true, lang: true }), f("zone", "Time Zone", "text", { required: true, lang: true, hint: "IANA identifier, e.g. America/Vancouver" })],
  },
};

export const ENTITIES: Record<EntityKey, EntityDef> = { ...SYS_ENTITIES, ...FIN_ENTITIES };

/* ------------------------------------------------------------------ */
/* Settings pages (one record each)                                     */
/* ------------------------------------------------------------------ */

export type SettingsKey = "global" | "emailGeneral" | "session" | "password" | "mfa" | "localization" | "dashboard" | "loginPage" | "siteTemplate";

const time = (key: string, label: string, dflt: string, section: string, extra: Partial<Field> = {}): Field => f(key, label, "time", { dflt, required: true, section, ...extra });
const show = (key: string, label: string, dflt: "Show" | "Hide" = "Show"): Field => sel(key, label, dflt === "Show" ? SHOW_HIDE : ["Hide", "Show"], { section: "Student List Settings" });
const filt = (key: string, label: string): Field => sel(key, label, EN_DIS, { section: "Student List Filters" });
const keep = (key: string, label: string, dflt = "Keep Forever"): Field => sel(key, label, [dflt, ...RETENTION.filter((r) => r !== dflt)], { section: "Archive, Data Retention & Optimization" });

export const SETTINGS: Record<SettingsKey, { label: string; audit: string; save: string; fields: Field[] }> = {
  global: {
    label: "Global Settings",
    audit: "SC17",
    save: "Save Global Settings",
    fields: [
      f("droppedGrade", "Standard Dropped Grade", "text", { dflt: "W", required: true, section: "Course Delivery / Academic Settings" }),
      f("inProgressGrade", "Standard In Progress Grade", "text", { dflt: "IP", required: true, section: "Course Delivery / Academic Settings" }),
      f("dropLeeway", "Conditional Drop Leeway", "number", { integer: true, min: 0, max: 365, dflt: 14, suffix: "days", section: "Course Delivery / Academic Settings" }),
      f("removeIncomplete", "Remove Incomplete", "number", { integer: true, min: 0, max: 3650, dflt: 90, suffix: "days", section: "Application Settings", hint: "Incomplete applications older than this are removed. 0 keeps them." }),
      show("showPhoto", "Show Photo"),
      show("showProgram", "Show Program"),
      show("showAdvisor", "Show Advisor"),
      show("showAgent", "Show Agent"),
      show("showProgramTerm", "Show Program Term", "Hide"),
      show("showAdmissionTerm", "Show Admission Term"),
      show("showStartDate", "Show Start Date"),
      show("showEndDate", "Show End Date", "Hide"),
      show("showRecordDate", "Show Record Date", "Hide"),
      show("showNationality", "Show Nationality"),
      filt("programFilter", "Program Filter"),
      filt("pathwayFilter", "Pathway Filter"),
      filt("scheduleFilter", "Schedule Filter"),
      filt("programTermFilter", "Program Term Filter"),
      filt("admissionTermFilter", "Admission Term Filter"),
      filt("nationalityFilter", "Nationality Filter"),
      filt("agentFilter", "Agent Filter"),
      filt("advisorFilter", "Advisor Filter"),
      filt("dateFilters", "Date Filters"),
      sel("dateFilterSettings", "Date Filter Settings", ["Record Date", "Start Date", "End Date", "Admission Date"], { section: "Student List Filters" }),
      f("agentPrefix", "Agent Number Prefix", "text", { dflt: "AG", section: "Agent Creation Settings" }),
      sel("financialProfiles", "Financial Profiles", ["Combined all brands", "Separate per brand"], { section: "Brand & Security Defaults" }),
      sel("workflows", "Workflows", ["Combined all brands", "Separate per brand"], { section: "Brand & Security Defaults" }),
      sel("captcha", "Default Captcha", ["Disabled", "Google reCAPTCHA v2", "Google reCAPTCHA v3"], { section: "Brand & Security Defaults" }),
      time("morningBoundary", "Morning Boundary Time", "12:00", "Scheduling Settings"),
      time("morningDefault", "Morning Default Time", "09:00", "Scheduling Settings"),
      time("afternoonBoundary", "Afternoon Boundary Time", "17:00", "Scheduling Settings"),
      time("afternoonDefault", "Afternoon Default Time", "13:00", "Scheduling Settings"),
      time("eveningBoundary", "Evening Boundary Time", "23:00", "Scheduling Settings"),
      time("eveningDefault", "Evening Default Time", "18:00", "Scheduling Settings"),
      keep("keepAttachments", "E-mail Attachments", "2 Years"),
      keep("keepCourseFiles", "Course Files"),
      keep("keepArchived", "Archived Data", "5 Years"),
      keep("keepAccessLogs", "Access Logs", "1 Year"),
      keep("keepReports", "Generated Reports", "90 Days"),
      keep("keepMoodle", "Moodle Manual Backups", "6 Months"),
      keep("keepExports", "Bulk Exports / Files", "30 Days"),
      sel("optimizeInterval", "Optimize Database Tables", ["Weekly", "Daily", "Monthly", "Never"], { section: "Archive, Data Retention & Optimization" }),
      time("taskFlags", "Auto-Initiate Flags / Deadlines", "06:00", "Scheduled Daily Tasks", { suffix: "UTC" }),
      time("taskDormant", "Dormant Students", "06:30", "Scheduled Daily Tasks", { suffix: "UTC" }),
      time("taskNotifications", "System Notifications", "07:00", "Scheduled Daily Tasks", { suffix: "UTC" }),
      time("taskEvaluations", "Auto-Assign Evaluations", "07:30", "Scheduled Daily Tasks", { suffix: "UTC" }),
      time("taskCaches", "Build Caches", "08:00", "Scheduled Daily Tasks", { suffix: "UTC" }),
      time("taskOptimize", "Optimize Database Tables", "09:00", "Scheduled Daily Tasks", { suffix: "UTC" }),
    ],
  },
  emailGeneral: {
    label: "E-mail General Settings",
    audit: "SC21",
    save: "Save General Settings",
    fields: [
      sel("truncateHandles", "Truncate E-mail Handles", NO_YES, { section: "Default E-mail System Settings" }),
      sel("setup", "E-mail Setup", ["Internal Mailbox", "Forward to Personal E-mail", "Internal Mailbox + Forwarding"], { section: "Default E-mail System Settings" }),
      sel("integrations", "Integrations E-mail", DIS_EN, { section: "Default E-mail System Settings" }),
      sel("loginReservation", "Login Reservation", DIS_EN, { section: "Default E-mail System Settings" }),
      sel("redirect", "Redirect After Sending", ["Inbox", "Sent Items", "Stay on Message"], { section: "Default E-mail System Settings" }),
      sel("spellCheck", "Spell Check Default", EN_DIS, { section: "Default E-mail System Settings" }),
      sel("showStudentNumbers", "Show Student Numbers", YES_NO, { section: "Default E-mail System Settings" }),
      sel("showClassmates", "Show Past Classmates", NO_YES, { section: "Default E-mail System Settings" }),
      sel("showInstructors", "Show Past Instructors", NO_YES, { section: "Default E-mail System Settings" }),
      f("removeDeleted", "Remove Deleted E-mails", "number", { integer: true, min: 0, max: 3650, dflt: 30, suffix: "days", section: "Default E-mail System Settings" }),
      f("spamScore", "Spam Score Threshold", "number", { min: 0, max: 100, dflt: 5, section: "E-mail Thresholds & Security" }),
      f("removeSpam", "Remove Spam E-mails", "number", { integer: true, min: 0, max: 3650, dflt: 14, suffix: "days", section: "E-mail Thresholds & Security" }),
      f("bulkRate", "Bulk E-mail Rate Limit", "number", { integer: true, min: 1, max: 10000, dflt: 60, suffix: "e-mails per minute", section: "E-mail Thresholds & Security" }),
      sel("perSecond", "Outgoing Rate Limits", ["14", "1", "2", "5", "10", "25"], { suffix: "e-mails per second", section: "E-mail Thresholds & Security" }),
      sel("perMinute", "Outgoing Rate Limits", ["840", "60", "120", "300", "600"], { suffix: "e-mails per minute", section: "E-mail Thresholds & Security" }),
      sel("maxRecipients", "Maximum Recipients", ["100", "25", "50", "250", "500", "1000"], { suffix: "excluding cohort e-mails", section: "E-mail Thresholds & Security" }),
    ],
  },
  session: {
    label: "Login Session Settings",
    audit: "SC24",
    save: "Save Session Settings",
    fields: [
      sel("expiry", "Session Expiry", ["Until browser is closed", "30 minutes of inactivity", "1 hour of inactivity", "4 hours of inactivity", "5 hours of inactivity", "8 hours of inactivity", "24 hours of inactivity"]),
      f("keepLoggedIn", "Enable “Keep me logged in” option", "bool", { dflt: true }),
      sel("deviceRegistration", "Device Registration", DIS_EN),
      sel("ipAuthentication", "IP Authentication", DIS_EN),
      f("allowedIps", "Allowed IP Addresses", "textarea", { required: true, when: { key: "ipAuthentication", equals: "Enabled" }, hint: "One IPv4 address or CIDR range per line, e.g. 203.0.113.0/24" }),
    ],
  },
  password: {
    label: "Password Policies & Recovery",
    audit: "SC25",
    save: "Save Password Settings",
    fields: [
      f("minLength", "Minimum Length", "number", { integer: true, min: 6, max: 64, dflt: 10, suffix: "characters", required: true, section: "Password Policy" }),
      sel("upper", "Uppercase Letter Required", NO_YES, { section: "Password Policy" }),
      sel("lower", "Lowercase Letter Required", NO_YES, { section: "Password Policy" }),
      sel("number", "Number Required", NO_YES, { section: "Password Policy" }),
      sel("symbol", "Symbol Required", NO_YES, { section: "Password Policy" }),
      sel("nameMatching", "Name / Login Matching", ["Allowed", "Not Allowed"], { section: "Password Policy" }),
      sel("recycling", "Password Recycling", ["Allowed", "Not Last 3 Passwords", "Not Last 5 Passwords", "Not Last 10 Passwords"], { section: "Password Policy" }),
      sel("expiry", "Password Expiry", ["Never", "90 Days", "180 Days", "1 Year"], { section: "Password Policy" }),
      sel("enforce", "Enforce Password Policy", ["On Next Password Change", "Disabled"], { section: "Password Policy" }),
      sel("forgotStudents", "Students", EN_DIS, { section: "Password Recovery / Forgotten Passwords", group: "Enable Forgot Password", sub: "Students" }),
      sel("forgotAgents", "Agents", EN_DIS, { section: "Password Recovery / Forgotten Passwords", group: "Enable Forgot Password", sub: "Agents" }),
      sel("forgotGuests", "Guests", EN_DIS, { section: "Password Recovery / Forgotten Passwords", group: "Enable Forgot Password", sub: "Guests" }),
      sel("forgotFaculty", "Faculty", EN_DIS, { section: "Password Recovery / Forgotten Passwords", group: "Enable Forgot Password", sub: "Faculty" }),
      sel("forgotStaff", "Staff", EN_DIS, { section: "Password Recovery / Forgotten Passwords", group: "Enable Forgot Password", sub: "Staff" }),
      sel("recoverySecurity", "Recovery Security", ["E-mail Link Only", "Security Questions + E-mail Link", "Security Questions Only"], { section: "Password Recovery / Forgotten Passwords" }),
      sel("recoveryEmail", "Recovery E-mail", ["Primary E-mail", "Secondary E-mail", "Primary & Secondary E-mail"], { section: "Password Recovery / Forgotten Passwords" }),
    ],
  },
  mfa: {
    label: "Multi-Factor Authentication",
    audit: "SC26",
    save: "Save Authentication Settings",
    fields: [
      sel("pins", "User PINs", DIS_EN, { section: "Authentication Methods" }),
      sel("email", "E-mail Authentication", DIS_EN, { section: "Authentication Methods" }),
      sel("text", "Text Authentication", DIS_EN, { section: "Authentication Methods" }),
      sel("app", "Mobile App Authentication", DIS_EN, { section: "Authentication Methods" }),
      sel("frequency", "Prompt Frequency", ["Every Login", "New Device Only", "Every 7 Days", "Every 30 Days"], { section: "Authentication Settings" }),
      sel("codeLength", "Security Code Length", ["6 Digits", "4 Digits", "8 Digits"], { section: "Authentication Settings" }),
      sel("codeExpiry", "Security Code Expiry", ["10 Minutes", "5 Minutes", "15 Minutes", "30 Minutes"], { section: "Authentication Settings" }),
      f("exempt", "Exempt Users", "people", { section: "Authentication Over-rides", placeholder: "Start typing a user name" }),
    ],
  },
  localization: {
    label: "Localization General Settings",
    audit: "SC31",
    save: "Save General Settings",
    fields: [f("defaultLanguage", "Default Language", "ref", { ref: "languages", required: true }), f("defaultCurrency", "Default Currency", "ref", { ref: "currencies", required: true })],
  },
  dashboard: {
    label: "Dashboard Settings",
    audit: "SC16",
    save: "Save Front Page Settings",
    fields: [
      sel("layout", "Page Layout", ["Full Screen", "Two Columns", "Three Columns"]),
      f("managementAccess", "Page Management Access", "people", { placeholder: "Start typing a user name", hint: "These users can edit the dashboard front page." }),
    ],
  },
  loginPage: {
    label: "Login Page Settings",
    audit: "SC16",
    save: "Save Login Page",
    fields: [
      f("background", "Page Background Colour", "color", { dflt: "#1f3a5f", required: true, section: "Login Page Settings" }),
      f("backgroundImagery", "Background Imagery", "radio", { options: ["None", "Education", "Math Equation", "Custom"], dflt: "None", required: true, section: "Login Page Settings" }),
      f("backgroundFile", "Custom Background Image", "file", { required: true, section: "Login Page Settings", when: { key: "backgroundImagery", equals: "Custom" } }),
      f("actionImagery", "Action Imagery", "radio", { options: ["None", "Green Apple", "Red Apple", "MySIS Sequence", "Custom"], dflt: "None", required: true, section: "Login Page Settings" }),
      f("actionFile", "Custom Action Image", "file", { required: true, section: "Login Page Settings", when: { key: "actionImagery", equals: "Custom" } }),
      f("blocks", "Content Blocks", "rows", {
        section: "Content Blocks",
        rowLabel: "Content Block",
        addLabel: "Add Content",
        rowSave: "Save Content",
        columns: ["referenceName", "page", "placement", "status"],
        rowFields: [
          f("referenceName", "Reference Name", "text", { required: true }),
          sel("page", "Page", ["Login Page", "Forgot Password Page", "Registration Page"]),
          sel("placement", "Placement", ["Above Login Form", "Below Login Form", "Left Panel", "Right Panel"]),
          sel("status", "Status", ACTIVE),
          f("content", "Content", "html", { required: true }),
        ],
      }),
    ],
  },
  siteTemplate: {
    label: "Site Template / Header Settings",
    audit: "SC16",
    save: "Save Template / Header Settings",
    fields: [
      f("headerBlocks", "Header Source Blocks", "rows", {
        rowLabel: "Header Content Block",
        addLabel: "Add Header Content",
        rowSave: "Save Content",
        columns: ["referenceName", "status"],
        rowFields: [
          f("referenceName", "Content Reference Name", "text", { required: true }),
          f("source", "Source Content", "code", { required: true, hint: "HTML / CSS / script snippet inserted into the site header." }),
          sel("status", "Content Status", ACTIVE),
          sel("publicVisibility", "Public Page Visibility", ["Hidden", "Visible"]),
          sel("timeframe", "Available Timeframe", ["Immediately", "Date Range"]),
          f("startDate", "Available From", "date", { required: true, when: { key: "timeframe", equals: "Date Range" } }),
          f("endDate", "Available Until", "date", { required: true, when: { key: "timeframe", equals: "Date Range" } }),
          sel("access", "Content Access", ["Everyone", "Staff & Faculty", "Students", "Agents", "Guests"]),
        ],
      }),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Captured seed data                                                   */
/* ------------------------------------------------------------------ */

export const SEED_STUDENT_STATUSES: Array<{ name: string; colour: string; children?: string[]; extra?: Data }> = [
  { name: "New Inquiry", colour: "#1565c0", extra: { defaultStatus: "Yes" } },
  { name: "Approved Application", colour: "#2e7d32", extra: { grantsAdmission: "Yes" } },
  { name: "Pre-enrolment Application", colour: "#00838f", children: ["CLOA", "LOA", "Cancelled / Did not proceed", "Follow Up", "In-active Leads", "Duplicate profiles"] },
  { name: "Declined Application", colour: "#c62828" },
  { name: "Registered Student", colour: "#6a1b9a", extra: { generateNumber: "Yes", createLogin: "Yes" } },
  { name: "Active Student", colour: "#2e7d32", children: ["On-Hold", "Leave of Absence"], extra: { enablesRegistration: "Yes", createLogin: "Yes" } },
  { name: "Graduated", colour: "#f9a825", extra: { completes: "Yes", locksPlan: "Yes" } },
  { name: "Incomplete", colour: "#ef6c00" },
  { name: "Withdrawn Students", colour: "#795548", extra: { withdrawn: "Yes" } },
  { name: "Dismissed", colour: "#c62828", extra: { withdrawn: "Yes" } },
  { name: "Refused Visa", colour: "#ad1457" },
  { name: "File not Logged (Offshore student)", colour: "#9e9e9e" },
  { name: "Prospective Student (Marketing team)", colour: "#455a64" },
];

export const SEED_PLUGINS: Array<{ group: string; names: string[]; describe: string }> = [
  { group: "Profile Integrations", names: ["Hubspot", "SalesForce"], describe: "Synchronize leads and student profiles with the CRM." },
  { group: "User Integrations", names: ["Active Directory", "Microsoft365", "PaperCut"], describe: "Provision user accounts and single sign-on." },
  {
    group: "Payment Processing",
    names: ["Authorize.net", "Chase Paytech", "CIBC Student Pay", "Converge", "Flywire", "Helcim", "Moneris eSelect Plus", "PayMyTuition", "PayPal Payments Pro", "Payroc", "Recurly", "Worldline"],
    describe: "Accept online tuition and fee payments.",
  },
  { group: "LMS", names: ["Brightspace", "Canvas", "Moodle"], describe: "Synchronize course shells, enrolments and grades." },
  { group: "Library Resources", names: ["EZProxy", "OpenAthens"], describe: "Authenticate students for library e-resources." },
  { group: "Miscellaneous", names: ["Circle", "Coursedog", "Google Captcha", "Interfolio", "QuickBooks"], describe: "Additional third-party services." },
];

export const SEED_SECURITY_QUESTIONS: Record<string, string[]> = {
  "Security Question 1": ["What was the street name where you first lived?", "What was your dream job as a child?", "Where was your first family vacation?", "Which city did you go to highschool?"],
  "Security Question 2": ["What is your father’s middle name?", "What is your grandfather’s name?", "What is your mother’s maiden name?", "What was the name of your first pet?"],
  "Security Question 3": ["What is your favourite animal?", "What is your favourite movie?", "What is your favourite sports team?", "Who was your favourite teacher?"],
};

export const SEED_FORMS: Array<[string, string, string?]> = [
  ["General Agent Form", "Agent Details Form"],
  ["General Inquiry Form", "Lead / Inquiry Form", "Public"],
  ["Leave of Absence Application", "Request Form"],
  ["Leave Request", "Student Break Form"],
  ["Media Release Form", "Agreement Form"],
  ["Prior Learning Institutions", "External Institution Form"],
  ["Request to Update Personal Details", "Request Form"],
  ["Student Activity Form", "Requirement / Workflow Form"],
  ["Student Enrollment Contract", "Agreement Form"],
  ["Student Profile / Application — Default", "Application / Profile Form", "Public"],
  ["Withdraw", "Request Form"],
];

export const SEED_SECTIONS = SYSTEM_FUNCTIONS;

export const SEED_CORRESPONDENCE: Record<string, string[]> = {
  "Admissions Documents": ["Letter of Acceptance", "Conditional Letter of Acceptance", "Application Form"],
  "LOA and Fees Receipt": ["Fees Receipt", "Payment Plan Agreement"],
  "Permits and PPR": ["Study Permit", "Passport Request (PPR)", "Work Permit"],
  "Scanned Documents": ["Passport Copy", "Prior Transcripts", "Photo ID"],
  "TRANSCRIPT RECORD": ["Official Transcript", "Unofficial Transcript"],
};
export const SEED_CORRESPONDENCE_MISC = ["General Correspondence", "Phone Call Note"];

export const SEED_DOCUMENT_INPUTS: Array<[string, string, string]> = [
  ["CAQ", "caq", "Text"],
  ["Completion Date", "completion_date", "Date"],
  ["Condition", "condition", "Text Area"],
  ["Conditions of acceptance", "conditions_of_acceptance", "Text Area"],
  ["Field of Work", "field_of_work", "Text"],
  ["Hours of Instruction Per Week", "hours_per_week", "Number"],
  ["Program Date", "program_date", "Date"],
  ["Relevant Information", "relevant_information", "Text Area"],
  ["Start Date", "start_date", "Date"],
  ["Year of Study", "year_of_study", "Text"],
];

export const SEED_RUNNING_ELEMENTS: Array<[string, "Header" | "Footer", string]> = [
  ["Header for Templates", "Header", "<p style=\"text-align: center\"><strong>Heritage Community College</strong></p>"],
  ["Footer for Templates", "Footer", "<p style=\"text-align: center\">Heritage Community College · www.myhccbc.com</p>"],
  ["HCA Header", "Header", "<p style=\"text-align: center\"><strong>Health Care Assistant Program</strong></p>"],
  ["HCA Footer", "Footer", "<p style=\"text-align: center\">HCA Program Office · Heritage Community College</p>"],
  ["Standard Header", "Header", "<p><strong>Heritage College</strong> — Office of the Registrar</p>"],
  ["Standard Footer", "Footer", "<p>This document was generated by MyHeritage SIS.</p>"],
];

export const SEED_HOLIDAYS_2026: Array<[string, string, string?, string?]> = [
  ["New Year's Day", "2026-01-01"],
  ["Family Day", "2026-02-16", undefined, "British Columbia"],
  ["Good Friday", "2026-04-03"],
  ["Victoria Day", "2026-05-18"],
  ["Canada Day", "2026-07-01"],
  ["British Columbia Day", "2026-08-03", undefined, "British Columbia"],
  ["Labour Day", "2026-09-07"],
  ["National Day for Truth and Reconciliation", "2026-09-30"],
  ["Thanksgiving Day", "2026-10-12"],
  ["Remembrance Day", "2026-11-11"],
  ["Christmas Day", "2026-12-25"],
  ["Winter break", "2026-12-21", "2027-01-01"],
];

export const SEED_LANGUAGES: Array<[string, string, string]> = [
  ["English", "en", "English"],
  ["French", "fr", "Français"],
  ["Spanish", "es", "Español"],
  ["Punjabi", "pa", "ਪੰਜਾਬੀ"],
  ["Hindi", "hi", "हिन्दी"],
  ["Mandarin Chinese", "zh", "中文"],
];

export const SEED_CURRENCIES: Array<[string, string, string, string]> = [
  ["Afghanistan Afghani", "AFN", "971", "060B"],
  ["Canadian Dollar", "CAD", "124", "0024"],
  ["US Dollar", "USD", "840", "0024"],
  ["Euro", "EUR", "978", "20AC"],
  ["British Pound", "GBP", "826", "00A3"],
  ["Indian Rupee", "INR", "356", "20B9"],
  ["Philippine Peso", "PHP", "608", "20B1"],
  ["Chinese Yuan", "CNY", "156", "00A5"],
];

export const SEED_COUNTRIES: Array<{ name: string; code: string; iso: string; currency?: string; regions?: Array<[string, string]> }> = [
  { name: "Afghanistan", code: "AF", iso: "AFG", currency: "AFN", regions: [["Badakhshan", "BDS"], ["Badghis", "BDG"], ["Baghlan", "BGL"], ["Balkh", "BAL"], ["Kabul", "KAB"], ["Kandahar", "KAN"], ["Herat", "HER"]] },
  { name: "Brazil", code: "BR", iso: "BRA" },
  {
    name: "Canada",
    code: "CA",
    iso: "CAN",
    currency: "CAD",
    regions: [
      ["Alberta", "AB"],
      ["British Columbia", "BC"],
      ["Manitoba", "MB"],
      ["New Brunswick", "NB"],
      ["Newfoundland and Labrador", "NL"],
      ["Northwest Territories", "NT"],
      ["Nova Scotia", "NS"],
      ["Nunavut", "NU"],
      ["Ontario", "ON"],
      ["Prince Edward Island", "PE"],
      ["Quebec", "QC"],
      ["Saskatchewan", "SK"],
      ["Yukon", "YT"],
    ],
  },
  { name: "China", code: "CN", iso: "CHN", currency: "CNY" },
  { name: "Colombia", code: "CO", iso: "COL" },
  { name: "India", code: "IN", iso: "IND", currency: "INR", regions: [["Punjab", "PB"], ["Gujarat", "GJ"], ["Haryana", "HR"], ["Kerala", "KL"], ["Delhi", "DL"]] },
  { name: "Iran", code: "IR", iso: "IRN" },
  { name: "Mexico", code: "MX", iso: "MEX" },
  { name: "Nepal", code: "NP", iso: "NPL" },
  { name: "Nigeria", code: "NG", iso: "NGA" },
  { name: "Pakistan", code: "PK", iso: "PAK" },
  { name: "Philippines", code: "PH", iso: "PHL", currency: "PHP" },
  { name: "South Korea", code: "KR", iso: "KOR" },
  { name: "United Kingdom", code: "GB", iso: "GBR", currency: "GBP" },
  { name: "United States", code: "US", iso: "USA", currency: "USD", regions: [["California", "CA"], ["New York", "NY"], ["Texas", "TX"], ["Washington", "WA"]] },
  { name: "Vietnam", code: "VN", iso: "VNM" },
];

export const SEED_TIMEZONES: Array<[string, string]> = [
  ["(UTC-11:00) Midway Island", "Pacific/Midway"],
  ["(UTC-10:00) Hawaii", "Pacific/Honolulu"],
  ["(UTC-09:00) Alaska", "America/Anchorage"],
  ["(UTC-08:00) Pacific Time (US & Canada)", "America/Vancouver"],
  ["(UTC-07:00) Mountain Time (US & Canada)", "America/Edmonton"],
  ["(UTC-06:00) Saskatchewan", "America/Regina"],
  ["(UTC-06:00) Central Time (US & Canada)", "America/Winnipeg"],
  ["(UTC-05:00) Eastern Time (US & Canada)", "America/Toronto"],
  ["(UTC-04:00) Atlantic Time (Canada)", "America/Halifax"],
  ["(UTC-03:30) Newfoundland", "America/St_Johns"],
  ["(UTC+00:00) Coordinated Universal Time", "UTC"],
  ["(UTC+00:00) London", "Europe/London"],
  ["(UTC+01:00) Paris", "Europe/Paris"],
  ["(UTC+04:30) Kabul", "Asia/Kabul"],
  ["(UTC+05:00) Karachi", "Asia/Karachi"],
  ["(UTC+05:30) India Standard Time", "Asia/Kolkata"],
  ["(UTC+05:45) Kathmandu", "Asia/Kathmandu"],
  ["(UTC+07:00) Ho Chi Minh City", "Asia/Ho_Chi_Minh"],
  ["(UTC+08:00) Beijing", "Asia/Shanghai"],
  ["(UTC+08:00) Manila", "Asia/Manila"],
  ["(UTC+09:00) Seoul", "Asia/Seoul"],
];
