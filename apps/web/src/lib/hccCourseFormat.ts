const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."] as const;
const WEEKDAYS_SHORT = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."] as const;

/** Date-only values (YYYY-MM-DD) are calendar days, so they are read at local noon instead of UTC midnight. */
export function parseDate(value: string) {
  const raw = value.includes("T") ? value : `${value.slice(0, 10)}T12:00:00`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** HCC-style: "Aug. 4, 2026 (Tue.)" */
export function formatHccDate(value: string | null | undefined) {
  if (!value) return null;
  const d = parseDate(value);
  if (!d) return value;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (${WEEKDAYS_SHORT[d.getDay()]})`;
}

/** HCC-style range without weekday: "Sep. 2, 2026 - Sep. 15, 2026" */
export function formatHccDateRange(startsOn: string | null | undefined, endsOn: string | null | undefined) {
  const start = startsOn ? parseDate(startsOn) : null;
  const end = endsOn ? parseDate(endsOn) : null;
  if (!start && !end) return null;
  const fmt = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return fmt(start);
  return end ? fmt(end) : null;
}

export function statusLabel(enrolmentStatus: string, startsOn?: string | null) {
  if (enrolmentStatus === "enrolled") return startsOn && startsOn.slice(0, 10) > todayIso() ? "Not Started" : "In Progress";
  if (enrolmentStatus === "waitlisted") return "Waitlisted";
  if (enrolmentStatus === "completed") return "Completed";
  if (enrolmentStatus === "withdrawn") return "Withdrawn";
  return enrolmentStatus;
}

export function statusTone(enrolmentStatus: string) {
  if (enrolmentStatus === "enrolled") return "progress";
  if (enrolmentStatus === "waitlisted") return "muted";
  if (enrolmentStatus === "completed") return "done";
  if (enrolmentStatus === "withdrawn") return "muted";
  return "muted";
}

type CourseRowStatus = { enrolmentStatus: string; courseStatus?: string | null; startsOn?: string | null };

const COURSE_STATUS_LABEL: Record<string, string> = { completed: "Completed", failed: "Failed", in_progress: "In Progress", not_started: "Not Started", dropped: "Withdrawn" };
const COURSE_STATUS_TONE: Record<string, string> = { completed: "done", failed: "danger", in_progress: "progress", not_started: "muted", dropped: "muted" };

/** The API's shared course status (Completed / Failed once a final mark exists), falling back to the enrolment status. */
export function courseStatusLabel(c: CourseRowStatus) {
  if (c.enrolmentStatus === "waitlisted" || !c.courseStatus) return statusLabel(c.enrolmentStatus, c.startsOn);
  return COURSE_STATUS_LABEL[c.courseStatus] ?? statusLabel(c.enrolmentStatus, c.startsOn);
}

export function courseStatusTone(c: CourseRowStatus) {
  if (c.enrolmentStatus === "waitlisted" || !c.courseStatus) return statusTone(c.enrolmentStatus);
  return COURSE_STATUS_TONE[c.courseStatus] ?? statusTone(c.enrolmentStatus);
}
