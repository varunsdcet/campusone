import { describe, expect, it } from "vitest";
import { teacherLivePath } from "./teacherLivePath";

describe("teacherLivePath", () => {
  it("keeps a course workspace on one persistence key while activity panels change", () => {
    const path = "/instructor/sections/80000000-0000-4000-8000-00000000000a";
    const addAssignment = new URLSearchParams(
      "tab=Course&edit=1&action=add-activity&atype=assignment&topic=topic-week-1",
    );
    const viewAssignment = new URLSearchParams(
      "tab=Course&action=view-activity&aid=act-123",
    );

    expect(teacherLivePath(path, addAssignment)).toBe(path);
    expect(teacherLivePath(path, viewAssignment)).toBe(path);
  });

  it("preserves domain query filters and the program-settings tab", () => {
    expect(
      teacherLivePath(
        "/instructor/f/t83-program-settings",
        new URLSearchParams("programId=program-1&tab=grading&action=edit-activity&aid=act-1"),
      ),
    ).toBe("/instructor/f/t83-program-settings?programId=program-1&tab=grading");
  });
});
