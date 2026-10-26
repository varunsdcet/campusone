import { prisma } from "@myheritage/db";

/** Server-owned exam lock. Browser flags are intentionally not trusted. */
export async function hasOpenAssessmentAttempt(institutionId: string, studentId: string) {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: {
      institutionId,
      studentId,
      status: "open",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(attempt);
}
