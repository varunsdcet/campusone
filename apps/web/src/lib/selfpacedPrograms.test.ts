import { describe, expect, it } from "vitest";
import { getSelfpacedProgram, SELFPACED_PROGRAMS } from "./selfpacedPrograms";

describe("live Heritage self-paced catalogue snapshot", () => {
  it("keeps the eight public HCCB programs plus CAP 101 and their source totals", () => {
    expect(SELFPACED_PROGRAMS).toHaveLength(9);
    expect(SELFPACED_PROGRAMS.map(({ slug, hours, chapters, priceCad }) => ({ slug, hours, chapters, priceCad }))).toEqual([
      { slug: "cap-101-applied-business-capstone", hours: 120, chapters: 12, priceCad: 100 },
      { slug: "office-administration-diploma", hours: 361, chapters: 11, priceCad: 9500 },
      { slug: "pharmacy-assistant", hours: 135.5, chapters: 9, priceCad: 0 },
      { slug: "red-seal-exam-preparation-electrician", hours: 350, chapters: 5, priceCad: 3990 },
      { slug: "red-seal-exam-preparation-carpentry", hours: 350, chapters: 5, priceCad: 3990 },
      { slug: "red-seal-exam-preparation-plumber", hours: 350, chapters: 5, priceCad: 3999 },
      { slug: "red-seal-exam-preparation-chef", hours: 350, chapters: 15, priceCad: 3990 },
      { slug: "red-seal-exam-preparation-hvac", hours: 350, chapters: 5, priceCad: 3990 },
      { slug: "red-seal-exam-preparation-machinist", hours: 200, chapters: 1, priceCad: 3999 },
    ]);
  });

  it("has a no-card testing course with the official image", () => {
    const pharmacy = getSelfpacedProgram("pharmacy-assistant");
    expect(pharmacy?.priceCad).toBe(0);
    expect(pharmacy?.image).toContain("hccbconline.com/api/files/public/");
  });
});
