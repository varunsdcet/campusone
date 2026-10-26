/** MySIS-aligned student lifecycle statuses (admin + instructor filters). */
export const LIFECYCLE_STATUSES = [
  "New Inquiry",
  "Approved Application",
  "Pre-Enrollment Application",
  "Application Cancelled",
  "Did Not Proceed",
  "CLOA",
  "Duplicate Profile",
  "Follow Up",
  "Inactive Leads",
  "LOA",
  "Declined Application",
  "Registered Student",
  "Active Student",
  "Leave of Absence",
  "On Hold",
  "Graduated",
  "Incomplete",
  "Withdrawn Students",
  "Dismissed",
  "Refused Visa",
  "File Not Logged",
  "Offshore Student",
  "Prospective Student",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

const APP_STATUS_MAP: Record<string, LifecycleStatus> = {
  draft: "New Inquiry",
  new_inquiry: "New Inquiry",
  inquiry: "New Inquiry",
  approved: "Approved Application",
  approved_application: "Approved Application",
  pre_enrollment: "Pre-Enrollment Application",
  cancelled: "Application Cancelled",
  did_not_proceed: "Did Not Proceed",
  cloa: "CLOA",
  duplicate: "Duplicate Profile",
  follow_up: "Follow Up",
  inactive: "Inactive Leads",
  loa: "LOA",
  declined: "Declined Application",
  registered: "Registered Student",
  offer_sent: "CLOA",
  refused_visa: "Refused Visa",
  prospective: "Prospective Student",
  offshore: "Offshore Student",
  file_not_logged: "File Not Logged",
};

export function lifecycleFromApplicationStatus(status: string): LifecycleStatus {
  const key = status.trim().toLowerCase().replace(/\s+/g, "_");
  return APP_STATUS_MAP[key] ?? "New Inquiry";
}

export function lifecycleFromStudent(input: {
  standing: string;
  enrolmentStatuses: string[];
}): LifecycleStatus {
  const standing = input.standing.toLowerCase();
  const statuses = input.enrolmentStatuses.map((s) => s.toLowerCase());
  if (statuses.includes("withdrawn") && !statuses.includes("enrolled")) return "Withdrawn Students";
  if (statuses.every((s) => s === "completed") && statuses.length > 0) return "Graduated";
  if (standing.includes("probation")) return "On Hold";
  if (standing.includes("alert") || standing.includes("warning")) return "Follow Up";
  if (statuses.includes("enrolled")) return "Active Student";
  if (statuses.includes("completed")) return "Registered Student";
  return "Registered Student";
}

/** Moodle-parity activity/resource types (reference catalog — not mock course content). */
export const LMS_ACTIVITY_TYPES = [
  { code: "assignment", label: "Assignment", kind: "activity" },
  { code: "bigbluebutton", label: "BigBlueButton", kind: "activity" },
  { code: "book", label: "Book", kind: "resource" },
  { code: "chat", label: "Chat", kind: "activity" },
  { code: "checklist", label: "Checklist", kind: "activity" },
  { code: "choice", label: "Choice", kind: "activity" },
  { code: "database", label: "Database", kind: "activity" },
  { code: "externaltool", label: "External tool", kind: "activity" },
  { code: "feedback", label: "Feedback", kind: "activity" },
  { code: "file", label: "File", kind: "resource" },
  { code: "folder", label: "Folder", kind: "resource" },
  { code: "forum", label: "Forum", kind: "activity" },
  { code: "glossary", label: "Glossary", kind: "activity" },
  { code: "h5p", label: "H5P", kind: "activity" },
  { code: "imscp", label: "IMS content package", kind: "resource" },
  { code: "interactive", label: "Interactive Content", kind: "activity" },
  { code: "journal", label: "Journal", kind: "activity" },
  { code: "label", label: "Label", kind: "resource" },
  { code: "lesson", label: "Lesson", kind: "activity" },
  { code: "mcgrawhill", label: "McGraw Hill Campus", kind: "activity" },
  { code: "page", label: "Page", kind: "resource" },
  { code: "quiz", label: "Quiz", kind: "activity" },
  { code: "scorm", label: "SCORM package", kind: "activity" },
  { code: "survey", label: "Survey", kind: "activity" },
  { code: "turnitin", label: "Turnitin Assignment", kind: "activity" },
  { code: "url", label: "URL", kind: "resource" },
  { code: "wiki", label: "Wiki", kind: "activity" },
  { code: "workshop", label: "Workshop", kind: "activity" },
] as const;
