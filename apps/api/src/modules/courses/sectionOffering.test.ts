import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { holidayDates, offeringOf, plannedMeetings } from "./sectionOffering.js";
import { dateBoundsFromSessions, scheduleTextFromSessions } from "./sectionSchedule.js";

const labels = {
  campus: new Map([["camp-1", "Surrey Campus"]]),
  classroom: new Map([["room-1", "204 (30 seats)"]]),
  type: new Map([["type-1", "Face to Face"]]),
};

describe("section offering", () => {
  it("resolves timetable, location and delivery from the session settings", () => {
    const o = offeringOf(
      { startDate: "2026-09-07", endDate: "2026-12-18", campus: "camp-1", classroom: "room-1", sessionType: "type-1", meetings: [{ day: "Wednesday", start: "13:00", end: "14:00" }, { day: "Monday", start: "09:00", end: "11:00" }, { day: "Friday", start: "10:00", end: "09:00" }] },
      labels,
    )!;
    expect(o).toMatchObject({ startsOn: "2026-09-07", endsOn: "2026-12-18", location: "Surrey Campus · Room 204", deliveryMethod: "Face to Face", deliveryMode: "in_person" });
    expect(o.meetings.map((m) => m.day)).toEqual(["Monday", "Wednesday"]);
    expect(o.scheduleText).toBe("Monday: 9:00am - 11:00am\nWednesday: 1:00pm - 2:00pm");
  });

  it("generates every meeting between the dates in the institution's wall clock, across daylight saving", () => {
    const meetings = [{ day: "Monday", start: "09:00", end: "11:00" }];
    const planned = plannedMeetings({ startsOn: "2026-10-26", endsOn: "2026-11-02", meetings }, null, "America/Toronto");
    expect(planned.map((p) => p.startsAt.toISOString())).toEqual(["2026-10-26T13:00:00.000Z", "2026-11-02T14:00:00.000Z"]);
    expect(plannedMeetings({ startsOn: null, endsOn: null, meetings }, null, "America/Vancouver")).toEqual([]);
  });

  it("does not generate class sessions on single-day or ranged holidays", () => {
    const excluded = holidayDates([
      { dataJson: JSON.stringify({ date: "2026-10-26", singleDay: true }) },
      { dataJson: JSON.stringify({ date: "2026-11-02", endDate: "2026-11-03", singleDay: false }) },
    ]);
    const planned = plannedMeetings(
      { startsOn: "2026-10-19", endsOn: "2026-11-09", meetings: [{ day: "Monday", start: "09:00", end: "11:00" }] },
      null,
      "America/Toronto",
      excluded,
    );
    expect(planned.map((p) => p.startsAt.toISOString().slice(0, 10))).toEqual(["2026-10-19", "2026-11-09"]);
  });

  it("formats class-session times and dates in the institution time zone, not the server's", () => {
    const sessions = [
      { startsAt: new Date("2026-09-08T02:30:00.000Z"), endsAt: new Date("2026-09-08T04:00:00.000Z") },
      { startsAt: new Date("2026-12-19T03:00:00.000Z"), endsAt: new Date("2026-12-19T04:00:00.000Z") },
    ];
    expect(dateBoundsFromSessions(sessions, "America/Vancouver")).toEqual({ startsOn: "2026-09-07", endsOn: "2026-12-18" });
    expect(scheduleTextFromSessions(sessions.slice(0, 1), "America/Vancouver")).toMatch(/Monday/);
  });
});
