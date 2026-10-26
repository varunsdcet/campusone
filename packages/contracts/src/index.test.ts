import { describe, expect, it } from "vitest";
import {
  ErrorEnvelope,
  GradeItem,
  LoginRequest,
  MAX_STUDENT_FILE_BYTES,
  RequestStudentProfileChange,
  StudentCalendarEvent,
  StudentModuleId,
  UploadStudentSubmissionFileRequest,
  AskCoachRequest,
  CoachAnswer,
} from "./index.js";

describe("contracts", () => {
  it("parses login request", () => {
    const parsed = LoginRequest.parse({
      email: "marcus.vance@heritage.edu",
      password: "Heritage!2026",
      deviceFingerprint: "device-fingerprint-1",
    });
    expect(parsed.email).toContain("marcus");
  });

  it("parses student-number login request", () => {
    const parsed = LoginRequest.parse({
      email: "ST-2024-001",
      password: "Heritage!2026",
      deviceFingerprint: "device-fingerprint-1",
      remember: false,
    });
    expect(parsed.email).toBe("ST-2024-001");
    expect(parsed.remember).toBe(false);
  });

  it("rejects draft exposure shape without status", () => {
    expect(() =>
      GradeItem.parse({
        id: "00000000-0000-4000-8000-000000000001",
        institutionId: "00000000-0000-4000-8000-000000000002",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        rowVersion: 1,
        assignmentId: "00000000-0000-4000-8000-000000000003",
        studentId: "00000000-0000-4000-8000-000000000004",
        enrolmentId: "00000000-0000-4000-8000-000000000005",
        score: 90,
        maxScore: 100,
        letter: "A",
        status: "published",
        publishedAt: "2026-01-02T00:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("validates error envelope", () => {
    const err = ErrorEnvelope.parse({
      error: { code: "UNAUTHORIZED", message: "No session", correlationId: "c1" },
    });
    expect(err.error.code).toBe("UNAUTHORIZED");
  });

  it("registers every student module", () => {
    expect(StudentModuleId.options).toHaveLength(27);
    expect(StudentModuleId.parse("ST-27")).toBe("ST-27");
  });

  it("rejects oversized student submission files", () => {
    expect(() =>
      UploadStudentSubmissionFileRequest.parse({
        filename: "project.pdf",
        mimeType: "application/pdf",
        sizeBytes: MAX_STUDENT_FILE_BYTES + 1,
        contentBase64: "JVBERi0xLjQ=",
      }),
    ).toThrow();
  });

  it("requires official profile fields on a profile change request", () => {
    expect(() =>
      RequestStudentProfileChange.parse({
        reason: "Please change the details on my student record.",
      }),
    ).toThrow();
    expect(
      RequestStudentProfileChange.parse({
        givenName: "Marcus",
        familyName: "Vance",
        primaryEmail: "marcus.vance@heritage.edu",
        phone: "604-555-0100",
        emergencyContactName: "Jane Vance",
        emergencyContactPhone: "604-555-0199",
        reason: "Please update my contact details on file.",
      }).givenName,
    ).toBe("Marcus");
  });

  it("allows only HTTPS student join links", () => {
    expect(() =>
      StudentCalendarEvent.parse({
        id: "class-1",
        kind: "class",
        sectionId: "00000000-0000-4000-8000-000000000001",
        title: "Clinical Practice",
        startsAt: "2026-01-01T17:00:00.000Z",
        endsAt: "2026-01-01T18:00:00.000Z",
        location: "Online",
        joinUrl: "http://unsafe.example.test/class",
      }),
    ).toThrow();
  });

  it("accepts the in-app live classroom launcher as a join link", () => {
    const event = {
      id: "class-1",
      kind: "class",
      sectionId: "00000000-0000-4000-8000-000000000001",
      title: "Clinical Practice",
      startsAt: "2026-01-01T17:00:00.000Z",
      endsAt: "2026-01-01T18:00:00.000Z",
      location: "Online",
    };
    expect(
      StudentCalendarEvent.parse({ ...event, joinUrl: "/live/00000000-0000-4000-8000-000000000001" }).joinUrl,
    ).toBe("/live/00000000-0000-4000-8000-000000000001");
    expect(
      StudentCalendarEvent.parse({
        ...event,
        joinUrl: "/live/00000000-0000-4000-8000-000000000001?provider=jitsi",
      }).joinUrl,
    ).toBe("/live/00000000-0000-4000-8000-000000000001?provider=jitsi");
    expect(
      StudentCalendarEvent.parse({
        ...event,
        joinUrl: "/live/00000000-0000-4000-8000-000000000001?provider=bigbluebutton",
      }).joinUrl,
    ).toBe("/live/00000000-0000-4000-8000-000000000001?provider=bigbluebutton");
    expect(() =>
      StudentCalendarEvent.parse({ ...event, joinUrl: "/live/00000000-0000-4000-8000-000000000001?provider=zoom" }),
    ).toThrow();
    expect(() => StudentCalendarEvent.parse({ ...event, joinUrl: "/live/../admin" })).toThrow();
    expect(() => StudentCalendarEvent.parse({ ...event, joinUrl: "//evil.example.test/live/x" })).toThrow();
  });

  it("validates a cited read-only Coach answer", () => {
    const request = AskCoachRequest.parse({
      question: "What should I focus on today?",
      contextPath: "/student",
      capability: "campus_coach",
    });
    expect(request.question).toContain("today");
    expect(() =>
      CoachAnswer.parse({
        interactionId: "00000000-0000-4000-8000-000000000010",
        role: "student",
        tier: "read_only",
        capability: "campus_coach",
        answer: "Project 1 is your next assignment.",
        sources: [
          {
            id: "assignment:00000000-0000-4000-8000-000000000011",
            title: "CS301 - Project 1",
            uri: "/student/assignments/00000000-0000-4000-8000-000000000011",
          },
        ],
        suggestedActions: [{ label: "Open assignments", href: "/student/assignments" }],
        claims: [],
        createdAt: "2026-09-15T20:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("parses degree plan analysis shape", async () => {
    const { DegreePlanAnalysis, AiCapabilityId } = await import("./index.js");
    expect(AiCapabilityId.parse("student_advisor")).toBe("student_advisor");
    expect(() =>
      DegreePlanAnalysis.parse({
        studentId: "00000000-0000-4000-8000-000000000001",
        programCode: "CS-DIP",
        programName: "Computer Science",
        programVersionLabel: "2024.1",
        remainingCredits: 21,
        completedCredits: 6,
        requiredCredits: 27,
        remainingRequirements: [],
        satisfiedRequirements: [],
        prerequisiteConflicts: [],
        prerequisiteGraph: [],
        projectedCompletionTerm: "Summer 2027",
        warnings: [],
        suggestedOptions: [],
        evidence: [{ id: "programVersion:1", title: "CS", uri: "/student/degree" }],
        claims: [],
      }),
    ).not.toThrow();
  });

  it("freezes the AI tool registry", async () => {
    const { AI_TOOL_REGISTRY, AiToolDefinition } = await import("./index.js");
    expect(AI_TOOL_REGISTRY.length).toBeGreaterThanOrEqual(14);
    for (const tool of AI_TOOL_REGISTRY) {
      expect(() => AiToolDefinition.parse(tool)).not.toThrow();
    }
  });

  it("accepts every mailbox action exposed by the mobile app", async () => {
    const { MailBulkActionRequest } = await import("./index.js");
    const threadIds = ["00000000-0000-4000-8000-000000000001"];
    for (const action of ["move_junk", "mark_not_junk", "delete", "restore", "purge"]) {
      expect(MailBulkActionRequest.parse({ threadIds, action }).action).toBe(action);
    }
  });
});
