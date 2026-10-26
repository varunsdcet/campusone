import { prisma } from "@myheritage/db";
import { ymdIn } from "./workshopPolicy.js";

type TermLike = { startsOn: string; endsOn: string; code: string };

const day = (v: string) => (v || "").slice(0, 10);

/**
 * The institution's current term by date: the term running today (the one ending soonest when several overlap,
 * so a regular term wins over a long multi-term window), else the nearest upcoming term, else the most recently ended term.
 */
export function pickCurrentTerm<T extends TermLike>(terms: T[], today: string): T | null {
  const on = day(today);
  const running = terms.filter((t) => day(t.startsOn) <= on && on <= day(t.endsOn));
  if (running.length)
    return [...running].sort((a, b) => day(a.endsOn).localeCompare(day(b.endsOn)) || day(b.startsOn).localeCompare(day(a.startsOn)) || a.code.localeCompare(b.code))[0]!;
  const upcoming = terms.filter((t) => day(t.startsOn) > on).sort((a, b) => day(a.startsOn).localeCompare(day(b.startsOn)) || a.code.localeCompare(b.code));
  if (upcoming.length) return upcoming[0]!;
  const past = [...terms].sort((a, b) => day(b.endsOn).localeCompare(day(a.endsOn)) || a.code.localeCompare(b.code));
  return past[0] ?? null;
}

export async function currentTerm(institutionId: string, now = new Date()) {
  const [terms, institution] = await Promise.all([
    prisma.term.findMany({ where: { institutionId } }),
    prisma.institution.findFirst({ where: { institutionId }, select: { timezone: true } }),
  ]);
  return pickCurrentTerm(terms, ymdIn(now, institution?.timezone || "America/Vancouver"));
}
