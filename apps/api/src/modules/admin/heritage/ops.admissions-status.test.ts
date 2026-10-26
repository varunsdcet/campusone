import { describe, expect, it } from "vitest";
import { actionFieldEditConflict } from "./ops.js";
import { ENTITIES } from "./ops.spec.js";

describe("admissions edit-form status overrides", () => {
  it.each([
    ["applications", "declined", "offered"],
    ["appDocuments", "missing", "accepted"],
    ["interviews", "Cancelled", "Completed"],
    ["offers", "withdrawn", "pending"],
  ] as const)("allows %s status to change from %s to %s", (entity, from, to) => {
    expect(actionFieldEditConflict(ENTITIES[entity], { status: from }, { status: to })).toBeNull();
  });

  it("keeps other workflow-managed screens protected", () => {
    expect(actionFieldEditConflict(ENTITIES.intakes, { status: "Closed" }, { status: "Waitlist only" })).toContain(
      'Status cannot change from "Closed" to "Waitlist only"',
    );
  });

  it("collects interview results only after the schedule exists", () => {
    const byKey = new Map(ENTITIES.interviews.fields.map((field) => [field.key, field]));
    expect(byKey.get("status")).toMatchObject({ dflt: "Scheduled", editOnly: true });
    expect(byKey.get("score")?.editOnly).toBe(true);
    expect(byKey.get("recommendation")?.editOnly).toBe(true);
    expect(byKey.get("notes")?.editOnly).toBe(true);
  });
});
