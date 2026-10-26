/** College attendance + accountability policy constants (Heritage Community College). */
export const POLICY = {
  /** Consecutive missed class days → red flag + warning notification */
  MISS_WARN_DAYS: 2,
  /** Consecutive missed class days → pause login + require explanation */
  MISS_PAUSE_DAYS: 3,
  /** Minutes before class start to send reminders */
  PRECLASS_MINUTES: [60, 15] as const,
  /** Assignment overdue days before instructor grade SLA fires */
  GRADE_SLA_DAYS_AFTER_DUE: 7,
  CASE_KINDS: {
    STUDENT_MISS_WARN: "student.miss.warning",
    STUDENT_MISS_PAUSE: "student.miss.pause",
    STUDENT_WORK_MISS: "student.work.miss",
    TEACHER_ATTENDANCE_SLA: "teacher.attendance.sla",
    TEACHER_GRADE_SLA: "teacher.grade.sla",
  } as const,
  COMPLIANCE_SCREEN: "/instructor/f/compliance-inbox",
  STUDENT_EXPLAIN_PATH: "/student/compliance/explain",
} as const;

export type CaseKind = (typeof POLICY.CASE_KINDS)[keyof typeof POLICY.CASE_KINDS];

export function isAbsentStatus(status: string) {
  const s = status.trim().toLowerCase();
  return s === "absent" || s === "a" || s === "no-show" || s === "noshow" || s === "missing";
}

export function detectClientKind(userAgent: string): "mobile" | "desktop" | "unknown" {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|opera mini|blackberry/i.test(ua)) return "mobile";
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) return "mobile";
  if (/mozilla|chrome|safari|firefox|edg|macintosh|windows nt|linux/i.test(ua)) return "desktop";
  return "unknown";
}
