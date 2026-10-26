import { prisma } from "@myheritage/db";

export type TermRef = { id: string; code: string; name: string; startsOn: string; endsOn: string };

export const UNASSIGNED_TERM = "Not assigned";

const day = (v: string | null | undefined) => (v ?? "").slice(0, 10);
const covers = (t: TermRef, on: string) => day(t.startsOn) <= on && on <= day(t.endsOn);

/**
 * The term a section actually runs in. A section saved with "— None —" still carries a fallback term id (the schema
 * requires one), so the stored term only counts when it covers the section's start date; otherwise the term whose
 * range covers the section's dates (shortest first), else none — never an unrelated term.
 */
export function sectionTerm<T extends TermRef>(assigned: T | null | undefined, dates: { startsOn?: string | null; endsOn?: string | null }, terms: T[]): T | null {
  const start = day(dates.startsOn);
  if (!start) return assigned ?? null;
  if (assigned && covers(assigned, start)) return assigned;
  const end = day(dates.endsOn);
  const span = (t: T) => Date.parse(day(t.endsOn)) - Date.parse(day(t.startsOn));
  const running = terms.filter((t) => covers(t, start)).sort((a, b) => Number(!!end && !covers(a, end)) - Number(!!end && !covers(b, end)) || span(a) - span(b) || a.code.localeCompare(b.code));
  return running[0] ?? null;
}

export const termLabel = (t: { name: string } | null | undefined) => t?.name || UNASSIGNED_TERM;

export function institutionTerms(institutionId: string): Promise<TermRef[]> {
  return prisma.term.findMany({ where: { institutionId }, select: { id: true, code: true, name: true, startsOn: true, endsOn: true } });
}
