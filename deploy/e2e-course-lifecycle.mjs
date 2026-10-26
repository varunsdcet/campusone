#!/usr/bin/env node
// API-level end-to-end course lifecycle: admin builds program / course / term / master schedule session,
// creates + assigns a teacher, creates + enrols a student; teacher publishes an assessment; student submits a PDF;
// teacher grades + submits for approval; admin approves + applies; student sees graded work, Completed course,
// program plan credits and attendance.
//
//   API_URL=http://127.0.0.1:4100 ADMIN_EMAIL=admin@heritage.edu ADMIN_PASSWORD='Heritage!2026' \
//     node deploy/e2e-course-lifecycle.mjs
//
// Plain Node 20 ESM, no dependencies. Every name / code / email carries a unique E2E_<stamp> prefix so it can be
// re-run against the same (throwaway) database. Stops at the first failure with exit code 1.

import { randomBytes } from "node:crypto";

const API = (process.env.API_URL || "http://127.0.0.1:4100").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@heritage.edu";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Heritage!2026";

const pad = (n, w = 2) => String(n).padStart(w, "0");
const now = new Date();
const STAMP =
  process.env.E2E_STAMP ||
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const PREFIX = `E2E_${STAMP}`;
const CODE = `E2E${STAMP}`;
const TEACHER_EMAIL = `e2e.${STAMP}.teacher@heritage.test`;
const STUDENT_EMAIL = `e2e.${STAMP}.student@heritage.test`;
const TEACHER_PASSWORD = `T!${randomBytes(9).toString("base64url")}9a`;
const STUDENT_PASSWORD = `S!${randomBytes(9).toString("base64url")}9a`;
const DEVICE = `e2e-lifecycle-${STAMP}`;

const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
// The section has already ended (end < today in any campus time zone) so a published passing mark makes the
// course "Completed" (lib/courseStatus.ts: hasFinalMark needs endsOn < today + published grades).
const DATES = {
  termStart: dayOffset(-120),
  termEnd: dayOffset(60),
  sectionStart: dayOffset(-60),
  sectionEnd: dayOffset(-2),
  assessmentOpen: dayOffset(-1),
  assessmentDue: dayOffset(7),
  attendance: dayOffset(-7),
};
const ASSESSMENT_SCORE = 88;
const FINAL_SCORE = 85;
const ASSESSMENT_WEIGHT = 20;
const COURSE_CREDITS = 3;

/* ------------------------------------------------------------------ */
/* HTTP + reporting                                                     */
/* ------------------------------------------------------------------ */

class StepFail extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}
class StepSkip extends Error {}

const fail = (message, body) => new StepFail("ASSERT", body ?? message);
const skip = (reason) => new StepSkip(reason);

function excerpt(body) {
  let text = typeof body === "string" ? body : JSON.stringify(body);
  text = (text ?? "")
    .replace(/"(accessToken|refreshToken|token|password|passwordHash)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\s+/g, " ");
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

async function call(method, path, { token, body, headers = {}, ok = [200, 201, 202] } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new StepFail(0, `${method} ${path} network error: ${err?.cause?.code || err?.message || err}`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!ok.includes(res.status)) throw new StepFail(res.status, `${method} ${path} → ${json ?? text}`);
  return json ?? {};
}

const results = [];

function summary() {
  const w = Math.max(...results.map((r) => r.step.length), 4);
  console.log("\n" + "=".repeat(w + 60));
  console.log(`SUMMARY  ${PREFIX}  (${API})`);
  console.log("-".repeat(w + 60));
  console.log(`${"STEP".padEnd(w)}  RESULT  ${"MS".padStart(6)}  DETAIL`);
  for (const r of results) console.log(`${r.step.padEnd(w)}  ${r.result.padEnd(6)}  ${String(r.ms).padStart(6)}  ${r.detail.slice(0, 120)}`);
  const count = (k) => results.filter((r) => r.result === k).length;
  console.log("-".repeat(w + 60));
  console.log(`PASS ${count("PASS")}  SKIP ${count("SKIP")}  FAIL ${count("FAIL")}`);
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = (await fn()) ?? "";
    results.push({ step: name, result: "PASS", ms: Date.now() - t0, detail: String(detail) });
    console.log(`PASS ${name} ${detail}`);
  } catch (err) {
    if (err instanceof StepSkip) {
      results.push({ step: name, result: "SKIP", ms: Date.now() - t0, detail: err.message });
      console.log(`SKIP ${name} ${err.message}`);
      return;
    }
    const status = err instanceof StepFail ? err.status : "ERROR";
    const body = err instanceof StepFail ? err.body : err?.stack || String(err);
    results.push({ step: name, result: "FAIL", ms: Date.now() - t0, detail: `${status} ${excerpt(body)}` });
    console.log(`FAIL ${name} ${status} ${excerpt(body)}`);
    summary();
    process.exit(1);
  }
}

async function login(email, password) {
  const r = await call("POST", "/auth/login", { body: { email, password, deviceFingerprint: DEVICE } });
  if (!r.accessToken) throw fail("login returned no accessToken", { ...r, accessToken: undefined });
  if (r.requiresMfa) throw fail("account requires MFA; cannot continue headless", { roles: r.roles });
  return r;
}

/* ------------------------------------------------------------------ */
/* State                                                                */
/* ------------------------------------------------------------------ */

const S = {
  admin: null,
  teacher: null,
  student: null,
  pmMeta: null,
  pmProgramId: null,
  programName: `${PREFIX} Program`,
  programAbbr: CODE,
  courseId: null,
  courseCode: CODE,
  courseTitle: `${PREFIX} Lifecycle Course`,
  pmTermId: null,
  scheduleId: null,
  sessionId: null,
  sectionId: null,
  teacherAccountId: null,
  teacherPersonId: null,
  studentId: null,
  studentAccountId: null,
  finalAssignmentId: null,
  assignmentId: null,
  assessmentTitle: `${PREFIX} Project`,
  pdf: null,
  fileId: null,
  approvals: [],
};

/* ------------------------------------------------------------------ */
/* Flow                                                                 */
/* ------------------------------------------------------------------ */

console.log(`E2E course lifecycle · ${PREFIX} · API ${API}`);
console.log(`Section ${DATES.sectionStart} → ${DATES.sectionEnd} · assessment open ${DATES.assessmentOpen} due ${DATES.assessmentDue}`);

// 1. Admin login
await step("01.admin.login", async () => {
  S.admin = (await login(ADMIN_EMAIL, ADMIN_PASSWORD)).accessToken;
  return `as ${ADMIN_EMAIL}`;
});
const A = () => S.admin;

// 2. Program (Program Management → Faculties & Programs) and Course (Course Management → Add Course)
await step("02a.program.meta", async () => {
  S.pmMeta = await call("GET", "/admin/heritage/programs/meta", { token: A() });
  const fac = S.pmMeta.faculties?.find((f) => f.active !== "Inactive") ?? S.pmMeta.faculties?.[0];
  const type = S.pmMeta.programTypes?.find((t) => t.active !== "Inactive") ?? S.pmMeta.programTypes?.[0];
  if (!fac || !type) throw fail("Program Management has no faculty or program type", { faculties: S.pmMeta.faculties?.length, programTypes: S.pmMeta.programTypes?.length });
  S.facultyId = fac.id;
  S.programTypeId = type.id;
  return `faculty="${fac.label}" type="${type.label}" campuses=${(S.pmMeta.lists?.campuses ?? []).length}`;
});

await step("02b.program.create", async () => {
  const r = await call("POST", "/admin/heritage/programs/e/programs", {
    token: A(),
    body: {
      faculty: S.facultyId,
      name: S.programName,
      abbreviation: S.programAbbr,
      programType: S.programTypeId,
      active: "Active",
      scheduleType: "Sequential",
      programLength: 6,
      programLengthUnit: "Months",
      programCredits: COURSE_CREDITS,
    },
  });
  if (!r.id) throw fail("no program id", r);
  S.pmProgramId = r.id;
  const lite = await call("GET", "/admin/programs-lite", { token: A() });
  const sis = lite.items?.find((p) => p.name === S.programName);
  if (!sis) throw fail("program not synced to SIS /admin/programs-lite", { searched: S.programName });
  return `pmProgramId=${r.id} sisProgram=${sis.code}`;
});

await step("02c.course.create", async () => {
  const meta = await call("GET", "/admin/heritage/courses/meta", { token: A() });
  let categoryId = meta.refs?.courseCategories?.[0]?.id;
  if (!categoryId) {
    const cat = await call("POST", "/admin/heritage/courses/e/categories", {
      token: A(),
      body: { parent: "primary", faculty: "Unassigned", name: `${PREFIX} Category`, active: "Active" },
    });
    categoryId = cat.id ?? cat.item?.id ?? cat.record?.id;
    if (!categoryId) throw fail("could not create a course category", cat);
  }
  const r = await call("POST", "/admin/heritage/courses/courses", {
    token: A(),
    body: {
      category: categoryId,
      name: S.courseTitle,
      number: S.courseCode,
      credits: COURSE_CREDITS,
      description: "Created by deploy/e2e-course-lifecycle.mjs",
    },
  });
  if (!r.id) throw fail("no course id", r);
  S.courseId = r.id;
  const got = await call("GET", `/admin/heritage/courses/courses/${r.id}`, { token: A() });
  const credits = Number(got.values?.credits ?? got.credits);
  if (credits !== COURSE_CREDITS) throw fail("course credits not saved", got);
  return `courseId=${r.id} code=${S.courseCode} credits=${credits}`;
});

// 3. Term, master schedule and schedule session (= the course section / offering with real dates)
await step("03a.term.create", async () => {
  const campus = S.pmMeta.lists?.campuses?.[0];
  if (!campus) throw fail("no campus available for the term", S.pmMeta.lists);
  const r = await call("POST", "/admin/heritage/programs/e/terms", {
    token: A(),
    body: { name: `${PREFIX} Term`, abbreviation: CODE, campuses: [campus], startDate: DATES.termStart, endDate: DATES.termEnd },
  });
  if (!r.id) throw fail("no term id", r);
  S.pmTermId = r.id;
  return `pmTermId=${r.id} ${DATES.termStart}→${DATES.termEnd} campus="${campus}"`;
});

await step("03b.schedule.create", async () => {
  const r = await call("POST", "/admin/heritage/programs/e/programSchedules", {
    token: A(),
    body: { program: S.pmProgramId, abbreviation: CODE, description: `${PREFIX} master schedule`, length: 8, lengthUnit: "Weeks" },
  });
  if (!r.id) throw fail("no schedule id", r);
  S.scheduleId = r.id;
  return `scheduleId=${r.id}`;
});

await step("03c.session.create", async () => {
  const r = await call("POST", "/admin/heritage/programs/e/sessions", {
    token: A(),
    body: {
      parentId: S.scheduleId,
      course: S.courseId,
      sessionName: `${PREFIX} S1`,
      feedIn: true,
      deliveryMethod: "Online",
      startDate: DATES.sectionStart,
      endDate: DATES.sectionEnd,
      term: S.pmTermId,
    },
  });
  if (!r.id) throw fail("no session id", r);
  if (!r.sectionId) throw fail("session was not linked to a course section", r);
  S.sessionId = r.id;
  S.sectionId = r.sectionId;
  return `sessionId=${r.id} sectionId=${r.sectionId} ${DATES.sectionStart}→${DATES.sectionEnd}`;
});

// 4. Teacher account + assign to the section (edit the schedule session's Instructor(s))
await step("04a.teacher.create", async () => {
  const r = await call("POST", "/admin/users", {
    token: A(),
    body: { email: TEACHER_EMAIL, givenName: "E2E", familyName: `Teacher ${STAMP}`, role: "instructor", password: TEACHER_PASSWORD },
  });
  if (r.role !== "instructor" || !r.accountId) throw fail("unexpected create-user response", r);
  S.teacherAccountId = r.accountId;
  S.teacherPersonId = r.personId;
  return `${TEACHER_EMAIL} accountId=${r.accountId}`;
});

await step("04b.teacher.assign", async () => {
  await call("PATCH", `/admin/heritage/programs/e/sessions/${S.sessionId}`, { token: A(), body: { instructors: [S.teacherAccountId] } });
  const sections = await call("GET", "/admin/sections", { token: A() });
  const sec = sections.items?.find((x) => x.sectionId === S.sectionId);
  if (!sec) throw fail("section missing from /admin/sections", { sectionId: S.sectionId });
  if (sec.instructorPersonId !== S.teacherPersonId) throw fail("section instructor not updated", sec);
  const session = await call("GET", `/admin/heritage/courses/sessions/${S.sectionId}`, { token: A() });
  return `section ${sec.code} (${sec.courseCode}) instructor="${sec.instructorName}" dates=${session.values?.startDate}→${session.values?.endDate}`;
});

// 5. Student account with the program, then Student 360 › Program Plan enrolment (enrols the feed-in section)
await step("05a.student.create", async () => {
  const r = await call("POST", "/admin/users", {
    token: A(),
    body: { email: STUDENT_EMAIL, givenName: "E2E", familyName: `Student ${STAMP}`, role: "student", password: STUDENT_PASSWORD, programName: S.programName },
  });
  if (r.role !== "student" || !r.studentId) throw fail("unexpected create-user response", r);
  S.studentId = r.studentId;
  S.studentAccountId = r.accountId;
  return `${STUDENT_EMAIL} studentId=${r.studentId} number=${r.studentNumber}`;
});

await step("05b.student.enrol", async () => {
  const plan = await call("GET", `/admin/heritage/students/${S.studentId}/plan`, { token: A() });
  const feedIn = plan.feedIns?.find((x) => x.id === S.sessionId);
  if (!feedIn) throw fail("feed-in session not offered on Student 360 › Program Plan", { feedIns: plan.feedIns?.length });
  const r = await call("POST", `/admin/heritage/students/${S.studentId}/plan/enrol`, {
    token: A(),
    body: {
      programId: S.pmProgramId,
      scheduleId: S.scheduleId,
      sessionId: S.sessionId,
      status: "Active Student",
      rateCategory: "Domestic",
      courseScope: "schedule",
      postFee: true,
    },
  });
  const course = r.courses?.find((c) => c.sectionId === S.sectionId);
  if (!course) throw fail("enrolment response does not include the section", r);
  if (course.status !== "enrolled" && course.status !== "existing") throw fail(`enrolment status ${course.status}`, r);
  const fee = course.fee ? `fee=${course.fee.amount}` : `feeNote="${course.feeNote ?? "none"}"`;
  return `enrolmentId=${course.enrolmentId} status=${course.status} ${fee}`;
});

// 6. Teacher login, My Courses, gradebook (opening it creates the "Final Grade" column when the section has none)
await step("06a.teacher.login", async () => {
  S.teacher = (await login(TEACHER_EMAIL, TEACHER_PASSWORD)).accessToken;
  return TEACHER_EMAIL;
});
const T = () => S.teacher;

await step("06b.teacher.myCourses", async () => {
  const r = await call("GET", "/courses/me", { token: T() });
  const item = r.items?.find((i) => i.sectionId === S.sectionId);
  if (!item) throw fail("section not in teacher /courses/me", r);
  return `${item.code} enrolled=${item.enrolmentCount} term=${item.termCode}`;
});

await step("06c.teacher.gradebook.open", async () => {
  const g = await call("GET", `/gradebooks/${S.sectionId}`, { token: T() });
  if (!g.rows?.some((r) => r.studentId === S.studentId)) throw fail("student not on gradebook roster", g);
  const final = g.assignments?.find((a) => /final grade/i.test(a.title));
  S.finalAssignmentId = final?.id ?? null;
  return `columns=${g.assignments?.map((a) => a.title).join("|")}`;
});

// 7. Teacher creates + publishes an assessment (t19 Create / Edit Assessment → Publish Assessment)
await step("07.teacher.assessment.publish", async () => {
  const path = `/instructor/f/t19-create-edit-assessment?sectionId=${S.sectionId}`;
  const r = await call("POST", "/instructor/sis/action", {
    token: T(),
    body: {
      path,
      action: "Publish Assessment",
      rowKey: JSON.stringify({
        sectionId: S.sectionId,
        title: S.assessmentTitle,
        type: "Project",
        weight: `${ASSESSMENT_WEIGHT}%`,
        openDate: DATES.assessmentOpen,
        dueDate: DATES.assessmentDue,
        rubricRows: [{ criterion: "Content", excellent: "Complete", good: "Minor gaps", poor: "Major gaps" }],
      }),
    },
  });
  if (r.ok === false || !r.result?.assignmentId) throw fail("assessment not published", { message: r.message, result: r.result });
  S.assignmentId = r.result.assignmentId;
  const subs = await call("GET", `/instructor/sections/${S.sectionId}/submissions?assignmentId=${S.assignmentId}`, { token: T() });
  if (!subs.assignments?.some((a) => a.id === S.assignmentId)) throw fail("assessment not listed on the section", subs);
  return `assignmentId=${S.assignmentId} "${r.message}"`;
});

// 8. Student login, sees the course and assessment, uploads a PDF and submits
await step("08a.student.login", async () => {
  S.student = (await login(STUDENT_EMAIL, STUDENT_PASSWORD)).accessToken;
  return STUDENT_EMAIL;
});
const St = () => S.student;

await step("08b.student.myCourses", async () => {
  const r = await call("GET", "/courses/me", { token: St() });
  const c = r.courses?.find((x) => x.sectionId === S.sectionId);
  if (!c) throw fail("course not in student /courses/me", r);
  return `${c.courseCode} enrolment=${c.enrolmentStatus} courseStatus=${c.courseStatus} ${c.startsOn}→${c.endsOn}`;
});

await step("08c.student.assignment.visible", async () => {
  const r = await call("GET", "/student/assignments", { token: St() });
  const a = r.assignments?.find((x) => x.id === S.assignmentId);
  if (!a) throw fail("assessment not visible to student", { count: r.assignments?.length });
  if (a.state === "overdue" || a.state === "graded") throw fail(`unexpected assessment state ${a.state}`, a);
  return `state=${a.state} due=${a.dueAt} opens=${a.availableFrom}`;
});

await step("08d.student.upload", async () => {
  const content = `%PDF-1.4\n% ${PREFIX} submission\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`;
  S.pdf = Buffer.from(content, "latin1");
  const r = await call("POST", `/student/assignments/${S.assignmentId}/files`, {
    token: St(),
    body: { filename: `${CODE}-submission.pdf`, mimeType: "application/pdf", sizeBytes: S.pdf.byteLength, contentBase64: S.pdf.toString("base64") },
  });
  const file = r.submission?.files?.at(-1);
  if (!file) throw fail("upload response has no file", r);
  S.fileId = file.id;
  return `fileId=${file.id} ${file.sizeBytes} bytes`;
});

await step("08e.student.submit", async () => {
  const r = await call("POST", `/student/assignments/${S.assignmentId}/submit`, { token: St(), body: {} });
  if (r.submission?.status !== "submitted") throw fail("submission not submitted", r);
  return `submittedAt=${r.submission.submittedAt}`;
});

// 9. Teacher reviews the submission, grades it, submits for approval; then posts and submits the Final Grade
await step("09a.teacher.submissions.list", async () => {
  const r = await call("GET", `/instructor/sections/${S.sectionId}/submissions?assignmentId=${S.assignmentId}`, { token: T() });
  const row = r.rows?.find((x) => x.studentId === S.studentId);
  if (row?.submission?.status !== "submitted") throw fail("submitted work not visible to teacher", row ?? r);
  if (!row.submission.files?.some((f) => f.id === S.fileId)) throw fail("uploaded file missing from submission", row.submission);
  return `status=${row.submission.status} files=${row.submission.files.length}`;
});

await step("09b.teacher.file.download", async () => {
  const r = await call("GET", `/instructor/submission-files/${S.fileId}`, { token: T() });
  const bytes = Buffer.from(r.base64 ?? "", "base64");
  if (!bytes.equals(S.pdf)) throw fail("downloaded bytes differ from upload", { name: r.name, got: bytes.byteLength, want: S.pdf.byteLength });
  return `${r.name} ${bytes.byteLength} bytes match`;
});

async function draftGradeItemId(assignmentId) {
  const g = await call("GET", `/gradebooks/${S.sectionId}`, { token: T() });
  const cell = g.rows?.find((r) => r.studentId === S.studentId)?.cells?.find((c) => c.assignmentId === assignmentId);
  if (!cell || cell.status !== "draft" || cell.score == null) throw fail("no saved draft grade to submit", cell ?? g);
  return cell.gradeItemId;
}

async function submitForApproval(gradeItemId, key) {
  const r = await call("POST", `/gradebooks/${S.sectionId}/publish`, {
    token: T(),
    headers: { "idempotency-key": `e2e-${STAMP}-${key}` },
    body: { gradeItemIds: [gradeItemId] },
    ok: [202],
  });
  if (!r.approvalRequestId) throw fail("no approval request created", r);
  S.approvals.push(r.approvalRequestId);
  return r;
}

await step("09c.teacher.grade.assessment", async () => {
  const r = await call("POST", "/grade-items", {
    token: T(),
    body: { assignmentId: S.assignmentId, studentId: S.studentId, score: ASSESSMENT_SCORE, feedback: `${PREFIX} feedback: solid work.` },
  });
  if (Number(r.score) !== ASSESSMENT_SCORE || r.status !== "draft") throw fail("draft grade not saved", r);
  return `score=${r.score} letter=${r.letter} status=${r.status}`;
});

await step("09d.teacher.submit.assessment", async () => {
  const id = await draftGradeItemId(S.assignmentId);
  const r = await submitForApproval(id, "assessment");
  return `approvalRequestId=${r.approvalRequestId} status=${r.status}`;
});

await step("09e.teacher.grade.final", async () => {
  if (!S.finalAssignmentId) throw skip('gradebook has no "Final Grade" column (section already had assessments when first opened)');
  const r = await call("POST", "/grade-items", {
    token: T(),
    body: { assignmentId: S.finalAssignmentId, studentId: S.studentId, score: FINAL_SCORE, feedback: `${PREFIX} final grade` },
  });
  if (Number(r.score) !== FINAL_SCORE) throw fail("final grade not saved", r);
  return `score=${r.score} letter=${r.letter}`;
});

await step("09f.teacher.submit.final", async () => {
  if (!S.finalAssignmentId) throw skip("no Final Grade column");
  const id = await draftGradeItemId(S.finalAssignmentId);
  const r = await submitForApproval(id, "final");
  return `approvalRequestId=${r.approvalRequestId} status=${r.status}`;
});

// 10. Admin approvals inbox: approve, then apply to record
await step("10a.admin.approvals.list", async () => {
  const r = await call("GET", "/approvals", { token: A() });
  for (const id of S.approvals) {
    const item = r.items?.find((x) => x.id === id);
    if (!item) throw fail(`approval ${id} not in admin inbox`, { count: r.items?.length });
    if (item.status !== "pending") throw fail(`approval ${id} is ${item.status}`, item);
  }
  return `${S.approvals.length} grade approval(s) pending`;
});

await step("10b.admin.approve.apply", async () => {
  const out = [];
  for (const id of S.approvals) {
    const d = await call("POST", `/approvals/${id}/decide`, { token: A(), body: { decision: "approve", comment: `${PREFIX} approved` } });
    if (d.status !== "approved") throw fail(`approval ${id} not approved after decision`, d);
    const a = await call("POST", `/approvals/${id}/apply`, { token: A(), body: {} });
    if (a.status !== "applied") throw fail(`approval ${id} not applied`, a);
    out.push(`${id.slice(0, 8)}:${a.status}`);
  }
  return out.join(" ");
});

await step("10c.teacher.gradebook.published", async () => {
  const g = await call("GET", `/gradebooks/${S.sectionId}`, { token: T() });
  const cells = g.rows?.find((r) => r.studentId === S.studentId)?.cells ?? [];
  const want = [S.assignmentId, S.finalAssignmentId].filter(Boolean);
  const bad = want.filter((id) => cells.find((c) => c.assignmentId === id)?.status !== "published");
  if (bad.length) throw fail("grades not published", cells);
  return `${want.length} grade(s) published`;
});

// 11. Student sees graded work, Completed course, program plan credits, transcript
await step("11a.student.assignment.graded", async () => {
  const r = await call("GET", `/student/assignments/${S.assignmentId}`, { token: St() });
  const a = r.assignment;
  if (a?.state !== "graded") throw fail(`assessment state ${a?.state}`, a);
  if (Number(a.grade?.score) !== ASSESSMENT_SCORE) throw fail("published score mismatch", a.grade);
  if (!a.grade?.feedback?.includes(PREFIX)) throw fail("feedback not visible", a.grade);
  return `score=${a.grade.score}/${a.grade.maxScore} letter=${a.grade.letter} feedback="${a.grade.feedback}"`;
});

await step("11b.student.grades", async () => {
  const r = await call("GET", "/grades/me", { token: St() });
  const c = r.courses?.find((x) => x.sectionId === S.sectionId);
  if (!c) throw fail("course missing from /grades/me", r);
  const published = c.items?.filter((i) => i.status === "published") ?? [];
  if (!published.length) throw fail("no published grade items", c);
  return `currentPercent=${c.currentPercent} letter=${c.letter} published=${published.length} cgpa=${r.cumulativeGpa}`;
});

await step("11c.student.courseStatus", async () => {
  const r = await call("GET", "/courses/me", { token: St() });
  const c = r.courses?.find((x) => x.sectionId === S.sectionId);
  if (!c) throw fail("course missing from /courses/me", r);
  const expected = c.endsOn && c.endsOn < ymd(new Date()) ? "completed" : "in_progress";
  if (c.courseStatus !== expected) throw fail(`courseStatus=${c.courseStatus}, expected ${expected} (endsOn=${c.endsOn})`, c);
  return `courseStatus=${c.courseStatus} progress=${c.progressPercent}% endsOn=${c.endsOn}`;
});

await step("11d.student.programPlan", async () => {
  const r = await call("GET", "/student/program-plan", { token: St() });
  if (!r.planId) throw fail("student has no program plan", r);
  const item = [...(r.main ?? []), ...(r.practicum ?? []), ...(r.makeup ?? [])].find((i) => i.courseCode === S.courseCode);
  if (!item) throw fail("course missing from program plan", { main: r.main?.map((i) => i.courseCode) });
  if (item.status !== "completed" || !item.grade) throw fail(`plan item status=${item.status} grade=${item.grade}`, item);
  if ((r.summary?.earnedCredits ?? 0) < COURSE_CREDITS) throw fail("credits not earned on plan", r.summary);
  return `status=${item.status} grade=${item.grade} credits=${item.credits} earned=${r.summary.earnedCredits}/${r.summary.totalCredits} cgpa=${r.summary.cgpa}`;
});

await step("11e.student.transcript", async () => {
  const r = await call("GET", "/student/transcript-summary", { token: St() });
  const c = r.courses?.find((x) => x.sectionId === S.sectionId);
  if (!c) throw fail("course missing from transcript", r);
  if (!c.final || c.letter === "F" || c.letter === "IP") throw fail(`transcript row final=${c.final} letter=${c.letter}`, c);
  return `program="${r.programName}" letter=${c.letter} pct=${c.averagePercent} gp=${c.gradePoints} earned=${r.earnedCredits}`;
});

await step("11f.admin.finalMarks", async () => {
  const r = await call("GET", `/admin/heritage/students/${S.studentId}/final-marks`, { token: A() });
  const row = r.items?.find((x) => String(x.course).startsWith(S.courseCode));
  if (!row) throw fail("course missing from Student 360 final marks", r);
  if (row.status !== "Completed") throw fail(`final marks status=${row.status}`, row);
  return `finalGrade=${row.finalGrade} status=${row.status} earnedCredits=${r.earnedCredits}`;
});

// 12. Attendance: teacher submits a session date, student sees it
await step("12a.teacher.attendance", async () => {
  const r = await call("POST", "/instructor/sis/action", {
    token: T(),
    body: {
      path: "/instructor/attendance",
      action: "Submit & Finalize Attendance",
      rowKey: JSON.stringify({ date: DATES.attendance, roster: [{ studentId: S.studentId, sectionId: S.sectionId, status: "Present", note: PREFIX }] }),
    },
  });
  const row = r.result?.roster?.find((x) => x.studentId === S.studentId && x.sectionId === S.sectionId);
  if (r.ok === false || r.result?.finalized !== true || row?.status !== "Present") throw fail("attendance not finalized", { message: r.message, result: r.result });
  return `${DATES.attendance} "${r.message}"`;
});

await step("12b.student.attendance", async () => {
  const r = await call("GET", "/student/attendance", { token: St() });
  const rec = r.records?.find((x) => x.sectionId === S.sectionId && x.meetingLabel === DATES.attendance);
  if (!rec) throw fail("attendance record not visible to student", { count: r.records?.length });
  if (rec.status !== "present") throw fail(`attendance status ${rec.status}`, rec);
  return `${rec.meetingLabel} ${rec.status} (present=${r.presentCount})`;
});

summary();
process.exit(0);
