# QA report

Date: 2026-10-08. Devices: iPhone 17 Pro Max simulator (UDID `384B0841-A9EA-4273-9388-FAB511EF8B3B`, iOS 26.5) and iPhone 17e simulator (`3BA59042-75B9-4D76-914E-4BC5CB117FDB`, iOS 26.5). Physical iPhone: **not tested** (requires the owner's Apple team/signing; see README). Android: **not built**.

Honest split used everywhere in this repo:
- **Implemented** — screen and interactions exist in code (all 81 references + supporting screens; see `SCREEN_COVERAGE.md`).
- **Simulator-tested** — opened on the simulator and either scripted (Maestro) or screenshotted after driving the interaction (listed below and per row in `SCREEN_COVERAGE.md`).
- **Physical-device-tested** — none.

## Commands run and results (final state of the tree)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint src tests --ext .ts,.tsx` | 0 errors (warnings only: inline styles / `no-void`) |
| `npx jest` | **9 suites, 45 tests passed** (`tests/unit/*`, `tests/component/*`) |
| `xcodebuild … -configuration Debug -sdk iphonesimulator` | BUILD SUCCEEDED (screens, safe-area, async-storage, documents picker/viewer, fs, datetimepicker, svg all linked) |
| `xcodebuild … -configuration Release -sdk iphonesimulator` | BUILD SUCCEEDED; bundled `main.jsbundle`, 8 fonts + sample files inside the app; runs without Metro |
| `bash e2e/run-all.sh 384B0841-…` (Maestro 2.11, project-local Temurin JRE 21) on a **fresh Release install** | see table below |

## Unit/component coverage (all passing)
Repository hydration/persistence/no-reseed/reset/migration guard · login, invalid login, remember-me, session restore, logout · deterministic scenarios (one-shot error → retry) · learning gates (time gate, read-to-bottom, chapter release by day + assessment pass, practice vs graded, matching exclusivity/pass mark, certificate derived from progress) · checkout duplicate/fail/success · coach replies · assignment submit validation/receipt/no-grade, upload failure retry · instructor marks draft→submitted→released and student visibility, weight validation · attendance draft vs submit vs student record, correction request · workshop request → approval → both views, capacity/duplicates · leave validation/overlap/restart persistence · tasks upload requirement + counts · personal-details request leaves record untouched · finance balances + demo payment · notifications/drafts persist across restart · outbox queue/fail/retry/delivery · program types create→edit→reorder→dependency-blocked delete · faculties/programs/terms dependency rules · capability gating · repository duplicate confirmation + push/pull · schedule accept/reject · directory restriction · route permissions · HTTP adapter NOT_CONFIGURED · time-zone DST + instant preservation · document picker wrapper (size/type/cancel) · LoginScreen component (validation, invalid credentials, toggle + sign-in).

## Maestro e2e (`e2e/*.yaml`) — Release build, iPhone 17 Pro Max

Full-suite run after a clean `simctl uninstall` + install (`docs/qa/e2e-results.txt`, per-flow logs `docs/qa/e2e-*.log`):

| Flow | Result | What it proves |
|---|---|---|
| login | PASS | student sign-in, "Not Now" password prompt handled, home visible |
| instructor-login | PASS | self-healing sign-out from any state, instructor sign-in, dashboard |
| student-learning | PASS (re-run ×2 on the final Release build) | dev-gallery jump → chapter-1 assessment answered 6/6 → "Assessment passed" → saved progress on the practice quiz |
| student-checkout | PASS | catalogue → programme → demo checkout → enrolment appears in My Learning |
| student-assignment | PASS (re-run after flow text fix) | assignments list → details → attach dropzone → native picker cancel → "Picker cancelled" toast |
| instructor-attendance-grades | PASS | mark attendance (All present → one Late) → submit → student records updated → Grades tab → grade entry rows |
| workshop-approval | PASS | student requests a workshop → instructor sees "Vance, Marcus" pending |
| persistence-restart | PASS | notification marked read + new leave request survive `stopApp`/`launchApp` |
| forbidden-and-api | PASS | capability-gated route shows the forbidden state; program type create/edit; API-mode toggle shows NOT_CONFIGURED |

student-learning: in both full-suite runs the flow stopped at 5/6 answered because option C of question 5 sat behind the sticky footer and Maestro tapped it off-screen. The flow now scrolls each option into view, waits for the answered counter, and the dev-gallery jump resets later activities so the flow is re-runnable; it then passed twice in a row on a fresh Release install (`docs/qa/e2e-student-learning.log`). The Release build was rebuilt after that `devJumpTo` change; the other eight flows had already passed on the previous Release build of the same tree (only `learningMock.devJumpTo` and two type-only fixes changed).

Earlier Debug-build runs of the same flows (login, instructor-login, student-learning including "Assessment passed", smoke navigation) also passed; those runs are superseded by the Release results above.

## Simulator screenshot pass (Debug build, iPhone 17 Pro Max)

Every one of the 81 references was opened on the simulator and compared with its PNG; the evidence file per row is in `SCREEN_COVERAGE.md`. `docs/qa/screenshots/` holds 117 captures: `st-*.png` (57 student: splash/login/reset, home, courses hub, catalogue, programme, checkout, my learning, outline, reading, coach, lecture + full screen, quiz, matching, assessment, course complete, certificate + share, my courses, course details, objectives, course info weekly/calendar/session sheet, live room, course quiz, assignments + picker, attendance + correction, workshops, tasks, documents, tax, finance, leave, personal details, security, English test, time zone, notifications, mail + reply, Ask Heritage, profile, support), `in-*.png` (48 instructor: dashboard, AI draft, lesson editor + AI quiz + publish/preview, student list, my courses, workspace Course/Class List/Grades/Grade entry/Badges/Competency/Logs, course attendance, evaluations + details, repository, create content course + duplicate confirm, pending schedules, grades submission, course history, workshop enrolments pending/approved/details, faculties + add faculty + add program, program types + create/delete sheets, terms + form, profile Biography/Topics/Availability, accomplishments ×3, time zone, Ask Heritage, notifications, mail), plus `e2e-*`/`dbg-*` learning captures and `e17-login.png` (iPhone 17e, Release build).

Visual defects found by that comparison and fixed (details in `DESIGN_DECISIONS.md` §9): login checkbox row pushing "Forgot password?" off-screen; Ask Coach "Hide" off-screen; duplicate Outline on "Back to course"; Courses-hub quick tiles collapsing to icons; assignment card footer overflow; unreadable live-room toggle labels; bottom-sheet Save buttons hidden behind the keyboard.

## iPhone 17e (smaller device)
Release build installed and launched; login screen captured (`e17-login.png`) and the `login.yaml` flow result is in `docs/qa/e2e-results-17e.txt`. No full screenshot pass was done on the 17e; layouts use flex/scroll views and no fixed heights, but each screen was only visually verified on the Pro Max.

## Checks NOT run / known gaps
- Physical device, VoiceOver audit, Dynamic Type at max size, Android (project exists from the template, never built).
- The iOS native document picker in e2e only exercises the cancel path (simulator Files app has no documents).
- Instructor "Print class list" / certificate download end in the iOS share sheet; the sheet opening was verified, no external destination was.
- Screens were driven ad hoc through `e2e/open.sh` for screenshots; only the nine `e2e/*.yaml` flows are repeatable scripts.

## Known issues
- RN DevLoadingView "Refreshing…" banner can cover the header on the Debug build after file edits; use the Release build for e2e.
- Maestro: tapping a partially visible horizontal tab reports success but can miss; `e2e/home.yaml` + swiping the tab row first is the workaround used.
- Fast Refresh after adding React hooks to a component can throw "Rendered more hooks"; relaunch the Debug app.
