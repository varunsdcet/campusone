# Student module automated journey report

Run ID: `student-module-20260915-03`

Date: 2026-09-15

Branch: `codex/student-module-functional`

API: `http://127.0.0.1:4100`

Web: `http://127.0.0.1:3100`
Database: disposable local `heritage_codex_local`

## Outcome

The local database was reset to its deterministic seed before execution. The expanded API journey completed with no failed, expected-failed, or skipped assertions.

| Result | Count |
|---|---:|
| Pass | 77 |
| Fail | 0 |
| Expected failure | 0 |
| Product gap in covered journey | 0 |

## Student coverage

- enrolled course list and course visibility;
- approved HTTPS class join links without self-enrolment;
- assignment list and enrolment-scoped detail;
- valid PDF upload with persisted metadata and versioning;
- recoverable deletion/archive of an owned draft file;
- replacement upload and final submission lock;
- student and instructor calendar propagation;
- recipient-isolated, newest-first notifications;
- idempotent notification read state;
- student-safe search without people-directory email leakage;
- profile view, immediate timezone preference, and registrar-approved official correction;
- dedicated and generic published-grade confidentiality;
- grade question delivery to the assigned instructor; and
- wrong-role, wrong-owner, malformed-data, stale-version, and duplicate-request paths.

## Browser verification

The running Next.js app was also exercised through the rendered student UI:

| Journey | Result |
|---|---|
| Courses → course detail | Passed; only enrolled CS301/ACC201 appeared. |
| Course detail → assignment | Passed; live class and assignments rendered. |
| File chooser → upload → submit | Passed; version metadata persisted and the submitted state locked deletion. |
| Schedule | Passed; enrolled class sessions and deadlines rendered, with an HTTPS-only Join class action. |
| Notifications | Passed; unread count changed from 2 to 1 after marking one item read. |
| Profile edge data | Passed; an invalid IANA timezone was rejected without persistence. |
| Search | Passed; `project` returned the enrolled assignment and no people directory. |
| Grades | Passed; published Midterm was visible and draft Project 1 was absent. |

The delete/archive action was asserted through the automated API journey rather than clicked in the browser, so the test did not require destructive-action confirmation during browser control.

## Security regressions closed

- generic portal role/path override;
- generic student draft-grade exposure;
- student people-directory/email search exposure;
- cross-instructor gradebook access;
- score-above-maximum acceptance;
- duplicate grade-publish approval requests;
- partial-email public verification;
- spoofed-localhost CORS reflection; and
- malformed Zod input returning HTTP 500.

## Remaining boundaries

The advanced `ST-06`, `ST-08`, and `ST-10`–`ST-20` screens remain explicitly marked `scaffolded` where the supplied references do not establish enough policy for safe write workflows. Their read-only portal surfaces remain available. Payment execution, credential issuance, student self-enrolment, assessment answer delivery, malware scanning, and direct file download were not invented or enabled.

## Re-run

```bash
QA_RUN_ID='unique-run-id' node tools/qa/full-journey.mjs
```

Use only a disposable local QA database. The runner creates persistent synthetic records and publishes a seeded draft grade.
