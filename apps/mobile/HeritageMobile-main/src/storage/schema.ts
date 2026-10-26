import type * as D from '../domain/types';

export const DB_STORAGE_KEY = 'heritage.demo.db';
export const DB_SCHEMA_VERSION = 1;

/**
 * The persistent demo database. This is the single source of truth for all
 * simulated domain records. Screens never keep their own copies; TanStack Query
 * caches are derived views of this store and are invalidated after mutations.
 */
export interface DemoDb {
  schemaVersion: number;
  seededAt: string;
  users: D.UserAccount[];
  settings: D.UserSettings[];
  programmes: D.Programme[];
  enrolments: D.Enrolment[];
  payments: D.Payment[];
  progress: D.LearningProgress[];
  bookmarks: D.Bookmark[];
  coachConversations: D.CoachConversation[];
  certificates: D.Certificate[];
  terms: D.Term[];
  courses: D.Course[];
  sections: D.Section[];
  sectionEnrolments: D.SectionEnrolment[];
  classSessions: D.ClassSession[];
  assignments: D.Assignment[];
  submissions: D.Submission[];
  gradeItems: D.GradeItem[];
  marks: D.Mark[];
  finalMarks: D.FinalMark[];
  attendance: D.AttendanceRecord[];
  attendanceCorrections: D.AttendanceCorrectionRequest[];
  workshops: D.Workshop[];
  workshopEnrolments: D.WorkshopEnrolment[];
  badges: D.Badge[];
  badgeAwards: D.BadgeAward[];
  extracurricular: D.ExtracurricularRecord[];
  planCourses: D.PlanCourse[];
  requiredTasks: D.RequiredTask[];
  documents: D.StudentDocument[];
  taxDocuments: D.TaxDocument[];
  statements: D.FinanceStatement[];
  transactions: D.FinanceTransaction[];
  requests: D.ChangeRequest[];
  notifications: D.Notification[];
  mail: D.MailMessage[];
  contacts: D.Contact[];
  lessonPlans: D.LessonPlan[];
  competencies: D.CompetencyDef[];
  competencyAssessments: D.CompetencyAssessment[];
  sectionBadges: D.SectionBadge[];
  logs: D.LogEntry[];
  repositories: D.ContentRepository[];
  scheduleChanges: D.ScheduleChangeRequest[];
  evaluations: D.CourseEvaluation[];
  history: D.HistoricalOffering[];
  faculties: D.Faculty[];
  programTypes: D.ProgramType[];
  academicPrograms: D.AcademicProgram[];
  badgeBases: D.BadgeBase[];
  facultyRecords: D.FacultyRecord[];
  todos: D.TodoItem[];
  englishTests: D.EnglishTestRegistration[];
}

export type DbTable = {
  [K in keyof DemoDb]: DemoDb[K] extends Array<infer T> ? T : never;
};
export type TableName = { [K in keyof DemoDb]: DemoDb[K] extends unknown[] ? K : never }[keyof DemoDb];
