# Browser Defect Remediation Report — 2026-09-17

## Decision

**Remediation of Malik/Akshat LIVE-DEF / BQA Critical and High browser defects is implemented in the working tree.**

Registered Critical/High browser blockers from the 2026-09-16 NO-GO runs were fixed locally. Full production launch remains gated by unregistered institution onboarding and scaffolded catalogue areas (unchanged governance blockers from `docs/qa/gaps-and-blockers.md`).

## Scope

- Branch worktree: local `heritage` (Malik remote `codex/integrate-authoritative-update` was identical to prior HEAD — remediations were never pushed; fixes applied here)
- Fixes target deployed/browser findings: LIVE-DEF-001…025 and BQA-001…005 where product code exists
- No deploy/push in this pass

## Defect closure matrix

| ID | Severity | Status | Fix |
|---|---|---|---|
| LIVE-DEF-001 / BQA-001 | Critical | **FIXED** | Role portal guards: `ScreenScaffold` denies wrong role; `AdminSisScreen` / admin home / `TeacherSisScreen` redirect without rendering foreign shell |
| LIVE-DEF-002 | Critical | **FIXED** | Same role boundary — non-students cannot keep `/student` shell |
| LIVE-DEF-003 | Critical | **FIXED** | Admin no longer opens instructor/student personal shells |
| LIVE-DEF-016 / BQA-002 | Critical | **FIXED** | Applicant upload requires real file chooser + validated bytes, disk storage, real filename, audit |
| LIVE-DEF-008 | Medium | Deferred | Login validation polish not in this pass |
| LIVE-DEF-009 | High | **FIXED** | Create-section form defaults emptied (no CS401 seed race) |
| LIVE-DEF-010 | Medium | **FIXED** | Instructor notifications title → `Notifications` |
| LIVE-DEF-011 | High | **FIXED** | Instructor Ask → `/instructor/ask` (Teacher shells + AppShell) |
| LIVE-DEF-012 / 014 / 017 | High | **FIXED** | Bell → Notifications routes for student/applicant/employer/admin/instructor |
| LIVE-DEF-013 / 015 / 018 | Medium | **FIXED** | Avatar → Profile routes (applicant/employer profile destinations) |
| LIVE-DEF-019 | High | **FIXED** | AppShell responsive header: wrap, collapse nav, shrink search |
| LIVE-DEF-020 | High | **FIXED** | Seed Join Class URL → `https://meet.jit.si/heritage-cs301-01` (resolvable HTTPS) |
| LIVE-DEF-021 | High | Partial | Section delete UI still absent (governance/CRUD gap); hydration create race fixed |
| LIVE-DEF-022 | High | **FIXED** | Attendance re-finalize idempotent; UI disables finalize when already FINALIZED |
| LIVE-DEF-023 | High | **FIXED** | Approvals Inbox: Approve / Reject / Apply via `decideApproval` / `applyApproval` |
| LIVE-DEF-024 | High | **FIXED** | `/instructor/submissions` → pending-grades live gradebook payload |
| LIVE-DEF-025 / BQA-003 | High | **FIXED** | Notifications payload includes filters/`unread`; views defensive; course/students/timetable/workshops/fileManager shapes aligned |
| BQA-004 | High | Partial | Instructor/admin undefined-map crashes hardened where mapped; remaining admin AI/compliance scaffolds still need empty-state fixtures |
| BQA-005 | High | N/A on deployed | Student search result navigation already PASS on live run |
| BQA-006 | Medium | Deferred | Duplicate React keys cleanup not in this pass |

## Key files changed

- `apps/web/src/components/ScreenScaffold.tsx` — role gate + Notifications/Profile nav
- `apps/web/src/components/AdminSisScreen.tsx` / `apps/web/src/app/admin/page.tsx` — admin-only gate
- `apps/web/src/components/TeacherSisScreen.tsx` / Teacher shells — instructor-only + crash guards + attendance lock
- `packages/ui/src/index.tsx` — bell/avatar wiring + responsive header
- `apps/web/src/lib/nav.ts` — Notifications/Profile destinations
- `apps/api/src/modules/applicant/applicant.service.ts` — real upload pipeline
- `apps/web/src/components/LiveScreen.tsx` — file input for upload actions
- `apps/api/src/modules/admin/sis.service.ts` — approval decide/apply
- `apps/api/src/modules/instructor/instructor.service.ts` — live payload shapes + attendance idempotency
- `packages/db/src/seed.ts` — Join Class URL
- `apps/web/src/app/admin/sections/create/page.tsx` — empty form defaults
- New: `/applicant/notifications`, `/employer/notifications`

## Verification

| Check | Result |
|---|---|
| `tsc` apps/web | PASS |
| `tsc` packages/ui | PASS |
| `tsc` apps/api | Pre-existing errors in `grades.router.ts` / `me.router.ts` (`requireApproval` typings) — not introduced by these edits |
| Browser re-run of full action map | **NOT RUN** in this pass — required on local + deployed after rebuild |
| VPS deploy | **NOT DONE** — awaiting explicit push/deploy request |

## Remaining intentional NO-GO items (governance / out of browser-defect scope)

1. Institution / founding-admin self-service onboarding not registered
2. Broad admin CRUD (section delete/archive, user edit) still incomplete
3. Applicant/employer modules remain partially prototype-scoped for production claims
4. Non-functional SLOs (malware scan, backup/restore, browser matrix) undefined
5. LIVE-DEF-008 login validation polish
6. BQA-006 duplicate React keys
7. Admin AI/compliance empty-state fixtures beyond crash hardening

## Recommended next step

1. Rebuild web + API locally and re-run `docs/qa/browser-action-map.csv` against Critical/High rows
2. Re-seed or update Join Class for existing DBs (`meet.example.edu` rows need SQL/seed refresh)
3. Deploy with an exposed commit identifier, then re-run LIVE browser acceptance
4. Only then revisit production GO/NO-GO

## Accuracy hardening (same day)

Claude/Fabel retest requires hard gates. Added:

1. **Next.js middleware + `mh_roles` cookie** — wrong-role deep links redirect before shell paint; survives refresh/back/forward
2. **Section delete API + UI** — empty-enrolment sections deletable from Create Section page; row/New Section no longer open Master Scheduling
3. **Login validation** — required email/password errors, disabled submit when invalid, stale error clear
4. **Admin AI/Compliance/Matrix/Settings** — null-safe empty states (no undefined `.map` / `scorePct` crashes)
5. **Retest checklist** — `docs/qa/runs/2026-09-17-accuracy-retest-checklist.md`

Web/UI typecheck PASS after hardening.
