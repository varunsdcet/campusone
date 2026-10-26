import type {
  Section, Course, ClassSession, SectionEnrolment, UserAccount, Assignment, Submission, SubmissionAttachment, GradeItem, Mark, FinalMark,
  AttendanceRecord, AttendanceCorrectionRequest, AttendanceStatus, Workshop, WorkshopEnrolment, Term,
} from '../../domain/types';

export interface SectionWithCourse extends Section {
  course: Course;
  instructorName: string;
  term: Term;
  enrolledCount: number;
}

export interface CoursesService {
  listStudentSections(studentId: string): Promise<SectionWithCourse[]>;
  listInstructorSections(instructorId: string): Promise<SectionWithCourse[]>;
  getSection(sectionId: string): Promise<SectionWithCourse>;
  listSessions(sectionId: string): Promise<ClassSession[]>;
  listRoster(sectionId: string): Promise<(UserAccount & { enrolment: SectionEnrolment })[]>;
  listTerms(): Promise<Term[]>;
  updateSectionContent(sectionId: string, patch: Partial<Pick<Section, 'objectives' | 'description' | 'days'>>): Promise<Section>;
}

/** Per-assignment submission rules set by the instructor (live mode). */
export interface AssignmentRules {
  onlineText: boolean;
  fileSubmissions: boolean;
  maxFiles?: number;
  maxFileBytes?: number;
  /** Lower-case extensions including the dot, e.g. ".pdf". Empty = any type the API accepts. */
  acceptedTypes: string[];
  availableFrom?: string;
  /** Hard deadline (cut-off, else due date) after which the API rejects changes. */
  closesAt?: string;
  /** False when submissions have not opened yet or the deadline has passed. */
  open: boolean;
}

export interface AssignmentWithContext extends Assignment {
  section: SectionWithCourse;
  submission?: Submission;
  mark?: Mark;
  derivedStatus: 'upcoming' | 'graded' | 'draft' | 'submitted' | 'late' | 'returned';
  rules?: AssignmentRules;
}

export interface AssignmentsService {
  listForStudent(studentId: string): Promise<AssignmentWithContext[]>;
  get(assignmentId: string, studentId: string): Promise<AssignmentWithContext>;
  saveDraft(input: { assignmentId: string; studentId: string; attachments: SubmissionAttachment[]; note?: string }): Promise<Submission>;
  /** Simulated upload; progress callback gets 0..1. Deterministic failure when `failUpload` is true. */
  submit(input: { assignmentId: string; studentId: string; attachments: SubmissionAttachment[]; note?: string; failUpload?: boolean; onProgress?: (p: number) => void }): Promise<Submission>;
  /** Downloads a server-stored submission file (attachment without a local `uri`) and returns its local path. */
  downloadAttachment?(attachment: SubmissionAttachment): Promise<string>;
  listSubmissionsForSection(sectionId: string): Promise<(Submission & { assignment: Assignment; student: UserAccount })[]>;
}

export interface GradesService {
  listGradeItems(sectionId: string): Promise<GradeItem[]>;
  addGradeItem(input: Omit<GradeItem, 'id'>): Promise<GradeItem>;
  listMarks(sectionId: string): Promise<Mark[]>;
  listStudentMarks(studentId: string): Promise<Mark[]>;
  saveDraftMarks(input: { sectionId: string; marks: { gradeItemId: string; studentId: string; score?: number; feedback?: string }[] }): Promise<Mark[]>;
  submitMarks(sectionId: string): Promise<{ submitted: number; missing: number }>;
  releaseMarks(sectionId: string): Promise<{ released: number }>;
  listFinalMarks(studentId: string): Promise<FinalMark[]>;
  exportGradesCsv(sectionId: string): Promise<{ fileName: string; content: string }>;
}

export interface AttendanceService {
  listStudentRecords(studentId: string): Promise<(AttendanceRecord & { session: ClassSession; section: SectionWithCourse })[]>;
  requestCorrection(input: { studentId: string; recordId: string; reason: string }): Promise<AttendanceCorrectionRequest>;
  listCorrections(studentId: string): Promise<AttendanceCorrectionRequest[]>;
  /** Instructor: records for a date across sections (draft or submitted). */
  listForDate(instructorId: string, date: string, sectionId?: string): Promise<{ section: SectionWithCourse; session?: ClassSession; records: AttendanceRecord[]; roster: UserAccount[] }[]>;
  saveDraft(input: { instructorId: string; sectionId: string; date: string; entries: { studentId: string; status: AttendanceStatus; note?: string }[] }): Promise<AttendanceRecord[]>;
  submit(input: { instructorId: string; sectionId: string; date: string; entries: { studentId: string; status: AttendanceStatus; note?: string }[] }): Promise<AttendanceRecord[]>;
  sectionSummary(sectionId: string): Promise<{ lastTaken?: string; present: number; total: number; sessionsTaken: number }>;
}

export interface WorkshopWithStatus extends Workshop {
  registeredCount: number;
  myEnrolment?: WorkshopEnrolment;
}

export interface WorkshopsService {
  list(studentId: string): Promise<WorkshopWithStatus[]>;
  get(workshopId: string, studentId?: string): Promise<WorkshopWithStatus>;
  register(input: { studentId: string; workshopId: string }): Promise<WorkshopEnrolment>;
  drop(input: { studentId: string; workshopId: string }): Promise<void>;
  join?(workshopId: string): Promise<{ ok: true; mode: 'online' | 'check_in'; joinUrl: string | null }>;
  listEnrolmentsForInstructor(): Promise<(WorkshopEnrolment & { workshop: Workshop; student: UserAccount })[]>;
  decide(input: { enrolmentId: string; decision: 'approved' | 'declined' | 'dropped'; instructorId: string }): Promise<WorkshopEnrolment>;
}
