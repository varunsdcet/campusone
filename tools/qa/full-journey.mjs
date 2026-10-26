import assert from "node:assert/strict";

const API = process.env.QA_API_URL ?? "http://127.0.0.1:4100";
const WEB = process.env.QA_WEB_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.QA_PASSWORD ?? "Heritage!2026";
const runId = process.env.QA_RUN_ID ?? Date.now().toString(36);

const data = {
  instructorEmail: `qa.instructor+${runId}@heritage.edu`,
  studentEmail: `qa.student+${runId}@heritage.edu`,
  studentNumber: `QA-${runId.slice(-8).toUpperCase()}`,
  courseCode: `QA${runId.slice(-5).toUpperCase()}`,
  sectionCode: `QA${runId.slice(-5).toUpperCase()}-01`,
  secondSectionCode: `QA${runId.slice(-5).toUpperCase()}-02`,
};

const state = {};
const results = [];

function shortError(error) {
  return error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 240) : String(error);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

function expectStatus(response, status) {
  assert.equal(response.status, status, `expected HTTP ${status}, received ${response.status}: ${JSON.stringify(response.body)}`);
}

async function login(email, fingerprint) {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD, deviceFingerprint: fingerprint },
  });
  expectStatus(response, 200);
  assert.equal(typeof response.body?.accessToken, "string");
  return response.body;
}

async function run(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, status: "PASS", detail: detail ?? "" });
  } catch (error) {
    results.push({ id, name, status: "FAIL", detail: shortError(error) });
  }
}

async function knownFailure(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, status: "XPASS", detail: detail ?? "Known issue was not reproduced" });
  } catch (error) {
    results.push({ id, name, status: "XFAIL", detail: shortError(error) });
  }
}

function gap(id, name, detail) {
  results.push({ id, name, status: "GAP", detail });
}

async function waitFor(check, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastError) throw lastError;
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

await run("ENV-001", "API health", async () => {
  const response = await request("/health");
  expectStatus(response, 200);
  assert.equal(response.body?.ok, true);
});

await run("ENV-002", "Login page renders", async () => {
  const response = await fetch(`${WEB}/login`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Sign in to MyHeritage/i);
});

await run("UI-001", "Critical journey routes render", async () => {
  const routes = [
    "/admin/users/create",
    "/admin/sections/create",
    "/admin/enrolments",
    "/instructor/gradebook",
    "/admin/approvals",
    "/student/courses",
    "/student/grades",
    "/student/notifications",
    "/student/profile",
  ];
  for (const route of routes) {
    const response = await fetch(`${WEB}${route}`);
    assert.equal(response.status, 200, `${route} returned HTTP ${response.status}`);
  }
  return `${routes.length} routes returned HTTP 200`;
});

await run("AUTH-004", "Invalid password is rejected", async () => {
  const response = await request("/auth/login", {
    method: "POST",
    body: {
      email: "marcus.vance@heritage.edu",
      password: "WrongPassword!2026",
      deviceFingerprint: `qa-invalid-${runId}`,
    },
  });
  expectStatus(response, 401);
});

await run("AUTH-005", "Malformed login input returns validation error", async () => {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email: "not-an-email", password: "short", deviceFingerprint: "short" },
  });
  assert.ok([400, 422].includes(response.status), `malformed login returned HTTP ${response.status}`);
});

await run("PUB-001", "Public verification matches an exact student number and family name", async () => {
  const response = await request("/public/verify?studentNumber=ST-2024-001&familyName=Vance");
  expectStatus(response, 200);
  assert.equal(response.body?.match, true);
});

await run("PUB-001b", "Public verification does not confirm a student number on its own", async () => {
  const response = await request("/public/verify?studentNumber=ST-2024-001");
  assert.notEqual(response.body?.match, true, "student number alone disclosed that a student exists");
});

await run("PUB-002", "Public verification rejects blank input", async () => {
  const response = await request("/public/verify");
  expectStatus(response, 400);
  assert.equal(response.body?.match, false);
});

await run("PUB-003", "Public verification does not enumerate partial email", async () => {
  const response = await request("/public/verify?q=marcus");
  assert.ok([200, 400].includes(response.status), `partial verification returned HTTP ${response.status}`);
  assert.notEqual(response.body?.match, true, "partial email/name fragment disclosed that a student exists");
});

await run("SEC-001", "CORS rejects spoofed localhost origin", async () => {
  const response = await request("/health", { headers: { origin: "http://localhost.attacker.example" } });
  assert.notEqual(
    response.headers.get("access-control-allow-origin"),
    "http://localhost.attacker.example",
    "spoofed origin was reflected as allowed",
  );
});

await run("AUTH-003", "Admin login", async () => {
  state.admin = await login("admin@heritage.edu", `qa-admin-${runId}`);
  assert.ok(state.admin.roles.includes("admin"));
});

await run("AUTH-002", "Seed instructor login", async () => {
  state.seedInstructor = await login("vance.instructor@heritage.edu", `qa-instructor-${runId}`);
  assert.ok(state.seedInstructor.roles.includes("instructor"));
});

await run("AUTH-001", "Seed student login", async () => {
  state.seedStudent = await login("marcus.vance@heritage.edu", `qa-student-${runId}`);
  assert.ok(state.seedStudent.roles.includes("student"));
});

await run("AUTH-009", "Student cannot list admin users", async () => {
  const response = await request("/admin/users", { token: state.seedStudent.accessToken });
  expectStatus(response, 403);
});

await run("USR-002", "Admin creates instructor", async () => {
  const response = await request("/admin/users", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      email: data.instructorEmail,
      givenName: "Automation",
      familyName: "Instructor",
      role: "instructor",
      password: PASSWORD,
    },
  });
  expectStatus(response, 201);
  state.createdInstructor = response.body;
});

await run("USR-001", "Admin creates student", async () => {
  const response = await request("/admin/users", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      email: data.studentEmail,
      givenName: "Automation",
      familyName: "Student",
      role: "student",
      password: PASSWORD,
      studentNumber: data.studentNumber,
      programName: "Quality Assurance",
    },
  });
  expectStatus(response, 201);
  state.createdStudent = response.body;
});

await run("USR-003", "Duplicate user is rejected", async () => {
  const response = await request("/admin/users", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      email: data.studentEmail,
      givenName: "Duplicate",
      familyName: "Student",
      role: "student",
      password: PASSWORD,
    },
  });
  expectStatus(response, 409);
});

await run("USR-005", "Student cannot create user", async () => {
  const response = await request("/admin/users", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: {
      email: `forbidden+${runId}@heritage.edu`,
      givenName: "Forbidden",
      familyName: "User",
      role: "student",
      password: PASSWORD,
    },
  });
  expectStatus(response, 403);
});

await run("USR-004", "Invalid user input returns validation error", async () => {
  const response = await request("/admin/users", {
    method: "POST",
    token: state.admin.accessToken,
    body: { email: "bad", givenName: "", familyName: "", role: "student", password: "short" },
  });
  assert.ok([400, 422].includes(response.status), `invalid user input returned HTTP ${response.status}`);
});

await run("CRS-001", "Admin creates course and section", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      courseCode: data.courseCode,
      courseTitle: `Automated Journey ${runId}`,
      credits: 3,
      sectionCode: data.sectionCode,
      instructorEmail: data.instructorEmail,
      termCode: "2026F",
    },
  });
  expectStatus(response, 201);
  state.section = response.body;
});

await run("CRS-003", "Duplicate section is rejected", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      courseCode: data.courseCode,
      courseTitle: `Automated Journey ${runId}`,
      credits: 3,
      sectionCode: data.sectionCode,
      instructorEmail: data.instructorEmail,
      termCode: "2026F",
    },
  });
  expectStatus(response, 409);
});

await run("CRS-002", "Existing course is reused for a second section", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      courseCode: data.courseCode,
      courseTitle: `Automated Journey ${runId}`,
      credits: 3,
      sectionCode: data.secondSectionCode,
      instructorEmail: data.instructorEmail,
      termCode: "2026F",
    },
  });
  expectStatus(response, 201);
  state.secondSection = response.body;
  assert.notEqual(state.secondSection.sectionId, state.section.sectionId);
});

await run("CRS-004", "Unknown instructor is rejected", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      courseCode: `UK${runId.slice(-4)}`,
      courseTitle: "Unknown Instructor Course",
      credits: 3,
      sectionCode: `UK${runId.slice(-4)}-01`,
      instructorEmail: `missing+${runId}@heritage.edu`,
      termCode: "2026F",
    },
  });
  expectStatus(response, 404);
});

await run("CRS-005", "Non-instructor account cannot own a section", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      courseCode: `NR${runId.slice(-4)}`,
      courseTitle: "Wrong Role Course",
      credits: 3,
      sectionCode: `NR${runId.slice(-4)}-01`,
      instructorEmail: data.studentEmail,
      termCode: "2026F",
    },
  });
  expectStatus(response, 400);
});

await run("CRS-006", "Invalid section input returns validation error", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.admin.accessToken,
    body: { courseCode: "", courseTitle: "", credits: 0, sectionCode: "", instructorEmail: "bad", termCode: "2026F" },
  });
  assert.ok([400, 422].includes(response.status), `invalid section input returned HTTP ${response.status}`);
});

await run("CRS-007", "Student cannot create section", async () => {
  const response = await request("/admin/sections", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: {
      courseCode: `NO${runId.slice(-4)}`,
      courseTitle: "Forbidden Course",
      credits: 3,
      sectionCode: `NO${runId.slice(-4)}-01`,
      instructorEmail: data.instructorEmail,
      termCode: "2026F",
    },
  });
  expectStatus(response, 403);
});

await run("ENR-001", "Admin enrols student", async () => {
  const response = await request("/admin/enrolments", {
    method: "POST",
    token: state.admin.accessToken,
    body: { studentEmail: data.studentEmail, sectionId: state.section.sectionId },
  });
  expectStatus(response, 201);
  state.enrolment = response.body;
});

await run("ENR-002", "Duplicate enrolment is rejected", async () => {
  const response = await request("/admin/enrolments", {
    method: "POST",
    token: state.admin.accessToken,
    body: { studentEmail: data.studentEmail, sectionId: state.section.sectionId },
  });
  expectStatus(response, 409);
});

await run("ENR-006", "Student cannot create enrolment", async () => {
  const response = await request("/admin/enrolments", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: { studentEmail: data.studentEmail, sectionId: state.section.sectionId },
  });
  expectStatus(response, 403);
});

await run("ENR-003", "Unknown student enrolment is rejected", async () => {
  const response = await request("/admin/enrolments", {
    method: "POST",
    token: state.admin.accessToken,
    body: { studentEmail: `missing+${runId}@heritage.edu`, sectionId: state.section.sectionId },
  });
  expectStatus(response, 404);
});

await run("ENR-004", "Instructor account cannot be enrolled as student", async () => {
  const response = await request("/admin/enrolments", {
    method: "POST",
    token: state.admin.accessToken,
    body: { studentEmail: data.instructorEmail, sectionId: state.section.sectionId },
  });
  expectStatus(response, 404);
});

await run("ASN-001", "Admin creates assignment for new section", async () => {
  const response = await request("/admin/assignments", {
    method: "POST",
    token: state.admin.accessToken,
    body: {
      sectionId: state.section.sectionId,
      title: `Automation Assignment ${runId}`,
      maxScore: 100,
      weightPercent: 15,
      dueAt: "2026-11-20T18:00:00.000Z",
    },
  });
  expectStatus(response, 201);
  state.assignment = response.body;
});

await run("ASN-002", "Invalid assignment input returns validation error", async () => {
  const response = await request("/admin/assignments", {
    method: "POST",
    token: state.admin.accessToken,
    body: { sectionId: state.section.sectionId, title: "", maxScore: 0, weightPercent: 0, dueAt: "bad-date" },
  });
  assert.ok([400, 422].includes(response.status), `invalid assignment input returned HTTP ${response.status}`);
});

await run("ASN-003", "Student cannot create assignment", async () => {
  const response = await request("/admin/assignments", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: { sectionId: state.section.sectionId, title: "Forbidden Assignment", maxScore: 100, weightPercent: 10 },
  });
  expectStatus(response, 403);
});

await run("JNY-001A", "Created instructor sees assigned section", async () => {
  state.newInstructor = await login(data.instructorEmail, `qa-new-instructor-${runId}`);
  const response = await request("/courses/me", { token: state.newInstructor.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.sectionId === state.section.sectionId));
});

await run("JNY-001B", "Created student sees enrolled course", async () => {
  state.newStudent = await login(data.studentEmail, `qa-new-student-${runId}`);
  const response = await request("/courses/me", { token: state.newStudent.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.sectionId === state.section.sectionId));
});

await run("JOIN-001", "Student receives only an approved HTTPS class join link", async () => {
  const response = await request("/calendar/me", { token: state.seedStudent.accessToken });
  expectStatus(response, 200);
  const joinable = response.body.events.find((event) => event.kind === "class" && event.joinUrl);
  assert.ok(joinable, "no joinable enrolled class session was returned");
  assert.match(joinable.joinUrl, /^https:\/\//);
});

await run("FILE-001", "Student uploads a persistent assignment file", async () => {
  const bytes = Buffer.from("%PDF-1.4\nQA student journey\n");
  const response = await request(`/student/assignments/${state.assignment.assignmentId}/files`, {
    method: "POST",
    token: state.newStudent.accessToken,
    body: {
      filename: `qa-${runId}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      contentBase64: bytes.toString("base64"),
    },
  });
  expectStatus(response, 201);
  state.submissionFileId = response.body.submission.files.at(-1).id;
  assert.equal(response.body.submission.status, "draft");
});

await run("DEL-001", "Student archives an owned draft submission file", async () => {
  const response = await request(`/student/submission-files/${state.submissionFileId}`, {
    method: "DELETE",
    token: state.newStudent.accessToken,
  });
  expectStatus(response, 200);
  assert.equal(response.body.archived, true);
});

await run("SUB-001", "Student uploads a replacement and submits the assignment", async () => {
  const bytes = Buffer.from("%PDF-1.4\nQA final submission\n");
  const upload = await request(`/student/assignments/${state.assignment.assignmentId}/files`, {
    method: "POST",
    token: state.newStudent.accessToken,
    body: {
      filename: `qa-final-${runId}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      contentBase64: bytes.toString("base64"),
    },
  });
  expectStatus(upload, 201);
  const response = await request(`/student/assignments/${state.assignment.assignmentId}/submit`, {
    method: "POST",
    token: state.newStudent.accessToken,
    body: {},
  });
  expectStatus(response, 200);
  assert.equal(response.body.submission.status, "submitted");
  assert.equal(response.body.alreadySubmitted, false);
});

await run("CAL-001", "New assignment appears in instructor calendar", async () => {
  const response = await request("/calendar/me", { token: state.newInstructor.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.title.includes(`Automation Assignment ${runId}`)));
});

await run("CAL-002", "New assignment appears in enrolled student calendar", async () => {
  const response = await request("/calendar/me", { token: state.newStudent.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.title.includes(`Automation Assignment ${runId}`)));
});

await run("NOT-001", "Instructor receives assignment notification", async () => {
  const response = await request("/notifications/me", { token: state.newInstructor.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.templateKey === "section.assigned" && item.title.includes(data.sectionCode)));
});

await run("NOT-002", "Student receives enrolment notification", async () => {
  const response = await request("/notifications/me", { token: state.newStudent.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.items.some((item) => item.templateKey === "enrolment.created" && item.title.includes(data.courseCode)));
});

await run("NOT-003", "Created users receive welcome notification", async () => {
  const instructor = await request("/notifications/me", { token: state.newInstructor.accessToken });
  const student = await request("/notifications/me", { token: state.newStudent.accessToken });
  assert.ok(instructor.body.items.some((item) => item.templateKey === "account.welcome"));
  assert.ok(student.body.items.some((item) => item.templateKey === "account.welcome"));
});

await run("NOT-004", "Notifications are recipient-isolated", async () => {
  const student = await request("/notifications/me", { token: state.newStudent.accessToken });
  expectStatus(student, 200);
  assert.ok(!student.body.items.some((item) => item.templateKey === "section.assigned"));
});

await run("NOT-005", "Notification ordering and unread count are consistent", async () => {
  const response = await request("/notifications/me", { token: state.newInstructor.accessToken });
  expectStatus(response, 200);
  const dates = response.body.items.map((item) => Date.parse(item.createdAt));
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
  assert.equal(response.body.unreadCount, response.body.items.filter((item) => item.readAt == null).length);
});

await run("SRCH-001", "Exact course search", async () => {
  const response = await request(`/search?q=${encodeURIComponent(data.courseCode)}`, { token: state.admin.accessToken });
  expectStatus(response, 200);
  const courses = response.body.groups.find((group) => group.type === "courses")?.items ?? [];
  assert.ok(courses.some((item) => item.label.includes(data.courseCode)));
});

await run("SRCH-002", "Partial mixed-case search finds course and person", async () => {
  const courseResponse = await request(`/search?q=${encodeURIComponent(data.courseCode.toLowerCase().slice(0, 4))}`, {
    token: state.admin.accessToken,
  });
  const personResponse = await request(`/search?q=${encodeURIComponent("aUtOmAtIoN")}`, { token: state.admin.accessToken });
  expectStatus(courseResponse, 200);
  expectStatus(personResponse, 200);
  assert.ok(courseResponse.body.groups.find((group) => group.type === "courses")?.items.length > 0);
  assert.ok(personResponse.body.groups.find((group) => group.type === "people")?.items.length > 0);
});

await run("SRCH-004B", "Unknown search returns empty result groups", async () => {
  const response = await request(`/search?q=${encodeURIComponent(`no-match-${runId}`)}`, { token: state.admin.accessToken });
  expectStatus(response, 200);
  assert.ok(response.body.groups.every((group) => group.items.length === 0));
});

await run("SRCH-003", "Blank search returns no groups", async () => {
  const response = await request("/search?q=%20%20", { token: state.admin.accessToken });
  expectStatus(response, 200);
  assert.deepEqual(response.body.groups, []);
});

await run("SRCH-004", "Special-character search is handled", async () => {
  const response = await request(`/search?q=${encodeURIComponent("%_'<>")}`, { token: state.admin.accessToken });
  expectStatus(response, 200);
  assert.ok(Array.isArray(response.body.groups));
});

await run("SRCH-005", "Student search protects directory email data", async () => {
  const response = await request(`/search?q=${encodeURIComponent("admin@heritage.edu")}`, {
    token: state.seedStudent.accessToken,
  });
  expectStatus(response, 200);
  const people = response.body.groups.find((group) => group.type === "people")?.items ?? [];
  assert.equal(people.length, 0, "student received people-directory/email search results");
});

await run("PRO-001", "Student can load own profile view", async () => {
  const response = await request(`/portal/view?path=${encodeURIComponent("/student/profile")}`, {
    token: state.seedStudent.accessToken,
  });
  expectStatus(response, 200);
  assert.equal(response.body.role, "student");
});

await run("PRO-006", "Profile/bootstrap response omits credentials", async () => {
  const response = await request("/portal/bootstrap", { token: state.seedStudent.accessToken });
  expectStatus(response, 200);
  const serialized = JSON.stringify(response.body).toLowerCase();
  assert.ok(!serialized.includes("password"));
  assert.ok(!serialized.includes("accesstoken"));
  assert.ok(!serialized.includes("passwordhash"));
});

await run("GRD-006A", "Dedicated grades API hides all drafts", async () => {
  state.draftOnlyStudent = await login("fatima.hassan@heritage.edu", `qa-draft-student-${runId}`);
  const response = await request("/grades/me", { token: state.draftOnlyStudent.accessToken });
  expectStatus(response, 200);
  const items = response.body.courses.flatMap((course) => course.items);
  assert.ok(items.every((item) => item.status === "published"));
});

await run("GRD-006B", "Generic student portal hides drafts when no grades are published", async () => {
  const response = await request(`/portal/view?path=${encodeURIComponent("/student/grades")}`, {
    token: state.draftOnlyStudent.accessToken,
  });
  expectStatus(response, 200);
  const serialized = JSON.stringify(response.body).toLowerCase();
  assert.ok(!serialized.includes("status: draft"), "generic portal exposed a draft grade");
});

await run("PRO-003", "Student cannot request instructor profile role", async () => {
  const response = await request(`/portal/view?path=${encodeURIComponent("/instructor/profile")}`, {
    token: state.seedStudent.accessToken,
  });
  expectStatus(response, 403);
});

await run("AUTH-009B", "Student cannot request generic admin portal data", async () => {
  const response = await request(`/portal/view?path=${encodeURIComponent("/admin/users")}`, {
    token: state.seedStudent.accessToken,
  });
  expectStatus(response, 403);
});

await run("GRD-002", "Other instructor cannot read assigned gradebook", async () => {
  state.otherInstructor = await login("pendelton@heritage.edu", `qa-other-instructor-${runId}`);
  const response = await request("/gradebooks/77777777-7777-4777-8777-777777777701", {
    token: state.otherInstructor.accessToken,
  });
  assert.ok([403, 404].includes(response.status), `non-owner gradebook request returned HTTP ${response.status}`);
});

await run("GRD-003", "Score above max is rejected", async () => {
  const gradebook = await request("/gradebooks/77777777-7777-4777-8777-777777777701", {
    token: state.seedInstructor.accessToken,
  });
  expectStatus(gradebook, 200);
  const draft = gradebook.body.rows
    .filter((row) => row.studentNumber !== "ST-2024-001")
    .flatMap((row) => row.cells)
    .find((cell) => cell.status === "draft" && cell.gradeItemId !== "00000000-0000-4000-8000-000000000000");
  assert.ok(draft, "no draft grade was available for boundary test");
  const response = await request(`/grade-items/${draft.gradeItemId}`, {
    method: "PATCH",
    token: state.seedInstructor.accessToken,
    body: { score: draft.maxScore + 1, rowVersion: draft.rowVersion },
  });
  assert.ok([400, 422].includes(response.status), `over-max score was accepted with HTTP ${response.status}`);
});

await run("GRD-004", "Stale grade row version is rejected", async () => {
  const gradebook = await request("/gradebooks/77777777-7777-4777-8777-777777777701", {
    token: state.seedInstructor.accessToken,
  });
  expectStatus(gradebook, 200);
  const draft = gradebook.body.rows
    .filter((row) => row.studentNumber !== "ST-2024-001")
    .flatMap((row) => row.cells)
    .find((cell) => cell.status === "draft" && cell.gradeItemId !== "00000000-0000-4000-8000-000000000000");
  assert.ok(draft, "no real draft grade was available for concurrency test");
  const first = await request(`/grade-items/${draft.gradeItemId}`, {
    method: "PATCH",
    token: state.seedInstructor.accessToken,
    body: { score: Math.min(75, draft.maxScore), rowVersion: draft.rowVersion },
  });
  expectStatus(first, 200);
  const stale = await request(`/grade-items/${draft.gradeItemId}`, {
    method: "PATCH",
    token: state.seedInstructor.accessToken,
    body: { score: Math.min(76, draft.maxScore), rowVersion: draft.rowVersion },
  });
  expectStatus(stale, 409);
});

await run("GRD-004B", "Published grade cannot be edited", async () => {
  const response = await request("/grade-items/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01", {
    method: "PATCH",
    token: state.seedInstructor.accessToken,
    body: { score: 90, rowVersion: 1 },
  });
  expectStatus(response, 409);
});

await run("MSG-002A", "Student cannot ask about a draft grade", async () => {
  const response = await request("/messages/ask-grade", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: {
      relatedGradeItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      subject: "Draft grade question",
      body: "This draft must remain unavailable.",
    },
  });
  expectStatus(response, 404);
});

await run("JNY-002A", "Instructor submits a real draft for publication", async () => {
  const beforeNotifications = await request("/notifications/me", { token: state.seedStudent.accessToken });
  expectStatus(beforeNotifications, 200);
  state.gradeNotificationCount = beforeNotifications.body.items.filter((item) => item.templateKey === "grade.published").length;
  const gradebook = await request("/gradebooks/77777777-7777-4777-8777-777777777701", {
    token: state.seedInstructor.accessToken,
  });
  expectStatus(gradebook, 200);
  const marcus = gradebook.body.rows.find((row) => row.studentNumber === "ST-2024-001");
  const draft = marcus?.cells.find((cell) => cell.status === "draft");
  assert.ok(draft, "Marcus has no draft grade; reseed the disposable QA database before rerunning");
  state.publishGradeId = draft.gradeItemId;
  state.publishKey = `qa-publish-${runId}`;
  const response = await request("/gradebooks/77777777-7777-4777-8777-777777777701/publish", {
    method: "POST",
    token: state.seedInstructor.accessToken,
    headers: { "idempotency-key": state.publishKey },
    body: { gradeItemIds: [state.publishGradeId] },
  });
  expectStatus(response, 202);
  state.approvalId = response.body.approvalRequestId;
});

await run("GRD-005", "Publish request is idempotent", async () => {
  const response = await request("/gradebooks/77777777-7777-4777-8777-777777777701/publish", {
    method: "POST",
    token: state.seedInstructor.accessToken,
    headers: { "idempotency-key": state.publishKey },
    body: { gradeItemIds: [state.publishGradeId] },
  });
  assert.ok(response.status === 409 || response.body?.approvalRequestId === state.approvalId, "retry created a second approval request");
});

await run("APR-003", "Student cannot decide an approval", async () => {
  const response = await request(`/approvals/${state.approvalId}/decide`, {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: { decision: "approve", comment: "forbidden" },
  });
  expectStatus(response, 403);
});

await run("APR-001A", "Admin approves publication", async () => {
  const response = await request(`/approvals/${state.approvalId}/decide`, {
    method: "POST",
    token: state.admin.accessToken,
    body: { decision: "approve", comment: `Automated QA ${runId}` },
  });
  expectStatus(response, 200);
  assert.equal(response.body.status, "approved");
});

await run("APR-001B", "Admin applies publication", async () => {
  const response = await request(`/approvals/${state.approvalId}/apply`, {
    method: "POST",
    token: state.admin.accessToken,
  });
  expectStatus(response, 200);
  assert.equal(response.body.status, "applied");
});

await run("APR-004", "Applied approval cannot be applied twice", async () => {
  const response = await request(`/approvals/${state.approvalId}/apply`, {
    method: "POST",
    token: state.admin.accessToken,
  });
  expectStatus(response, 409);
});

await run("GRD-006", "Student sees newly published grade", async () => {
  const response = await request("/grades/me", { token: state.seedStudent.accessToken });
  expectStatus(response, 200);
  const items = response.body.courses.flatMap((course) => course.items);
  assert.ok(items.some((item) => item.id === state.publishGradeId && item.status === "published"));
  assert.ok(items.every((item) => item.status === "published"));
});

await run("NOT-008A", "Published-grade notification reaches student", async () => {
  await waitFor(async () => {
    const response = await request("/notifications/me", { token: state.seedStudent.accessToken });
    return response.body.items.filter((item) => item.templateKey === "grade.published").length > state.gradeNotificationCount;
  });
});

await run("MSG-001", "Student asks about published grade", async () => {
  const response = await request("/messages/ask-grade", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: {
      relatedGradeItemId: state.publishGradeId,
      subject: `Automated grade question ${runId}`,
      body: `Please explain this result. QA run ${runId}.`,
    },
  });
  expectStatus(response, 201);
  state.threadId = response.body.threadId;
});

await run("NOT-008B", "Instructor receives grade-question notification", async () => {
  await waitFor(async () => {
    const response = await request("/notifications/me", { token: state.seedInstructor.accessToken });
    return response.body.items.some((item) => item.templateKey === "message.received" && item.body.includes(runId));
  });
});

await run("MSG-002", "Student cannot ask about another student's grade", async () => {
  const response = await request("/messages/ask-grade", {
    method: "POST",
    token: state.seedStudent.accessToken,
    body: {
      relatedGradeItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
      subject: "Unauthorized grade question",
      body: "This must be rejected.",
    },
  });
  expectStatus(response, 404);
});

await run("PRO-004", "Student updates an immediate profile preference", async () => {
  const response = await request("/me/preferences", {
    method: "PATCH",
    token: state.newStudent.accessToken,
    body: { timezone: "America/Toronto" },
  });
  expectStatus(response, 200);
  assert.equal(response.body.timezone, "America/Toronto");
});

await run("PRO-005", "Official profile correction creates an approval", async () => {
  const response = await request("/me/profile-change-requests", {
    method: "POST",
    token: state.newStudent.accessToken,
    body: { familyName: "Student-QA", reason: `Verified correction request ${runId}` },
  });
  expectStatus(response, 202);
  assert.equal(response.body.status, "pending");
});

await run("NOT-006", "Student marks only an owned notification read", async () => {
  const inbox = await request("/notifications/me", { token: state.newStudent.accessToken });
  expectStatus(inbox, 200);
  const unread = inbox.body.items.find((item) => item.readAt == null);
  assert.ok(unread, "no unread notification was available");
  const response = await request(`/notifications/me/${unread.id}/read`, {
    method: "PATCH",
    token: state.newStudent.accessToken,
    body: {},
  });
  expectStatus(response, 200);
  assert.equal(response.body.changed, true);
  assert.ok(response.body.notification.readAt);
});

const summary = results.reduce(
  (counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  },
  {},
);

console.log(`\nHeritage automated journey ${runId}`);
console.log(`API ${API} | Web ${WEB}`);
for (const result of results) {
  const suffix = result.detail ? ` — ${result.detail}` : "";
  console.log(`${result.status.padEnd(5)} ${result.id.padEnd(10)} ${result.name}${suffix}`);
}
console.log("\nSummary", JSON.stringify(summary));
console.log("Test data", JSON.stringify({ ...data, password: undefined }));

if ((summary.FAIL ?? 0) > 0) process.exitCode = 1;
