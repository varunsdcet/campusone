# MyHeritage Campus OS development roadmap

Status: historical roadmap with current implementation note

Source evidence: `MyHeritage_Campus_OS_Map.pdf`
Repository baseline: 2026-09-15

Current implementation note (2026-10-14): this file preserves the planning baseline; it is not a live gap register. Campus Coach APIs/history, multi-role UI, password reset, session revocation, student assignment files, attendance, content, finance, applicant/employer records, and many listed admin workflows now exist. Use the mounted OpenAPI inventory, `tools/register/register_v2.csv`, current tests, and target-environment E2E evidence to determine present support.

## Product outcome

MyHeritage becomes a trusted campus operating system in which administrators create the institutional structure, instructors deliver learning, students complete their academic journey, applicants progress into enrolment, and employers verify work-integrated learning. Search, notifications, approvals, audit, and the Campus Coach connect those domains without bypassing authorization or human review.

The PDF is product evidence, not an implementation instruction. A route or catalogue screen is not considered complete until its domain model, contract, authorization, audit/event behavior, UI states, and tests are implemented.

## Current baseline

### Implemented domain workflows

- authentication and role-aware login;
- admin user, section, enrolment, and assignment creation;
- instructor gradebook draft and approval-based publication;
- student dashboard, courses, assignments, submission files, schedule, grades, notifications, profile preferences, search, and grade questions;
- shared authorization, institution isolation, approvals, audit events, and outbox events.

### Partial or catalogue-backed surfaces

- instructor attendance, assessments, submissions, announcements, lectures, labs, modules, and AI studio;
- applicant application, documents, requirements, interview, offer, contract, payment, and onboarding;
- employer placements, hours, evaluations, agreements, and organization profile;
- admin admissions, catalogue management, scheduling, finance, practicum, CRM, records, transcripts, analytics, integrations, and AI operations;
- cross-role Ask Heritage was absent at this historical baseline; it is implemented in the current repository and must be evaluated from current contracts/tests.

### Important map/repository differences

- only `/student/ask` existed as a generic portal screen; instructor, admin, applicant, and employer Ask routes were missing;
- the repository had a citation guard but no grounded Coach orchestration or interaction history;
- applicant, employer, attendance, assessment, finance, and credential domain tables were not present;
- password reset was a UI shell without the complete token and delivery lifecycle;
- many admin AI metrics were catalogue data rather than measurements from an operational AI gateway.

## Delivery principles

1. Implement vertical journeys, not isolated screens.
2. Scope every query and write to the authenticated institution and authorized subject.
3. Record every mutation with audit and outbox entries in the same transaction.
4. Require approval for consequential institutional record changes.
5. Keep AI answers grounded in accessible sources; refuse unsupported answers.
6. Never expose draft grades, assessment answers, unrestricted directories, credentials, or government identifiers.
7. Use stable contracts, idempotency, migrations, six UI states, and automated journeys before promoting a capability from scaffolded to implemented.

## Prioritized roadmap

### P0 - Campus Coach foundation

Objective: fulfill the map's shared Ask Heritage journey for all five roles without claiming unsupported model intelligence.

- Add `POST /ai/ask` and `GET /ai/history` contracts.
- Build role-aware, institution-scoped context from live campus records.
- Require citations and refuse unsupported responses.
- Persist each interaction with provider, tier, sources, and status.
- Add idempotency, privacy rejection, rate limiting, audit, and outbox records.
- Deliver one shared Coach UI at student, instructor, admin, applicant, and employer routes.
- Keep the initial action tier read-only; consequential actions remain previews until the action engine phase.

Acceptance: every demo role can ask a supported question, receive a role-appropriate answer with at least one accessible source, reload history, and cannot retrieve another role's or institution's information.

### P0 - Identity and account lifecycle

Objective: make the map's login-to-role-home flow operational beyond seeded accounts.

- password-reset tokens, expiry, single use, and notification delivery;
- MFA enrollment and challenge;
- session management and revocation;
- explicit active-role selection for multi-role accounts;
- security events and recovery tests.

Acceptance: a newly created account can activate, recover access, choose a permitted role, and revoke sessions without administrator intervention.

### P0 - Academic delivery completion

Objective: close the admin -> instructor -> student learning loop.

- attendance sessions and finalization;
- announcements and targeted delivery;
- lecture/module/material publishing;
- assessment definitions, attempts, deadlines, grading, and answer-release policy;
- instructor submission review and feedback;
- student attendance, lecture, lab, module, and assessment views;
- assessment-time Coach restriction.

Acceptance: an instructor can publish learning activity, a student can complete it, and the resulting attendance/submission/grade state propagates without exposing drafts or answer keys.

### P1 - Admissions and applicant journey

Objective: implement application -> documents -> review -> offer -> onboarding.

- application, programme choice, requirements, document checklist, and submission;
- admissions review, interview scheduling, decision, and offer;
- applicant acceptance/decline, conditions, contract, and onboarding handoff;
- duplicate-person detection and approval-controlled conversion to student/account records.

Acceptance: one applicant can complete the journey and become an enrolled student without duplicate identities or manual data re-entry.

### P1 - Practicum and employer journey

Objective: implement placement -> hours -> evaluation -> completion.

- employer organizations, contacts, agreements, sites, and supervisors;
- placement matching and acceptance;
- student hour logs and employer approval;
- evaluation templates and submissions;
- practicum completion and exception approval.

Acceptance: institutions and employers see only their authorized placements, and approved hours/evaluations update the student's practicum record atomically.

### P1 - Student services, advising, and success

Objective: create a closed-loop human support system.

- advising availability, appointments, notes, and student-visible summaries;
- holds and release workflows;
- service requests and approval routing;
- explainable success signals and student-controlled action plans;
- Coach handoff to the correct human queue.

Acceptance: a student can understand a blocker, request help, book support, track resolution, and challenge an automated recommendation.

### P1 - Finance, records, and credentials

Objective: make financial and academic records operational.

- charges, credits, payments, refunds, receipts, and reconciliation;
- immutable transcript snapshots and correction approvals;
- programme completion audit;
- credential issuance and revocation;
- Comprehensive Learner Record and Open Badges export.

Acceptance: student-visible balances and records reconcile to approved transactions, while corrections and credential actions remain fully auditable.

### P2 - Integrations, analytics, and platform operations

- OneRoster and LTI Advantage integration;
- calendar, email, video-class, identity-provider, library, and payment connectors;
- event-based analytics and retention controls;
- AI model/prompt/tool registry backed by real gateway telemetry;
- knowledge-source ingestion, retrieval evaluation, citation-failure review, and cost controls;
- mobile/offline workflows and WCAG 2.2 verification.

## Campus Coach evolution

1. Grounded read-only answers from live role-scoped records.
2. Knowledge retrieval from approved policies and course material.
3. Draft actions such as messages, plans, and service requests.
4. Preview -> confirm -> approve -> execute action engine.
5. Proactive, explainable recommendations with consent and human escalation.

The Coach must never autonomously publish grades, decide admissions, change enrolment, move money, issue credentials, or submit assessments.

## Release gates for every phase

- contracts and register status updated;
- forward-only migration and deterministic seed data;
- authorization and institution-isolation tests;
- happy path, wrong-role, wrong-owner, invalid-data, concurrency, and idempotency coverage;
- audit/outbox verification for writes;
- OpenAPI and `pnpm verify` pass;
- rendered browser journey for each participating role;
- manual QA report with remaining boundaries.
