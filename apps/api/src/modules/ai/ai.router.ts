import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  adminAskDataAnswer,
  advisorAnswerFromProgress,
  assertToolAllowed,
  buildAiRequestContext,
  careerAssistantAnswer,
  extractDropCourseCode,
  facultyAssistantAnswer,
  groundedCoachAnswer,
  isAdvisorQuestion,
  isCareerAssistantQuestion,
  isFacultyAssistantQuestion,
  isStudentSuccessQuestion,
  isStudyCoachQuestion,
  listAiTools,
  resolveStudyCoachPolicy,
  runAiEvalSuite,
  studentSuccessAnswer,
  studyCoachAnswer,
} from "@myheritage/ai";
import {
  AiGovernanceSnapshot,
  AskCoachRequest,
  CoachAnswer,
  CoachHistoryResponse,
  type AiCapabilityId,
  type CoachSource,
  type CoachSuggestedAction,
  type DegreePlanAnalysis,
  type EnrollmentMetricsSnapshot,
  type ExecutiveMetricsSnapshot,
  type GradingSuggestion,
  type StudentRiskAnalysis,
} from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { buildCoachFacts, resolveCoachRole } from "./ai.service.js";
import { executeAiTool } from "./tool-executor.js";
import { listKnowledgeDocuments } from "./knowledge.service.js";
import { getExecutiveMetrics } from "./metrics.service.js";
import { askHeritageAi } from "../../lib/ask.js";
import { adminCampusFacts, relevantFacts } from "./admin-facts.js";
import { currentStudentId } from "../me/studentAlignment.js";
import { ensureProgramVersion } from "../academic/program-version.js";
import { hasOpenAssessmentAttempt } from "./assessment-policy.js";
import { containsRestrictedSecret } from "./input-policy.js";
import { GOVERNANCE_PATH, GovernancePolicy, assertGovernanceRoleAllowed, governancePolicy } from "./governance-policy.js";

const DEGREE_CAPABILITIES = new Set(["student_advisor", "degree_progress", "what_if_planner"]);

export const aiRouter: Router = Router();

const LLM_CAPABILITIES = new Set<AiCapabilityId>([
  "campus_coach",
  "study_coach",
  // faculty_assistant stays deterministic Teaching Ops cards — LLM rewrite
  // was inventing "I can't see schedule/attendance" even when facts existed.
  "student_success",
  "career_assistant",
  "student_services",
  "admissions_assistant",
  "admin_ask_data",
]);

function buildLlmSystemPrompt(input: {
  role: string;
  capability: AiCapabilityId;
  groundedText: string;
  sources: Array<{ title: string; uri?: string }>;
}) {
  const sourceLines = input.sources
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title}${s.uri ? ` (${s.uri})` : ""}`)
    .join("\n");
  return `You are Ask Heritage, the campus AI assistant for MyHeritage Campus OS.
You are helping a ${input.role} user via the ${input.capability} capability.

Rules:
- Answer the user's question directly in clear natural language.
- Use ONLY the campus evidence below. Do not invent grades, balances, seats, or policies.
- If evidence is incomplete, say what is missing and point the user to the right portal screen.
- Never repeat the user's question back as the entire answer.
- Keep the reply concise (about 4–10 short sentences or a short bullet list).

Campus evidence:
${input.groundedText}

Cited screens:
${sourceLines || "(none)"}`;
}

function validationError(message: string, issues?: unknown) {
  return Object.assign(new Error(message), { code: "VALIDATION_ERROR", status: 400, issues });
}

function parseStored<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function capabilityFromProvider(provider: string): AiCapabilityId {
  if (provider.startsWith("student_advisor")) return "student_advisor";
  if (provider.startsWith("study_coach")) return "study_coach";
  if (provider.startsWith("faculty_assistant")) return "faculty_assistant";
  if (provider.startsWith("grading_assistant")) return "grading_assistant";
  if (provider.startsWith("student_success")) return "student_success";
  if (provider.startsWith("intervention")) return "intervention_assistant";
  if (provider.startsWith("admin_ask")) return "admin_ask_data";
  if (provider.startsWith("admissions")) return "admissions_assistant";
  if (provider.startsWith("student_services")) return "student_services";
  if (provider.startsWith("career")) return "career_assistant";
  return "campus_coach";
}

aiRouter.use(requireAuth);

aiRouter.get("/tools", async (_req, res) => {
  res.json({ tools: listAiTools() });
});

/** Read-only KPI snapshot for the executive page; unlike /ask it records no AI interaction per view. */
aiRouter.get("/executive-metrics", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    assertToolAllowed("get_enrollment_metrics", user.roles);
    res.json({ executiveMetrics: await getExecutiveMetrics(user.institutionId) });
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/eval", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    if (!user.roles.includes("admin") && !user.roles.includes("registrar")) {
      throw Object.assign(new Error("AI eval is limited to admin and registrar roles"), {
        code: "FORBIDDEN",
        status: 403,
      });
    }
    const results = runAiEvalSuite();
    res.json({
      passed: results.every((row) => row.passed),
      results,
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.get("/governance", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    if (!user.roles.includes("admin") && !user.roles.includes("registrar")) {
      throw Object.assign(new Error("AI governance is limited to admin and registrar roles"), {
        code: "FORBIDDEN",
        status: 403,
      });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [knowledgeCount, recent, policy] = await Promise.all([
      prisma.knowledgeDocument.count({
        where: { institutionId: user.institutionId, status: "published" },
      }),
      prisma.aiInteraction.findMany({
        where: { institutionId: user.institutionId, createdAt: { gte: since } },
        select: { latencyMs: true, estimatedTokens: true, resultStatus: true },
      }),
      governancePolicy(user.institutionId),
    ]);
    const studyPolicy = resolveStudyCoachPolicy({});
    const requestsLast24h = recent.length;
    const estimatedTokensLast24h = recent.reduce((sum, row) => sum + (row.estimatedTokens ?? 0), 0);
    const avgLatencyMsLast24h =
      requestsLast24h === 0
        ? 0
        : Math.round(recent.reduce((sum, row) => sum + (row.latencyMs ?? 0), 0) / requestsLast24h);
    const failureCountLast24h = recent.filter((row) => row.resultStatus === "failed").length;
    res.json(
      AiGovernanceSnapshot.parse({
        models: [
          {
            id: "campus_grounding_v1",
            purpose: "Grounded campus coach",
            enabled: true,
            provider: "packages/ai",
          },
          {
            id: "student_advisor_v1",
            purpose: "Degree advisor",
            enabled: true,
            provider: "packages/ai",
          },
          {
            id: "study_coach_v1",
            purpose: "Study coach with integrity gates",
            enabled: true,
            provider: "packages/ai",
          },
          {
            id: "grading_assistant_v1",
            purpose: "Rubric draft feedback (never auto-publishes)",
            enabled: true,
            provider: "packages/ai",
          },
        ],
        tools: listAiTools(),
        policies: {
          ...studyPolicy,
          ...policy,
        },
        knowledgeSources: [
          {
            docType: "program_handbook",
            status: "published",
            note: `${knowledgeCount} published document(s) indexed for keyword retrieve`,
          },
        ],
        usage: {
          requestsLast24h,
          estimatedTokensLast24h,
          avgLatencyMsLast24h,
          failureCountLast24h,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

aiRouter.put("/governance", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    if (!user.roles.includes("admin")) {
      throw Object.assign(new Error("Only administrators can change AI governance"), { code: "FORBIDDEN", status: 403 });
    }
    const policy = GovernancePolicy.parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.sisScreenState.upsert({
        where: { institutionId_path: { institutionId: user.institutionId, path: GOVERNANCE_PATH } },
        create: { institutionId: user.institutionId, path: GOVERNANCE_PATH, payloadJson: JSON.stringify(policy) },
        update: { payloadJson: JSON.stringify(policy), rowVersion: { increment: 1 } },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "AiGovernance.updated",
        purpose: "ai_governance",
        before: null,
        after: policy,
        source: "ai.governance",
        correlationId: (req as unknown as AuthedRequest).correlationId,
      });
    });
    res.json({ ok: true, policies: { ...resolveStudyCoachPolicy({}), ...policy } });
  } catch (error) {
    next(error);
  }
});

aiRouter.get("/history", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const rows = await prisma.aiInteraction.findMany({
      where: { institutionId: user.institutionId, accountId: user.accountId, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const payload = {
      items: rows.map((row) => {
        const sources = parseStored<CoachSource[]>(row.sourcesJson, []);
        const home = row.role === "registrar" ? "/admin" : `/${row.role || "student"}`;
        return {
          interactionId: row.id,
          question: row.question,
          role: row.role,
          tier: row.tier === "draft" ? "draft" : "read_only",
          capability: row.capability
            ? capabilityFromProvider(row.capability)
            : capabilityFromProvider(row.provider),
          answer: row.answer || "No answer stored.",
          sources: sources.length
            ? sources
            : [{ id: `history:${row.id}`, title: "Campus records", uri: home.startsWith("/") ? home : "/student" }],
          suggestedActions: parseStored<CoachSuggestedAction[]>(row.suggestedActionsJson, []),
          claims: [],
          ...(row.feedback === "up" || row.feedback === "down" ? { feedback: row.feedback } : {}),
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
    const parsed = CoachHistoryResponse.safeParse(payload);
    res.json(parsed.success ? parsed.data : { items: [] });
  } catch (error) {
    next(error);
  }
});

aiRouter.get("/suggestions", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const contextPath = typeof req.query.contextPath === "string" ? req.query.contextPath : undefined;
    const role = resolveCoachRole(user, contextPath);
    const suggestions = role === "instructor"
      ? [
          "Which students are missing grades?",
          "Who has not submitted assignments?",
          "Summarize attendance for my sections",
          "What is pending my approval?",
        ]
      : role === "applicant"
        ? [
            "What is the status of my application?",
            "Which documents are still missing?",
            "What happens after I submit?",
            "Do I have an offer?",
          ]
        : role === "admin" || role === "registrar"
          ? [
              "Summarize current enrolment",
              "Which academic records need attention?",
              "What approvals are pending?",
              "Show current operational risks",
            ]
          : [
              "What is my current balance?",
              "Which assignments are due soon?",
              "How is my attendance?",
              "What happens if I drop a course?",
            ];
    res.json({ role, suggestions });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/interactions/:interactionId/feedback", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const value = (req.body as { value?: unknown } | undefined)?.value;
    if (value !== "up" && value !== "down") throw validationError("Feedback must be up or down");
    const interaction = await prisma.aiInteraction.findFirst({
      where: {
        id: req.params.interactionId,
        institutionId: user.institutionId,
        accountId: user.accountId,
        status: "completed",
      },
      select: { id: true, feedback: true },
    });
    if (!interaction) {
      throw Object.assign(new Error("AI interaction not found"), { code: "NOT_FOUND", status: 404 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.aiInteraction.update({ where: { id: interaction.id }, data: { feedback: value, rowVersion: { increment: 1 } } });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "AiInteraction.feedbackUpdated",
        purpose: "ai_quality_feedback",
        before: { feedback: interaction.feedback },
        after: { feedback: value },
        source: "ai.feedback",
        correlationId: (req as unknown as AuthedRequest).correlationId,
        outboxPayload: { interactionId: interaction.id, feedback: value },
      });
    });
    res.json({ ok: true, interactionId: interaction.id, feedback: value });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/ask", async (req, res, next) => {
  const requestStartedAt = Date.now();
  const requestUser = (req as AuthedRequest).user;
  let failedQuestion: string | null = null;
  let failedRole = "unknown";
  let failedCapability: AiCapabilityId = "campus_coach";
  try {
    const user = requestUser;
    const parsed = AskCoachRequest.safeParse(req.body);
    if (!parsed.success) throw validationError("Invalid Coach question", parsed.error.issues);
    if (containsRestrictedSecret(parsed.data.question)) {
      throw validationError("Do not include government identifiers or credential secrets in Coach questions");
    }
    failedQuestion = parsed.data.question;
    const governance = await governancePolicy(user.institutionId);
    assertGovernanceRoleAllowed(governance, user.roles);
    const usedLastHour = await prisma.aiInteraction.count({
      where: {
        institutionId: user.institutionId,
        accountId: user.accountId,
        createdAt: { gte: new Date(Date.now() - 3_600_000) },
      },
    });
    if (usedLastHour >= governance.maxRequestsPerHour) {
      throw Object.assign(new Error("Institutional AI request limit reached. Try again later."), {
        code: "RATE_LIMITED",
        status: 429,
      });
    }
    const idempotencyKey = req.header("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw validationError("A valid Idempotency-Key header is required");
    }
    const idempotencyPath = `/ai/ask/${user.accountId}`;
    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        institutionId_key_method_path: {
          institutionId: user.institutionId,
          key: idempotencyKey,
          method: "POST",
          path: idempotencyPath,
        },
      },
    });
    if (existing) {
      if (existing.statusCode === 0) {
        throw Object.assign(new Error("An identical Coach request is still processing"), {
          code: "CONFLICT",
          status: 409,
        });
      }
      res.status(existing.statusCode).json(JSON.parse(existing.responseJson));
      return;
    }

    const recentCount = await prisma.aiInteraction.count({
      where: {
        institutionId: user.institutionId,
        accountId: user.accountId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentCount >= 20) {
      throw Object.assign(new Error("Coach request limit reached; try again in a minute"), {
        code: "RATE_LIMITED",
        status: 429,
      });
    }

    const role = resolveCoachRole(user, parsed.data.contextPath);
    failedRole = role;
    const question = parsed.data.question;
    const requested = parsed.data.capability;

    let capability: AiCapabilityId = "campus_coach";
    if (requested) capability = requested;
    else if (role === "student" && isAdvisorQuestion(question)) capability = "student_advisor";
    else if (role === "student" && isCareerAssistantQuestion(question)) capability = "career_assistant";
    else if (role === "student" && isStudyCoachQuestion(question)) capability = "study_coach";
    else if (role === "student" && isStudentSuccessQuestion(question)) capability = "student_success";
    else if (role === "admin" || role === "registrar") capability = "admin_ask_data";
    else if (role === "instructor" && /rubric|grade suggestion|draft feedback|suggest.*score/.test(question.toLowerCase()))
      capability = "grading_assistant";
    else if (role === "instructor") capability = "faculty_assistant";
    else if (role === "applicant") capability = requested ?? "admissions_assistant";
    else if (
      role === "student" &&
      /transcript|withdraw|reading week|accommodation|tuition receipt|change my address|book.*advisor|student services/.test(
        question.toLowerCase(),
      )
    ) {
      capability = /book.*advisor/.test(question.toLowerCase()) ? "student_advisor" : "student_services";
    }
    failedCapability = capability;
    if (capability === "grading_assistant" && !governance.gradingAssistanceAllowed) {
      throw Object.assign(new Error("AI grading assistance is disabled by institutional policy"), {
        code: "FORBIDDEN",
        status: 403,
      });
    }

    const startedAt = Date.now();

    let student =
      role === "student"
        ? await prisma.student.findFirst({
            where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
          })
        : null;
    if (student && !student.programVersionId && DEGREE_CAPABILITIES.has(capability)) {
      const versionId = await ensureProgramVersion(user.institutionId, student.id).catch(() => null);
      if (versionId) student = { ...student, programVersionId: versionId };
    }
    const assessmentAttemptOpen = student
      ? await hasOpenAssessmentAttempt(user.institutionId, student.id)
      : false;

    const ctx = buildAiRequestContext({
      user,
      capability,
      contextPath: parsed.data.contextPath,
      activeStudentId: student?.id,
      activeCourseId: parsed.data.activeCourseId,
      activeSectionId: parsed.data.activeSectionId,
      assessmentAttemptOpen,
    });

    const coachFacts = await buildCoachFacts(user, role);
    let grounded = groundedCoachAnswer({
      role,
      question,
      facts: coachFacts,
    });
    let provider = "campus_grounding_v1";
    let analysis: DegreePlanAnalysis | undefined;
    let riskAnalysis: StudentRiskAnalysis | undefined;
    let metrics: EnrollmentMetricsSnapshot | undefined;
    let executiveMetrics: ExecutiveMetricsSnapshot | undefined;
    let gradingSuggestion: GradingSuggestion | undefined;
    let studyPolicy = capability === "study_coach" ? resolveStudyCoachPolicy({
      assessmentAttemptOpen,
      contextPath: parsed.data.contextPath,
    }) : undefined;

    if (capability === "student_advisor" || capability === "degree_progress" || capability === "what_if_planner") {
      assertToolAllowed("get_degree_progress", user.roles);
      if (!student?.programVersionId) {
        grounded = {
          tier: "read_only",
          text: "I cannot answer degree-planning questions yet because no program version is assigned to your student record. Open Advising to request a program assignment.",
          sources: [{ id: "portal:advising", title: "Advising", uri: "/student/advising" }],
          suggestedActions: [{ label: "Open advising", href: "/student/advising" }],
          claims: [
            {
              kind: "uncertainty",
              text: "Program version is missing on the student record.",
              evidenceIds: [],
            },
          ],
        };
      } else {
        const dropCode = extractDropCourseCode(question);
        if (/book (my )?advisor|schedule (an )?advisor|advisor (meeting|appointment)/i.test(question)) {
          const appointment = (await executeAiTool("create_advisor_appointment", ctx, {
            studentId: student.id,
            topic: "Degree plan review",
            startsAt: parsed.data.appointmentStartsAt ?? new Date(Date.now() + 3 * 86_400_000).toISOString(),
            notes: "Requested via Ask Heritage",
          })) as { id: string; topic: string; startsAt: string; status: string };
          grounded = {
            tier: "draft",
            text: `FACT: Advising appointment requested (${appointment.status}).\nTopic: ${appointment.topic}\nStarts: ${appointment.startsAt}\nACTION: Appointment id ${appointment.id} is saved for advisor confirmation.`,
            sources: [{ id: `advising:${appointment.id}`, title: "Advising appointment", uri: "/student/advising" }],
            suggestedActions: [
              { label: "Open advising", href: "/student/advising" },
              { label: "View degree plan", href: "/student/degree" },
            ],
            claims: [
              {
                kind: "action",
                text: "Advisor appointment request created (Level 3).",
                evidenceIds: [`advising:${appointment.id}`],
              },
            ],
          };
        } else if (dropCode) {
          const impact = (await executeAiTool("create_degree_plan_scenario", ctx, {
            studentId: student.id,
            courseCode: dropCode,
          })) as Awaited<ReturnType<typeof import("../academic/degree-progress.service.js").impactIfDropCourse>>;
          analysis = impact.projected;
          grounded = advisorAnswerFromProgress({
            question,
            progress: impact.projected,
            impact: {
              courseCode: dropCode,
              impactSummary: impact.impactSummary,
              downstream: impact.downstream,
              projectedCompletionTerm: impact.projected.projectedCompletionTerm,
              baselineCompletionTerm: impact.baseline.projectedCompletionTerm,
            },
          });
        } else {
          analysis = (await executeAiTool("get_degree_progress", ctx, {
            studentId: student.id,
          })) as DegreePlanAnalysis;
          grounded = advisorAnswerFromProgress({ question, progress: analysis });
        }
      }
      provider = "student_advisor_v1";
      capability = "student_advisor";
    } else if (capability === "study_coach") {
      const content = (await executeAiTool("get_course_content", ctx, {})) as Array<{
        id: string;
        title: string;
        uri: string;
        text: string;
      }>;
      const knowledge = await listKnowledgeDocuments({
        institutionId: user.institutionId,
        question,
      });
      const merged = [
        ...content,
        ...knowledge.map((hit) => ({
          id: `knowledge:${hit.id}`,
          title: hit.title,
          uri: hit.uri,
          text: hit.excerpt,
        })),
      ];
      const studyResult = studyCoachAnswer({
        question,
        content: merged,
        contextPath: parsed.data.contextPath,
        assessmentAttemptOpen,
      });
      grounded = studyResult;
      studyPolicy = studyResult.studyPolicy;
      provider = "study_coach_v1";
    } else if (capability === "admin_ask_data") {
      assertToolAllowed("get_enrollment_metrics", user.roles);
      executiveMetrics = await getExecutiveMetrics(user.institutionId);
      const all = await adminCampusFacts(user.institutionId);
      const cited = relevantFacts(question, all);
      const base = adminAskDataAnswer({ question, facts: cited });
      grounded = {
        ...base,
        sources: cited.map(({ id, title, uri }) => ({ id, title, uri })),
        suggestedActions: cited.slice(0, 4).map((f) => ({ label: `Open ${f.title.toLowerCase()}`, href: f.uri })),
        claims: cited.map((f) => ({ kind: "fact" as const, text: f.text.slice(0, 500), evidenceIds: [f.id] })),
      };
      provider = "admin_ask_data_v1";
    } else if (capability === "faculty_assistant") {
      const rows = (await executeAiTool("get_section_missing_submissions", ctx, {})) as Array<{
        studentId: string;
        studentNumber: string;
        displayName: string;
        assignmentId: string;
        assignmentTitle: string;
        sectionCode: string;
        courseCode: string;
        dueAt: string | null;
      }>;
      grounded = facultyAssistantAnswer({
        question,
        contextPath: parsed.data.contextPath,
        facts: coachFacts,
        rows: rows.map((row) => {
          let dueLabel = "";
          if (row.dueAt) {
            const d = new Date(row.dueAt);
            dueLabel = Number.isNaN(d.getTime())
              ? ` (due ${row.dueAt})`
              : ` (due ${new Intl.DateTimeFormat("en-CA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Vancouver",
                })
                  .format(d)
                  .replace(/\.$/, "")})`;
          }
          return {
            id: `missing:${row.assignmentId}:${row.studentId}`,
            title: `${row.courseCode} · ${row.assignmentTitle}`,
            uri: "/instructor/gradebook",
            text: `${row.displayName} (${row.studentNumber}) has not submitted “${row.assignmentTitle}” for ${row.courseCode} ${row.sectionCode}${dueLabel}.`,
          };
        }),
      });
      provider = "faculty_assistant_v1";
    } else if (capability === "student_success") {
      if (!student) {
        throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
      }
      riskAnalysis = (await executeAiTool("get_student_success_signals", ctx, {
        studentId: student.id,
      })) as StudentRiskAnalysis;
      grounded = studentSuccessAnswer({
        level: riskAnalysis.level,
        signals: riskAnalysis.signals,
        explanation: riskAnalysis.explanation,
      });
      provider = "student_success_v1";
    } else if (capability === "career_assistant") {
      const opportunities = (await executeAiTool("get_career_opportunities", ctx, {})) as Array<{
        id: string;
        title: string;
        employerName: string;
        href: string;
        skillsJson: string;
      }>;
      grounded = careerAssistantAnswer({ opportunities });
      provider = "career_assistant_v1";
    } else if (capability === "grading_assistant") {
      const assignment = await prisma.assignment.findFirst({
        where: {
          institutionId: user.institutionId,
          section: { institutionId: user.institutionId, instructorPersonId: user.personId },
          rubricId: { not: null },
        },
        include: {
          section: {
            include: {
              enrolments: {
                where: { institutionId: user.institutionId, status: { in: ["enrolled", "completed"] } },
                take: 1,
              },
            },
          },
        },
      });
      if (!assignment?.rubricId || !assignment.section.enrolments[0]) {
        grounded = {
          tier: "read_only",
          text: "No rubric-linked assignment with enrolled students was found in your sections. Link a rubric before requesting draft feedback.",
          sources: [{ id: "faculty:rubric", title: "Gradebook", uri: "/instructor/gradebook" }],
          suggestedActions: [{ label: "Open gradebook", href: "/instructor/gradebook" }],
          claims: [
            {
              kind: "uncertainty",
              text: "Rubric-linked assignment required for grading assistant.",
              evidenceIds: [],
            },
          ],
        };
      } else {
        gradingSuggestion = (await executeAiTool("draft_grading_suggestion", ctx, {
          assignmentId: assignment.id,
          studentId: assignment.section.enrolments[0].studentId,
        })) as GradingSuggestion;
        grounded = {
          tier: "draft",
          text: [
            "Draft grading suggestion (not published):",
            gradingSuggestion.feedback,
            `Suggested total: ${gradingSuggestion.suggestedTotal}`,
            gradingSuggestion.confidenceNote,
            ...gradingSuggestion.flags.map((flag) => `Flag: ${flag}`),
          ].join("\n"),
          sources: [{ id: `rubric:${gradingSuggestion.rubricId}`, title: "Rubric", uri: "/instructor/gradebook" }],
          suggestedActions: [{ label: "Open gradebook", href: "/instructor/gradebook" }],
          claims: gradingSuggestion.claims,
        };
      }
      provider = "grading_assistant_v1";
    } else if (capability === "intervention_assistant") {
      const signalStudentId =
        typeof (req.body as { studentId?: string }).studentId === "string"
          ? (req.body as { studentId: string }).studentId
          : student?.id;
      if (!signalStudentId) {
        throw Object.assign(new Error("studentId required to open an intervention case"), {
          code: "VALIDATION_ERROR",
          status: 400,
        });
      }
      riskAnalysis = (await executeAiTool(
        "get_student_success_signals",
        { ...ctx, activeStudentId: signalStudentId },
        { studentId: signalStudentId },
      )) as StudentRiskAnalysis;
      const opened = (await executeAiTool("create_student_success_case", ctx, {
        studentId: signalStudentId,
        level: riskAnalysis.level === "none" ? "watch" : riskAnalysis.level,
        summary: riskAnalysis.explanation,
        signals: riskAnalysis.signals,
      })) as { id: string; taskTitles: string[] };
      grounded = {
        tier: "draft",
        text: [
          `Intervention case opened (${opened.id}).`,
          riskAnalysis.explanation,
          "Tasks:",
          ...opened.taskTitles.map((title) => `• ${title}`),
          "AI recommended these actions; humans complete outreach.",
        ].join("\n"),
        sources:
          riskAnalysis.signals.length > 0
            ? riskAnalysis.signals.map((s) => ({ id: s.id, title: s.label, uri: s.evidenceUri }))
            : [{ id: `case:${opened.id}`, title: "Success case", uri: "/student/success" }],
        suggestedActions: riskAnalysis.recommendedActions,
        claims: riskAnalysis.claims,
      };
      provider = "intervention_assistant_v1";
    } else if (capability === "student_services" || capability === "admissions_assistant") {
      const knowledge = await listKnowledgeDocuments({
        institutionId: user.institutionId,
        question,
      });
      if (knowledge.length) {
        grounded = {
          tier: "read_only",
          text: [
            capability === "admissions_assistant"
              ? "Admissions guidance from published institutional documents:"
              : "Student services guidance from published institutional documents:",
            "",
            ...knowledge.map((hit, index) => `${index + 1}. ${hit.title} (${hit.versionLabel}): ${hit.excerpt}`),
            "",
            "Confirm deadlines on the cited source before acting.",
          ].join("\n"),
          sources: knowledge.map((hit) => ({ id: hit.id, title: hit.title, uri: hit.uri })),
          suggestedActions:
            capability === "admissions_assistant"
              ? [
                  { label: "Open application", href: "/applicant/application" },
                  { label: "Documents", href: "/applicant/documents" },
                ]
              : [
                  { label: "Advising", href: "/student/advising" },
                  { label: "Fees", href: "/student/fees" },
                  { label: "Documents", href: "/student/documents" },
                ],
          claims: knowledge.map((hit) => ({
            kind: "fact" as const,
            text: hit.title,
            evidenceIds: [hit.id],
          })),
        };
        provider = capability === "admissions_assistant" ? "admissions_assistant_v1" : "student_services_v1";
      }
    }

    if (LLM_CAPABILITIES.has(capability) && grounded.text.trim()) {
      try {
        const llm = await askHeritageAi({
          question,
          role,
          systemPrompt: buildLlmSystemPrompt({
            role,
            capability,
            groundedText: grounded.text,
            sources: grounded.sources,
          }),
        });
        if (
          llm.source !== "fallback" &&
          llm.answer.trim() &&
          llm.answer.trim().toLowerCase() !== question.trim().toLowerCase()
        ) {
          grounded = { ...grounded, text: llm.answer.trim() };
          provider = `${provider}+${llm.source}`;
        }
      } catch {
        /* keep grounded template answer */
      }
    }

    const latencyMs = Date.now() - startedAt;
    const estimatedTokens = Math.ceil((question.length + grounded.text.length) / 4);
    const interactionId = randomUUID();
    const createdAt = new Date();
    const response = CoachAnswer.parse({
      interactionId,
      role,
      tier: grounded.tier === "draft" ? "draft" : "read_only",
      capability,
      answer: grounded.text,
      sources: grounded.sources,
      suggestedActions: grounded.suggestedActions,
      claims: grounded.claims ?? [],
      analysis,
      riskAnalysis,
      metrics,
      executiveMetrics,
      gradingSuggestion,
      studyPolicy,
      createdAt: createdAt.toISOString(),
    });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: {
            institutionId: user.institutionId,
            key: idempotencyKey,
            method: "POST",
            path: idempotencyPath,
            responseJson: "{}",
            statusCode: 0,
          },
        });
        await tx.aiInteraction.create({
          data: {
            id: interactionId,
            institutionId: user.institutionId,
            accountId: user.accountId,
            role,
            question,
            answer: response.answer,
            sourcesJson: JSON.stringify(response.sources),
            suggestedActionsJson: JSON.stringify(response.suggestedActions),
            tier: response.tier,
            provider,
            capability,
            latencyMs,
            estimatedTokens,
            resultStatus: "completed",
            status: "completed",
            createdAt,
          },
        });
        await writeAuditAndOutbox(tx, {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "AiInteraction.created",
          purpose: `grounded_${capability}`,
          before: null,
          after: {
            interactionId,
            role,
            tier: response.tier,
            capability,
            latencyMs,
            estimatedTokens,
            sourceIds: response.sources.map((source) => source.id),
            toolsHint: capability,
          },
          source: "ai.ask",
          correlationId: (req as AuthedRequest).correlationId,
          outboxPayload: { interactionId, role, tier: response.tier, capability, latencyMs },
        });
        await tx.idempotencyKey.update({
          where: {
            institutionId_key_method_path: {
              institutionId: user.institutionId,
              key: idempotencyKey,
              method: "POST",
              path: idempotencyPath,
            },
          },
          data: { responseJson: JSON.stringify(response), statusCode: 200 },
        });
      });
      res.json(response);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const completed = await prisma.idempotencyKey.findUnique({
          where: {
            institutionId_key_method_path: {
              institutionId: user.institutionId,
              key: idempotencyKey,
              method: "POST",
              path: idempotencyPath,
            },
          },
        });
        if (completed && completed.statusCode > 0) {
          res.status(completed.statusCode).json(JSON.parse(completed.responseJson));
          return;
        }
        throw Object.assign(new Error("An identical Coach request is already processing"), {
          code: "CONFLICT",
          status: 409,
        });
      }
      throw error;
    }
  } catch (error) {
    if (failedQuestion) {
      const interactionId = randomUUID();
      const errorCode = String((error as { code?: string }).code || "AI_REQUEST_FAILED").slice(0, 80);
      await prisma.$transaction(async (tx) => {
        await tx.aiInteraction.create({
          data: {
            id: interactionId,
            institutionId: requestUser.institutionId,
            accountId: requestUser.accountId,
            role: failedRole,
            question: failedQuestion!,
            answer: "Request failed",
            sourcesJson: "[]",
            suggestedActionsJson: "[]",
            tier: "read_only",
            provider: "campus_grounding_v1",
            capability: failedCapability,
            latencyMs: Date.now() - requestStartedAt,
            estimatedTokens: Math.ceil(failedQuestion!.length / 4),
            resultStatus: "failed",
            status: "failed",
          },
        });
        await writeAuditAndOutbox(tx, {
          institutionId: requestUser.institutionId,
          actorId: requestUser.accountId,
          eventName: "AiInteraction.failed",
          purpose: `grounded_${failedCapability}`,
          before: null,
          after: { interactionId, role: failedRole, capability: failedCapability, errorCode },
          source: "ai.ask",
          correlationId: (req as AuthedRequest).correlationId,
        });
      }).catch((auditError) => console.error("failed AI interaction audit failed", auditError));
    }
    next(error);
  }
});
