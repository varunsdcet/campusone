import { describe, expect, it } from "vitest";
import { containsRestrictedSecret } from "./input-policy.js";

describe("AI input privacy policy", () => {
  it("allows ordinary valid 9-digit student and reference numbers", () => {
    expect(containsRestrictedSecret("Please find student 123456789")).toBe(false);
    expect(containsRestrictedSecret("Reference 123 456 789 is on my form")).toBe(false);
  });

  it("blocks labelled government ids and credentials", () => {
    expect(containsRestrictedSecret("SIN: 123 456 789")).toBe(true);
    expect(containsRestrictedSecret("password: SecretPassword123")).toBe(true);
  });
});
