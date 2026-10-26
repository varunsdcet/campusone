# Navigation map

All route names live in `src/navigation/routes.ts`; param types in `src/navigation/types.ts`; permission metadata in `src/navigation/permissions.ts`; tab/menu definitions in `src/navigation/menus.ts`. Screens are registered once in `src/features/registerScreens.ts`, so changing navigation structure later means editing these files only.

## Structure

```
RootNavigator (native stack, src/navigation/RootNavigator.tsx)
├─ Session boundary: Splash (hydrate repository → restore remembered session)
├─ Signed out:  Login · ResetPassword · StudentSupport · DevGallery
└─ Signed in:
   ├─ StudentTabs (bottom tabs)     Home | Courses | Schedule | Messages | Profile
   ├─ InstructorTabs (bottom tabs)  Home | Courses | Grades | Messages | More
   └─ every other route is pushed on the root stack (tab bar hidden on detail screens),
      wrapped by `withRoleGate` which enforces role + capability metadata.
```

- Login/logout/role switch call `resetToShell()` (a `CommonActions.reset`) so the stack never keeps screens from another role.
- Native-stack gestures (iOS swipe back) are enabled; modals (`FileViewer`) use `presentation: 'modal'`.
- Return-to-origin: detail screens `goBack()`; checkout and course-complete use `replace` so Back does not re-run a purchase.
- Unsaved-change confirmation: `useUnsavedChangesGuard` (beforeRemove) on forms (lesson editor, leave, personal details, compose, attendance marking, grade entry, add program/faculty/term, content course).
- Notification → record: `Notification.link` `{ route, params }` is navigated via `navigateTo()` (Grades released → course grades tab; workshop decisions → workshop details; instructor grade due → Grades Submission, …).
- Developer gallery (`DevGallery`) is a QA shortcut; every route listed there is also reachable through the app navigation below.

## Student routes

| Route | Entry points | Params | Permission |
|---|---|---|---|
| StudentHomeTab | tab | – | student |
| StudentCoursesTab | tab | – | student |
| StudentScheduleTab | tab, Attendance → Open calendar, Assignments menu | `{sectionId?}` | student |
| StudentMessagesTab | tab (Mail screen) | – | student |
| StudentProfileTab | tab (services hub) | – | student |
| StudentCatalogue | Courses tab → Current Programs; Home card; My Learning | – | student |
| StudentProgrammeDetails | Catalogue card / featured card / outline menu | `{programmeId}` | student |
| StudentCheckout | Programme details → Start Learning Now | `{programmeId}` | student |
| StudentMyLearning | Courses tab; Profile → Certificates | – | student |
| StudentOutline | Home continue card; My Learning; Checkout success; activity "Back to course" | `{programmeId}` | student |
| StudentReading / StudentLecture / StudentPracticeQuiz / StudentMatching / StudentAssessment | Outline activity rows; "Continue"; next-activity chaining | `{programmeId, activityId}` | student |
| StudentCourseComplete | Final activity; Outline when complete | `{programmeId}` | student |
| StudentCertificate | Outline ⋮ menu; Course complete; My Learning | `{programmeId}` | student |
| StudentAskCoach | Any activity "Ask coach"; lecture "Ask the instructor"; quiz hint; matching FAB | `{programmeId, activityId}` | student |
| StudentMyCourses | Courses tab; Home tile; Profile hub | – | student |
| StudentCourseDetails | My Courses card; notifications; Program Plan sheet; assignment "Open course" | `{sectionId, tab?}` | student |
| StudentLearningObjectives | Course Details resources | `{sectionId}` | student |
| StudentCourseInfo | Learning Objectives → All course information; Course ⋮ menu; Attendance → Open calendar | `{sectionId, view?}` | student |
| StudentLiveRoom | Course Details → Join | `{sectionId, roomId}` | student |
| StudentCourseQuiz | Course Details → Start Quiz | `{sectionId, materialId}` | student |
| StudentAssignments | Courses tab; Home; Profile hub; Course ⋮ | `{filter?}` | student |
| StudentAssignmentDetails | Assignment card; Home deadlines; Grades tab item | `{assignmentId}` | student |
| StudentAttendance | Courses tab; Home; Profile; notification link | `{sectionId?}` | student |
| StudentWorkshops | Courses tab; Home; Profile; badges → View Workshops | `{view?}` | student |
| StudentWorkshopDetails | Workshop card; notification link | `{workshopId}` | student |
| StudentFinalMarks / StudentBadges / StudentExtracurricular / StudentProgramPlan | Profile hub (Records); Home → Program Plan; Ask Heritage actions | – | student |
| StudentRequiredTasks / StudentDocuments / StudentTaxDocuments / StudentFinance | Profile hub (Services); Home tasks tile | – | student |
| StudentTransactions | Finance → View Transaction History; after demo payment | `{termId?}` | student |
| StudentPayBalance | Finance → Pay Outstanding Balance | `{termId, amount}` | student |
| StudentLeave | Profile hub | – | student |
| StudentRequestDetails | Leave list; after submit (leave, personal details) | `{requestId}` | student |
| StudentSecurity | Profile hub (Security / Update personal details) | `{next?}` | student |
| StudentChangePassword | Security → verified | – | student |
| StudentPersonalDetails | Security → verified (next=personalDetails) | – | student |
| StudentEnglishTest / StudentEnglishTestRegister | Profile hub → Register | – | student |
| StudentSupport | Login "Need Help"; Profile hub; Time zone Help | – | any (also signed out) |

## Instructor routes

| Route | Entry points | Params | Permission |
|---|---|---|---|
| InstructorHomeTab | tab (Dashboard) | – | instructor |
| InstructorCoursesTab | tab (My Courses) | – | instructor |
| InstructorGradesTab | tab (Grades Submission) | – | instructor |
| InstructorMessagesTab | tab (Mail) | – | instructor |
| InstructorMoreTab | tab (More hub) | – | instructor |
| InstructorAiDraft | Dashboard Draft Assistant; More | `{courseId?}` | instructor |
| InstructorEditLesson / InstructorLessonPreview | AI Draft → Edit lesson; editor eye icon / publish | `{lessonId}` | instructor |
| InstructorStudentList | More | – | `students.directory` |
| InstructorStudentProfile | Student List card; Class List row | `{studentId}` | instructor |
| InstructorMyCourses | Courses tab; Dashboard View all | – | instructor |
| InstructorCourseWorkspace | My Courses card; Dashboard Open Section; Grades Submission; todo links; Profile schedule | `{sectionId, tab?}` | instructor |
| InstructorMarkAttendance | Workspace Attendance → Mark attendance | `{sectionId, date}` | instructor |
| InstructorGradeEntry | Workspace Grades → Enter marks | `{sectionId}` | instructor |
| InstructorCourseAttendance | Dashboard Take Attendance; More; notification | `{date?, sectionId?}` | instructor |
| InstructorEvaluations / InstructorEvaluationDetails | More; notification | `{sectionId}` | instructor |
| InstructorRepository / InstructorCreateContentCourse / InstructorRepositoryHistory | More → Course Content Repository | `{repoId?}` | `repository.manage` |
| InstructorPendingSchedules / InstructorScheduleReview | Dashboard View Schedule; More; notification | `{requestId}` | `schedules.review` |
| InstructorGradesSubmission | Grades tab; Dashboard Grade Submissions; todos | `{sectionId?}` | instructor |
| InstructorCourseHistory / InstructorCourseHistoryDetails | More; Accomplishments derived records | `{offeringId}` | instructor |
| InstructorWorkshopEnrolments / InstructorWorkshopDetails | More; notification | `{tab?}` / `{workshopId}` | `workshops.approve` |
| InstructorFaculties / InstructorAddFaculty / InstructorAddProgram | More (Registry) | `{facultyId?}` / `{programId?, facultyId?}` | `registry.faculties` |
| InstructorProgramTypes | More (Registry) | – | `registry.programTypes` |
| InstructorManageTerms / InstructorTermForm | More (Registry) | `{termId?, mode?}` | `registry.terms` |
| InstructorProfile | Dashboard avatar; More; Actions menu | `{tab?}` | instructor |
| InstructorLiveRoom | Dashboard Office Hours; Workspace Join | `{sectionId, roomId}` | instructor |

## Shared routes

| Route | Entry points | Params |
|---|---|---|
| TimeZone | Profile hub / More / Security settings / Profile Actions | – |
| Notifications | Home bell / Profile hub / More | – |
| Mail / MailMessage / MailCompose | Messages tab; Ask Heritage "Book advisor"; Support; Tax contact; student profile message | `{folder?}` / `{messageId}` / `{draftId?, toId?, subject?}` |
| AskHeritage | Home; My Courses/Course Details FAB; Profile hub; More | – |
| FileViewer | Leave policy link (opens a bundled sample) | `{asset, title}` |
| Forbidden | rendered inline by `withRoleGate` | `{reason?}` |
| DevGallery | Login (DEV), Profile hub, More, Profile Actions | – |

## Permission model

`routePermission(route)` derives the role from the route prefix (`Student*`/`Instructor*`) and looks up capability requirements for registry/operations routes. `canAccess(route, user, settings)` is used by `withRoleGate` and the More hub. Capabilities are demo flags on the account (`UserAccount.capabilities`) plus the "Extended-permissions instructor demo" toggle (`UserSettings.extendedPermissionsDemo`). **Production authorization must be enforced by the backend.**
