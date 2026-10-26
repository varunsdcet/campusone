import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import {
  availabilityDefaultDates,
  buildAddAvailabilityForm,
  parseAvailabilityFields,
  validateAvailabilityWindow,
} from "./profileScreens.js";

describe("Add Availability defaults", () => {
  it("starts from today and a week later instead of fixed past dates", () => {
    const now = new Date(2026, 9, 7, 9, 30);
    expect(availabilityDefaultDates(now)).toEqual({ date: "2026-10-07", endDate: "2026-10-14" });
    const fields = buildAddAvailabilityForm("", now).groups[0]!.fields;
    expect(fields.find((f) => f.label === "Date")?.value).toBe("2026-10-07");
  });

  it("defaults to a one-off slot with no pre-filled recurrence end date", () => {
    const fields = buildAddAvailabilityForm("", new Date(2026, 9, 7, 9, 30)).groups[0]!.fields;
    expect(fields.find((f) => f.label === "Set availability recurrence timeframe")?.value).toBe("");
    const endDate = fields.find((f) => f.label === "End Date");
    expect(endDate).toMatchObject({ value: "", visibleWhen: "Set availability recurrence timeframe", visibleValue: "true" });
    expect(fields.find((f) => f.label === "Days of the Week")).toMatchObject({ value: "Wednesday", visibleValue: "true" });
  });

  it("rolls over month ends", () => {
    expect(availabilityDefaultDates(new Date(2026, 11, 28, 12))).toEqual({ date: "2026-12-28", endDate: "2027-01-04" });
  });
});

describe("parseAvailabilityFields", () => {
  const base = {
    Type: "Office Hours",
    "Start hour": "09",
    "Start minute": "00",
    "End hour": "10",
    "End minute": "00",
    Date: "2026-11-20",
  };

  it("stores a one-off slot when recurrence is off, ignoring stray days and end date", () => {
    for (const flag of ["", "false", "0"]) {
      const slot = parseAvailabilityFields({
        ...base,
        "Set availability recurrence timeframe": flag,
        "End Date": "2026-10-14",
        "Days of the Week": "Mon,Tue,Wed,Thu,Fri",
      });
      expect(slot).toMatchObject({ date: "2026-11-20", endDate: "", repeats: "", day: "Friday" });
    }
  });

  it("accepts a date more than a week out", () => {
    expect(() => parseAvailabilityFields({ ...base, Date: "2027-03-01" })).not.toThrow();
  });

  it("repeats on the chosen days until the end date when recurrence is on", () => {
    const slot = parseAvailabilityFields({
      ...base,
      "Set availability recurrence timeframe": "true",
      "End Date": "2026-12-18",
      "Days of the Week": "Monday,Wednesday",
    });
    expect(slot).toMatchObject({ endDate: "2026-12-18", repeats: "Mon,Wed", day: "Mon · Wed" });
  });

  it("allows an open-ended recurrence and falls back to the start date's weekday", () => {
    const slot = parseAvailabilityFields({ ...base, "Set availability recurrence timeframe": "1", "Days of the Week": "" });
    expect(slot).toMatchObject({ endDate: "", repeats: "Fri" });
  });

  it("only rejects an end date before the start when recurrence is on", () => {
    expect(() =>
      parseAvailabilityFields({ ...base, "Set availability recurrence timeframe": "true", "End Date": "2026-11-01" }),
    ).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => parseAvailabilityFields({ ...base, "End Date": "2026-11-01" })).not.toThrow();
  });
});

describe("validateAvailabilityWindow", () => {
  const ok = { start: "09:00", end: "10:00", date: "2026-10-07", endDate: "2026-10-14" };

  it("accepts a valid slot", () => {
    expect(() => validateAvailabilityWindow(ok)).not.toThrow();
    expect(() => validateAvailabilityWindow({ ...ok, endDate: "" })).not.toThrow();
  });

  it("rejects bad dates, inverted times and a recurrence ending before it starts", () => {
    for (const input of [
      { ...ok, date: "" },
      { ...ok, date: "07/10/2026" },
      { ...ok, end: "09:00" },
      { ...ok, start: "25:00" },
      { ...ok, endDate: "2026-10-01" },
    ]) {
      expect(() => validateAvailabilityWindow(input)).toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    }
  });
});
