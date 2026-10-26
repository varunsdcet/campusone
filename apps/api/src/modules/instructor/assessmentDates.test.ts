import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { parseDateOrOffset } from "./instructor.service.js";

describe("parseDateOrOffset", () => {
  it("opens a date-only open date at the start of that day in the institution's time zone", () => {
    expect(parseDateOrOffset("2026-10-07", 0, "America/Vancouver").toISOString()).toBe("2026-10-07T07:00:00.000Z");
    expect(parseDateOrOffset("2026-01-07", 0, "America/Vancouver").toISOString()).toBe("2026-01-07T08:00:00.000Z");
  });

  it("keeps explicit date-times as given", () => {
    expect(parseDateOrOffset("2026-10-07T15:30:00.000Z", 0, "America/Vancouver").toISOString()).toBe("2026-10-07T15:30:00.000Z");
  });
});
