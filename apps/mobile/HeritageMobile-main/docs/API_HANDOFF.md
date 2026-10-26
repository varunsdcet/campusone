# API handoff (proposed contracts)

Everything in this document is **PROPOSED** and unapproved. The app currently runs entirely against the persistent local mock repository (`src/services/mock`). Replacing the mock with HTTP requires no screen rewrites: screens call feature hooks, hooks call the typed service interfaces in `src/services/contracts`, and `src/services/index.ts` chooses the adapter from the validated config (`src/config/appConfig.ts`).

## 1. Switching adapters

1. Set `mode: 'api'` and `apiBaseUrl` in `src/config/appConfig.ts` (or inject them from build settings and validate through the same Zod schema).
2. `createHttpServices()` (`src/services/http/index.ts`) returns a `Services` object whose methods all reject with a typed `ServiceError('NOT_CONFIGURED')` until implemented. Implement methods incrementally with `withHttpMethods()`:

```ts
const auth = withHttpMethods(createNotConfiguredService<AuthService>('auth'), {
  login: async input => {
    const dto = await http.request<LoginResponseDto>('POST', '/v1/auth/login', input as LoginRequestDto);
    return { session: mapSession(dto, input.rememberMe), user: mapUser(dto.user) };
  },
});
```

3. DTO mappers live in `src/services/http/dto.ts`; keep domain types (`src/domain/types.ts`) stable and map at the boundary.
4. Unconfigured methods surface as an "API not configured" state in the UI (`ErrorState`), never as fake success. The HTTP skeleton is covered by `tests/unit/registry.test.ts`.
5. Session tokens: the HTTP client takes a `getToken()` callback. Store tokens in the iOS Keychain (e.g. `react-native-keychain`), not AsyncStorage. The mock stores only a `{ userId, role, rememberMe }` session marker and never any password or token.

## 2. Conventions (proposed)

- Base URL `https://<host>/v1`, JSON only, `Authorization: Bearer <token>`.
- Errors: `{ "error": { "code": "VALIDATION|UNAUTHENTICATED|PERMISSION_DENIED|NOT_FOUND|CONFLICT|SERVER", "message": "...", "details": { field: msg } } }` mapped to `ServiceError` (`src/services/errors.ts`). HTTP 401/403/404/409/422/5xx map to the codes above; network/timeout map to retryable errors.
- Pagination: cursor based `{ items, nextCursor?, total? }` (`PageDto<T>`); the app currently paginates client-side for student directory, repositories and mail.
- Dates: ISO-8601 instants with offset for events/deadlines (`dueAt`, `createdAt`); `YYYY-MM-DD` for calendar dates. The app never shifts an instant when the display time zone changes.
- IDs: opaque strings; the app passes only IDs in navigation params.
- Uploads: multipart `POST /v1/uploads` returning `{ id, name, size, mimeType, url }`; the submission endpoints then reference `uploadId`s. Client-side limits (type allow-list, 10 MiB, 1 file) are config values in `appConfig.demo`.
- Idempotency: mutation endpoints that the app may retry (submission, payment, workshop decisions) should accept an `Idempotency-Key` header; the mock enforces the equivalent CONFLICT rules.

## 3. Proposed endpoints by service

| Service (contract file) | Method | Proposed endpoint |
|---|---|---|
| `AuthService` (`contracts/auth.ts`) | login / restoreSession / logout | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| | verifyPassword / changePassword | `POST /auth/verify-password`, `POST /auth/change-password` |
| | requestPasswordReset | `POST /auth/password-reset-requests` (server sends email) |
| | getSettings / updateSettings | `GET/PATCH /me/settings` (`timeZone` IANA, `notificationsEnabled`) |
| `CatalogueService` | listProgrammes(filters) / getProgramme | `GET /programmes?query&subject&level&category`, `GET /programmes/{id}` (include chapters) |
| | bookmarks | `GET/PUT/DELETE /me/bookmarks/{programmeId}` |
| `EnrolmentService` | checkout | `POST /me/enrolments/checkout-sessions` → provider redirect/webhook; `GET /me/enrolments`; `GET /me/payments` |
| `LearningService` | getSnapshot | `GET /me/learning/{programmeId}` (server derives gates from policy) |
| | recordTime / markReadToBottom / completeActivity | `POST /me/learning/{programmeId}/activities/{id}/events` `{type:'time'|'readToBottom'|'complete'}` |
| | quiz / matching | `PUT …/activities/{id}/answers`, `POST …/activities/{id}/submit` |
| | certificates | `GET/POST /me/certificates` |
| `CoachService` | ask | `POST /me/coach/messages` (server-side model; scope to unlocked chapters) |
| `CoursesService` | sections / roster / sessions / updateSectionContent | `GET /me/sections`, `GET /sections/{id}`, `GET /sections/{id}/roster`, `GET /sections/{id}/sessions`, `PATCH /sections/{id}/content` |
| `AssignmentsService` | list / get / saveDraft / submit | `GET /me/assignments`, `GET /assignments/{id}`, `PUT /assignments/{id}/draft`, `POST /assignments/{id}/submissions` (returns receipt) |
| `GradesService` | items / marks / draft / submit / release / finalMarks / export | `GET/POST /sections/{id}/grade-items`, `GET/PUT /sections/{id}/marks` (draft), `POST /sections/{id}/marks/submit`, `POST /sections/{id}/marks/release`, `GET /me/final-marks`, `GET /sections/{id}/marks/export` |
| `AttendanceService` | student records / corrections / instructor date view / draft / submit | `GET /me/attendance`, `POST /me/attendance-corrections`, `GET /attendance?date&sectionId`, `PUT /sections/{id}/attendance/{date}` (draft), `POST …/submit` |
| `WorkshopsService` | list / register / drop / instructor decisions | `GET /workshops`, `POST /workshops/{id}/enrolments`, `DELETE /workshops/{id}/enrolments/me`, `GET /workshop-enrolments`, `POST /workshop-enrolments/{id}/decision` |
| `RecordsService` | badges / extracurricular / plan / transcript | `GET /me/badges`, `GET /me/extracurricular`, `GET /me/program-plan`, `POST /me/requests` `{kind:'transcript'}` |
| `TasksService` | list / complete | `GET /me/tasks`, `POST /me/tasks/{id}/complete` (uploadId or confirmation) |
| `DocumentsService` | list / tax / special letter | `GET /me/documents`, `GET /me/tax-documents`, `GET /documents/{id}/download` (signed URL), `POST /me/requests` `{kind:'specialLetter'}` |
| `FinanceService` | statements / transactions / pay | `GET /me/statements`, `GET /me/transactions?termId`, `POST /me/payments/checkout-sessions` |
| `RequestsService` | personal details / leave / English test | `POST /me/requests` with `kind`; `GET /me/requests?kind`; `POST /me/english-test-registrations` |
| `NotificationsService` | list / markRead / markAllRead | `GET /me/notifications`, `POST /me/notifications/{id}/read`, `POST /me/notifications/read-all` (+ push registration later) |
| `MailService` | folders / send / drafts / move | `GET /me/mail?folder`, `POST /me/mail` (queue), `PUT /me/mail/{id}` (draft), `POST /me/mail/{id}/move`, `DELETE /me/mail/{id}`; outbox status via `GET /me/mail/{id}` |
| `AskHeritageService` | ask / history / feedback | `POST /me/assistant/questions` (read-only, grounded), `GET /me/assistant/history`, `POST /me/assistant/answers/{id}/feedback` |
| `InstructorService` | dashboard, students, lesson plans (+generate/publish), competencies, badges, logs, evaluations, repositories (+push/pull), schedule changes (+decision), grade overview, history, registry (faculties/programs/program types/terms CRUD), profile, accomplishments | `GET /instructor/dashboard`, `GET /instructor/students?…`, `GET/PUT /lesson-plans/{id}`, `POST /lesson-plans/{id}/generate`, `POST /lesson-plans/{id}/publish`, `GET/POST /sections/{id}/competencies`, `GET/POST /sections/{id}/badges`, `GET /sections/{id}/logs?…`, `GET /evaluations`, `GET/POST/PUT/DELETE /repositories`, `POST /repositories/{id}/push|pull`, `GET /schedule-changes`, `POST /schedule-changes/{id}/decision`, `GET /instructor/grade-overview`, `GET /instructor/history`, `GET/POST/PUT/DELETE /registry/faculties|programs|program-types|terms`, `PUT /registry/program-types/order`, `GET/PATCH /instructor/profile`, `GET /instructor/accomplishments` |

## 4. Authorization expectations

The app gates screens with demo capability flags (`UserAccount.capabilities`, `UserSettings.extendedPermissionsDemo`). The backend must return the real capability set in the login response and enforce every rule server-side (e.g. instructors only see students enrolled in their sections; registry CRUD limited to registrar roles; released marks immutable).

## 5. State transitions the backend must preserve

- Submission ≠ grade; marks: `draft → submitted → released`; only `released` visible to students.
- Attendance: `draft` invisible to students; `submitted` visible; corrections are requests, never direct edits.
- Workshop enrolment: `pending → approved|declined`, `approved → dropped`; capacity enforced; duplicate decisions rejected (409).
- Requests (personal details, leave, transcript, letter, English test): created `pending`; approval is a separate, server-side action.
- Repository push/pull: the mock only records local version history; a real LMS sync is a backend job with its own status endpoint.
- Lesson plans: `draft` vs `published` copies.

## 6. Environment / build

`appConfig` is the single validated boundary. Nothing else should read env values. Add `apiBaseUrl` per build configuration (Debug/Release schemes or a config library) and keep the `mock` mode available for demos and e2e tests.
