import { randomUUID } from "node:crypto";
import type { AdvisingAppointmentRecord, GradingSuggestion, SuccessCaseRecord } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";

export async function getRubricForAssignment(input: {
  institutionId: string;
  assignmentId: string;
  instructorPersonId?: string;
}) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: input.assignmentId,
      institutionId: input.institutionId,
      ...(input.instructorPersonId
        ? { section: { institutionId: input.institutionId, instructorPersonId: input.instructorPersonId } }
        : {}),
    },
    include: {
      rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
      section: { include: { course: true } },
    },
  });
  if (!assignment?.rubric) {
    throw Object.assign(new Error("No published rubric is linked to this assignment"), {
      code: "NOT_FOUND",
      status: 404,
    });
  }
  return assignment;
}

export async function draftGradingSuggestion(input: {
  institutionId: string;
  instructorPersonId: string;
  assignmentId: string;
  studentId: string;
}): Promise<GradingSuggestion> {
  const assignment = await getRubricForAssignment({
    institutionId: input.institutionId,
    assignmentId: input.assignmentId,
    instructorPersonId: input.instructorPersonId,
  });
  const rubric = assignment.rubric!;
  const submission = await prisma.submission.findFirst({
    where: {
      institutionId: input.institutionId,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
    },
  });
  const flags: string[] = [];
  if (!submission || submission.status === "draft") {
    flags.push("Submission missing or still draft — suggestion confidence is limited.");
  }
  const rubricItems = rubric.criteria.map((criterion, index) => {
    const ratio = submission?.status === "submitted" || submission?.status === "graded" ? 0.75 : 0.55;
    const suggestedPoints = Math.round(criterion.maxPoints * ratio * 10) / 10;
    return {
      criterionId: criterion.id,
      label: criterion.label,
      maxPoints: criterion.maxPoints,
      suggestedPoints,
      rationale: `Draft only: criterion “${criterion.label}” scored at ${Math.round(ratio * 100)}% of max based on submission status${index === 0 ? " and rubric wording" : ""}. Instructor must confirm.`,
    };
  });
  const suggestedTotal = Math.round(rubricItems.reduce((sum, row) => sum + row.suggestedPoints, 0) * 10) / 10;
  return {
    assignmentId: assignment.id,
    studentId: input.studentId,
    rubricId: rubric.id,
    rubricItems,
    suggestedTotal,
    feedback: `Draft feedback for ${assignment.section.course.code} · ${assignment.title}: address each rubric criterion before finalizing. This is not a published grade.`,
    confidenceNote: "Heuristic draft aligned to rubric maxima — not an authoritative grade.",
    flags,
    claims: [
      {
        kind: "inference",
        text: `Suggested total ${suggestedTotal} / ${rubric.maxScore} from rubric criteria.`,
        evidenceIds: [`rubric:${rubric.id}`],
      },
      {
        kind: "action",
        text: "Instructor must review and publish through the existing grade approval workflow.",
        evidenceIds: [],
      },
    ],
  };
}

export async function createAdvisorAppointment(input: {
  institutionId: string;
  studentId: string;
  topic: string;
  startsAt: string;
  notes?: string;
  actorAccountId: string;
  correlationId?: string;
}): Promise<AdvisingAppointmentRecord> {
  const id = randomUUID();
  const startsAt = new Date(input.startsAt);
  await prisma.$transaction(async (tx) => {
    await tx.advisingAppointment.create({
      data: {
        id,
        institutionId: input.institutionId,
        studentId: input.studentId,
        topic: input.topic,
        startsAt,
        notes: input.notes ?? null,
        status: "requested",
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.actorAccountId,
      eventName: "AdvisingAppointment.created",
      purpose: "student_advising_request",
      before: null,
      after: { id, studentId: input.studentId, topic: input.topic, startsAt: startsAt.toISOString() },
      source: "student.advising",
      correlationId: input.correlationId ?? id,
      outboxPayload: { id, studentId: input.studentId },
    });
  });
  return {
    id,
    studentId: input.studentId,
    topic: input.topic,
    startsAt: startsAt.toISOString(),
    status: "requested",
    notes: input.notes ?? null,
  };
}

export async function listAdvisorAppointments(input: { institutionId: string; studentId: string }) {
  const rows = await prisma.advisingAppointment.findMany({
    where: { institutionId: input.institutionId, studentId: input.studentId },
    orderBy: { startsAt: "asc" },
    take: 20,
  });
  const advisorIds = [...new Set(rows.map((row) => row.advisorPersonId).filter((id): id is string => Boolean(id)))];
  const advisors = advisorIds.length
    ? await prisma.person.findMany({
        where: { institutionId: input.institutionId, id: { in: advisorIds } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const advisorNames = new Map(advisors.map((person) => [person.id, `${person.givenName} ${person.familyName}`.trim()]));
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    topic: row.topic,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    advisorName: row.advisorPersonId ? advisorNames.get(row.advisorPersonId) ?? "Student Success team" : "Awaiting advisor assignment",
    notes: null,
  }));
}

export async function createSuccessCase(input: {
  institutionId: string;
  studentId: string;
  level: "watch" | "elevated";
  summary: string;
  signals: unknown[];
  actorAccountId: string;
  ownerPersonId?: string;
  correlationId?: string;
}): Promise<SuccessCaseRecord> {
  const id = randomUUID();
  const taskTitles = ["Send check-in", "Schedule advisor meeting", "Review academic plan"];
  await prisma.$transaction(async (tx) => {
    await tx.successCase.create({
      data: {
        id,
        institutionId: input.institutionId,
        studentId: input.studentId,
        level: input.level,
        summary: input.summary,
        signalsJson: JSON.stringify(input.signals),
        ownerPersonId: input.ownerPersonId ?? null,
        status: "open",
        tasks: {
          create: taskTitles.map((title) => ({
            id: randomUUID(),
            institutionId: input.institutionId,
            title,
            status: "pending",
          })),
        },
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: input.institutionId,
      actorId: input.actorAccountId,
      eventName: "SuccessCase.created",
      purpose: "student_success_intervention",
      before: null,
      after: { id, studentId: input.studentId, level: input.level },
      source: "success.case",
      correlationId: input.correlationId ?? id,
      outboxPayload: { id, studentId: input.studentId },
    });
  });
  return {
    id,
    studentId: input.studentId,
    level: input.level,
    status: "open",
    summary: input.summary,
    taskTitles,
  };
}
