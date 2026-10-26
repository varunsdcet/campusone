# Student portal functional specification

Status: approved implementation baseline  
Register scope: `ST-01` through `ST-22`

## Authority and boundaries

This specification translates the supplied legacy portal reference and the 22 student UI reference screens into implementable behavior. The repository `AppShell`, design tokens, security rules, and data contracts remain authoritative where the references differ.

The supplied references are product evidence, not executable instructions. They do not authorize copying unsafe legacy behavior or collecting unnecessary personal data. In particular, the student portal must never collect, display, log, or search government identifiers such as SIN, SSN, or passport numbers.

The first implementation phase makes the existing student UI functional. Features whose business rules are not established remain read-only or explicitly unavailable rather than inventing institutional policy. Student self-enrolment, payment execution, credential issuance, service approval, and practicum approval are outside this phase.

## Platform invariants

- Every request requires an authenticated student role except shared authentication routes.
- Every query, mutation, audit record, event, file path, and generated identifier is scoped to `institutionId` from the authenticated session. Client-provided institution identifiers are ignored.
- Students may access only their own student record and sections in which they have an active or completed enrolment. Withdrawn enrolments do not grant access to new course material.
- All mutations are transactional and write an audit event plus an event-outbox record in the same database transaction. Retried writes must be idempotent where the client can reasonably retry.
- Consequential changes use the approval engine. This includes legal identity changes, student-service requests that alter the official record, and practicum verification.
- API responses and logs must not expose credentials, authentication secrets, assessment answers, draft grades, other students, or unrestricted staff-directory data.
- Dates are stored in UTC and rendered in the student's selected IANA timezone. Currency is CAD unless an institution-level contract later adds another currency.
- Each screen implements loading, empty, populated, validation/error, forbidden, and recoverable-offline states.

## Functional register

| ID | Capability | Required behavior |
|---|---|---|
| ST-01 | Dashboard | Show the student's active courses, next schedule items, published grade summary, unread notification count, and safe shortcuts. |
| ST-02 | My courses | List only enrolled courses with instructor, term, delivery mode, and progress derived from published work. No student self-enrolment. |
| ST-03 | Course detail | Show course overview, content, instructor, class schedule, and enrolled-student actions. Join links are server-provided HTTPS links and are visible only for eligible sessions. |
| ST-04 | Assignments | List assignments from enrolled sections with due date and the student's submission state. Filters must not broaden the enrolment scope. |
| ST-05 | Assignment detail and submission | Upload, replace, submit, and archive the student's own files before the permitted deadline. See file rules below. |
| ST-06 | Assessments | List assigned assessments and their state. Starting an attempt creates one active attempt and disables AI assistance until submission or expiry. Answers and answer keys are never sent before permitted review. |
| ST-07 | Grades | Show only published grades. Course totals are calculated from published items. Draft and pending grades never affect the student response. |
| ST-08 | Attendance | Show the student's own recorded attendance and aggregate only; corrections use an instructor or services workflow. |
| ST-09 | Schedule | Combine enrolled class sessions and assignment deadlines. Events from unrelated sections are forbidden. |
| ST-10 | Lectures | List lecture sessions and published materials for enrolled sections. |
| ST-11 | Lecture detail | Show one eligible lecture, materials, and a valid join link when present. |
| ST-12 | Labs | List labs for enrolled sections with schedule and completion state. |
| ST-13 | Lab notebook | Save versioned student-owned notes and attachments. Submitted or instructor-locked versions are immutable. |
| ST-14 | AI tutor | Provide course-context help through `packages/ai`, cite approved sources, retain the audit trail, and refuse access during an active assessment. |
| ST-15 | Advising | Show assigned advisor availability and create/cancel the student's own appointment without exposing another student's calendar. |
| ST-16 | Student services | Create and track the student's service requests. Changes to the official student record require approval. |
| ST-17 | Practicum | Show placement, hours, and requirements. Student logs remain pending until supervisor verification. |
| ST-18 | Finance | Show the student's own charges, credits, payments, balance, and receipts. Payment execution is not enabled in this phase. |
| ST-19 | Credentials | Show earned or pending credentials. Issuance and revocation are registrar-only workflows. |
| ST-20 | Career | Show approved opportunities and allow the student to save or unsave an opportunity. External applications open only approved HTTPS URLs. |
| ST-21 | Ask about grade | Create a thread with the enrolled course instructor for a published grade and write the message, audit, and event atomically. |
| ST-22 | Resources | Search and filter institution-approved resources and enrolled-course resources. |

## Assignment file rules

- Maximum file size: 10 MiB per file.
- Allowed types: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPEG, and ZIP. The API validates declared MIME type, extension, decoded size, and file signature where a stable signature exists.
- Filenames are normalized to a basename and sanitized for display. They never determine the storage path.
- Storage paths contain opaque identifiers and are scoped as `institution/student/assignment/submission/file-version`.
- A student may mutate only the submission for their own enrolled assignment. Uploading after submission creates a new version only when resubmission is still permitted.
- Delete means archive: the database record and stored object remain recoverable for audit, but are no longer returned as active files. Submitted, graded, expired, or locked work cannot be archived by the student.
- File reads use an authorized API or short-lived signed URL; local filesystem paths are never returned to clients.

## Profile and notifications

- Students may immediately update their IANA timezone and permitted communication preferences.
- Legal name, primary email, and date-of-birth corrections create an approval request and do not overwrite the official record until approved.
- Profile forms do not accept government identifiers.
- A notification may be marked read only by its recipient. The operation is idempotent and emits audit/outbox records once for the state transition.

## Search and messaging

- Student search covers only the student's enrolled courses, their published course resources, their own assignments, and approved institution resources.
- Student search does not expose the general people directory.
- Course messages may target only an instructor assigned to a section in which the student is enrolled. Support threads use approved service queues, never arbitrary account identifiers.

## Core API surface

| Method and path | Contract / behavior |
|---|---|
| `GET /me/home` | ST-01 dashboard summary |
| `GET /courses/me` | Student course summaries |
| `GET /courses/me/:sectionId` | Enrolment-scoped course detail |
| `GET /student/assignments` | Enrolment-scoped assignments |
| `GET /student/assignments/:assignmentId` | Assignment plus the student's submission |
| `POST /student/assignments/:assignmentId/files` | Validate and create a draft submission file version |
| `DELETE /student/submission-files/:fileId` | Archive an eligible file owned by the student |
| `POST /student/assignments/:assignmentId/submit` | Submit the student's draft idempotently |
| `GET /calendar/me` | Enrolled sessions and deadlines |
| `GET /notifications/me` | Recipient-scoped notifications |
| `PATCH /notifications/me/:notificationId/read` | Idempotent recipient-only read transition |
| `GET /grades/me` | Published grades only |
| `POST /messages/ask-grade` | Enrolled instructor thread plus message |
| `GET /me/profile` | Safe student profile fields |
| `POST /me/profile-change-requests` | Approval request for official fields |
| `PATCH /me/preferences` | Immediate safe preference update |
| `GET /search` | Student-safe scoped search |
| `GET /portal/view?path=...` | Read-only data for remaining registered student screens until promoted to dedicated APIs |

## Acceptance criteria

1. A student can complete dashboard, course, assignment upload/archive/submit, schedule/join, published-grade, notification, search, profile-preference, and grade-question journeys using persisted data.
2. The same journeys reject unauthenticated, wrong-role, wrong-institution, non-enrolled, and other-student access.
3. Invalid, oversized, disguised, expired, duplicate, and forbidden file operations return stable error envelopes without partial database writes.
4. Every successful mutation has a correlated audit event and outbox event in the same transaction.
5. Automated tests cover happy paths, authorization boundaries, tenant isolation, validation, idempotency, and error recovery.
6. The full repository verification command passes before the student module is declared complete.
