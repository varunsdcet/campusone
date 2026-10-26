import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { normalizeQuestionReferences } from "./courses.js";
import { ANSWER_FIELDS } from "./courses.spec.js";

describe("Question Bank answer references", () => {
  it("loads Referencing options from saved Question Bank questions", () => {
    expect(ANSWER_FIELDS.find((field) => field.key === "referencing")).toMatchObject({
      kind: "ref",
      ref: "questions",
      placeholder: "None",
    });
  });

  it("normalizes legacy None values without changing valid question references", () => {
    expect(
      normalizeQuestionReferences({
        id: "question-1",
        answers: [
          { id: "answer-1", referencing: "None" },
          { id: "answer-2", referencing: "question-2" },
        ],
      }).answers,
    ).toEqual([
      { id: "answer-1", referencing: "" },
      { id: "answer-2", referencing: "question-2" },
    ]);
  });
});
