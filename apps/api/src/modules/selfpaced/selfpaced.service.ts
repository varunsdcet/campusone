import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { expectedActivityIds, selfpacedCourse } from "./catalogue.js";
import { listSelfpacedPrograms } from "./catalogue.service.js";

const fail = (status: number, code: string, message: string) => Object.assign(new Error(message), { status, code });

export const CompletionBody = z.object({
  slug: z.string().min(1).max(120),
  completedActivityIds: z.array(z.string().min(1).max(120)).max(2000),
  assessmentsPassed: z.literal(true, { errorMap: () => ({ message: "Every chapter assessment and the final exam must be passed" }) }),
});

export const sourceKeyFor = (slug: string) => `selfpaced:${slug}`;

/** Activity ids the learner still has to finish; empty when the claimed progress covers the whole curriculum. */
export function outstandingActivities(slug: string, completed: readonly string[]) {
  const course = selfpacedCourse(slug);
  if (!course) return null;
  const done = new Set(completed);
  return expectedActivityIds(course).filter((id) => !done.has(id));
}

function view(row: { id: string; title: string; earnedAt: Date | null; createdAt: Date }, holderName: string, created: boolean) {
  return { certificateId: row.id, title: row.title, holderName, issuedAt: (row.earnedAt ?? row.createdAt).toISOString(), created, verifyPath: `/verify/${row.id}` };
}

/**
 * Records completion of a self-paced course and issues its credential. Idempotent per learner and course:
 * repeated calls (other tabs, retries) return the credential issued the first time.
 */
export async function issueSelfpacedCertificate(user: SessionClaims, input: unknown) {
  const parsed = CompletionBody.safeParse(input);
  if (!parsed.success) throw fail(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid completion record");
  const { slug, completedActivityIds } = parsed.data;
  const builtIn = selfpacedCourse(slug);
  const dynamic = builtIn ? null : (await listSelfpacedPrograms(user.institutionId)).find((item) => item.slug === slug);
  if (!builtIn && !dynamic) throw fail(404, "NOT_FOUND", "Unknown self-paced course");
  const expected = builtIn
    ? expectedActivityIds(builtIn)
    : (dynamic?.curriculum || []).flatMap((chapter) => chapter.activities.map((activity) => activity.id));
  const done = new Set(completedActivityIds);
  const outstanding = expected.filter((id) => !done.has(id));
  if (outstanding.length) throw fail(409, "COURSE_INCOMPLETE", `Finish every activity before the certificate is issued (${outstanding.length} remaining)`);

  const enrolmentPath = `selfpaced:enrolment:${user.accountId}:${slug}`;
  const enrolment = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: user.institutionId, path: enrolmentPath } },
    select: { id: true },
  });
  if (!enrolment) throw fail(403, "ENROLMENT_REQUIRED", "You must be enrolled in this self-paced course before a certificate can be issued.");

  const student = await prisma.student.findFirst({
    where: { institutionId: user.institutionId, personId: user.personId },
    select: { id: true, person: { select: { givenName: true, preferredName: true, familyName: true } } },
  });
  if (!student) throw fail(403, "STUDENT_PROFILE_REQUIRED", "Certificates are issued to Heritage learner accounts. Sign in with your student account.");
  const holderName = `${student.person.preferredName || student.person.givenName} ${student.person.familyName}`.trim();
  const sourceKey = sourceKeyFor(slug);

  const existing = await prisma.credentialRecord.findFirst({ where: { studentId: student.id, sourceKey } });
  if (existing) return view(existing, holderName, false);

  const now = new Date();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.credentialRecord.create({
        data: {
          institutionId: user.institutionId,
          studentId: student.id,
          title: builtIn?.title || dynamic!.title,
          status: "earned",
          detail: `Self-paced course completed · ${completedActivityIds.length} activities`,
          earnedAt: now,
          sourceKey,
        },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "Credential.issued",
        purpose: "selfpaced_completion",
        before: null,
        after: { credentialId: created.id, studentId: student.id, course: slug },
        source: "selfpaced.complete",
        correlationId: randomUUID(),
        outboxPayload: { credentialId: created.id, studentId: student.id, course: slug },
      });
      return created;
    });
    return view(row, holderName, true);
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
    const raced = await prisma.credentialRecord.findFirst({ where: { studentId: student.id, sourceKey } });
    if (!raced) throw err;
    return view(raced, holderName, false);
  }
}
