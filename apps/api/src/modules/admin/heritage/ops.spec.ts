import { MORE_ENTITIES, MORE_SLUGS, type MoreEntityKey } from "./ops.spec.more.js";

export type Data = Record<string, unknown>;

export type OpsKind = "text" | "textarea" | "number" | "date" | "datetime" | "time" | "select" | "ref" | "bool" | "email" | "url" | "list";

export type OpsRef =
  | "students"
  | "staff"
  | "courses"
  | "sections"
  | "classSessions"
  | "classrooms"
  | "programs"
  | "employers"
  | "sites"
  | "opportunities"
  | "placements"
  | "cases"
  | "safetyRules"
  | "equipment"
  | "environments"
  | "campaigns"
  | "events"
  | "applications"
  | "accounts"
  | "terms"
  | "forms"
  | "retentionPolicies";

export type OpsField = {
  key: string;
  label: string;
  kind: OpsKind;
  required?: boolean;
  options?: string[];
  ref?: OpsRef;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  hint?: string;
  /** Shown on the detail view only; never accepted from the client. */
  readOnly?: boolean;
  /** Ref value is stored as the option label (legacy string columns such as program and term names). */
  byLabel?: boolean;
  /** Textarea that may hold long documents. */
  long?: boolean;
  /** Only asked when creating; ignored on edit. */
  createOnly?: boolean;
  /** Hidden and ignored while creating; collected after the record exists. */
  editOnly?: boolean;
  /** URL fields may require HTTPS while still permitting named first-party paths. */
  httpsOnly?: boolean;
  allowedInternalPaths?: string[];
};

export type OpsColumn = { key: string; label: string };

export type OpsAction = {
  key: string;
  label: string;
  /** Field values written by the action; "$today" / "$now" are filled in on the server. */
  set?: Data;
  /** Handled by a server-side routine instead of a plain field update. */
  run?: boolean;
  /** Action is offered only while every listed field holds one of the given values. */
  when?: Record<string, Array<string | boolean>>;
  tone?: "primary" | "danger";
};

export type ModuleKey = "practicum" | "success" | "registrar" | "labs" | "crm" | "admissions" | "academics" | "compliance" | "forms" | "rules" | "workflows" | "ai" | "platform" | "workspace";

export type EntityKey =
  | MoreEntityKey
  | "employers"
  | "sites"
  | "opportunities"
  | "placements"
  | "agreements"
  | "logs"
  | "evaluations"
  | "practicumIncidents"
  | "cases"
  | "tasks"
  | "appointments"
  | "transferCredits"
  | "standing"
  | "equipment"
  | "inventory"
  | "safetyRules"
  | "eligibility"
  | "labSessions"
  | "notebook"
  | "labIncidents"
  | "virtualLabs"
  | "environments"
  | "leads"
  | "campaigns"
  | "events";

export type OpsEntity = {
  module: ModuleKey;
  label: string;
  plural: string;
  /** "record" entities live in HeritageRecord under `screen`; "table" entities map onto dedicated Prisma models. */
  store: "record" | "table";
  screen: string;
  fields: OpsField[];
  columns: OpsColumn[];
  filters?: string[];
  actions?: OpsAction[];
  /** Action-managed fields that authorized staff may also override from the edit form. */
  directActionEdits?: string[];
  create?: boolean;
  edit?: boolean;
  remove?: boolean;
  hint?: string;
};

const SEVERITY = ["Low", "Medium", "High", "Critical"];
const INCIDENT_STATUS = ["Open", "Investigating", "Resolved", "Closed"];
const ACTIVE = ["Active", "Inactive"];

const resolve: OpsAction[] = [
  { key: "investigate", label: "Investigate", set: { status: "Investigating" }, when: { status: ["Open"] } },
  { key: "resolve", label: "Resolve", set: { status: "Resolved" }, when: { status: ["Open", "Investigating"] }, tone: "primary" },
  { key: "close", label: "Close", set: { status: "Closed" }, when: { status: ["Resolved"] } },
];

export const ENTITIES: Record<EntityKey, OpsEntity> = {
  ...MORE_ENTITIES,
  /* ---------------------------- Practicum ---------------------------- */
  employers: {
    module: "practicum",
    label: "Employer",
    plural: "Employers",
    store: "table",
    screen: "OPS:PR_EMPLOYER",
    fields: [
      { key: "name", label: "Employer Name", kind: "text", required: true },
      { key: "siteName", label: "Primary Site", kind: "text", required: true },
      { key: "contactEmail", label: "Contact E-mail", kind: "email" },
      { key: "accountId", label: "Employer Portal Account", kind: "ref", ref: "accounts", hint: "Optional. Link an account with the employer role to enable the employer portal." },
    ],
    columns: [
      { key: "name", label: "Employer" },
      { key: "siteName", label: "Primary Site" },
      { key: "contactEmail", label: "Contact" },
      { key: "accountId", label: "Portal Account" },
      { key: "_placements", label: "Placements" },
      { key: "_agreements", label: "Agreements" },
    ],
    hint: "An employer with placements or agreements cannot be deleted; reassign or archive those records first.",
  },
  sites: {
    module: "practicum",
    label: "Site",
    plural: "Sites",
    store: "record",
    screen: "OPS:PR_SITE",
    fields: [
      { key: "employerId", label: "Employer", kind: "ref", ref: "employers", required: true },
      { key: "name", label: "Site Name", kind: "text", required: true },
      { key: "address", label: "Address", kind: "text" },
      { key: "city", label: "City", kind: "text" },
      { key: "supervisor", label: "Site Supervisor", kind: "text" },
      { key: "supervisorEmail", label: "Supervisor E-mail", kind: "email" },
      { key: "capacity", label: "Student Capacity", kind: "number", integer: true, min: 0, max: 1000 },
      { key: "status", label: "Status", kind: "select", options: ACTIVE, required: true, dflt: "Active" },
    ],
    columns: [
      { key: "name", label: "Site" },
      { key: "employerId", label: "Employer" },
      { key: "city", label: "City" },
      { key: "supervisor", label: "Supervisor" },
      { key: "capacity", label: "Capacity" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
  },
  opportunities: {
    module: "practicum",
    label: "Opportunity",
    plural: "Opportunities",
    store: "table",
    screen: "OPS:PR_OPPORTUNITY",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "employerName", label: "Employer", kind: "text", required: true },
      { key: "skills", label: "Skills", kind: "list", hint: "Comma separated" },
      { key: "programCodes", label: "Program Codes", kind: "list", hint: "Comma separated; matched against student programs" },
      { key: "href", label: "Application URL", kind: "url", httpsOnly: true, allowedInternalPaths: ["/student/f/st-17-practicum"], hint: "Optional HTTPS application link; the approved practicum page is also supported" },
      { key: "status", label: "Status", kind: "select", options: ["open", "filled", "closed"], required: true, dflt: "open" },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "employerName", label: "Employer" },
      { key: "skills", label: "Skills" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "fill", label: "Mark Filled", set: { status: "filled" }, when: { status: ["open"] } },
      { key: "close", label: "Close", set: { status: "closed" }, when: { status: ["open", "filled"] } },
      { key: "reopen", label: "Reopen", set: { status: "open" }, when: { status: ["filled", "closed"] } },
    ],
    hint: "Open opportunities appear on the student career board.",
  },
  placements: {
    module: "practicum",
    label: "Placement",
    plural: "Placements",
    store: "table",
    screen: "OPS:PR_PLACEMENT",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", required: true },
      { key: "employerOrgId", label: "Employer", kind: "ref", ref: "employers", required: true },
      { key: "siteId", label: "Practicum Site", kind: "ref", ref: "sites", required: true, hint: "Only active sites belonging to the selected employer should be used." },
      { key: "supervisorPersonId", label: "Faculty Supervisor", kind: "ref", ref: "staff", required: true, hint: "This instructor receives the placement in My Assigned Work." },
      { key: "opportunityId", label: "Source Opportunity", kind: "ref", ref: "opportunities", hint: "Optional career opportunity that led to this placement." },
      { key: "status", label: "Status", kind: "select", options: ["pending", "active", "completed", "withdrawn"], required: true, dflt: "pending" },
      { key: "startsOn", label: "Start Date", kind: "date" },
      { key: "endsOn", label: "End Date", kind: "date" },
      { key: "programName", label: "Program", kind: "text", readOnly: true },
    ],
    columns: [
      { key: "studentId", label: "Student" },
      { key: "programName", label: "Program" },
      { key: "employerOrgId", label: "Employer" },
      { key: "siteId", label: "Site" },
      { key: "supervisorPersonId", label: "Supervisor" },
      { key: "startsOn", label: "Start" },
      { key: "endsOn", label: "End" },
      { key: "_hours", label: "Approved Hours" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "activate", label: "Activate", set: { status: "active" }, when: { status: ["pending"] }, tone: "primary" },
      { key: "complete", label: "Complete", set: { status: "completed" }, when: { status: ["active"] } },
      { key: "withdraw", label: "Withdraw", set: { status: "withdrawn" }, when: { status: ["pending", "active"] }, tone: "danger" },
    ],
  },
  agreements: {
    module: "practicum",
    label: "Agreement",
    plural: "Agreements",
    store: "table",
    screen: "OPS:PR_AGREEMENT",
    fields: [
      { key: "employerOrgId", label: "Employer", kind: "ref", ref: "employers", required: true },
      { key: "title", label: "Agreement Title", kind: "text", required: true },
      { key: "status", label: "Status", kind: "select", options: ["draft", "active", "expired", "terminated"], required: true, dflt: "draft" },
      { key: "renewsOn", label: "Renewal Date", kind: "date" },
    ],
    columns: [
      { key: "title", label: "Agreement" },
      { key: "employerOrgId", label: "Employer" },
      { key: "renewsOn", label: "Renews" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "activate", label: "Activate", set: { status: "active" }, when: { status: ["draft", "expired"] }, tone: "primary" },
      { key: "terminate", label: "Terminate", set: { status: "terminated" }, when: { status: ["draft", "active"] }, tone: "danger" },
    ],
  },
  logs: {
    module: "practicum",
    label: "Hours Log",
    plural: "Hours Logs",
    store: "table",
    screen: "OPS:PR_HOURS",
    fields: [
      { key: "placementId", label: "Placement", kind: "ref", ref: "placements", required: true },
      { key: "weekLabel", label: "Week", kind: "text", required: true, hint: "e.g. Week 3 (Oct 13 – Oct 17)" },
      { key: "hours", label: "Hours", kind: "number", required: true, min: 0, max: 80 },
      { key: "status", label: "Status", kind: "select", options: ["pending", "approved", "rejected"], required: true, dflt: "pending" },
    ],
    columns: [
      { key: "placementId", label: "Placement" },
      { key: "weekLabel", label: "Week" },
      { key: "hours", label: "Hours" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "approve", label: "Approve", set: { status: "approved" }, when: { status: ["pending"] }, tone: "primary" },
      { key: "reject", label: "Reject", set: { status: "rejected" }, when: { status: ["pending"] }, tone: "danger" },
    ],
  },
  evaluations: {
    module: "practicum",
    label: "Evaluation",
    plural: "Evaluations",
    store: "table",
    screen: "OPS:PR_EVALUATION",
    fields: [
      { key: "placementId", label: "Placement", kind: "ref", ref: "placements", required: true },
      { key: "status", label: "Status", kind: "select", options: ["due", "submitted", "reviewed"], required: true, dflt: "due" },
      { key: "score", label: "Score (1–5)", kind: "number", integer: true, min: 1, max: 5 },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
    columns: [
      { key: "placementId", label: "Placement" },
      { key: "score", label: "Score" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [{ key: "review", label: "Mark Reviewed", set: { status: "reviewed" }, when: { status: ["submitted"] }, tone: "primary" }],
  },
  practicumIncidents: {
    module: "practicum",
    label: "Incident",
    plural: "Practicum Incidents",
    store: "record",
    screen: "OPS:PR_INCIDENT",
    fields: [
      { key: "placementId", label: "Placement", kind: "ref", ref: "placements", required: true },
      { key: "occurredOn", label: "Date", kind: "date", required: true },
      { key: "category", label: "Category", kind: "select", options: ["Safety", "Injury", "Conduct", "Attendance", "Supervision", "Other"], required: true },
      { key: "severity", label: "Severity", kind: "select", options: SEVERITY, required: true, dflt: "Low" },
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "actionTaken", label: "Action Taken", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: INCIDENT_STATUS, required: true, dflt: "Open" },
    ],
    columns: [
      { key: "occurredOn", label: "Date" },
      { key: "placementId", label: "Placement" },
      { key: "category", label: "Category" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "severity"],
    actions: resolve,
  },

  /* -------------------------- Student Success ------------------------- */
  cases: {
    module: "success",
    label: "Case",
    plural: "Cases",
    store: "table",
    screen: "OPS:SS_CASE",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", required: true },
      { key: "level", label: "Risk Level", kind: "select", options: ["watch", "warning", "alert", "critical"], required: true, dflt: "watch" },
      { key: "summary", label: "Summary", kind: "textarea", required: true },
      { key: "signals", label: "Signals", kind: "list", hint: "Comma separated, e.g. attendance, missed submissions" },
      { key: "ownerPersonId", label: "Case Owner", kind: "ref", ref: "staff" },
      { key: "status", label: "Status", kind: "select", options: ["open", "in_progress", "monitoring", "resolved", "closed"], required: true, dflt: "open" },
    ],
    columns: [
      { key: "studentId", label: "Student" },
      { key: "level", label: "Level" },
      { key: "summary", label: "Summary" },
      { key: "ownerPersonId", label: "Owner" },
      { key: "_tasks", label: "Open Tasks" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "level"],
    actions: [
      { key: "start", label: "Start", set: { status: "in_progress" }, when: { status: ["open"] }, tone: "primary" },
      { key: "monitor", label: "Monitor", set: { status: "monitoring" }, when: { status: ["open", "in_progress"] } },
      { key: "resolve", label: "Resolve", set: { status: "resolved" }, when: { status: ["open", "in_progress", "monitoring"] } },
      { key: "close", label: "Close", set: { status: "closed" }, when: { status: ["resolved"] } },
      { key: "reopen", label: "Reopen", set: { status: "open" }, when: { status: ["resolved", "closed"] } },
    ],
    hint: "Deleting a case also removes its action-plan tasks.",
  },
  tasks: {
    module: "success",
    label: "Action Plan Task",
    plural: "Action Plan",
    store: "table",
    screen: "OPS:SS_TASK",
    fields: [
      { key: "caseId", label: "Case", kind: "ref", ref: "cases", required: true },
      { key: "title", label: "Task", kind: "text", required: true },
      { key: "dueAt", label: "Due Date", kind: "date" },
      { key: "status", label: "Status", kind: "select", options: ["pending", "in_progress", "done", "cancelled"], required: true, dflt: "pending" },
      { key: "completedAt", label: "Completed", kind: "datetime", readOnly: true },
    ],
    columns: [
      { key: "title", label: "Task" },
      { key: "caseId", label: "Case" },
      { key: "dueAt", label: "Due" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "start", label: "Start", set: { status: "in_progress" }, when: { status: ["pending"] } },
      { key: "done", label: "Complete", set: { status: "done" }, when: { status: ["pending", "in_progress"] }, tone: "primary" },
      { key: "cancel", label: "Cancel", set: { status: "cancelled" }, when: { status: ["pending", "in_progress"] }, tone: "danger" },
    ],
  },
  appointments: {
    module: "success",
    label: "Appointment",
    plural: "Appointments",
    store: "table",
    screen: "OPS:SS_APPOINTMENT",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", required: true },
      { key: "advisorPersonId", label: "Advisor", kind: "ref", ref: "staff" },
      { key: "topic", label: "Topic", kind: "text", required: true },
      { key: "startsAt", label: "Date & Time", kind: "datetime", required: true },
      { key: "status", label: "Status", kind: "select", options: ["requested", "confirmed", "completed", "cancelled", "no_show"], required: true, dflt: "confirmed" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
    columns: [
      { key: "startsAt", label: "When" },
      { key: "studentId", label: "Student" },
      { key: "topic", label: "Topic" },
      { key: "advisorPersonId", label: "Advisor" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "confirm", label: "Confirm", set: { status: "confirmed" }, when: { status: ["requested"] }, tone: "primary" },
      { key: "complete", label: "Complete", set: { status: "completed" }, when: { status: ["confirmed"] } },
      { key: "noshow", label: "No Show", set: { status: "no_show" }, when: { status: ["confirmed"] } },
      { key: "cancel", label: "Cancel", set: { status: "cancelled" }, when: { status: ["requested", "confirmed"] }, tone: "danger" },
    ],
    hint: "Appointments show on the student portal.",
  },

  /* ----------------------------- Registrar ---------------------------- */
  transferCredits: {
    module: "registrar",
    label: "Transfer Credit",
    plural: "Transfer Credits",
    store: "table",
    screen: "OPS:RG_TRANSFER",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", required: true },
      { key: "externalCode", label: "External Course Code", kind: "text", required: true },
      { key: "externalTitle", label: "External Course Title", kind: "text", required: true },
      { key: "credits", label: "Credits", kind: "number", required: true, min: 0, max: 60 },
      { key: "courseId", label: "Equivalent Course", kind: "ref", ref: "courses" },
      { key: "status", label: "Status", kind: "select", options: ["pending", "accepted", "rejected"], required: true, dflt: "pending" },
    ],
    columns: [
      { key: "studentId", label: "Student" },
      { key: "externalCode", label: "External Code" },
      { key: "externalTitle", label: "External Title" },
      { key: "credits", label: "Credits" },
      { key: "courseId", label: "Equivalent" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "accept", label: "Accept", set: { status: "accepted" }, when: { status: ["pending", "rejected"] }, tone: "primary" },
      { key: "reject", label: "Reject", set: { status: "rejected" }, when: { status: ["pending", "accepted"] }, tone: "danger" },
    ],
    hint: "Accepted credits count toward the student's degree progress.",
  },
  standing: {
    module: "registrar",
    label: "Academic Standing",
    plural: "Academic Standing",
    store: "table",
    screen: "OPS:RG_STANDING",
    fields: [
      { key: "studentNumber", label: "Student Number", kind: "text", readOnly: true },
      { key: "name", label: "Student", kind: "text", readOnly: true },
      { key: "programName", label: "Program", kind: "text", readOnly: true },
      { key: "standing", label: "Standing", kind: "select", options: ["good", "warning", "alert", "probation", "suspended"], required: true },
      { key: "reason", label: "Reason for Change", kind: "textarea", required: true, hint: "Kept in the audit trail" },
    ],
    columns: [
      { key: "studentNumber", label: "Student #" },
      { key: "name", label: "Student" },
      { key: "programName", label: "Program" },
      { key: "standing", label: "Standing" },
    ],
    filters: ["standing"],
    create: false,
    remove: false,
  },

  /* ------------------------------- Labs ------------------------------- */
  equipment: {
    module: "labs",
    label: "Equipment",
    plural: "Equipment",
    store: "record",
    screen: "OPS:LB_EQUIPMENT",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "assetTag", label: "Asset Tag", kind: "text", required: true },
      { key: "category", label: "Category", kind: "select", options: ["Microscope", "Analyzer", "Computer", "Simulator", "Instrument", "Safety", "Other"], required: true },
      { key: "roomId", label: "Lab Room", kind: "ref", ref: "classrooms" },
      { key: "serialNumber", label: "Serial Number", kind: "text" },
      { key: "status", label: "Status", kind: "select", options: ["Available", "In Use", "Maintenance", "Retired"], required: true, dflt: "Available" },
      { key: "lastServiced", label: "Last Serviced", kind: "date" },
      { key: "nextService", label: "Next Service Due", kind: "date" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
    columns: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "roomId", label: "Room" },
      { key: "nextService", label: "Next Service" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "category"],
    actions: [
      { key: "maintenance", label: "Send to Maintenance", set: { status: "Maintenance" }, when: { status: ["Available", "In Use"] } },
      { key: "available", label: "Mark Available", set: { status: "Available" }, when: { status: ["In Use", "Maintenance"] }, tone: "primary" },
      { key: "retire", label: "Retire", set: { status: "Retired" }, when: { status: ["Available", "Maintenance"] }, tone: "danger" },
    ],
  },
  inventory: {
    module: "labs",
    label: "Inventory Item",
    plural: "Inventory",
    store: "record",
    screen: "OPS:LB_INVENTORY",
    fields: [
      { key: "item", label: "Item", kind: "text", required: true },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "category", label: "Category", kind: "select", options: ["Consumable", "Chemical", "Glassware", "PPE", "Reagent", "Other"], required: true },
      { key: "roomId", label: "Storage Room", kind: "ref", ref: "classrooms" },
      { key: "quantity", label: "Quantity on Hand", kind: "number", required: true, min: 0 },
      { key: "unit", label: "Unit", kind: "text", dflt: "each" },
      { key: "reorderLevel", label: "Reorder Level", kind: "number", min: 0 },
      { key: "hazardClass", label: "Hazard Class", kind: "select", options: ["None", "Flammable", "Corrosive", "Toxic", "Biohazard", "Oxidizer"], dflt: "None" },
      { key: "expiresOn", label: "Expiry Date", kind: "date" },
    ],
    columns: [
      { key: "item", label: "Item" },
      { key: "category", label: "Category" },
      { key: "quantity", label: "On Hand" },
      { key: "reorderLevel", label: "Reorder At" },
      { key: "_stock", label: "Stock" },
      { key: "expiresOn", label: "Expires" },
    ],
    filters: ["category", "hazardClass"],
  },
  safetyRules: {
    module: "labs",
    label: "Safety Rule",
    plural: "Safety Rules",
    store: "record",
    screen: "OPS:LB_SAFETY",
    fields: [
      { key: "title", label: "Rule", kind: "text", required: true },
      { key: "category", label: "Category", kind: "select", options: ["PPE", "Chemical", "Biological", "Electrical", "Fire", "General"], required: true },
      { key: "roomId", label: "Applies to Room", kind: "ref", ref: "classrooms", hint: "Leave empty for all labs" },
      { key: "requirement", label: "Requirement", kind: "textarea", required: true },
      { key: "trainingRequired", label: "Training required before lab access", kind: "bool" },
      { key: "effectiveFrom", label: "Effective From", kind: "date" },
      { key: "status", label: "Status", kind: "select", options: ["Draft", "Active", "Retired"], required: true, dflt: "Active" },
    ],
    columns: [
      { key: "title", label: "Rule" },
      { key: "category", label: "Category" },
      { key: "roomId", label: "Room" },
      { key: "trainingRequired", label: "Training" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "category"],
  },
  eligibility: {
    module: "labs",
    label: "Eligibility",
    plural: "Eligibility",
    store: "record",
    screen: "OPS:LB_ELIGIBILITY",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", required: true },
      { key: "safetyRuleId", label: "Safety Training", kind: "ref", ref: "safetyRules" },
      { key: "equipmentId", label: "Equipment", kind: "ref", ref: "equipment" },
      { key: "clearedOn", label: "Cleared On", kind: "date", required: true },
      { key: "expiresOn", label: "Expires On", kind: "date" },
      { key: "status", label: "Status", kind: "select", options: ["Pending", "Cleared", "Expired", "Revoked"], required: true, dflt: "Cleared" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
    columns: [
      { key: "studentId", label: "Student" },
      { key: "safetyRuleId", label: "Training" },
      { key: "equipmentId", label: "Equipment" },
      { key: "clearedOn", label: "Cleared" },
      { key: "expiresOn", label: "Expires" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "clear", label: "Clear", set: { status: "Cleared" }, when: { status: ["Pending", "Expired"] }, tone: "primary" },
      { key: "revoke", label: "Revoke", set: { status: "Revoked" }, when: { status: ["Pending", "Cleared"] }, tone: "danger" },
    ],
  },
  labSessions: {
    module: "labs",
    label: "Lab Session",
    plural: "Lab Sessions",
    store: "record",
    screen: "OPS:LB_SESSION",
    fields: [
      { key: "title", label: "Session Title", kind: "text", required: true },
      { key: "sectionId", label: "Course Section", kind: "ref", ref: "sections", required: true, hint: "Enrolled students receive the lab through this section." },
      { key: "roomId", label: "Lab Room", kind: "ref", ref: "classrooms", required: true },
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "startTime", label: "Start Time", kind: "time", required: true },
      { key: "endTime", label: "End Time", kind: "time", required: true },
      { key: "instructorId", label: "Instructor", kind: "ref", ref: "staff", required: true, hint: "The assigned instructor can start and complete this lab." },
      { key: "equipmentId", label: "Equipment Booked", kind: "ref", ref: "equipment" },
      { key: "capacity", label: "Capacity", kind: "number", integer: true, min: 1, max: 500 },
      { key: "status", label: "Status", kind: "select", options: ["Scheduled", "In Progress", "Completed", "Cancelled"], required: true, dflt: "Scheduled" },
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "_time", label: "Time" },
      { key: "title", label: "Session" },
      { key: "roomId", label: "Room" },
      { key: "instructorId", label: "Instructor" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
    actions: [
      { key: "start", label: "Start", set: { status: "In Progress" }, when: { status: ["Scheduled"] } },
      { key: "complete", label: "Complete", set: { status: "Completed" }, when: { status: ["Scheduled", "In Progress"] }, tone: "primary" },
      { key: "cancel", label: "Cancel", set: { status: "Cancelled" }, when: { status: ["Scheduled"] }, tone: "danger" },
    ],
    hint: "A room or piece of equipment cannot be double-booked for overlapping times.",
  },
  notebook: {
    module: "labs",
    label: "Notebook Entry",
    plural: "Lab Notebooks",
    store: "table",
    screen: "OPS:LB_NOTEBOOK",
    fields: [
      { key: "studentId", label: "Student", kind: "ref", ref: "students", readOnly: true },
      { key: "classSessionId", label: "Class Session", kind: "ref", ref: "classSessions", readOnly: true },
      { key: "title", label: "Title", kind: "text", readOnly: true },
      { key: "body", label: "Entry", kind: "textarea", readOnly: true },
      { key: "version", label: "Version", kind: "number", readOnly: true },
      { key: "locked", label: "Locked", kind: "bool" },
    ],
    columns: [
      { key: "studentId", label: "Student" },
      { key: "classSessionId", label: "Session" },
      { key: "title", label: "Title" },
      { key: "version", label: "Version" },
      { key: "locked", label: "Locked" },
    ],
    actions: [
      { key: "lock", label: "Lock", set: { locked: true }, when: { locked: [false] }, tone: "primary" },
      { key: "unlock", label: "Unlock", set: { locked: false }, when: { locked: [true] } },
    ],
    create: false,
    edit: false,
    remove: false,
    hint: "Students write notebook entries from their lab sessions; locking stops further edits.",
  },
  labIncidents: {
    module: "labs",
    label: "Incident",
    plural: "Lab Incidents",
    store: "record",
    screen: "OPS:LB_INCIDENT",
    fields: [
      { key: "occurredAt", label: "Date & Time", kind: "datetime", required: true },
      { key: "roomId", label: "Lab Room", kind: "ref", ref: "classrooms" },
      { key: "equipmentId", label: "Equipment", kind: "ref", ref: "equipment" },
      { key: "category", label: "Category", kind: "select", options: ["Spill", "Injury", "Equipment Failure", "Fire", "Near Miss", "Other"], required: true },
      { key: "severity", label: "Severity", kind: "select", options: SEVERITY, required: true, dflt: "Low" },
      { key: "reportedBy", label: "Reported By", kind: "ref", ref: "staff" },
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "actionTaken", label: "Action Taken", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: INCIDENT_STATUS, required: true, dflt: "Open" },
    ],
    columns: [
      { key: "occurredAt", label: "When" },
      { key: "category", label: "Category" },
      { key: "roomId", label: "Room" },
      { key: "equipmentId", label: "Equipment" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "severity"],
    actions: resolve,
  },
  virtualLabs: {
    module: "labs",
    label: "Virtual Lab",
    plural: "Virtual Labs",
    store: "record",
    screen: "OPS:LB_VIRTUAL",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "courseId", label: "Course", kind: "ref", ref: "courses", required: true, hint: "Only students enrolled in this course can see the virtual lab." },
      { key: "provider", label: "Provider", kind: "text" },
      { key: "launchUrl", label: "Launch URL", kind: "url" },
      { key: "environmentId", label: "Environment", kind: "ref", ref: "environments" },
      { key: "seats", label: "Seats", kind: "number", integer: true, min: 0, max: 10000 },
      { key: "status", label: "Status", kind: "select", options: ["Draft", "Active", "Retired"], required: true, dflt: "Draft" },
    ],
    columns: [
      { key: "name", label: "Virtual Lab" },
      { key: "courseId", label: "Course" },
      { key: "environmentId", label: "Environment" },
      { key: "seats", label: "Seats" },
      { key: "status", label: "Status" },
    ],
    filters: ["status"],
  },
  environments: {
    module: "labs",
    label: "Environment",
    plural: "Environments",
    store: "record",
    screen: "OPS:LB_ENV",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "select", options: ["Container", "Virtual Machine", "Notebook", "Simulation"], required: true },
      { key: "image", label: "Image / Template", kind: "text", required: true },
      { key: "cpu", label: "vCPU", kind: "number", integer: true, min: 1, max: 128 },
      { key: "memoryGb", label: "Memory (GB)", kind: "number", min: 0.5, max: 1024 },
      { key: "storageGb", label: "Storage (GB)", kind: "number", min: 1, max: 10000 },
      { key: "status", label: "Status", kind: "select", options: ["Provisioning", "Running", "Stopped", "Retired"], required: true, dflt: "Stopped" },
    ],
    columns: [
      { key: "name", label: "Environment" },
      { key: "type", label: "Type" },
      { key: "image", label: "Image" },
      { key: "_size", label: "Size" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "type"],
    actions: [
      { key: "start", label: "Start", set: { status: "Running" }, when: { status: ["Stopped", "Provisioning"] }, tone: "primary" },
      { key: "stop", label: "Stop", set: { status: "Stopped" }, when: { status: ["Running"] } },
    ],
    hint: "Status here is the catalogue state; no cloud resources are provisioned from this screen.",
  },

  /* -------------------------------- CRM ------------------------------- */
  leads: {
    module: "crm",
    label: "Lead",
    plural: "Counsellor Queue",
    store: "record",
    screen: "OPS:CRM_LEAD",
    fields: [
      { key: "firstName", label: "First Name", kind: "text", required: true },
      { key: "lastName", label: "Last Name", kind: "text", required: true },
      { key: "email", label: "E-mail", kind: "email", required: true },
      { key: "phone", label: "Phone", kind: "text" },
      { key: "programId", label: "Program of Interest", kind: "ref", ref: "programs" },
      { key: "source", label: "Source", kind: "select", options: ["Website", "Event", "Referral", "Agent", "Social", "Walk-in", "Campaign"], required: true, dflt: "Website" },
      { key: "campaignId", label: "Campaign", kind: "ref", ref: "campaigns" },
      { key: "eventId", label: "Event", kind: "ref", ref: "events" },
      { key: "counsellorId", label: "Counsellor", kind: "ref", ref: "staff" },
      { key: "stage", label: "Stage", kind: "select", options: ["New", "Contacted", "Qualified", "Applied", "Admitted", "Enrolled", "Lost"], required: true, dflt: "New" },
      { key: "nextFollowUp", label: "Next Follow-up", kind: "date" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
    columns: [
      { key: "_name", label: "Lead" },
      { key: "email", label: "E-mail" },
      { key: "programId", label: "Program" },
      { key: "source", label: "Source" },
      { key: "counsellorId", label: "Counsellor" },
      { key: "nextFollowUp", label: "Follow-up" },
      { key: "stage", label: "Stage" },
    ],
    filters: ["stage", "source"],
    actions: [
      { key: "contacted", label: "Mark Contacted", set: { stage: "Contacted" }, when: { stage: ["New"] }, tone: "primary" },
      { key: "qualified", label: "Qualify", set: { stage: "Qualified" }, when: { stage: ["New", "Contacted"] } },
      { key: "applied", label: "Applied", set: { stage: "Applied" }, when: { stage: ["Qualified"] } },
      { key: "lost", label: "Mark Lost", set: { stage: "Lost" }, when: { stage: ["New", "Contacted", "Qualified"] }, tone: "danger" },
    ],
  },
  campaigns: {
    module: "crm",
    label: "Campaign",
    plural: "Campaigns",
    store: "record",
    screen: "OPS:CRM_CAMPAIGN",
    fields: [
      { key: "name", label: "Campaign Name", kind: "text", required: true },
      { key: "channel", label: "Channel", kind: "select", options: ["Email", "SMS", "Social", "Event", "Print", "Web", "Mixed"], required: true },
      { key: "audience", label: "Audience", kind: "text" },
      { key: "startDate", label: "Start Date", kind: "date", required: true },
      { key: "endDate", label: "End Date", kind: "date" },
      { key: "budget", label: "Budget ($)", kind: "number", min: 0 },
      { key: "goalLeads", label: "Lead Goal", kind: "number", integer: true, min: 0 },
      { key: "status", label: "Status", kind: "select", options: ["Draft", "Scheduled", "Active", "Completed", "Cancelled"], required: true, dflt: "Draft" },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    columns: [
      { key: "name", label: "Campaign" },
      { key: "channel", label: "Channel" },
      { key: "startDate", label: "Start" },
      { key: "endDate", label: "End" },
      { key: "_leads", label: "Leads / Goal" },
      { key: "_converted", label: "Applied+" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "channel"],
    actions: [
      { key: "launch", label: "Launch", set: { status: "Active" }, when: { status: ["Draft", "Scheduled"] }, tone: "primary" },
      { key: "complete", label: "Complete", set: { status: "Completed" }, when: { status: ["Active"] } },
      { key: "cancel", label: "Cancel", set: { status: "Cancelled" }, when: { status: ["Draft", "Scheduled", "Active"] }, tone: "danger" },
    ],
  },
  events: {
    module: "crm",
    label: "Event",
    plural: "Events",
    store: "record",
    screen: "OPS:CRM_EVENT",
    fields: [
      { key: "name", label: "Event Name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "select", options: ["Open House", "Info Session", "Webinar", "Education Fair", "Campus Tour"], required: true },
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "startTime", label: "Start Time", kind: "time" },
      { key: "endTime", label: "End Time", kind: "time" },
      { key: "location", label: "Location / Link", kind: "text" },
      { key: "campaignId", label: "Campaign", kind: "ref", ref: "campaigns" },
      { key: "capacity", label: "Capacity", kind: "number", integer: true, min: 0 },
      { key: "status", label: "Status", kind: "select", options: ["Planned", "Open", "Full", "Completed", "Cancelled"], required: true, dflt: "Planned" },
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "name", label: "Event" },
      { key: "type", label: "Type" },
      { key: "location", label: "Location" },
      { key: "_registrations", label: "Leads / Capacity" },
      { key: "status", label: "Status" },
    ],
    filters: ["status", "type"],
    actions: [
      { key: "open", label: "Open Registration", set: { status: "Open" }, when: { status: ["Planned"] }, tone: "primary" },
      { key: "complete", label: "Complete", set: { status: "Completed" }, when: { status: ["Open", "Full"] } },
      { key: "cancel", label: "Cancel", set: { status: "Cancelled" }, when: { status: ["Planned", "Open", "Full"] }, tone: "danger" },
    ],
    hint: "Registrations are leads linked to the event.",
  },
};

type Permission = "studentRecords" | "courseManagement" | "agentManagement" | "programManagement" | "reporting" | "userRequests" | "systemConfiguration";
/** `links` are extra tabs that open screens owned by other modules. */
export const MODULES: Record<ModuleKey, { label: string; permission: Permission; entities: EntityKey[]; dashboard: boolean; links?: Array<{ label: string; href: string }> }> = {
  practicum: { label: "Practicum", permission: "studentRecords", dashboard: true, entities: ["employers", "sites", "opportunities", "placements", "agreements", "logs", "evaluations", "practicumIncidents"] },
  success: { label: "Student Success", permission: "studentRecords", dashboard: true, entities: ["cases", "tasks", "appointments"] },
  registrar: { label: "Registrar", permission: "studentRecords", dashboard: true, entities: ["transferCredits", "standing"], links: [{ label: "Enrolments", href: "/admin/enrolments" }, { label: "Cohorts", href: "/admin/cohorts" }] },
  labs: { label: "Labs", permission: "courseManagement", dashboard: true, entities: ["equipment", "inventory", "safetyRules", "eligibility", "labSessions", "notebook", "labIncidents", "virtualLabs", "environments"] },
  crm: { label: "CRM", permission: "agentManagement", dashboard: true, entities: ["leads", "campaigns", "events"] },
  admissions: { label: "Admissions", permission: "studentRecords", dashboard: true, entities: ["applications", "appDocuments", "interviews", "offers", "intakes"] },
  academics: { label: "Academics", permission: "programManagement", dashboard: false, entities: ["changeRequests"], links: [{ label: "Programs", href: "/admin/program-management/faculties" }] },
  compliance: { label: "Compliance", permission: "reporting", dashboard: true, entities: ["complianceCases", "retention", "legalHolds", "privacyRequests", "evidence", "recordVault", "disposals"] },
  forms: { label: "Forms", permission: "userRequests", dashboard: false, entities: ["submissions"], links: [{ label: "Form Builder", href: "/admin/sysconfig/forms" }] },
  rules: { label: "Rules", permission: "systemConfiguration", dashboard: false, entities: ["ruleSets"] },
  workflows: { label: "Workflows", permission: "systemConfiguration", dashboard: true, entities: ["approvals", "workflowDefs"], links: [{ label: "Approvals Inbox", href: "/admin/approvals" }] },
  ai: { label: "AI Hub", permission: "reporting", dashboard: true, entities: ["aiInteractions", "knowledge"], links: [{ label: "Ask MyHeritage", href: "/admin/ai/ask" }] },
  platform: { label: "Platform", permission: "systemConfiguration", dashboard: true, entities: ["sessions", "auditLog", "outbox"], links: [{ label: "Integrations", href: "/admin/sysconfig/plugins" }, { label: "Institution Settings", href: "/admin/sysconfig/global-settings" }] },
  workspace: { label: "Workspace", permission: "userRequests", dashboard: true, entities: ["notifications", "helpdesk"], links: [{ label: "Approvals", href: "/admin/approvals" }] },
};

/** URL slug for each entity inside its module. */
export const SLUGS: Record<EntityKey, string> = {
  ...MORE_SLUGS,
  employers: "employers",
  sites: "sites",
  opportunities: "opportunities",
  placements: "placements",
  agreements: "agreements",
  logs: "logs",
  evaluations: "evaluations",
  practicumIncidents: "incidents",
  cases: "cases",
  tasks: "action-plan",
  appointments: "appointments",
  transferCredits: "transfer-credits",
  standing: "academic-standing",
  equipment: "equipment",
  inventory: "inventory",
  safetyRules: "safety-rules",
  eligibility: "eligibility",
  labSessions: "sessions",
  notebook: "notebook",
  labIncidents: "incidents",
  virtualLabs: "virtual-labs",
  environments: "environments",
  leads: "queue",
  campaigns: "campaigns",
  events: "events",
};
