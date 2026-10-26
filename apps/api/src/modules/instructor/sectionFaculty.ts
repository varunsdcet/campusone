import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { S as COURSE_SCREENS, settingsOf } from "../admin/heritage/courses.js";

type SectionFacultyRef = { id: string; instructorPersonId: string };

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];

/**
 * Course Management stores every assigned faculty account in the session settings. The relational
 * `instructorPersonId` remains the lead-faculty compatibility field, but it must not restrict access
 * for the additional faculty selected by an administrator.
 */
export async function facultySectionIds(user: SessionClaims, requestedIds?: string[]) {
  const sections = await prisma.section.findMany({
    where: {
      institutionId: user.institutionId,
      ...(requestedIds ? { id: { in: requestedIds } } : {}),
    },
    select: { id: true, instructorPersonId: true },
  });
  if (user.roles.includes("admin") || user.roles.includes("registrar")) return new Set(sections.map((section) => section.id));

  return assignedFacultySectionIds(user, requestedIds, sections);
}

/**
 * Personal teaching surfaces remain assignment-scoped even when the signed-in person also has an
 * administrative role. Course Management can stay institution-wide while "My Courses" only shows
 * sections where that person was explicitly selected as faculty.
 */
export async function assignedFacultySectionIds(
  user: SessionClaims,
  requestedIds?: string[],
  loadedSections?: SectionFacultyRef[],
) {
  const sections = loadedSections ?? await prisma.section.findMany({
    where: {
      institutionId: user.institutionId,
      ...(requestedIds ? { id: { in: requestedIds } } : {}),
    },
    select: { id: true, instructorPersonId: true },
  });

  const settings = await settingsOf(user.institutionId, COURSE_SCREENS.session, sections.map((section) => section.id));
  return new Set(
    sections
      .filter(
        (section) =>
          section.instructorPersonId === user.personId ||
          strings(settings.get(section.id)?.data.instructors).includes(user.accountId),
      )
      .map((section) => section.id),
  );
}

export async function isFacultyAssigned(user: SessionClaims, section: SectionFacultyRef) {
  if (user.roles.includes("admin") || user.roles.includes("registrar")) return true;
  if (section.instructorPersonId === user.personId) return true;
  const ids = await facultySectionIds(user, [section.id]);
  return ids.has(section.id);
}
