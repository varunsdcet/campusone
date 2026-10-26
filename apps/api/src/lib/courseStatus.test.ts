import { describe, expect, it } from "vitest";
import { courseStatus, passingLetter } from "./courseStatus.js";

const row = (over: Partial<Parameters<typeof courseStatus>[0]>) => ({
  status: "enrolled",
  startsOn: "2026-06-01",
  endsOn: "2026-08-28",
  averagePercent: null as number | null,
  ...over,
});

describe("courseStatus", () => {
  it("is Completed once an ended course has a published mark, or the enrolment is completed", () => {
    expect(courseStatus(row({ averagePercent: 92 }), "2026-10-07")).toBe("completed");
    expect(courseStatus(row({ averagePercent: 92, letter: "A" }), "2026-10-07")).toBe("completed");
    expect(courseStatus(row({ status: "completed" }), "2026-07-01")).toBe("completed");
    expect(courseStatus(row({ status: "completed", letter: "P" }), "2026-07-01")).toBe("completed");
  });

  it("is Failed when the final mark does not pass", () => {
    expect(courseStatus(row({ averagePercent: 40, letter: "F" }), "2026-10-07")).toBe("failed");
    expect(courseStatus(row({ status: "completed", averagePercent: 40, letter: "F" }), "2026-07-01")).toBe("failed");
  });

  it("does not fail a course before its final mark exists", () => {
    expect(courseStatus(row({ averagePercent: 40, letter: "F" }), "2026-07-01")).toBe("in_progress");
  });

  it("is Not Started before the start date and In Progress from then on", () => {
    expect(courseStatus(row({}), "2026-05-31")).toBe("not_started");
    expect(courseStatus(row({ averagePercent: 80 }), "2026-07-01")).toBe("in_progress");
    expect(courseStatus(row({}), "2026-10-07")).toBe("in_progress");
  });

  it("treats withdrawn as dropped and waitlisted as not started", () => {
    expect(courseStatus(row({ status: "withdrawn", averagePercent: 70 }), "2026-10-07")).toBe("dropped");
    expect(courseStatus(row({ status: "waitlisted" }), "2026-07-01")).toBe("not_started");
  });
});

describe("passingLetter", () => {
  it("awards credit only for earned passing grades", () => {
    expect(passingLetter("D")).toBe(true);
    expect(passingLetter("P")).toBe(true);
    expect(passingLetter("F")).toBe(false);
    expect(passingLetter("—")).toBe(false);
    expect(passingLetter("I")).toBe(false);
    expect(passingLetter("IP")).toBe(false);
    expect(passingLetter("W")).toBe(false);
  });
});
