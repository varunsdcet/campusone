/** Students directory filter menus (HCC MySIS layout). Options come from the live directory rows, never a fixed list. */

export type FilterGroup = {
  label: string;
  /** Selectable options. Disabled visual headings go in `headings`. */
  options: string[];
  /** Non-selectable labels rendered as disabled options before following options. */
  sections?: Array<{ heading: string; options: string[] }>;
};

export type FilterMenu = {
  all: string;
  flat?: string[];
  groups?: FilterGroup[];
  /** Extra leading options after `all` (e.g. "All Programs" duplicate under All). */
  leading?: string[];
};

export const FILTER_ALL_LABELS = {
  campus: "All Campuses",
  program: "All Programs",
  pathway: "All Pathways",
  schedule: "All Schedules",
  programTerm: "All Program Terms",
  admissionTerm: "All Admission Terms",
  nationality: "All Nationalities",
  status: "All Statuses",
  agent: "All Agents",
  advisor: "All Advisors",
} as const;

export type FilterKey = keyof typeof FILTER_ALL_LABELS;

export const PER_PAGE_OPTS = ["10", "25", "50", "100"];

/** Placeholder shown where admin has not recorded a value; never offered as a filter option. */
export const NO_VALUE = "—";

export function distinctValues(values: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t && t !== NO_VALUE) out.add(t);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function buildFilterMenu(all: string, values: Iterable<string>, ordered = false): FilterMenu {
  if (!ordered) return { all, flat: distinctValues(values) };
  const seen = new Set<string>();
  const flat: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t || t === NO_VALUE || seen.has(t)) continue;
    seen.add(t);
    flat.push(t);
  }
  return { all, flat };
}

/** Flatten selectable option values from a menu (excludes all/leading-only "All"). */
export function selectableValues(menu: FilterMenu): string[] {
  const out: string[] = [];
  if (menu.flat) out.push(...menu.flat);
  for (const g of menu.groups || []) {
    out.push(...g.options);
    for (const s of g.sections || []) out.push(...s.options);
  }
  return out;
}

export function serializeFilterMenu(menu: FilterMenu) {
  return {
    all: menu.all,
    leading: menu.leading || [],
    flat: menu.flat || [],
    groups: (menu.groups || []).map((g) => ({
      label: g.label,
      options: g.options,
      sections: (g.sections || []).map((s) => ({ heading: s.heading, options: s.options })),
    })),
  };
}
