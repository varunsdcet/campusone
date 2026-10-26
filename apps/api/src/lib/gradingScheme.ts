import { prisma } from "@myheritage/db";

type GradeBand = { letter?: unknown; percent?: unknown; gradePoint?: unknown };
export type ResolvedGradeBand = { letter: string; percent: number; gradePoint: number | null };

const FALLBACK_BANDS: ResolvedGradeBand[] = [
  { letter: "A+", percent: 95, gradePoint: 4 }, { letter: "A", percent: 90, gradePoint: 4 },
  { letter: "A-", percent: 85, gradePoint: 3.7 }, { letter: "B+", percent: 80, gradePoint: 3.3 },
  { letter: "B", percent: 75, gradePoint: 3 }, { letter: "B-", percent: 70, gradePoint: 2.7 },
  { letter: "C+", percent: 65, gradePoint: 2.3 }, { letter: "C", percent: 60, gradePoint: 2 },
  { letter: "D", percent: 50, gradePoint: 1 }, { letter: "F", percent: 0, gradePoint: 0 },
];

function parse(json: string) {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function configuredSchemeId(institutionId: string, sectionId: string, courseId: string) {
  const settings = await prisma.heritageRecord.findMany({
    where: {
      institutionId,
      deletedAt: null,
      singletonKey: "settings",
      OR: [
        { screenId: "CM:SESSION", contextKey: sectionId },
        { screenId: "CM:COURSE", contextKey: courseId },
      ],
    },
  });
  const session = settings.find((row) => row.screenId === "CM:SESSION");
  const course = settings.find((row) => row.screenId === "CM:COURSE");
  return String(parse(session?.dataJson ?? "{}").gradingScheme || parse(course?.dataJson ?? "{}").gradingScheme || "");
}

/** Resolves the section/course grading scheme; falls back to the standard scale only when none is configured. */
export async function gradeBandsForSection(institutionId: string, sectionId: string, courseId: string): Promise<ResolvedGradeBand[]> {
  const schemeId = await configuredSchemeId(institutionId, sectionId, courseId);
  const scheme = schemeId
    ? await prisma.heritageRecord.findFirst({ where: { id: schemeId, institutionId, screenId: "CM:GRADING", deletedAt: null } })
    : await prisma.heritageRecord.findFirst({ where: { institutionId, screenId: "CM:GRADING", deletedAt: null }, orderBy: { createdAt: "asc" } });
  const grades = Array.isArray(parse(scheme?.dataJson ?? "{}").grades) ? parse(scheme?.dataJson ?? "{}").grades as GradeBand[] : [];
  const resolved = grades
    .map((grade) => ({ letter: String(grade.letter || ""), percent: Number(grade.percent), gradePoint: Number.isFinite(Number(grade.gradePoint)) ? Number(grade.gradePoint) : null }))
    .filter((grade) => grade.letter && Number.isFinite(grade.percent))
    .sort((a, b) => b.percent - a.percent);
  return resolved.length ? resolved : FALLBACK_BANDS;
}

/** Resolves the section/course grading scheme; falls back to the standard scale only when none is configured. */
export async function letterForSection(institutionId: string, sectionId: string, courseId: string, score: number, maxScore: number) {
  const pct = (score / maxScore) * 100;
  const grades = await gradeBandsForSection(institutionId, sectionId, courseId);
  return grades.find((grade) => pct >= grade.percent)?.letter ?? grades.at(-1)?.letter ?? "F";
}
