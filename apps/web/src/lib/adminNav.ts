import type { ModuleGate } from "./access";
import { HERITAGE_SIDEBAR } from "./heritageNav";

/**
 * `count` names a live badge value served by `useNavCounts` (e.g. "requests:Student Requests").
 * `hidden` keeps a screen out of the sidebar while its entry still gates direct URL access.
 */
export type AdminNavChild = { label: string; href: string; gate?: ModuleGate; section?: string; subheading?: string; indent?: boolean; count?: string; hidden?: boolean };

export type AdminNavItem = {
  label: string;
  href: string;
  icon: string;
  children?: AdminNavChild[];
  gate?: ModuleGate;
  count?: string;
  hidden?: boolean;
};

export type AdminSidebarEntry = { type: "label"; label: string } | { type: "item"; item: AdminNavItem };

/** Users, access levels, security and notification templates live in User Management / System Configuration above. */
export const PLATFORM_NAV: AdminNavChild[] = [
  { label: "Operations Dashboard", href: "/admin/ops/platform" },
  { label: "Login Sessions", href: "/admin/ops/platform/sessions" },
  { label: "Audit Log", href: "/admin/ops/platform/audit-log" },
  { label: "Event Queue", href: "/admin/ops/platform/event-queue" },
  { label: "Integrations", href: "/admin/sysconfig/plugins" },
  { label: "Institution Settings", href: "/admin/sysconfig/global-settings" },
];

export const LABS_NAV: AdminNavChild[] = [
  { label: "Lab Dashboard", href: "/admin/ops/labs" },
  { label: "Equipment", href: "/admin/ops/labs/equipment" },
  { label: "Inventory", href: "/admin/ops/labs/inventory" },
  { label: "Safety Rules", href: "/admin/ops/labs/safety-rules" },
  { label: "Eligibility", href: "/admin/ops/labs/eligibility" },
  { label: "Lab Sessions", href: "/admin/ops/labs/sessions" },
  { label: "Notebook", href: "/admin/ops/labs/notebook" },
  { label: "Incidents", href: "/admin/ops/labs/incidents" },
  { label: "Virtual Labs", href: "/admin/ops/labs/virtual-labs" },
  { label: "Environments", href: "/admin/ops/labs/environments" },
];

export const COMPLIANCE_NAV: AdminNavChild[] = [
  { label: "Dashboard", href: "/admin/ops/compliance" },
  { label: "Compliance Cases", href: "/admin/ops/compliance/cases" },
  { label: "Record Vault", href: "/admin/ops/compliance/record-vault" },
  { label: "Retention", href: "/admin/ops/compliance/retention" },
  { label: "Legal Holds", href: "/admin/ops/compliance/legal-holds" },
  { label: "Evidence Mapping", href: "/admin/ops/compliance/evidence" },
  { label: "Disposal Review", href: "/admin/ops/compliance/disposal-review" },
  { label: "Privacy Requests", href: "/admin/ops/compliance/privacy-requests" },
];

export const AI_NAV: AdminNavChild[] = [
  { label: "AI Hub", href: "/admin/ai" },
  { label: "Ask CampusOne", href: "/admin/ai/ask" },
  { label: "AI Dashboard", href: "/admin/ops/ai" },
  { label: "Interactions", href: "/admin/ops/ai/interactions" },
  { label: "Knowledge", href: "/admin/ops/ai/knowledge" },
];

/** Programs, terms, calendars, scheduling, courses, student queues and faculty profiles live in the Heritage SIS modules above. */
export const ACADEMICS_NAV: AdminNavChild[] = [
  { label: "Curriculum Catalogue", href: "/admin/curriculum" },
  { label: "Change Requests", href: "/admin/ops/academics/change-requests" },
];

export const ADMISSIONS_NAV: AdminNavChild[] = [
  { label: "Dashboard", href: "/admin/ops/admissions" },
  { label: "Applications", href: "/admin/ops/admissions/applications" },
  { label: "Document Review", href: "/admin/ops/admissions/documents" },
  { label: "Interviews", href: "/admin/ops/admissions/interviews" },
  { label: "Offers & LOAs", href: "/admin/ops/admissions/offers" },
  { label: "Intake Capacity", href: "/admin/ops/admissions/intakes" },
];

export const PRACTICUM_NAV: AdminNavChild[] = [
  { label: "Dashboard", href: "/admin/ops/practicum" },
  { label: "Employers", href: "/admin/ops/practicum/employers" },
  { label: "Sites", href: "/admin/ops/practicum/sites" },
  { label: "Opportunities", href: "/admin/ops/practicum/opportunities" },
  { label: "Placements", href: "/admin/ops/practicum/placements" },
  { label: "Agreements", href: "/admin/ops/practicum/agreements" },
  { label: "Hours Logs", href: "/admin/ops/practicum/logs" },
  { label: "Evaluations", href: "/admin/ops/practicum/evaluations" },
  { label: "Incidents", href: "/admin/ops/practicum/incidents" },
];

export const REGISTRAR_NAV: AdminNavChild[] = [
  { label: "Dashboard", href: "/admin/ops/registrar" },
  { label: "Enrolments", href: "/admin/enrolments" },
  { label: "Transfer Credits", href: "/admin/ops/registrar/transfer-credits" },
  { label: "Academic Standing", href: "/admin/ops/registrar/academic-standing" },
  { label: "Degree Scenario Review", href: "/admin/degree-scenarios" },
  { label: "Cohorts", href: "/admin/cohorts" },
  { label: "Retakes / Make-up", href: "/admin/retakes" },
  { label: "Extracurricular", href: "/admin/extracurricular" },
];

export const CRM_NAV: AdminNavChild[] = [
  { label: "Dashboard & Funnel", href: "/admin/ops/crm" },
  { label: "Counsellor Queue", href: "/admin/ops/crm/queue" },
  { label: "Campaigns", href: "/admin/ops/crm/campaigns" },
  { label: "Events", href: "/admin/ops/crm/events" },
];

export const SUCCESS_NAV: AdminNavChild[] = [
  { label: "Dashboard & Analytics", href: "/admin/ops/success" },
  { label: "Cases", href: "/admin/ops/success/cases" },
  { label: "Action Plan", href: "/admin/ops/success/action-plan" },
  { label: "Appointments", href: "/admin/ops/success/appointments" },
];

export const WORKFLOW_NAV: AdminNavChild[] = [
  { label: "Dashboard", href: "/admin/ops/workflows" },
  { label: "Approval Requests", href: "/admin/ops/workflows/requests" },
  { label: "Definitions & SLAs", href: "/admin/ops/workflows/definitions" },
];

export const FORMS_NAV: AdminNavChild[] = [
  { label: "Submissions", href: "/admin/ops/forms/submissions" },
  { label: "Form Builder", href: "/admin/sysconfig/forms", gate: { modules: ["systemConfiguration"] } },
];

export const RULES_NAV: AdminNavChild[] = [
  { label: "Rule Sets", href: "/admin/ops/rules/rule-sets" },
];

const WORKSPACE = { modules: ["userRequests"] } satisfies ModuleGate;

export const GLOBAL_NAV: AdminNavChild[] = [
  { label: "Overview", href: "/admin/ops/workspace", gate: WORKSPACE },
  { label: "Notifications", href: "/admin/ops/workspace/notifications", gate: WORKSPACE },
  { label: "Help Desk", href: "/admin/ops/workspace/help-desk", gate: WORKSPACE },
  { label: "Approvals", href: "/admin/approvals" },
  { label: "Calendar", href: "/admin/program-management/calendars", gate: { modules: ["programManagement"] } },
  { label: "Audit Log", href: "/admin/ops/platform/audit-log", gate: { modules: ["systemConfiguration"] } },
];

export const MY_PROFILE_NAV: AdminNavChild[] = [
  { label: "Manage My Profile", href: "/admin/faculty-profile" },
  { label: "Accomplishments", href: "/admin/account/accomplishments" },
  { label: "Security Settings", href: "/admin/account/security" },
  { label: "Change Time Zone", href: "/admin/account/timezone" },
];

export const USER_MANAGEMENT_NAV: AdminNavChild[] = [
  { label: "User Directory", href: "/admin/user-management" },
  { label: "Add User", href: "/admin/user-management/new", gate: { modules: ["userManagement"], edit: true } },
  { label: "Manage Access Levels", href: "/admin/access-levels" },
];

export const ADMIN_SIDEBAR: AdminSidebarEntry[] = [
  { type: "item", item: { label: "Dashboard", href: "/admin", icon: "home" } },
  { type: "label", label: "CAMPUSONE SIS" },
  ...HERITAGE_SIDEBAR.map((item): AdminSidebarEntry => ({ type: "item", item })),
  { type: "item", item: { label: "Search Students", href: "/admin/student-search", icon: "school", gate: { modules: ["studentRecords"] } } },
  { type: "item", item: { label: "My E-mail / Messages", href: "/admin/messages", icon: "mail", gate: { modules: ["emailMessaging"] } } },
  { type: "item", item: { label: "Ask CampusOne", href: "/admin/ai/ask", icon: "sparkle" } },
  { type: "label", label: "RECRUIT" },
  {
    type: "item",
    item: { label: "Admissions", href: "/admin/ops/admissions", icon: "bar-chart", children: ADMISSIONS_NAV, gate: { modules: ["studentRecords"] } },
  },
  { type: "item", item: { label: "CRM", href: "/admin/ops/crm", icon: "users", children: CRM_NAV, gate: { modules: ["agentManagement"] } } },
  { type: "label", label: "STUDENTS" },
  {
    type: "item",
    item: { label: "Student Success", href: "/admin/ops/success", icon: "bell", children: SUCCESS_NAV, gate: { modules: ["studentRecords"] } },
  },
  {
    type: "item",
    item: { label: "Registrar", href: "/admin/ops/registrar", icon: "school", children: REGISTRAR_NAV, gate: { modules: ["studentRecords"] } },
  },
  { type: "label", label: "ACADEMICS" },
  {
    type: "item",
    item: { label: "Academics", href: "/admin/ops/academics/change-requests", icon: "book", children: ACADEMICS_NAV, gate: { modules: ["programManagement"] } },
  },
  { type: "item", item: { label: "Labs", href: "/admin/ops/labs", icon: "flask", children: LABS_NAV, gate: { modules: ["courseManagement", "locationManagement"] } } },
  {
    type: "item",
    item: { label: "Practicum", href: "/admin/ops/practicum", icon: "briefcase", children: PRACTICUM_NAV, gate: { modules: ["studentRecords"] } },
  },
  { type: "label", label: "SYSTEM" },
  {
    type: "item",
    item: { label: "Compliance", href: "/admin/ops/compliance", icon: "shield", children: COMPLIANCE_NAV, gate: { modules: ["reporting"] } },
  },
  { type: "item", item: { label: "Forms", href: "/admin/ops/forms/submissions", icon: "file-text", children: FORMS_NAV, gate: { modules: ["userRequests"] } } },
  { type: "item", item: { label: "Rules", href: "/admin/ops/rules/rule-sets", icon: "list", children: RULES_NAV, gate: { modules: ["systemConfiguration"] } } },
  {
    type: "item",
    item: { label: "Workflows", href: "/admin/ops/workflows", icon: "briefcase", children: WORKFLOW_NAV, gate: { modules: ["systemConfiguration"] } },
  },
  {
    type: "item",
    item: { label: "Platform", href: "/admin/ops/platform", icon: "settings", children: PLATFORM_NAV, gate: { modules: ["systemConfiguration"] } },
  },
];

export function adminHrefMatches(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/admin" || path === "/admin/heritage") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function filterQuery(qs: string) {
  return [...new URLSearchParams(qs).entries()]
    .filter(([k]) => k.startsWith("f."))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");
}

export function adminChildActive(pathname: string, child: AdminNavChild, siblings?: AdminNavChild[], search = "") {
  if (!adminHrefMatches(pathname, child.href)) return false;
  const [path, qs = ""] = child.href.split("?");
  if (siblings?.some((s) => s !== child && s.href.split("?")[0] === path)) return filterQuery(qs) === filterQuery(search);
  return !siblings?.some((s) => s.href.split("?")[0].length > path.length && adminHrefMatches(pathname, s.href));
}

export function adminGroupActive(pathname: string, item: AdminNavItem) {
  if (item.children?.length) {
    if (item.children.some((child) => adminHrefMatches(pathname, child.href))) return true;
    const prefix = item.href.match(/^(\/admin\/f\/[a-z]+-)/);
    return Boolean(prefix && pathname.startsWith(prefix[1]));
  }
  return adminHrefMatches(pathname, item.href);
}
