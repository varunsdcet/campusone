import { prisma } from "@myheritage/db";
import { institutionTerms, sectionTerm, type TermRef } from "../../lib/sectionTerm.js";
import { institutionTimezone, ymdIn } from "../../lib/workshopPolicy.js";
import { sectionOfferings, type Offering } from "../courses/sectionOffering.js";
import { dateBoundsFromSessions, deliveryFromSessions } from "../courses/sectionSchedule.js";

export type SectionTiming = "current" | "upcoming" | "ended";

export type SectionRunFacts = {
  startsOn: string | null;
  endsOn: string | null;
  delivery: string | null;
  timing: SectionTiming | null;
};

type SectionDates = {
  term: { startsOn: string; endsOn: string } | null;
  academicBlock: { startsOn: string; endsOn: string } | null;
  classSessions: Array<{ startsAt: Date; endsAt: Date | null; deliveryMode: string }>;
};

/** Same precedence as the student My Courses list: the offering form, then the academic block, class sessions, and term. */
export function sectionRunFacts(section: SectionDates, offering: Offering | undefined, tz: string, today: string): SectionRunFacts {
  const fromSessions = dateBoundsFromSessions(section.classSessions, tz);
  const startsOn =
    offering?.startsOn || section.academicBlock?.startsOn || fromSessions.startsOn || section.term?.startsOn || null;
  const endsOn = offering?.continuous
    ? offering.endsOn
    : offering?.endsOn || section.academicBlock?.endsOn || fromSessions.endsOn || section.term?.endsOn || null;
  const start = startsOn?.slice(0, 10) ?? null;
  const end = endsOn?.slice(0, 10) ?? null;
  const timing: SectionTiming | null =
    start && today < start ? "upcoming" : end && today > end ? "ended" : start || end ? "current" : null;
  return {
    startsOn: start,
    endsOn: end,
    delivery: offering?.deliveryMethod || deliveryFromSessions(section.classSessions),
    timing,
  };
}

export async function loadSectionRunFacts(institutionId: string, sectionIds: string[]) {
  const out = new Map<string, SectionRunFacts>();
  if (!sectionIds.length) return out;
  const [sections, offerings, tz] = await Promise.all([
    prisma.section.findMany({
      where: { institutionId, id: { in: sectionIds } },
      select: {
        id: true,
        term: { select: { startsOn: true, endsOn: true } },
        academicBlock: { select: { startsOn: true, endsOn: true } },
        classSessions: { orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true, deliveryMode: true } },
      },
    }),
    sectionOfferings(institutionId, sectionIds),
    institutionTimezone(institutionId),
  ]);
  const today = ymdIn(new Date(), tz);
  for (const s of sections) out.set(s.id, sectionRunFacts(s, offerings.get(s.id), tz, today));
  return out;
}

/** The term each section actually runs in (`sectionTerm` on its run dates), so a stored fallback term is never shown. */
export async function loadSectionTerms(institutionId: string, sections: Array<{ id: string; term: TermRef | null }>) {
  const ids = [...new Set(sections.map((s) => s.id))];
  const [facts, terms] = await Promise.all([loadSectionRunFacts(institutionId, ids), ids.length ? institutionTerms(institutionId) : []]);
  return new Map(sections.map((s) => [s.id, sectionTerm(s.term, facts.get(s.id) ?? {}, terms)] as const));
}
