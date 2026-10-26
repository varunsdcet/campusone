import { citeOrRefuse } from "./coach.js";
import { resolveStudyCoachPolicy, stripPromptInjection } from "./policy.js";
import type { GroundedCoachResult } from "./types.js";

export type StudyContentFact = {
  id: string;
  title: string;
  uri: string;
  text: string;
};

export function isStudyCoachQuestion(question: string) {
  const q = question.toLowerCase();
  // Do not treat "what is my GPA/grade" as tutoring — those belong to campus_coach / grades.
  if (/\b(gpa|grade|score|mark|attendance|fee|tuition|balance)\b/.test(q)) return false;
  return /explain|help me understand|quiz me|flashcard|revise|revision|summarize|practi[cs]e|how does|study|tutor|normalize|normalization|hint|teach me|walk me through/.test(
    q,
  );
}

function progressionMode(question: string): "hint" | "quiz" | "explain" {
  const q = question.toLowerCase();
  if (/quiz|practi[cs]e|flashcard|test me/.test(q)) return "quiz";
  if (/hint|stuck|don't get|dont get|confused/.test(q)) return "hint";
  return "explain";
}

export function studyCoachAnswer(input: {
  question: string;
  content: StudyContentFact[];
  contextPath?: string;
  assessmentAttemptOpen?: boolean;
}): GroundedCoachResult & { studyPolicy: ReturnType<typeof resolveStudyCoachPolicy> } {
  const studyPolicy = resolveStudyCoachPolicy({
    assessmentAttemptOpen: input.assessmentAttemptOpen,
    contextPath: input.contextPath,
  });

  if (!studyPolicy.tutoringAllowed) {
    const sources = input.content.slice(0, 1).map(({ id, title, uri }) => ({ id, title, uri }));
    const fallbackSources =
      sources.length > 0
        ? sources
        : [{ id: "policy:study", title: "Study Coach policy", uri: "/student/study" }];
    const answer = citeOrRefuse({
      text: studyPolicy.reason ?? "Study Coach is not available in this mode.",
      sources: fallbackSources,
      tier: "read_only",
    });
    return {
      ...answer,
      suggestedActions: [{ label: "Open assessments", href: "/student/assessments" }],
      claims: [
        {
          kind: "uncertainty",
          text: studyPolicy.reason ?? "Study Coach blocked by assessment policy.",
          evidenceIds: [],
        },
      ],
      studyPolicy,
    };
  }

  if (!input.content.length) {
    throw Object.assign(new Error("AI refused: citations required"), {
      code: "CITATION_FAILURE",
      status: 422,
    });
  }

  const sanitized = input.content.map((fact) => ({
    ...fact,
    text: stripPromptInjection(fact.text),
  }));
  const mode = progressionMode(input.question);
  const lead =
    mode === "quiz"
      ? "Practice from your approved course material (not a graded assessment):"
      : mode === "hint"
        ? "Guided hint from approved material — try reasoning before asking for a fuller explanation:"
        : "Clarification grounded in instructor-approved / catalog material:";

  const body =
    mode === "quiz"
      ? sanitized
          .slice(0, 3)
          .map(
            (fact, index) =>
              `${index + 1}. Based on “${fact.title}”: restate one key idea in your own words, then check against: ${fact.text.slice(0, 180)}…`,
          )
          .join("\n")
      : sanitized
          .slice(0, 4)
          .map((fact, index) => `${index + 1}. ${fact.title}: ${fact.text}`)
          .join("\n");

  const integrityNote = studyPolicy.fullAnswerGenerationAllowed
    ? ""
    : "\n\nAcademic integrity: Study Coach will not complete graded submissions for you.";

  const answer = citeOrRefuse({
    text: `${lead}\n\n${body}${integrityNote}`,
    sources: sanitized.map(({ id, title, uri }) => ({ id, title, uri })),
    tier: "read_only",
  });

  return {
    ...answer,
    suggestedActions: [
      { label: "Open courses", href: "/student/courses" },
      { label: "Open assignments", href: "/student/assignments" },
      { label: "Ask CampusOne", href: "/student/ask" },
    ],
    claims: [
      {
        kind: "fact",
        text: `Answer grounded in ${sanitized.length} approved content source(s).`,
        evidenceIds: sanitized.map((s) => s.id),
      },
      {
        kind: "action",
        text: "Use practice prompts for revision; submit graded work yourself.",
        evidenceIds: [],
      },
    ],
    studyPolicy,
  };
}
