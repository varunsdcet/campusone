import { describe, expect, it } from "vitest";
import {
  CAREER_PRACTICUM_HREF,
  adminCareerOpportunityHref,
  httpsCareerOpportunityHref,
  studentCareerOpportunityHref,
} from "./careerOpportunityLink.js";

describe("career opportunity links", () => {
  it("accepts only valid HTTPS application URLs for admin persistence", () => {
    expect(httpsCareerOpportunityHref(" https://jobs.example/apply?id=42 ")).toBe("https://jobs.example/apply?id=42");
    expect(httpsCareerOpportunityHref("http://jobs.example/apply")).toBeNull();
    expect(httpsCareerOpportunityHref("https://")).toBeNull();
    expect(httpsCareerOpportunityHref("https://jobs.example/apply now")).toBeNull();
    expect(httpsCareerOpportunityHref("https:jobs.example/apply")).toBeNull();
    expect(httpsCareerOpportunityHref("https://user:secret@jobs.example/apply")).toBeNull();
    expect(httpsCareerOpportunityHref("javascript:alert(1)")).toBeNull();
    expect(httpsCareerOpportunityHref("//jobs.example/apply")).toBeNull();
  });

  it("keeps only HTTPS and the exact approved practicum path actionable for students", () => {
    expect(studentCareerOpportunityHref("https://jobs.example/apply")).toBe("https://jobs.example/apply");
    expect(studentCareerOpportunityHref(CAREER_PRACTICUM_HREF)).toBe(CAREER_PRACTICUM_HREF);
    expect(studentCareerOpportunityHref("/student/messages")).toBeNull();
    expect(studentCareerOpportunityHref("/student/career")).toBeNull();
    expect(studentCareerOpportunityHref("/student/f/st-20-career")).toBeNull();
    expect(studentCareerOpportunityHref(null)).toBeNull();
  });

  it("normalizes legacy links while preserving the approved practicum value in admin", () => {
    expect(adminCareerOpportunityHref("https://jobs.example/apply")).toBe("https://jobs.example/apply");
    expect(adminCareerOpportunityHref("/student/messages")).toBe("");
    expect(adminCareerOpportunityHref(CAREER_PRACTICUM_HREF)).toBe(CAREER_PRACTICUM_HREF);
  });
});
