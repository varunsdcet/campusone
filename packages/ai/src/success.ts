import { citeOrRefuse } from "./coach.js";
import type { GroundedCoachResult } from "./types.js";

export type SuccessSignalInput = {
  id: string;
  label: string;
  detail: string;
  evidenceUri: string;
};

export function isStudentSuccessQuestion(question: string) {
  const q = question.toLowerCase();
  return /at risk|risk|missing assignment|falling behind|intervention|success alert|why .*alert|need help academically/.test(
    q,
  );
}

export function studentSuccessAnswer(input: {
  level: "none" | "watch" | "elevated";
  signals: SuccessSignalInput[];
  explanation: string;
}): GroundedCoachResult {
  const sources =
    input.signals.length > 0
      ? input.signals.map((s) => ({ id: s.id, title: s.label, uri: s.evidenceUri }))
      : [{ id: "success:none", title: "Student success", uri: "/student/success" }];

  const signalLines =
    input.signals.length > 0
      ? input.signals.map((s) => `• ${s.label}: ${s.detail}`)
      : ["• No elevated academic signals from assignments/grades in the current window."];

  const answer = citeOrRefuse({
    text: [
      `Student success level: ${input.level.toUpperCase()}`,
      "",
      "Contributing signals (explainable, record-based — not psychological labels):",
      ...signalLines,
      "",
      input.explanation,
    ].join("\n"),
    sources,
    tier: "read_only",
  });

  return {
    ...answer,
    suggestedActions: [
      { label: "Open success", href: "/student/success" },
      { label: "Book advisor", href: "/student/advising" },
      { label: "Open assignments", href: "/student/assignments" },
    ],
    claims: [
      {
        kind: "fact",
        text: `Risk level ${input.level} from ${input.signals.length} signal(s).`,
        evidenceIds: sources.map((s) => s.id),
      },
      {
        kind: "uncertainty",
        text: "Personal circumstances outside academic records are not inferred.",
        evidenceIds: [],
      },
    ],
  };
}
