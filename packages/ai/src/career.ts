import { citeOrRefuse } from "./coach.js";
import type { GroundedCoachResult } from "./types.js";

export function isCareerAssistantQuestion(question: string) {
  const q = question.toLowerCase();
  return /career|resume|internship|job|employability|portfolio|interview/.test(q);
}

export function careerAssistantAnswer(input: {
  opportunities: Array<{ id: string; title: string; employerName: string; href: string; skillsJson: string }>;
}): GroundedCoachResult {
  if (!input.opportunities.length) {
    const answer = citeOrRefuse({
      text: "No open career opportunities are published for your institution right now. Employment outcomes are not guaranteed.",
      sources: [{ id: "career:empty", title: "Career", uri: "/student/f/st-20-career" }],
      tier: "read_only",
    });
    return {
      ...answer,
      suggestedActions: [{ label: "Open career", href: "/student/f/st-20-career" }],
      claims: [
        {
          kind: "uncertainty",
          text: "No published opportunities in the current catalog.",
          evidenceIds: ["career:empty"],
        },
      ],
    };
  }
  const lines = input.opportunities
    .slice(0, 8)
    .map((row, index) => `${index + 1}. ${row.title} @ ${row.employerName}`);
  const answer = citeOrRefuse({
    text: [
      "Career assistant — opportunities from institutional listings (not a job guarantee):",
      "",
      ...lines,
      "",
      "Use these to plan skills and portfolio work; outcomes are not promised.",
    ].join("\n"),
    sources: input.opportunities.map((row) => ({
      id: `career:${row.id}`,
      title: row.title,
      uri: row.href.startsWith("/") ? row.href : "/student/f/st-20-career",
    })),
    tier: "read_only",
  });
  return {
    ...answer,
    suggestedActions: [
      { label: "Open career", href: "/student/f/st-20-career" },
      { label: "Degree progress", href: "/student/degree" },
    ],
    claims: [
      {
        kind: "fact",
        text: `${input.opportunities.length} open opportunity listing(s).`,
        evidenceIds: input.opportunities.map((o) => `career:${o.id}`),
      },
    ],
  };
}
