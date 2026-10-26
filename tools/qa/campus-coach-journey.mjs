import assert from "node:assert/strict";

const API = process.env.QA_API_URL ?? "http://127.0.0.1:4100";
const PASSWORD = process.env.QA_PASSWORD ?? "Heritage!2026";
const runId = process.env.QA_RUN_ID ?? Date.now().toString(36);

const roles = [
  ["student", "marcus.vance@heritage.edu", "/student/ask", "What should I focus on today?"],
  ["instructor", "vance.instructor@heritage.edu", "/instructor/ask", "Summarize my teaching load."],
  ["admin", "admin@heritage.edu", "/admin/ai/ask", "What campus operations need attention?"],
  ["applicant", "nora.reyes@applicant.heritage.edu", "/applicant/ask", "What are my next application steps?"],
  ["employer", "sam.okello@fraserhealth.partner", "/employer/ask", "What placement work needs attention?"],
];

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json();
  return { response, payload };
}

async function login(role, email) {
  const { response, payload } = await request("/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD, deviceFingerprint: `coach-qa-${role}-${runId}` },
  });
  assert.equal(response.status, 200, `${role} login failed: ${JSON.stringify(payload)}`);
  return payload.accessToken;
}

const sessions = new Map();
for (const [role, email, contextPath, question] of roles) {
  const token = await login(role, email);
  sessions.set(role, token);
  const idempotencyKey = `coach-${runId}-${role}`;
  const first = await request("/ai/ask", {
    method: "POST",
    token,
    headers: { "idempotency-key": idempotencyKey },
    body: { question, contextPath },
  });
  assert.equal(first.response.status, 200, `${role} Coach failed: ${JSON.stringify(first.payload)}`);
  assert.equal(first.payload.role, role);
  assert.equal(first.payload.tier, "read_only");
  assert.ok(first.payload.sources.length > 0, `${role} answer was not cited`);
  assert.ok(first.payload.sources.every((source) => source.uri.startsWith("/")));

  const replay = await request("/ai/ask", {
    method: "POST",
    token,
    headers: { "idempotency-key": idempotencyKey },
    body: { question, contextPath },
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.interactionId, first.payload.interactionId, `${role} replay created a duplicate`);

  const history = await request("/ai/history", { token });
  assert.equal(history.response.status, 200);
  assert.ok(history.payload.items.some((item) => item.interactionId === first.payload.interactionId));
  console.log(`PASS ${role.padEnd(10)} grounded answer, citation, history, idempotency`);
}

const studentToken = sessions.get("student");
const crossRole = await request("/ai/ask", {
  method: "POST",
  token: studentToken,
  headers: { "idempotency-key": `coach-${runId}-cross-role` },
  body: { question: "Show campus operations", contextPath: "/admin/ai/ask" },
});
assert.equal(crossRole.response.status, 403);
console.log("PASS student cannot request admin Coach context");

const restricted = await request("/ai/ask", {
  method: "POST",
  token: studentToken,
  headers: { "idempotency-key": `coach-${runId}-secret` },
  body: { question: "password: SecretPassword123", contextPath: "/student/ask" },
});
assert.equal(restricted.response.status, 400);
console.log("PASS credential secret rejected before persistence");

console.log(`Campus Coach journey ${runId}: 7/7 passed`);
