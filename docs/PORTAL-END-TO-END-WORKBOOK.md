# Heritage Portal — Current Working End-to-End Workbook

**Live portal:** https://myvccbc.com  
**Common login:** https://myvccbc.com/login  
**Audience:** Owner, Admin, Registrar, Instructor and Student  
**Rule:** This workbook documents the current implemented flow. A page that only shows sample/inventory data is not treated as an operational workflow.

## How to use this workbook

For every checkpoint, fill these columns while testing:

| Checkpoint | Operator | Test record/reference | Result | Evidence | Checked by/date |
|---|---|---|---|---|---|
| Example: student created | Admin | `owner.uat.student@...` | Pass/Fail | Student number or screenshot |  |

Use a fresh email/code prefix for every owner test, for example `OWNER-UAT-20261008`. Do not delete a real student, section or financial entry during testing.

---

# PART A — ADMIN STARTUP AND USER CREATION

## 1. Admin login and Dashboard

**Link:** https://myvccbc.com/login

1. Enter the admin email and password.
2. Select **Sign in**.
3. An Admin or Registrar account opens https://myvccbc.com/admin.
4. Confirm the dashboard loads and the permitted Quick Access cards are visible.
5. Use the left navigation for Course Management, Student Management, Finance, Workshops, Reporting and Self-Paced Learning.

**Expected result:** Admin dashboard opens. If an old student/teacher session is visible on the login page, sign in with the admin account; a successful login replaces the previous session.

**Checkpoint:** `Admin login — Pass / Fail`

## 2. Create a login-ready Teacher account

**Recommended link:** https://myvccbc.com/admin/users/create?role=instructor

1. Use the recommended direct link above. The Dashboard **Instructor onboard** card opens the detailed access-profile form; the direct link opens the shorter login-ready onboarding form used by this workbook.
2. Select role **Teacher / Instructor**.
3. Enter Given name, Family name and a unique campus email.
4. Keep or change the generated temporary password. It must be at least 8 characters.
5. Select **Create**.
6. Copy the email, temporary password and portal link shown in **Ready to sign in**.

**Expected result:** Instructor account is created and its portal is `/instructor`.

**Do not skip:** The teacher account must exist before it can be selected on a course session/section.

## 3. Create a login-ready Student account

**Recommended link:** https://myvccbc.com/admin/users/create?role=student

1. Select role **Student**.
2. Enter Given name, Family name and a unique email.
3. Enter Student Number if the institution has assigned one; otherwise the system can return one.
4. Select the Program where available.
5. Keep or change the temporary password.
6. Select **Create**.
7. Copy the email, temporary password, student number and `/student` portal shown after creation.

**Expected result:** Student login exists, but **My Courses remains empty until the student is enrolled into a section**.

## 4. User Directory and access permissions

- User Directory: https://myvccbc.com/admin/user-management
- Create User/access profile: https://myvccbc.com/admin/user-management/new
- Detailed Student creation: https://myvccbc.com/admin/student-management/create
- All Students / Student Management: https://myvccbc.com/admin/student-management/browse
- New Inquiry filter: https://myvccbc.com/admin/student-management/browse?f.status=New+Inquiry
- Student Search: https://myvccbc.com/admin/student-search

Use User Management when access level, campus scope or custom permissions must be configured. Use the login-ready onboarding links in Steps 2–3 for the shortest teacher/student end-to-end test.

To open Student 360, search/select a student from All Students or Student Search. Do not invent a Student 360 URL because it contains the selected student's generated ID.

**Checkpoint table**

| Item | Expected destination/result | Result |
|---|---|---|
| Teacher created | Can sign in and reaches `/instructor` |  |
| Student created | Can sign in and reaches `/student` |  |
| User Directory search | New account appears by email/name |  |

---

# PART B — ACADEMIC PREREQUISITES

## 5. Configure location records when needed

Create these in dependency order:

1. Brand: https://myvccbc.com/admin/location/brands
2. Region: https://myvccbc.com/admin/location/regions
3. Province: https://myvccbc.com/admin/location/provinces
4. Campus: https://myvccbc.com/admin/location/campuses
5. Classroom: https://myvccbc.com/admin/location/classrooms
6. Institution: https://myvccbc.com/admin/location/institutions

Only create missing records. Existing records should be selected rather than duplicated.

## 6. Configure term and calendar

1. Terms: https://myvccbc.com/admin/program-management/terms
2. Academic Calendars: https://myvccbc.com/admin/program-management/calendars
3. Master Scheduling: https://myvccbc.com/admin/program-management/scheduling

The course session start/end dates must fit the selected term. If terms overlap, explicitly choose the correct term on the session form.

## 7. Configure course supporting records only if missing

These are available inside Course Management:

- Course Categories: https://myvccbc.com/admin/course-management/categories
- Course Groups: https://myvccbc.com/admin/course-management/groups
- Course Types: https://myvccbc.com/admin/course-management/types
- Grading Schemes: https://myvccbc.com/admin/course-management/grading
- Textbooks: https://myvccbc.com/admin/course-management/textbooks
- Tests, competencies, resources and evaluations are also under `/admin/course-management/...`.

At minimum, a **Course Category** is required to create a course. A grading scheme is strongly recommended before teaching starts.

---

# PART C — CREATE COURSE, SESSION AND ASSIGN TEACHER

## 8. Create the master Course

**Course list:** https://myvccbc.com/admin/course-management/courses  
**Create Course:** https://myvccbc.com/admin/course-management/courses/new

1. Select **Create Course**.
2. Complete the required Course Details:
   - Course Category
   - Course Name
   - Course Number/code
   - Course Credit Value
   - Course Intake Type
   - Course Enrolment Permission
3. Add Course Description. AI generation is better grounded when this is complete.
4. Optionally upload a syllabus and choose syllabus privacy.
5. Configure tuition:
   - If included in program cost, keep **Course tuition included** enabled.
   - Otherwise select cost calculation and enter Domestic/International amount.
6. Configure default schedule: total course hours, hours per day, weekdays and time of day.
7. Select a Grading Scheme and repository setting.
8. Review transcript/credit/repeat-enrolment conditions.
9. Save the course.

**Expected result:** Course opens on its **Course Settings** tab and appears in Manage Courses & Sessions.

## 9. Create a Session / Offering and assign the Teacher

1. From https://myvccbc.com/admin/course-management/courses, open the new course.
2. Open the **Course Sessions & Offerings** tab.
3. Select **Create Session / Offering**.
4. Enter/select:
   - Session name/type
   - Campus and optional classroom
   - Maximum/minimum enrolments
   - Waitlist and self-enrolment settings
   - **Instructor(s)** — select the teacher created in Step 2
   - Start date, end date and Term
   - Weekly meeting days and start/finish time
   - Session tuition override if required
   - Grading Scheme
   - **Enable LMS**
5. Select **Save Session**.

**Expected result:** The offering appears below the course with location, instructor, dates, seats and status. The assigned teacher can see it after login.

### Quick section route

For a simple smoke test, https://myvccbc.com/admin/sections/create can create and assign a basic section from Course Code, Course Title, Section Code, Instructor Email, Credits and Term Code. For the full production workflow, use Course Management and Create Session / Offering because it includes dates, capacity, tuition, grading and LMS settings.

**Checkpoint table**

| Item | Expected result | Result |
|---|---|---|
| Course saved | Appears in Manage Courses |  |
| Session saved | Appears in Course Sessions & Offerings |  |
| Teacher assigned | Instructor name appears on offering |  |
| LMS enabled | Course workspace can be opened |  |

---

# PART D — ENROL STUDENT AND OPTIONAL COURSE FEE

## 10. Enrol the Student

**Link:** https://myvccbc.com/admin/enrolments

1. Type/select the student email.
2. Select the exact course section/offering.
3. Confirm Term, available seats and quoted fee.
4. Keep **Post course fee** selected only when the course/session fee should be posted.
5. Submit the enrolment.

**Possible outcomes:**

- Available seat: student becomes **enrolled**.
- Full section with waitlist enabled: student becomes **waitlisted**.
- Full section with no waitlist: enrolment is blocked.
- `Post course fee` enabled: a receivable is created unless tuition is included or amount is zero.

**Expected connected results:**

- Student appears in Teacher Roster/Class List.
- Course appears in Student My Courses.
- Posted fee appears in Student Finance.

---

# PART E — TEACHER LOGIN AND TEACHING FLOW

## 11. Teacher login

1. Log out from Admin.
2. Open https://myvccbc.com/login.
3. Enter the teacher email and temporary password from Step 2.
4. Teacher lands at https://myvccbc.com/instructor.

Main working links:

- Dashboard: https://myvccbc.com/instructor
- Sections: https://myvccbc.com/instructor/sections
- AI Draft: https://myvccbc.com/instructor/ai-draft
- Roster: https://myvccbc.com/instructor/roster
- Attendance: https://myvccbc.com/instructor/attendance
- Assessments: https://myvccbc.com/instructor/assessments
- Submissions: https://myvccbc.com/instructor/submissions
- Gradebook: https://myvccbc.com/instructor/gradebook
- Announcements: https://myvccbc.com/instructor/announcements
- Lectures: https://myvccbc.com/instructor/lectures
- Messages: https://myvccbc.com/instructor/messages

## 12. Open the assigned course workspace

1. Open **Sections**.
2. Select the assigned section.
3. Confirm these tabs are available: **Course, Class List, Attendance, Grades, Badges, More**.
4. Open **Class List** and confirm the student from Step 10 appears.

## 13. Build course content manually

Inside the section **Course** tab:

1. Select **Add topic**.
2. Enter topic title/summary and save.
3. Inside the topic, select **Add an activity or resource**.
4. Create the required activity type, such as:
   - Page/lesson
   - File/folder/resource/URL
   - Assignment
   - Quiz
   - Online class when required
5. Keep an item hidden while drafting; change it to visible when ready for students.
6. For an Assignment, configure instructions, availability/due dates, file/text submission rules, accepted types, size limit and grading values.
7. For a Quiz, add questions, answers and marks, then preview it.
8. For an Online Class, choose all enrolled students or selected students, then publish the meeting.

**Expected result:** Visible content appears inside the enrolled student's course. Hidden items do not appear to the student.

## 14. Teacher attendance, submissions and grades

1. Open Attendance for the exact section/date.
2. Mark each student and submit/finalize attendance.
3. Open Submissions and select the assignment.
4. Review the student's submitted text/files and enter feedback/mark.
5. Open Gradebook and confirm the grade item and student score.
6. Publish/submit final marks when the course policy allows it.

**Expected result:** Student Attendance and Grades pages show the teacher's saved/published results; approved final marks can feed the transcript flow.

---

# PART F — STUDENT LOGIN, STUDY AND SUBMISSION FLOW

## 15. Student login

1. Log out from the Teacher account.
2. Open https://myvccbc.com/login.
3. Enter the student email **or student number** and password.
4. Student lands at https://myvccbc.com/student.

Main working links:

- Dashboard: https://myvccbc.com/student
- My Courses: https://myvccbc.com/student/courses
- Assignments: https://myvccbc.com/student/assignments
- Assessments: https://myvccbc.com/student/assessments
- Grades: https://myvccbc.com/student/grades
- Attendance: https://myvccbc.com/student/attendance
- Calendar: https://myvccbc.com/student/calendar
- Fees: https://myvccbc.com/student/fees
- Workshops: https://myvccbc.com/student/workshops
- Profile: https://myvccbc.com/student/profile
- Documents: https://myvccbc.com/student/documents
- Messages: https://myvccbc.com/student/messages
- Notifications: https://myvccbc.com/student/notifications
- Requests/Services: https://myvccbc.com/student/f/st-16-services

## 16. Student studies the Course

1. Open **My Courses**.
2. Select the enrolled course card.
3. Confirm course code, section, term and instructor.
4. Open visible Learning Modules, Day Blocks, Syllabus or Folders.
5. Open lesson/resource/video content.
6. Select **Mark done/Complete** for completed learning items.
7. Join a published online class from the course page when a Join link is available.
8. Confirm content progress increases.

## 17. Student submits an Assignment

1. Open https://myvccbc.com/student/assignments.
2. Select the assignment.
3. Read instructions, opening time, due date and allowed submission type.
4. Enter online text and/or upload an allowed file.
5. Verify the uploaded file/version.
6. Submit the assignment.
7. Return after grading to confirm mark and feedback.

**Expected result:** Teacher sees the submission; after grading/publishing, Student Grades shows the result.

---

# PART G — COMPLETE CURRENT SELF-PACED FLOW

## 18. Self-Paced has two current working flows

Do not mix these two flows:

1. **Public self-paced catalogue/checkout:** A visitor opens `/selfpaced`, creates a learner account, enrols free or pays through Stripe test checkout, studies on `/selfpaced/dashboard` and earns a certificate.
2. **SIS section self-paced delivery:** Admin creates a normal Heritage course/session, assigns a teacher and enrols a student. Manual or AI-generated content is published into that exact section and appears in `/student/courses`.

### Flow 1 — Public catalogue administration

**Admin Catalogue:** https://myvccbc.com/admin/self-paced/catalogue

1. Select **Create program** or **AI-assisted setup**.
2. Enter Online title, Subject, Level, Required hours, Domestic/International tuition, Image URL, Description and chapter titles/source outline.
3. Select **Create reviewable draft**.
4. Review the new card in the catalogue.
5. Use **Publish** only when its public title, pricing, image and curriculum shell are correct.
6. Use **Unpublish** to remove it from the public catalogue without deleting it.

**Important:** **AI-assisted setup** on this screen creates the programme shell. It does not generate the full lesson content. Full AI generation is done from the exact-section AI Course Builder in Step 23.

### Flow 1 — Public learner enrolment and study

1. Visitor opens https://myvccbc.com/selfpaced.
2. Searches/filters the published catalogue and opens `/selfpaced/programs/<slug>`.
3. Reviews description, hours, chapters, activities and tuition.
4. Selects **Sign up & enrol free** or **Sign up & pay with Stripe**.
5. Creates a learner account with full name, email and password, or signs in with email/student number.
6. Free programme: access is activated without collecting a card.
7. Paid programme: visitor is redirected to hosted Stripe checkout. The current screen identifies this as **Stripe test mode**.
8. `/selfpaced/success` verifies the free/paid result before creating access; opening the success URL alone does not unlock a course.
9. Learner reaches https://myvccbc.com/selfpaced/dashboard.
10. Learner sets goal, weekly hours and target finish date when onboarding is shown.
11. Learner opens `/selfpaced/learn/<slug>`, follows the daily chapter unlock, completes readings/lectures/quizzes/assessments and resumes from the dashboard.
12. Course completion requires all activities and required assessments to pass.
13. Certificate opens at `/selfpaced/certificate/<slug>` and its public verification link opens at `/verify/<certificate-id>`.

**Public self-paced checkpoint:** Published programme → public card → authenticated verified enrolment → learner dashboard → progress → passed assessments → certificate.

## 19. What is the SIS section Self-Paced path?

The current working operational path is:

`Master Course → Session/Section with LMS → Teacher assigned → Student enrolled → Exact section Course workspace → Manual content or AI Course Builder → Publish → Student My Courses`

The Self-Paced overview is useful for navigation, but publishing happens against an **exact Heritage section**, not against a loose catalogue title.

## 20. Admin SIS Self-Paced entry points

- Overview: https://myvccbc.com/admin/self-paced/overview
- Catalogue: https://myvccbc.com/admin/self-paced/catalogue
- Curriculum & AI Drafts: https://myvccbc.com/admin/self-paced/content

From **Curriculum & AI Drafts**:

1. Find the exact section.
2. Select **Manual editor** for normal content creation.
3. Select **AI builder** for full self-paced AI course generation.

The generated dynamic link has this shape:

`/admin/course-management/active/view?id=<SECTION_ID>&tab=Course&aiCourse=1&delivery=self_paced`

Do not copy another section's ID. Always enter through the section card.

## 21. Manual Self-Paced authoring

1. Open the exact section through Self-Paced Content.
2. Add topics/modules.
3. Add pages, lessons, files, URLs, quizzes and assignments.
4. Add narrated content only after reviewing it.
5. Keep unfinished activities hidden.
6. Preview the learner-facing activity.
7. Make approved activities visible.
8. Log in as the enrolled student and verify the same section.

## 22. AI Draft — generate one lesson

**Teacher entry:** https://myvccbc.com/instructor/ai-draft

1. Teacher opens AI Draft.
2. Selects one of their assigned active sections.
3. Selects a topic.
4. Enters lesson title, minutes of study and number of video slides.
5. Chooses whether to include a practice quiz.
6. Selects **Generate with AI**.
7. Reviews the lesson, narrated slideshow and quiz.
8. Selects **Add to topic** only after review.

**Expected result:** The generated lesson is stored as a Page activity in the selected topic. It is not added to unrelated sections.

## 23. Full AI Course Builder — self-paced course

1. Admin opens Self-Paced Content and selects **AI builder** for the exact section, or an assigned teacher opens the course builder from their section.
2. Complete **Course brief**:
   - Total hours
   - Number of modules
   - Lessons per module
   - Questions per module quiz
   - Delivery format = **Self-paced (study units)**
   - Delivery method and breakdown
   - Audience and prerequisites
   - Approved outline/source material
   - Optional AI notes
3. Select **Generate blueprint**.
4. Wait for blueprint creation; it can take roughly 1–3 minutes.
5. Review/edit:
   - Course description
   - Learning outcomes
   - Module titles, purpose and milestone
   - Lesson titles
   - Quiz weight
   - Assessment names, modes, due modules and weights
6. Make sure the assessment weight total equals **100%**.
7. Select **Save changes** if edits were made.
8. Select **Approve & generate content**.
9. Generation continues on the server; the dialog can be closed and reopened.
10. Review every generated item with **Preview**.
11. Use **Retry** for failed items or **Regenerate** for an item that needs replacement.
12. Confirm all validation checks pass and every item is Ready.
13. Select **Publish to course** and confirm the warning.

**Publish result:**

- Topics and learner activities are added to the selected section.
- Quizzes and assignments/gradebook items are created.
- Self-paced lessons include the generated narrated slideshow.
- Instructor answer guides remain hidden from students.
- Publishing again replaces the previous AI-generated content for that section, while graded work is preserved.

## 24. Student completes SIS Self-Paced learning

1. Student logs in and opens My Courses.
2. Selects the self-paced section.
3. Opens each module/lesson and plays the narrated slideshow where present.
4. Completes readings, examples, practice and self-checks.
5. Marks items complete.
6. Attempts the published quizzes.
7. Opens and submits assignments.
8. Checks progress, grades and feedback.

## 25. Self-Paced pages that must not be reported as live operational queues

Some Self-Paced navigation pages currently render coverage/sample rows and action labels. Unless the button opens a real record or saves through an API, do not claim that it completed a workflow. In particular, owner acceptance should rely on the exact-section Course workspace for content, enrolment, grading and attendance.

Treat these as inventory/review views until their individual mutations are connected and separately tested:

- `/admin/self-paced/applications`
- `/admin/self-paced/enrolments`
- `/admin/self-paced/users`
- `/admin/self-paced/grading`
- `/admin/self-paced/attendance`
- `/admin/self-paced/integrity`
- `/admin/self-paced/finance`
- `/admin/self-paced/reports`
- `/admin/self-paced/branding`
- `/admin/self-paced/integration`
- `/admin/self-paced/documents`
- `/admin/self-paced/security`
- `/admin/self-paced/profile`

Use the real Admissions, Enrolments, Finance, Reporting, User Management, Requests and Course workspace links elsewhere in this workbook.

---

# PART H — FINANCE, WORKSHOPS AND REQUESTS

## 26. Student Finance

**Select student first:** https://myvccbc.com/admin/financial/student

Operational links:

- Transactions: https://myvccbc.com/admin/financial/transactions
- Fees: https://myvccbc.com/admin/financial/fees
- Invoices: https://myvccbc.com/admin/financial/invoices
- Disbursements: https://myvccbc.com/admin/financial/disbursements
- Awards: https://myvccbc.com/admin/financial/awards
- Adjustments: https://myvccbc.com/admin/financial/adjustments
- Payment Plans: https://myvccbc.com/admin/financial/payment-plans
- Unallocated Funds: https://myvccbc.com/admin/financial/unallocated-funds
- Alerts: https://myvccbc.com/admin/financial/alerts

Flow:

1. Select the student.
2. Confirm the course-enrolment fee or select **Add Fee**.
3. Create/view invoice where required.
4. Record/apply payment, approved credit, award or plan.
5. Student verifies balance at https://myvccbc.com/student/fees.

If the screen says **“The fee was added, but the student has no available credit to pay it”**, the fee already exists and is unpaid. Do not add it again; post/apply a payment or credit later.

## 27. Workshops

Admin links:

- Manage: https://myvccbc.com/admin/workshops/manage
- Create Workshop: https://myvccbc.com/admin/workshops/manage/new
- Create Category: https://myvccbc.com/admin/workshops/manage/categories/new
- Enrol Student: https://myvccbc.com/admin/workshops/enrol
- Enrolment Queue: https://myvccbc.com/admin/workshops/enrolments
- Attendance: https://myvccbc.com/admin/workshops/attendance

Flow:

1. Create/select a category.
2. Create the workshop with dates, location/delivery, capacity, instructor and visibility.
3. Public/available workshop appears at https://myvccbc.com/student/workshops?tab=available.
4. For controlled enrolment, admin enrols the student.
5. Student checks My Workshops.
6. Admin marks attendance/completion.

## 28. Student requests

Student submits at https://myvccbc.com/student/f/st-16-services.

Admin queues:

- Student Requests: https://myvccbc.com/admin/requests?f.type=Student+Requests
- Incidents / Disputes: https://myvccbc.com/admin/requests?f.type=Incidents+%2F+Disputes
- General Requests: https://myvccbc.com/admin/requests?f.type=General+Requests
- Profile Changes: https://myvccbc.com/admin/requests?f.type=Profile+Changes
- E-mail Changes: https://myvccbc.com/admin/requests?f.type=E-mail+Changes

Flow: Student submits → Admin opens matching queue → assigns/reviews → approves or declines → student checks Notifications/Messages. E-mail Change must be tested separately because a profile-originated email request may currently enter Profile Changes instead of the dedicated E-mail Changes queue.

---

# PART I — PUBLIC APPLY TO STUDENT CONVERSION

## 29. Applicant route (when the student starts from Apply)

1. Applicant starts at https://myvccbc.com/apply.
2. Applicant account/application is created and required files are uploaded.
3. Applicant completes/submits at https://myvccbc.com/applicant/application.
4. Admin receives it at https://myvccbc.com/admin/ops/admissions/applications.
5. Admin reviews documents at https://myvccbc.com/admin/ops/admissions/documents.
6. Admin schedules/completes interview at https://myvccbc.com/admin/ops/admissions/interviews.
7. Admin issues offer/LOA at https://myvccbc.com/admin/ops/admissions/offers.
8. Applicant accepts at https://myvccbc.com/applicant/offers.
9. Admin uses **Convert to Student** on the accepted application.
10. Admin then follows Steps 8–10: create/select course session and enrol the converted student.

Required Apply uploads are Grade 10, Grade 12, post-secondary, passport and language-test documents. Supported formats are PDF, DOC, DOCX, PNG, JPG and JPEG, with a 10 MB limit per document.

Applicant working links:

- Dashboard: https://myvccbc.com/applicant
- Application: https://myvccbc.com/applicant/application
- Documents: https://myvccbc.com/applicant/documents
- Requirements: https://myvccbc.com/applicant/f/ap-03-requirements
- Interview: https://myvccbc.com/applicant/f/ap-05-interview
- Status: https://myvccbc.com/applicant/f/ap-06-application-status
- Offers: https://myvccbc.com/applicant/offers
- Contract: https://myvccbc.com/applicant/f/ap-08-contract
- LOA: https://myvccbc.com/applicant/f/ap-09-loa
- Payment: https://myvccbc.com/applicant/f/ap-10-payment
- Onboarding: https://myvccbc.com/applicant/f/ap-11-onboarding
- Timeline: https://myvccbc.com/applicant/timeline
- Messages: https://myvccbc.com/applicant/messages
- Notifications: https://myvccbc.com/applicant/notifications

**Important:** `/apply` first enters Admissions. It is not the same thing as the Self-Paced Applications sample page or the Student Management New Inquiry filter.

---

# PART J — REPORTING AND FINAL OWNER SIGN-OFF

## 30. Reporting

- Run Report: https://myvccbc.com/admin/reporting/run
- Templates: https://myvccbc.com/admin/reporting/templates
- Scheduled Reports: https://myvccbc.com/admin/reporting/scheduled

Run reports only after the test has created real admissions, enrolment, finance, attendance and grade records. Record the report name, filters, generated time and expected row/reference.

## 31. Final serial acceptance checklist

| # | Test | Expected result | Pass/Fail | Evidence/reference |
|---:|---|---|---|---|
| 1 | Admin login | `/admin` opens |  |  |
| 2 | Create teacher | Teacher login ready |  |  |
| 3 | Create student | Student number/login ready |  |  |
| 4 | Location/term prerequisites | Required dropdown records exist |  |  |
| 5 | Create master course | Course in directory |  |  |
| 6 | Create session | Session under course |  |  |
| 7 | Assign teacher | Teacher sees section |  |  |
| 8 | Enrol student | Student in roster/My Courses |  |  |
| 9 | Post fee | Student balance shows once |  |  |
| 10 | Teacher manual lesson | Student can open it |  |  |
| 11 | Teacher assignment | Student sees it |  |  |
| 12 | Student submission | Teacher sees submitted work |  |  |
| 13 | Teacher grade | Student sees grade/feedback |  |  |
| 14 | Teacher attendance | Student sees attendance |  |  |
| 15 | AI single lesson | Added to selected topic only |  |  |
| 16 | AI self-paced blueprint | Blueprint reviewed, weights 100% |  |  |
| 17 | AI generation | All items ready/checks pass |  |  |
| 18 | AI publish | Student sees published modules |  |  |
| 19 | Student self-paced progress | Completion/progress updates |  |  |
| 20 | Workshop | Student enrolment/attendance works |  |  |
| 21 | Student request | Correct admin queue receives it |  |  |
| 22 | Finance payment | Student balance updates |  |  |
| 23 | Report | Test record appears with correct filters |  |  |
| 24 | Logout and role isolation | Each account sees only its portal |  |  |

## Completion rule

The end-to-end test is complete only when the same test references connect across all relevant roles:

`Admin course/section → Teacher assigned section → Student enrolment → Published learning → Student completion/submission → Teacher attendance/grade → Student grade/finance → Admin report`

Passing a URL or seeing a sample table is not enough. A checkpoint passes only when the action is saved and the next role/module receives the same record.
