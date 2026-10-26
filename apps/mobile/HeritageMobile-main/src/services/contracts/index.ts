export * from './auth';
export * from './learning';
export * from './academics';
export * from './records';
export * from './instructor';
export * from './courseLearning';
export * from './feePayments';
export * from './publicFlows';
export * from './applicant';
export * from './planner';

import type { AuthService } from './auth';
import type { CatalogueService, EnrolmentService, LearningService, CoachService } from './learning';
import type { CoursesService, AssignmentsService, GradesService, AttendanceService, WorkshopsService } from './academics';
import type { RecordsService, TasksService, DocumentsService, FinanceService, RequestsService, NotificationsService, MailService, AskHeritageService } from './records';
import type { InstructorService } from './instructor';
import type { CourseLearningService } from './courseLearning';
import type { FeePaymentsService } from './feePayments';
import type { PublicFlowsService } from './publicFlows';
import type { ApplicantService } from './applicant';
import type { PlannerService } from './planner';

export interface Services {
  auth: AuthService;
  catalogue: CatalogueService;
  enrolment: EnrolmentService;
  learning: LearningService;
  coach: CoachService;
  courses: CoursesService;
  assignments: AssignmentsService;
  grades: GradesService;
  attendance: AttendanceService;
  workshops: WorkshopsService;
  records: RecordsService;
  tasks: TasksService;
  documents: DocumentsService;
  finance: FinanceService;
  requests: RequestsService;
  notifications: NotificationsService;
  mail: MailService;
  askHeritage: AskHeritageService;
  instructor: InstructorService;
  /** Enrolled-course LMS, lectures, lab notes, assessments and live classes (live API only; absent in mock mode). */
  courseLearning?: CourseLearningService;
  /** Online fee payment by card (live API only; absent in mock mode). */
  feePayments?: FeePaymentsService;
  /** Signed-out apply / English Test / self-paced sign-up (live API only; absent in mock mode). */
  publicFlows?: PublicFlowsService;
  /** Applicant admissions portal (live API only; absent in mock mode). */
  applicant?: ApplicantService;
  planner: PlannerService;
}
