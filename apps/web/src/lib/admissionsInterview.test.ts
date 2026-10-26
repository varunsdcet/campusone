import { describe, expect, it } from "vitest";
import { interviewStartUrl } from "./admissionsInterview";

describe("admissions interview start action", () => {
  it("allows a scheduled video interview with an HTTPS meeting link", () => {
    expect(interviewStartUrl({ status: "Scheduled", mode: "Video", location: "https://meet.example.edu/interview/42" }))
      .toBe("https://meet.example.edu/interview/42");
  });

  it.each([
    { status: "Completed", mode: "Video", location: "https://meet.example.edu/interview/42" },
    { status: "Scheduled", mode: "In person", location: "https://maps.example.edu/room-4" },
    { status: "Scheduled", mode: "Phone", location: "https://call.example.edu/42" },
    { status: "Scheduled", mode: "Video", location: "http://meet.example.edu/interview/42" },
    { status: "Scheduled", mode: "Video", location: "Room 204" },
  ])("does not expose Start for $status / $mode / $location", (row) => {
    expect(interviewStartUrl(row)).toBeNull();
  });
});

