/** One course status for every surface (My Courses, Program Plan, Final Marks, instructor lists). */
export type CourseStatus = "completed" | "failed" | "in_progress" | "not_started" | "dropped";

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  completed: "Completed",
  failed: "Failed",
  in_progress: "In Progress",
  not_started: "Not Started",
  dropped: "Dropped Course",
};

const GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  F: 0,
  P: 0,
  I: 0,
  IP: 0,
};

export function gradePoints(letter: string) {
  return GRADE_POINTS[letter] ?? 0;
}

/** Letter grades that show blank grade-points on Final Marks (MySIS). */
export function gradePointsOrNull(letter: string): number | null {
  if (!letter || letter === "—" || letter === "P" || letter === "I" || letter === "IP" || letter === "W") {
    return null;
  }
  return gradePoints(letter);
}

/** Only an earned passing grade may award credit. Incomplete, in-progress, withdrawn and blank marks never pass. */
export function passingLetter(letter: string) {
  const normalized = letter.trim().toUpperCase();
  return normalized === "P" || (normalized !== "F" && (gradePointsOrNull(normalized) ?? 0) > 0);
}

const day = (v: string | null | undefined) => (v ?? "").slice(0, 10);

/**
 * A course carries a final mark once it is completed, or once an enrolled course has ended with published marks.
 * Until then it is "IP" (in progress) with its current percent, and stays out of credits earned and CGPA.
 */
export function hasFinalMark(row: { status: string; endsOn: string | null; averagePercent: number | null }, today: string) {
  if (row.status === "completed") return true;
  return row.status === "enrolled" && row.averagePercent != null && Boolean(row.endsOn) && day(row.endsOn) < day(today);
}

/**
 * Completed once the enrolment has a passing final mark (or is marked completed), Failed when that final letter
 * does not pass; dropped when withdrawn; otherwise Not Started before the section's start date and In Progress from
 * then on (an ended course awaiting its final mark stays In Progress).
 */
export function courseStatus(
  row: { status: string; startsOn: string | null; endsOn: string | null; averagePercent: number | null; letter?: string | null },
  today: string,
): CourseStatus {
  if (row.status === "withdrawn") return "dropped";
  if (hasFinalMark(row, today)) return row.letter && !passingLetter(row.letter) ? "failed" : "completed";
  if (row.status === "waitlisted") return "not_started";
  if (row.startsOn && day(today) < day(row.startsOn)) return "not_started";
  return "in_progress";
}
