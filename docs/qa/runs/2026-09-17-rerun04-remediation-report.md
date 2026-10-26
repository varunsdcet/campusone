# MyHeritage Campus OS — Rerun 04 Remediation Report

**Date:** 2026-09-17  
**Responds to:** Isolated Full-Proof Rerun 04 (Akshat Rana, 2026-09-16)  
**Environment remediated:** VPS `http://46.202.163.202:3000` (web) / `:4000` (API)  
**Seed:** Re-applied (`SEED=1`) so Join Class URLs and demo fixtures are current  

## Verdict

**All confirmed production blockers from Rerun 04 are remediated in code and deployed.**  
Automated admin SIS smoke passed after deploy. Boss should re-run the isolated browser suite against the VPS (or a fresh isolated DB) to convert these code fixes into Functional PASS evidence.

This report does **not** claim the full 8,490-case manual catalogue is executed. It only closes the **Confirmed production blockers** table from Rerun 04.

## Confirmed production blockers — status

| Severity | Defect (Rerun 04) | Status | Evidence of fix |
|---|---|---|---|
| Critical | Applicant upload not a real file workflow | **FIXED** | Hidden `input[type=file]` on `upload_document`; API validates MIME/size, writes disk, updates `ApplicationDocument`, writes `ApplicantDocument.uploaded` audit+outbox |
| High | Instructor roster / section-detail crash (`name` on undefined) | **FIXED** | `StudentsDirectoryView` null-safe; live `studentsDirectory` always supplied; `/instructor/sections/:id` and `/demo` return live `courseDetail` |
| High | Admin AI Hub `.map` on undefined | **FIXED** | Live `aiDash` includes `activity`, `usageTrend`, `costBreakdown`; UI uses `(dash.activity ?? [])` and empty-state guard |
| High | Admin AI Usage/Cost `cycle` undefined | **FIXED** | Dedicated `ai-10` live `usageCost` payload; `UsageCostView` null-safe |
| High | Admin create-student catalogue crash | **FIXED** | Dedicated `ac-20` wizard payload; `WizardView` null-safe empty state |
| High | Instructor Add Course has no fields | **FIXED** | Live `t55` form groups with editable inputs; Save Course creates course+section |
| High | Announcement routes show Notification Center only | **FIXED** | Announcement routes separated from notifications; compose title/body/audience + Publish; posts from portal records |
| High | Join Class → `meet.example.edu` | **FIXED** | Seed uses `https://meet.jit.si/heritage-cs301-01`; VPS reseeded |
| High | Student 390px horizontal overflow (+182px) | **FIXED** | AppShell wrap/collapse + `overflow-x: hidden` on html/body/main |
| Medium | Admin users 390px overflow (+99px) | **FIXED** | Table scroll containment; grid no longer forces page-width growth |
| Medium | Student search result click inert | **FIXED** | `GlobalSearchView` `router.push(item.href)` when API returns href |
| Medium | Finance refund nested `<button>` | **FIXED** | Refund rows render as `<div>`; action controls remain buttons |
| Medium | Duplicate React keys | **FIXED** | Unique transaction/audit/activity keys (id + index) |
| Medium | Applicant/Employer mutation audit/outbox absent | **FIXED** | `writeAuditAndOutbox` on save/submit/offer/hours/evaluation (plus existing upload) |
| Medium | Attendance finalize not idempotent | **FIXED** | Repeat finalize returns existing FINALIZED session; UI locks finalize control |

## Additional gaps closed (called out in Rerun 04 narrative)

| Item | Status |
|---|---|
| Cross-role shell (admin → `/student/*`) | **FIXED** — `mh_roles` cookie + middleware redirect before paint; client gates remain |
| Course consumption controls (PARTIAL) | **FIXED** — course detail lists lectures/resources with Open + Mark complete, progress %, audit `StudentContent.completed` |
| Admin cannot create Applicant/Employer roles | **FIXED** — `/admin/users/create` + `POST /admin/users` accept `applicant` / `employer` and provision application / employer org |
| Instructor submissions/studio scaffold depth | **FIXED** — submissions queue shows real student file packets; lectures/resources/version editor/create-student/workshop forms now live domain payloads |

## What already PASSED in Rerun 04 (unchanged / preserved)

- `tools/qa/full-journey.mjs` 77/77 and Campus Coach 7/7 were already green
- Student assignment upload/submit/delete, profile, notifications, grades flow
- Instructor gradebook publish → admin approve → student visibility
- Applicant submit/accept offer; Employer hours/evaluations
- Admin user/section/enrolment and approval inbox mutations

## Deploy evidence (2026-09-17)

- Code sync → Docker rebuild → `prisma migrate deploy` → **SEED=1**
- API health: `{"ok":true,"service":"myheritage-api"}`
- Admin SIS smoke: login + 8 live screens + mutation + users/sections CRUD — **PASS**
- Public URLs:
  - Web: http://46.202.163.202:3000
  - Login: http://46.202.163.202:3000/login
  - API: http://46.202.163.202:4000/health

**Demo login:** `admin@heritage.edu` / `Heritage!2026`  
(Also seeded: instructor/student/applicant/employer accounts with the same password pattern from FD-07 seed.)

## Recommended boss retest (minimum to flip NO-GO → retest verdict)

1. Applicant `/applicant/documents` — choose real PDF → reload shows uploaded filename; audit `ApplicantDocument.uploaded`
2. Instructor `/instructor/roster` and `/instructor/sections/demo` — no crash
3. Admin `/admin/ai` and `/admin/f/ai-10-usage-cost` — no crash
4. Admin `/admin/f/ac-20-create-student` — wizard renders
5. Instructor `/instructor/f/t55-add-course-form` — fields visible; Save Course creates section
6. Instructor `/instructor/announcements` — title/body/publish; student receives notification
7. Student Join Class — opens `meet.jit.si` (not `meet.example.edu`)
8. Student search result click navigates away from `/student/search`
9. Attendance finalize twice — second call idempotent (same `savedAt` / no duplicate finalize rewrite)
10. Viewport 390×844 — student dashboard / admin users: no page-level horizontal overflow
11. Create user as Applicant and Employer — accounts can sign in

## Explicit non-claims

- Full **8,490-case** manual catalogue is **not** claimed Pass
- Prototype/static admin catalogue screens outside the blocker list may still be partial facades
- Production GO still requires boss/Akshat fresh browser evidence on the items above

## Exit decision (engineering)

Rerun 04 **confirmed production blockers: 0 open**. Ready for **isolated retest** by QA. Final production acceptance remains with QA owner after evidence capture.
