import { describe, expect, it } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";
import { assertInstructorMasterDataBoundary } from "./instructor.service.js";

const user = {
  accountId: "00000000-0000-4000-8000-000000000001",
  personId: "00000000-0000-4000-8000-000000000002",
  institutionId: "00000000-0000-4000-8000-000000000003",
  sessionId: "00000000-0000-4000-8000-000000000004",
  sub: "00000000-0000-4000-8000-000000000001",
  roles: ["instructor"],
} satisfies SessionClaims;

describe("instructor master-data boundary", () => {
  it.each([
    ["/instructor/f/t43-create-student-profile", "Save Student Profile"],
    ["/instructor/f/t55-add-course-form", "Create Course"],
    ["/instructor/f/t77-course-admin", "Create Session"],
    ["/instructor/f/t74-add-term", "Save Term"],
    ["/instructor/f/t70-add-badge", "Create Badge"],
    ["/instructor/f/t83-program-settings", "Delete Program"],
  ])("blocks %s / %s", (path, action) => {
    expect(() => assertInstructorMasterDataBoundary(user, path, action.toLowerCase())).toThrow(
      "restricted to administrators and registrars",
    );
  });

  it("keeps teaching actions available", () => {
    expect(() =>
      assertInstructorMasterDataBoundary(user, "/instructor/f/t19-create-edit-assessment", "publish assessment"),
    ).not.toThrow();
    expect(() =>
      assertInstructorMasterDataBoundary(user, "/instructor/f/t08-my-courses-detail", "award course badge"),
    ).not.toThrow();
  });
});
