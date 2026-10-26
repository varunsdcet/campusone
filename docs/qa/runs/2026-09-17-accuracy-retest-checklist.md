# Accuracy verification checklist — browser defects (2026-09-17)

Use this as the Claude/Fabel retest script. Every Critical/High LIVE-DEF must pass exactly as written.

## Environment

- Rebuild web after pull (`pnpm --filter @myheritage/web build` or `next build`)
- Fresh login required so `mh_roles` cookie is set (middleware gate)
- Seed Join Class URL only applies after reseed; existing DBs need joinUrl update

## Critical — authorization

| ID | Steps | Expected |
|---|---|---|
| LIVE-DEF-001 | Login as Student Marcus → open `/admin` → refresh → Back → Forward | Redirect to `/student` (or login then home). **No admin shell** |
| LIVE-DEF-001b | Same for Instructor, Applicant, Employer → `/admin` | Redirect to own portal |
| LIVE-DEF-002 | Login as Instructor → `/student` | Redirect to `/instructor`. No student shell/data |
| LIVE-DEF-003 | Login as Admin → `/instructor` and `/student` | Redirect to `/admin`. No personal instructor/student shell |

## Critical — applicant upload

| ID | Steps | Expected |
|---|---|---|
| LIVE-DEF-016 | Applicant → Documents → Upload | Native file chooser opens (`input[type=file]` exists) |
| LIVE-DEF-016b | Cancel chooser | Status stays missing; no fabricated filename |
| LIVE-DEF-016c | Select real PDF | Status uploaded with **real filename**; refresh persists |

## High — navigation / copy

| ID | Steps | Expected |
|---|---|---|
| LIVE-DEF-010 | Instructor → Notifications | Heading **Notifications** (not Terminal) |
| LIVE-DEF-011 | Instructor → Ask MyHeritage | URL `/instructor/ask` |
| LIVE-DEF-012 | Student → bell | `/student/notifications` |
| LIVE-DEF-013 | Student → avatar | `/student/profile` |
| LIVE-DEF-014 | Applicant → bell | `/applicant/notifications` |
| LIVE-DEF-015 | Applicant → avatar | `/applicant/application` |
| LIVE-DEF-017 | Employer → bell | `/employer/notifications` |
| LIVE-DEF-018 | Employer → avatar | `/employer/profile` |

## High — workflows

| ID | Steps | Expected |
|---|---|---|
| LIVE-DEF-009 | Admin → `/admin/sections/create` → clear fields → submit | Validation error; **no CS401 auto-create** |
| LIVE-DEF-021 | Admin Sections row click | Opens `/admin/sections/create` (not Master Scheduling) |
| LIVE-DEF-021b | Create empty-enrolment section → Delete | Section removed |
| LIVE-DEF-022 | Instructor Attendance already FINALIZED → Finalize | Button disabled / no timestamp change |
| LIVE-DEF-023 | Admin Approvals → Approve then Apply on pending grade.publish | Status moves; grades publish |
| LIVE-DEF-024 | Instructor → Submissions | Live pending-grades queue (not empty scaffold) |
| LIVE-DEF-025 | Instructor → Notifications after live data | Page renders; no TypeError |
| LIVE-DEF-020 | Student Join class | Opens resolvable HTTPS (`meet.jit.si/...` after reseed) |
| LIVE-DEF-019 | Student header at 390/768/1024/1440 | No control overlap / no 572px overflow at 390 |

## Medium

| ID | Steps | Expected |
|---|---|---|
| LIVE-DEF-008 | Login empty email/password | Field errors; Sign in disabled when invalid |
| LIVE-DEF-008b | Whitespace-only email | Email required/invalid error; stale password error clears on edit |

## Pass criteria

- All Critical must PASS including refresh/back/forward on wrong-role URLs
- All High must PASS
- Medium should PASS for release polish
