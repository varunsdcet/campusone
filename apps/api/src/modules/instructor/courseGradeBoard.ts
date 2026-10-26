import { prisma } from "@myheritage/db";

export type CourseGradeBoard = {
  assignments: Array<{ id: string; title: string; weightPercent: number; maxScore: number; submitted: number }>;
  rows: Array<{
    studentId: string;
    name: string;
    studentNumber: string;
    cells: Array<{ assignmentId: string; mark: string | null; status: string }>;
    total: string | null;
  }>;
  gradebookHref: string;
  submissionsHref: string;
};

/** Live gradebook summary for the course workspace Grades tab (same data as /gradebooks/:sectionId). */
export async function loadCourseGradeBoard(institutionId: string, sectionId: string): Promise<CourseGradeBoard> {
  const [assignments, enrolments, grades, submissions] = await Promise.all([
    prisma.assignment.findMany({
      where: { institutionId, sectionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, weightPercent: true, maxScore: true },
    }),
    prisma.enrolment.findMany({
      where: { institutionId, sectionId, status: "enrolled" },
      select: {
        studentId: true,
        student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } },
      },
      orderBy: { student: { person: { familyName: "asc" } } },
    }),
    prisma.gradeItem.findMany({
      where: { institutionId, assignment: { sectionId } },
      select: { assignmentId: true, studentId: true, score: true, maxScore: true, status: true },
    }),
    prisma.submission.findMany({
      where: { institutionId, assignment: { sectionId } },
      select: { assignmentId: true, studentId: true, status: true },
    }),
  ]);
  const gradeFor = new Map(grades.map((g) => [`${g.assignmentId}:${g.studentId}`, g]));
  const submissionFor = new Map(submissions.map((s) => [`${s.assignmentId}:${s.studentId}`, s]));
  const encoded = encodeURIComponent(sectionId);

  return {
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      weightPercent: Number(a.weightPercent),
      maxScore: Number(a.maxScore),
      submitted: submissions.filter((s) => s.assignmentId === a.id && s.status === "submitted").length,
    })),
    rows: enrolments.map((e) => {
      let weightSum = 0;
      let weighted = 0;
      const cells = assignments.map((a) => {
        const grade = gradeFor.get(`${a.id}:${e.studentId}`);
        const submission = submissionFor.get(`${a.id}:${e.studentId}`);
        if (grade?.score != null && grade.maxScore > 0) {
          weightSum += Number(a.weightPercent);
          weighted += (grade.score / grade.maxScore) * Number(a.weightPercent);
        }
        return {
          assignmentId: a.id,
          mark: grade?.score != null ? `${grade.score}/${grade.maxScore}` : null,
          status: grade?.score != null ? grade.status : submission?.status === "submitted" ? "submitted" : "missing",
        };
      });
      return {
        studentId: e.studentId,
        name: `${e.student.person.givenName} ${e.student.person.familyName}`.trim(),
        studentNumber: e.student.studentNumber,
        cells,
        total: weightSum ? `${Math.round((weighted / weightSum) * 1000) / 10}%` : null,
      };
    }),
    gradebookHref: `/instructor/gradebook?sectionId=${encoded}`,
    submissionsHref: `/instructor/submissions?sectionId=${encoded}`,
  };
}
