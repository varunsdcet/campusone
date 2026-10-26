# Screens that have no supplied design (design brief)

The 81 PNGs covered the main screens. The app needed 36 more screens/states to be usable end to end; they were built from the existing design language and carry an "inferred" label on-screen. This is the list to design. Each entry gives the role, the purpose, and the data points the screen must show. Shared style: Playfair Display titles, Inter body, green 900 primary, gold accent, coral for destructive/pending, cream background, 16px side gutters, bottom tab bar.

## Student (19)

1. **Home (dashboard)** — greeting + programme/student number; continue-learning card (programme title, activities done/total, progress bar, next activity); 4 quick tiles (My Courses count, upcoming assignments count, pending tasks count, Attendance); Upcoming deadlines list (type, course, due date, days left); notifications bell with unread badge; avatar.
2. **Courses hub (Courses tab)** — My Courses card (enrolled count, term chip), Current Programs/catalogue card, My Learning card (self-paced count, certificates), Assignments, Attendance, Workshops, Program Plan tiles; short note on certificates.
3. **Profile / Services hub (Profile tab)** — avatar, name, student number, programme; grouped menu: Records (Final marks, Badges, Extracurricular, Program plan), Services (Required tasks, Documents, Tax documents, Finance, Leave, Personal details, Security, English test, Time zone), Support, Developer gallery (demo only), Sign out.
4. **Student Support** — contact channels (email, phone, hours), FAQ accordion, "Ask Heritage" shortcut, campus address.
5. **Checkout result states** — processing, success (enrolment confirmed, programme, amount, receipt id, "Start learning"), failure (reason, retry), already-enrolled.
6. **Chapter Assessment (graded quiz)** — chapter label, title, minutes, activity n of n, pacing status, "graded · pass mark 70%" banner, answered counter + progress, question card (n/6, prompt, A–D options, selected state), Next/Submit, result state (score, pass/fail, per-question explanation, attempts, retry).
7. **Course Quiz (in-course Quiz 1)** — course code/title, due date, points, question list with options, submit confirmation, "submitted · pending grading" state.
8. **Live Room (demo video room)** — room name, status (ready/live), participants count, mic/camera/hand-raise toggles, chat strip, leave confirmation, "demo room, no real media" note.
9. **My Learning** — self-paced enrolments (programme, progress %, last activity, Continue), completed programmes with certificate chips, empty state.
10. **Transaction History** — term filter, list (date, description, type, amount, balance after), total paid/outstanding, export (demo).
11. **Pay Balance** — outstanding amount, amount input with presets, demo payment method card (masked ****1234), confirm sheet, receipt state, "no real payment" label.
12. **Request Details** — generic status page for leave/correction/personal-details requests: type, status pill (pending/approved/declined), submitted date, reference id, submitted fields, timeline, withdraw button.
13. **Change Password** — current, new, confirm with strength meter + rules checklist, success state.
14. **English Test registration** — test type select, date/time slot picker, campus, fee line, consent checkbox, confirmation.
15. **Mail: message view** — sender/recipients, date, subject, body, attachments (name, size, open), Reply/Forward/Delete.
16. **Mail: compose / reply** — To, Cc, Subject, body, attachment chips, Send (goes to Outbox), Save draft, discard confirmation.
17. **File viewer** — header with file name + size, PDF/image preview, Share/Open-in, "sample file" note, error state.
18. **Forbidden / no access** — icon, "You don't have access", reason, Back to home.
19. **Attendance correction request sheet** — session, current status, requested status, reason, evidence upload, submit.

## Instructor (13)

20. **More hub (More tab)** — profile card; grouped tiles: Teaching (AI Draft, Student list, Course attendance, Evaluations, Repository, Pending schedules, Course history, Workshop enrolments), Registry (Faculties, Program types, Terms; capability-gated), Account (Profile, Notifications, Ask Heritage, Time zone, Sign out).
21. **Lesson Preview** — read-only rendering of a lesson plan: title, type, minutes, required chip, published/draft pill, markdown body, PDF card, "Back to editor".
22. **Student Profile (instructor view)** — avatar, name, id, programme, term, advisor, status; tabs: Overview (attendance %, current standing, sections), Grades (per item), Attendance (per session), Notes; access-restriction note.
23. **Mark Attendance** — section + date header, summary (Present/Absent/Late/Total), "All present" shortcut, per-student row (avatar, name, Present/Absent/Late segmented, note icon), draft banner, Save draft / Review & submit, review sheet.
24. **Grade Entry** — section header, grade items as columns or stacked per student (name, mark input "/ max", validation error, feedback field), missing count, Save draft / Review & submit, submitted and released states.
25. **Schedule Change Review** — course/section, current vs proposed (days, time, room, dates) side by side, conflict details, requester, note field, Accept / Reject with confirmation.
26. **Repository History** — version list (version, date, actor, action push/pull/edit, note), diff summary, restore (demo).
27. **Course History Details** — archived offering header (term, code, section, room, schedule, instructor), read-only resources list, enrolled count, final grade distribution.
28. **Term form (create/edit)** — name, code, campus, start/end dates, add/drop deadline, status, validation messages, Save/Cancel.
29. **Instructor Profile: Topics tab** — teaching topics chips with add/remove, expertise level, certifications list.
30. **Instructor Profile: Availability tab** — weekly grid or per-day rows (available from/to), office hours, virtual room toggle, Save.
31. **Instructor Profile: Compensation tab** — band label, rate type, pay period, synthetic values with "demo" label, documents list.
32. **Instructor Profile: Schedule tab** — week view of sections (day, time, room, code), upcoming sessions list.

## Shared / supporting (4)

33. **Splash** — logo, "Self-Paced Learning" line (student only), loading indicator.
34. **Reset password** — email/student number, send link, sent state, back to login.
35. **Add Program: inner accordion contents** — Delivery Settings, Enrolment Conditions, Calculations & Statistical Details, Academic Standing, Graduation Conditions, Chair & Lead Accesses, Permissions, Designations (each 2–4 fields; headers only were supplied).
36. **Developer gallery (demo tool)** — scenario switches (slow/error/permission-denied/empty), demo clock, jump-to-learning buttons, Reset demo data confirmation, API mode toggle. Internal; style optional.

## Common states worth one design each
Loading skeleton, empty state (icon + line + action), error state with Retry, offline/NOT_CONFIGURED banner, toast (success/error/info), confirm bottom sheet (neutral + destructive), demo label chip.
