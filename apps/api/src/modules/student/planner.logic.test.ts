import { describe, expect, it } from "vitest";
import { attendanceProjection, localDateKey, parsePlannerDraft, parseStudyAid, studyAidPrompt } from "./planner.logic.js";

describe("study aid generation", () => {
  it("asks for kind-specific formats", () => {
    expect(studyAidPrompt("quiz")).toContain('"answerIndex"');
    expect(studyAidPrompt("flashcards")).toContain("10-12 flashcards");
    expect(studyAidPrompt("flashcards")).toContain("worked example");
    expect(studyAidPrompt("flashcards")).not.toContain("answerIndex");
  });

  it("keeps valid quiz questions with options and drops broken ones", () => {
    const raw = "```json\n" + JSON.stringify({
      title: "Heaps quiz",
      items: [
        { front: "Heap root holds?", options: ["Max", "Min", "Median", "Any"], answerIndex: 1, back: "A min-heap keeps the smallest key at the root." },
        { front: "No options", back: "x" },
        { front: "Bad index", options: ["A", "B"], answerIndex: 5 },
        { front: "Duplicate options", options: ["A", "A"], answerIndex: 0 },
        { question: "Fallback fields", options: ["Yes", "No"], answerIndex: 0 },
      ],
    }) + "\n```";
    const aid = parseStudyAid(raw, "quiz", "CS301 · Week 3", () => 0);
    expect(aid.title).toBe("Heaps quiz");
    expect(aid.items).toEqual([
      { front: "Heap root holds?", options: ["Max", "Min", "Median", "Any"], answerIndex: 1, back: "A min-heap keeps the smallest key at the root.", source: "CS301 · Week 3" },
      { front: "Fallback fields", options: ["Yes", "No"], answerIndex: 0, back: "Correct answer: Yes", source: "CS301 · Week 3" },
    ]);
  });

  it("shuffles quiz options and keeps the answer index pointing at the correct option", () => {
    const sorts = [0.9, 0.1, 0.5, 0.3];
    const aid = parseStudyAid(JSON.stringify({ items: [{ front: "BFS uses?", options: ["Queue", "Stack", "Heap", "Set"], answerIndex: 0, back: "FIFO." }] }), "quiz", "CS301", () => sorts.shift()!);
    expect(aid.items[0].options).toEqual(["Stack", "Set", "Heap", "Queue"]);
    expect(aid.items[0].options![aid.items[0].answerIndex!]).toBe("Queue");
  });

  it("keeps flashcards with both sides and stamps the source reference", () => {
    const aid = parseStudyAid(JSON.stringify({ items: [{ front: "BFS uses?", back: "A queue.", source: "made up" }, { front: "Empty back", back: "" }] }), "flashcards", "CS301 syllabus topic");
    expect(aid).toEqual({ title: "flashcards study aid", items: [{ front: "BFS uses?", back: "A queue.", source: "CS301 syllabus topic" }] });
  });

  it("drops duplicate and context-dependent flashcards", () => {
    const aid = parseStudyAid(JSON.stringify({ items: [
      { front: "Which data structure does BFS use?", back: "A FIFO queue." },
      { front: "which data structure does BFS use", back: "Same card again." },
      { front: "Them on the campus map graph?", back: "Trace them." },
    ] }), "flashcards", "CS301");
    expect(aid.items.map((row) => row.front)).toEqual(["Which data structure does BFS use?"]);
  });
});

describe("student planner logic", () => {
  it("calculates attendance recovery and safe misses", () => {
    expect(attendanceProjection(8, 10, 80)).toMatchObject({ rate: 80, canMiss: 0, neededConsecutive: 0 });
    expect(attendanceProjection(7, 10, 80)).toMatchObject({ rate: 70, neededConsecutive: 5 });
    expect(attendanceProjection(9, 10, 80).canMiss).toBe(1);
  });

  it("formats dates in the institution timezone", () => {
    expect(localDateKey(new Date("2026-10-16T02:00:00.000Z"), "America/Vancouver")).toBe("2026-10-15");
  });

  it("accepts only valid sessions and owned academic references", () => {
    const draft = parsePlannerDraft(JSON.stringify({
      title: "Exam week",
      rationale: "Prioritise the nearest deadline.",
      sessions: [{ title: "Review", scheduledAt: "2026-10-17T18:00:00.000Z", durationMinutes: 50, sectionId: "mine", assignmentId: "other" }],
    }), new Set(["mine"]), new Set(["owned"]));
    expect(draft.sessions[0]).toMatchObject({ sectionId: "mine" });
    expect(draft.sessions[0]).not.toHaveProperty("assignmentId");
  });

  it("rejects an empty or unusable AI plan", () => {
    expect(() => parsePlannerDraft('{"sessions":[]}', new Set(), new Set())).toThrow("no usable");
  });
});
