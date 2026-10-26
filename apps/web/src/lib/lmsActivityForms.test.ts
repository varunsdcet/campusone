import { describe, expect, it } from "vitest";
import { formForActivity, LMS_ACTIVITY_FORMS } from "./lmsActivityForms";

describe("LMS activity forms", () => {
  it("provides learner-facing content for every activity type", () => {
    for (const code of Object.keys(LMS_ACTIVITY_FORMS)) {
      const fields = formForActivity(code).sections.flatMap((section) => section.fields);
      const contentNames = new Set(fields.map((field) => field.name));
      expect(
        ["Activity content", "Activity instructions", "Book content", "Choice question", "Page content"].some((name) =>
          contentNames.has(name),
        ),
        `${code} has no learner-facing content field`,
      ).toBe(true);
    }
  });

  it("adds universal content to database activities without mutating the source specification", () => {
    const form = formForActivity("database");
    expect(form.sections.find((section) => section.title === "Content")?.fields[0]?.name).toBe("Activity content");
    expect(LMS_ACTIVITY_FORMS.database.sections.some((section) => section.title === "Content")).toBe(false);
  });
});
