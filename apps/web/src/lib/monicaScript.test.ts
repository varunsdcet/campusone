import { describe, expect, it } from "vitest";
import { FIRST_PART_CHARS, MAX_PART_CHARS, splitScript } from "./monicaScript";

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const bare = (s: string) => words(s.replace(/[.]/g, ""));

describe("splitScript", () => {
  it("keeps every word of a 40-minute script, in order, within the part limit", () => {
    const sentence = "Supply and demand set the market price when buyers and sellers meet. ";
    const script = Array.from({ length: 60 }, (_, p) => `Paragraph ${p + 1}. ${sentence.repeat(7)}`).join("\n\n");
    const parts = splitScript(script);

    expect(words(parts.map((p) => p.text).join(" "))).toEqual(words(script));
    expect(parts[0].text.length).toBeLessThanOrEqual(FIRST_PART_CHARS);
    expect(parts.every((p) => p.text.length <= MAX_PART_CHARS)).toBe(true);
  });

  it("merges one-line list items and headings into a few natural parts", () => {
    const script = [
      "The lesson describes marketing around four major ideas:",
      "creating,",
      "communicating,",
      "delivering,",
      "and",
      "exchanging value.",
      "PRODUCT",
      "Product answers:",
      "What are we offering?",
    ].join("\n\n");
    const parts = splitScript(script);

    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe(
      "The lesson describes marketing around four major ideas: creating, communicating, delivering, and exchanging value. PRODUCT. Product answers: What are we offering?",
    );
    expect(bare(parts[0].text)).toEqual(bare(script));
  });

  it("never splits a connective such as “and” from the line that follows it", () => {
    const filler = "word ".repeat(42).trim();
    const script = [filler, "We will cover pricing,", "and", "exchanging value.", "Next point."].join("\n\n");
    const parts = splitScript(script);
    expect(parts.some((p) => p.text.startsWith("exchanging") || p.text.endsWith(" and"))).toBe(false);
    expect(parts.some((p) => p.text.includes("and exchanging value."))).toBe(true);
  });

  it("breaks a run-on sentence with no punctuation", () => {
    const script = "word ".repeat(400).trim();
    const parts = splitScript(script);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.text.length <= MAX_PART_CHARS)).toBe(true);
    expect(bare(parts.map((p) => p.text).join(" ")).length).toBe(400);
  });

  it("ignores blank input", () => {
    expect(splitScript("  \n\n  ")).toEqual([]);
  });
});
