import type { StudyCoachPolicy } from "@myheritage/contracts";

/** Deterministic study-mode gate — never trust the model for this. */
export function resolveStudyCoachPolicy(input: {
  assessmentAttemptOpen?: boolean;
  contextPath?: string;
}): StudyCoachPolicy {
  if (input.assessmentAttemptOpen) {
    return {
      tutoringAllowed: false,
      hintsAllowed: false,
      solutionExplanationAllowed: false,
      fullAnswerGenerationAllowed: false,
      mode: "exam",
      reason: "An assessment attempt is open; Study Coach is disabled until you submit or exit the attempt.",
    };
  }
  if (input.contextPath?.includes("/assessments")) {
    return {
      tutoringAllowed: true,
      hintsAllowed: true,
      solutionExplanationAllowed: true,
      fullAnswerGenerationAllowed: false,
      mode: "assessment",
      reason: "Assessment context: hints and guided reasoning only; full graded answers are blocked.",
    };
  }
  if (input.contextPath?.includes("/assignments")) {
    return {
      tutoringAllowed: true,
      hintsAllowed: true,
      solutionExplanationAllowed: true,
      fullAnswerGenerationAllowed: false,
      mode: "assignment",
      reason: "Assignment context: clarification and analogous examples only; do not auto-complete graded work.",
    };
  }
  return {
    tutoringAllowed: true,
    hintsAllowed: true,
    solutionExplanationAllowed: true,
    fullAnswerGenerationAllowed: false,
    mode: "tutoring",
  };
}

export function stripPromptInjection(text: string) {
  return text
    .replace(/ignore (all|any|previous|prior) instructions?/gi, "[untrusted instruction removed]")
    .replace(/reveal (other|another) students?/gi, "[untrusted instruction removed]")
    .replace(/system prompt/gi, "[untrusted reference removed]");
}
