import { describe, expect, it } from "vitest";
import { studentMayRegister, workshopSettings, type WorkshopRow } from "./workshopPolicy.js";

const legacyWorkshop: WorkshopRow = {
  id: "workshop-1",
  institutionId: "institution-1",
  code: "WS-1",
  title: "Legacy workshop",
  description: "",
  startsAt: new Date("2026-11-01T17:00:00.000Z"),
  endsAt: new Date("2026-11-01T19:00:00.000Z"),
  location: null,
  capacity: 20,
  status: "upcoming",
  settingsJson: "{}",
};

describe("workshop privacy", () => {
  it("does not expose a legacy workshop for public self-registration", () => {
    const settings = workshopSettings(legacyWorkshop, "America/Vancouver");
    expect(settings.privacy).toBe("Private Workshop");
    expect(
      studentMayRegister(
        legacyWorkshop,
        settings,
        { status: "Active", programName: "DIB", campus: "Vancouver" },
        new Date("2026-10-14T12:00:00.000Z"),
        "America/Vancouver",
      ),
    ).toMatch(/private/i);
  });

  it("keeps explicitly public workshops available", () => {
    const settings = workshopSettings(
      { ...legacyWorkshop, settingsJson: JSON.stringify({ privacy: "Public Workshop" }) },
      "America/Vancouver",
    );
    expect(settings.privacy).toBe("Public Workshop");
    expect(
      studentMayRegister(
        legacyWorkshop,
        settings,
        { status: "Active", programName: "DIB", campus: "Vancouver" },
        new Date("2026-10-14T12:00:00.000Z"),
        "America/Vancouver",
      ),
    ).toBeNull();
  });
});
