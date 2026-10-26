import type {
  LessonPlan, UserAccount, CompetencyDef, CompetencyAssessment, SectionBadge, LogEntry, ContentRepository, ScheduleChangeRequest, CourseEvaluation,
  HistoricalOffering, Faculty, ProgramType, AcademicProgram, Term, BadgeBase, FacultyRecord, TodoItem, InstructorProfile, Course, Section, AiDraftStoryboard, MarkStatus,
} from '../../domain/types';
import type { SectionWithCourse } from './academics';

export interface AiDraftCourse { sectionId: string; code: string; title: string; section: string; dates: string; enrolment: string }
export interface AiDraftTopic { id: string; title: string; summary: string; activities: string[] }
export interface AiDraftQuizItem { question: string; options: string[]; answer: number }
export interface AiDraftInput { sectionId: string; topic: AiDraftTopic; lessonTitle: string; minutes: number; slides: number }
export interface AiDraftResult {
  lessonTitle: string;
  lessonHtml: string;
  quiz: AiDraftQuizItem[];
  storyboard: AiDraftStoryboard;
  model: string;
  grounding: { course: string; hasDescription: boolean; term: string | null };
}

export type AiCourseDelivery = 'synchronous' | 'self_paced';
export interface AiCourseBrief { hours: number; modules: number; lessonsPerModule: number; delivery: AiCourseDelivery; deliveryMethod: string; breakdown: string; audience: string; includeCase: boolean; quizQuestions: number; outline: string; notes: string }
export interface AiCourseLesson { id: string; title: string; focus: string; minutes: number }
export interface AiCourseModule { id: string; number: number; title: string; purpose: string; milestone: string; outcomes: string[]; minutes: number; lessons: AiCourseLesson[] }
export interface AiCourseAssessment { id: string; title: string; mode: 'Individual' | 'Team'; weight: number; dueModule: string; outcomes: string[]; summary: string }
export interface AiCourseBlueprint {
  course: { code: string; title: string; hours: number; totalMinutes: number; delivery: AiCourseDelivery; description: string };
  outcomes: { id: string; text: string }[];
  modules: AiCourseModule[];
  quizWeight: number;
  quizQuestions: number;
  assessments: AiCourseAssessment[];
  assumptions: string[];
  approvalRequired: string[];
  flags: string[];
}
export type AiCourseItemStatus = 'pending' | 'running' | 'done' | 'failed';
export interface AiCourseItem { key: string; kind: string; label: string; status: AiCourseItemStatus; error?: string; attempts: number; flags: number }
export interface AiCourseCheck { label: string; ok: boolean; detail: string }
export interface AiCourseState {
  course: { code: string; title: string; description: string; totalHours: number | null };
  job: {
    version: number;
    stage: 'blueprint' | 'approved' | 'published';
    brief: AiCourseBrief;
    blueprint: AiCourseBlueprint | null;
    blueprintTask: { status: 'running' | 'done' | 'failed'; error?: string };
    published: { at: string; version: number } | null;
  } | null;
  items: AiCourseItem[];
  running: boolean;
  checks: AiCourseCheck[];
  publishedSummary?: { topics: number; activities: number; assignments: number };
}
export interface AiCourseBlueprintEdits {
  description: string;
  outcomes: string[];
  modules: { title: string; purpose: string; milestone: string; lessons: { title: string; focus: string }[] }[];
  quizWeight: number;
  assessments: { title: string; mode: AiCourseAssessment['mode']; weight: number; dueModule: string; summary: string }[];
}
export interface AiCourseItemPreview { key: string; label: string; html: string; flags: string[] }

/** Course-grounded AI drafting and the AI course builder (live API only). */
export interface InstructorAiService {
  courses(): Promise<AiDraftCourse[]>;
  topics(sectionId: string): Promise<AiDraftTopic[]>;
  generateDraft(input: AiDraftInput): Promise<AiDraftResult>;
  addDraftToTopic(input: { sectionId: string; topicId: string; name: string; html: string; storyboard: AiDraftStoryboard }): Promise<void>;
  course(sectionId: string): Promise<AiCourseState>;
  startBlueprint(sectionId: string, brief: AiCourseBrief): Promise<AiCourseState>;
  saveBlueprint(sectionId: string, edits: AiCourseBlueprintEdits): Promise<AiCourseState>;
  approve(sectionId: string): Promise<AiCourseState>;
  run(sectionId: string, key?: string): Promise<AiCourseState>;
  publish(sectionId: string): Promise<AiCourseState>;
  reopen(sectionId: string): Promise<AiCourseState>;
  discard(sectionId: string): Promise<AiCourseState>;
  preview(sectionId: string, key: string): Promise<AiCourseItemPreview>;
}

export interface DashboardData {
  studentCount: number;
  courseCount: number;
  sectionCount: number;
  pendingGradeSections: number;
  todos: TodoItem[];
  sections: (SectionWithCourse & { gradeStatus: 'Submission required' | 'Submitted' | 'Released' })[];
  officeHours?: { label: string; roomReady: boolean; mode?: string };
  unreadNotifications: number;
}

/** Term plus the registration add/drop deadline. The live API term model has no add/drop field, so it is only set in mock mode. */
export type TermRecord = Term & { addDropDeadline?: string };

/** Instructor profile tabs served by the live SIS profile screens (t03–t06). Empty arrays mean the API has no data. */
export interface InstructorProfileTabs {
  topics: { current: string[]; previous: string[]; chair: string[]; certifications: string[]; research: string[] };
  availability: {
    slots: { id: string; day: string; from: string; to: string; mode: string; location: string; repeats?: string; date?: string; endDate?: string; note?: string }[];
    officeHours: string;
    generalInfo: string;
  };
  compensation: { summary: { label: string; value: string }[]; payPeriods: Record<string, string>[]; contracts: Record<string, string>[] };
  schedule: {
    weekLabel: string;
    days: { label: string; dateLabel: string; entries: { kind: 'class' | 'availability'; title: string; time: string; location?: string }[] }[];
    upcoming: { date: string; course: string; section: string; time: string }[];
  };
}

/** A student's records inside the instructor's own sections. */
export interface InstructorStudentRecord {
  /** Academic standing as recorded by the SIS; undefined when the source has none. */
  standing?: string;
  /** Submitted attendance only. */
  attendance: { sectionId: string; date: string; status: 'present' | 'absent' | 'late' | 'excused'; note?: string }[];
  grades: { sectionId: string; items: { id: string; name: string; weightPct: number; maxPoints: number; score?: number; status: MarkStatus; feedback?: string }[] }[];
}
export interface StudentNote { id: string; studentId: string; at: string; author: string; text: string }
/** Final-grade distribution for a past offering, computed from released marks. */
export interface OfferingGradeDistribution { enrolled: number; graded: number; bands: { label: string; count: number }[] }

export interface AssignedWorkItem {
  id: string;
  kind: string;
  category: string;
  title: string;
  subtitle: string;
  status: string;
  when: string | null;
  location: string | null;
  actionUrl: string | null;
  details: { label: string; value: string }[];
  updatedAt: string;
}

export interface InstructorService {
  /** Cross-module records explicitly assigned to the signed-in staff person. */
  listAssignedWork?(): Promise<AssignedWorkItem[]>;
  dashboard(instructorId: string): Promise<DashboardData>;
  completeTodo(todoId: string): Promise<void>;
  // Student directory (restricted to authorised fixture records)
  listStudents(instructorId: string, filters: { category: 'all' | 'active' | 'former'; query?: string; letter?: string; page: number; pageSize: number; program?: string }): Promise<{ items: (UserAccount & { status: string; termLabel: string; admissionTerm: string; updatedAt: string })[]; total: number; pageCount: number }>;
  getStudent(instructorId: string, studentId: string): Promise<UserAccount & { sections: SectionWithCourse[] }>;
  getStudentRecord(instructorId: string, studentId: string): Promise<InstructorStudentRecord>;
  /** Omitted when the backend has no instructor-facing student notes. */
  studentNotes?: {
    list(studentId: string): Promise<StudentNote[]>;
    add(studentId: string, text: string): Promise<StudentNote>;
  };
  // Lesson plans
  listLessonCourses(instructorId: string): Promise<Course[]>;
  listLessonPlans(courseId: string): Promise<LessonPlan[]>;
  getLessonPlan(lessonId: string): Promise<LessonPlan>;
  saveLessonPlan(lesson: LessonPlan): Promise<LessonPlan>;
  generateLessonDraft(lessonId: string, kind: 'lesson' | 'quiz'): Promise<{ content: string }>;
  publishLessonPlan(lessonId: string): Promise<LessonPlan>;
  // Workspace tabs
  listCompetencies(sectionId: string): Promise<(CompetencyDef & { assessments: CompetencyAssessment[] })[]>;
  saveCompetency(def: Omit<CompetencyDef, 'id'> & { id?: string }): Promise<CompetencyDef>;
  deleteCompetency(id: string): Promise<void>;
  assessCompetency(input: { competencyId: string; studentId: string; level: string }): Promise<CompetencyAssessment>;
  listSectionBadges(sectionId: string): Promise<SectionBadge[]>;
  saveSectionBadge(badge: Omit<SectionBadge, 'id'> & { id?: string }): Promise<SectionBadge>;
  deleteSectionBadge(id: string): Promise<void>;
  queryLogs(filters: { sectionId: string; participantId?: string; date?: string; activity?: string; action?: string; source?: string; event?: string; logType?: string }): Promise<LogEntry[]>;
  // Operations
  listEvaluations(instructorId: string): Promise<(CourseEvaluation & { section: SectionWithCourse })[]>;
  getEvaluation(sectionId: string): Promise<(CourseEvaluation & { section: SectionWithCourse }) | null>;
  listRepositories(filters: { query?: string; repository?: string; page: number; pageSize: number }): Promise<{ items: ContentRepository[]; total: number; pageCount: number }>;
  createRepository(input: { courseId: string; name: string; types: string; isDefault: boolean; format: string; sections: number; deactivateDuplicates: boolean }): Promise<{ repo: ContentRepository; deactivated: ContentRepository[] }>;
  updateRepository(id: string, patch: Partial<ContentRepository>): Promise<ContentRepository>;
  deleteRepository(id: string): Promise<void>;
  repositoryAction(id: string, action: 'push' | 'pull' | 'manage'): Promise<ContentRepository>;
  /** Omitted when the backend keeps no restorable repository versions. */
  restoreRepositoryVersion?(id: string, historyId: string): Promise<ContentRepository>;
  listScheduleChanges(instructorId: string, changeType?: string): Promise<(ScheduleChangeRequest & { section: SectionWithCourse })[]>;
  decideScheduleChange(input: { id: string; decision: 'accepted' | 'rejected'; note?: string }): Promise<ScheduleChangeRequest>;
  gradeSubmissionOverview(instructorId: string, filters: { sectionId?: string; status?: 'required' | 'submitted' | 'released' | 'all' }): Promise<{ section: SectionWithCourse; studentCount: number; missing: number; status: 'required' | 'submitted' | 'released' }[]>;
  listHistory(instructorId: string): Promise<HistoricalOffering[]>;
  /** Null when no released final marks exist for the offering. */
  historyGradeDistribution(offeringId: string): Promise<OfferingGradeDistribution | null>;
  // Registry (capability gated in UI + service)
  listFaculties(): Promise<(Faculty & { programs: AcademicProgram[] })[]>;
  saveFaculty(f: Omit<Faculty, 'id'> & { id?: string }): Promise<Faculty>;
  deleteFaculty(id: string): Promise<{ blockedBy?: string }>;
  saveProgram(p: Omit<AcademicProgram, 'id'> & { id?: string }): Promise<AcademicProgram>;
  deleteProgram(id: string): Promise<{ blockedBy?: string }>;
  listProgramTypes(query?: string): Promise<ProgramType[]>;
  saveProgramType(t: Omit<ProgramType, 'id' | 'order'> & { id?: string }): Promise<ProgramType>;
  reorderProgramTypes(orderedIds: string[]): Promise<ProgramType[]>;
  deleteProgramType(id: string): Promise<{ blockedBy?: string }>;
  listTerms(campus?: string): Promise<TermRecord[]>;
  listCampuses?(): Promise<string[]>;
  saveTerm(t: Omit<TermRecord, 'id'> & { id?: string }): Promise<Term>;
  deleteTerm(id: string): Promise<{ blockedBy?: string }>;
  // Profile & accomplishments
  getProfile(instructorId: string): Promise<UserAccount>;
  /** Live only: read-only Topics/Availability/Compensation/Schedule tab data. */
  getProfileTabs?(): Promise<InstructorProfileTabs>;
  updateProfile(instructorId: string, patch: Partial<InstructorProfile> & { displayName?: string; preferredName?: string; email?: string }): Promise<UserAccount>;
  accomplishments(instructorId: string): Promise<{ currentSections: number; coursesTaught: number; students: number; badgeBases: BadgeBase[]; issuedCount: number; records: FacultyRecord[]; studentBadges: { badgeCode: string; title: string; studentName: string; status: 'earned' | 'available'; year?: string }[] }>;
  createBadgeBase(input: Omit<BadgeBase, 'id' | 'createdAt' | 'status'>): Promise<BadgeBase>;
  addFacultyRecord(input: Omit<FacultyRecord, 'id'>): Promise<FacultyRecord>;
  updateFacultyRecord(id: string, patch: Partial<FacultyRecord>): Promise<FacultyRecord>;
  listSectionsForInstructor(instructorId: string): Promise<Section[]>;
  ai?: InstructorAiService;
}
