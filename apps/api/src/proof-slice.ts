/**
 * WP0 proof slice:
 * instructor grades → publish → approval → apply → student sees published → ask about grade
 * Asserts audit + outbox rows exist.
 */
import { prisma } from "@myheritage/db";

const API = process.env.API_URL ?? "http://localhost:4000";
const SECTION = "77777777-7777-4777-8777-777777777701";
const GRADE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Heritage!2026",
      deviceFingerprint: "proof-device-fingerprint",
    }),
  });
  if (!res.ok) throw new Error(`login failed ${email}: ${await res.text()}`);
  return res.json() as Promise<{ accessToken: string }>;
}

async function main() {
  const instructor = await login("vance.instructor@heritage.edu");
  const admin = await login("admin@heritage.edu");
  const student = await login("marcus.vance@heritage.edu");

  const beforeStudent = await fetch(`${API}/grades/me`, {
    headers: { authorization: `Bearer ${student.accessToken}` },
  }).then((r) => r.json()) as { courses?: Array<{ items?: unknown[] }> };
  const beforeCount = beforeStudent.courses?.[0]?.items?.length ?? 0;

  const pub = await fetch(`${API}/gradebooks/${SECTION}/publish`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${instructor.accessToken}`,
      "content-type": "application/json",
      "idempotency-key": `proof-${Date.now()}`,
    },
    body: JSON.stringify({ gradeItemIds: [GRADE] }),
  });
  if (pub.status !== 202) throw new Error(`publish failed: ${await pub.text()}`);
  const { approvalRequestId } = (await pub.json()) as { approvalRequestId: string };

  const decide = await fetch(`${API}/approvals/${approvalRequestId}/decide`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${admin.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ decision: "approve", comment: "Looks correct" }),
  });
  if (!decide.ok) throw new Error(`decide failed: ${await decide.text()}`);

  const apply = await fetch(`${API}/approvals/${approvalRequestId}/apply`, {
    method: "POST",
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  if (!apply.ok) throw new Error(`apply failed: ${await apply.text()}`);

  const afterStudent = await fetch(`${API}/grades/me`, {
    headers: { authorization: `Bearer ${student.accessToken}` },
  }).then((r) => r.json()) as { courses?: Array<{ items?: unknown[] }> };
  const afterCount = afterStudent.courses?.[0]?.items?.length ?? 0;
  if (afterCount <= beforeCount) throw new Error("Student did not see newly published grade");

  const ask = await fetch(`${API}/messages/ask-grade`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${student.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      relatedGradeItemId: GRADE,
      body: "Can you explain how the midterm was scored?",
      subject: "Ask about this grade",
    }),
  });
  if (!ask.ok) throw new Error(`ask-grade failed: ${await ask.text()}`);

  const audits = await prisma.auditEvent.count({
    where: {
      eventName: { in: ["GradeItem.publishRequested", "ApprovalRequest.decided", "GradeItem.published", "Message.sent"] },
    },
  });
  const outbox = await prisma.eventOutbox.count({
    where: { eventName: { in: ["GradeItem.publishRequested", "GradeItem.published", "Message.sent"] } },
  });
  if (audits < 4) throw new Error(`Expected >=4 audit events, got ${audits}`);
  if (outbox < 3) throw new Error(`Expected >=3 outbox rows, got ${outbox}`);

  console.log("PROOF SLICE OK");
  console.log(JSON.stringify({ approvalRequestId, publishedItems: afterCount, audits, outbox }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
