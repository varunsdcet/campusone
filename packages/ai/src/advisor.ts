import { citeOrRefuse } from "./coach.js";
import type { AdvisorProgress, GroundedCoachResult } from "./types.js";

export function isAdvisorQuestion(question: string) {
  const q = question.toLowerCase();
  return /graduate|graduation|degree|requirement|prereq|prerequisite|credits?\b|what if i drop|if i drop|drop [a-z]{2,5}\s?\d{2,4}|drop .+ course|delay graduation|fastest|program change|what courses? (do i|should i)|remaining|can i take|academic plan|advisor meeting/.test(
    q,
  );
}

export function extractDropCourseCode(question: string): string | null {
  const match =
    question.match(/drop\s+([A-Z]{2,5}\s?\d{2,4})/i) ||
    question.match(/fail(?:ing)?\s+([A-Z]{2,5}\s?\d{2,4})/i);
  return match ? match[1].replace(/\s+/g, "").toUpperCase() : null;
}

export function advisorAnswerFromProgress(input: {
  question: string;
  progress: AdvisorProgress;
  impact?: {
    courseCode: string;
    impactSummary: string[];
    downstream: string[];
    projectedCompletionTerm: string | null;
    baselineCompletionTerm: string | null;
  };
}): GroundedCoachResult {
  const sources = input.progress.evidence;
  if (!sources.length) {
    throw Object.assign(new Error("AI refused: citations required"), {
      code: "CITATION_FAILURE",
      status: 422,
    });
  }

  const remaining = input.progress.remainingRequirements
    .slice(0, 8)
    .map((r) => `- ${r.code} · ${r.title} (${r.credits} cr, ${r.status}${r.blockedByCourseCodes.length ? `; blocked by ${r.blockedByCourseCodes.join(", ")}` : ""})`)
    .join("\n");

  let text: string;
  if (input.impact) {
    const chain =
      input.impact.downstream.length > 0
        ? `${input.impact.courseCode}\n${input.impact.downstream.map((c) => `  → ${c}`).join("\n")}`
        : `${input.impact.courseCode} (no downstream prerequisites recorded)`;
    text = [
      `Dropping ${input.impact.courseCode} would affect your academic plan as follows:`,
      "",
      chain,
      "",
      "Impact:",
      ...input.impact.impactSummary.map((line) => `• ${line}`),
      "",
      `FACT: Remaining credits after this scenario: ${input.progress.remainingCredits} of ${input.progress.requiredCredits}.`,
      `INFERENCE: Projected completion ${input.impact.baselineCompletionTerm ?? "unknown"} → ${input.impact.projectedCompletionTerm ?? "unknown"} based on remaining requirements and a 3-course term load.`,
      "UNCERTAINTY: Future term offerings beyond published Fall 2026 data are not confirmed.",
      "",
      "Remaining open requirements:",
      remaining || "- None remaining in the catalog snapshot.",
    ].join("\n");
  } else {
    text = [
      `Program: ${input.progress.programName} (${input.progress.programVersionLabel}).`,
      `FACT: ${input.progress.completedCredits} credits satisfied; ${input.progress.remainingCredits} credits remain of ${input.progress.requiredCredits} required.`,
      `INFERENCE: Earliest projected completion from catalog rules: ${input.progress.projectedCompletionTerm ?? "not determined"}.`,
      input.progress.prerequisiteConflicts.length
        ? `FACT: Prerequisite conflicts: ${input.progress.prerequisiteConflicts
            .map((c) => `${c.courseCode} needs ${c.missingPrerequisites.join(", ")}`)
            .join("; ")}.`
        : "FACT: No open prerequisite conflicts in the current plan.",
      "UNCERTAINTY: Seat availability and unlisted transfer credit are not included unless recorded.",
      "",
      "Open requirements:",
      remaining || "- Catalog requirements appear satisfied.",
      "",
      input.progress.suggestedOptions.length
        ? `Suggested next steps:\n${input.progress.suggestedOptions.map((s) => `• ${s}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const answer = citeOrRefuse({ text, sources, tier: "read_only" });
  return {
    ...answer,
    suggestedActions: [
      { label: "View degree requirements", href: "/student/degree" },
      { label: "Explore alternate plan", href: "/student/degree?whatIf=1" },
      { label: "Book advisor", href: "/student/advising" },
    ],
    claims: input.progress.claims,
    analysis: input.progress,
  };
}
