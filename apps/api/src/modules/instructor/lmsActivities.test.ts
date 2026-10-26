import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  assignment: { updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  submission: { count: vi.fn() },
  gradeItem: { count: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import {
  activityContentFromForm,
  findOverlayActivity,
  parseAssignmentSettings,
  parseExternalUrl,
  retireLmsAssignment,
  saveLmsAssignment,
  workspaceSectionId,
} from "./lmsActivities.js";

const institutionId = "00000000-0000-4000-8000-000000000051";
const sectionId = "40000000-0000-4000-8000-000000000051";

beforeEach(() => {
  vi.clearAllMocks();
  db.assignment.create.mockImplementation(async ({ data }: { data: { id: string } }) => ({ id: data.id }));
});

describe("workspace activity content", () => {
  it("keeps page content, description and hidden availability", () => {
    const content = activityContentFromForm("PAGE", {
      Name: "Week 1 reading",
      "Page content": "<p>Read chapter 1</p><script>alert(1)</script>",
      Description: "Intro",
      Availability: "Hide on course page",
    });
    expect(content.body).toContain("Read chapter 1");
    expect(content.body).not.toContain("<script");
    expect(content.description).toBe("Intro");
    expect(content.hidden).toBe(true);
    expect(content.settings).toMatchObject({ Name: "Week 1 reading", Availability: "Hide on course page" });
  });

  it("requires page content for a page", () => {
    expect(() => activityContentFromForm("PAGE", { Name: "Empty" })).toThrow("Page content is required");
  });

  it("keeps book content and a choice prompt as activity body content", () => {
    expect(activityContentFromForm("BOOK", { Name: "Handbook", "Book content": "Read chapters 1 and 2" }).body).toContain(
      "Read chapters 1 and 2",
    );
    const choice = activityContentFromForm("CHOICE", {
      Name: "Class time",
      "Choice question": "Which session works best?",
      "Option 1": "Morning",
    });
    expect(choice.body).toContain("Which session works best?");
    expect(choice.settings["Option 1"]).toBe("Morning");
  });

  it("keeps universal content and every entered setting for any activity type", () => {
    const content = activityContentFromForm("DATABASE", {
      Name: "Research sources",
      Description: "Add one source used in your paper.",
      "Activity content": "Include the title, author and publication date.",
      "Approval required": "yes",
      "Maximum number of entries": "5",
    });
    expect(content.body).toContain("Include the title, author and publication date.");
    expect(content.description).toBe("Add one source used in your paper.");
    expect(content.settings).toMatchObject({
      "Activity content": "Include the title, author and publication date.",
      "Approval required": "yes",
      "Maximum number of entries": "5",
    });
  });

  it("keeps the external URL of a URL activity", () => {
    const content = activityContentFromForm("URL", { Name: "Docs", "External URL": "https://example.org/guide" });
    expect(content.url).toBe("https://example.org/guide");
    expect(content.hidden).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "/student/home", "example.org"])("rejects unsafe URL %s", (url) => {
    expect(() => parseExternalUrl(url)).toThrow(/https:\/\/ or http:\/\//);
  });

  it("parses assignment submission rules", () => {
    const content = activityContentFromForm("ASSIGNMENT", {
      Name: "Essay",
      "Activity instructions": "500 words",
      "Allow submissions from": "2026-10-01T09:00:00.000Z",
      "Due date": "2026-10-10T23:59:00.000Z",
      "Cut-off date": "2026-10-12T23:59:00.000Z",
      "File submissions": "Yes",
      "Online text": "Yes",
      "Maximum number of uploaded files": "2",
      "Maximum submission size": "5 MB",
      "Accepted file types": ".pdf, docx",
      "Maximum grade": "50",
      "Course Mark Weight": "15",
    });
    expect(content.assignment).toEqual({
      instructions: "500 words",
      availableFrom: "2026-10-01T09:00:00.000Z",
      dueAt: "2026-10-10T23:59:00.000Z",
      cutoffAt: "2026-10-12T23:59:00.000Z",
      maxScore: 50,
      weightPercent: 15,
      fileSubmissions: true,
      onlineText: true,
      maxFiles: 2,
      maxFileBytes: 5 * 1024 * 1024,
      acceptedTypes: ".pdf,.docx",
    });
  });

  it("rejects inconsistent assignment dates and empty submission types", () => {
    expect(() =>
      parseAssignmentSettings({ "Allow submissions from": "2026-10-10T00:00:00Z", "Due date": "2026-10-01T00:00:00Z" }),
    ).toThrow("Due date must be after the date submissions open");
    expect(() =>
      parseAssignmentSettings({ "Due date": "2026-10-10T00:00:00Z", "Cut-off date": "2026-10-01T00:00:00Z" }),
    ).toThrow("Cut-off date must be on or after the due date");
    expect(() => parseAssignmentSettings({ "File submissions": "No", "Online text": "No" })).toThrow(
      "Choose at least one submission type",
    );
  });

  it("rejects accepted file types students could never upload", () => {
    expect(() => parseAssignmentSettings({ "Accepted file types": ".txt" })).toThrow(/Remove \.txt/);
  });

  it("finds activities in topics and in template edits", () => {
    const overlay = {
      topicActivities: { "topic-1": [{ id: "act-1", assignmentId: "a-1" }] },
      activityEdits: { "act-course-syllabus": { name: "Syllabus" } },
    };
    expect(findOverlayActivity(overlay, "act-1")).toEqual({ topicId: "topic-1", activity: { id: "act-1", assignmentId: "a-1" } });
    expect(findOverlayActivity(overlay, "act-course-syllabus")).toEqual({ topicId: null, activity: { name: "Syllabus" } });
    expect(findOverlayActivity(overlay, "missing")).toBeNull();
  });

  it("reads the section id from a workspace path", () => {
    expect(workspaceSectionId(`/instructor/sections/${sectionId}?tab=Course`)).toBe(sectionId);
    expect(workspaceSectionId("/instructor/sections")).toBeNull();
  });
});

describe("workspace assignments are real assignment rows", () => {
  const settings = { maxScore: 100, weightPercent: 10, fileSubmissions: true, onlineText: false, acceptedTypes: ".pdf" };

  it("creates a hidden assignment with the submission rules", async () => {
    const id = await saveLmsAssignment({ institutionId, sectionId, title: "Essay", settings, hidden: true });
    expect(id).toBeTruthy();
    expect(db.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ institutionId, sectionId, title: "Essay", hidden: true, acceptedTypes: ".pdf" }),
    });
  });

  it("updates the linked assignment in place, scoped to the section", async () => {
    db.assignment.updateMany.mockResolvedValue({ count: 1 });
    const id = await saveLmsAssignment({ institutionId, sectionId, assignmentId: "a-1", title: "Essay v2", settings, hidden: false });
    expect(id).toBe("a-1");
    expect(db.assignment.updateMany).toHaveBeenCalledWith({
      where: { id: "a-1", institutionId, sectionId },
      data: expect.objectContaining({ title: "Essay v2", hidden: false }),
    });
    expect(db.assignment.create).not.toHaveBeenCalled();
  });

  it("hides instead of deleting an assignment that already has student work", async () => {
    db.submission.count.mockResolvedValue(1);
    db.gradeItem.count.mockResolvedValue(0);
    db.assignment.updateMany.mockResolvedValue({ count: 1 });
    expect(await retireLmsAssignment(institutionId, sectionId, "a-1")).toBe("hidden");
    expect(db.assignment.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unused assignment", async () => {
    db.submission.count.mockResolvedValue(0);
    db.gradeItem.count.mockResolvedValue(0);
    expect(await retireLmsAssignment(institutionId, sectionId, "a-1")).toBe("deleted");
    expect(db.assignment.deleteMany).toHaveBeenCalledWith({ where: { id: "a-1", institutionId, sectionId } });
  });
});
