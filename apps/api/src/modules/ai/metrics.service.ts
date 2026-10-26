import type { EnrollmentMetricsSnapshot, ExecutiveMetricsSnapshot } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

const CAPACITY_ASSUMPTION = 30;

export async function getEnrollmentMetrics(institutionId: string): Promise<EnrollmentMetricsSnapshot> {
  const [studentCount, sectionCount, enrolmentCount, pendingApprovals, students, sections] = await Promise.all([
    prisma.student.count({ where: { institutionId } }),
    prisma.section.count({ where: { institutionId } }),
    prisma.enrolment.count({ where: { institutionId, status: { in: ["enrolled", "completed"] } } }),
    prisma.approvalRequest.count({ where: { institutionId, status: "pending" } }),
    prisma.student.findMany({
      where: { institutionId },
      select: { programName: true, programVersion: { include: { program: true } } },
    }),
    prisma.section.findMany({
      where: { institutionId },
      include: {
        course: true,
        _count: { select: { enrolments: true } },
      },
      take: 40,
    }),
  ]);

  const byProgramMap = new Map<string, { programCode: string; programName: string; studentCount: number }>();
  for (const student of students) {
    const programCode = student.programVersion?.program.code ?? "UNDECLARED";
    const programName = student.programVersion?.program.name ?? student.programName;
    const key = programCode;
    const current = byProgramMap.get(key) ?? { programCode, programName, studentCount: 0 };
    current.studentCount += 1;
    byProgramMap.set(key, current);
  }

  const lowUtilizationSections = sections
    .map((section) => {
      const enrolled = section._count.enrolments;
      const utilizationPct = Math.round((enrolled / CAPACITY_ASSUMPTION) * 1000) / 10;
      return {
        sectionCode: section.code,
        courseCode: section.course.code,
        enrolled,
        capacityAssumption: CAPACITY_ASSUMPTION,
        utilizationPct,
      };
    })
    .filter((row) => row.utilizationPct < 40)
    .slice(0, 10);

  return {
    institutionId,
    asOf: new Date().toISOString(),
    studentCount,
    sectionCount,
    enrolmentCount,
    pendingApprovals,
    byProgram: [...byProgramMap.values()].sort((a, b) => b.studentCount - a.studentCount),
    lowUtilizationSections,
    filters: { institutionScoped: true },
    source: "controlled_enrollment_metrics_v1",
  };
}

export async function getExecutiveMetrics(institutionId: string): Promise<ExecutiveMetricsSnapshot> {
  const [enrollment, publishedGradeCount, draftGradeCount, openSuccessCases, advisingRequested] = await Promise.all([
    getEnrollmentMetrics(institutionId),
    prisma.gradeItem.count({ where: { institutionId, status: "published" } }),
    prisma.gradeItem.count({ where: { institutionId, status: "draft" } }),
    prisma.successCase.count({ where: { institutionId, status: "open" } }),
    prisma.advisingAppointment.count({ where: { institutionId, status: "requested" } }),
  ]);
  return {
    institutionId,
    asOf: new Date().toISOString(),
    enrollment,
    academic: {
      publishedGradeCount,
      draftGradeCount,
      openSuccessCases,
      advisingRequested,
    },
    source: "controlled_executive_metrics_v1",
  };
}
