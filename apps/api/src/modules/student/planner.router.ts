import { Router } from "express";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { generateWithAi } from "../../lib/ask.js";
import { currentStudentId } from "../me/studentAlignment.js";
import { attendanceProjection, localDateKey, parsePlannerDraft, parseStudyAid, studyAidPrompt } from "./planner.logic.js";
import { assertGovernanceRoleAllowed, governancePolicy } from "../ai/governance-policy.js";
import { containsRestrictedSecret } from "../ai/input-policy.js";
import { gradeBandsForSection } from "../../lib/gradingScheme.js";
import { getTranscriptSummary } from "../academic/program-plan.service.js";

export const plannerRouter: Router = Router();
plannerRouter.use(requireAuth, requireRoles("student"));

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sessionInput = z.object({
  title: z.string().trim().min(1).max(140),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(180),
  sectionId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
});
const planInput = z.object({
  title: z.string().trim().min(1).max(100),
  startsOn: z.string().regex(datePattern),
  endsOn: z.string().regex(datePattern),
  runId: z.string().uuid().optional(),
  sessions: z.array(sessionInput).min(1).max(50),
});
const aiInput = z.object({
  startDate: z.string().regex(datePattern),
  days: z.number().int().min(1).max(14).default(7),
  dailyMinutes: z.number().int().min(30).max(480),
  goal: z.string().trim().max(500).default("Balance my upcoming classes, assignments and required tasks."),
  mode: z.enum(["new", "replan"]).default("new"),
});

function problem(message: string, status = 400, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

async function context(req: AuthedRequest) {
  const user = req.user;
  const studentId = await currentStudentId(user.institutionId, user.personId);
  if (!studentId) throw problem("No student profile is linked to this account", 404, "STUDENT_NOT_FOUND");
  const institution = await prisma.institution.findFirst({
    where: { institutionId: user.institutionId },
    select: { timezone: true },
  });
  return { user, studentId, timeZone: institution?.timezone || "America/Vancouver" };
}

function broadRange(startDate: string, days = 1) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(start);
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + days + 1);
  return { start, end };
}

async function academicScope(institutionId: string, studentId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId, studentId, status: "enrolled" },
    include: { section: { include: { course: true } } },
  });
  return {
    enrolments,
    sectionIds: enrolments.map((row) => row.sectionId),
    courseBySection: new Map(enrolments.map((row) => [row.sectionId, row.section.course])),
  };
}

function studySessionDto(row: {
  id: string; planId: string | null; sectionId: string | null; assignmentId: string | null; title: string;
  scheduledAt: Date; durationMinutes: number; status: string; source: string; completedAt: Date | null;
}) {
  return {
    id: row.id,
    planId: row.planId,
    sectionId: row.sectionId,
    assignmentId: row.assignmentId,
    title: row.title,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: row.status,
    source: row.source,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function assertOwnedReferences(institutionId: string, studentId: string, sessions: z.infer<typeof sessionInput>[]) {
  const scope = await academicScope(institutionId, studentId);
  const allowedSections = new Set(scope.sectionIds);
  const requestedAssignments = [...new Set(sessions.flatMap((row) => row.assignmentId ? [row.assignmentId] : []))];
  const assignments = requestedAssignments.length ? await prisma.assignment.findMany({
    where: { institutionId, id: { in: requestedAssignments }, sectionId: { in: scope.sectionIds } },
    select: { id: true },
  }) : [];
  const allowedAssignments = new Set(assignments.map((row) => row.id));
  for (const row of sessions) {
    if (row.sectionId && !allowedSections.has(row.sectionId)) throw problem("A study session references a course not enrolled by this student", 403, "FORBIDDEN");
    if (row.assignmentId && !allowedAssignments.has(row.assignmentId)) throw problem("A study session references an unavailable assignment", 403, "FORBIDDEN");
  }
}

plannerRouter.get("/day", async (req, res, next) => {
  try {
    const { user, studentId, timeZone } = await context(req as AuthedRequest);
    const date = typeof req.query.date === "string" && datePattern.test(req.query.date)
      ? req.query.date
      : localDateKey(new Date(), timeZone);
    const range = broadRange(date);
    const scope = await academicScope(user.institutionId, studentId);
    const [classSessions, assignments, tasks, studySessions, attendance] = await Promise.all([
      scope.sectionIds.length ? prisma.classSession.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, startsAt: { gte: range.start, lt: range.end } },
        orderBy: { startsAt: "asc" },
      }) : [],
      scope.sectionIds.length ? prisma.assignment.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, hidden: false, dueAt: { gte: range.start, lt: range.end } },
        include: { submissions: { where: { studentId }, select: { status: true } } },
        orderBy: { dueAt: "asc" },
      }) : [],
      prisma.requiredTask.findMany({ where: { institutionId: user.institutionId, studentId, status: "pending" }, orderBy: { dueAt: "asc" } }),
      prisma.studySession.findMany({
        where: { institutionId: user.institutionId, studentId, scheduledAt: { gte: range.start, lt: range.end } },
        orderBy: { scheduledAt: "asc" },
      }),
      scope.sectionIds.length ? prisma.attendanceRecord.findMany({
        where: { institutionId: user.institutionId, studentId, sectionId: { in: scope.sectionIds } },
        select: { sectionId: true, status: true },
      }) : [],
    ]);
    const dayClasses = classSessions.filter((row) => localDateKey(row.startsAt, timeZone) === date);
    const dueAssignments = assignments.filter((row) => row.dueAt && localDateKey(row.dueAt, timeZone) === date && !row.submissions.some((sub) => sub.status === "submitted"));
    const dueTasks = tasks.filter((row) => !row.dueAt || localDateKey(row.dueAt, timeZone) <= date);
    const planned = studySessions.filter((row) => localDateKey(row.scheduledAt, timeZone) === date);
    const attendanceBySection = scope.sectionIds.map((sectionId) => {
      const rows = attendance.filter((row) => row.sectionId === sectionId && row.status !== "excused");
      const attended = rows.filter((row) => row.status === "present" || row.status === "late").length;
      const course = scope.courseBySection.get(sectionId);
      return { sectionId, courseCode: course?.code ?? "Course", ...attendanceProjection(attended, rows.length, 80) };
    }).filter((row) => row.counted > 0);
    res.json({
      date,
      timeZone,
      summary: { classes: dayClasses.length, assignments: dueAssignments.length, tasks: dueTasks.length, studySessions: planned.length },
      classes: dayClasses.map((row) => ({
        id: row.id, sectionId: row.sectionId, title: row.title, startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt?.toISOString() ?? null, location: row.location, courseCode: scope.courseBySection.get(row.sectionId)?.code ?? "Course",
      })),
      assignments: dueAssignments.map((row) => ({
        id: row.id, sectionId: row.sectionId, title: row.title, dueAt: row.dueAt!.toISOString(), courseCode: scope.courseBySection.get(row.sectionId)?.code ?? "Course",
      })),
      tasks: dueTasks.map((row) => ({ id: row.id, title: row.title, detail: row.detail, dueAt: row.dueAt?.toISOString() ?? null, href: row.href })),
      studySessions: planned.map(studySessionDto),
      attendance: attendanceBySection,
    });
  } catch (error) { next(error); }
});

plannerRouter.get("/plans", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    const plans = await prisma.studyPlan.findMany({
      where: { institutionId: user.institutionId, studentId },
      include: { sessions: { orderBy: { scheduledAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ plans: plans.map((plan) => ({ ...plan, sessions: plan.sessions.map(studySessionDto) })) });
  } catch (error) { next(error); }
});

plannerRouter.post("/sessions", async (req, res, next) => {
  try {
    const input = sessionInput.parse(req.body);
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    await assertOwnedReferences(user.institutionId, studentId, [input]);
    const created = await prisma.studySession.create({ data: { ...input, institutionId: user.institutionId, studentId } });
    res.status(201).json({ session: studySessionDto(created) });
  } catch (error) { next(error); }
});

plannerRouter.patch("/sessions/:id", async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(["planned", "completed", "missed"]) }).parse(req.body);
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    const found = await prisma.studySession.findFirst({ where: { id: req.params.id, institutionId: user.institutionId, studentId } });
    if (!found) throw problem("Study session not found", 404, "NOT_FOUND");
    const updated = await prisma.studySession.update({
      where: { id: found.id },
      data: { status: input.status, completedAt: input.status === "completed" ? new Date() : null, rowVersion: { increment: 1 } },
    });
    res.json({ session: studySessionDto(updated) });
  } catch (error) { next(error); }
});

plannerRouter.post("/ai-plan", async (req, res, next) => {
  const requestUser = (req as AuthedRequest).user;
  let studentId = "";
  let snapshot: Record<string, unknown> = {};
  let parsed: z.infer<typeof aiInput> | null = null;
  try {
    parsed = aiInput.parse(req.body);
    const ctx = await context(req as AuthedRequest);
    studentId = ctx.studentId;
    if (containsRestrictedSecret(parsed.goal)) throw problem("Do not include government identifiers or credential secrets in a study-planner goal");
    const governance = await governancePolicy(ctx.user.institutionId);
    assertGovernanceRoleAllowed(governance, ctx.user.roles);
    const usedLastHour = await prisma.aiPlannerRun.count({
      where: { institutionId: ctx.user.institutionId, accountId: ctx.user.accountId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (usedLastHour >= governance.maxRequestsPerHour) throw problem("Institutional AI request limit reached. Try again later.", 429, "RATE_LIMITED");
    const scope = await academicScope(ctx.user.institutionId, studentId);
    const range = broadRange(parsed.startDate, parsed.days);
    const endDate = new Date(`${parsed.startDate}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + parsed.days - 1);
    const endDateKey = endDate.toISOString().slice(0, 10);
    const [classes, assignments, tasks, missedSessions] = await Promise.all([
      scope.sectionIds.length ? prisma.classSession.findMany({
        where: { institutionId: ctx.user.institutionId, sectionId: { in: scope.sectionIds }, startsAt: { gte: range.start, lt: range.end } },
        orderBy: { startsAt: "asc" },
      }) : [],
      scope.sectionIds.length ? prisma.assignment.findMany({
        where: { institutionId: ctx.user.institutionId, sectionId: { in: scope.sectionIds }, hidden: false, dueAt: { gte: range.start, lt: range.end } },
        orderBy: { dueAt: "asc" },
      }) : [],
      prisma.requiredTask.findMany({
        where: { institutionId: ctx.user.institutionId, studentId, status: "pending", OR: [{ dueAt: null }, { dueAt: { lt: range.end } }] },
        orderBy: { dueAt: "asc" },
      }),
      parsed.mode === "replan" ? prisma.studySession.findMany({
        where: { institutionId: ctx.user.institutionId, studentId, status: "missed" },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      }) : [],
    ]);
    snapshot = {
      dateRange: { startsOn: parsed.startDate, endsOn: endDateKey, timeZone: ctx.timeZone },
      dailyMinutes: parsed.dailyMinutes,
      goal: parsed.goal,
      classes: classes.map((row) => ({ id: row.id, sectionId: row.sectionId, title: row.title, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString() ?? null })),
      assignments: assignments.map((row) => ({ id: row.id, sectionId: row.sectionId, title: row.title, dueAt: row.dueAt?.toISOString() ?? null })),
      tasks: tasks.map((row) => ({ id: row.id, title: row.title, dueAt: row.dueAt?.toISOString() ?? null })),
      missedSessions: missedSessions.map((row) => ({ id: row.id, title: row.title, durationMinutes: row.durationMinutes, sectionId: row.sectionId, assignmentId: row.assignmentId })),
    };
    const generated = await generateWithAi(
      [
        "You create a draft study plan using only the supplied official academic facts.",
        "Never overlap a class. Keep each session between 15 and 180 minutes and within the requested daily minute limit.",
        "Prioritise earlier deadlines and include breaks. Return JSON only:",
        parsed.mode === "replan" ? "Replan the supplied missed sessions into future free slots without duplicating completed work." : "Create a new balanced plan.",
        '{"title":"...","rationale":"...","sessions":[{"title":"...","scheduledAt":"ISO-8601","durationMinutes":50,"sectionId":"optional official id","assignmentId":"optional official id"}]}',
        "This is a draft for student review; do not claim it is saved.",
      ].join("\n"),
      JSON.stringify(snapshot),
      45_000,
      { json: true, maxTokens: 3000 },
    );
    const draft = parsePlannerDraft(generated.answer, new Set(scope.sectionIds), new Set(assignments.map((row) => row.id)));
    const classWindows = classes.map((row) => ({ start: row.startsAt.getTime(), end: (row.endsAt ?? row.startsAt).getTime() }));
    const dailyTotals = new Map<string, number>();
    for (const session of draft.sessions) {
      const when = new Date(session.scheduledAt);
      const dateKey = localDateKey(when, ctx.timeZone);
      if (dateKey < parsed.startDate || dateKey > endDateKey) throw problem("AI returned a study session outside the requested date range", 502, "AI_BAD_OUTPUT");
      const end = when.getTime() + session.durationMinutes * 60_000;
      if (classWindows.some((classTime) => when.getTime() < classTime.end && end > classTime.start)) throw problem("AI returned a study session that overlaps an official class", 502, "AI_BAD_OUTPUT");
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + session.durationMinutes);
      if ((dailyTotals.get(dateKey) ?? 0) > parsed.dailyMinutes) throw problem("AI returned more study time than the student's daily limit", 502, "AI_BAD_OUTPUT");
    }
    const run = await prisma.aiPlannerRun.create({ data: {
      institutionId: ctx.user.institutionId,
      accountId: ctx.user.accountId,
      studentId,
      prompt: parsed.goal,
      inputSnapshotJson: JSON.stringify(snapshot),
      outputJson: JSON.stringify(draft),
      provider: generated.model,
      status: "draft",
    } });
    res.json({ runId: run.id, provider: generated.model, draft });
  } catch (error) {
    if (studentId && parsed) {
      await prisma.aiPlannerRun.create({ data: {
        institutionId: requestUser.institutionId,
        accountId: requestUser.accountId,
        studentId,
        prompt: parsed.goal,
        inputSnapshotJson: JSON.stringify(snapshot),
        outputJson: JSON.stringify({ error: error instanceof Error ? error.message : "AI planner failed" }),
        provider: "unavailable",
        status: "failed",
      } }).catch(() => undefined);
    }
    next(error);
  }
});

plannerRouter.post("/plans", async (req, res, next) => {
  try {
    const input = planInput.parse(req.body);
    if (input.endsOn < input.startsOn) throw problem("Plan end date must be on or after its start date");
    if (input.sessions.some((row) => row.scheduledAt.slice(0, 10) < input.startsOn || row.scheduledAt.slice(0, 10) > input.endsOn)) {
      throw problem("Every study session must fall inside the plan date range");
    }
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    await assertOwnedReferences(user.institutionId, studentId, input.sessions);
    const plan = await prisma.$transaction(async (tx) => {
      if (input.runId) {
        const claimed = await tx.aiPlannerRun.updateMany({
          where: { id: input.runId, institutionId: user.institutionId, accountId: user.accountId, studentId, status: "draft" },
          data: { status: "accepted", acceptedAt: new Date() },
        });
        if (claimed.count !== 1) throw problem("This AI draft was already saved or is unavailable", 409, "CONFLICT");
      }
      return tx.studyPlan.create({
        data: {
          institutionId: user.institutionId,
          studentId,
          title: input.title,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          source: input.runId ? "ai_reviewed" : "manual",
          sessions: { create: input.sessions.map((row) => ({ ...row, institutionId: user.institutionId, studentId, source: input.runId ? "ai_reviewed" : "manual" })) },
        },
        include: { sessions: { orderBy: { scheduledAt: "asc" } } },
      });
    });
    res.status(201).json({ plan: { ...plan, sessions: plan.sessions.map(studySessionDto) } });
  } catch (error) { next(error); }
});

plannerRouter.post("/focus", async (req, res, next) => {
  try {
    const input = z.object({ title: z.string().trim().min(1).max(140), durationMinutes: z.number().int().min(5).max(180), studySessionId: z.string().uuid().optional() }).parse(req.body);
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    if (input.studySessionId) {
      const owned = await prisma.studySession.count({ where: { id: input.studySessionId, institutionId: user.institutionId, studentId } });
      if (!owned) throw problem("Study session not found", 404, "NOT_FOUND");
    }
    const focus = await prisma.focusSession.create({ data: { ...input, institutionId: user.institutionId, studentId, startedAt: new Date() } });
    res.status(201).json({ focus: { ...focus, startedAt: focus.startedAt.toISOString(), completedAt: null } });
  } catch (error) { next(error); }
});

plannerRouter.post("/focus/:id/complete", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    const found = await prisma.focusSession.findFirst({ where: { id: req.params.id, institutionId: user.institutionId, studentId, completedAt: null } });
    if (!found) throw problem("Active focus session not found", 404, "NOT_FOUND");
    const focus = await prisma.focusSession.update({ where: { id: found.id }, data: { completedAt: new Date() } });
    res.json({ focus: { ...focus, startedAt: focus.startedAt.toISOString(), completedAt: focus.completedAt?.toISOString() ?? null } });
  } catch (error) { next(error); }
});

function jsonStrings(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((row): row is string => typeof row === "string") : [];
  } catch {
    return [];
  }
}

function daysBetween(left: Date, right: Date) {
  return Math.ceil((right.getTime() - left.getTime()) / 86_400_000);
}

plannerRouter.get("/insights", async (req, res, next) => {
  try {
    const { user, studentId, timeZone } = await context(req as AuthedRequest);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const twoWeeks = new Date(now.getTime() + 14 * 86_400_000);
    const student = await prisma.student.findFirstOrThrow({ where: { id: studentId, institutionId: user.institutionId } });
    const scope = await academicScope(user.institutionId, studentId);
    const [assignments, tasks, attendance, futureClasses, studySessions, focusSessions, goals] = await Promise.all([
      scope.sectionIds.length ? prisma.assignment.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, hidden: false, dueAt: { gte: now, lte: twoWeeks } },
        include: { submissions: { where: { studentId }, select: { status: true } } },
        orderBy: { dueAt: "asc" },
      }) : [],
      prisma.requiredTask.findMany({ where: { institutionId: user.institutionId, studentId, status: "pending" }, orderBy: { dueAt: "asc" } }),
      scope.sectionIds.length ? prisma.attendanceRecord.findMany({ where: { institutionId: user.institutionId, studentId, sectionId: { in: scope.sectionIds } } }) : [],
      scope.sectionIds.length ? prisma.classSession.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, startsAt: { gt: now } }, select: { sectionId: true, startsAt: true } }) : [],
      prisma.studySession.findMany({ where: { institutionId: user.institutionId, studentId, scheduledAt: { gte: weekAgo, lte: twoWeeks } } }),
      prisma.focusSession.findMany({ where: { institutionId: user.institutionId, studentId, startedAt: { gte: weekAgo } }, orderBy: { startedAt: "desc" } }),
      prisma.studyGoal.findMany({ where: { institutionId: user.institutionId, studentId, status: "active" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    ]);

    const risks: Array<{ id: string; level: "low" | "medium" | "high"; title: string; detail: string; kind: string }> = [];
    const openAssignments = assignments.filter((row) => !row.submissions.some((sub) => sub.status === "submitted"));
    for (const assignment of openAssignments) {
      const dueDays = assignment.dueAt ? daysBetween(now, assignment.dueAt) : 14;
      const planned = studySessions.reduce((sum, row) => sum + (row.assignmentId === assignment.id && row.status === "planned" ? row.durationMinutes : 0), 0);
      const level = dueDays <= 2 && planned < 30 ? "high" : dueDays <= 5 && planned < 60 ? "medium" : "low";
      risks.push({ id: `assignment:${assignment.id}`, level, kind: "deadline", title: assignment.title, detail: `Due in ${Math.max(0, dueDays)} day(s) · ${planned} planned min` });
    }
    const perDay = new Map<string, number>();
    for (const assignment of openAssignments) {
      if (!assignment.dueAt) continue;
      const key = localDateKey(assignment.dueAt, timeZone);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    for (const [date, count] of perDay) if (count >= 2) risks.push({ id: `cluster:${date}`, level: count >= 3 ? "high" : "medium", kind: "workload", title: `${count} submissions cluster`, detail: `${date} has multiple deadlines` });
    if (tasks.length) risks.push({ id: "required-tasks", level: tasks.some((row) => row.dueAt && row.dueAt < now) ? "high" : "medium", kind: "task", title: `${tasks.length} required task(s) pending`, detail: "Complete institutional tasks before their due dates." });

    const attendanceInsights = scope.sectionIds.map((sectionId) => {
      const rows = attendance.filter((row) => row.sectionId === sectionId && row.status !== "excused");
      const attended = rows.filter((row) => row.status === "present" || row.status === "late").length;
      const projection = attendanceProjection(attended, rows.length, 80);
      const remaining = futureClasses.filter((row) => row.sectionId === sectionId).length;
      const bestPossible = rows.length + remaining ? Math.round(((attended + remaining) / (rows.length + remaining)) * 1000) / 10 : 100;
      if (projection.rate < projection.targetPercent) risks.push({ id: `attendance:${sectionId}`, level: bestPossible < projection.targetPercent ? "high" : "medium", kind: "attendance", title: `${scope.courseBySection.get(sectionId)?.code ?? "Course"} attendance`, detail: bestPossible < projection.targetPercent ? `Target cannot be recovered from ${remaining} scheduled classes.` : `${projection.neededConsecutive} consecutive attendance needed.` });
      return { sectionId, courseCode: scope.courseBySection.get(sectionId)?.code ?? "Course", remainingClasses: remaining, bestPossible, recoveryPossible: bestPossible >= projection.targetPercent, ...projection };
    }).filter((row) => row.counted > 0);

    const enrolments = await prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, studentId, status: { in: ["enrolled", "completed"] } },
      include: { section: { include: { course: true, assignments: true } }, gradeItems: { where: { status: "published" } } },
    });
    const [grades, transcript] = await Promise.all([Promise.all(enrolments.map(async (enrolment) => {
      const assignmentById = new Map(enrolment.section.assignments.map((row) => [row.id, row]));
      let completedWeight = 0;
      let earnedWeighted = 0;
      for (const grade of enrolment.gradeItems) {
        const assignment = assignmentById.get(grade.assignmentId);
        if (!assignment || grade.score == null || grade.maxScore <= 0) continue;
        completedWeight += assignment.weightPercent;
        earnedWeighted += (grade.score / grade.maxScore) * assignment.weightPercent;
      }
      const remainingWeight = Math.max(0, 100 - completedWeight);
      const currentPercent = completedWeight > 0 ? Math.round((earnedWeighted / completedWeight) * 1000) / 10 : null;
      const bands = await gradeBandsForSection(user.institutionId, enrolment.sectionId, enrolment.section.courseId);
      const scenarios = bands.slice(0, 10).map(({ percent: targetPercent, letter, gradePoint }) => ({
        targetPercent, letter, gradePoint,
        requiredOnRemaining: remainingWeight > 0 ? Math.round(((targetPercent - earnedWeighted) / remainingWeight) * 1000) / 10 : null,
      }));
      return { sectionId: enrolment.sectionId, courseCode: enrolment.section.course.code, courseTitle: enrolment.section.course.title, credits: enrolment.section.course.credits, currentPercent, completedWeight, remainingWeight, scenarios };
    })), getTranscriptSummary(user.institutionId, studentId)]);

    const completedFocus = focusSessions.filter((row) => row.completedAt);
    const focusMinutes = completedFocus.reduce((sum, row) => sum + row.durationMinutes, 0);
    const completedDays = new Set(completedFocus.map((row) => localDateKey(row.startedAt, timeZone)));
    let streakDays = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(now.getTime() - offset * 86_400_000);
      if (completedDays.has(localDateKey(date, timeZone))) streakDays += 1;
      else if (offset > 0 || completedDays.size) break;
    }
    const plannedMinutes = studySessions.filter((row) => row.scheduledAt >= weekAgo).reduce((sum, row) => sum + row.durationMinutes, 0);
    const completedStudyMinutes = studySessions.filter((row) => row.scheduledAt >= weekAgo && row.status === "completed").reduce((sum, row) => sum + row.durationMinutes, 0);
    const riskRank = { high: 0, medium: 1, low: 2 } as const;
    res.json({
      risks: risks.sort((a, b) => riskRank[a.level] - riskRank[b.level]),
      attendance: attendanceInsights,
      grades,
      cumulativeGpa: transcript.cgpa,
      analytics: { focusMinutes, focusSessions: completedFocus.length, streakDays, plannedMinutes, completedStudyMinutes, completionPercent: plannedMinutes ? Math.round((completedStudyMinutes / plannedMinutes) * 100) : 0 },
      goals: goals.map((row) => ({ id: row.id, title: row.title, targetDate: row.targetDate, weeklyTargetMinutes: row.weeklyTargetMinutes })),
      programName: student.programName,
    });
  } catch (error) { next(error); }
});

plannerRouter.post("/goals", async (req, res, next) => {
  try {
    const input = z.object({ title: z.string().trim().min(1).max(140), targetDate: z.string().regex(datePattern).optional(), weeklyTargetMinutes: z.number().int().min(30).max(10_080) }).parse(req.body);
    const { user, studentId } = await context(req as AuthedRequest);
    const goal = await prisma.$transaction(async (tx) => {
      await tx.studyGoal.updateMany({ where: { institutionId: user.institutionId, studentId, status: "active" }, data: { status: "replaced", rowVersion: { increment: 1 } } });
      return tx.studyGoal.create({ data: { ...input, institutionId: user.institutionId, studentId } });
    });
    res.status(201).json({ goal });
  } catch (error) { next(error); }
});

plannerRouter.post("/reminders/sync", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as AuthedRequest);
    const scope = await academicScope(user.institutionId, studentId);
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    const [assignments, tasks] = await Promise.all([
      scope.sectionIds.length ? prisma.assignment.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, hidden: false, dueAt: { gte: now, lte: soon }, submissions: { none: { studentId, status: "submitted" } } }, select: { id: true, title: true, dueAt: true } }) : [],
      prisma.requiredTask.findMany({ where: { institutionId: user.institutionId, studentId, status: "pending", dueAt: { gte: now, lte: soon } }, select: { id: true, title: true, dueAt: true } }),
    ]);
    const data = [
      ...assignments.map((row) => ({ institutionId: user.institutionId, recipientAccountId: user.accountId, channel: "in_app", title: "Assignment deadline", body: `${row.title} is due ${row.dueAt?.toLocaleString() ?? "soon"}.`, templateKey: "planner_deadline", dedupeKey: `planner:assignment:${row.id}:${row.dueAt?.toISOString().slice(0, 10)}` })),
      ...tasks.map((row) => ({ institutionId: user.institutionId, recipientAccountId: user.accountId, channel: "in_app", title: "Required task due", body: `${row.title} is due ${row.dueAt?.toLocaleString() ?? "soon"}.`, templateKey: "planner_task", dedupeKey: `planner:task:${row.id}:${row.dueAt?.toISOString().slice(0, 10)}` })),
    ];
    const result = data.length ? await prisma.notification.createMany({ data, skipDuplicates: true }) : { count: 0 };
    res.json({ created: result.count, considered: data.length });
  } catch (error) { next(error); }
});

plannerRouter.get("/study-sources", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as AuthedRequest);
    const scope = await academicScope(user.institutionId, studentId);
    const [topics, resources, lessons] = await Promise.all([
      prisma.syllabusTopic.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds } }, orderBy: { sortOrder: "asc" } }),
      prisma.courseResource.findMany({ where: { institutionId: user.institutionId, courseId: { in: scope.enrolments.map((row) => row.section.courseId) } }, orderBy: { name: "asc" } }),
      prisma.courseLesson.findMany({ where: { institutionId: user.institutionId, dayBlock: { sectionId: { in: scope.sectionIds } }, body: { not: "" } }, include: { dayBlock: { select: { sectionId: true, label: true } } }, orderBy: { sortOrder: "asc" } }),
    ]);
    res.json({ courses: scope.enrolments.map((row) => ({
      sectionId: row.sectionId,
      courseCode: row.section.course.code,
      courseTitle: row.section.course.title,
      sources: [
        ...lessons.filter((lesson) => lesson.dayBlock.sectionId === row.sectionId).map((lesson) => ({ id: lesson.id, type: "course_lesson", title: lesson.title, reference: `${row.section.course.code} · ${lesson.dayBlock.label}` })),
        ...topics.filter((topic) => topic.sectionId === row.sectionId).map((topic) => ({ id: topic.id, type: "syllabus_topic", title: topic.title, reference: `${row.section.course.code} syllabus` })),
        ...resources.filter((resource) => resource.courseId === row.section.courseId).map((resource) => ({ id: resource.id, type: "course_resource", title: resource.name, reference: `${row.section.course.code} course resource` })),
      ],
    })) });
  } catch (error) { next(error); }
});

plannerRouter.post("/study-tools", async (req, res, next) => {
  try {
    const input = z.object({ sectionId: z.string().uuid(), kind: z.enum(["summary", "flashcards", "quiz", "checklist"]), sourceId: z.string().uuid().optional(), notes: z.string().trim().max(12_000).default("") }).parse(req.body);
    const ctx = await context(req as AuthedRequest);
    if (containsRestrictedSecret(input.notes)) throw problem("Do not include government identifiers or credential secrets in study notes");
    const scope = await academicScope(ctx.user.institutionId, ctx.studentId);
    const enrolment = scope.enrolments.find((row) => row.sectionId === input.sectionId);
    if (!enrolment) throw problem("Course is not enrolled by this student", 403, "FORBIDDEN");
    const [topic, resource, lesson] = input.sourceId ? await Promise.all([
      prisma.syllabusTopic.findFirst({ where: { id: input.sourceId, institutionId: ctx.user.institutionId, sectionId: input.sectionId } }),
      prisma.courseResource.findFirst({ where: { id: input.sourceId, institutionId: ctx.user.institutionId, courseId: enrolment.section.courseId } }),
      prisma.courseLesson.findFirst({ where: { id: input.sourceId, institutionId: ctx.user.institutionId, dayBlock: { sectionId: input.sectionId } }, include: { dayBlock: { select: { label: true } } } }),
    ]) : [null, null, null];
    const source = lesson ? { id: lesson.id, type: "course_lesson", title: lesson.title, reference: `${enrolment.section.course.code} · ${lesson.dayBlock.label}` }
      : topic ? { id: topic.id, type: "syllabus_topic", title: topic.title, reference: `${enrolment.section.course.code} syllabus topic` }
        : resource ? { id: resource.id, type: "course_resource", title: resource.name, reference: `${enrolment.section.course.code} course resource` }
          : { id: "student-notes", type: "student_notes", title: "Student notes", reference: "Student-provided notes" };
    const officialText = lesson?.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 16_000) ?? "";
    if (!input.notes && !officialText && !lesson && !topic) throw problem("This source has no readable text yet. Add notes or choose a course lesson or syllabus topic.");
    const syllabusOutline = topic
      ? (await prisma.syllabusTopic.findMany({ where: { institutionId: ctx.user.institutionId, sectionId: input.sectionId }, orderBy: { sortOrder: "asc" }, select: { title: true }, take: 40 })).map((row) => row.title)
      : [];
    const relatedLessons = lesson
      ? (await prisma.courseLesson.findMany({ where: { institutionId: ctx.user.institutionId, dayBlockId: lesson.dayBlockId, id: { not: lesson.id } }, orderBy: { sortOrder: "asc" }, select: { title: true }, take: 12 })).map((row) => row.title)
      : [];
    const governance = await governancePolicy(ctx.user.institutionId);
    assertGovernanceRoleAllowed(governance, ctx.user.roles);
    const usedLastHour = await prisma.aiPlannerRun.count({ where: { institutionId: ctx.user.institutionId, accountId: ctx.user.accountId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (usedLastHour >= governance.maxRequestsPerHour) throw problem("Institutional AI request limit reached. Try again later.", 429, "RATE_LIMITED");
    const generated = await generateWithAi(
      studyAidPrompt(input.kind),
      JSON.stringify({ course: `${enrolment.section.course.code} ${enrolment.section.course.title}`, source, officialSourceText: officialText, relatedLessons, syllabusOutline, studentNotes: input.notes }),
      45_000,
      { json: true, maxTokens: 3000 },
    );
    let aid: ReturnType<typeof parseStudyAid>;
    try { aid = parseStudyAid(generated.answer, input.kind, source.reference); } catch { throw problem("AI returned no usable study material. Press Generate to try again.", 502, "AI_BAD_OUTPUT"); }
    const { title, items } = aid;
    if (!items.length) throw problem("AI returned no usable study material. Press Generate to try again.", 502, "AI_BAD_OUTPUT");
    const artifact = await prisma.studyArtifact.create({ data: { institutionId: ctx.user.institutionId, studentId: ctx.studentId, sectionId: input.sectionId, kind: input.kind, title, sourceJson: JSON.stringify([source]), contentJson: JSON.stringify(items), provider: generated.model } });
    await prisma.aiPlannerRun.create({ data: { institutionId: ctx.user.institutionId, accountId: ctx.user.accountId, studentId: ctx.studentId, prompt: `study-tool:${input.kind}`, inputSnapshotJson: JSON.stringify({ sectionId: input.sectionId, source, noteLength: input.notes.length }), outputJson: JSON.stringify({ artifactId: artifact.id, itemCount: items.length }), provider: generated.model, status: "accepted", acceptedAt: new Date() } });
    res.status(201).json({ artifact: { id: artifact.id, kind: artifact.kind, title: artifact.title, items, sources: [source], createdAt: artifact.createdAt.toISOString() } });
  } catch (error) { next(error); }
});

plannerRouter.get("/opportunities", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as AuthedRequest);
    const student = await prisma.student.findFirstOrThrow({ where: { id: studentId, institutionId: user.institutionId } });
    const [opportunities, bookmarks] = await Promise.all([
      prisma.careerOpportunity.findMany({ where: { institutionId: user.institutionId, status: "open" }, orderBy: { updatedAt: "desc" }, take: 50 }),
      prisma.opportunityBookmark.findMany({ where: { institutionId: user.institutionId, studentId }, select: { opportunityId: true } }),
    ]);
    const saved = new Set(bookmarks.map((row) => row.opportunityId));
    const program = student.programName.toLowerCase();
    const matches = opportunities.map((row) => {
      const programs = jsonStrings(row.programCodesJson);
      const skills = jsonStrings(row.skillsJson);
      const programMatch = programs.some((value) => program.includes(value.toLowerCase()) || value.toLowerCase().includes(program));
      const matchPercent = programs.length ? (programMatch ? 90 : 45) : 65;
      return { id: row.id, title: row.title, employerName: row.employerName, skills, programCodes: programs, status: row.status, href: row.href, updatedAt: row.updatedAt.toISOString(), lastCheckedAt: row.updatedAt.toISOString(), sourceType: "institution_managed", matchPercent, matchReason: programMatch ? `Matches ${student.programName}` : programs.length ? "Related opportunity; review eligibility" : "Open to multiple programs", bookmarked: saved.has(row.id) };
    }).sort((a, b) => b.matchPercent - a.matchPercent || b.updatedAt.localeCompare(a.updatedAt));
    res.json({ programName: student.programName, opportunities: matches });
  } catch (error) { next(error); }
});

plannerRouter.put("/opportunities/:id/bookmark", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    const opportunity = await prisma.careerOpportunity.findFirst({ where: { id: req.params.id, institutionId: user.institutionId, status: "open" } });
    if (!opportunity) throw problem("Opportunity not found", 404, "NOT_FOUND");
    await prisma.opportunityBookmark.upsert({ where: { studentId_opportunityId: { studentId, opportunityId: opportunity.id } }, create: { institutionId: user.institutionId, studentId, opportunityId: opportunity.id }, update: {} });
    res.json({ bookmarked: true });
  } catch (error) { next(error); }
});

plannerRouter.delete("/opportunities/:id/bookmark", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as unknown as AuthedRequest);
    await prisma.opportunityBookmark.deleteMany({ where: { institutionId: user.institutionId, studentId, opportunityId: req.params.id } });
    res.json({ bookmarked: false });
  } catch (error) { next(error); }
});

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

plannerRouter.get("/calendar-export", async (req, res, next) => {
  try {
    const { user, studentId } = await context(req as AuthedRequest);
    const scope = await academicScope(user.institutionId, studentId);
    const from = new Date(Date.now() - 30 * 86_400_000);
    const to = new Date(Date.now() + 180 * 86_400_000);
    const [classes, assignments, assessments, sessions, registrations] = await Promise.all([
      scope.sectionIds.length ? prisma.classSession.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, startsAt: { gte: from, lte: to } }, orderBy: { startsAt: "asc" } }) : [],
      scope.sectionIds.length ? prisma.assignment.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, hidden: false, dueAt: { gte: from, lte: to } }, orderBy: { dueAt: "asc" } }) : [],
      scope.sectionIds.length ? prisma.assessment.findMany({ where: { institutionId: user.institutionId, sectionId: { in: scope.sectionIds }, status: "published", opensAt: { lte: to }, closesAt: { gte: from } }, orderBy: { opensAt: "asc" } }) : [],
      prisma.studySession.findMany({ where: { institutionId: user.institutionId, studentId, scheduledAt: { gte: from, lte: to }, status: "planned" }, orderBy: { scheduledAt: "asc" } }),
      prisma.workshopRegistration.findMany({ where: { institutionId: user.institutionId, studentId, status: { in: ["approved", "registered"] } }, include: { workshop: true } }),
    ]);
    const events = [
      ...classes.map((row) => ({ id: `class-${row.id}`, kind: "class", title: row.title, startsAt: row.startsAt, endsAt: row.endsAt ?? new Date(row.startsAt.getTime() + 60 * 60_000), location: row.location })),
      ...assignments.filter((row) => row.dueAt).map((row) => ({ id: `assignment-${row.id}`, kind: "deadline", title: `Due: ${row.title}`, startsAt: row.dueAt!, endsAt: new Date(row.dueAt!.getTime() + 30 * 60_000), location: null })),
      ...assessments.map((row) => ({ id: `assessment-${row.id}`, kind: "exam", title: row.title, startsAt: row.opensAt, endsAt: row.closesAt, location: null })),
      ...sessions.map((row) => ({ id: `study-${row.id}`, kind: "study", title: row.title, startsAt: row.scheduledAt, endsAt: new Date(row.scheduledAt.getTime() + row.durationMinutes * 60_000), location: null })),
      ...registrations.filter((row) => row.workshop.startsAt >= from && row.workshop.startsAt <= to).map((row) => ({ id: `workshop-${row.workshop.id}`, kind: "workshop", title: row.workshop.title, startsAt: row.workshop.startsAt, endsAt: row.workshop.endsAt ?? new Date(row.workshop.startsAt.getTime() + 60 * 60_000), location: row.workshop.location })),
    ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Heritage//Student Planner//EN", "CALSCALE:GREGORIAN", ...events.flatMap((event) => ["BEGIN:VEVENT", `UID:${event.id}@heritage`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(event.startsAt)}`, `DTEND:${icsDate(event.endsAt)}`, `SUMMARY:${icsEscape(event.title)}`, ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []), `CATEGORIES:${event.kind.toUpperCase()}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
    await prisma.calendarConnection.upsert({ where: { studentId_provider: { studentId, provider: "device" } }, create: { institutionId: user.institutionId, studentId, provider: "device", lastExportedAt: new Date() }, update: { lastExportedAt: new Date(), status: "active", rowVersion: { increment: 1 } } });
    res.json({ mode: "read_only_export", filename: "heritage-study-calendar.ics", events: events.map((event) => ({ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString() })), ics });
  } catch (error) { next(error); }
});
