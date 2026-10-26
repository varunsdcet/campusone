export type StatusRecord = {
  id: string;
  parent?: unknown;
  name?: unknown;
  description?: unknown;
};

export type StatusNode<T extends StatusRecord> = { row: T; children: T[] };

const text = (value: unknown) => String(value ?? "").trim();

/** Keeps matching children under their parent and makes orphaned records visible. */
export function buildStatusTree<T extends StatusRecord>(rows: T[], query = ""): StatusNode<T>[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots = rows.filter((row) => {
    const parent = text(row.parent);
    return !parent || !byId.has(parent);
  });
  const needle = query.trim().toLocaleLowerCase();
  const matches = (row: T) => `${text(row.name)} ${text(row.description)}`.toLocaleLowerCase().includes(needle);

  return roots.flatMap((row) => {
    const children = rows.filter((candidate) => text(candidate.parent) === row.id);
    if (!needle || matches(row)) return [{ row, children }];
    const matchingChildren = children.filter(matches);
    return matchingChildren.length ? [{ row, children: matchingChildren }] : [];
  });
}
