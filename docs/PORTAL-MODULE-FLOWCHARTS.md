# Heritage Portal — End-to-End Module Flowcharts

**Live portal:** https://myvccbc.com  
**Login:** https://myvccbc.com/login  
**Audience:** Owner, Administrator, Registrar, Instructor, Student and Applicant  
**Purpose:** Follow the modules in dependency order and confirm that the same test record moves successfully from one role to the next.

> A student account can log in without a program. A course or program assignment is required only to make learning content appear in **My Courses**.

---

## 1. Complete Portal Flow — Correct Order

```mermaid
flowchart TD
    A[Admin Login and Dashboard] --> B[Location Setup]
    B --> C[Academic Term and Calendar]
    C --> D[Create Teacher Account]
    C --> E[Create Student Account]
    D --> F[Create Master Course]
    F --> G[Create Course Session / Offering]
    G --> H[Assign Instructor and Enable LMS]
    H --> I{How will the student be enrolled?}
    I -->|Direct course only| J[Direct Course Enrolment]
    I -->|Complete program| K[Create Program and Pathway]
    K --> L[Create Master Schedule]
    L --> M[Add Course Sessions and mark one Feed-in]
    M --> N[Student 360: Save Program Enrolment]
    J --> O[Student appears in Teacher Roster]
    N --> O
    O --> P[Teacher publishes lessons, assignments and quizzes]
    P --> Q[Student studies and submits work]
    Q --> R[Teacher records attendance and grades]
    J --> S[Optional course fee is posted]
    N --> S
    S --> T[Invoice, payment, credit, award or payment plan]
    R --> U[Reports and final verification]
    T --> U
```

### Mandatory dependency rule

`Location/Term → Teacher + Student → Course → Session → Instructor → Student enrolment → Content → Submission → Grade/Attendance → Finance → Reporting`

Do not test Reporting before real records have been created in the source modules.

---

## 2. Admin Login and Dashboard

**Links**

- Login: https://myvccbc.com/login
- Dashboard: https://myvccbc.com/admin

```mermaid
flowchart LR
    A[Open Login] --> B[Enter Admin Credentials]
    B --> C[Admin Dashboard]
    C --> D[Quick Access Cards]
    C --> E[Left Navigation Modules]
    D --> F[Open Required Operational Module]
    E --> F
```

**Verify:** Dashboard loads, role is Admin/Registrar, and the required navigation modules are visible.

---

## 3. User Management — Create Teacher

**Recommended creation link:** https://myvccbc.com/admin/users/create?role=instructor  
**User directory:** https://myvccbc.com/admin/user-management

```mermaid
flowchart LR
    A[Admin] --> B[Create User]
    B --> C[Select Teacher / Instructor]
    C --> D[Enter Name, Unique Email and Password]
    D --> E[Create Active Account]
    E --> F[Teacher Login]
    F --> G[Instructor Dashboard]
    E --> H[Assign Teacher to a Course Session]
    H --> I[Course appears in Teacher Sections / My Courses]
```

**Important:** Creating a teacher login does not automatically assign a course. The teacher must be selected as the **Instructor** on a course session/offering.

**Program Faculty is not the teacher list.** In Program Settings, **Program Faculty** comes from academic faculty records such as Business or Computer Science. Teachers are selected later in Course Sessions or Master Scheduling.

---

## 4. User Management — Create Student

**Recommended creation link:** https://myvccbc.com/admin/users/create?role=student  
**Detailed creation:** https://myvccbc.com/admin/student-management/create  
**Browse students:** https://myvccbc.com/admin/student-management/browse

```mermaid
flowchart LR
    A[Admin] --> B[Create Student]
    B --> C[Enter Name, Unique Email and Password]
    C --> D[Assign Student Number or Generate One]
    D --> E[Create Active Student Account]
    E --> F[Student Can Login]
    F --> G{Enrolled in learning?}
    G -->|No| H[My Courses is empty]
    G -->|Yes| I[Assigned course appears in My Courses]
```

**Rules**

- Program assignment is not required for login.
- An active account with the `student` role can log in immediately.
- A direct course enrolment or program enrolment is required for the course to appear in **My Courses**.
- Student status controls the Student Management sidebar queue. For example, a student with status **Graduated** does not appear in **Approved Application**.

---

## 5. Location Management

Create only missing records and reuse existing records to avoid duplicates.

```mermaid
flowchart LR
    A[Brand] --> B[Region]
    B --> C[Province / State]
    C --> D[Campus]
    D --> E[Classroom]
    E --> F[Institution Settings]
    F --> G[Locations become available in sessions and schedules]
```

**Links**

- Brands: https://myvccbc.com/admin/location/brands
- Regions: https://myvccbc.com/admin/location/regions
- Provinces: https://myvccbc.com/admin/location/provinces
- Campuses: https://myvccbc.com/admin/location/campuses
- Classrooms: https://myvccbc.com/admin/location/classrooms
- Institutions: https://myvccbc.com/admin/location/institutions

---

## 6. Term and Academic Calendar

```mermaid
flowchart LR
    A[Create / Select Term] --> B[Create / Select Academic Calendar]
    B --> C[Set Start and End Dates]
    C --> D[Use Term in Course Session]
    C --> E[Use Term in Master Schedule]
```

**Links**

- Terms: https://myvccbc.com/admin/program-management/terms
- Academic Calendars: https://myvccbc.com/admin/program-management/calendars

**Verify:** Session dates fit the selected term and the correct term is used when terms overlap.

---

## 7. Course Management — Course, Session and Instructor

**Course list:** https://myvccbc.com/admin/course-management/courses  
**Create course:** https://myvccbc.com/admin/course-management/courses/new

```mermaid
flowchart TD
    A[Create Course Category if missing] --> B[Create Master Course]
    B --> C[Enter Course Code, Name, Credits and Description]
    C --> D[Configure Tuition, Schedule Defaults and Grading]
    D --> E[Save Course]
    E --> F[Open Course Sessions and Offerings]
    F --> G[Create Session / Offering]
    G --> H[Select Campus, Term, Dates and Capacity]
    H --> I[Assign Instructor]
    I --> J[Enable LMS]
    J --> K[Save Session]
    K --> L[Teacher sees assigned section]
```

**Supporting links**

- Categories: https://myvccbc.com/admin/course-management/categories
- Groups: https://myvccbc.com/admin/course-management/groups
- Types: https://myvccbc.com/admin/course-management/types
- Grading Schemes: https://myvccbc.com/admin/course-management/grading
- Textbooks: https://myvccbc.com/admin/course-management/textbooks

**Important:** A master course by itself is not teachable. A dated session/offering with an instructor and LMS enabled is required.

---

## 8. Program Management — Complete Program Flow

**Faculties and Programs:** https://myvccbc.com/admin/program-management/faculties  
**Master Scheduling:** https://myvccbc.com/admin/program-management/scheduling

```mermaid
flowchart TD
    A[Create / Select Academic Faculty] --> B[Create Program]
    B --> C[Complete Program Settings]
    C --> D[Create Program Pathway]
    D --> E[Add Master Courses to Pathway]
    E --> F[Create / Select Term and Calendar]
    F --> G[Create Master Schedule for Program]
    G --> H[Add Course and Session to Schedule]
    H --> I[Assign Instructor, Campus, Dates and Delivery]
    I --> J[Mark Entry Session as Feed-in]
    J --> K[Confirm / Publish Schedule]
    K --> L[Open Student 360]
    L --> M[Program Plan → Plan Overview]
    M --> N[Select Program]
    N --> O[Select Master Schedule]
    O --> P[Select Feed-in Course]
    P --> Q[Select Student Status and Rate Category]
    Q --> R[Choose Feed-in only or Schedule courses]
    R --> S[Choose whether to Post Course Fee]
    S --> T[Save Program Enrolment]
    T --> U[Student is linked to Program and Course Sections]
    U --> V[Courses appear in Student My Courses]
```

### Program creation and assignment steps

1. Open **Faculties & Programs**.
2. Create/select the academic faculty.
3. Create the program and complete Program Settings.
4. Open **Program Pathway**, create a pathway, and add the required master courses.
5. Open **Master Scheduling** and create a Master Schedule for that program.
6. Add the pathway courses as dated sessions.
7. Assign the instructor, campus, term, dates, capacity and delivery method.
8. Mark the first valid entry session as **This is a feed-in course session**.
9. Save/confirm the schedule.
10. Open **Student Management → Browse All Students → select student**.
11. Open **Program Plan → Plan Overview**.
12. Select Program, Schedule, Feed-in Course, Student Status and Rate Category.
13. Choose either **Feed-in course only** or **Feed-in course and the schedule's later courses**.
14. Choose whether course fees should be posted.
15. Select **Save Program Enrolment**.

### Where does Feed-in Course come from?

`Selected Program → Selected Master Schedule → Course Session marked Feed-in → Feed-in Course dropdown`

The dropdown will be empty if the course exists only in Course Management but has not been added to the selected Master Schedule and marked as a feed-in session.

### Status warning

The **Student Status** selected while saving Program Enrolment becomes the student's current Student Management status. Selecting **Graduated**, for example, moves the student from **Approved Application** to the **Graduated** queue.

---

## 9. Student Assignment — Direct Course vs Program

```mermaid
flowchart TD
    A[Student Account] --> B{Required result}
    B -->|One independent course| C[Admin Enrolments]
    C --> D[Select Student and Exact Section]
    D --> E[Optional: Post Course Fee]
    E --> F[Submit Direct Enrolment]
    B -->|Complete structured program| G[Student 360 Program Plan]
    G --> H[Select Program, Schedule and Feed-in]
    H --> I[Save Program Enrolment]
    I --> J[Feed-in and selected later courses are enrolled]
    F --> K[Student My Courses]
    J --> K
```

**Direct enrolment:** https://myvccbc.com/admin/enrolments

Use direct enrolment for a single course. Use Program Plan when the student must follow a formal pathway/master schedule.

---

## 10. Instructor Teaching Flow

**Instructor portal:** https://myvccbc.com/instructor

```mermaid
flowchart TD
    A[Instructor Login] --> B[Open Assigned Section]
    B --> C[Confirm Student in Class List]
    C --> D[Create Topics / Modules]
    D --> E[Add Lessons, Files, URLs, Assignments and Quizzes]
    E --> F[Review and Publish Visible Content]
    F --> G[Student Studies and Submits]
    G --> H[Instructor Reviews Submission]
    H --> I[Enter Feedback and Grade]
    I --> J[Record Attendance]
    J --> K[Publish / Submit Final Marks]
    K --> L[Student Grades, Attendance and Transcript Flow]
```

**Main links**

- Sections: https://myvccbc.com/instructor/sections
- Roster: https://myvccbc.com/instructor/roster
- Attendance: https://myvccbc.com/instructor/attendance
- Assessments: https://myvccbc.com/instructor/assessments
- Submissions: https://myvccbc.com/instructor/submissions
- Gradebook: https://myvccbc.com/instructor/gradebook
- Announcements: https://myvccbc.com/instructor/announcements

---

## 11. Student Learning Flow

**Student portal:** https://myvccbc.com/student

```mermaid
flowchart TD
    A[Student Login] --> B[Open My Courses]
    B --> C[Select Enrolled Course]
    C --> D[Open Published Lesson / Resource]
    D --> E[Complete Activity]
    E --> F[Open Assignment or Quiz]
    F --> G[Submit Text / File / Answers]
    G --> H[Teacher Reviews and Grades]
    H --> I[Student Opens Grades and Feedback]
    I --> J[Check Attendance, Calendar and Progress]
```

**Main links**

- My Courses: https://myvccbc.com/student/courses
- Assignments: https://myvccbc.com/student/assignments
- Assessments: https://myvccbc.com/student/assessments
- Grades: https://myvccbc.com/student/grades
- Attendance: https://myvccbc.com/student/attendance
- Calendar: https://myvccbc.com/student/calendar
- Fees: https://myvccbc.com/student/fees
- Documents: https://myvccbc.com/student/documents
- Messages: https://myvccbc.com/student/messages

---

## 12. AI Draft — Single Lesson Flow

**Link:** https://myvccbc.com/instructor/ai-draft

```mermaid
flowchart LR
    A[Instructor Opens AI Draft] --> B[Select Assigned Section]
    B --> C[Select Topic]
    C --> D[Enter Lesson Title and Settings]
    D --> E[Generate with AI]
    E --> F[Review Lesson, Slides and Quiz]
    F --> G[Add to Topic]
    G --> H[Publish when approved]
    H --> I[Student sees lesson]
```

AI Draft creates one reviewed lesson in the selected section. It does not create a complete program or automatically publish to unrelated sections.

---

## 13. AI Course Builder — Full Self-Paced Course

**Admin entry:** https://myvccbc.com/admin/self-paced/content

```mermaid
flowchart TD
    A[Select Exact LMS Section] --> B[Open AI Builder]
    B --> C[Enter Hours, Modules, Lessons, Quizzes and Assessments]
    C --> D[Generate Blueprint]
    D --> E[Review Outcomes, Modules and Assessment Weights]
    E --> F[Assessment Total = 100%]
    F --> G[Approve and Generate Content]
    G --> H[Preview Every Generated Item]
    H --> I{All items ready?}
    I -->|No| J[Retry / Regenerate Failed Item]
    J --> H
    I -->|Yes| K[Publish to Course]
    K --> L[Student opens generated modules in My Courses]
```

Always enter through the exact section card. Do not copy another section's generated URL or section ID.

---

## 14. Public Self-Paced Catalogue Flow

**Admin catalogue:** https://myvccbc.com/admin/self-paced/catalogue  
**Public catalogue:** https://myvccbc.com/selfpaced

```mermaid
flowchart TD
    A[Admin Creates Reviewable Programme Draft] --> B[Review Title, Pricing and Curriculum Shell]
    B --> C[Publish Programme]
    C --> D[Programme appears in Public Catalogue]
    D --> E[Learner Opens Programme]
    E --> F[Create Account / Sign In]
    F --> G{Free or Paid?}
    G -->|Free| H[Verified Free Enrolment]
    G -->|Paid| I[Stripe Test Checkout]
    I --> J[Payment Success Verification]
    H --> K[Self-Paced Dashboard]
    J --> K
    K --> L[Complete Lessons and Assessments]
    L --> M[Meet Completion Requirements]
    M --> N[Certificate and Verification Link]
```

**Important:** Public Self-Paced is separate from campus `/apply`. Public self-paced registration leads to free/paid enrolment, not an admissions application.

---

## 15. Financial Management Flow

**Select student:** https://myvccbc.com/admin/financial/student

```mermaid
flowchart TD
    A[Course or Program Enrolment] --> B{Post course fee?}
    B -->|Yes| C[Fee / Receivable Created]
    B -->|No| D[No automatic course fee]
    C --> E[Create / View Invoice if required]
    E --> F{Payment source}
    F --> G[Payment]
    F --> H[Available Credit]
    F --> I[Award / Promotion]
    F --> J[Payment Plan]
    G --> K[Allocate to Fee]
    H --> K
    I --> K
    J --> K
    K --> L[Balance Updates]
    L --> M[Student verifies Fees page]
    L --> N[Finance Reports]
```

**Operational links**

- Transactions: https://myvccbc.com/admin/financial/transactions
- Fees: https://myvccbc.com/admin/financial/fees
- Invoices: https://myvccbc.com/admin/financial/invoices
- Credits & Disbursements: https://myvccbc.com/admin/financial/disbursements
- Awards: https://myvccbc.com/admin/financial/awards
- Adjustments: https://myvccbc.com/admin/financial/adjustments
- Payment Plans: https://myvccbc.com/admin/financial/payment-plans
- Unallocated Funds: https://myvccbc.com/admin/financial/unallocated-funds
- Alerts: https://myvccbc.com/admin/financial/alerts

**Message meaning:** “The fee was added, but the student has no available credit to pay it” means the fee was successfully posted but remains unpaid. Do not add the fee again; record or allocate a payment/credit.

---

## 16. Workshop Flow

```mermaid
flowchart TD
    A[Create Workshop Category] --> B[Create Workshop]
    B --> C[Set Date, Location, Capacity and Instructor]
    C --> D[Set Visibility / Availability]
    D --> E[Student sees Available Workshop]
    E --> F{Enrolment method}
    F -->|Admin controlled| G[Admin Enrols Student]
    F -->|Student request/self-enrol| H[Student Enrols / Requests]
    H --> I[Admin Reviews Queue if approval required]
    G --> J[Workshop appears in My Workshops]
    I --> J
    J --> K[Admin / Instructor records Attendance]
    K --> L[Workshop marked Completed]
```

**Links**

- Manage Workshops: https://myvccbc.com/admin/workshops/manage
- Create Workshop: https://myvccbc.com/admin/workshops/manage/new
- Create Category: https://myvccbc.com/admin/workshops/manage/categories/new
- Enrol Student: https://myvccbc.com/admin/workshops/enrol
- Enrolment Queue: https://myvccbc.com/admin/workshops/enrolments
- Attendance: https://myvccbc.com/admin/workshops/attendance
- Student Workshops: https://myvccbc.com/student/workshops

---

## 17. Student Requests Flow

**Student entry:** https://myvccbc.com/student/f/st-16-services

```mermaid
flowchart TD
    A[Student Opens Services] --> B[Select Request Type]
    B --> C[Enter Details and Submit]
    C --> D{Request Queue}
    D --> E[Student Request]
    D --> F[Incident / Dispute]
    D --> G[General Request]
    D --> H[Profile Change]
    D --> I[Email Change]
    E --> J[Admin Assigns and Reviews]
    F --> J
    G --> J
    H --> J
    I --> J
    J --> K[Approve, Decline or Request Information]
    K --> L[Student checks Notifications / Messages]
```

**Admin queues**

- Student Requests: https://myvccbc.com/admin/requests?f.type=Student+Requests
- Incidents / Disputes: https://myvccbc.com/admin/requests?f.type=Incidents+%2F+Disputes
- General Requests: https://myvccbc.com/admin/requests?f.type=General+Requests
- Profile Changes: https://myvccbc.com/admin/requests?f.type=Profile+Changes
- Email Changes: https://myvccbc.com/admin/requests?f.type=E-mail+Changes

Verify the actual destination queue after submission. A profile-originated email update may enter Profile Changes rather than the dedicated Email Changes queue.

---

## 18. Public Apply and Admissions Flow

**Apply:** https://myvccbc.com/apply  
**Admissions Applications:** https://myvccbc.com/admin/ops/admissions/applications

```mermaid
flowchart TD
    A[Applicant Starts Apply] --> B[Create Applicant Account]
    B --> C[Complete Application]
    C --> D[Upload Required Documents]
    D --> E[Submit Application]
    E --> F[Admin Reviews Application and Documents]
    F --> G[Interview]
    G --> H[Offer / LOA]
    H --> I[Applicant Accepts]
    I --> J[Admin Converts Applicant to Student]
    J --> K[Create / Select Course Session]
    K --> L[Direct Course or Program Enrolment]
    L --> M[Student Portal and Finance]
```

`/apply` belongs to Admissions. It is not the public Self-Paced registration flow.

---

## 19. Student Management Flow

```mermaid
flowchart TD
    A[Browse / Search Student] --> B[Open Student 360]
    B --> C[Status and Profile]
    B --> D[Program Plan]
    B --> E[Attendance]
    B --> F[Requirements and Documents]
    B --> G[Grades and Transcript]
    B --> H[Flags, Holds and Alerts]
    B --> I[Student Finance]
    C --> J[Student appears in matching status queue]
    D --> K[Program / Schedule / Course enrolment]
    E --> L[Attendance history]
    G --> M[Academic record]
```

**Links**

- Browse All Students: https://myvccbc.com/admin/student-management/browse
- Student Search: https://myvccbc.com/admin/student-search
- New Inquiry: https://myvccbc.com/admin/student-management/browse?f.status=New+Inquiry

The selected student's generated ID controls the Student 360 URL, so open the profile from Browse/Search rather than inventing a URL.

---

## 20. Reporting Flow

```mermaid
flowchart LR
    A[Create Real Source Records] --> B[Choose Report]
    B --> C[Select Filters and Date Range]
    C --> D[Run Report]
    D --> E[Confirm Expected Student / Course / Finance Record]
    E --> F[Export or Schedule if required]
```

**Links**

- Run Report: https://myvccbc.com/admin/reporting/run
- Templates: https://myvccbc.com/admin/reporting/templates
- Scheduled Reports: https://myvccbc.com/admin/reporting/scheduled

Route availability or sample rows are not proof of a successful report. Confirm that a real record created earlier in the test appears with the correct filters.

---

## 21. System Configuration Flow

```mermaid
flowchart LR
    A[Institution Policy] --> B[Configure Reference Data]
    B --> C[Statuses / Access Levels / Grading / Finance Settings]
    C --> D[Reference Values appear in operational dropdowns]
    D --> E[Operational modules save records using those values]
```

Use System Configuration only when a required status, access level, template, payment method or reference value is missing. Avoid creating duplicate reference records.

---

## 22. Owner Acceptance Test — Serial Order

Use one unique test prefix across every module, for example `OWNER-UAT-20261008`.

| # | Action | Expected connected result |
|---:|---|---|
| 1 | Admin signs in | Admin dashboard opens |
| 2 | Confirm location, term and calendar | Values are available in scheduling forms |
| 3 | Create teacher | Teacher can log in |
| 4 | Create student | Student can log in without a program |
| 5 | Create master course | Course appears in Course Management |
| 6 | Create session and assign teacher | Teacher sees the assigned section |
| 7 | Create program and pathway | Pathway contains the master course |
| 8 | Create Master Schedule | Program schedule exists |
| 9 | Add course session and mark Feed-in | Feed-in becomes available in Student Program Plan |
| 10 | Save Student Program Enrolment | Program/schedule are shown in Student 360 |
| 11 | Verify Student My Courses | Enrolled course is visible |
| 12 | Teacher publishes a lesson | Student can open the same lesson |
| 13 | Teacher publishes an assignment | Student can submit it |
| 14 | Teacher grades submission | Student sees grade and feedback |
| 15 | Teacher records attendance | Student attendance updates |
| 16 | Post one fee | Student balance shows the fee once |
| 17 | Apply payment/credit | Outstanding balance updates correctly |
| 18 | Create and enrol in workshop | Workshop appears for student |
| 19 | Submit each request type | Correct admin queue receives it |
| 20 | Run report | Same test record appears in report |
| 21 | Test AI Draft | Lesson is added only to selected section/topic |
| 22 | Test AI Course Builder | Reviewed content publishes to exact self-paced section |
| 23 | Test public Self-Paced | Verified enrolment leads to learner dashboard, not `/apply` |
| 24 | Logout and test role isolation | Each account sees only its permitted portal and data |

## Completion Rule

The portal flow passes only when the same record can be followed across modules:

`Admin setup → Teacher assignment → Student enrolment → Published learning → Student activity → Teacher grade/attendance → Student finance → Admin report`

A visible page, sample table or successful URL alone is not an end-to-end pass. The action must save successfully and the next role/module must receive the same record.
