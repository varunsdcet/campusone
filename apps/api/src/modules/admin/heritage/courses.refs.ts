import { prisma } from "@myheritage/db";

/** Course Management records replace the generic C19–C26 lists in shared dropdowns once they exist. */
export async function courseRefLists(inst: string) {
  const screens = ["CM:CATEGORY", "CM:GROUP", "CM:TYPE", "CM:GRADING", "CM:COMPETENCY"];
  const [rows, badges] = await Promise.all([
    prisma.heritageRecord.findMany({
      where: { institutionId: inst, screenId: { in: screens }, deletedAt: null, singletonKey: null },
      select: { screenId: true, dataJson: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.badgeDefinition.findMany({ where: { institutionId: inst, status: "active" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const of = (screen: string) =>
    rows
      .filter((r) => r.screenId === screen)
      .map((r) => {
        try {
          return JSON.parse(r.dataJson) as Record<string, unknown>;
        } catch {
          return {};
        }
      });
  const names = (list: Array<Record<string, unknown>>) =>
    list
      .map((d) => (typeof d.name === "string" ? d.name : ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  const active = (d: Record<string, unknown>) => d.active !== "Inactive" && d.status !== "Inactive";
  const out: Record<string, string[]> = {
    courseCategories: names(of("CM:CATEGORY").filter(active)),
    courseGroups: names(of("CM:GROUP")),
    courseTypes: names(of("CM:TYPE").filter(active)),
    gradingSchemes: names(of("CM:GRADING").filter(active)),
    competencies: names(of("CM:COMPETENCY").filter(active)),
    badges: badges.map((b) => b.name),
  };
  return Object.fromEntries(Object.entries(out).filter(([, list]) => list.length));
}
