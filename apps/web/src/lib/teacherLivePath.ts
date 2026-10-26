const TRANSIENT_TEACHER_SCREEN_PARAMS = [
  "more",
  "action",
  "qtype",
  "qid",
  "aid",
  "atype",
  "topic",
  "sid",
  "edit",
] as const;

/**
 * Build the stable domain-screen path used for reads and mutations.
 *
 * Course workspace controls put their current panel/activity in the browser URL. Those values
 * are navigation state, not part of the persisted screen identity; including them would save an
 * activity under a temporary URL that disappears as soon as the form returns to the course.
 */
export function teacherLivePath(path: string, searchParams: URLSearchParams) {
  const liveParams = new URLSearchParams(searchParams.toString());
  const keepTab = path.includes("t83") || path.includes("program-settings");
  if (!keepTab) liveParams.delete("tab");
  for (const key of TRANSIENT_TEACHER_SCREEN_PARAMS) liveParams.delete(key);
  const qs = liveParams.toString();
  return qs ? `${path}?${qs}` : path;
}
