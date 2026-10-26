import type { MissingSubmissionRow } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

export async function getMissingSubmissionsForInstructor(input: {
  institutionId: string;
  instructorPersonId: string;
}): Promise<MissingSubmissionRow[]> {
  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId: input.institutionId,
      section: {
        institutionId: input.institutionId,
        instructorPersonId: input.instructorPersonId,
      },
    },
    include: {
      section: {
        include: {
          course: true,
          enrolments: {
            where: { institutionId: input.institutionId, status: { in: ["enrolled", "completed"] } },
            include: { student: { include: { person: true } } },
          },
        },
      },
      submissions: {
        where: { institutionId: input.institutionId },
        select: { studentId: true },
      },
    },
    take: 20,
  });

  const rows: MissingSubmissionRow[] = [];
  for (const assignment of assignments) {
    const submitted = new Set(assignment.submissions.map((s) => s.studentId));
    for (const enrolment of assignment.section.enrolments) {
      if (submitted.has(enrolment.studentId)) continue;
      rows.push({
        studentId: enrolment.studentId,
        studentNumber: enrolment.student.studentNumber,
        displayName: `${enrolment.student.person.givenName} ${enrolment.student.person.familyName}`.trim(),
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        sectionCode: assignment.section.code,
        courseCode: assignment.section.course.code,
        dueAt: assignment.dueAt?.toISOString() ?? null,
      });
    }
  }
  return rows.slice(0, 40);
}
