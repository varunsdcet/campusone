/**
 * Domain model for the Heritage Community College mobile app.
 * Every record uses a stable string id. Relationships are expressed by id.
 * All data is SYNTHETIC demo data.
 */

export type Role = 'student' | 'instructor' | 'applicant';

export type Capability =
  | 'courses.manage'
  | 'grades.submit'
  | 'attendance.record'
  | 'workshops.approve'
  | 'registry.faculties'
  | 'registry.programTypes'
  | 'registry.terms'
  | 'repository.manage'
  | 'schedules.review'
  | 'students.directory';

export interface UserAccount {
  id: string;
  role: Role;
  /** Student number (students) or institutional email (instructors). */
  loginId: string;
  /** DEMO ONLY – plain text demo password; a real app never stores passwords. */
  demoPassword: string;
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  avatarInitials: string;
  capabilities: Capability[];
  /** Student-specific profile */
  student?: StudentProfile;
  instructor?: InstructorProfile;
}

export interface StudentProfile {
  studentNumber: string;
  programId: string;
  programName: string;
  catalogYear: string;
  advisorName: string;
  phone: string;
  middleName?: string;
  /** Masked synthetic sensitive identifier – never a real SIN. */
  sensitiveIdMasked: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface InstructorProfile {
  staffId: string;
  department: string;
  rank: string;
  phone?: string;
  pronouns?: string;
  office?: string;
  highestDegree?: string;
  yearsTeaching?: number;
  hireDate?: string;
  biography?: string;
  topics: string[];
  availability: AvailabilitySlot[];
  compensation: { basis: string; rateLabel: string; note: string };
}

export interface AvailabilitySlot {
  id: string;
  day: string;
  from: string;
  to: string;
  mode: 'In person' | 'Online';
}

export interface Session {
  userId: string;
  role: Role;
  rememberMe: boolean;
  createdAt: string;
}

/* ---------------- Catalogue / self-paced programmes ---------------- */

export type ProgrammeLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Programme {
  id: string;
  title: string;
  subject: string; // e.g. Business, Red Seal Trades
  category: string; // chip label
  level: ProgrammeLevel;
  description: string;
  hours: number;
  chapterCount: number;
  activityCount: number;
  priceCad: number;
  residency: 'domestic' | 'international';
  featured: boolean;
  heroImage: 'office' | 'trades' | 'pharmacy';
  highlights: string[];
  chapters: Chapter[];
  subPrograms?: { title: string; hours: number; chapters: number; priceCad: number }[];
}

export type ActivityType = 'reading' | 'lecture' | 'practiceQuiz' | 'matching' | 'assessment';

export interface Chapter {
  id: string;
  programmeId: string;
  index: number; // 1-based
  title: string;
  description: string;
  hours: number;
  activities: Activity[];
}

export interface Activity {
  id: string;
  chapterId: string;
  index: number;
  type: ActivityType;
  title: string;
  minutes: number;
  /** Rich content for readings; slides for lectures; questions for quizzes etc. */
  reading?: ReadingContent;
  lecture?: LectureContent;
  quiz?: QuizContent;
  matching?: MatchingContent;
}

export interface ReadingContent {
  intro: string;
  objectives: string[];
  whyItMatters: string;
  coreConcepts: string;
  steps: { title: string; body: string }[];
  workedExample: string;
}

export interface LectureContent {
  presenter: string;
  slides: { title: string; bullets: string[]; transcript: string }[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizContent {
  questions: QuizQuestion[];
}

export interface MatchingContent {
  pairs: { id: string; term: string; definition: string }[];
}

export interface Enrolment {
  id: string;
  userId: string;
  programmeId: string;
  enrolledAt: string; // ISO instant
  paymentId: string;
  status: 'active' | 'completed';
}

export interface LearningProgress {
  id: string; // `${userId}:${programmeId}`
  userId: string;
  programmeId: string;
  completedActivityIds: string[];
  /** Seconds spent per activity (for time gates). */
  secondsSpent: Record<string, number>;
  readToBottom: Record<string, boolean>;
  quizAnswers: Record<string, Record<string, number>>; // activityId -> questionId -> optionIndex
  quizBestScore: Record<string, number>; // activityId -> percentage
  matchingAssignments: Record<string, Record<string, string>>; // activityId -> pairId -> definition pairId
  matchingResult: Record<string, { score: number; passed: boolean; submittedAt: string } | undefined>;
  assessmentResults: Record<string, { score: number; passed: boolean; submittedAt: string; attempts: number } | undefined>;
  lastActivityId?: string;
  completedAt?: string;
  certificateId?: string;
}

export interface Payment {
  id: string;
  userId: string;
  programmeId: string;
  amountCad: number;
  status: 'succeeded' | 'cancelled' | 'failed';
  createdAt: string;
  reference: string;
}

export interface Bookmark {
  id: string; // `${userId}:${programmeId}`
  userId: string;
  programmeId: string;
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  createdAt: string;
  status?: 'sent' | 'error';
  contextActivityId?: string;
}

export interface CoachConversation {
  id: string; // `${userId}:${activityId}` keyed by chapter
  userId: string;
  programmeId: string;
  chapterId: string;
  messages: CoachMessage[];
}

/* ---------------- Academic courses & sections ---------------- */

export interface Term {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  campus: string;
  status: 'current' | 'upcoming' | 'past' | 'archived';
  notes?: string;
}

export interface Course {
  id: string;
  code: string; // ACSW 500
  title: string;
  department: string;
  credits: number;
  description: string;
}

export interface Section {
  id: string;
  courseId: string;
  sectionCode: string; // ACSW-MAR26-01
  termId: string;
  instructorId: string;
  delivery: string;
  location: string;
  startDate: string;
  endDate: string;
  scheduleLabel: string; // Mon–Thu, 5:00pm – 10:00pm
  meetingDays: number[]; // 0=Sun
  startTime: string; // 17:00
  endTime: string; // 22:00
  status: 'In Progress' | 'Upcoming' | 'Completed';
  assessmentLabel: string; // Standard Assessment
  evaluation: { label: string; weight: number; color: string }[];
  objectives: string;
  description: string;
  syllabusFile: string;
  days: SectionDay[];
  liveRoomReady: boolean;
  /** Absolute live-class URL from the API (live mode). */
  joinUrl?: string;
}

export interface SectionDay {
  id: string;
  index: number;
  label: string;
  date?: string;
  note?: string;
  materials: Material[];
}

export interface Material {
  id: string;
  kind: 'folder' | 'file' | 'quiz' | 'page';
  title: string;
  fileName?: string;
  sampleAsset?: SampleAssetKey;
  /** Absolute URL of the real resource (live mode). */
  url?: string;
  status?: string;
  storyboard?: AiDraftStoryboard;
}

export interface AiDraftSlide {
  number: number;
  heading: string;
  bullets: string[];
  narration: string;
}

export interface AiDraftStoryboard {
  title: string;
  estimated_duration_sec: number;
  slides: AiDraftSlide[];
}

export type SampleAssetKey = 'syllabus' | 'lecture' | 'manual' | 'outline' | 'tax' | 'statement' | 'ccr' | 'audit' | 'letter' | 'idcard' | 'certificate' | 'transcript' | 'lessonPdf';

export interface SectionEnrolment {
  id: string;
  sectionId: string;
  studentId: string;
  status: 'enrolled' | 'dropped' | 'completed';
}

export interface ClassSession {
  id: string;
  sectionId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  topic: string;
}

/* ---------------- Assignments & submissions ---------------- */

export interface Assignment {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  points: number;
  weightPct: number;
  dueAt?: string; // ISO instant
  gradeItemId: string;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'late' | 'graded' | 'returned';

export interface SubmissionAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uri: string; // local copy uri
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  attachments: SubmissionAttachment[];
  note?: string;
  submittedAt?: string;
  receiptId?: string;
  updatedAt: string;
}

/* ---------------- Grades ---------------- */

export interface GradeItem {
  id: string;
  sectionId: string;
  name: string;
  weightPct: number;
  maxPoints: number;
}

export type MarkStatus = 'draft' | 'submitted' | 'released';

export interface Mark {
  id: string; // `${gradeItemId}:${studentId}`
  gradeItemId: string;
  sectionId: string;
  studentId: string;
  score?: number;
  status: MarkStatus;
  feedback?: string;
  updatedAt: string;
}

export interface FinalMark {
  id: string;
  studentId: string;
  courseCode: string;
  courseTitle: string;
  programId: string;
  termId: string;
  startDate: string;
  endDate: string;
  credits: number;
  grade: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F' | 'IP' | 'W' | 'I';
  gradePoints?: number;
  scorePct?: number;
  status: 'In Progress' | 'Completed' | 'Withdrawn' | 'Distinction' | 'Incomplete Extension';
  honors?: boolean;
}

/* ---------------- Attendance ---------------- */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string; // `${sessionId}:${studentId}`
  sessionId: string;
  sectionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
  state: 'draft' | 'submitted';
  recordedAt: string;
}

export interface AttendanceCorrectionRequest {
  id: string;
  studentId: string;
  recordId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/* ---------------- Workshops ---------------- */

export interface Workshop {
  id: string;
  code: string; // WS-WELL
  title: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  /** Last session date when the workshop spans several days (live mode). */
  endDate?: string;
  startTime: string;
  durationHours: number;
  ceu: number;
  mode: 'Online' | 'In person';
  location: string;
  capacity: number;
  instructor: string;
  requiresApproval: boolean;
  agenda: string[];
  materials: { id: string; title: string; type: string; sampleAsset: SampleAssetKey }[];
  joinUrlLabel: string;
  joinUrl?: string;
}

export type WorkshopEnrolmentStatus = 'pending' | 'approved' | 'declined' | 'dropped' | 'completed';

export interface WorkshopEnrolment {
  id: string;
  workshopId: string;
  studentId: string;
  status: WorkshopEnrolmentStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

/* ---------------- Records ---------------- */

export interface Badge {
  id: string;
  code: string;
  title: string;
  description: string;
  requirement: { type: 'workshops' | 'block' | 'manual'; target: number };
}

export interface BadgeAward {
  id: string;
  badgeId: string;
  studentId: string;
  earnedAt?: string;
  issuedBy?: string;
}

export interface ExtracurricularRecord {
  id: string;
  studentId: string;
  category: 'Student leadership' | 'Volunteer' | 'Athletics';
  title: string;
  description: string;
  term: string;
  status: 'Recorded';
  details: string;
}

export interface PlanCourse {
  id: string;
  studentId: string;
  order: number;
  code: string;
  title: string;
  status: 'completed' | 'inProgress' | 'dropped' | 'notStarted';
  startDate: string;
  endDate: string;
  scheduleLabel: string;
  campusRoom: string;
  sectionId?: string;
  retakeSectionCode?: string;
}

/* ---------------- Tasks / documents / finance / requests ---------------- */

export interface RequiredTask {
  id: string;
  studentId: string;
  category: string;
  title: string;
  description: string;
  requestedAt: string;
  dueNote?: string;
  requirement: 'upload' | 'confirm' | 'evaluation';
  status: 'pending' | 'completed';
  completedAt?: string;
  evidence?: SubmissionAttachment;
  approval?: 'pending' | 'approved';
}

export interface StudentDocument {
  id: string;
  studentId: string;
  title: string;
  type: string;
  issuedAt: string;
  status: 'available' | 'archived';
  sampleAsset?: SampleAssetKey;
  /** Real file URL from the API (live mode). */
  url?: string;
  sizeLabel: string;
}

export interface TaxDocument {
  id: string;
  studentId: string;
  year: number;
  form: 'T2202';
  issuedAt: string;
  status: 'available' | 'archived';
  reportingTerm: string;
  eligibleTuition?: number;
  fullTimeMonths?: number;
  sizeLabel: string;
  sampleAsset?: SampleAssetKey;
  /** API path of the real PDF (live mode). */
  pdfPath?: string;
}

export interface FinanceStatement {
  id: string;
  studentId: string;
  termId: string;
  termLabel: string;
  charges: { label: string; amount: number }[];
  taxes: { label: string; amount: number }[];
}

export interface FinanceTransaction {
  id: string;
  studentId: string;
  termId: string;
  date: string;
  description: string;
  amount: number; // positive = payment
  kind: 'payment' | 'charge' | 'demo-payment';
  reference: string;
}

export type RequestKind = 'personalDetails' | 'leave' | 'transcript' | 'specialLetter' | 'englishTest' | 'attendanceCorrection';

export interface ChangeRequest {
  id: string;
  studentId: string;
  kind: RequestKind;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  reviewer: string;
  payload: Record<string, unknown>;
  summary: string;
}

/* ---------------- Communication ---------------- */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  read: boolean;
  icon: 'video' | 'warning' | 'grade' | 'workshop' | 'schedule' | 'info';
  link?: { route: string; params?: Record<string, string> };
}

export type MailFolder = 'inbox' | 'outbox' | 'drafts' | 'junk' | 'deleted';

export interface MailAttachment {
  id: string;
  name: string;
  size: number;
  uri?: string;
  mimeType?: string;
}

export interface MailMessage {
  id: string;
  ownerId: string;
  folder: MailFolder;
  fromId: string;
  fromName: string;
  toIds: string[];
  toNames: string[];
  subject: string;
  body: string;
  attachments: MailAttachment[];
  createdAt: string;
  read: boolean;
  flagged: boolean;
  outboxStatus?: 'queued' | 'sent' | 'failed';
  sendAt?: string;
  previousFolder?: MailFolder;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'staff';
}

/* ---------------- Instructor-side ---------------- */

export interface LessonPlan {
  id: string;
  courseId: string;
  title: string;
  contentType: 'Text article' | 'Video' | 'Slides' | 'PDF';
  order: number;
  minutes?: number;
  content: string; // markdown-ish
  attachment?: { name: string; pages: number; sizeLabel: string; sampleAsset: SampleAssetKey };
  readMinutes: number;
  draftUpdatedAt: string;
  published?: { content: string; title: string; publishedAt: string };
}

export interface CompetencyDef {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  levels: string[];
}

export interface CompetencyAssessment {
  id: string;
  competencyId: string;
  studentId: string;
  level: string;
  updatedAt: string;
}

export interface SectionBadge {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  criteria: string;
  awardedStudentIds: string[];
}

export interface LogEntry {
  id: string;
  sectionId: string;
  at: string;
  actorId: string;
  actorName: string;
  activity: string;
  action: 'viewed' | 'created' | 'updated' | 'deleted' | 'submitted';
  source: 'app' | 'web';
  event: string;
  description: string;
}

export interface ContentRepository {
  id: string;
  code: string;
  name: string;
  courseId?: string;
  status: 'active' | 'inactive';
  lms: string;
  types: string;
  pushCount: number;
  pullCount: number;
  history: { id: string; at: string; action: string; version: number; by: string }[];
  version: number;
  deployed: 'synced' | 'local-ahead' | 'remote-ahead';
  format: string;
  sections: number;
  isDefault: boolean;
}

export interface ScheduleChangeRequest {
  id: string;
  sectionId: string;
  changeType: 'Schedule Change' | 'Room Change' | 'Instructor Change';
  requestedAt: string;
  requestedBy: string;
  proposed: { startDate: string; endDate: string; scheduleLabel: string; location?: string };
  conflict?: string;
  status: 'pending' | 'accepted' | 'rejected';
  decisionNote?: string;
  decidedAt?: string;
}

export interface CourseEvaluation {
  id: string;
  sectionId: string;
  evaluationName: string;
  responses: { id: string; rating: number; comment: string; submittedAt: string }[];
  invited: number;
}

export interface HistoricalOffering {
  id: string;
  termLabel: string;
  code: string;
  sectionCode: string;
  title: string;
  room: string;
  schedule: string;
  instructorName: string;
  startDate: string;
  endDate: string;
  resources: { title: string; sampleAsset: SampleAssetKey }[];
  enrolled: number;
}

export interface Faculty {
  id: string;
  name: string;
  abbreviation: string;
  status: 'active' | 'inactive';
}

export interface ProgramType {
  id: string;
  name: string;
  abbreviation: string;
  status: 'active' | 'inactive';
  order: number;
}

export interface AcademicProgram {
  id: string;
  facultyId: string;
  name: string;
  legalName?: string;
  abbreviation: string;
  programTypeId?: string;
  status: 'active' | 'inactive';
  delivery?: Record<string, unknown>;
  enrolmentConditions?: Record<string, unknown>;
  calculations?: Record<string, unknown>;
  academicStanding?: Record<string, unknown>;
  graduation?: Record<string, unknown>;
  chairAccess?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  designations?: Record<string, unknown>;
}

export interface BadgeBase {
  id: string;
  name: string;
  description: string;
  checkVersion: string;
  language: string;
  issuer: string;
  skillLevel: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface FacultyRecord {
  id: string;
  instructorId: string;
  title: string;
  description: string;
  year: string;
  icon: 'note' | 'award' | 'curriculum' | 'teaching' | 'history';
}

export interface TodoItem {
  id: string;
  instructorId: string;
  title: string;
  subtitle: string;
  tag?: string;
  priority: 'high' | 'medium' | 'low';
  action: 'open' | 'review' | 'check';
  link: { route: string; params?: Record<string, string> };
  done: boolean;
}

export interface UserSettings {
  userId: string;
  timeZone: string;
  notificationsEnabled: boolean;
  extendedPermissionsDemo?: boolean;
}

export interface Certificate {
  id: string;
  studentId: string;
  programmeId: string;
  issuedAt: string;
  credentialId: string;
}

export interface EnglishTestRegistration {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  preferredDate: string;
  firstLanguage: string;
  accommodation?: string;
  status: 'pending-review' | 'scheduled' | 'completed';
  createdAt: string;
}
