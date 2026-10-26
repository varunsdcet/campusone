import { describe, expect, it } from "vitest";
import { courseReviewPortal } from "./courseReviewPortal";

describe("courseReviewPortal", () => {
  it("keeps administrators and registrars in the admin panel", () => {
    expect(courseReviewPortal(["admin"])).toBe("admin");
    expect(courseReviewPortal(["registrar"])).toBe("admin");
  });

  it("keeps instructors in the instructor panel", () => {
    expect(courseReviewPortal(["instructor"])).toBe("instructor");
  });
});
