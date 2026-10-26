import { describe, expect, it } from "vitest";
import { DESIGNATION_FIELDS } from "./programs.spec.js";

describe("program designation previous-state options", () => {
  it("keeps standard previous designations available before custom rows exist", () => {
    const average = DESIGNATION_FIELDS.find((field) => field.key === "averagePrevious");
    const failing = DESIGNATION_FIELDS.find((field) => field.key === "failingPrevious");

    expect(average).toMatchObject({
      dyn: "designationLabels",
      dynExtra: ["None", "Standing", "Honours", "Probation"],
      dflt: "None",
    });
    expect(failing).toMatchObject({
      dyn: "designationLabels",
      dynExtra: ["None", "Probation", "Suspension", "Withdrawal"],
      dflt: "None",
    });
  });
});
