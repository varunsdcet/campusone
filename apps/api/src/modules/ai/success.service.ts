import type { StudentRiskAnalysis } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

export async function getStudentSuccessSignals(input: {
  institutionId: string;
  studentId: string;
}): Promise<StudentRiskAnalysis> {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, institutionId: input.institutionId },
  });
  if (!student) {
    throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
  }

  const now = Date.now();
  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId: input.institutionId,
      section: {
        institutionId: input.institutionId,
        enrolments: {
          some: {
            institutionId: input.institutionId,
            studentId: student.id,
            status: { in: ["enrolled", "completed"] },
          },
        },
      },
    },
    include: {
      submissions: {
        where: { institutionId: input.institutionId, studentId: student.id },
        select: { id: true },
      },
      section: { include: { course: true } },
    },
    take: 30,
  });

  const missing = assignments.filter((a) => a.submissions.length === 0 && a.dueAt && a.dueAt.getTime() < now);
  const signals = [];
  if (missing.length >= 1) {
    signals.push({
      id: `signal:missing:${student.id}`,
      label: `${missing.length} overdue assignment(s) without submission`,
      detail: missing
        .slice(0, 3)
        .map((a) => `${a.section.course.code} · ${a.title}`)
        .join("; "),
      evidenceUri: "/student/assignments",
    });
  }

  const lowGrades = await prisma.gradeItem.findMany({
    where: {
      institutionId: input.institutionId,
      studentId: student.id,
      status: "published",
      score: { lt: 60 },
    },
    include: { assignment: { include: { section: { include: { course: true } } } } },
    take: 5,
  });
  if (lowGrades.length) {
    signals.push({
      id: `signal:grades:${student.id}`,
      label: `${lowGrades.length} published grade(s) below 60`,
      detail: lowGrades
        .map((g) => `${g.assignment.section.course.code} · ${g.assignment.title}: ${g.score}/${g.maxScore}`)
        .join("; "),
      evidenceUri: "/student/grades",
    });
  }

  if (student.standing.toLowerCase().includes("probation")) {
    signals.push({
      id: `signal:standing:${student.id}`,
      label: "Academic standing flag",
      detail: `Standing on record: ${student.standing}`,
      evidenceUri: "/student/profile",
    });
  }

  const level = signals.length >= 3 ? "elevated" : signals.length >= 1 ? "watch" : "none";
  return {
    studentId: student.id,
    level,
    signals,
    explanation:
      level === "none"
        ? "No elevated academic risk signals from missing work, low published grades, or standing flags."
        : "Level is derived only from countable academic records listed above — not from health, finance, or personal inferences.",
    recommendedActions: [
      { label: "Review assignments", href: "/student/assignments" },
      { label: "Book advisor", href: "/student/advising" },
      { label: "View degree plan", href: "/student/degree" },
    ],
    claims: [
      {
        kind: "fact",
        text: `${signals.length} explainable signal(s); level=${level}.`,
        evidenceIds: signals.map((s) => s.id),
      },
    ],
  };
}
