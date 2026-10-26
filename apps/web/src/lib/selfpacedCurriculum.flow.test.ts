import { describe, expect, it } from "vitest";
import { getCurriculum } from "./selfpacedCurriculum";
import { drawAssessmentQuestions, PASS_MARK } from "./selfpacedEngine";

describe("selfpaced curriculum flow", () => {
  it("orders chapter activities reading → lecture → practice → matching → assessment", () => {
    const chapters = getCurriculum("office-administration-diploma");
    expect(chapters.length).toBeGreaterThan(1);
    const content = chapters[0];
    expect(content.activities.map((a) => a.type)).toEqual([
      "reading",
      "reading",
      "lecture",
      "quiz",
      "matching",
      "assessment",
    ]);
  });

  it("ends with a final exam assessment", () => {
    const chapters = getCurriculum("office-administration-diploma");
    const last = chapters[chapters.length - 1];
    const final = last.activities.find((a) => a.type === "assessment");
    expect(final?.isFinal).toBe(true);
    expect((final?.questionBank || []).length).toBeGreaterThanOrEqual(40);
  });

  it("does not put every correct answer on option b", () => {
    const ch = getCurriculum("red-seal-exam-preparation-electrician")[0];
    const bank = ch.activities.find((a) => a.type === "assessment")?.questionBank || [];
    const positions = new Set(bank.slice(0, 20).map((q) => q.correct));
    expect(positions.size).toBeGreaterThan(1);
  });

  it("matching pairs avoid concept N placeholders", () => {
    const ch = getCurriculum("red-seal-exam-preparation-electrician")[0];
    const match = ch.activities.find((a) => a.type === "matching");
    for (const p of match?.pairs || []) {
      expect(p.left.toLowerCase()).not.toMatch(/concept \d/);
    }
  });

  it("drawAssessmentQuestions freezes a shuffled subset", () => {
    const ch = getCurriculum("pharmacy-assistant")[0];
    const bank = ch.activities.find((a) => a.type === "assessment")?.questionBank || [];
    const drawn = drawAssessmentQuestions(bank, 16, "seed-a");
    expect(drawn.length).toBe(16);
    expect(PASS_MARK).toBe(70);
  });
});
