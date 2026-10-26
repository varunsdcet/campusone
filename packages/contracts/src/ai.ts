import { z } from "zod";
import { IsoDateTime, Uuid } from "./base.js";
import { RoleName } from "./entities.js";

/** Action risk levels for AI capabilities (0 = answer … 4 = high-risk). */
export const AiActionClass = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const AiCapabilityId = z.enum([
  "campus_coach",
  "student_advisor",
  "degree_progress",
  "what_if_planner",
  "study_coach",
  "faculty_assistant",
  "student_success",
  "admin_ask_data",
  "admissions_assistant",
  "student_services",
  "career_assistant",
  "grading_assistant",
  "intervention_assistant",
]);

export const AiClaimKind = z.enum(["fact", "inference", "uncertainty", "action"]);

export const AiClaim = z.object({
  kind: AiClaimKind,
  text: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

export const AiToolName = z.enum([
  "get_student_profile",
  "get_academic_record",
  "get_degree_requirements",
  "get_degree_progress",
  "get_course_catalog",
  "get_prerequisite_graph",
  "create_degree_plan_scenario",
  "save_degree_plan_scenario",
  "get_knowledge_documents",
  "get_course_content",
  "get_enrollment_metrics",
  "get_section_missing_submissions",
  "get_student_success_signals",
  "get_admissions_application_summary",
  "get_rubric",
  "draft_grading_suggestion",
  "create_advisor_appointment",
  "create_student_success_case",
  "get_executive_metrics",
  "get_career_opportunities",
  "get_course_offerings",
  "get_transfer_credits",
]);

export const AiToolDefinition = z.object({
  name: AiToolName,
  purpose: z.string().min(1),
  personas: z.array(RoleName).min(1),
  permissionKey: z.string().min(1),
  readOnly: z.boolean(),
  consequential: z.boolean(),
  approvalRequired: z.boolean(),
  actionClass: AiActionClass,
  auditEventName: z.string().min(1).nullable(),
});

/** Frozen allowlist — add tools only via contracts change. */
export const AI_TOOL_REGISTRY: z.infer<typeof AiToolDefinition>[] = [
  {
    name: "get_student_profile",
    purpose: "Read the authenticated student's profile within their institution",
    personas: ["student", "admin", "registrar"],
    permissionKey: "student.profile.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_academic_record",
    purpose: "Read enrolments and published grades for an authorized student",
    personas: ["student", "admin", "registrar"],
    permissionKey: "student.record.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_degree_requirements",
    purpose: "Read degree requirements for the student's program version",
    personas: ["student", "admin", "registrar"],
    permissionKey: "academic.requirements.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_degree_progress",
    purpose: "Compute remaining requirements and projected completion",
    personas: ["student", "admin", "registrar"],
    permissionKey: "academic.progress.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_course_catalog",
    purpose: "Read institution-scoped course catalog entries",
    personas: ["student", "instructor", "admin", "registrar", "applicant"],
    permissionKey: "catalog.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_prerequisite_graph",
    purpose: "Read prerequisite edges for the institution catalog",
    personas: ["student", "instructor", "admin", "registrar"],
    permissionKey: "academic.prerequisites.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "create_degree_plan_scenario",
    purpose: "Run a what-if scenario without mutating the official record",
    personas: ["student"],
    permissionKey: "academic.scenario.create",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 2,
    auditEventName: null,
  },
  {
    name: "save_degree_plan_scenario",
    purpose: "Persist a draft degree plan scenario for advisor review",
    personas: ["student"],
    permissionKey: "academic.scenario.save",
    readOnly: false,
    consequential: true,
    approvalRequired: false,
    actionClass: 3,
    auditEventName: "DegreePlanScenario.created",
  },
  {
    name: "get_knowledge_documents",
    purpose: "Retrieve published institutional knowledge documents for grounding",
    personas: ["student", "instructor", "admin", "registrar", "applicant"],
    permissionKey: "knowledge.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_course_content",
    purpose: "Read instructor-published course/assignment content for enrolled students",
    personas: ["student", "instructor"],
    permissionKey: "course.content.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_enrollment_metrics",
    purpose: "Return controlled institution enrollment aggregates for authorized admins",
    personas: ["admin", "registrar"],
    permissionKey: "analytics.enrollment.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_section_missing_submissions",
    purpose: "List students missing submissions in the instructor's assigned sections",
    personas: ["instructor"],
    permissionKey: "instructor.section.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_student_success_signals",
    purpose: "Compute explainable academic risk signals for authorized viewers",
    personas: ["student", "instructor", "admin", "registrar"],
    permissionKey: "success.signals.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_admissions_application_summary",
    purpose: "Summarize the applicant's own application status and documents",
    personas: ["applicant", "admin", "registrar"],
    permissionKey: "admissions.application.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_rubric",
    purpose: "Read a published rubric for an authorized instructor assignment",
    personas: ["instructor", "admin", "registrar"],
    permissionKey: "instructor.rubric.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "draft_grading_suggestion",
    purpose: "Draft rubric-aligned feedback; never publishes final grades",
    personas: ["instructor"],
    permissionKey: "instructor.grading.draft",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 2,
    auditEventName: null,
  },
  {
    name: "create_advisor_appointment",
    purpose: "Request an advising appointment for the authenticated student",
    personas: ["student"],
    permissionKey: "student.advising.write",
    readOnly: false,
    consequential: true,
    approvalRequired: false,
    actionClass: 3,
    auditEventName: "AdvisingAppointment.created",
  },
  {
    name: "create_student_success_case",
    purpose: "Open a student-success intervention case from explainable signals",
    personas: ["instructor", "admin", "registrar"],
    permissionKey: "success.case.write",
    readOnly: false,
    consequential: true,
    approvalRequired: false,
    actionClass: 3,
    auditEventName: "SuccessCase.created",
  },
  {
    name: "get_executive_metrics",
    purpose: "Return controlled executive academic/enrollment KPIs",
    personas: ["admin", "registrar"],
    permissionKey: "analytics.executive.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_career_opportunities",
    purpose: "List institution career opportunities relevant to the student program",
    personas: ["student"],
    permissionKey: "career.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_course_offerings",
    purpose: "Read published term offerings and seat availability",
    personas: ["student", "instructor", "admin", "registrar"],
    permissionKey: "catalog.offerings.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
  {
    name: "get_transfer_credits",
    purpose: "Read accepted transfer credits for an authorized student",
    personas: ["student", "admin", "registrar"],
    permissionKey: "academic.transfer.read",
    readOnly: true,
    consequential: false,
    approvalRequired: false,
    actionClass: 1,
    auditEventName: null,
  },
];

export const AiRequestContext = z.object({
  accountId: Uuid,
  personId: Uuid,
  institutionId: Uuid,
  roles: z.array(RoleName),
  sessionId: Uuid,
  capability: AiCapabilityId,
  contextPath: z.string().startsWith("/").max(200).optional(),
  activeStudentId: Uuid.optional(),
  activeCourseId: Uuid.optional(),
  activeSectionId: Uuid.optional(),
  activeTermId: Uuid.optional(),
  assessmentAttemptOpen: z.boolean().default(false),
});

export const StudyCoachPolicy = z.object({
  tutoringAllowed: z.boolean(),
  hintsAllowed: z.boolean(),
  solutionExplanationAllowed: z.boolean(),
  fullAnswerGenerationAllowed: z.boolean(),
  mode: z.enum(["tutoring", "assessment", "exam", "assignment"]),
  reason: z.string().min(1).optional(),
});

export const RequirementStatus = z.enum(["satisfied", "in_progress", "missing", "blocked"]);

export const DegreeRequirementItem = z.object({
  id: Uuid,
  code: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().nonnegative(),
  kind: z.enum(["required", "elective", "capstone"]),
  status: RequirementStatus,
  satisfiedByCourseCode: z.string().nullable(),
  blockedByCourseCodes: z.array(z.string()),
});

export const PrerequisiteEdge = z.object({
  courseCode: z.string().min(1),
  requiresCourseCode: z.string().min(1),
});

export const DegreePlanAnalysis = z.object({
  studentId: Uuid,
  programCode: z.string().min(1),
  programName: z.string().min(1),
  programVersionLabel: z.string().min(1),
  remainingCredits: z.number().nonnegative(),
  completedCredits: z.number().nonnegative(),
  requiredCredits: z.number().positive(),
  remainingRequirements: z.array(DegreeRequirementItem),
  satisfiedRequirements: z.array(DegreeRequirementItem),
  prerequisiteConflicts: z.array(
    z.object({
      courseCode: z.string(),
      missingPrerequisites: z.array(z.string()),
    }),
  ),
  prerequisiteGraph: z.array(PrerequisiteEdge),
  failedCourseCodes: z.array(z.string()).default([]),
  projectedCompletionTerm: z.string().nullable(),
  warnings: z.array(z.string()),
  suggestedOptions: z.array(z.string()),
  evidence: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      uri: z.string().startsWith("/"),
    }),
  ),
  claims: z.array(AiClaim).default([]),
});

export const WhatIfScenarioRequest = z.object({
  dropCourseCodes: z.array(z.string().min(1)).max(20).default([]),
  failCourseCodes: z.array(z.string().min(1)).max(20).default([]),
  addCourseCodes: z.array(z.string().min(1)).max(20).default([]),
  label: z.string().trim().min(1).max(120).optional(),
  save: z.boolean().default(false),
});

export const WhatIfScenarioResponse = z.object({
  scenarioId: Uuid.nullable(),
  label: z.string(),
  baseline: DegreePlanAnalysis,
  projected: DegreePlanAnalysis,
  impactSummary: z.array(z.string()),
  claims: z.array(AiClaim),
});

export const DegreeProgressUnassigned = z.object({
  studentId: Uuid,
  programAssigned: z.literal(false),
  message: z.string().min(1),
});

export const DegreeProgressResponse = z.union([DegreePlanAnalysis, DegreeProgressUnassigned]);

export const KnowledgeHit = z.object({
  id: Uuid,
  slug: z.string().min(1),
  title: z.string().min(1),
  docType: z.string().min(1),
  uri: z.string().startsWith("/"),
  versionLabel: z.string().min(1),
  excerpt: z.string().min(1),
});

export const StudentRiskSignal = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  evidenceUri: z.string().startsWith("/"),
});

export const StudentRiskAnalysis = z.object({
  studentId: Uuid,
  level: z.enum(["none", "watch", "elevated"]),
  signals: z.array(StudentRiskSignal),
  explanation: z.string().min(1),
  recommendedActions: z.array(
    z.object({
      label: z.string().min(1),
      href: z.string().startsWith("/"),
    }),
  ),
  claims: z.array(AiClaim).default([]),
});

export const EnrollmentMetricsSnapshot = z.object({
  institutionId: Uuid,
  asOf: IsoDateTime,
  studentCount: z.number().int().nonnegative(),
  sectionCount: z.number().int().nonnegative(),
  enrolmentCount: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  byProgram: z.array(
    z.object({
      programCode: z.string(),
      programName: z.string(),
      studentCount: z.number().int().nonnegative(),
    }),
  ),
  lowUtilizationSections: z.array(
    z.object({
      sectionCode: z.string(),
      courseCode: z.string(),
      enrolled: z.number().int().nonnegative(),
      capacityAssumption: z.number().int().positive(),
      utilizationPct: z.number().nonnegative(),
    }),
  ),
  filters: z.object({
    institutionScoped: z.literal(true),
  }),
  source: z.literal("controlled_enrollment_metrics_v1"),
});

export const MissingSubmissionRow = z.object({
  studentId: Uuid,
  studentNumber: z.string(),
  displayName: z.string(),
  assignmentId: Uuid,
  assignmentTitle: z.string(),
  sectionCode: z.string(),
  courseCode: z.string(),
  dueAt: IsoDateTime.nullable(),
});

export const AiGovernanceSnapshot = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      purpose: z.string(),
      enabled: z.boolean(),
      provider: z.string(),
    }),
  ),
  tools: z.array(AiToolDefinition),
  policies: StudyCoachPolicy.extend({
    studentAiAllowed: z.boolean(),
    instructorAiAllowed: z.boolean(),
    gradingAssistanceAllowed: z.boolean(),
    adminAiAllowed: z.boolean(),
    maxRequestsPerHour: z.number().int().min(1).max(10000),
  }),
  knowledgeSources: z.array(
    z.object({
      docType: z.string(),
      status: z.string(),
      note: z.string(),
    }),
  ),
  usage: z
    .object({
      requestsLast24h: z.number().int().nonnegative(),
      estimatedTokensLast24h: z.number().int().nonnegative(),
      avgLatencyMsLast24h: z.number().nonnegative(),
      failureCountLast24h: z.number().int().nonnegative(),
    })
    .optional(),
});

export const GradingSuggestion = z.object({
  assignmentId: Uuid,
  studentId: Uuid,
  rubricId: Uuid,
  rubricItems: z.array(
    z.object({
      criterionId: Uuid,
      label: z.string(),
      maxPoints: z.number(),
      suggestedPoints: z.number(),
      rationale: z.string(),
    }),
  ),
  suggestedTotal: z.number(),
  feedback: z.string(),
  confidenceNote: z.string(),
  flags: z.array(z.string()),
  claims: z.array(AiClaim).default([]),
});

export const AdvisingAppointmentRequest = z.object({
  topic: z.string().trim().min(3).max(200),
  startsAt: IsoDateTime,
  notes: z.string().trim().max(2000).optional(),
});

export const AdvisingAppointmentRecord = z.object({
  id: Uuid,
  studentId: Uuid,
  topic: z.string(),
  startsAt: IsoDateTime,
  status: z.string(),
  notes: z.string().nullable(),
});

export const SuccessCaseRecord = z.object({
  id: Uuid,
  studentId: Uuid,
  level: z.enum(["watch", "elevated"]),
  status: z.string(),
  summary: z.string(),
  taskTitles: z.array(z.string()),
});

export const ExecutiveMetricsSnapshot = z.object({
  institutionId: Uuid,
  asOf: IsoDateTime,
  enrollment: EnrollmentMetricsSnapshot,
  academic: z.object({
    publishedGradeCount: z.number().int().nonnegative(),
    draftGradeCount: z.number().int().nonnegative(),
    openSuccessCases: z.number().int().nonnegative(),
    advisingRequested: z.number().int().nonnegative(),
  }),
  source: z.literal("controlled_executive_metrics_v1"),
});

export const AiEvalCaseResult = z.object({
  id: z.string(),
  capability: AiCapabilityId,
  passed: z.boolean(),
  checks: z.array(z.string()),
});

export const AskCoachRequest = z.object({
  question: z.string().trim().min(1).max(2000),
  contextPath: z.string().startsWith("/").max(200).optional(),
  capability: AiCapabilityId.optional(),
  activeCourseId: Uuid.optional(),
  activeSectionId: Uuid.optional(),
  assessmentAttemptOpen: z.boolean().optional(),
  appointmentStartsAt: IsoDateTime.optional(),
});

export const CoachSource = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  uri: z.string().startsWith("/"),
});

export const CoachSuggestedAction = z.object({
  label: z.string().min(1),
  href: z.string().startsWith("/"),
});

export const CoachAnswer = z.object({
  interactionId: Uuid,
  role: RoleName,
  tier: z.enum(["read_only", "draft"]),
  capability: AiCapabilityId.default("campus_coach"),
  answer: z.string().min(1),
  sources: z.array(CoachSource).min(1),
  suggestedActions: z.array(CoachSuggestedAction),
  claims: z.array(AiClaim).default([]),
  analysis: DegreePlanAnalysis.optional(),
  riskAnalysis: StudentRiskAnalysis.optional(),
  metrics: EnrollmentMetricsSnapshot.optional(),
  executiveMetrics: ExecutiveMetricsSnapshot.optional(),
  gradingSuggestion: GradingSuggestion.optional(),
  studyPolicy: StudyCoachPolicy.optional(),
  feedback: z.enum(["up", "down"]).optional(),
  createdAt: IsoDateTime,
});

export const CoachHistoryResponse = z.object({
  items: z.array(
    CoachAnswer.extend({
      question: z.string().min(1),
    }),
  ),
});

export type AiActionClass = z.infer<typeof AiActionClass>;
export type AiCapabilityId = z.infer<typeof AiCapabilityId>;
export type AiClaim = z.infer<typeof AiClaim>;
export type AiToolName = z.infer<typeof AiToolName>;
export type AiToolDefinition = z.infer<typeof AiToolDefinition>;
export type AiRequestContext = z.infer<typeof AiRequestContext>;
export type StudyCoachPolicy = z.infer<typeof StudyCoachPolicy>;
export type DegreeRequirementItem = z.infer<typeof DegreeRequirementItem>;
export type DegreePlanAnalysis = z.infer<typeof DegreePlanAnalysis>;
export type WhatIfScenarioRequest = z.infer<typeof WhatIfScenarioRequest>;
export type WhatIfScenarioResponse = z.infer<typeof WhatIfScenarioResponse>;
export type DegreeProgressUnassigned = z.infer<typeof DegreeProgressUnassigned>;
export type DegreeProgressResponse = z.infer<typeof DegreeProgressResponse>;
export type KnowledgeHit = z.infer<typeof KnowledgeHit>;
export type StudentRiskAnalysis = z.infer<typeof StudentRiskAnalysis>;
export type EnrollmentMetricsSnapshot = z.infer<typeof EnrollmentMetricsSnapshot>;
export type MissingSubmissionRow = z.infer<typeof MissingSubmissionRow>;
export type AiGovernanceSnapshot = z.infer<typeof AiGovernanceSnapshot>;
export type GradingSuggestion = z.infer<typeof GradingSuggestion>;
export type AdvisingAppointmentRequest = z.infer<typeof AdvisingAppointmentRequest>;
export type AdvisingAppointmentRecord = z.infer<typeof AdvisingAppointmentRecord>;
export type SuccessCaseRecord = z.infer<typeof SuccessCaseRecord>;
export type ExecutiveMetricsSnapshot = z.infer<typeof ExecutiveMetricsSnapshot>;
export type AiEvalCaseResult = z.infer<typeof AiEvalCaseResult>;
export type CoachSource = z.infer<typeof CoachSource>;
export type CoachSuggestedAction = z.infer<typeof CoachSuggestedAction>;
export type AskCoachRequest = z.infer<typeof AskCoachRequest>;
export type CoachAnswer = z.infer<typeof CoachAnswer>;
export type CoachHistoryResponse = z.infer<typeof CoachHistoryResponse>;
