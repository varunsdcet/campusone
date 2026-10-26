import { describe, expect, it } from "vitest";
import { workshopAssignedTo, workshopGradingSchemes } from "./workshops.js";

describe("workshop grading scheme options", () => {
  it("prefers active Course Management schemes and keeps the no-grading option", () => {
    expect(workshopGradingSchemes(["Standard Letter Grades", "Pass / Fail"], ["Legacy Scheme"])).toEqual([
      "None / Not Applicable",
      "Standard Letter Grades",
      "Pass / Fail",
    ]);
  });

  it("falls back to legacy schemes and removes duplicates", () => {
    expect(workshopGradingSchemes([], ["None / Not Applicable", "Legacy Scheme", "Legacy Scheme"])).toEqual(["None / Not Applicable", "Legacy Scheme"]);
  });
});

describe("instructor workshop ownership", () => {
  it("does not treat an unassigned workshop as visible or editable", () => {
    expect(workshopAssignedTo([], "instructor-1")).toBe(false);
    expect(workshopAssignedTo(["instructor-2"], "instructor-1")).toBe(false);
    expect(workshopAssignedTo(["instructor-1"], "instructor-1")).toBe(true);
  });
});
