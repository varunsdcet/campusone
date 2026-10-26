/** MB-08 scaffold: instructor grades read-only with guard (native UI lands with Expo). */
export function readOnlyGradeView(input: { score: number; maxScore: number; published: boolean }) {
  if (!input.published) {
    return { visible: false, reason: "draft_hidden" as const };
  }
  return {
    visible: true,
    label: `${input.score}/${input.maxScore}`,
    guard: "read_only" as const,
  };
}
