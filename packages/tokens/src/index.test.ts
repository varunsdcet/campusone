import { describe, expect, it } from "vitest";
import { designTokens } from "./index.js";

describe("tokens", () => {
  it("uses Classtrack blue brand and navy sidebar", () => {
    expect(designTokens.color.brand).toBe("#2563EB");
    expect(designTokens.color.sidebar).toBe("#1E1E2D");
    expect(designTokens.color.borderStrong).toBe("#D1D5DB");
    expect(designTokens.color.olive).toBe("#0369A1");
  });
});
