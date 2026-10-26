# Campus Coach functional specification

Status: implemented read-only/action-preview contract (updated 2026-10-14)

Roles: student, instructor, admin, registrar, applicant, employer

## Purpose

Campus Coach implements the shared Ask CampusOne capability described by the campus OS map. It provides grounded answers from authorized live records, persists account-scoped history, accepts supported text attachments, and keeps consequential actions behind an explicit preview/confirmation workflow.

## Invariants

- Authentication is mandatory.
- Context is derived from session claims; clients cannot select an institution, account, student, instructor, applicant, or employer subject.
- A source must be accessible to the requesting role. Answers without sources are refused.
- Student context contains only the student's record, enrolled sections, own assignments, published grades, eligible schedule, and own notifications.
- Instructor context contains only assigned sections and aggregate class information; no unrestricted directory or unrelated gradebook access.
- Applicant and employer context is limited to their account-scoped portal records until dedicated domain models exist.
- Admin and registrar context may contain institution aggregates, not secrets or raw credentials.
- Questions containing likely government identifiers or credential secrets are rejected before storage.
- Direct answers are `read_only`. Suggested mutations are previews and cannot bypass the destination workflow's authorization, validation, approval, or audit rules.
- Each successful request is idempotent and persists one interaction, audit event, and outbox event in one transaction.
- History is visible only to the originating account within its institution.

## API

### `POST /ai/ask`

Headers:

- `Authorization: Bearer ...`
- `Idempotency-Key: <unique client key>`

Request:

```json
{
  "question": "What should I focus on today?",
  "contextPath": "/student"
}
```

Response:

```json
{
  "interactionId": "uuid",
  "role": "student",
  "tier": "read_only",
  "answer": "...",
  "sources": [
    {
      "id": "assignment:uuid",
      "title": "CS301 - Project 1",
      "uri": "/student/assignments/uuid"
    }
  ],
  "suggestedActions": [
    {
      "label": "Open assignments",
      "href": "/student/assignments"
    }
  ],
  "createdAt": "ISO-8601"
}
```

### `GET /ai/history`

Returns the current account's most recent interactions, newest first. Phase 1 returns at most 20 records.

## Supported Phase 1 intents

- role-aware capability/help summary;
- student priorities, assignments, schedule, courses, grades, and notifications;
- instructor teaching load and class priorities;
- admin/registrar institutional operations and pending approvals;
- applicant next steps from account-scoped portal records;
- employer placement-related next steps from account-scoped portal records.

When a question is outside the available context, the Coach states the limitation and links to the most appropriate existing workflow. It must not fabricate a policy, date, grade, balance, placement, or decision.

## Privacy and abuse controls

- Question length is 1-2,000 characters after trimming.
- Maximum 20 successful interactions per account in a rolling minute.
- Reject likely SIN, SSN, passport-number, password, access-token, or private-key content.
- Do not write rejected prompt content to interaction, audit, or outbox storage.
- Persist the actual provider/model metadata selected by the service. Deterministic fallback responses must identify the fallback provider and must not imply that an external model ran.

## Instructor Teaching Operations Assistant

Instructor Ask Heritage (`faculty_assistant`) is the Teaching Operations Assistant.

It covers six operating lanes: Plan & Prepare, Run the Class, Assess & Grade, Support Students, Communicate, Close & Report.

Phase 1 behaviour:

- Answers are grounded in **authorized sections only**.
- Morning summary / dashboard cards come from live schedule, roster, attendance, draft grades, and mail facts.
- At-risk cues use transparent rules (for example ≥2 absences/lates in 30 days, missing submissions) — not opaque model judgment.
- Write-style prompts (`Mark … absent`, `Send …`) return a **preview** and require the instructor to confirm on the matching screen.
- Page-aware hints apply when `contextPath` is attendance, gradebook, messages, or content.

Do not brand this surface as a “Copilot” in product copy.
