import { describe, expect, it } from "vitest";
import { getSelfpacedProgram, SELFPACED_PROGRAMS } from "./selfpacedPrograms";

/** D3: selected programme id and price must stay bound through checkout payload. */
describe("selfpaced checkout program binding", () => {
  it("resolves each catalog slug to its own id and priceCad", () => {
    for (const p of SELFPACED_PROGRAMS) {
      const found = getSelfpacedProgram(p.slug);
      expect(found?.id).toBe(p.id);
      expect(found?.priceCad).toBe(p.priceCad);
      expect(found?.title).toBe(p.title);
    }
  });

  it("does not confuse Pharmacy price with Office Administration", () => {
    const pharmacy = getSelfpacedProgram("pharmacy-assistant");
    const office = getSelfpacedProgram("office-administration-diploma");
    // Intentionally free while the full learner flow is under acceptance testing.
    expect(pharmacy?.priceCad).toBe(0);
    expect(office?.priceCad).toBe(9500);
    expect(pharmacy?.id).not.toBe(office?.id);
  });

  it("keeps the HCCB catalogue plus the published CAP 101 course", () => {
    expect(SELFPACED_PROGRAMS).toHaveLength(9);
    expect(getSelfpacedProgram("cap-101-applied-business-capstone")?.priceCad).toBe(100);
    expect(getSelfpacedProgram("introduction-to-hrm")).toBeUndefined();
    expect(getSelfpacedProgram("computer-applications-in-business")).toBeUndefined();
    expect(getSelfpacedProgram("electrical-fundamentals")).toBeUndefined();
  });

  it("rejects unknown slug", () => {
    expect(getSelfpacedProgram("not-a-real-program")).toBeUndefined();
  });
});
