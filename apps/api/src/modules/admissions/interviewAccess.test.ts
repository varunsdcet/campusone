import { describe, expect, it } from "vitest";
import { safeInterviewMeetingUrl } from "./interviewAccess.js";

describe("admissions interview links", () => {
  it("accepts an HTTPS meeting URL", () => {
    expect(safeInterviewMeetingUrl("https://meet.example.edu/room-1")).toBe("https://meet.example.edu/room-1");
  });

  it.each(["Room 201", "javascript:alert(1)", "http://meet.example.edu/room", ""])('rejects non-HTTPS location %s', (value) => {
    expect(safeInterviewMeetingUrl(value)).toBeNull();
  });
});
