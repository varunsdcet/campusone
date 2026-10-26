type ValueField = { key: string; kind: string; dflt?: unknown };
type Values = Record<string, unknown>;

const LIST_KINDS = new Set(["multi", "multiList", "dual", "files", "refMulti", "people", "rows"]);

function emptyValue(field: ValueField): unknown {
  if (field.kind === "bool") return false;
  if (LIST_KINDS.has(field.kind)) return [];
  if (field.kind === "file") return null;
  return "";
}

export function initialValues(fields: ValueField[], base?: Values): Values {
  const out: Values = {};
  for (const field of fields) {
    if (field.kind === "secret" || field.kind === "password") out[field.key] = "";
    else out[field.key] = base && field.key in base ? base[field.key] : field.dflt !== undefined ? field.dflt : emptyValue(field);
  }
  if (base) for (const key of Object.keys(base)) if (key.startsWith("_has_")) out[key] = base[key];
  return out;
}

export function bodyOf(values: Values) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith("_has_")));
}

/** Converts `?d.field=value` links into safe create-form defaults. */
export function defaultsFromEntries(entries: Iterable<[string, string]>): Values {
  return Object.fromEntries([...entries].filter(([key]) => key.startsWith("d.") && key.length > 2).map(([key, value]) => [key.slice(2), value]));
}
