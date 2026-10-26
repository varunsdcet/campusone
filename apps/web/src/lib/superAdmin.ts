import { api, loadSession } from "@/lib/api";

export const PERMISSION_LEVELS = [
  { key: "full", label: "Full Access" },
  { key: "read", label: "Read Only" },
  { key: "none", label: "No Access" },
  { key: "custom", label: "Customize" },
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number]["key"];

export type PermissionEntry = {
  override: boolean;
  level: PermissionLevel;
  custom?: { view: boolean; create: boolean; edit: boolean; delete: boolean };
};

export type PermissionModule = { key: string; label: string };
export type PermissionMap = Record<string, PermissionEntry>;

export type SuperMeta = {
  permissionModules: PermissionModule[];
  profileTypes: string[];
  campuses: string[];
};

export type AccessLevel = {
  id: string;
  name: string;
  profileType: string;
  assignableByNonAdmins: boolean;
  permissions: PermissionMap;
};

export type UserRow = {
  accountId: string;
  givenName: string;
  familyName: string;
  preferredName: string | null;
  email: string;
  login: string | null;
  accessLevelId: string | null;
  accessLevel: string;
  disabled: boolean;
};

export type UserDetail = {
  accountId: string;
  givenName: string;
  familyName: string;
  preferredName: string;
  email: string;
  phone: string;
  title: string;
  department: string;
  postNominals: string;
  employeeNumber: string;
  login: string;
  instructing: boolean;
  disabled: boolean;
  accessLevelId: string;
  customizeAccess: boolean;
  permissions: PermissionMap;
  customizeRegional: boolean;
  campuses: string[];
};

export type AvailabilityRecord = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  startDate: string;
  recurring: boolean;
  endDate: string;
  days: string[];
  note: string;
};

export type TeachingSession = {
  id: string;
  title: string;
  section: string;
  start: string;
  end: string | null;
  location: string | null;
  deliveryMethod: string;
};

export type Contract = { contract: string; compensation: string; requirements: string; earnings: string };

export type FacultyProfile = {
  accountId: string;
  name: string;
  preferredName: string | null;
  title: string;
  employeeNumber: string;
  email: string;
  status: string;
  department: string;
  photo: string | null;
  connect: { phone: string; email: string };
  education: { background: string; experience: string; organizations: string };
  topics: {
    currentCourses: string[];
    previousCourses: string[];
    academicChair: string;
    academicLead: string;
    teachingSchedule: Array<{ sectionId: string; course: string; deliveryMethod: string; location: string; schedule: string }>;
    teachingSessions: TeachingSession[];
  };
  officeHours: string;
  generalInfo: string;
  availability: AvailabilityRecord[];
  contracts: { previous: Contract[]; current: Contract[] };
};

export type SearchOption = { label: string; value: string; indent?: boolean };

export type StudentSearchOptions = {
  statuses: SearchOption[];
  campuses: string[];
  programGroups: Array<{ group: string; options: SearchOption[] }>;
  deliveryMethods: SearchOption[];
  residency: SearchOption[];
  admissionTerms: SearchOption[];
};

export type StudentHit = {
  studentId: string;
  studentNumber: string;
  name: string;
  preferredName: string | null;
  sisEmail: string;
  program: string;
  campus: string | null;
  status: string;
};

export const AVAILABILITY_TYPES = ["Available to Teach", "Office Hours"] as const;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function saApi<T>(path: string, init: RequestInit = {}) {
  const session = loadSession();
  return api<T>(`/admin/super${path}`, init, session?.accessToken);
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function errorMessage(err: unknown, fallback = "Something went wrong") {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function availabilityOccursOn(rec: AvailabilityRecord, iso: string) {
  if (!rec.recurring) return rec.startDate === iso;
  if (iso < rec.startDate || (rec.endDate && iso > rec.endDate)) return false;
  const day = WEEKDAYS[new Date(`${iso}T12:00:00`).getDay()];
  return rec.days.includes(day);
}

export function formatClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}${suffix}`;
}
