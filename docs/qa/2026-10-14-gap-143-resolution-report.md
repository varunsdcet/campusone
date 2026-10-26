# Heritage 143-Gap Resolution Report

Date: 2026-10-14

Scope: the original `GAP-001` through `GAP-143` audit inventory. Status records source remediation coverage; production deployment/readback evidence is stated separately below and is not a substitute for a 143-flow browser acceptance run.

## Executive result

| Status | Count | Meaning |
|---|---:|---|
| Code-fixed | 135 | A concrete implementation/remediation exists in the current workspace. |
| Partial | 7 | Material protection exists, but the original gap is not fully closed. |
| Excluded | 1 | Explicitly removed from scope by the product owner. |
| Open | 0 | No wholly untouched item remains in this workspace review. |
| **Total** | **143** | Full source inventory accounted for. |

`GAP-038` (Stripe webhook) is **Excluded** by explicit instruction. It is not counted as fixed.

## Verification boundary

- API tests: 77 files / 413 tests passed after the final campus-scope hardening.
- Web tests: 15 files / 56 tests passed.
- Workspace typecheck and API, workers, and web production builds passed.
- The final campus queue/count hardening passed API tests and TypeScript validation.
- External providers, browser/device behavior, authenticated role/campus workflows, and a full backup restore drill remain outside automated verification.

## Production deployment result

Deployment target: `/opt/myheritage` on the production VPS, 2026-10-14.

- A pre-deploy PostgreSQL/source/uploads backup was created at `/opt/backups/heritage/20261014T080033Z`; all three checksum validations passed. A restore drill was not performed.
- API, web, workers, PostgreSQL and backup containers are running. API/web/workers/PostgreSQL reported zero container restarts after the final recreate.
- All 31 Prisma migrations applied successfully and `prisma migrate status` reported the schema up to date.
- Legacy duplicate section codes were normalized without deleting or merging any section; the post-migration duplicate group count is zero. Future section-code allocation checks the institution/term scope.
- VPS readback: API health passed, web root returned HTTP 200, web API-health proxy returned HTTP 200, and an unauthenticated protected API returned HTTP 401.
- Production commands use compiled JavaScript (`node dist/main.js` for API and the standalone Next.js server for web), not `tsx`.
- **Operational blocker:** production has MFA enabled but no verified MFA challenge provider. The deployed fail-closed behavior returns `MFA_CHALLENGE_UNAVAILABLE` (HTTP 503) after a valid password, so authenticated smoke testing cannot proceed until TOTP/e-mail OTP/IdP is configured or the product owner explicitly authorizes temporarily disabling MFA.
- The production backup is currently local to the VPS. This is why GAP-138 remains Partial even though backup generation and checksum validation passed.

## Item-by-item register

| Gap | Status | Resolution / evidence area |
|---|---|---|
| GAP-001 | Code-fixed | Reset tokens are not exposed in normal responses; auth regression coverage. |
| GAP-002 | Code-fixed | Shared rate limiter covers login, forgot/reset password, and self-paced registration. |
| GAP-003 | Partial | MFA now fails closed so password-only bypass is impossible, but no enrolled OTP/TOTP challenge provider exists yet. |
| GAP-004 | Code-fixed | Production rejects missing, default, or short JWT secrets at startup/use. |
| GAP-005 | Code-fixed | Instructor mutations are constrained to instructor-owned/master-authorized resources; boundary tests added. |
| GAP-006 | Code-fixed | Instructor-created accounts use invitation/reset onboarding instead of a shared password. |
| GAP-007 | Code-fixed | AI intervention tools enforce instructor-to-section/student ownership. |
| GAP-008 | Code-fixed | Certificate issuance requires an eligible self-paced enrolment/payment/completion state. |
| GAP-009 | Code-fixed | Client-supplied checkout identity verification was removed; server-owned registration state is used. |
| GAP-010 | Code-fixed | Third-party AI/mail relay is no longer an implicit default. |
| GAP-011 | Code-fixed | Campus scope is applied to student reads, global queues, decisions, grade approvals, and sidebar counts. |
| GAP-012 | Code-fixed | Narration and AI-draft proxy routes require authenticated server-route authorization and limits. |
| GAP-013 | Code-fixed | Assessment-open policy is derived/enforced server-side for Study Coach. |
| GAP-014 | Code-fixed | Thread participants no longer receive Bcc identities unless authorized. |
| GAP-015 | Code-fixed | Mail recipient choices are limited to valid relationships/scope. |
| GAP-016 | Code-fixed | Live/compliance joins require section enrolment or staff assignment. |
| GAP-017 | Code-fixed | Practicum records use stable student identity; display-name claiming is removed. |
| GAP-018 | Code-fixed | Paused status is rechecked from the database for authenticated API requests. |
| GAP-019 | Code-fixed | Own-password change requires the current password and writes auth audit/outbox events. |
| GAP-020 | Code-fixed | Browser bearer token storage was removed; signed HttpOnly portal cookies are verified by middleware. |
| GAP-021 | Code-fixed | Generic global/profile screens resolve explicit permission gates. |
| GAP-022 | Code-fixed | Schedule accept/decline requires course-management edit permission. |
| GAP-023 | Code-fixed | Non-section instructor actions now have explicit master/resource authorization. |
| GAP-024 | Code-fixed | Approval decisions use consistent permission and maker-checker handling. |
| GAP-025 | Code-fixed | Scheduled/run-now reports revalidate owner, permission, template, and audience. |
| GAP-026 | Code-fixed | Applicant interview transition validates current lifecycle state. |
| GAP-027 | Code-fixed | Production CORS uses configured origins; wildcard/IP blanket trust removed. |
| GAP-028 | Code-fixed | Location/sysconfig uploads use content sniffing, not declared MIME alone. |
| GAP-029 | Code-fixed | Sensitive configuration values are encrypted/masked through the configuration secret helper. |
| GAP-030 | Code-fixed | Development and production Compose now require an explicit PostgreSQL password. |
| GAP-031 | Code-fixed | Admin AI fact blocks are selected by question/capability instead of always sending all blocks. |
| GAP-032 | Code-fixed | User Login lookup can be institution-qualified and rejects ambiguity. |
| GAP-033 | Code-fixed | Session revocation is checked live rather than through a 15-second replica cache. |
| GAP-034 | Code-fixed | Registration returns a generic response for existing and new e-mail addresses. |
| GAP-035 | Code-fixed | AI markdown rendering uses a structured safe renderer/sanitizer. |
| GAP-036 | Code-fixed | Input policy no longer rejects legitimate nine-digit academic/phone values as secrets. |
| GAP-037 | Code-fixed | Student finance/record API routes enforce the same access policy as navigation. |
| GAP-038 | Excluded | Stripe webhook intentionally deferred by product-owner instruction. |
| GAP-039 | Code-fixed | Period-open checks cover all identified finance posting/allocation/status paths. |
| GAP-040 | Code-fixed | Generic finance actions require financial permission and validated typed payloads. |
| GAP-041 | Code-fixed | Direct write-off paths route through controlled adjustment/approval behavior. |
| GAP-042 | Code-fixed | Payment/credit reversal deallocates linked allocations before reversal. |
| GAP-043 | Code-fixed | Student 360 invoice/payment behavior is aligned with the central ledger. |
| GAP-044 | Code-fixed | T2202 generation uses the consolidated eligible-paid tuition calculation and lifecycle. |
| GAP-045 | Code-fixed | Grade publication paths share approval/idempotency rules. |
| GAP-046 | Code-fixed | Employer hour approval requires the exact existing pending entry; fabrication removed. |
| GAP-047 | Code-fixed | Student money operations use a PostgreSQL advisory transaction lock across replicas. |
| GAP-048 | Code-fixed | Credit notes produce controlled ledger effects rather than invoice-total-only edits. |
| GAP-049 | Code-fixed | Adjustments validate ledger ownership, kind, status, and pending duplicates. |
| GAP-050 | Code-fixed | Finance amount storage migrated from Float to Decimal(14,2). |
| GAP-051 | Code-fixed | Identified GET paths no longer create sequence/alert/master/receipt state. |
| GAP-052 | Code-fixed | Generic live-row patches route into the real domain mutation/read model. |
| GAP-053 | Code-fixed | Lifecycle/access assignments and history have normalized relational models and rollout migration. |
| GAP-054 | Code-fixed | Identified uniqueness rules have database constraints/migration coverage. |
| GAP-055 | Code-fixed | Plan generation requires real program requirements and preserves/reconciles active work. |
| GAP-056 | Code-fixed | Pending approval proposals cannot be silently rewritten before decision. |
| GAP-057 | Code-fixed | Legacy applicant creation uses configured intake/numbering/rate/program behavior. |
| GAP-058 | Partial | Composite tenant foreign keys were added for targeted relations, but PostgreSQL RLS is not enabled across the full schema. |
| GAP-059 | Code-fixed | Employer deletion is restricted when placements/hours/evaluations exist. |
| GAP-060 | Code-fixed | Plan deletion reverses/removes its setup-fee effect safely. |
| GAP-061 | Code-fixed | Campus deletion checks/cascades all identified dependent location records. |
| GAP-062 | Code-fixed | Applicant upload is blocked after terminal/submitted lifecycle states. |
| GAP-063 | Code-fixed | Required-task completion enforces a valid pending state and idempotency. |
| GAP-064 | Code-fixed | Workshop capacity enrolment is transactionally locked/claimed to prevent overbooking. |
| GAP-065 | Code-fixed | Student-number allocation retries unique collisions. |
| GAP-066 | Code-fixed | Grade publish uses a stable operation/idempotency key rather than `Date.now()`. |
| GAP-067 | Code-fixed | Graduation service validates academic/finance clearance, transitions status, audits, and issues credentials. |
| GAP-068 | Code-fixed | Approved withdrawal applies enrolment and related domain effects. |
| GAP-069 | Code-fixed | Seat release/capacity changes promote waitlisted enrolments in order. |
| GAP-070 | Code-fixed | Enrolment validates prerequisites and corequisites. |
| GAP-071 | Code-fixed | Drop/withdraw reviews or reverses linked course-fee effects. |
| GAP-072 | Code-fixed | Published grade correction has a controlled correction/approval workflow. |
| GAP-073 | Code-fixed | Completed-course grades remain visible in student and gradebook views. |
| GAP-074 | Code-fixed | Primary and additional faculty share gradebook/search/course access. |
| GAP-075 | Code-fixed | Assessment questions, answers, score, and maximum score persist. |
| GAP-076 | Code-fixed | Active student course UI invokes the completion API and advances progress. |
| GAP-077 | Code-fixed | Compliance explanations require staff review and transactional audit/outbox effects. |
| GAP-078 | Code-fixed | Compliance notification dedupe keys prevent repeated sweep spam. |
| GAP-079 | Code-fixed | Request approvals respect required approval count and separate apply effects. |
| GAP-080 | Code-fixed | Applicant conversion is transactional and creates configured academic/finance placement. |
| GAP-081 | Code-fixed | Configured notification templates are dispatched from outbox event mappings. |
| GAP-082 | Code-fixed | Instructor messages require a valid explicit thread; recent-thread fallback removed. |
| GAP-083 | Code-fixed | Active holds are checked in enrolment/request/transcript/finance entry points. |
| GAP-084 | Partial | Admin curriculum maintenance now covers degree requirements/prerequisites and related structures, but all 13 seed-only models are not yet proven editable end-to-end. |
| GAP-085 | Code-fixed | Retake enrolment produces configured fee and notification effects. |
| GAP-086 | Code-fixed | Submission return, extension, late state/penalty, and student unsubmit flows were added. |
| GAP-087 | Code-fixed | Students can cancel eligible service, LOA, and workshop requests. |
| GAP-088 | Code-fixed | Advising date/time is user-selectable and confirmed. |
| GAP-089 | Code-fixed | Degree scenarios have submit/review/approve/reject paths. |
| GAP-090 | Code-fixed | Live presence heartbeat runs only for student attendees. |
| GAP-091 | Code-fixed | Degree failed state uses authoritative course/grade history, not plan-only inference. |
| GAP-092 | Code-fixed | Section fees resolve/require a covering financial term for reporting. |
| GAP-093 | Code-fixed | Unassigned workshops are not implicitly visible/editable to every instructor. |
| GAP-094 | Partial | Session duration, keep-login choice, IP/CIDR allow-list, password complexity, and MFA fail-closed are enforced; password expiry/history and a real MFA challenge remain. |
| GAP-095 | Code-fixed | Student-status flags drive number/login/admission/registration/plan behavior. |
| GAP-096 | Partial | Core attempts, prerequisite, fee, hold, seat and waitlist rules are enforced; the entire configurable per-day/per-term/tier/penalty matrix is not proven end-to-end. |
| GAP-097 | Code-fixed | Saved grading schemes now drive letter conversion consistently. |
| GAP-098 | Code-fixed | Session generation observes configured holidays and schedule-adjust behavior. |
| GAP-099 | Code-fixed | AI governance reports effective policies/models rather than static always-true values. |
| GAP-100 | Code-fixed | Self-paced admin APIs enforce access level, not role alone. |
| GAP-101 | Code-fixed | `emailMessaging` permission is enforced by mail and student communication routes. |
| GAP-102 | Code-fixed | Content-block student/page access settings are enforced in dashboard delivery. |
| GAP-103 | Partial | Regional rates, down payment, and promotion application exist; every automated/pro-rated recurring-payment combination is not integration-proven. |
| GAP-104 | Code-fixed | Edit course settings updates the target course and cannot enter create-course dispatch. |
| GAP-105 | Code-fixed | Schedule Lecture creates a class session, not an assignment/grade items. |
| GAP-106 | Code-fixed | Add Course Group/Type have distinct forms and mutations. |
| GAP-107 | Code-fixed | Program/version Save Draft routes to the correct draft handlers. |
| GAP-108 | Code-fixed | Announcement fields map to title/body correctly. |
| GAP-109 | Code-fixed | SIS actions use stable action IDs and return appropriate HTTP failures. |
| GAP-110 | Code-fixed | ST-05 consumes the API `assignments` shape and opens detail correctly. |
| GAP-111 | Code-fixed | Lite pickers load independently and tolerate unauthorized optional catalogues. |
| GAP-112 | Code-fixed | Assessment Manager renders the live assessment payload. |
| GAP-113 | Code-fixed | Navigation targets, duplicates, redirects, live counts, mounted groups, and search entries were normalized and regression-tested. |
| GAP-114 | Code-fixed | Create/edit/delete navigation is hidden for view-only access levels. |
| GAP-115 | Code-fixed | Mobile instructor grades aggregates every assigned section. |
| GAP-116 | Code-fixed | Profile change requests cannot overwrite the official primary e-mail from prefill. |
| GAP-117 | Code-fixed | Mail Policy has navigation and GET no longer creates state. |
| GAP-118 | Code-fixed | Identified acknowledge-only instructor buttons now invoke domain mutations/exports. |
| GAP-119 | Code-fixed | AI generation tools call configured generation services and validate structured output instead of fixed templates. |
| GAP-120 | Code-fixed | Identified SourceNotice stubs have live handlers and persisted effects. |
| GAP-121 | Code-fixed | Listed student buttons/actions have handlers or are removed/disabled with explicit state. |
| GAP-122 | Code-fixed | Help, accessibility, offline, and denied pages have distinct purpose-specific content. |
| GAP-123 | Code-fixed | Admin header search uses live navigation/entities rather than sample hits. |
| GAP-124 | Code-fixed | Identified enrolment/domain mutations write audit and outbox atomically. |
| GAP-125 | Code-fixed | Failed login, reset, and change-password audit events were added. |
| GAP-126 | Code-fixed | Self-paced enrolment writes audit and finance/payment evidence. |
| GAP-127 | Code-fixed | Quiz/choice, compliance, and required-task mutations are transactionally audited. |
| GAP-128 | Code-fixed | Failed as well as successful AI attempts create interaction/audit records. |
| GAP-129 | Code-fixed | Only explicitly passing grades earn credit; I/IP/W/dash do not pass. |
| GAP-130 | Code-fixed | Weighted course total uses the shared grade calculation. |
| GAP-131 | Code-fixed | Projected completion uses real term dates/load rather than hard-coded labels. |
| GAP-132 | Code-fixed | Student statements use the same configured tax calculation as finance fees. |
| GAP-133 | Code-fixed | Lecture/session times render using the student's saved timezone. |
| GAP-134 | Code-fixed | Admissions lifecycle mapping is consolidated in shared contracts/service logic. |
| GAP-135 | Code-fixed | Destructive seed requires explicit acknowledgement and refuses normal production execution. |
| GAP-136 | Code-fixed | Outbox uses atomic claim, stale-claim recovery, capped attempts, backoff, and failed/dead-letter status. |
| GAP-137 | Code-fixed | API schedulers run only on the explicitly designated scheduler replica; production Compose designates one API service. |
| GAP-138 | Partial | Checksummed daily DB/file backup with retention exists, but storage is still a local volume unless `BACKUP_ROOT` is mounted off-host; no native S3 adapter. |
| GAP-139 | Code-fixed | XTTS requires explicit licence acceptance and opt-in profile/configuration. |
| GAP-140 | Code-fixed | Production API/workers compile and run JavaScript with Node, not `tsx`. |
| GAP-141 | Code-fixed | The documented register CSV exists and documentation points to the real source. |
| GAP-142 | Code-fixed | OpenAPI inventory is generated/checked for Express routes, including admin and auxiliary modules. |
| GAP-143 | Code-fixed | Login/flow, manual QA, roadmap, and Campus Coach documents were refreshed. |

## Remaining closure work

1. GAP-003/GAP-094: choose and configure MFA delivery (TOTP, e-mail OTP, or IdP), then add challenge/recovery and password-history/expiry persistence.
2. GAP-058: decide whether full PostgreSQL RLS is required; current service predicates plus targeted composite FKs remain the boundary.
3. GAP-084: execute an admin CRUD matrix for all 13 formerly seed-only academic models.
4. GAP-096/GAP-103: approve the complete rule matrix, then run cross-rule finance/enrolment scenarios.
5. GAP-138: mount `BACKUP_ROOT` to off-host storage or add an S3-compatible object adapter and perform a restore drill.

## Deployment checklist

1. Back up PostgreSQL and the upload/object volume.
2. Set required secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `PORTAL_COOKIE_SECRET`) and leave XTTS disabled unless its licence is accepted.
3. Apply Prisma migrations, including Decimal finance and integrity/normalization migrations.
4. Deploy API, workers, and web builds.
5. Run authenticated role/campus smoke tests, finance posting checks, migration readbacks, and backup restore verification.

