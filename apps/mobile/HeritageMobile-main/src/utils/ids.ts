let counter = 0;
/** Deterministic-enough local id generator (prefix + timestamp + counter). */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
