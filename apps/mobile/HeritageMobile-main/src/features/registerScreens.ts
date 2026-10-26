import { registerScreens } from '../navigation/screens';
import { Routes } from '../navigation/routes';
import { DevGalleryScreen } from '../dev/DevGalleryScreen';
import { StudentHomeScreen } from './student/home/StudentHomeScreen';
import { StudentCoursesTabScreen } from './student/home/StudentCoursesTabScreen';
import { StudentProfileScreen } from './student/profile/StudentProfileScreen';
import { SupportScreen } from './student/profile/SupportScreen';
import { CatalogueScreen } from './student/catalogue/CatalogueScreen';
import { ProgrammeDetailsScreen } from './student/catalogue/ProgrammeDetailsScreen';
import { CheckoutScreen } from './student/catalogue/CheckoutScreen';
import { StripeCheckoutScreen } from './student/catalogue/StripeCheckoutScreen';
import { MyLearningScreen } from './student/catalogue/MyLearningScreen';
import { OutlineScreen } from './student/learning/OutlineScreen';
import { ReadingScreen } from './student/learning/ReadingScreen';
import { LectureScreen } from './student/learning/LectureScreen';
import { PracticeQuizScreen, AssessmentScreen } from './student/learning/QuizScreen';
import { MatchingScreen } from './student/learning/MatchingScreen';
import { CourseCompleteScreen } from './student/learning/CourseCompleteScreen';
import { CertificateScreen } from './student/learning/CertificateScreen';
import { AskCoachScreen } from './student/learning/AskCoachScreen';
import { MyCoursesScreen } from './student/courses/MyCoursesScreen';
import { CourseDetailsScreen } from './student/courses/CourseDetailsScreen';
import { LearningObjectivesScreen } from './student/courses/LearningObjectivesScreen';
import { CourseInfoScreen, StudentScheduleTabScreen } from './student/courses/CourseInfoScreen';
import { LiveRoomScreen } from './student/courses/LiveRoomScreen';
import { CourseQuizScreen } from './student/courses/CourseQuizScreen';
import { CourseLectureScreen } from './student/courses/CourseLectureScreen';
import { CourseNotesScreen } from './student/courses/CourseNotesScreen';
import { CourseAssessmentsScreen } from './student/courses/CourseAssessmentsScreen';
import { AssignmentsScreen } from './student/assignments/AssignmentsScreen';
import { AssignmentDetailsScreen } from './student/assignments/AssignmentDetailsScreen';
import { AttendanceScreen } from './student/attendance/AttendanceScreen';
import { MyDayScreen } from './student/planner/MyDayScreen';
import { GradeCalculatorScreen, OpportunityMatcherScreen, PlannerCalendarScreen, StudyAnalyticsScreen, StudyToolsScreen } from './student/planner/PlannerFeatureScreens';
import { WorkshopsScreen } from './student/workshops/WorkshopsScreen';
import { WorkshopDetailsScreen } from './student/workshops/WorkshopDetailsScreen';
import { FinalMarksScreen } from './student/records/FinalMarksScreen';
import { BadgesScreen } from './student/records/BadgesScreen';
import { EvaluationScreen } from './student/records/EvaluationScreen';
import { CareerScreen } from './student/records/CareerScreen';
import { ExtracurricularScreen } from './student/records/ExtracurricularScreen';
import { ProgramPlanScreen } from './student/records/ProgramPlanScreen';
import { RequiredTasksScreen } from './student/services/RequiredTasksScreen';
import { DocumentsScreen } from './student/services/DocumentsScreen';
import { ComplianceScreen } from './student/services/ComplianceScreen';
import { TaxDocumentsScreen } from './student/services/TaxDocumentsScreen';
import { FinanceScreen, TransactionsScreen, PayBalanceScreen } from './student/services/FinanceScreens';
import { FeeCheckoutScreen } from './student/services/FeeCheckoutScreen';
import { LeaveScreen, RequestDetailsScreen } from './student/services/LeaveScreens';
import { PersonalDetailsScreen } from './student/services/PersonalDetailsScreen';
import { SecurityScreen, ChangePasswordScreen } from './student/services/SecurityScreens';
import { EnglishTestScreen, EnglishTestRegisterScreen } from './student/services/EnglishTestScreens';
import { StudentServicesScreen } from './student/services/StudentServicesScreen';
import { TimeZoneScreen } from './shared/TimeZoneScreen';
import { NotificationsScreen } from './shared/NotificationsScreen';
import { MailScreen, MailMessageScreen, MailComposeScreen } from './shared/MailScreens';
import { AskHeritageScreen } from './shared/AskHeritageScreen';
import { FileViewerScreen } from './shared/FileViewerScreen';
import { DashboardScreen } from './instructor/home/DashboardScreen';
import { MoreScreen } from './instructor/home/MoreScreen';
import { AiDraftScreen, EditLessonScreen, LessonPreviewScreen } from './instructor/drafting/AiDraftScreens';
import { AiCourseBuilderScreen } from './instructor/drafting/AiCourseBuilderScreen';
import { StudentListScreen, InstructorStudentProfileScreen } from './instructor/students/StudentListScreens';
import { InstructorMyCoursesScreen } from './instructor/courses/InstructorMyCoursesScreen';
import { WorkspaceScreen } from './instructor/workspace/WorkspaceScreen';
import { MarkAttendanceScreen } from './instructor/workspace/AttendanceTab';
import { GradeEntryScreen } from './instructor/workspace/GradesTab';
import { CourseAttendanceScreen } from './instructor/operations/CourseAttendanceScreen';
import { AssignedWorkScreen } from './instructor/operations/AssignedWorkScreen';
import { EvaluationsScreen, EvaluationDetailsScreen } from './instructor/operations/EvaluationsScreens';
import { RepositoryScreen, RepositoryHistoryScreen, CreateContentCourseScreen } from './instructor/operations/RepositoryScreens';
import { PendingSchedulesScreen, ScheduleReviewScreen, GradesSubmissionScreen, CourseHistoryScreen, CourseHistoryDetailsScreen } from './instructor/operations/SchedulesAndGradesScreens';
import { WorkshopEnrolmentsScreen, InstructorWorkshopDetailsScreen } from './instructor/operations/WorkshopEnrolmentsScreens';
import { FacultiesScreen, AddFacultyScreen, AddProgramScreen } from './instructor/registry/FacultiesScreens';
import { ProgramTypesScreen } from './instructor/registry/ProgramTypesScreen';
import { ManageTermsScreen, TermFormScreen } from './instructor/registry/TermsScreens';
import { InstructorProfileScreen } from './instructor/profile/InstructorProfileScreen';
import { ApplicantHomeScreen, ApplicantMessagesScreen, ApplicantMoreScreen, ApplicantOffersScreen, ApplicantTimelineScreen, ApplicantViewScreen } from './applicant/ApplicantPortalScreens';
import { ApplicationFormScreen } from './applicant/ApplicationFormScreen';
import { ApplicantDocumentsScreen } from './applicant/ApplicantDocumentsScreen';
import { publicScreens } from './public';

/** Registers every implemented screen. Features add themselves here as they are built. */
export function registerAllScreens() {
  registerScreens({
    ...publicScreens,
    [Routes.DevGallery]: DevGalleryScreen,
    [Routes.StudentHomeTab]: StudentHomeScreen,
    [Routes.StudentCoursesTab]: StudentCoursesTabScreen,
    [Routes.StudentProfileTab]: StudentProfileScreen,
    [Routes.StudentProfile]: StudentProfileScreen,
    [Routes.StudentServices]: StudentServicesScreen,
    [Routes.StudentSupport]: SupportScreen,
    [Routes.StudentCatalogue]: CatalogueScreen,
    [Routes.StudentProgrammeDetails]: ProgrammeDetailsScreen,
    [Routes.StudentCheckout]: CheckoutScreen,
    [Routes.StudentStripeCheckout]: StripeCheckoutScreen,
    [Routes.StudentMyLearning]: MyLearningScreen,
    [Routes.StudentOutline]: OutlineScreen,
    [Routes.StudentReading]: ReadingScreen,
    [Routes.StudentLecture]: LectureScreen,
    [Routes.StudentPracticeQuiz]: PracticeQuizScreen,
    [Routes.StudentAssessment]: AssessmentScreen,
    [Routes.StudentMatching]: MatchingScreen,
    [Routes.StudentCourseComplete]: CourseCompleteScreen,
    [Routes.StudentCertificate]: CertificateScreen,
    [Routes.StudentAskCoach]: AskCoachScreen,
    [Routes.StudentMyCourses]: MyCoursesScreen,
    [Routes.StudentCourseDetails]: CourseDetailsScreen,
    [Routes.StudentLearningObjectives]: LearningObjectivesScreen,
    [Routes.StudentCourseInfo]: CourseInfoScreen,
    [Routes.StudentScheduleTab]: StudentScheduleTabScreen,
    [Routes.StudentLiveRoom]: LiveRoomScreen,
    [Routes.InstructorLiveRoom]: LiveRoomScreen,
    [Routes.StudentCourseQuiz]: CourseQuizScreen,
    [Routes.StudentCourseLecture]: CourseLectureScreen,
    [Routes.StudentCourseNotes]: CourseNotesScreen,
    [Routes.StudentCourseAssessments]: CourseAssessmentsScreen,
    [Routes.StudentAssignments]: AssignmentsScreen,
    [Routes.StudentAssignmentDetails]: AssignmentDetailsScreen,
    [Routes.StudentAttendance]: AttendanceScreen,
    [Routes.StudentMyDay]: MyDayScreen,
    [Routes.StudentStudyAnalytics]: StudyAnalyticsScreen,
    [Routes.StudentGradeCalculator]: GradeCalculatorScreen,
    [Routes.StudentStudyTools]: StudyToolsScreen,
    [Routes.StudentOpportunityMatcher]: OpportunityMatcherScreen,
    [Routes.StudentPlannerCalendar]: PlannerCalendarScreen,
    [Routes.StudentWorkshops]: WorkshopsScreen,
    [Routes.StudentWorkshopDetails]: WorkshopDetailsScreen,
    [Routes.StudentFinalMarks]: FinalMarksScreen,
    [Routes.StudentBadges]: BadgesScreen,
    [Routes.StudentCourseEvaluation]: EvaluationScreen,
    [Routes.StudentCareer]: CareerScreen,
    [Routes.StudentExtracurricular]: ExtracurricularScreen,
    [Routes.StudentProgramPlan]: ProgramPlanScreen,
    [Routes.StudentRequiredTasks]: RequiredTasksScreen,
    [Routes.StudentDocuments]: DocumentsScreen,
    [Routes.StudentCompliance]: ComplianceScreen,
    [Routes.StudentTaxDocuments]: TaxDocumentsScreen,
    [Routes.StudentFinance]: FinanceScreen,
    [Routes.StudentTransactions]: TransactionsScreen,
    [Routes.StudentPayBalance]: PayBalanceScreen,
    [Routes.StudentFeeCheckout]: FeeCheckoutScreen,
    [Routes.StudentLeave]: LeaveScreen,
    [Routes.StudentRequestDetails]: RequestDetailsScreen,
    [Routes.StudentPersonalDetails]: PersonalDetailsScreen,
    [Routes.StudentSecurity]: SecurityScreen,
    [Routes.StudentChangePassword]: ChangePasswordScreen,
    [Routes.StudentEnglishTest]: EnglishTestScreen,
    [Routes.StudentEnglishTestRegister]: EnglishTestRegisterScreen,
    [Routes.TimeZone]: TimeZoneScreen,
    [Routes.Notifications]: NotificationsScreen,
    [Routes.Mail]: MailScreen,
    [Routes.StudentMessagesTab]: MailScreen,
    [Routes.InstructorMessagesTab]: MailScreen,
    [Routes.MailMessage]: MailMessageScreen,
    [Routes.MailCompose]: MailComposeScreen,
    [Routes.AskHeritage]: AskHeritageScreen,
    [Routes.FileViewer]: FileViewerScreen,
    [Routes.InstructorHomeTab]: DashboardScreen,
    [Routes.InstructorDashboard]: DashboardScreen,
    [Routes.InstructorMoreTab]: MoreScreen,
    [Routes.InstructorMore]: MoreScreen,
    [Routes.InstructorCoursesTab]: InstructorMyCoursesScreen,
    [Routes.InstructorMyCourses]: InstructorMyCoursesScreen,
    [Routes.InstructorGradesTab]: GradesSubmissionScreen,
    [Routes.InstructorGradesSubmission]: GradesSubmissionScreen,
    [Routes.InstructorAiDraft]: AiDraftScreen,
    [Routes.InstructorEditLesson]: EditLessonScreen,
    [Routes.InstructorLessonPreview]: LessonPreviewScreen,
    [Routes.InstructorAiCourse]: AiCourseBuilderScreen,
    [Routes.InstructorStudentList]: StudentListScreen,
    [Routes.InstructorStudentProfile]: InstructorStudentProfileScreen,
    [Routes.InstructorCourseWorkspace]: WorkspaceScreen,
    [Routes.InstructorMarkAttendance]: MarkAttendanceScreen,
    [Routes.InstructorGradeEntry]: GradeEntryScreen,
    [Routes.InstructorCourseAttendance]: CourseAttendanceScreen,
    [Routes.InstructorAssignedWork]: AssignedWorkScreen,
    [Routes.InstructorEvaluations]: EvaluationsScreen,
    [Routes.InstructorEvaluationDetails]: EvaluationDetailsScreen,
    [Routes.InstructorRepository]: RepositoryScreen,
    [Routes.InstructorRepositoryHistory]: RepositoryHistoryScreen,
    [Routes.InstructorCreateContentCourse]: CreateContentCourseScreen,
    [Routes.InstructorPendingSchedules]: PendingSchedulesScreen,
    [Routes.InstructorScheduleReview]: ScheduleReviewScreen,
    [Routes.InstructorCourseHistory]: CourseHistoryScreen,
    [Routes.InstructorCourseHistoryDetails]: CourseHistoryDetailsScreen,
    [Routes.InstructorWorkshopEnrolments]: WorkshopEnrolmentsScreen,
    [Routes.InstructorWorkshopDetails]: InstructorWorkshopDetailsScreen,
    [Routes.InstructorFaculties]: FacultiesScreen,
    [Routes.InstructorAddFaculty]: AddFacultyScreen,
    [Routes.InstructorAddProgram]: AddProgramScreen,
    [Routes.InstructorProgramTypes]: ProgramTypesScreen,
    [Routes.InstructorManageTerms]: ManageTermsScreen,
    [Routes.InstructorTermForm]: TermFormScreen,
    [Routes.InstructorProfile]: InstructorProfileScreen,
    [Routes.ApplicantHomeTab]: ApplicantHomeScreen,
    [Routes.ApplicantApplicationTab]: ApplicationFormScreen,
    [Routes.ApplicantDocumentsTab]: ApplicantDocumentsScreen,
    [Routes.ApplicantMessagesTab]: ApplicantMessagesScreen,
    [Routes.ApplicantMoreTab]: ApplicantMoreScreen,
    [Routes.ApplicantOffers]: ApplicantOffersScreen,
    [Routes.ApplicantTimeline]: ApplicantTimelineScreen,
    [Routes.ApplicantView]: ApplicantViewScreen,
  });
}
