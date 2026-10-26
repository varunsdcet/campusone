# Design decisions, inferred content and deviations

This file records every place where the implementation had to infer, normalise or deliberately deviate from the 81 supplied reference images. "Observed" means visible in a screenshot; "inferred" means not supplied and built as minimal supporting UI in the same design language.

## 1. Assets that were NOT supplied

| Item | Decision |
|---|---|
| Logo | No vector/PNG logo was supplied — only screenshots. `src/features/auth/Brand.tsx` recreates a gold disc + green shield mark with react-native-svg. Replace with the official asset when available. |
| Fonts | Screenshots use a high-contrast serif display face and a geometric sans. Bundled **Playfair Display** (display) and **Inter** (body), both SIL Open Font License (`assets/fonts/OFL-*.txt`), downloaded from Google Fonts. The licence files are committed. |
| Icons | Lucide icon set (`lucide-react-native`, ISC) used consistently; the screenshots' icons are approximated. |
| Photos (programme hero, English test banner) | Vector placeholder illustrations in brand colours (`HeroImage`, English test banner). |
| Instructor avatar video/voice (Lecture) | Not supplied and no service exists. The lecture is a slide player with an illustrated presenter, bundled transcript/captions and timer-based slide credit. No avatar video or synthesized voice is claimed. |
| PDFs / documents / media | All "Open/Download" controls open locally generated sample PDFs/PNG in `assets/samples/` (clearly stamped DEMO SAMPLE). |
| Lesson "original textbook PDF" | A 1-page sample PDF; "Convert PDF" is replaced by the local AI template generator with an explanatory note. |

## 2. Fixture reconciliation (inconsistent screenshots)

| Inconsistency | Decision |
|---|---|
| Student identity differs across screens (Priyanka Singh / Pradeep Yadav / Marcus Vance / ST-2024-001 / 2600036) | One demo student: **Marcus Vance, ST-2024-001**, Computer Science (B.Sc.). Login placeholder uses ST-2024-001. A second student (Priya Sandhu) exists for cross-role variety. |
| ACSW 500 dates: Sep 14–21 (My Courses, All Course Info) vs Sep 18 – Oct 2 (Course Details, Learning Objectives) | Fixture: **Sep 14 – Oct 2, 2026**, Mon–Thu 5–10 pm, 12 sessions. |
| ACC201 instructor "James Pendelton / Financial Accounting" vs "Prof. Sterling / Principles of Accounting" (Attendance) | Fixture: ACC201 Financial Accounting, instructor James Pendelton. |
| Chapter 2 title "Business Communication & Records" (Programme Details) vs "Digital Product…" (Full Outline) | Chapter 2 = Business Communication & Records; chapter 4 = Digital Productivity Tools. |
| Dashboard metrics 2,171 students / 6 courses / 32 sections; Student List "2187"; Repository "127 results" | **Derived from fixtures** (7 students, 7 courses/sections, 9 repositories). The brief requires derived totals. |
| "Showing 4 enrolled courses" (student) | Derived from enrolments (7 sections incl. 1 completed; default filter hides completed). |
| Program Plan counts (3 IP / 1 completed / 1 dropped / 2 upcoming) and Final Marks summary (3.00 credits / 82% / 3.35 CGPA) | Derived from fixtures; CGPA 3.35 and 82% reproduce exactly from the two completed graded courses; earned credits are 6.00 (two 3-credit courses). |
| Workshop Enrolments shows Marcus pending for WS-RESUME on 2026-10-01 (future relative to the demo date) | Not seeded; the student creates this request in the demo (cross-role flow) and the instructor approves it. |
| Instructor profile email `monica@hcbcb.com` / dashboard `monica.dahiya@myhccbc.com` | Single login `monica.dahiya@heritage.edu`. |
| Notifications: eight identical "You may have missed class" items (student) reused verbatim on the instructor screenshot | Student keeps the 8 items; the instructor gets instructor-scoped notifications (grades due, workshop requests, schedule conflict, attendance not taken, evaluations). |
| Ask Heritage and Email screenshots are identical for both roles | Shared components; data and suggested questions are scoped per role (instructor answers cover grading status, workshop requests, schedule conflicts). |
| Accomplishments faculty record "jjj / jjj" and badge base "API Base Smoke Badge / Created via create-base API" | Replaced by "Peer mentoring lead" and "Instructor Base Badge (demo)". |
| AI Draft lesson "disaster management in india 87 96" | Replaced by sensible sample lesson titles. |
| Matching Drill sample answers (e.g. PIPEDA → "Meeting purpose and timed points") are wrong | Answer key uses the correct term/definition pairs; sample assignments were not copied. |

## 3. Demo clock

Reference screens centre on 21–25 September 2026 ("Friday, September 25, 2026 03:44:17 PM", "8 days left", "Session starts in 17 days"). The app anchors its demo clock to **2026-09-25 15:44:17 Pacific** at launch (`DEMO_ANCHOR_ISO`), advancing with real elapsed time, so fixtures stay coherent whenever the app is run. The developer gallery can jump the clock (±1/+7 days) to exercise chapter releases, workshop session windows and outbox timers. Switching to `api` mode leaves the device clock untouched.

## 4. Policy text that is NOT confirmed college policy

All of the following are demo defaults (`src/config/progressionPolicy.ts` or screen copy marked "demo"):
- Reading/lecture/matching time gates (1:25, 1:27, 1:00) and "read to bottom".
- One chapter released per day after enrolment; next chapter requires passing the chapter assessment (70%).
- Matching pass mark 80%; unlimited practice retries.
- Leave of absence "2-day review" and "30 consecutive days" thresholds (shown as demo estimates, not confirmed).
- Late submission policy, attendance correction routing, registrar deadlines.
- Evaluation anonymity rule (comments hidden below 3 responses).

## 5. Misleading claims removed from screenshots (layout preserved, labels truthful)

- "Encrypted & Secure… PIPEDA", "256-bit encrypted", "Student Identity & Security Protocol • PIPEDA Compliant" → demo privacy notes; no compliance claim.
- "Secure checkout powered by Stripe", "Encrypted 256-bit Stripe Handoff", "PCI-DSS Level 1" → clearly labelled demo checkout; no provider, no card entry, no money.
- "Verified & Issued", "Permanent cryptographic record", "Validated and accredited", "cryptographically signed… Office of the Registrar", "blockchain credentials" → "DEMO / NOT AN OFFICIAL CREDENTIAL", local records only.
- "CRA Compliant", "Verified / CRA Status", official T2202 → "SAMPLE — NOT A LEGALLY VALID TAX SLIP".
- "Verified records synchronized today at 06:00 EST", "cross-checked strictly with your SIS transcript" → "built from local demo records; no SIS audit is performed".
- "Answers verified against Chapter 1 unlocked curriculum" → "deterministic demo coach limited to unlocked chapters".
- "campus security filters scan outbound attachments… Heritage Mail Exchange" → "demo dispatch queue; nothing is sent".
- Logs are "a local demo activity log · not tamper-proof, not an audit system".
- Repository Push/Pull "[Moodle]" → "Moodle (demo label)"; no LMS is contacted.
- Live class "BIGBLUEBUTTON" → "demo room"; joining only records a local join state.

## 6. Inferred supporting screens (not supplied)

Student Home, Courses tab hub, Profile/services hub, Student Support, Demo Checkout result states, Chapter Assessment, Course Quiz (in-course Quiz 1), Live Room, My Learning, Transaction History, Pay Balance, Request Details, Change Password (security-settings destination), English Test registration form, Mail compose/message, Lesson Preview, Instructor Student Profile, Mark Attendance, Grade Entry, Schedule Review, Repository History, Course History Details, Term form, Instructor More hub, File viewer, Forbidden, Developer gallery. Each carries a "DEMO/inferred" label on screen.

## 7. Unshown internals built as minimal demo forms

- **Add Program** collapsed sections (Delivery Settings, Enrolment Conditions, Calculations & Statistical Details, Academic Standing, Graduation Conditions, Chair & Lead Accesses, Permissions, Designations): each accordion holds 2–3 generic demo fields with an on-screen note; the supplied screenshot shows only the headers. Values are not institutional rules.
- **Instructor Profile** Topics / Availability / Compensation / Schedule tab internals: minimal editable demo forms; compensation shows synthetic band labels only.
- **Workshop detail "Materials"**: sample PDF.

## 8. Navigation normalisation

Reference bottom tabs vary (Programs | My Learning | Certificates | Profile; Home | Courses | Attendance | Schedule | Profile; Home | Courses | Students | Grades | More). Normalised to the brief: Student **Home | Courses | Schedule | Messages | Profile**, Instructor **Home | Courses | Grades | Messages | More**. Programs, My Learning and Certificates are entry points inside Courses; Attendance/Students live in Courses/More respectively. Detail screens are pushed on the root stack, so the tab bar is hidden on deep screens where some screenshots still show it.

## 9. Visual fixes made from simulator screenshot comparison

- Login: the "Remember me" row used `flex:1` on the label and pushed "Forgot password?" off-screen → label now shrinks.
- Ask Coach: header title block had no flex → "Hide" button rendered off-screen on the Pro Max; fixed.
- Activity "Back to course": used `navigate` (which pushed a second Outline on React Navigation 7) → now pops when possible.
- Pressable `Card` wrapper ignored `flex`/`width` from the card style → quick tiles collapsed to icon-only on the Courses hub; the wrapper now inherits flex/alignSelf/width.
- Assignment cards: footer text could push the "Open →" button off the right edge → left column is now `flex:1` with 2-line clamp.
- Live room: toggle labels were dark on the dark card → white label colour.
- Bottom sheets: the keyboard covered the Save button on badge/competency/program-type forms → sheets now shrink to the space above the keyboard (keyboardWillShow/Hide listeners) and single-line inputs use a Done return key so the keyboard can be dismissed without a tap target.

## 10. Native/technical decisions

- Bare React Native 0.87.1 (Community CLI 20.2.0), new architecture (default), Hermes.
- `Intl` on Hermes: `hour12:false` + `formatToParts` returned empty hour parts, so date-time formatting uses `hourCycle:'h23'` and computes wall-clock components per IANA zone (`src/utils/format.ts`, `src/utils/timezone.ts`).
- zod v4 ships `export * as` syntax; `@babel/plugin-transform-export-namespace-from` was added to `babel.config.js`.
- Password fields use `textContentType="oneTimeCode"` to stop the iOS "Save Password?" prompt from covering the UI in demos and e2e runs.
- Rich-text editing (Edit Lesson Plan) is a native markdown editor with a formatting toolbar — no WebView.
- Drag-to-reorder (Program Types) uses `PanResponder` + `Animated` with VoiceOver adjustable actions; no reanimated/gesture-handler dependency was needed.
- Demo data lives in one persisted JSON document (`heritage.demo.db`, schema version 1) with migration hooks; TanStack Query caches are invalidated after mutations and cleared on logout/role switch.
