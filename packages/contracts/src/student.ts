import { z } from "zod";
import { IsoDateTime, JoinUrl, MoneyCad, Uuid } from "./base.js";

export const StudentModuleId = z.enum([
  "ST-01",
  "ST-02",
  "ST-03",
  "ST-04",
  "ST-05",
  "ST-06",
  "ST-07",
  "ST-08",
  "ST-09",
  "ST-10",
  "ST-11",
  "ST-12",
  "ST-13",
  "ST-14",
  "ST-15",
  "ST-16",
  "ST-17",
  "ST-18",
  "ST-19",
  "ST-20",
  "ST-21",
  "ST-22",
  "ST-23",
  "ST-24",
  "ST-25",
  "ST-26",
  "ST-27",
]);

export const StudentCourseSummary = z.object({
  sectionId: Uuid,
  courseCode: z.string().min(1),
  courseTitle: z.string().min(1),
  sectionCode: z.string().min(1),
  termName: z.string().min(1),
  instructorName: z.string().min(1),
  credits: z.number().nonnegative(),
  enrolmentStatus: z.enum(["enrolled", "completed"]),
  progressPercent: z.number().min(0).max(100).nullable(),
  deliveryMethod: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  scheduleText: z.string().nullable().optional(),
  startsOn: z.string().nullable().optional(),
  endsOn: z.string().nullable().optional(),
});

export const StudentCourseHistoryRow = z.object({
  enrolmentId: Uuid,
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().nonnegative(),
  termCode: z.string().min(1),
  termName: z.string().min(1),
  sectionCode: z.string().min(1),
  status: z.string().min(1),
  attemptNumber: z.number().int().positive(),
  isRetake: z.boolean(),
  countsTowardCgpa: z.boolean().optional(),
  continuous: z.boolean().optional(),
  averagePercent: z.number().nullable(),
  letter: z.string(),
  sectionId: Uuid,
  instructorName: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  scheduleText: z.string().nullable().optional(),
  startsOn: z.string().nullable().optional(),
  endsOn: z.string().nullable().optional(),
});

export const StudentCourseHistoryResponse = z.object({
  previous: z.array(StudentCourseHistoryRow),
  current: z.array(StudentCourseHistoryRow),
  withdrawn: z.array(StudentCourseHistoryRow),
  retakes: z.array(StudentCourseHistoryRow),
  all: z.array(StudentCourseHistoryRow).optional(),
});

export const StudentCoursesResponse = z.object({
  courses: z.array(StudentCourseSummary),
});

export const StudentSubmissionFile = z.object({
  id: Uuid,
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: IsoDateTime,
});

export const StudentSubmissionSummary = z.object({
  id: Uuid,
  status: z.enum(["draft", "submitted", "returned"]),
  submittedAt: IsoDateTime.nullable(),
  files: z.array(StudentSubmissionFile),
  textBody: z.string().nullable().optional(),
});

export const StudentAssignmentSummary = z.object({
  id: Uuid,
  sectionId: Uuid,
  courseCode: z.string().min(1),
  courseTitle: z.string().min(1),
  title: z.string().min(1),
  dueAt: IsoDateTime.nullable(),
  maxScore: z.number().nonnegative(),
  weightPercent: z.number().min(0).max(100),
  state: z.enum(["upcoming", "due", "overdue", "draft", "submitted", "graded"]),
  submission: StudentSubmissionSummary.nullable(),
  instructions: z.string().nullable().optional(),
  availableFrom: IsoDateTime.nullable().optional(),
  cutoffAt: IsoDateTime.nullable().optional(),
  maxFiles: z.number().int().positive().nullable().optional(),
  maxFileBytes: z.number().int().positive().nullable().optional(),
  acceptedTypes: z.array(z.string()).optional(),
  fileSubmissions: z.boolean().optional(),
  onlineText: z.boolean().optional(),
  /** Present only once the mark has been published to the student. */
  grade: z
    .object({
      score: z.number().nullable(),
      maxScore: z.number(),
      letter: z.string().nullable(),
      feedback: z.string().nullable(),
      publishedAt: IsoDateTime.nullable(),
    })
    .nullable()
    .optional(),
});

export const StudentAssignmentsResponse = z.object({
  assignments: z.array(StudentAssignmentSummary),
});

export const MAX_STUDENT_FILE_BYTES = 10 * 1024 * 1024;
export const StudentFileMimeType = z.enum([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
  "application/zip",
]);

export const UploadStudentSubmissionFileRequest = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: StudentFileMimeType,
  sizeBytes: z.number().int().positive().max(MAX_STUDENT_FILE_BYTES),
  contentBase64: z.string().min(1).max(14_000_000),
});

export const UploadStudentSubmissionFileResponse = z.object({
  submission: StudentSubmissionSummary,
});

export const SubmitStudentAssignmentResponse = z.object({
  submission: StudentSubmissionSummary,
  alreadySubmitted: z.boolean(),
});

export const StudentCalendarEvent = z.object({
  id: z.string().min(1),
  kind: z.enum(["class", "assignment_deadline", "assessment", "advising"]),
  sectionId: Uuid.nullable(),
  title: z.string().min(1),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  location: z.string().nullable(),
  joinUrl: JoinUrl.nullable(),
});

export const StudentCalendarResponse = z.object({
  events: z.array(StudentCalendarEvent),
});

export const StudentNotificationView = z.object({
  id: Uuid,
  title: z.string().min(1),
  body: z.string(),
  channel: z.enum(["in_app", "email", "push"]),
  createdAt: IsoDateTime,
  readAt: IsoDateTime.nullable(),
});

export const StudentNotificationsResponse = z.object({
  unreadCount: z.number().int().nonnegative(),
  notifications: z.array(StudentNotificationView),
});

export const MarkStudentNotificationReadResponse = z.object({
  notification: StudentNotificationView,
  changed: z.boolean(),
});

export const StudentProfileResponse = z.object({
  studentId: Uuid,
  studentNumber: z.string().min(1),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  middleName: z.string().nullable().optional(),
  preferredName: z.string().nullable().optional(),
  primaryEmail: z.string().email(),
  personalEmail: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  programName: z.string().min(1),
  standing: z.enum(["good", "warning", "probation", "alert"]),
  timezone: z.string().min(1),
});

export const UpdateStudentPreferencesRequest = z.object({
  timezone: z.string().min(1).max(120),
});

export const RequestStudentProfileChange = z
  .object({
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).optional(),
    preferredName: z.string().trim().max(100).optional(),
    primaryEmail: z.string().email(),
    personalEmail: z.string().email().optional(),
    phone: z.string().trim().min(7).max(30),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    emergencyContactName: z.string().trim().min(1).max(120),
    emergencyContactPhone: z.string().trim().min(7).max(30),
    reason: z.string().trim().min(10).max(1000),
  });

export const StudentProfileChangeResponse = z.object({
  approvalRequestId: Uuid,
  status: z.literal("pending"),
});

export const StudentFinanceSummary = z.object({
  balance: MoneyCad,
  pastDue: MoneyCad,
  nextDueAt: IsoDateTime.nullable(),
  paymentExecutionEnabled: z.boolean(),
});

export const StudentFinanceLedgerEntry = z.object({
  id: Uuid,
  label: z.string().min(1),
  amountCad: z.number(),
  kind: z.enum(["charge", "credit", "payment"]),
  status: z.enum(["open", "paid", "waived"]),
  source: z.string().nullable().optional(),
  dueAt: IsoDateTime.nullable(),
  postedAt: IsoDateTime,
  financialTermId: Uuid.nullable().optional(),
  financialTermCode: z.string().nullable().optional(),
  financialTermName: z.string().nullable().optional(),
});

export const FinancialTermSummary = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
});

export const StudentFinanceStatementBlock = z.object({
  termCode: z.string(),
  termName: z.string(),
  charges: z.array(z.object({ id: Uuid, label: z.string(), amountCad: z.number() })),
  totalChargesCad: z.number(),
  gstRatePercent: z.number(),
  gstCad: z.number(),
  pstRatePercent: z.number(),
  pstCad: z.number(),
  totalPaymentsCad: z.number(),
  balanceCad: z.number(),
});

export const StudentFinanceHistoryLine = z.object({
  id: Uuid,
  label: z.string(),
  amountCad: z.number(),
});

export const StudentFinanceHistoryEvent = z.object({
  id: Uuid,
  date: IsoDateTime,
  kind: z.enum(["payment", "accounts_receivable", "credit"]),
  title: z.string(),
  amountCad: z.number(),
  source: z.string().nullable().optional(),
  receiptAvailable: z.boolean().default(false),
  lines: z.array(StudentFinanceHistoryLine).default([]),
});

export const StudentFinanceHistoryMonth = z.object({
  key: z.string(),
  label: z.string(),
  events: z.array(StudentFinanceHistoryEvent),
});

export const AcademicBlockSummary = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
});

export const StudentFinanceResponse = z.object({
  summary: StudentFinanceSummary,
  entries: z.array(StudentFinanceLedgerEntry),
  financialTerms: z.array(FinancialTermSummary).default([]),
  selectedFinancialTermId: Uuid.nullable().optional(),
  statement: StudentFinanceStatementBlock.nullable().optional(),
  history: z.array(StudentFinanceHistoryMonth).default([]),
});

export const StudentPortalViewResponse = z.object({
  moduleId: StudentModuleId,
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  state: z.enum(["empty", "ready", "unavailable"]),
  cards: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      value: z.string(),
      detail: z.string().nullable(),
    }),
  ),
  rows: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      subtitle: z.string().nullable(),
      status: z.string().nullable(),
      href: z.string().startsWith("/").nullable(),
    }),
  ),
});

export const StudentAssessmentSummary = z.object({
  id: Uuid,
  sectionId: Uuid,
  courseCode: z.string().min(1),
  title: z.string().min(1),
  opensAt: IsoDateTime,
  closesAt: IsoDateTime,
  durationMinutes: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  attemptCount: z.number().int().nonnegative(),
  openAttemptId: Uuid.nullable(),
  state: z.enum(["upcoming", "open", "in_progress", "submitted", "closed"]),
});

export const StudentAssessmentsResponse = z.object({
  assessments: z.array(StudentAssessmentSummary),
  assessmentAttemptOpen: z.boolean(),
});

export const StartAssessmentAttemptResponse = z.object({
  attemptId: Uuid,
  expiresAt: IsoDateTime,
  assessmentAttemptOpen: z.literal(true),
  questions: z.array(z.object({ id: z.string().min(1), prompt: z.string().min(1), options: z.array(z.string().min(1)).min(2) })),
});

export const SubmitAssessmentAttemptResponse = z.object({
  attemptId: Uuid,
  status: z.literal("submitted"),
  submittedAt: IsoDateTime,
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
});

export const StudentAttendanceRecord = z.object({
  id: Uuid,
  sectionId: Uuid,
  courseCode: z.string().min(1),
  meetingLabel: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
  recordedAt: IsoDateTime,
  note: z.string().default(""),
});

export const StudentAttendanceResponse = z.object({
  presentCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  lateCount: z.number().int().nonnegative(),
  records: z.array(StudentAttendanceRecord),
});

export const StudentLectureSummary = z.object({
  id: Uuid,
  sectionId: Uuid,
  courseCode: z.string().min(1),
  title: z.string().min(1),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  location: z.string().nullable(),
  joinUrl: JoinUrl.nullable(),
  sessionKind: z.enum(["lecture", "lab"]),
  deliveryMode: z.string().min(1),
});

export const StudentLecturesResponse = z.object({
  lectures: z.array(StudentLectureSummary),
});

export const StudentLabNotebook = z.object({
  id: Uuid,
  classSessionId: Uuid,
  title: z.string().min(1),
  body: z.string(),
  version: z.number().int().positive(),
  rowVersion: z.number().int().positive(),
  lockedAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
});

export const UpsertLabNotebookRequest = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000),
  rowVersion: z.number().int().positive().optional(),
});

export const StudentServiceRequestType = z.enum([
  "official_transcript",
  "enrollment_verification",
  "advising_referral",
  "general_inquiry",
  "course_withdrawal",
  "course_change",
  "transcript_request",
  "academic_appeal",
  "leave_of_absence",
]);

export const StudentServiceRequest = z.object({
  id: Uuid,
  type: StudentServiceRequestType,
  subject: z.string().min(1),
  details: z.string().min(1),
  status: z.enum(["open", "pending_approval", "resolved", "rejected", "cancelled"]),
  approvalRequestId: Uuid.nullable(),
  createdAt: IsoDateTime,
});

export const StudentWithdrawalOption = z.object({
  sectionId: Uuid,
  label: z.string().min(1),
});

export const CreateStudentServiceRequest = z.object({
  type: StudentServiceRequestType,
  subject: z.string().trim().min(3).max(200),
  details: z.string().trim().min(10).max(4000),
  sectionId: Uuid.optional(),
});

export const StudentServiceRequestsResponse = z.object({
  requests: z.array(StudentServiceRequest),
  withdrawalOptions: z.array(StudentWithdrawalOption).default([]),
});

export const StudentPracticumHours = z.object({
  id: Uuid,
  weekLabel: z.string().min(1),
  hours: z.number().nonnegative(),
  status: z.enum(["pending", "approved", "rejected"]),
});

export const StudentPracticumPlacement = z.object({
  id: Uuid,
  programName: z.string().min(1),
  employerName: z.string().min(1),
  siteName: z.string().min(1),
  siteAddress: z.string().nullable(),
  supervisorName: z.string().nullable(),
  supervisorEmail: z.string().email().nullable(),
  status: z.string().min(1),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  hours: z.array(StudentPracticumHours),
  evaluations: z.array(z.object({
    id: Uuid,
    status: z.enum(["due", "submitted", "reviewed"]),
    score: z.number().int().min(1).max(5).nullable(),
    notes: z.string().nullable(),
  })),
  incidents: z.array(z.object({
    id: Uuid,
    occurredOn: z.string(),
    category: z.string(),
    severity: z.string(),
    status: z.string(),
    actionTaken: z.string().nullable(),
  })),
});

export const StudentPracticumResponse = z.object({
  placements: z.array(StudentPracticumPlacement),
});

export const LogPracticumHoursRequest = z.object({
  placementId: Uuid,
  weekLabel: z.string().trim().min(1).max(80),
  hours: z.number().positive().max(80),
});

export const StudentCredentialRecord = z.object({
  id: Uuid,
  title: z.string().min(1),
  status: z.enum(["earned", "pending", "revoked"]),
  detail: z.string().nullable(),
  earnedAt: IsoDateTime.nullable(),
});

export const StudentCredentialsResponse = z.object({
  credentials: z.array(StudentCredentialRecord),
  issuanceEnabled: z.literal(false),
});

export const StudentResourceItem = z.object({
  id: Uuid,
  title: z.string().min(1),
  snippet: z.string(),
  sourceKind: z.string().min(1),
  href: z.string().nullable(),
});

export const StudentResourcesResponse = z.object({
  resources: z.array(StudentResourceItem),
});

export const StudentWorkshopItem = z.object({
  id: z.string().min(1),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  creditsCeu: z.number(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime.nullable(),
  location: z.string().nullable(),
  capacity: z.number().int(),
  registeredCount: z.number().int(),
  status: z.enum(["upcoming", "active", "completed", "cancelled"]),
  registrationStatus: z.enum(["none", "registered", "completed", "cancelled"]).nullable(),
  joinUrl: z.string().url().nullable(),
});

export const StudentWorkshopsResponse = z.object({
  available: z.array(StudentWorkshopItem),
  mine: z.array(StudentWorkshopItem),
  completed: z.array(StudentWorkshopItem),
});

export const RegisterWorkshopRequest = z.object({
  workshopId: z.string().min(1),
});

export const CreateLeaveOfAbsenceRequest = z.object({
  reason: z.string().trim().min(10).max(2000),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const LeaveOfAbsenceItem = z.object({
  id: z.string().min(1),
  reason: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  approvalRequestId: Uuid.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: IsoDateTime,
});

export const LeaveOfAbsenceListResponse = z.object({
  requests: z.array(LeaveOfAbsenceItem),
});

export const RequiredTaskItem = z.object({
  id: z.string().min(1),
  title: z.string(),
  detail: z.string().nullable(),
  dueAt: IsoDateTime.nullable(),
  requestedAt: IsoDateTime,
  status: z.enum(["pending", "completed", "waived"]),
  href: z.string().nullable(),
  completedAt: IsoDateTime.nullable(),
  requirement: z.enum(["upload", "confirm", "evaluation"]),
  approval: z.enum(["pending", "approved"]).nullable(),
  evidence: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1),
  }).nullable(),
});

export const RequiredTasksResponse = z.object({
  pending: z.array(RequiredTaskItem),
  completed: z.array(RequiredTaskItem),
});

export const TaxDocumentItem = z.object({
  id: z.string().min(1),
  docType: z.string(),
  taxYear: z.number().int(),
  title: z.string(),
  status: z.enum(["available", "pending", "expired"]),
  issuedAt: IsoDateTime.nullable(),
  downloadUrl: z.string().nullable(),
});

export const TaxDocumentsResponse = z.object({
  documents: z.array(TaxDocumentItem),
  formOptions: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional()
    .default([]),
  emptyNotice: z.string().nullable().optional(),
});

export const ExtracurricularItem = z.object({
  id: z.string().min(1),
  termCode: z.string().nullable(),
  category: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
});

export const ExtracurricularResponse = z.object({
  records: z.array(ExtracurricularItem),
  categories: z.array(z.string()),
  terms: z.array(z.string()),
});

export const StudentBadgeItem = z.object({
  id: z.string().min(1),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["available", "earned", "revoked"]),
  earnedAt: IsoDateTime.nullable(),
});

export const StudentBadgesResponse = z.object({
  badges: z.array(StudentBadgeItem),
});

export const CareerOpportunityItem = z.object({
  id: z.string().min(1),
  title: z.string(),
  employerName: z.string(),
  skills: z.array(z.string()),
  programCodes: z.array(z.string()),
  status: z.enum(["open", "closed", "draft"]),
  href: z.string().nullable(),
  updatedAt: IsoDateTime,
});

export const CareerServicesLink = z.object({
  title: z.string(),
  body: z.string(),
  href: z.string(),
  cta: z.string(),
});

export const StudentCareerResponse = z.object({
  opportunities: z.array(CareerOpportunityItem),
  services: z.array(CareerServicesLink),
});

export const CourseLessonView = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  resourceHref: z.string().nullable(),
  sortOrder: z.number().int(),
  completed: z.boolean(),
  kind: z.string().optional(),
});

export const CourseDayBlockView = z.object({
  id: z.string().min(1),
  label: z.string(),
  title: z.string(),
  sortOrder: z.number().int(),
  lessons: z.array(CourseLessonView),
});

export const CourseFolderItemView = z.object({
  id: z.string().min(1),
  title: z.string(),
  kind: z.string(),
  href: z.string().nullable(),
  sizeLabel: z.string().nullable(),
});

export const CourseFolderView = z.object({
  id: z.string().min(1),
  name: z.string(),
  sortOrder: z.number().int(),
  items: z.array(CourseFolderItemView),
});

export const SyllabusTopicView = z.object({
  id: z.string().min(1),
  title: z.string(),
  level: z.number().int(),
  sortOrder: z.number().int(),
});

export const StudentQuizQuestionView = z.object({
  id: z.string().min(1),
  text: z.string(),
  answers: z.array(z.string()).default([]),
  mark: z.string().optional(),
});

export const StudentLmsActivityView = z.object({
  id: z.string().min(1),
  type: z.string(),
  name: z.string(),
  body: z.string().optional(),
  fileName: z.string().optional(),
  fileId: z.string().optional(),
  fileSize: z.number().optional(),
  modified: z.string().optional(),
  note: z.string().optional(),
  hidden: z.boolean().optional(),
  joinUrl: z.string().nullable().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  settings: z.record(z.string(), z.string()).optional(),
  assignmentId: z.string().optional(),
  assignment: z
    .object({
      instructions: z.string().optional(),
      availableFrom: z.string().optional(),
      dueAt: z.string().optional(),
      cutoffAt: z.string().optional(),
      maxScore: z.number().optional(),
      fileSubmissions: z.boolean().optional(),
      onlineText: z.boolean().optional(),
      maxFiles: z.number().optional(),
      maxFileBytes: z.number().optional(),
      acceptedTypes: z.string().optional(),
    })
    .optional(),
  choice: z
    .object({
      options: z.array(z.string()).min(1),
      multiple: z.boolean(),
      displayMode: z.enum(["horizontal", "vertical"]),
      response: z
        .object({ selected: z.array(z.string()), submittedAt: z.string() })
        .nullable()
        .optional(),
    })
    .optional(),
  gradingMethod: z.string().optional(),
  questions: z.array(StudentQuizQuestionView).optional(),
  /** Set only on auto-graded quizzes; `quizAttempt` is the student's graded first attempt. */
  quizMinutes: z.number().nullable().optional(),
  quizAttempt: z
    .object({ score: z.number(), maxScore: z.number(), submittedAt: z.string() })
    .nullable()
    .optional(),
  storyboard: z
    .object({
      title: z.string(),
      estimated_duration_sec: z.number(),
      slides: z.array(
        z.object({ number: z.number(), heading: z.string(), bullets: z.array(z.string()), narration: z.string() }),
      ),
    })
    .optional(),
});

export const StudentQuizAttemptResponse = z.object({
  score: z.number(),
  maxScore: z.number(),
  submittedAt: z.string(),
  results: z.array(z.object({ id: z.string(), correct: z.boolean() })),
});

export const StudentLmsTopicView = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string().optional(),
  activities: z.array(StudentLmsActivityView),
});

export const StudentGradeSchemeItem = z.object({
  title: z.string(),
  weightPercent: z.number(),
});

export const StudentCourseLmsResponse = z.object({
  sectionId: Uuid,
  courseCode: z.string(),
  courseTitle: z.string(),
  academicBlock: AcademicBlockSummary.nullable(),
  dayBlocks: z.array(CourseDayBlockView),
  folders: z.array(CourseFolderView),
  syllabus: z.array(SyllabusTopicView),
  topics: z.array(StudentLmsTopicView).default([]),
  evaluationRows: z
    .array(z.object({ component: z.string(), weight: z.string() }))
    .default([]),
  gradeScheme: z.array(StudentGradeSchemeItem).default([]),
  sessionLabel: z.string().optional(),
  location: z.string().optional(),
  instructorName: z.string().optional(),
  joinUrl: z.string().nullable().optional(),
});

export const CourseEvaluationView = z.object({
  id: Uuid,
  courseCode: z.string(),
  courseTitle: z.string(),
  sectionId: Uuid.nullable(),
  status: z.enum(["pending", "submitted"]),
  dueAt: IsoDateTime.nullable(),
  submittedAt: IsoDateTime.nullable(),
  overallRating: z.number().int().min(1).max(5).nullable(),
  responses: z
    .object({
      teachingQuality: z.number().int().min(1).max(5).optional(),
      courseMaterials: z.number().int().min(1).max(5).optional(),
      workload: z.number().int().min(1).max(5).optional(),
      comments: z.string().max(2000).optional(),
    })
    .nullable(),
});

export const SubmitCourseEvaluationRequest = z.object({
  overallRating: z.number().int().min(1).max(5),
  teachingQuality: z.number().int().min(1).max(5),
  courseMaterials: z.number().int().min(1).max(5),
  workload: z.number().int().min(1).max(5),
  comments: z.string().trim().max(2000).optional(),
});

export const SubmitCourseEvaluationResponse = z.object({
  evaluation: CourseEvaluationView,
});

export const MailFolderView = z.object({
  id: Uuid,
  name: z.string(),
  kind: z.enum(["inbox", "outbox", "drafts", "junk", "deleted", "custom"]),
  sortOrder: z.number().int(),
  unreadCount: z.number().int().nonnegative(),
});

export const MailThreadView = z.object({
  id: Uuid,
  subject: z.string(),
  preview: z.string(),
  folderId: Uuid,
  folderKind: z.string(),
  participants: z.array(z.string()),
  participantNames: z.array(z.string()).optional(),
  otherName: z.string().optional(),
  flagged: z.boolean().optional(),
  updatedAt: IsoDateTime,
  readAt: IsoDateTime.nullable(),
  chat: z
    .array(
      z.object({
        id: Uuid,
        kind: z.literal("message"),
        from: z.enum(["me", "them"]),
        text: z.string(),
        time: z.string(),
      }),
    )
    .optional(),
});

export const MailboxListResponse = z.object({
  folders: z.array(MailFolderView),
  threads: z.array(MailThreadView),
  selectedFolderId: Uuid.nullable(),
});

export const CreateMailFolderRequest = z.object({
  name: z.string().trim().min(1).max(80),
});

export const ComposeMailRequest = z.object({
  toAccountIds: z.array(Uuid).max(40).default([]),
  ccAccountIds: z.array(Uuid).max(40).optional(),
  bccAccountIds: z.array(Uuid).max(40).optional(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  asDraft: z.boolean().optional(),
  threadId: Uuid.optional(),
  messageType: z
    .enum(["standard", "individuals", "class", "workshop", "mail_merge", "groups"])
    .optional(),
  attachments: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    mime: z.string().trim().min(1).max(150),
    base64: z.string().min(1).max(12_000_000),
  })).max(5).optional(),
});

export const ComposeMailResponse = z.object({
  threadId: Uuid,
  folderKind: z.enum(["outbox", "drafts"]),
});

export const ReplyMailRequest = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const MailboxSettingsView = z.object({
  emailAddress: z.string().email().optional(),
  forwardingEnabled: z.boolean(),
  forwardingAddress: z.string().email().nullable(),
  smsForwardingEnabled: z.boolean(),
  signature: z.string().nullable(),
  popupNotifications: z.boolean(),
  notificationSound: z.boolean(),
  autoResponderEnabled: z.boolean().optional(),
  autoResponderBody: z.string().nullable().optional(),
});

export const UpdateMailboxSettingsRequest = z.object({
  forwardingEnabled: z.boolean().optional(),
  forwardingAddress: z.string().email().nullable().optional(),
  smsForwardingEnabled: z.boolean().optional(),
  signature: z.string().max(2000).nullable().optional(),
  popupNotifications: z.boolean().optional(),
  notificationSound: z.boolean().optional(),
  autoResponderEnabled: z.boolean().optional(),
  autoResponderBody: z.string().max(5000).nullable().optional(),
});

export const MailBulkActionRequest = z.object({
  threadIds: z.array(Uuid).min(1).max(100),
  action: z.enum([
    "mark_read",
    "mark_unread",
    "mark_not_junk",
    "move_junk",
    "delete",
    "restore",
    "delete_drafts",
    "purge",
    "flag",
    "unflag",
  ]),
});

export const MailSearchRequest = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  content: z.string().optional(),
});

export const StudentCalendarsResponse = z.object({
  academicBlocks: z.array(AcademicBlockSummary),
  financialTerms: z.array(FinancialTermSummary),
});

export const StudentFinanceStatementResponse = z.object({
  generatedAt: IsoDateTime,
  studentNumber: z.string(),
  programName: z.string(),
  summary: StudentFinanceSummary,
  entries: z.array(StudentFinanceLedgerEntry),
  statementText: z.string(),
});

export const CreateGradeItemRequest = z.object({
  assignmentId: Uuid,
  studentId: Uuid,
  score: z.number().min(0),
  feedback: z.string().trim().max(4000).nullable().optional(),
});

export type StudentModuleId = z.infer<typeof StudentModuleId>;
export type StudentCourseSummary = z.infer<typeof StudentCourseSummary>;
export type StudentCoursesResponse = z.infer<typeof StudentCoursesResponse>;
export type StudentCourseHistoryRow = z.infer<typeof StudentCourseHistoryRow>;
export type StudentCourseHistoryResponse = z.infer<typeof StudentCourseHistoryResponse>;
export type StudentSubmissionSummary = z.infer<typeof StudentSubmissionSummary>;
export type StudentAssignmentSummary = z.infer<typeof StudentAssignmentSummary>;
export type StudentAssignmentsResponse = z.infer<typeof StudentAssignmentsResponse>;
export type UploadStudentSubmissionFileRequest = z.infer<
  typeof UploadStudentSubmissionFileRequest
>;
export type StudentCalendarResponse = z.infer<typeof StudentCalendarResponse>;
export type StudentNotificationsResponse = z.infer<typeof StudentNotificationsResponse>;
export type StudentProfileResponse = z.infer<typeof StudentProfileResponse>;
export type StudentFinanceResponse = z.infer<typeof StudentFinanceResponse>;
export type StudentAssessmentsResponse = z.infer<typeof StudentAssessmentsResponse>;
export type StudentAttendanceResponse = z.infer<typeof StudentAttendanceResponse>;
export type StudentLecturesResponse = z.infer<typeof StudentLecturesResponse>;
export type StudentLectureSummary = z.infer<typeof StudentLectureSummary>;
export type StudentLabNotebook = z.infer<typeof StudentLabNotebook>;
export type StudentCredentialsResponse = z.infer<typeof StudentCredentialsResponse>;
export type StudentResourcesResponse = z.infer<typeof StudentResourcesResponse>;
export type StudentPracticumResponse = z.infer<typeof StudentPracticumResponse>;
export type StudentServiceRequestsResponse = z.infer<typeof StudentServiceRequestsResponse>;
export type CreateGradeItemRequest = z.infer<typeof CreateGradeItemRequest>;
export type StudentCourseLmsResponse = z.infer<typeof StudentCourseLmsResponse>;
export type CourseEvaluationView = z.infer<typeof CourseEvaluationView>;
export type MailboxListResponse = z.infer<typeof MailboxListResponse>;
export type MailboxSettingsView = z.infer<typeof MailboxSettingsView>;
export type StudentCalendarsResponse = z.infer<typeof StudentCalendarsResponse>;
