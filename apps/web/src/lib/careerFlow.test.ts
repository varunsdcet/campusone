import { describe, expect, it } from "vitest";
import {
  CAREER_COACHING_NOTE,
  careerCoachingHref,
  opportunityApplicationHref,
  readAdvisingPrefill,
} from "./careerFlow";

describe("career coaching handoff", () => {
  it("routes to Advising with a bounded, recognized prefill", () => {
    const href = careerCoachingHref();
    const url = new URL(href, "https://campusone.test");

    expect(url.pathname).toBe("/student/advising");
    expect(readAdvisingPrefill(url.search)).toEqual({
      topic: "Career coaching",
      sourceNote: CAREER_COACHING_NOTE,
    });
  });

  it("ignores unknown sources and invalid topic lengths", () => {
    expect(readAdvisingPrefill("?topic=Hi&source=messages")).toEqual({
      topic: null,
      sourceNote: null,
    });
    expect(readAdvisingPrefill(`?topic=${"x".repeat(201)}&source=career`)).toEqual({
      topic: null,
      sourceNote: null,
    });
  });

  it("binds the career source note to the recognized coaching topic", () => {
    expect(readAdvisingPrefill("?topic=Financial+aid&source=career")).toEqual({
      topic: "Financial aid",
      sourceNote: null,
    });
  });
});

describe("opportunity application destination", () => {
  it.each([
    ["https://jobs.example.edu/apply/42", "https://jobs.example.edu/apply/42"],
    ["/student/f/st-17-practicum", "/student/f/st-17-practicum"],
  ])("accepts configured destinations", (href, expected) => {
    expect(opportunityApplicationHref(href)).toBe(expected);
  });

  it.each([
    null,
    "",
    "/student/messages",
    "/student/messages?compose=1",
    "/student/f/st-17-practicum?opportunity=42",
    "/student/success",
    "//malicious.example/apply",
    "http://jobs.example.edu/apply/42",
    "https:jobs.example.edu/apply/42",
    "https://user:secret@jobs.example.edu/apply/42",
    "javascript:alert(1)",
  ])("does not treat %s as an application destination", (href) => {
    expect(opportunityApplicationHref(href)).toBeNull();
  });
});
