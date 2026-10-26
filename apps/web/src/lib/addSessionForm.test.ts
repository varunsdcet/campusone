import { describe, expect, it } from "vitest";
import { buildAddSessionScreenForm } from "./addSessionForm";

describe("Add Session / Offering form", () => {
  it("keeps the complete course-session workflow in the teacher theme", () => {
    const form = buildAddSessionScreenForm("BUS101");
    const group = (title: string) => form.groups.find((item) => item.title === title);
    const labels = form.groups.flatMap((item) => item.fields.map((field) => field.label));

    expect(form.submitLabel).toBe("Save Session");
    expect(form.groups.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Session Settings",
        "Session Instruction & Accesses",
        "Session Schedule",
        "Additional Session Dates",
        "Session Tuition",
        "Grading",
        "Self-Enrolment Permissions",
        "Course Withdrawal",
        "Course Content",
      ]),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "Session Name",
        "Session Type",
        "Campus / Location",
        "Classroom",
        "Maximum Enrolments",
        "Instructor(s)",
        "Start Date",
        "End Date",
        "Weekly Schedule",
        "Grading Scheme",
        "Enable LMS",
      ]),
    );
    expect(group("Session Settings")?.fields.length).toBeGreaterThan(5);
    expect(form.weeklyTimings?.days).toHaveLength(5);
    expect(form.examSchedule?.exams).toHaveLength(1);
    expect(form.gradingPreview?.schemeLabel).toBe("BUS101");
  });
});
