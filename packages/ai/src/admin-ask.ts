import { citeOrRefuse } from "./coach.js";
import type { GroundedCoachResult } from "./types.js";

export function isAdminAskDataQuestion(question: string) {
  const q = question.toLowerCase();
  return /how many students|enrollment|enrolment|by program|utilization|seat|withdrawal|retention|probation|approvals? pending|fill rate|outstanding grading/.test(
    q,
  );
}

export function adminAskDataAnswer(input: {
  question: string;
  facts: Array<{ id: string; title: string; uri: string; text: string }>;
}): GroundedCoachResult {
  if (!input.facts.length) {
    throw Object.assign(new Error("AI refused: citations required"), {
      code: "CITATION_FAILURE",
      status: 422,
    });
  }
  const lines = input.facts.map((fact, index) => `${index + 1}. ${fact.text}`);
  const answer = citeOrRefuse({
    text: [
      "Controlled analytics (institution-scoped). No free-form SQL was run.",
      "",
      ...lines,
      "",
      "UNCERTAINTY: Causation is not inferred beyond the listed metrics.",
    ].join("\n"),
    sources: input.facts.map(({ id, title, uri }) => ({ id, title, uri })),
    tier: "read_only",
  });
  return {
    ...answer,
    suggestedActions: [
      { label: "Open students", href: "/admin/students" },
      { label: "Open sections", href: "/admin/sections" },
      { label: "Open approvals", href: "/admin/approvals" },
    ],
    claims: input.facts.map((fact) => ({
      kind: "fact" as const,
      text: fact.text,
      evidenceIds: [fact.id],
    })),
  };
}
