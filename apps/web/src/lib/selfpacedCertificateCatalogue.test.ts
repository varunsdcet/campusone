import { describe, expect, it } from "vitest";
import { SELFPACED_COURSES, expectedActivityIds } from "../../../api/src/modules/selfpaced/catalogue";
import { flattenActivities } from "./selfpacedCurriculum";
import { SELFPACED_PROGRAMS } from "./selfpacedPrograms";

describe("self-paced certificate catalogue (API copy)", () => {
  it("covers every self-paced program with the same title", () => {
    expect(SELFPACED_COURSES.map((c) => [c.slug, c.title])).toEqual(SELFPACED_PROGRAMS.map((p) => [p.slug, p.title]));
  });

  it.each(SELFPACED_COURSES.map((c) => [c.slug, c] as const))("expects exactly the activities the learner sees for %s", (slug, course) => {
    expect(expectedActivityIds(course)).toEqual(flattenActivities(slug).map((r) => r.activity.id));
  });
});
