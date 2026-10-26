# Campus Coach implementation report

Run ID: `campus-coach-20260915-02`

Date: 2026-09-15

Branch: `codex/campus-coach-foundation`

## Outcome

The first Campus Coach vertical slice is operational for student, instructor, admin, applicant, and employer accounts. The implementation fulfills the campus map's missing shared `POST /ai/ask` journey with deterministic, role-grounded answers rather than presenting catalogue data as external-model output.

## Implemented

- `POST /ai/ask` with authenticated role/context validation;
- `GET /ai/history` scoped to the current institution and account;
- live student assignments, classes, courses, published grades, profile, and notifications;
- live instructor sections, enrolment aggregates, assignments, and draft-grade count;
- live admin/registrar institutional aggregates and pending approvals;
- account-scoped applicant and employer portal records;
- source-required answers and internal source links;
- idempotent interaction creation;
- persistent `AiInteraction` history;
- audit and outbox writes in the same transaction;
- rolling per-account request limit;
- rejection of likely government identifiers and credential secrets before storage;
- five dedicated responsive Coach routes and shared UI;
- seeded applicant and employer identities declared by the campus map.

## Verification

| Check | Result |
|---|---:|
| Full `pnpm verify` | Passed |
| Production Next.js build | Passed; 386 pages generated |
| OpenAPI validation | Passed; 25 paths |
| Focused Coach journey | 7/7 passed |
| API unit/integration suite | 12/12 passed |
| Contracts tests | 8/8 passed |
| AI gateway tests | 3/3 passed |
| Rendered student Coach journey | Passed |

The five-role journey verifies grounded citations, persistent history, idempotent replay, student-to-admin context denial, and credential-secret rejection.

## Current boundary

Phase 1 uses provider label `campus_grounding_v1` and deterministic synthesis from authorized live records. It does not call an external language model, ingest documents, execute tools, or perform consequential actions. Applicant and employer grounding remains portal-record based until their dedicated domain phases are implemented. Assessment-time Coach blocking remains a release gate for the assessment domain.
